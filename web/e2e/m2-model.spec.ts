import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { NodeType } from '../src/api'
import { activeStyle, draftRecipe, detailLevel, editable, setDetail, styleRecipe, styles, switchStyle, pixelCleanup } from '../src/studio/recipes'
import { compileRecipe, copy, editParameter, openDocument, ProjectCommands, quickRecipe, rawGraph, standardRecipe } from '../src/studio/project'
import { LivePreview } from '../src/studio/livePreview'
import { ParameterRegistry } from '../src/studio/registry'
import { inspectStl } from '../src/studio/artifacts'
const catalogue: NodeType[] = JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json', import.meta.url), 'utf8'))

test('three actual style recipes satisfy every engine input port and differ in processing', () => {
  for (const { id } of styles) {
    const doc = styleRecipe('image', 'Example.png', catalogue, id), graph = compileRecipe(doc)
    expect(activeStyle(doc)).toBe(id); expect(detailLevel(doc)).toBe(1); expect(quickRecipe(doc)).toBeTruthy()
    expect(graph.nodes.map(n => n.type)).toEqual(id === 'crisp' ? ['source', 'transform', 'threshold', 'stencil'] : ['source', 'transform', 'threshold', ...(id === 'smooth' ? ['smooth'] : []), 'trace', 'remove_islands', 'vector_stencil'])
    for (const n of graph.nodes) {
      const def = catalogue.find(t => t.id === n.type)!
      for (const port of def.inputs.filter(p => p.required)) {
        const edge = graph.edges.find(e => e.to[0] === n.id && e.to[1] === port.name)!
        expect(edge).toBeTruthy()
        const parent = graph.nodes.find(n => n.id === edge.from[0])!
        expect(catalogue.find(t => t.id === parent.type)!.outputs.find(p => p.name === edge.from[1])?.type).toBe(port.type)
      }
      for (const [key, value] of Object.entries(n.params)) new ParameterRegistry(catalogue).validate(n.type, key, value)
    }
  }
})
test('raster cleanup is truly bypassed by default and restores its exact settings and connections', () => {
  let doc = styleRecipe('i', 'x', catalogue, 'crisp'), before = copy(rawGraph(doc))
  expect(quickRecipe(doc)!.cleanup).toBeUndefined()
  doc = pixelCleanup(doc, true, catalogue)
  expect(quickRecipe(doc)!.cleanup!.params).toMatchObject({ iterations: 1, radius: 1 })
  doc = editParameter(doc, quickRecipe(doc)!.cleanup!.id, 'radius', 2)
  const enabled = copy(rawGraph(doc))
  doc = pixelCleanup(doc, false, catalogue); expect(rawGraph(doc)).toEqual(before)
  doc = pixelCleanup(doc, true, catalogue); expect(rawGraph(doc)).toEqual(enabled)
  expect(() => pixelCleanup(standardRecipe('i', 'x', catalogue), true, catalogue)).toThrow(/unchanged/)
})
test('style banks retain individual adjustments, source identity, old graphs and undo/redo', () => {
  let doc = standardRecipe('original', 'original.svg', catalogue)
  rawGraph(doc).nodes[2].opaque = { future: [false, 'a'] }; rawGraph(doc).edges[0].label = 'preserve'
  const original = copy(rawGraph(doc)), history = new ProjectCommands(doc)
  history.apply('Smooth', d => switchStyle(d, 'smooth', catalogue))
  history.apply('Radius', d => editParameter(d, quickRecipe(d)!.smoothing!.id, 'radius', 1.25))
  const smooth = copy(rawGraph(history.current!))
  history.apply('Crisp', d => switchStyle(d, 'crisp', catalogue)); history.undo()
  expect(rawGraph(history.current!)).toEqual(smooth); history.redo(); expect(activeStyle(history.current!)).toBe('crisp')
  doc = switchStyle(history.current!, 'standard', catalogue); expect(rawGraph(doc)).toEqual(original)
  doc = switchStyle(doc, 'smooth', catalogue); expect(rawGraph(doc)).toEqual(smooth)
  doc = editParameter(doc, quickRecipe(doc)!.source.id, 'image_id', 'replacement')
  doc = switchStyle(doc, 'crisp', catalogue); expect(quickRecipe(doc)!.source.params.image_id).toBe('replacement')
  expect(activeStyle(openDocument(JSON.parse(JSON.stringify(doc.raw))))).toBe('crisp')
})
test('native-root style banking stays bounded and advanced branches are never replaced', () => {
  let doc = openDocument({ ...rawGraph(standardRecipe('i', 'x', catalogue)), opaque: ['future'], images: { i: { base64: 'a' } } })
  for (let i = 0; i < 15; i++) doc = switchStyle(doc, styles[i % 3].id, catalogue)
  expect(JSON.stringify(doc).length).toBeLessThan(20000); expect(doc.raw.opaque).toEqual(['future'])
  rawGraph(doc).nodes.push({ id: 'future', type: 'future_processor', params: { preserve: [1] } })
  const before = copy(doc); expect(quickRecipe(doc)).toBeNull(); expect(() => switchStyle(doc, 'standard', catalogue)).toThrow(/custom/); expect(doc).toEqual(before)
})
test('detail profiles distinguish raster pixels from vector precision; drafts never alter saved settings', () => {
  for (const { id } of styles) {
    const doc = setDetail(styleRecipe('i', 'x', catalogue, id), 2), before = copy(doc)
    expect(detailLevel(doc)).toBe(2)
    const full = compileRecipe(doc), draft = draftRecipe(full)
    expect(draft.nodes[0].params.resolution).toBe(200)
    expect(full.nodes[0].params.resolution).toBeGreaterThan(800)
    expect(doc).toEqual(before)
    if (id !== 'crisp') expect(draft.nodes.at(-1)!.params.detail).toBe(2)
  }
})
test('live scheduler throttles drafts, debounces final work, pauses while dragging and cancels queued runs', () => {
  let now = 0, id = 0
  const timers = new Map<number, { at: number; fn: () => void }>(), calls: string[] = []
  const clock: any = { set: (fn: () => void, ms: number) => { timers.set(++id, { at: now + ms, fn }); return id }, clear: (id: number) => timers.delete(id) }
  const tick = (ms: number) => { const until = now + ms; while (true) { const job = [...timers].sort((a,b) => a[1].at-b[1].at).find(([, t]) => t.at <= until); if (!job) break; now = job[1].at; timers.delete(job[0]); job[1].fn() }; now = until }
  const live = new LivePreview(q => calls.push(q), 650, 180, clock)
  live.change(); tick(2000); expect(calls).toEqual([])
  live.enabled = true; live.begin()
  for (let i = 0; i < 30; i++) { live.change(); tick(30) }
  expect(calls.length).toBe(5); expect(calls.every(q => q === 'draft')).toBe(true)
  tick(1000); expect(calls).not.toContain('full'); live.end(); tick(649); expect(calls).not.toContain('full'); tick(1); expect(calls.at(-1)).toBe('full')
  live.change(); live.stop(); tick(2000); expect(calls.length).toBe(6)
  live.change(); tick(180); expect(calls.at(-1)).toBe('draft'); live.stop(true); tick(2000); expect(calls.length).toBe(7)
})
test('exact setting titles and qualified identities rank first; references are not fake controls', () => {
  const registry = new ParameterRegistry(catalogue)
  expect(registry.search('vector_stencil.width_mm')[0].key).toBe('vector_stencil.width_mm')
  expect(registry.search('crop_left')[0].key).toBe('transform.crop_left')
  expect(registry.search('Smoothing (px)')[0].key).toBe('smooth.radius')
  expect(editable('hardware', 'bolt_d')).toBe(false)
  expect(editable('transform', 'crop_left')).toBe(true)
  expect(registry.settings.length).toBe(217)
})
test('real STL inspection identifies a zero-area facet, invalid size and invalid coordinates', () => {
  const buffer = new ArrayBuffer(134), data = new DataView(buffer); data.setUint32(80, 1, true)
  expect(inspectStl(buffer).degenerate).toBe(1)
  data.setFloat32(108, 1, true); data.setFloat32(124, 1, true)
  expect(inspectStl(buffer).degenerate).toBe(0)
  data.setFloat32(96, NaN, true); expect(() => inspectStl(buffer)).toThrow(/invalid geometry/)
  expect(() => inspectStl(new ArrayBuffer(12))).toThrow(/incomplete/)
})
