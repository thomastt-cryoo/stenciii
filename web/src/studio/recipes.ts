import type { GraphJson, NodeType } from '../api'
import { copy, editParameter, object, projectName, quickRecipe, adjustmentRecipe, rawGraph, standardRecipe, type ProjectDocument } from './project'

export const styles = [
  { id: 'standard', name: 'Standard', description: 'Balanced outlines for logos, lettering and everyday artwork.' },
  { id: 'smooth', name: 'Smooth Vector', description: 'Softer curves for organic shapes and rounded illustrations.' },
  { id: 'crisp', name: 'Crisp Raster', description: 'Pixel-defined edges for bold graphics and hard-edged artwork.' },
] as const
export type Style = typeof styles[number]['id']
export function activeStyle(doc: ProjectDocument): Style {
  if (['standard', 'smooth', 'crisp'].includes(doc.raw.stencilStudio?.style)) return doc.raw.stencilStudio.style
  const q = adjustmentRecipe(doc)
  return q?.vector ? q.smoothing ? 'smooth' : 'standard' : 'crisp'
}
export const detailLevels = ['Quick', 'Balanced', 'Fine'] as const
const resolutions: Record<Style, number[]> = { standard: [300, 650, 1000], smooth: [350, 700, 1100], crisp: [250, 500, 850] }

/** Every style is an ordinary engine recipe, also replayable by the native CLI. */
export function styleRecipe(imageId: string, name: string, catalogue: NodeType[], style: Style = 'standard'): ProjectDocument {
  const doc = standardRecipe(imageId, name, catalogue)
  const defs = new Map(catalogue.map(t => [t.id, t]))
  const node = (id: string, type: string, overrides = {}) => ({ id, type, params: { ...Object.fromEntries(defs.get(type)!.params.map(p => [p.name, p.default])), ...overrides } })
  const original = rawGraph(doc).nodes
  const source = original[0]; source.params.resolution = resolutions[style][1]
  const build = style === 'crisp' ? node('plate', 'stencil') : original[3]
  if (style !== 'crisp') build.params.detail = 4
  const chain = [source, node('framing', 'transform'), original[1], ...(style === 'smooth' ? [node('soften', 'smooth', { radius: .8, supersample: 2 })] : []), ...(style === 'crisp' ? [] : [style === 'smooth' ? node('outlines', 'trace', { smooth: 2, corner_deg: 100, tolerance: .25, min_area: 2 }) : original[2], node('cleanup', 'remove_islands', { delete_specks: false, fill_holes: false })]), build]
  rawGraph(doc).nodes = chain
  rawGraph(doc).edges = chain.slice(0, -1).map((n, i) => {
    const port = ['source', 'transform'].includes(n.type) ? 'image' : ['trace', 'remove_islands'].includes(n.type) ? 'shapes' : 'mask'
    return { from: [n.id, port], to: [chain[i + 1].id, port] }
  })
  doc.raw.stencilStudio = { ...doc.raw.stencilStudio, schema: 2, style }
  return doc
}

/** Bank whole graphs, including unknown imported fields. Never switch a branched workflow. */
export function switchStyle(doc: ProjectDocument, style: Style, catalogue: NodeType[]): ProjectDocument {
  const current = adjustmentRecipe(doc)
  if (!current) throw new Error('This custom workflow keeps its original processing. Style switching is available for simple image-to-stencil projects.')
  const before = activeStyle(doc)
  if (before === style) return doc
  const next = copy(doc)
  const meta = next.raw.stencilStudio
  if (meta != null && (typeof meta !== 'object' || Array.isArray(meta))) throw new Error('The project metadata has an unsupported format. Your workflow is unchanged.')
  if (meta?.styles != null && !object(meta.styles)) throw new Error('The saved style bank has an unsupported format. Your workflow is unchanged.')
  const storedGraph = doc.raw.graph ? copy(rawGraph(doc)) : { nodes: copy(doc.raw.nodes), edges: copy(doc.raw.edges) }
  const banks = { ...meta?.styles, [before]: storedGraph }
  let target = banks[style] ? copy(banks[style]) : rawGraph(styleRecipe(String(current.source.params.image_id), projectName(doc), catalogue, style))
  // Transfer common physical choices only when a style has never been used.
  if (!banks[style]) {
    const plate = target.nodes.find((n: any) => ['stencil', 'vector_stencil'].includes(n.type))
    for (const key of ['width_mm', 'thickness_mm', 'bridge_mm', 'margin_mm', 'layer_height_mm', 'extra_top_layers', 'raised_bridges', 'bridges_per_island']) if (key in current.build.params) plate.params[key] = current.build.params[key]
    for (const type of ['transform', 'threshold', 'remove_islands', 'morphology']) {
      const a = rawGraph(doc).nodes.find((n: any) => (n.data ?? n).type === type), b = target.nodes.find((n: any) => n.type === type)
      if (a && b) b.params = copy((a.data ?? a).params)
    }
  }
  // A replacement image is shared; each style's framing and processing remain independent.
  for (const n of target.nodes) if ((n.data ?? n).type === 'source') (n.data ?? n).params.image_id = current.source.params.image_id
  if (next.raw.graph) next.raw.graph = target
  else { next.raw.nodes = target.nodes; next.raw.edges = target.edges }
  next.raw.stencilStudio = { ...meta, schema: 2, style, styles: banks }
  if (!adjustmentRecipe(next) || activeStyle(next) !== style) throw new Error('This saved style uses a custom workflow. Its original data is preserved; open the original project to continue.')
  return next
}
export function setDetail(doc: ProjectDocument, level: number) {
  const q = adjustmentRecipe(doc); if (!q) return doc
  let next = editParameter(doc, q.source.id, 'resolution', resolutions[activeStyle(doc)][level])
  if (q.vector) next = editParameter(next, q.build.id, 'detail', [2, 4, 6][level])
  return next
}
export function detailLevel(doc: ProjectDocument): number | null {
  const q = adjustmentRecipe(doc); if (!q) return null
  const level = resolutions[activeStyle(doc)].indexOf(Number(q.source.params.resolution))
  return level >= 0 && (!q.vector || Number(q.build.params.detail) === [2, 4, 6][level]) ? level : null
}

