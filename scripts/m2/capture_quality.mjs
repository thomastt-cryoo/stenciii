// Run from repository root after render_corpus.py. Uses local Playwright Chromium.
import { chromium } from '../../web/node_modules/playwright/index.mjs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1220, height: 1500 }, deviceScaleFactor: 1 })
for (let i = 1; i <= 4; i++) {
  await page.goto(pathToFileURL(resolve(`sandbox/m2/quality-${i}.html`)).href)
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
  await page.screenshot({ path: `docs/m2/screenshots/quality-${i}.png`, fullPage: true })
}
await browser.close()
