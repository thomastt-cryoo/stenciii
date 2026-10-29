import type { GraphJson, NodeType } from '../api'

export type ObjectValue = Record<string, any>
/** The saved JSON is authoritative. Execution projections never normalize it in place. */
export interface ProjectDocument { raw: ObjectValue }
export interface Operation { id: string; type: string; params: ObjectValue; title: string }
export const object = (v: unknown): v is ObjectValue => !!v && typeof v === 'object' && !Array.isArray(v)
export const copy = <T,>(v: T): T => structuredClone(v)

export function openDocument(value: unknown): ProjectDocument {
  if (!object(value)) throw new Error('This is not a project file. Choose a saved stencil project (.json).')
  const graph = object(value.graph) ? value.graph : value
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error('This file has no saved processing steps. Choose a stencil project.')
  // Preserve even malformed individual steps/unknown data so Save remains safe.
  return { raw: copy(value) }
}
export const rawGraph = (doc: ProjectDocument): ObjectValue => object(doc.raw.graph) ? doc.raw.graph : doc.raw
export const operations = (doc: ProjectDocument): Operation[] => rawGraph(doc).nodes.map((n: any, i: number) => {
  const data = object(n?.data) ? n.data : n ?? {}
  return { id: String(n?.id ?? `invalid-${i}`), type: String(data.type ?? ''), params: object(data.params) ? data.params : {}, title: String(data.title ?? data.type ?? 'Unavailable step') }
})
export const saveDocument = (doc: ProjectDocument) => JSON.stringify(doc.raw, null, 2)
export const signature = (doc: ProjectDocument) => JSON.stringify(rawGraph(doc)) + JSON.stringify(doc.raw.images ?? {})
export const projectName = (doc: ProjectDocument) => String(doc.raw.stencilStudio?.name ?? 'Untitled stencil')

/** Unknown fields, positions, branches, original ids and original image keys remain untouched. */
export function editParameter(doc: ProjectDocument, id: string, key: string, value: unknown): ProjectDocument {
  const next = copy(doc)
  const step = rawGraph(next).nodes.find((n: any) => n?.id === id)
  if (!step) throw new Error('The selected processing step is no longer in this project.')
  const data = object(step.data) ? step.data : step
  if (!('params' in data)) data.params = {}
  if (!object(data.params)) throw new Error('This step has an unsupported settings format. Its original data is preserved.')
  data.params[key] = value
  return next
}

export function compileRecipe(doc: ProjectDocument, imageIds: ReadonlyMap<string, string> = new Map()): GraphJson {
  const g = rawGraph(doc)
  const nodes = operations(doc).map(n => {
    if (!n.id || !n.type) throw new Error('A saved processing step is incomplete. The original project is preserved; review Compatibility.')
    const params = copy(n.params)
    if (n.type === 'source' && imageIds.has(String(params.image_id))) params.image_id = imageIds.get(String(params.image_id))
    return { id: n.id, type: n.type === 'complexity' ? 'remesh' : n.type, params }
  })
  const edges = g.edges.map((e: any) => {
    if (!object(e)) throw new Error('A saved processing connection is incomplete. Save a copy and review Compatibility.')
    const from = Array.isArray(e.from) ? e.from : [e.source, e.sourceHandle]
    const to = Array.isArray(e.to) ? e.to : [e.target, e.targetHandle]
    if ([...from, ...to].some(x => typeof x !== 'string') || from.length !== 2 || to.length !== 2) throw new Error('A saved processing dependency is incomplete. The original data is preserved.')
    return { from: [...from] as [string, string], to: [...to] as [string, string] }
  })
  return { nodes, edges }
}

export function standardRecipe(imageId: string, imageName: string, catalogue: NodeType[]): ProjectDocument {
  const defs = new Map(catalogue.map(t => [t.id, t]))
  const step = (id: string, type: string, overrides: ObjectValue = {}) => {
    const def = defs.get(type)
    if (!def) throw new Error('The stencil engine is still starting. Try again in a moment.')
    return { id, type, params: { ...Object.fromEntries(def.params.map(p => [p.name, p.default])), ...overrides } }
  }
  return { raw: { version: 2, stencilStudio: { schema: 1, name: imageName.replace(/\.[^.]+$/, '') }, images: {}, graph: {
    nodes: [step('artwork', 'source', { image_id: imageId }), step('paint', 'threshold'), step('outlines', 'trace'), step('plate', 'vector_stencil')],
    edges: [ { from: ['artwork', 'image'], to: ['paint', 'image'] }, { from: ['paint', 'mask'], to: ['outlines', 'mask'] }, { from: ['outlines', 'shapes'], to: ['plate', 'shapes'] } ],
  } } }
}

/** Recognize exact existing chains, never reinterpret a branch or a recipe with extra steps. */
export function quickRecipe(doc: ProjectDocument) {
  let graph: GraphJson
  try { graph = compileRecipe(doc) } catch { return null }
  const types = graph.nodes.map(n => n.type)
  const vector = types.includes('vector_stencil')
  const expected = ['source', ...(types.includes('transform') ? ['transform'] : []), 'threshold', ...(types.includes('smooth') ? ['smooth'] : []), ...(types.includes('morphology') ? ['morphology'] : []), ...(vector ? ['trace', ...(types.includes('remove_islands') ? ['remove_islands'] : []), 'vector_stencil'] : ['stencil'])]
  if (graph.nodes.length !== expected.length || expected.some(t => types.filter(x => x === t).length !== 1)) return null
  const chain = expected.map(t => graph.nodes.find(n => n.type === t)!)
  if (graph.edges.length !== chain.length - 1) return null
  const ports = chain.slice(0, -1).map(n => n.type === 'source' || n.type === 'transform' ? 'image' : ['trace', 'remove_islands'].includes(n.type) ? 'shapes' : 'mask')
  if (ports.some((p, i) => !graph.edges.some(e => e.from[0] === chain[i].id && e.from[1] === p && e.to[0] === chain[i + 1].id && e.to[1] === p))) return null
  const find = (type: string) => chain.find(n => n.type === type)
  return { source: chain[0], threshold: find('threshold')!, build: chain.at(-1)!, vector, transform: find('transform'), smoothing: find('smooth'), cleanup: find('remove_islands') ?? find('morphology'), trace: find('trace') }
}

export interface Command { label: string; before: ProjectDocument; after: ProjectDocument }
export class ProjectCommands {
  past: Command[] = []
  future: Command[] = []
  constructor(public current: ProjectDocument | null = null) {}
  reset(doc: ProjectDocument | null) { this.current = doc; this.past = []; this.future = [] }
  apply(label: string, update: (doc: ProjectDocument) => ProjectDocument, merge = false) {
    if (!this.current) return false
    const after = update(this.current)
    if (JSON.stringify(after) === JSON.stringify(this.current)) return false
    const previous = this.past.at(-1)
    if (merge && previous?.label === label && !this.future.length) previous.after = after
    else this.past.push({ label, before: this.current, after })
    this.past = this.past.slice(-100)
    this.future = []; this.current = after; return true
  }
  undo() { const c = this.past.pop(); if (!c) return false; this.future.push(c); this.current = c.before; return true }
  redo() { const c = this.future.pop(); if (!c) return false; this.past.push(c); this.current = c.after; return true }
}

export const encodeBytes = (bytes: ArrayBuffer) => {
  let text = ''; const b = new Uint8Array(bytes)
  for (let i = 0; i < b.length; i += 0x8000) text += String.fromCharCode(...b.subarray(i, i + 0x8000))
  return btoa(text)
}
export const decodeBytes = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))
