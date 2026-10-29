import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { compileRecipe, copy, editParameter, openDocument, ProjectCommands, quickRecipe, saveDocument, standardRecipe } from '../src/studio/project'
import { ParameterRegistry } from '../src/studio/registry'
import { RunController, type RunPort } from '../src/studio/runController'
import type { NodeType, NodeStep } from '../src/api'
const catalogue: NodeType[] = JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json', import.meta.url), 'utf8'))

test('runtime registry accounts for all processing types and searchable parameter keys', () => {
  const registry = new ParameterRegistry(catalogue)
  expect(registry.types.size).toBe(24); expect(registry.settings.length).toBe(217)
  for (const s of registry.settings) expect(registry.search(s.key).map(r => r.key)).toContain(s.key)
  expect(registry.search('Bridge width').length).toBeGreaterThan(1)
  expect(() => registry.validate('vector_stencil', 'width_mm', NaN)).toThrow()
  expect(() => registry.validate('source', 'resolution', 25.5)).toThrow()
})

test('recipe compilation matches the original vector recipe, defaults and dependencies', () => {
  const doc = standardRecipe('original-id', 'ring.svg', catalogue)
  const graph = compileRecipe(doc)
  expect(graph.nodes.map(n => n.type)).toEqual(['source', 'threshold', 'trace', 'vector_stencil'])
  expect(graph.edges).toEqual([
    { from: ['artwork', 'image'], to: ['paint', 'image'] },
    { from: ['paint', 'mask'], to: ['outlines', 'mask'] },
    { from: ['outlines', 'shapes'], to: ['plate', 'shapes'] },
  ])
  for (const n of graph.nodes) expect(n.params).toEqual({ ...new ParameterRegistry(catalogue).defaults(n.type), ...(n.type === 'source' ? { image_id: 'original-id' } : {}) })
  expect(quickRecipe(doc)?.vector).toBe(true)
})

test('unknown data, embedded and unused images, branches, ids, positions and connections survive edits and round trips', () => {
  const raw = JSON.parse(readFileSync(new URL('./fixtures/margin-ring.json', import.meta.url), 'utf8'))
  raw.futureEnvelope = { arrays: [null, false, { a: 'unrecognized' }] }
  raw.graph.future = [1, 2, 3]
  raw.images.unused = { name: 'unused.bin', base64: 'AQID', future: [false] }
  raw.graph.nodes[0].futureProperty = { nested: 42 }
  raw.graph.nodes[0].data.params.futureParameter = { complex: ['keep'] }
  raw.graph.nodes.push({ id: 'unknown', position: { x: -123, y: 8 }, type: 'custom', data: { type: 'future_operation', params: { x: { y: true } } } })
  raw.graph.edges.push({ id: 'unused-branch', source: raw.graph.nodes[0].id, sourceHandle: 'image', target: 'unknown', targetHandle: 'any', future: 'keep' })
  const doc = openDocument(raw)
  expect(JSON.parse(saveDocument(doc))).toEqual(raw)
  const before = copy(doc.raw)
  const id = raw.graph.nodes[0].id
  const edited = editParameter(doc, id, 'resolution', 500)
  const expected = copy(before); expected.graph.nodes[0].data.params.resolution = 500
  expect(edited.raw).toEqual(expected); expect(doc.raw).toEqual(before)
  expect(JSON.parse(saveDocument(openDocument(JSON.parse(saveDocument(edited)))))).toEqual(expected)
  expect(quickRecipe(doc)).toBeNull()
})

test('native graph imports, migration aliases and image remapping only affect the execution copy', () => {
  const raw = { version: 999, images: { ancient: { name: 'x', base64: 'AQID' } }, graph: { nodes: [
    { id: 'src', type: 'source', params: { image_id: 'ancient', extra: { a: 1 } }, extra: true },
    { id: 'old-name', type: 'complexity', params: { smoothing: .4 } },
  ], edges: [] } }
  const doc = openDocument(raw), graph = compileRecipe(doc, new Map([['ancient', 'runtime-id']]))
  expect(graph.nodes[0].params.image_id).toBe('runtime-id'); expect(graph.nodes[1].type).toBe('remesh')
  expect(doc.raw).toEqual(raw)
})

test('commands support atomic source replacement, undo and redo without rewriting unknown fields', () => {
  const doc = standardRecipe('a', 'a.png', catalogue), commands = new ProjectCommands(doc)
  commands.apply('Width', d => editParameter(d, 'plate', 'width_mm', 120))
  commands.apply('Source', d => { const n = editParameter(d, 'artwork', 'image_id', 'b'); n.raw.images.b = { base64: 'AA==', name: 'b.png' }; return n })
  const final = copy(commands.current)
  expect(commands.undo()).toBe(true); expect(commands.undo()).toBe(true); expect(commands.current).toEqual(doc)
  commands.redo(); commands.redo(); expect(commands.current).toEqual(final)
  commands.reset(doc); expect(commands.past).toHaveLength(0)
})

