// Exercise the actual production worker in isolated and ordinary browser contexts.
// Usage from repository root: node scripts/m2/verify_modes.mjs [local studio URL]
import { chromium } from '../../web/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const baseURL = process.argv[2] ?? 'http://127.0.0.1:5200/'
const manifest = JSON.parse(readFileSync('docs/m2/production-manifest.json', 'utf8'))
const worker = manifest.files.find(f => /engine\.worker.*\.js$/.test(f.path)).path
const recipes = ['standard', 'smooth', 'crisp'].map(style => ({ style, doc: JSON.parse(readFileSync(`sandbox/m2/corpus/simple-logo-${style}.json`, 'utf8')) }))
const image = readFileSync('web/e2e/corpus/simple-logo.svg').toString('base64')
const browser = await chromium.launch({ headless: true })
mkdirSync('sandbox/m2/modes', { recursive: true })
const results = []
for (const isolated of [true, false]) {
  const page = await browser.newPage()
  if (!isolated) await page.route(baseURL, async route => {
    const response = await route.fetch(), headers = response.headers()
    delete headers['cross-origin-opener-policy']; delete headers['cross-origin-embedder-policy']
    await route.fulfill({ response, headers })
  })
  await page.goto(baseURL)
  const outputs = await page.evaluate(async ({ worker, recipes, image }) => {
    const engine = new Worker(new URL(worker, location.href), { type: 'module' })
    let seq = 0
    const pending = new Map()
    engine.onmessage = e => {
      const p = pending.get(e.data.id); if (!p) return
      if (e.data.step) { p.steps.push(e.data.step); return }
      clearTimeout(p.timeout); pending.delete(e.data.id)
      e.data.error ? p.reject(Error(e.data.error)) : p.resolve({ response: e.data.ok, steps: p.steps })
    }
    const request = message => new Promise((resolve, reject) => {
      const id = ++seq, timeout = setTimeout(() => reject(Error('Production worker timed out')), 90000)
      pending.set(id, { resolve, reject, steps: [], timeout }); engine.postMessage({ id, ...message })
    })
    const { response: mode } = await request({ op: 'threads' })
    const bytes = Uint8Array.from(atob(image), c => c.charCodeAt(0))
    const { response: asset } = await request({ op: 'image', bytes: bytes.buffer })
    const cases = []
    for (const { style, doc } of recipes) {
      const graph = doc.graph
      for (const n of graph.nodes) if (n.type === 'source') n.params.image_id = asset.id
      const started = performance.now()
      const result = await request({ op: 'run', graph: JSON.stringify(graph), targets: '' })
      const failed = result.steps.find(s => s.state.state === 'error'); if (failed) throw Error(JSON.stringify(failed))
      const artifact = result.steps.flatMap(s => s.artifacts ?? []).find(a => a.info?.kind === 'solid')
      if (!artifact) throw Error('No actual stencil artifact returned')
      let data = ''; for (const b of artifact.bytes) data += String.fromCharCode(b)
      cases.push({ style, milliseconds: performance.now() - started, base64: btoa(data), stats: artifact.info.stats })
    }
    engine.terminate(); return { mode, isolated: crossOriginIsolated, cases }
  }, { worker, recipes, image })
  if (outputs.isolated !== isolated || isolated && outputs.mode.n <= 1 || !isolated && outputs.mode.n !== 1) throw Error(`Wrong production mode: ${JSON.stringify(outputs.mode)}`)
  for (const row of outputs.cases) {
    const path = `sandbox/m2/modes/${isolated ? 'mt' : 'st'}-${row.style}.stl`
    writeFileSync(path, Buffer.from(row.base64, 'base64')); delete row.base64
    const check = spawnSync('python', ['scripts/m2/inspect_mesh.py', path], { encoding: 'utf8' })
    if (check.status !== 0) throw Error(check.stderr)
    row.mesh = JSON.parse(check.stdout)
    if (!row.mesh.closed_oriented_mesh) throw Error(`Invalid mesh: ${path}`)
  }
  results.push(outputs); await page.close()
}
await browser.close()
writeFileSync('docs/m2/production-modes.json', JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results.map(r => ({ mode: r.mode, cases: r.cases.map(c => ({ style: c.style, triangles: c.mesh.triangles, closed: c.mesh.closed_oriented_mesh })) }))))