/** Morphology's zero iterations still runs one pass for opening. Bypass the
 * operation explicitly, retaining its complete settings for a later re-enable. */
export function pixelCleanup(doc: ProjectDocument, enabled: boolean, catalogue: NodeType[]): ProjectDocument {
  const q = quickRecipe(doc)
  if (!q || q.vector || !q.transform || doc.raw.stencilStudio?.schema !== 2 || rawGraph(doc).nodes.some((n: any) => n.data)) throw new Error('Pixel cleanup is available in the Crisp Raster style. This imported workflow is unchanged.')
  if (!!q.cleanup === enabled) return doc
  const next = copy(doc), graph = rawGraph(next), meta = next.raw.stencilStudio
  if (enabled) {
    const saved = meta.pixelCleanup
    const node = saved?.node ?? { id: 'cleanup', type: 'morphology', params: { ...Object.fromEntries(catalogue.find(t => t.id === 'morphology')!.params.map(p => [p.name, p.default])), iterations: 1, radius: 1 } }
    if (node.type !== 'morphology' || graph.nodes.some((n: any) => n.id === node.id)) throw new Error('The saved cleanup step cannot be restored safely. Your workflow is unchanged.')
    const index = graph.nodes.findIndex((n: any) => n.id === q.build.id)
    const edge = graph.edges.find((e: any) => e.from[0] === q.threshold.id && e.to[0] === q.build.id)
    graph.nodes.splice(index, 0, copy(node))
    graph.edges = graph.edges.filter((e: any) => e !== edge)
    graph.edges.push(...copy(saved?.edges ?? [{ from: [q.threshold.id, 'mask'], to: [node.id, 'mask'] }, { from: [node.id, 'mask'], to: [q.build.id, 'mask'] }]))
    meta.pixelCleanup = { ...saved, originalEdge: copy(edge) }
  } else {
    const node = graph.nodes.find((n: any) => n.id === q.cleanup!.id)
    const edges = graph.edges.filter((e: any) => e.from[0] === node.id || e.to[0] === node.id)
    graph.nodes = graph.nodes.filter((n: any) => n !== node)
    graph.edges = graph.edges.filter((e: any) => !edges.includes(e))
    graph.edges.push(copy(meta.pixelCleanup?.originalEdge ?? { from: [q.threshold.id, 'mask'], to: [q.build.id, 'mask'] }))
    meta.pixelCleanup = { ...meta.pixelCleanup, node: copy(node), edges: copy(edges) }
  }
  if (!quickRecipe(next)) throw new Error('The cleanup change could not be connected safely. Your workflow is unchanged.')
  return next
}
/** Coarsening is execution-only. Saved parameters and the final recipe never change. */
export function draftRecipe(graph: GraphJson): GraphJson {
  const draft = copy(graph)
  for (const n of draft.nodes) {
    if (n.type === 'source') n.params.resolution = Math.min(Number(n.params.resolution ?? 1000), 200)
    if (n.type === 'vector_stencil') n.params.detail = Math.min(Number(n.params.detail ?? 5), 2)
    if (n.type === 'stencil' || n.type === 'vector_stencil') n.params.z_bridging = 'easy'
    if (n.type === 'remesh') { n.params.decimate = false; n.params.smoothing = 0 }
    if (n.type === 'smooth') n.params.supersample = 1
    if (n.type === 'shapes_to_mask') n.params.resolution = Math.min(Number(n.params.resolution ?? 1000), 200)
    if (n.type === 'text') {
      const scale = Math.min(1, 100 / Number(n.params.size ?? 160))
      n.params.size = Math.max(20, Math.round(Number(n.params.size ?? 160) * scale))
      n.params.padding = Math.round(Number(n.params.padding ?? 20) * scale)
    }
  }
  return draft
}

/** Editable qualified fields; the runtime catalogue remains authoritative. */
export function editable(type: string, _key: string) {
  return ['source','text','transform','threshold','reduce','smooth','morphology','trace','round_corners','remove_islands','shapes_to_mask','stencil','vector_stencil','remesh','complexity'].includes(type)
}
