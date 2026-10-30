import { expect, test, type Page } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
const corpus = (name: string) => readFileSync(new URL(`./corpus/${name}`, import.meta.url))
test.setTimeout(180_000)
async function upload(page: Page, name = 'simple-logo.svg') {
  await page.goto('/'); await expect(page.getByRole('button', { name: 'Choose Image', exact: true })).toBeEnabled()
  await page.setInputFiles('[aria-label="Choose image file"]', { name, mimeType: name.endsWith('svg') ? 'image/svg+xml' : 'image/png', buffer: corpus(name) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
}
async function ready(page: Page) {
  await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
  await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
}
async function make(page: Page) { await page.getByRole('button', { name: 'Make Stencil', exact: true }).click(); await ready(page) }
async function save(page: Page) {
  const wait = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save Project', exact: true }).click()
  return JSON.parse(readFileSync((await (await wait).path())!, 'utf8'))
}
async function exact(page: Page, key: string) {
  await page.getByRole('button', { name: 'All Settings', exact: true }).click(); await page.getByRole('searchbox').fill(key)
  await page.locator('.setting-reference summary').click()
}

test('all three styles produce different valid geometry; style adjustments, bytes, undo and reopen survive', async ({ page }, info) => {
  await upload(page); await make(page)
  const hashes: string[] = [], evidence: any[] = []
  mkdirSync('../sandbox/m6/replay/m2/browser', { recursive: true })
  mkdirSync('../docs/m6/replay/m5/replay/m4/m2-replay', { recursive: true })
  for (const style of ['standard', 'smooth', 'crisp']) {
    if (style !== 'standard') { await page.getByRole('combobox', { name: 'Stencil style', exact: true }).selectOption(style); await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'true'); await ready(page) }
    const wait = page.waitForEvent('download'); await page.getByRole('link', { name: 'Export STL', exact: true }).click()
    const download = await wait, file = resolve(`../sandbox/m6/replay/m2/browser/${style}.stl`); await download.saveAs(file)
    expect(download.suggestedFilename()).toBe(`simple-logo-${style}.stl`)
    const mesh = JSON.parse(execFileSync('python', ['../scripts/m2/inspect_mesh.py', file], { encoding: 'utf8' }))
    expect(mesh.closed_oriented_mesh).toBe(true); expect(mesh.degenerate_faces).toBe(0); expect(mesh.components).toBe(1)
    // Hash sorted, undirected triangle coordinates, excluding STL headers/normals/order.
    const bytes = readFileSync(file), count = bytes.readUInt32LE(80)
    const triangles = Array.from({ length: count }, (_, i) => Array.from({ length: 3 }, (_, v) => Array.from({ length: 3 }, (_, a) => bytes.readFloatLE(96 + 50*i + 12*v + 4*a).toFixed(4)).join(',')).sort().join(';')).sort()
    hashes.push(createHash('sha256').update(triangles.join('\n')).digest('hex')); evidence.push({ style, mesh })
  }
  expect(new Set(hashes).size).toBe(3)
  await page.getByRole('spinbutton', { name: 'Bridge width', exact: true }).fill('2.4'); await ready(page)
  const crisp = await save(page)
  await page.getByRole('combobox', { name: 'Stencil style', exact: true }).selectOption('smooth'); await ready(page)
  await page.getByRole('button', { name: 'Undo', exact: true }).click(); await expect(page.getByRole('combobox', { name: 'Stencil style', exact: true })).toHaveValue('crisp')
  expect(await save(page)).toEqual(crisp)
  await page.getByRole('button', { name: 'Redo', exact: true }).click(); await expect(page.getByRole('combobox', { name: 'Stencil style', exact: true })).toHaveValue('smooth')
  await page.getByRole('button', { name: 'New Project', exact: true }).click()
  await page.setInputFiles('[aria-label="Open project file"]', { name: 'Crisp.stencil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(crisp)) }); await ready(page)
  expect(await save(page)).toEqual(crisp)
  expect(Buffer.from(Object.values<any>(crisp.images)[0].base64, 'base64')).toEqual(corpus('simple-logo.svg'))
  writeFileSync('../docs/m6/replay/m5/replay/m4/m2-replay/browser-meshes.json', JSON.stringify({ hashes, evidence }, null, 2))
  await info.attach('independent meshes', { body: JSON.stringify(evidence), contentType: 'application/json' })
})

test('live edits show draft, retain the last preview and finish full quality without Make; cancel stays cancelled', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as any; w.m2Runs = []; w.m2FrameGaps = []
    const post = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (this: Worker, message: any, ...rest: any[]) {
      if (message.op === 'run') w.m2Runs.push({ at: performance.now(), resolution: JSON.parse(message.graph).nodes.find((n: any) => n.type === 'source')?.params.resolution })
      const sent = (post as any).call(this, message, ...rest)
      if (message.op === 'run') w.m2CancelHook?.()
      return sent
    }
    let last = performance.now(); const frame = (time: number) => { w.m2FrameGaps.push(time - last); last = time; requestAnimationFrame(frame) }; requestAnimationFrame(frame)
  })
  await upload(page); await make(page)
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await expect(page.getByLabel('Zoom level')).toHaveText('125%')
  const slider = page.getByRole('slider', { name: 'Detail', exact: true })
  await slider.dispatchEvent('pointerdown', { pointerId: 1 })
  await slider.fill('0')
  await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await expect(page.getByText(/Draft preview · Export/)).toBeVisible({ timeout: 90000 })
  for (let i = 0; i < 18; i++) { await slider.fill(String(i % 3)); await page.waitForTimeout(25) }
  await slider.fill('1')
  await slider.dispatchEvent('pointerup', { pointerId: 1 }); await ready(page)
  await expect(page.getByLabel('Zoom level')).toHaveText('125%')
  const metrics = await page.evaluate(() => ({ runs: (window as any).m2Runs, max_frame_gap_ms: Math.max(...(window as any).m2FrameGaps) }))
  // Initial generation plus one settled full run; no heavy run on each slider input.
  expect(metrics.runs.filter((r: any) => r.resolution > 200)).toHaveLength(2)
  expect(metrics.runs.filter((r: any) => r.resolution === 200).length).toBeGreaterThan(0)
  mkdirSync('../docs/m6/replay/m5/replay/m4/m2-replay', { recursive: true }); writeFileSync('../docs/m6/replay/m5/replay/m4/m2-replay/live-performance.json', JSON.stringify(metrics, null, 2))
  // A numeric field settles while still focused.
  await page.getByRole('spinbutton', { name: 'Stencil width', exact: true }).fill('160'); await ready(page)
  await expect(page.locator('.preview-caption')).toContainText('160.0')
  await page.getByRole('switch', { name: 'Automatic threshold' }).uncheck()
  await ready(page)
  // Cancel an actually submitted run in the same browser task. Waiting for
  // Playwright's two-frame click stability lets a fast draft finish first.
  await page.evaluate(() => {
    const w = window as any
    w.m2Cancellation = { messagePosted: false, buttonVisibleAtClick: false, buttonClicked: false }
    const cancel = () => {
      if (!w.m2Cancellation.messagePosted) return
      const button = [...document.querySelectorAll<HTMLButtonElement>('.readiness button')].find(b => b.textContent === 'Cancel')
      const rect = button?.getBoundingClientRect()
      if (!button || button.disabled || !rect?.width || !rect.height) return
      observer.disconnect(); w.m2CancelHook = undefined
      w.m2Cancellation.buttonVisibleAtClick = true
      button.click(); w.m2Cancellation.buttonClicked = true
    }
    const observer = new MutationObserver(cancel)
    observer.observe(document.body, { childList: true, subtree: true })
    w.m2CancelHook = () => { w.m2Cancellation.messagePosted = true; cancel() }
  })
  await page.getByRole('slider', { name: 'Threshold', exact: true }).dispatchEvent('pointerdown', { pointerId: 2 })
  await page.getByRole('slider', { name: 'Threshold', exact: true }).fill('141')
  await expect.poll(() => page.evaluate(() => (window as any).m2Cancellation), { timeout: 30000 }).toEqual({ messagePosted: true, buttonVisibleAtClick: true, buttonClicked: true })
  await expect(page.getByRole('status').filter({ hasText: /Processing cancelled/ })).toBeVisible()
  await page.waitForTimeout(1000); await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'true')
  await make(page)
})

