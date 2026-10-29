import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120"><rect width="160" height="120" fill="white"/><circle cx="80" cy="60" r="30" fill="none" stroke="black" stroke-width="10"/></svg>')
async function upload(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Choose Image', exact: true })).toBeEnabled()
  await page.setInputFiles('input[aria-label="Choose image file"]', { name: 'Ring artwork.svg', mimeType: 'image/svg+xml', buffer: svg })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
}
async function make(page: Page) {
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: /^Stencil (ready|made)/ })).toBeVisible({ timeout: 90000 })
  await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
}
async function saved(page: Page) {
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save Project', exact: true }).click()
  const download = await event
  return JSON.parse(readFileSync((await download.path())!, 'utf8'))
}
function stl(bytes: Buffer) {
  const count = bytes.readUInt32LE(80); expect(count).toBeGreaterThan(0); expect(bytes.length).toBe(84 + count * 50)
  return count
}
function canonicalTriangles(bytes: Buffer) {
  return Array.from({ length: stl(bytes) }, (_, i) => Array.from({ length: 3 }, (_, vertex) => Array.from({ length: 3 }, (_, axis) => Math.round(bytes.readFloatLE(96 + 50*i + 12*vertex + 4*axis)*10000)).join(',')).sort().join(';')).sort()
}
test('empty workspace, light/dark preference, searchable catalogue, keyboard and responsive layout', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Start with your artwork.' })).toBeVisible()
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await expect(page.locator('body')).not.toContainText(/node editor|connect nodes/i)
  await page.getByRole('button', { name: 'Switch to dark mode' }).click(); await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Switch to light mode' }).click(); await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'All Settings', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Settings categories' }).locator('button')).toHaveCount(12)
  await page.getByRole('searchbox').fill('vector_stencil.bridge_min_angle_deg')
  await expect(page.locator('.setting-reference')).toHaveCount(1)
  await page.locator('.setting-reference summary').click(); await expect(page.getByRole('dialog')).toContainText('spread')
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'All Settings', exact: true })).toBeFocused()
  for (const width of [1280, 800, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.getByRole('button', { name: 'Choose Image', exact: true })).toBeVisible()
  }
})
test('real generation, quick parameters, original assets, STL export and rapid New→Open regression', async ({ page }, info) => {
  await upload(page)
  await expect(page.getByAltText('Original artwork')).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Stencil width', exact: true }).fill('120')
  await page.getByRole('spinbutton', { name: 'Base thickness', exact: true }).fill('3')
  await page.getByRole('spinbutton', { name: 'Bridge width', exact: true }).fill('2')
  await page.getByRole('spinbutton', { name: 'Working detail', exact: true }).fill('400')
  await page.getByRole('switch', { name: 'Automatic threshold' }).uncheck()
  await page.getByRole('slider', { name: 'Threshold', exact: true }).fill('140')
  const doc = await saved(page)
  const params = Object.fromEntries(doc.graph.nodes.map((n: any) => [n.type, n.params])) as any
  expect(params.vector_stencil).toMatchObject({ width_mm: 120, thickness_mm: 3, bridge_mm: 2 })
  expect(params.source.resolution).toBe(400); expect(params.threshold.threshold).toBe(140)
  expect(Buffer.from(Object.values<any>(doc.images)[0].base64, 'base64')).toEqual(svg)
  await make(page)
  await expect(page.locator('.preview-caption')).toContainText('120.0')
  const downloadEvent = page.waitForEvent('download'); await page.getByRole('link', { name: 'Export STL' }).click()
  const d = await downloadEvent, file = info.outputPath('new-workflow.stl'); await d.saveAs(file); const count = stl(readFileSync(file))
  await page.getByRole('tab', { name: '3D', exact: true }).click(); await expect(page.getByRole('img', { name: 'Interactive 3D stencil from generated STL' })).toBeVisible()
  await page.getByRole('spinbutton', { name: 'Stencil width', exact: true }).fill('130')
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText(/Previous result/)).toBeVisible()
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('spinbutton', { name: 'Stencil width', exact: true })).toHaveValue('120')
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByRole('spinbutton', { name: 'Stencil width', exact: true })).toHaveValue('130')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: 'New Project', exact: true }).click()
    await page.setInputFiles('input[aria-label="Open project file"]', { name: 'reopened.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) })
    await expect(page.getByRole('status').filter({ hasText: /^Stencil (ready|made)/ })).toBeVisible({ timeout: 90000 })
    await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'false')
  }
  expect(await saved(page)).toEqual(doc)
  // Replay the browser's project using the original Rust CLI, not a mock.
  const project = info.outputPath('project.json'); writeFileSync(project, JSON.stringify(doc))
  const cli = resolve(`../target/release/stencil${process.platform === 'win32' ? '.exe' : ''}`), native = info.outputPath('native.stl')
  execFileSync(cli, ['--project', project, '-o', native])
  expect(stl(readFileSync(native))).toBe(count)
  expect(canonicalTriangles(readFileSync(native))).toEqual(canonicalTriangles(readFileSync(file)))
  const evidence = resolve('../sandbox/m1'); mkdirSync(evidence, { recursive: true })
  copyFileSync(file, resolve(evidence, 'browser-output.stl')); copyFileSync(native, resolve(evidence, 'native-output.stl')); copyFileSync(project, resolve(evidence, 'browser-saved-project.json'))
  writeFileSync(resolve(evidence, 'engine-equivalence.json'), JSON.stringify({ browser_triangles: count, native_triangles: stl(readFileSync(native)), canonical_triangles_match_at_mm: .0001, embedded_svg_bytes_preserved: true, rapid_identical_new_open_cycles: 3 }, null, 2))
})
test('replace and drop artwork, undo replacement and recover after processing error', async ({ page }) => {
  await upload(page)
  const first = await saved(page)
  const replacement = Buffer.from(svg.toString().replace('r="30"', 'r="20"'))
  await page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), dt = new DataTransfer()
    dt.items.add(new File([bytes], 'Replacement.svg', { type: 'image/svg+xml' }))
    document.querySelector('.studio-app')!.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt }))
  }, replacement.toString('base64'))
  await expect(page.locator('.preview-caption')).toContainText('Replacement.svg')
  const second = await saved(page); expect(Object.keys(second.images)).toHaveLength(2)
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); expect(await saved(page)).toEqual(first)
  await page.getByRole('spinbutton', { name: 'Stencil width', exact: true }).fill('20')
  // Default margin=8 fits; use a preserved advanced value to trigger real engine validation.
  const bad = await saved(page); bad.graph.nodes.find((n: any) => n.type === 'vector_stencil').params.margin_mm = 20
  await page.setInputFiles('input[aria-label="Open project file"]', { name: 'bad-margin.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) })
  await expect(page.getByRole('alert')).toContainText(/margin/i)
  await page.getByRole('spinbutton', { name: 'Stencil width', exact: true }).fill('120'); await make(page)
})
test('legacy advanced and unknown projects save losslessly without any canvas or default recipe', async ({ page }) => {
  await page.goto('/')
  const doc = JSON.parse(readFileSync(new URL('./fixtures/margin-ring.json', import.meta.url), 'utf8'))
  doc.unknown = { x: [1, null, 'future'] }; doc.images.unused = { name: 'unused', base64: 'AQID', opaque: true }
  doc.graph.nodes.push({ id: 'future', data: { type: 'future_processor', params: { nested: ['x'], enabled: false } }, position: { x: 42, y: 9 } })
  doc.graph.edges.push({ id: 'unused', source: doc.graph.nodes[0].id, sourceHandle: 'image', target: 'future', targetHandle: 'image', unknown: true })
  await page.setInputFiles('input[aria-label="Open project file"]', { name: 'advanced.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) })
  await expect(page.getByText('Custom workflow', { exact: true })).toBeVisible()
  expect(await saved(page)).toEqual(doc)
  await expect(page.locator('.react-flow')).toHaveCount(0)
  await expect(page.getByRole('alert')).toContainText(/unknown|unavailable|earlier/i, { timeout: 90000 })
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'true')
})
test('offline local processing, theme accessibility, and no legacy editor in default UI', async ({ page }) => {
  const external: string[] = [], errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/*', route => {
    const url = route.request().url()
    if (/^https?:/.test(url) && new URL(url).hostname !== 'localhost') { external.push(url); return route.abort() }
    return route.continue()
  })
  await upload(page); await make(page)
  await expect(page.locator('.react-flow')).toHaveCount(0)
  for (const theme of ['light', 'dark']) {
    if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: `Switch to ${theme} mode` }).click()
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter(v => ['serious', 'critical'].includes(v.impact ?? ''))).toEqual([])
  }
  expect(external).toEqual([]); expect(errors).toEqual([])
})
