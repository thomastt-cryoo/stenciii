import { api } from '../api'
import { compileRecipe, decodeBytes, operations, type ProjectDocument } from './project'
import { draftRecipe } from './recipes'

/** A separate single-thread engine inspects artwork without cancelling the final
 * stencil worker or publishing an intermediate image as an exportable model. */
export class ArtworkPreviewClient {
  private worker: Worker
  private sequence = 0
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; artifacts: any[] }>()
  private images = new Map<string, string>()
  private imageVersions = new Map<string, string | null>()
  constructor() {
    this.worker = new Worker(new URL('../engine.worker.ts', import.meta.url), { type: 'module', name: 'artwork-preview' })
    this.worker.onmessage = e => {
      const p = this.pending.get(e.data.id); if (!p) return
      if (e.data.step) { p.artifacts.push(...(e.data.step.artifacts ?? [])); if (e.data.step.state?.state === 'error') { this.pending.delete(e.data.id); p.reject(Error(e.data.step.state.error)) }; return }
      this.pending.delete(e.data.id); e.data.error ? p.reject(Error(e.data.error)) : p.resolve({ ...e.data.ok, artifacts: p.artifacts })
    }
    this.worker.onerror = e => { for (const p of this.pending.values()) p.reject(Error(e.message)); this.pending.clear() }
  }
  private call(message: Record<string, unknown>): Promise<any> {
    const id = ++this.sequence
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, artifacts: [] }); this.worker.postMessage({ id, ...message }) })
  }
  async render(doc: ProjectDocument, step: string, port: string, draft = false) {
    let graph = compileRecipe(doc)
    const keep = new Set<string>(); const visit = (id: string) => { if (keep.has(id)) return; keep.add(id); graph.edges.filter(e => e.to[0] === id).forEach(e => visit(e.from[0])) }; visit(step)
    graph = { nodes: graph.nodes.filter(n => keep.has(n.id)), edges: graph.edges.filter(e => keep.has(e.to[0]) && keep.has(e.from[0])) }
    const imageIds = new Map<string, string>()
    for (const source of operations(doc).filter(n => n.type === 'source' && keep.has(n.id))) {
      const id = String(source.params.image_id)
      const asset = doc.raw.images?.[id], version = asset?.base64 ?? null
      if (!this.images.has(id) || this.imageVersions.get(id) !== version) {
        const stored = !asset ? await api.storedImage(id) : null
        if (!asset && !stored) throw Error('Choose an original image for this artwork.')
        const bytes = asset ? decodeBytes(asset.base64) : new Uint8Array(stored!.bytes)
        const got = await this.call({ op: 'image', bytes: bytes.buffer }); this.images.set(id, got.id); this.imageVersions.set(id, version)
        imageIds.set(id, got.id)
      } else imageIds.set(id, this.images.get(id)!)
    }
    for (const node of graph.nodes) if (node.type === 'source') node.params.image_id = imageIds.get(String(node.params.image_id))
    if (draft) graph = draftRecipe(graph)
    const target = graph.nodes.find(n => n.id === step)
    if (!target) throw Error('This step is disabled or was removed. Choose another preview.')
    const selected = await this.call({ op: 'inspect', graph: JSON.stringify(graph), target: step, out: port })
    return { url: URL.createObjectURL(new Blob([selected.bytes], { type: selected.mime })), info: selected.info }
  }
  dispose() { this.worker.terminate(); for (const p of this.pending.values()) p.reject(Error('Preview closed')); this.pending.clear() }
}