test('prepared comparison is aligned after crop/rotate/flip; raw original and geometry dimensions remain truthful', async ({ page }) => {
  await upload(page); await page.getByText('Artwork tools', { exact: true }).click()
  await page.getByRole('button', { name: 'Rotate 90°', exact: true }).click()
  await page.getByRole('button', { name: 'Flip horizontally', exact: true }).click()
  await exact(page, 'transform.crop_left'); await page.getByRole('spinbutton', { name: 'Crop left (%) · framing', exact: true }).fill('10')
  await page.getByRole('button', { name: 'Close settings', exact: true }).click(); await make(page)
  const doc = await save(page), transform = doc.graph.nodes.find((n: any) => n.type === 'transform')
  expect(transform.params).toMatchObject({ crop_left: 10, turn: '90', flip_h: true })
  expect(Buffer.from(Object.values<any>(doc.images)[0].base64, 'base64')).toEqual(corpus('simple-logo.svg'))
  await page.getByRole('tab', { name: 'Compare', exact: true }).click(); await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
  await expect(page.getByRole('img', { name: 'Aligned prepared artwork and generated STL comparison' })).toBeVisible()
  const split = page.getByRole('slider', { name: 'Comparison split', exact: true }); await split.fill('25'); await expect(split).toHaveValue('25')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click(); await page.getByRole('button', { name: 'Fit', exact: true }).click(); await expect(page.getByLabel('Zoom level')).toHaveText('100%')
  // Crop happens before rotation: 650×520 -> 585×520 -> 520×585.
  // Vector art width=184; height=184×585/520+16=223 mm.
  await expect(page.locator('.preview-caption')).toContainText('200.0 × 223.0')
  mkdirSync('../docs/m6/replay/m5/replay/m4/screenshots/m2-replay', { recursive: true })
  await page.locator('.preview-surface').screenshot({ path: '../docs/m6/replay/m5/replay/m4/screenshots/m2-replay/08-crop-comparison.png' })
  await page.getByRole('tab', { name: 'Original', exact: true }).click(); await expect(page.getByAltText('Original artwork')).toBeVisible()
})