test('registry identifies every instance and retains conditional metadata', () => {
  const registry = new ParameterRegistry(catalogue), s = registry.search('vector_stencil.bridge_min_angle_deg')[0]
  expect(s.dependency).toContain('spread')
  expect(registry.availability(s, { bridge_spacing: 'closest' }).active).toBe(false)
  expect(registry.availability(s, { bridge_spacing: 'spread' }).active).toBe(true)
  const width = registry.search('vector_stencil.width_mm')[0]
  expect(registry.availability(width, {}, { hasLayout: true }).active).toBe(false)
  const angle = registry.search('morphology.angle')[0]
  expect(registry.availability(angle, { op: 'erode', kernel: 'disc' }).active).toBe(false)
  expect(registry.availability(angle, { op: 'erode', kernel: 'line' }).active).toBe(true)
  expect(registry.instances(s, [{ id: 'red', type: 'vector_stencil', params: {}, title: 'Red' }, { id: 'blue', type: 'vector_stencil', params: {}, title: 'Blue' }]).map(o => o.id)).toEqual(['red', 'blue'])
})

const graph = { nodes: [], edges: [] }
const deferred = <T,>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
function port() {
  const work: { done: ReturnType<typeof deferred<{ status: string }>>; step: (s: NodeStep) => void }[] = []
  let cancels = 0
  const engine: RunPort = { cancel() { cancels++ }, run(_g, step) { const done = deferred<{ status: string }>(); work.push({ done, step }); return done.promise } }
  return { engine, work, get cancels() { return cancels } }
}
test('New then Open identical saved processing always creates a fresh completed generation', async () => {
  const p = port(), c = new RunController<string>(p.engine, () => {})
  c.invalidate('same', true)
  const a = c.execute('same', async () => graph, async () => 'first'); await Promise.resolve(); p.work[0].done.resolve({ status: 'done' }); await a
  expect(c.exportable).toBe(true)
  c.invalidate('', true); c.invalidate('same', true)
  const b = c.execute('same', async () => graph, async () => 'second'); await Promise.resolve(); p.work[1].done.resolve({ status: 'done' }); await b
  expect(c.state.output?.value).toBe('second'); expect(c.exportable).toBe(true)
})
test('edits, cancellation and superseded work cannot export stale output or overwrite a newer generation', async () => {
  const p = port(), disposed: string[] = [], c = new RunController<string>(p.engine, () => {}, v => disposed.push(v))
  const a = c.execute('one', async () => graph, async () => 'old'); await Promise.resolve()
  c.invalidate('two')
  const b = c.execute('two', async () => graph, async () => 'new'); await Promise.resolve()
  p.work[1].done.resolve({ status: 'done' }); await b
  p.work[0].done.resolve({ status: 'done' }); await a
  expect(c.state.output?.value).toBe('new'); expect(c.exportable).toBe(true)
  c.invalidate('three'); expect(c.exportable).toBe(false); expect(c.state.output?.value).toBe('new')
  c.cancel(); expect(c.exportable).toBe(false); expect(c.state.status).toBe('cancelled')
  c.invalidate('', true); expect(disposed).toEqual(['new'])
})
test('draft artifacts and failed runs are never full-quality exportable', async () => {
  const p = port(), c = new RunController<string>(p.engine, () => {})
  const a = c.execute('same', async () => graph, async () => 'draft', 'draft'); await Promise.resolve(); p.work[0].done.resolve({ status: 'done' }); await a
  expect(c.state.output?.quality).toBe('draft'); expect(c.exportable).toBe(false)
  await c.execute('same', async () => { throw new Error('bad source') }, async () => 'bad')
  expect(c.state.status).toBe('error'); expect(c.state.error).toBe('bad source'); expect(c.exportable).toBe(false)
})
test('late artifact capture is disposed after cancel and recoverable step failures block export', async () => {
  const p = port(), capture = deferred<string>(), disposed: string[] = [], c = new RunController<string>(p.engine, () => {}, v => disposed.push(v))
  const a = c.execute('a', async () => graph, () => capture.promise); await Promise.resolve(); p.work[0].done.resolve({ status: 'done' }); await Promise.resolve(); await Promise.resolve()
  c.cancel(); capture.resolve('late'); await a; expect(disposed).toEqual(['late'])
  const b = c.execute('a', async () => graph, async () => 'bad'); await Promise.resolve()
  p.work[1].step({ node: 'p', state: { state: 'error', error: 'Margin too large' }, n: 1, total: 1, log: [] })
  p.work[1].done.resolve({ status: 'done' }); await b
  expect(c.state.status).toBe('error'); expect(c.state.error).toBe('Margin too large'); expect(c.exportable).toBe(false)
})
