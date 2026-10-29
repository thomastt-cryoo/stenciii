import { expect, test } from '@playwright/test'
import type { NodeStep } from '../src/api'
import { readFileSync } from 'node:fs'
const source = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="white"/><circle cx="40" cy="40" r="20" fill="none" stroke="black" stroke-width="8"/></svg>'

test('customer workflow also generates without cross-origin isolation or threaded WASM', async ({ page }) => {
  const requests: string[] = []
  page.on('request', r => requests.push(r.url()))
  await page.route('http://localhost:5199/', async route => {
    const response = await route.fetch(), headers = response.headers()
    delete headers['cross-origin-opener-policy']; delete headers['cross-origin-embedder-policy']
    await route.fulfill({ response, headers })
  })
  await page.goto('/')
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false)
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'single-thread.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(source) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
  expect(requests.filter(u => u.includes('/pkg-mt/'))).toEqual([])
})

test('worker restart restores original images and the cache can recompute unchanged recipes', async ({ page }) => {
  await page.goto('/regression-api.html')
  await page.waitForFunction(() => !!window.regressionApi)
  const result = await page.evaluate(async source => {
    const api = window.regressionApi
    const file = new File([source], 'restart.svg', { type: 'image/svg+xml' })
    const img = await api.upload(file)
    const graph = { nodes: [ { id: 'a', type: 'source', params: { image_id: img.id, resolution: 200 } }, { id: 'b', type: 'threshold', params: {} }, { id: 'c', type: 'trace', params: {} }, { id: 'd', type: 'vector_stencil', params: {} } ], edges: [{ from: ['a', 'image'] as [string,string], to: ['b', 'image'] as [string,string] }, { from: ['b', 'mask'] as [string,string], to: ['c', 'mask'] as [string,string] }, { from: ['c', 'shapes'] as [string,string], to: ['d', 'shapes'] as [string,string] }] }
    let first: NodeStep | undefined, second: NodeStep | undefined
    await api.run(graph, undefined, s => { if (s.node === 'd' && s.state.state === 'done') first = s })
    const before = api.peekInfo(first!.state.key!, 'solid')
    await api.restart()
    await api.run(graph, undefined, s => { if (s.node === 'd' && s.state.state === 'done') second = s })
    return { before, after: api.peekInfo(second!.state.key!, 'solid'), id: img.id }
  }, source)
  expect(result.after.stats).toEqual(result.before.stats)
  expect(result.after.stats.islands_remaining).toBe(0)
})

test('cancelling real work and immediately making again preserves project settings and source', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'cancel.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(source) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Processing cancelled' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
  await page.getByRole('tab', { name: 'Original', exact: true }).click()
  await expect(page.getByAltText('Original artwork')).toBeVisible()
})

test('autosaved embedded artwork reopens and recalculates after a page reload', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'reload.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(source) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
  await page.getByRole('spinbutton', { name: 'Bridge width', exact: true }).fill('2.4')
  await page.reload()
  await expect(page.getByRole('spinbutton', { name: 'Bridge width', exact: true })).toHaveValue('2.4')
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
})

test('invalid or unsupported project input can be saved safely and engine errors do not destroy it', async ({ page }) => {
  await page.goto('/')
  const doc = { graph: { nodes: [{ id: 'unknown', type: 'future-step', params: { a: 3 }, opaque: ['keep'] }], edges: [{ nonsense: { keep: true } }] }, future: { version: 50 } }
  await page.setInputFiles('[aria-label="Open project file"]', { name: 'future.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(doc)) })
  await expect(page.getByRole('alert')).toBeVisible()
  const event = page.waitForEvent('download'); await page.getByRole('button', { name: 'Save Project', exact: true }).click()
  const d = await event; expect(JSON.parse(readFileSync((await d.path())!, 'utf8'))).toEqual(doc)
})

for (const format of ['png', 'jpg', 'bmp']) test(`${format.toUpperCase()} artwork imports and generates an actual STL`, async ({ page }) => {
  await page.goto('/')
  const pixels = await page.evaluate(format => {
    const c = document.createElement('canvas'); c.width = c.height = 80
    const ctx = c.getContext('2d')!; ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 80, 80); ctx.strokeStyle = 'black'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(40,40,22,0,2*Math.PI); ctx.stroke()
    if (format === 'bmp') return Array.from(ctx.getImageData(0,0,80,80).data)
    return c.toDataURL(format === 'jpg' ? 'image/jpeg' : 'image/png').split(',')[1]
  }, format)
  let buffer: Buffer
  if (typeof pixels === 'string') buffer = Buffer.from(pixels, 'base64')
  else {
    buffer = Buffer.alloc(54 + 80*80*3); buffer.write('BM'); buffer.writeUInt32LE(buffer.length, 2); buffer.writeUInt32LE(54,10); buffer.writeUInt32LE(40,14); buffer.writeInt32LE(80,18); buffer.writeInt32LE(80,22); buffer.writeUInt16LE(1,26); buffer.writeUInt16LE(24,28)
    for (let y=0;y<80;y++) for (let x=0;x<80;x++) { const i=4*((79-y)*80+x), j=54+3*(y*80+x); buffer[j]=pixels[i+2]; buffer[j+1]=pixels[i+1]; buffer[j+2]=pixels[i] }
  }
  await page.setInputFiles('[aria-label="Choose image file"]', { name: `ring.${format}`, mimeType: `image/${format === 'jpg' ? 'jpeg' : format}`, buffer })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
  const event = page.waitForEvent('download'); await page.getByRole('link', { name: 'Export STL' }).click()
  const d = await event, stl = readFileSync((await d.path())!)
  expect(stl.length).toBe(84 + 50*stl.readUInt32LE(80))
  expect(stl.readUInt32LE(80)).toBeGreaterThan(100)
})