test('manual threshold is remembered, cleanup/margin edit per instance and bad crop is rejected without data loss', async ({ page }) => {
  await upload(page)
  await page.getByRole('switch', { name: 'Automatic threshold' }).uncheck(); await page.getByRole('slider', { name: 'Threshold', exact: true }).fill('173')
  await page.getByRole('switch', { name: 'Automatic threshold' }).check(); await page.getByRole('switch', { name: 'Automatic threshold' }).uncheck(); await expect(page.getByRole('slider', { name: 'Threshold', exact: true })).toHaveValue('173')
  await exact(page, 'remove_islands.delete_specks'); await page.getByRole('checkbox', { name: 'Delete small paint specks · cleanup', exact: true }).check()
  await page.getByRole('searchbox').fill('vector_stencil.margin_mm'); await page.locator('.setting-reference summary').click(); await page.getByRole('spinbutton', { name: 'Margin (mm) · plate', exact: true }).fill('12')
  await page.getByRole('searchbox').fill('transform.crop_left'); await page.locator('.setting-reference summary').click(); await page.getByRole('spinbutton', { name: 'Crop left (%) · framing', exact: true }).fill('60')
  await page.getByRole('searchbox').fill('transform.crop_right'); await page.locator('.setting-reference summary').click(); await page.getByRole('spinbutton', { name: 'Crop right (%) · framing', exact: true }).fill('60')
  await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Keep at least 5%')
  const doc = await save(page)
  expect(doc.graph.nodes.find((n: any) => n.type === 'transform').params).toMatchObject({ crop_left: 60, crop_right: 0 })
  expect(doc.graph.nodes.find((n: any) => n.type === 'remove_islands').params.delete_specks).toBe(true)
  expect(doc.graph.nodes.find((n: any) => n.type === 'vector_stencil').params.margin_mm).toBe(12)
})

