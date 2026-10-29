// Exercise a built local app, real exports and embedded-image project round trips.
// npm ci must have run in web/. Example:
// node scripts/m0/browser-smoke.mjs http://127.0.0.1:5196 sandbox/m0/source-smoke
import { chromium } from '../../web/node_modules/playwright-core/index.mjs'
import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'

const origin = new URL(process.argv[2] || 'http://127.0.0.1:5196').origin
const output = path.resolve(process.argv[3] || 'sandbox/m0/source-smoke')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
const requests = [], blocked = [], failures = [], errors = []
page.on('request', r => requests.push(r.url()))
page.on('requestfailed', r => failures.push({ url: r.url(), error: r.failure() }))
page.on('pageerror', e => errors.push(String(e)))
await page.route('**/*', async route => {
  const url = route.request().url()
  if (/^https?:/.test(url) && new URL(url).origin !== origin) {
    blocked.push(url)
    return route.abort()
  }
  return route.continue()
})
const source = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="white"/><circle cx="30" cy="30" r="18" fill="none" stroke="black" stroke-width="6"/></svg>')
const settled = () => page.waitForFunction(() => {
  const steps = [...document.querySelectorAll('.react-flow__node')]
  return steps.length === 4 && steps.every(n => n.querySelector('[title=done]'))
}, null, { timeout: 90_000 })
const saveLink = async (name, file) => {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('.bench').getByRole('link', { name, exact: true }).click(),
  ])
  await download.saveAs(path.join(output, file))
}
let result = {}
try {
  await page.goto(origin)
  await page.setInputFiles('label.btn input[type=file] >> nth=0', { name: 'ring.svg', mimeType: 'image/svg+xml', buffer: source })
  await settled()
  await page.getByRole('button', { name: 'Perf', exact: true }).click()
  result.performance = await page.locator('.perf').innerText()
  await page.locator('.react-flow__node').filter({ hasText: 'Trace' }).first().dispatchEvent('dblclick')
  await saveLink('Download SVG', 'trace.svg')
  await page.getByRole('button', { name: 'Close ✕', exact: true }).click()
  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save project', exact: true }).click()
  const projectPath = path.join(output, 'project.json')
  await (await projectDownload).saveAs(projectPath)
  const project = JSON.parse(await fs.readFile(projectPath, 'utf8'))
  assert.equal(project.version, 2)
  assert.equal(project.graph.nodes.length, 4)
  assert.equal(Object.keys(project.images).length, 1)
  assert.deepEqual(Buffer.from(Object.values(project.images)[0].base64, 'base64'), source)
  page.on('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'New', exact: true }).click()
  await page.setInputFiles('input[type=file][accept*=json]', projectPath)
  // Explicit generation also exercises the existing Rerun action after opening a saved project.
  await page.getByRole('button', { name: 'Rerun', exact: true }).click()
  await settled()
  result.projectRoundTrip = { version: project.version, steps: 4, images: 1, originalBytesPreserved: true, explicitRerun: true }
  await page.locator('.react-flow__node').filter({ hasText: 'Vector stencil' }).first().dispatchEvent('dblclick')
  await page.getByText(/Size:.*200\.0/).first().waitFor({ timeout: 30_000 })
  await saveLink('Download STL', 'stencil.stl')
  await page.screenshot({ path: path.join(output, 'preview.png'), fullPage: true })
  result.success = true
  assert.equal(blocked.length, 0, 'app attempted an external request')
  assert.equal(errors.length, 0, 'browser page/worker error')
} catch (error) {
  result = { ...result, success: false, error: String(error) }
  throw error
} finally {
  await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify({ ...result, requests, blocked, failures, errors, body: await page.locator('body').innerText() }, null, 2))
  console.log(JSON.stringify(result))
  await browser.close()
}
