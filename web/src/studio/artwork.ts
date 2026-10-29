import {isManufacturing} from './manufacturing'
import type { GraphJson, NodeType } from '../api'
import { compileRecipe, copy, editParameter, object, operations, rawGraph, type ObjectValue, type ProjectDocument } from './project'
import { activeStyle, styleRecipe } from './recipes'

export const artworkTypes = ['source', 'text', 'transform', 'threshold', 'reduce', 'smooth', 'morphology', 'trace', 'round_corners', 'remove_islands', 'shapes_to_mask'] as const
export const artworkGroups: Record<string, string[]> = {
  'Image & framing': ['source', 'transform'], 'Paint selection': ['threshold', 'reduce'],
  Cleanup: ['smooth', 'morphology', 'remove_islands'], Outlines: ['trace', 'round_corners', 'shapes_to_mask'], Text: ['text'],
}
export const artworkNames: Record<string, string> = { source: 'Original image', remesh: 'Optimize mesh', complexity: 'Optimize mesh', text: 'Text artwork', transform: 'Crop & rotate', threshold: 'Paint selection', reduce: 'Reduce colours', smooth: 'Smooth edges', morphology: 'Reshape paint', trace: 'Trace outlines', round_corners: 'Round corners', remove_islands: 'Remove small shapes', shapes_to_mask: 'Convert outlines to paint', stencil: 'Make raster stencil', vector_stencil: 'Make vector stencil' }
export const artworkHelp: Record<string, string> = {
  'source.image_id': 'Choose an original image for this instance. Replacing it keeps the previous bytes for undo.',
  'source.resolution': 'Longest image edge in working pixels. This does not replace your original image.',
  'text.text': 'Type one or more lines. Text is its own artwork; it is not overlaid on an image.',
  'text.font': 'Choose one of the two fonts bundled with the engine.', 'text.size': 'Letter height in pixels before physical stencil scaling.',
  'text.padding': 'Empty space around the letters in pixels.', 'text.line_spacing': 'Distance between text lines relative to their height.',
  'transform.crop_left': 'Percentage of the input width removed from the left, before flip and rotation.',
  'transform.crop_right': 'Percentage of the input width removed from the right, before flip and rotation.',
  'transform.crop_top': 'Percentage of the input height removed from the top, before flip and rotation.',
  'transform.crop_bottom': 'Percentage of the input height removed from the bottom, before flip and rotation.',
  'transform.turn': 'Clockwise quarter turns after cropping and flipping.', 'transform.angle': 'Extra clockwise rotation; the canvas grows and new corners are white.',
  'transform.flip_h': 'Mirror left and right after cropping.', 'transform.flip_v': 'Mirror top and bottom after cropping.',
  'threshold.threshold': '256 selects automatic paint selection. Values 0–255 set the brightness cutoff; dark areas become holes.',
  'threshold.invert': 'Use light areas as paint instead of dark areas.', 'reduce.colours': 'Reduce the image to this many flat colours before paint selection.',
  'reduce.smooth': 'Blur before colour reduction; fine texture may disappear.', 'smooth.radius': 'Round pixel edges using a blur radius in input pixels. Thin strokes may disappear.',
  'smooth.supersample': 'Enlarge the paint mask before smoothing. Higher values use more memory.',
  'morphology.op': 'Shrink/grow paint, remove dots, fill gaps, extract edges or detect a pattern. These change paint, not physical bridge width.',
  'morphology.kernel': 'Neighbourhood shape used by shrinking, growing and edge operations.', 'morphology.radius': 'Neighbourhood radius in pixels.',
  'morphology.angle': 'Direction of a line-shaped neighbourhood.', 'morphology.iterations': 'Passes; zero runs one pass for ordinary operations, but means until stable for thinning.',
  'morphology.pattern': 'A 3×3 pattern for detecting dots, endpoints, corners or junctions.', 'morphology.custom': 'Three rows, for example x00 011 x1x: 1=paint, 0=empty, x=ignore.',
  'morphology.rotate': 'Also detect quarter-turn versions of a custom pattern.', 'trace.smooth': 'Smooth the traced outlines without changing the original image.',
  'trace.corner_deg': 'Direction change needed to keep a sharp corner. Higher values protect fewer corners.', 'trace.tolerance': 'Allow this many pixels of curve simplification; larger values remove detail.',
  'trace.min_area': 'Discard traced paint details below this area in pixel².', 'round_corners.max_angle': 'Round corners sharper than this angle.',
  'round_corners.radius': 'Target rounding radius in pixels; short neighbouring edges can limit it.', 'round_corners.round_concave': 'Also round empty spikes pointing into paint, which adds paint.',
  'remove_islands.delete_specks': 'Remove separate small paint shapes, including anything nested inside them.', 'remove_islands.fill_holes': 'Turn small enclosed empty regions into paint. This can remove letter counters.',
  'remove_islands.max_area': 'Area cutoff in pixel², not mm².', 'remove_islands.keep_largest': 'Keep only this many separate paint shapes. Zero keeps all shapes.',
  'shapes_to_mask.resolution': 'Rasterise outlines at this longest-edge pixel resolution.',
}
export const isArtwork = (type: string) => (artworkTypes as readonly string[]).includes(type)
const endpoint = (e: any, side: 'from' | 'to'): [string, string] => e[side] ?? (side === 'from' ? [e.source, e.sourceHandle] : [e.target, e.targetHandle])
const edge = (from: [string, string], to: [string, string]) => ({ from: [...from], to: [...to] })
const rawNode = (doc: ProjectDocument, id: string) => rawGraph(doc).nodes.find((n: any) => n.id === id)
function meta(doc: ProjectDocument) {
  if (doc.raw.stencilStudio != null && !object(doc.raw.stencilStudio)) throw Error('This project uses unsupported editor metadata. Its original data is unchanged.')
  return doc.raw.stencilStudio ??= {}
}
function archive(doc: ProjectDocument, label: string, removed: unknown[]) {
  const m = meta(doc); if (m.retired != null && !Array.isArray(m.retired)) throw Error('The project archive has an unsupported format.')
  ;(m.retired ??= []).push({ label, data: copy(removed) })
}
export function passList(doc: ProjectDocument) {
  const g = compileRecipe(doc), ops = operations(doc), leaves = g.nodes.filter(n => !g.edges.some(e => e.from[0] === n.id))
  return leaves.map((leaf, index) => {
    const seen = new Set<string>(); const visit = (id: string) => { if (seen.has(id)) return; seen.add(id); g.edges.filter(e => e.to[0] === id).forEach(e => visit(e.from[0])) }; visit(leaf.id)
    // Topological order, independent of serialized array order.
    const ordered: typeof ops = [], pending = ops.filter(n => seen.has(n.id))
    while (pending.length) { const i = pending.findIndex(n => g.edges.filter(e => e.to[0] === n.id).every(e => !pending.some(p => p.id === e.from[0]))); if (i < 0) { ordered.push(...pending); break }; ordered.push(...pending.splice(i, 1)) }
    return { id: leaf.id, name: String(doc.raw.stencilStudio?.passNames?.[leaf.id] ?? `Artwork ${index + 1} · ${artworkNames[leaf.type] ?? 'Specialist output'}`), steps: ordered }
  })
}
/** Validate only known endpoint types, while preserving unknown processors/ports untouched. */
export function validateRecipe(doc: ProjectDocument, catalogue: NodeType[]) {
  const graph = compileRecipe(doc), defs = new Map(catalogue.map(t => [t.id, t])), byId = new Map(graph.nodes.map(n => [n.id, n]))
  if (byId.size !== graph.nodes.length) throw Error('Processing step identities must be unique.')
  const inputs = new Set<string>()
  for (const e of graph.edges) {
    const from = byId.get(e.from[0]), to = byId.get(e.to[0]); if (!from || !to) throw Error('A processing input refers to a missing step.')
    const a = defs.get(from.type)?.outputs.find(p => p.name === e.from[1]), b = defs.get(to.type)?.inputs.find(p => p.name === e.to[1])
    if (defs.has(from.type) && !a || defs.has(to.type) && !b) throw Error('This saved connection uses an unavailable input or output.')
    if (a && b && a.type !== b.type && a.type !== 'any' && b.type !== 'any') throw Error('These artwork formats do not match. Choose a compatible input.')
    const key = e.to.join('/'); if (inputs.has(key)) throw Error('Each input can use only one result.'); inputs.add(key)
  }
  const visiting = new Set<string>(), done = new Set<string>()
  const visit = (id: string) => { if (visiting.has(id)) throw Error('That order would make a circular dependency.'); if (done.has(id)) return; visiting.add(id); graph.edges.filter(e => e.to[0] === id).forEach(e => visit(e.from[0])); visiting.delete(id); done.add(id) }
  graph.nodes.forEach(n => visit(n.id))
  for (const n of graph.nodes) for (const p of defs.get(n.type)?.inputs.filter(p => p.required) ?? []) if (!inputs.has(`${n.id}/${p.name}`)) throw Error(`${artworkNames[n.type] ?? 'This step'} needs a compatible input.`)
  return graph
}
export function insertionOptions(kind: string, catalogue: NodeType[]) {
  return catalogue.filter(t => (isArtwork(t.id) || isManufacturing(t.id) || t.id === 'remesh') && t.inputs.length === 1 && t.inputs[0].type === kind).map(t => ({ type: t.id, pair: t.outputs[0].type === kind ? null : t.id === 'trace' ? 'shapes_to_mask' : t.id === 'shapes_to_mask' ? 'trace' : null })).filter(o => catalogue.find(t => t.id === o.type)!.outputs[0].type === kind || o.pair)
}
const freshId = (g: ObjectValue, type: string, reserved: string[] = []) => { let id = `${type}-1`, i = 1; while (g.nodes.some((n: any) => n.id === id) || reserved.includes(id)) id = `${type}-${++i}`; return id }
export function insertArtwork(doc: ProjectDocument, target: string, input: string, type: string, catalogue: NodeType[]) {
  const graph = compileRecipe(doc), existing = graph.edges.find(e => e.to[0] === target && e.to[1] === input)
  if (!existing) throw Error('Choose an existing artwork input to insert before.')
  const consumer = graph.nodes.find(n => n.id === target)!, port = catalogue.find(t => t.id === consumer.type)?.inputs.find(p => p.name === input)
  const option = insertionOptions(port?.type ?? '', catalogue).find(o => o.type === type)
  if (!option) throw Error('This order changes artwork format. Use a compatible conversion pair or input.')
  const next = copy(doc), g = rawGraph(next), oldEdge = g.edges.find((e: any) => endpoint(e, 'to')[0] === target && endpoint(e, 'to')[1] === input)
  archive(next, 'Insert artwork step', [oldEdge]); g.edges = g.edges.filter((e: any) => e !== oldEdge)
  let from = existing.from
  for (const type of [option.type, ...(option.pair ? [option.pair] : [])]) {
    const def = catalogue.find(t => t.id === type)!, id = freshId(g, type, Object.keys(next.raw.stencilStudio?.disabled ?? {}))
    g.nodes.push({ id, type, params: Object.fromEntries(def.params.map(p => [p.name, p.default])) })
    g.edges.push(edge(from, [id, def.inputs[0].name])); from = [id, def.outputs[0].name]
  }
  g.edges.push(edge(from, [target, input])); validateRecipe(next, catalogue); return next
}
export function connectInput(doc: ProjectDocument, target: string, input: string, from: [string, string], catalogue: NodeType[]) {
  const next = copy(doc), g = rawGraph(next), old = g.edges.filter((e: any) => endpoint(e, 'to')[0] === target && endpoint(e, 'to')[1] === input)
  archive(next, 'Change artwork input', old); g.edges = g.edges.filter((e: any) => !old.includes(e)); g.edges.push(edge(from, [target, input])); validateRecipe(next, catalogue); return next
}
export function canBypass(doc: ProjectDocument, id: string, catalogue: NodeType[]) {
  const n = operations(doc).find(n => n.id === id), def = catalogue.find(t => t.id === (n?.type === 'complexity' ? 'remesh' : n?.type)), graph = compileRecipe(doc)
  return !!n && (isArtwork(n.type) || isManufacturing(n.type) || ['remesh','complexity'].includes(n.type)) && def?.inputs.length === 1 && def.outputs[0].type === def.inputs[0].type && !graph.edges.some(e => e.from[0] === id && e.from[1] !== def.outputs[0].name)
}
export function bypassArtwork(doc: ProjectDocument, id: string, catalogue: NodeType[], remove = false) {
  if (!canBypass(doc, id, catalogue)) throw Error('This step changes artwork format or supplies a diagnostic pass. Reconnect its consumers before removing it.')
  const next = copy(doc), g = rawGraph(next), links = g.edges.filter((e: any) => endpoint(e, 'from')[0] === id || endpoint(e, 'to')[0] === id)
  const incoming = links.find((e: any) => endpoint(e, 'to')[0] === id), downstream = links.filter((e: any) => endpoint(e, 'from')[0] === id)
  const node = rawNode(next, id), replacements = downstream.map((e: any) => edge(endpoint(incoming, 'from'), endpoint(e, 'to')))
  g.nodes = g.nodes.filter((n: any) => n !== node); g.edges = [...g.edges.filter((e: any) => !links.includes(e)), ...replacements]
  archive(next, remove ? 'Remove step' : 'Disable step', [node, ...links])
  if (!remove) { const m = meta(next); m.disabled ??= {}; if (!object(m.disabled)) throw Error('The disabled-step archive is unsupported.'); m.disabled[id] = { node, links, replacements } }
  validateRecipe(next, catalogue); return next
}
export function enableArtwork(doc: ProjectDocument, id: string, catalogue: NodeType[]) {
  const saved = doc.raw.stencilStudio?.disabled?.[id]; if (!saved) return doc
  const next = copy(doc), g = rawGraph(next)
  if (g.nodes.some((n: any) => n.id === id)) throw Error('This identity is already in use. Your disabled step is preserved.')
  const keys = saved.replacements.map((e: any) => JSON.stringify(e))
  if (!keys.every((key: string) => g.edges.some((e: any) => JSON.stringify(e) === key))) throw Error('This input changed while the step was disabled. Undo that change before enabling; saved settings are retained.')
  g.edges = [...g.edges.filter((e: any) => !keys.includes(JSON.stringify(e))), ...copy(saved.links)]; g.nodes.push(copy(saved.node)); delete meta(next).disabled[id]
  validateRecipe(next, catalogue); return next
}
export function removeArtwork(doc: ProjectDocument, id: string, catalogue: NodeType[]) {
  const graph = compileRecipe(doc), op = operations(doc).find(n => n.id === id)
  if (!op || !(isArtwork(op.type) || isManufacturing(op.type) || ['remesh','complexity'].includes(op.type))) throw Error('Choose a supported optional operation to remove.')
  if (graph.edges.some(e => e.from[0] === id)) return bypassArtwork(doc, id, catalogue, true)
  const next = copy(doc), g = rawGraph(next), node = rawNode(next, id), links = g.edges.filter((e: any) => endpoint(e, 'to')[0] === id)
  archive(next, 'Remove unused artwork step', [node, ...links]); g.nodes = g.nodes.filter((n: any) => n !== node); g.edges = g.edges.filter((e: any) => !links.includes(e)); validateRecipe(next, catalogue); return next
}
export function duplicatePass(doc: ProjectDocument, id: string, catalogue: NodeType[]) {
  const pass = passList(doc).find(p => p.id === id)
  if (!pass || pass.steps.some(s => !isArtwork(s.type) && !['stencil','vector_stencil','remesh','complexity'].includes(s.type))) throw Error('Only artwork passes can be duplicated here. Manufacturing branches stay unchanged.')
  const next = copy(doc), g = rawGraph(next), ids = new Map<string,string>()
  for (const op of pass.steps) { const node = copy(rawNode(doc, op.id)), id = freshId(g, op.type, Object.keys(next.raw.stencilStudio?.disabled ?? {})); ids.set(op.id,id); node.id=id; g.nodes.push(node) }
  for (const original of rawGraph(doc).edges) {
    const from = endpoint(original,'from'), to = endpoint(original,'to'); if (!ids.has(from[0]) || !ids.has(to[0])) continue
    const link = copy(original)
    if (Array.isArray(link.from)) { link.from[0]=ids.get(from[0]);link.to[0]=ids.get(to[0]) }
    else { link.source=ids.get(from[0]);link.target=ids.get(to[0]);link.id=`${link.source}/${link.sourceHandle}-${link.target}/${link.targetHandle}` }
    g.edges.push(link)
  }
  const leaf=ids.get(pass.id)!;const m=meta(next);m.passNames={...m.passNames,[leaf]:`${pass.name} copy`};validateRecipe(next,catalogue);return next
}
export function duplicateArtwork(doc: ProjectDocument, id: string, catalogue: NodeType[]) {
  const n = operations(doc).find(n => n.id === id); if (!n || !canBypass(doc, id, catalogue)) throw Error('Duplicate applies to optional steps that keep the same artwork format.')
  const input = catalogue.find(t => t.id === (n.type === 'complexity' ? 'remesh' : n.type))!.inputs[0].name
  const next = insertArtwork(doc, id, input, n.type === 'complexity' ? 'remesh' : n.type, catalogue)
  const added = operations(next).find(o => !operations(doc).some(n => n.id === o.id))!
  const data = rawNode(next, added.id); data.params = copy(n.params); return next
}
export function moveArtwork(doc: ProjectDocument, id: string, direction: -1 | 1, catalogue: NodeType[]) {
  const graph = compileRecipe(doc), left = direction < 0 ? graph.edges.find(e => e.to[0] === id)?.from[0] : id
  const right = direction < 0 ? id : graph.edges.find(e => e.from[0] === id)?.to[0]
  if (!left || !right || !canBypass(doc, left, catalogue) || !canBypass(doc, right, catalogue)) throw Error('These steps cannot exchange order without changing artwork format.')
  const between = graph.edges.filter(e => e.from[0] === left), into = graph.edges.filter(e => e.to[0] === left), after = graph.edges.filter(e => e.from[0] === right), rightInputs = graph.edges.filter(e => e.to[0] === right)
  if (between.length !== 1 || between[0].to[0] !== right || into.length !== 1 || rightInputs.length !== 1 || after.length !== 1) throw Error('Shared steps keep their branch connections. Choose an individual input instead.')
  const next = copy(doc), g = rawGraph(next), remove = g.edges.filter((e: any) => [left, right].includes(endpoint(e, 'from')[0]) || [left, right].includes(endpoint(e, 'to')[0]))
  archive(next, 'Reorder steps', remove); g.edges = g.edges.filter((e: any) => !remove.includes(e))
  g.edges.push(edge(into[0].from, rightInputs[0].to), edge([right, after[0].from[1]], [left, into[0].to[1]]), edge([left, between[0].from[1]], after[0].to)); validateRecipe(next, catalogue); return next
}
export function textRecipe(catalogue: NodeType[]): ProjectDocument {
  const doc = styleRecipe('', 'Text stencil', catalogue), g = rawGraph(doc)
  g.nodes = g.nodes.filter((n: any) => !['source', 'transform', 'threshold'].includes(n.type))
  const type = catalogue.find(t => t.id === 'text')!
  g.nodes.unshift({ id: 'text-artwork', type: 'text', params: Object.fromEntries(type.params.map(p => [p.name, p.default])) })
  g.edges = g.edges.filter((e: any) => g.nodes.some((n: any) => n.id === e.from[0]) && g.nodes.some((n: any) => n.id === e.to[0])); g.edges.unshift(edge(['text-artwork', 'mask'], ['outlines', 'mask']))
  doc.raw.stencilStudio.inputKind = 'text'; return doc
}
export function resetStyle(doc: ProjectDocument, catalogue: NodeType[]) {
  if (passList(doc).length !== 1 || operations(doc).some(n => !isArtwork(n.type) && !['stencil', 'vector_stencil'].includes(n.type))) throw Error('Reset style is available for one artwork pass. This custom project remains intact.')
  const old = copy(doc), source = operations(doc).find(n => n.type === 'source')
  const next = source ? styleRecipe(String(source.params.image_id), String(doc.raw.stencilStudio?.name ?? 'Stencil'), catalogue, activeStyle(doc)) : textRecipe(catalogue)
  const oldBuild = operations(doc).find(n=>['stencil','vector_stencil'].includes(n.type)), newBuild = rawGraph(next).nodes.find((n:any)=>n.type===oldBuild?.type)
  if (oldBuild && newBuild) newBuild.params = copy(oldBuild.params)
  next.raw.images = copy(doc.raw.images ?? {}); next.raw.stencilStudio.previousProject = old.raw
  return next
}
export function editMany(doc: ProjectDocument, id: string, values: ObjectValue) { let next = doc; for (const [key, value] of Object.entries(values)) next = editParameter(next, id, key, value); return next }
export function liveArtwork(doc: ProjectDocument) { try { return operations(doc).every(n => isArtwork(n.type) || ['stencil', 'vector_stencil','remesh','complexity'].includes(n.type)) && operations(doc).length <= 30 } catch { return false } }
export type PreviewStage = { id: string; step: string; port: string; label: string; kind: string; url: string; info: ObjectValue }
export function inputChoices(doc: ProjectDocument, id: string, port: string, catalogue: NodeType[]) {
  const g = compileRecipe(doc), target = g.nodes.find(n => n.id === id), kind = catalogue.find(t => t.id === target?.type)?.inputs.find(p => p.name === port)?.type
  return g.nodes.flatMap(n => (catalogue.find(t => t.id === n.type)?.outputs ?? []).filter(p => p.type === kind && !(p.type==='parts' && ['stencil','vector_stencil'].includes(n.type) && !g.edges.some(e=>e.to[0]===n.id&&e.to[1]==='tiles')) && !(p.type==='solid' && ['stencil','vector_stencil'].includes(n.type) && g.edges.some(e=>e.to[0]===n.id&&e.to[1]==='tiles'))).map(p => ({ from: [n.id, p.name] as [string, string], label: `${artworkNames[n.type] ?? catalogue.find(t => t.id === n.type)?.label ?? 'Saved result'}${g.nodes.filter(o => o.type === n.type).length > 1 ? ` ${g.nodes.filter(o => o.type === n.type).findIndex(o => o.id === n.id) + 1}` : ''}${p.name === 'removed' || p.name === 'rounded' ? ' · Removed details' : ''}` }))).filter(choice => { try { connectInput(doc, id, port, choice.from, catalogue); return true } catch { return false } })
}
export function renamePass(doc: ProjectDocument, id: string, name: string) { const next = copy(doc), m = meta(next); if (m.passNames != null && !object(m.passNames)) throw Error('Saved pass names use an unsupported format. They are unchanged.'); m.passNames = { ...m.passNames, [id]: name }; return next }
export function primaryInput(graph: GraphJson, id: string) { return graph.edges.find(e => e.to[0] === id) }