test('friendly upload errors preserve the current image and traced SVG is honestly labelled', async ({ page }) => {
  await upload(page); const before = await save(page)
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') })
  await expect(page.getByRole('alert')).toContainText('could not be read'); expect(await save(page)).toEqual(before)
  await make(page)
  const link = page.getByRole('link', { name: /Save traced outlines SVG/ }); await expect(link).toContainText('before bridge corrections')
  const wait = page.waitForEvent('download'); await link.click(); const svg = readFileSync((await (await wait).path())!, 'utf8'); expect(svg).toContain('<svg'); expect(svg).toContain('<path')
})

test('the previously defective hardware fit strip exports only after the M5 repair and preserves its custom project', async ({ page }) => {
  await page.goto('/')
  const project = { version: 2, graph: { nodes: [{ id: 'fit', type: 'hardware', params: { plate: false, fit_test: true } }], edges: [] }, future: { keep: true } }
  await page.setInputFiles('[aria-label="Open project file"]', { name: 'hardware.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(project)) })
  await expect(page.getByRole('link', { name: 'Export ZIP', exact: true })).toHaveAttribute('aria-disabled', 'false',{timeout:90000})
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export ZIP',exact:true}).click()
  mkdirSync('../sandbox/m6/replay/m5',{recursive:true});const path=resolve('../sandbox/m6/replay/m5/m2-repaired-hardware.zip');await(await download).saveAs(path)
  const check=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8'}));expect(check.entries.filter((e:any)=>/\.stl$/i.test(e.name)).every((e:any)=>e.closed_oriented_mesh)).toBe(true)
  expect(await save(page)).toEqual(project)
})

test('raster cleanup is opt-in, visibly changes fine lines, and bypass restores the original geometry', async ({ page }) => {
  await upload(page, 'thin-lines.svg')
  await page.getByRole('combobox', { name: 'Stencil style', exact: true }).selectOption('crisp')
  await page.getByText('Artwork tools', { exact: true }).click()
  const toggle = page.getByRole('checkbox', { name: 'Pixel cleanup', exact: true }); await expect(toggle).not.toBeChecked()
  await make(page)
  const base = await save(page); expect(base.graph.nodes.map((n: any) => n.type)).not.toContain('morphology')
  const before = await page.locator('.readiness p').filter({ hasText: /triangles/ }).innerText()
  await toggle.check(); await ready(page); expect(await page.locator('.readiness p').filter({ hasText: /triangles/ }).innerText()).not.toBe(before)
  let doc = await save(page); expect(doc.graph.nodes.find((n: any) => n.type === 'morphology').params).toMatchObject({ iterations: 1, radius: 1 })
  await toggle.uncheck(); await ready(page); expect(await page.locator('.readiness p').filter({ hasText: /triangles/ }).innerText()).toBe(before)
  doc = await save(page); expect(doc.graph).toEqual(base.graph)
  await toggle.check(); await ready(page); await page.reload(); await ready(page); await expect(page.getByRole('combobox', { name: 'Stencil style', exact: true })).toHaveValue('crisp')
  expect((await save(page)).graph.nodes.find((n: any) => n.type === 'morphology').params.radius).toBe(1)
})
