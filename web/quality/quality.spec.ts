/** A measured quality audit, separate from the browser regression suite. Engine errors
 * are recorded as unsuccessful cases, never counted as valid stencils. */
import { expect, test } from '@playwright/test'
import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { styleRecipe, styles } from '../src/studio/recipes'
import type { NodeType } from '../src/api'
const root = resolve('..'), out = resolve(root, 'sandbox/m2/corpus')
const catalogue: NodeType[] = JSON.parse(readFileSync(resolve(root, 'docs/audit/runtime-catalogue.json'), 'utf8'))
const manifest = JSON.parse(readFileSync(resolve(root, 'web/e2e/corpus/manifest.json'), 'utf8'))

test('measure all styles on every representative input and independently validate every produced STL', () => {
  mkdirSync(out, { recursive: true }); mkdirSync(resolve(root, 'docs/m2'), { recursive: true })
  const results: any[] = []
  for (const source of manifest) for (const style of styles) {
    const stem = source.file.replace(/\.[^.]+$/, ''), name = `${stem}-${style.id}`
    const image = readFileSync(resolve(root, 'web/e2e/corpus', source.file))
    const doc = styleRecipe('corpus', source.file, catalogue, style.id)
    doc.raw.images = { corpus: { name: source.file, base64: image.toString('base64') } }
    const project = resolve(out, `${name}.json`), file = resolve(out, `${name}.stl`), report = resolve(out, `${name}-engine.json`)
    writeFileSync(project, JSON.stringify(doc.raw, null, 2))
    const start = performance.now()
    const native = spawnSync(resolve(root, `target/release/stencil${process.platform === 'win32' ? '.exe' : ''}`), ['--project', project, '-o', file, '--report-file', report], { encoding: 'utf8', timeout: 120_000, maxBuffer: 4 * 1024 * 1024 })
    const ms = Math.round(performance.now() - start)
    const row: any = { input: source.file, style: style.id, milliseconds: ms, status: native.status === 0 ? 'generated' : 'engine error', exit_code: native.status, error: native.error?.message, log: (native.stderr + native.stdout).trim().replaceAll(root, '<workspace>') }
    if (native.status === 0) {
      const check = spawnSync('python', [resolve(root, 'scripts/m2/inspect_mesh.py'), file], { encoding: 'utf8', timeout: 90_000 })
      if (check.status !== 0) throw new Error(check.stderr || check.stdout)
      row.mesh = JSON.parse(check.stdout)
      try { row.engine = JSON.parse(readFileSync(report, 'utf8')) } catch {}
      row.project = `sandbox/m2/corpus/${name}.json`; row.output = `sandbox/m2/corpus/${name}.stl`
      row.status = row.mesh.closed_oriented_mesh ? 'valid mesh' : 'INVALID MESH — export guard required'
    }
    results.push(row)
    writeFileSync(resolve(root, 'docs/m2/corpus-results.json'), JSON.stringify({ source_m1: '61a98108b2cab1d248585ef9c465abcde9fd54e6', recipe: 'Balanced profile, engine defaults for physical dimensions; actual styleRecipe()', cases: results }, null, 2))
    console.log(`${name}: ${row.status} · ${ms} ms`)
  }
  expect(results).toHaveLength(manifest.length * 3)
  // Engine refusals are visible in the audit. An emitted invalid STL fails this check.
  expect(results.filter(r => r.status.startsWith('INVALID'))).toEqual([])
})
