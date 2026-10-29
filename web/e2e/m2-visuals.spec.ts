import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
const folder = '../docs/m3/screenshots/m2-replay'
test.setTimeout(240_000)

test('actual M2 workspace, three styles, comparison, model, settings and complex artwork in both themes', async ({ page }) => {
  mkdirSync(folder, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 960 }); await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/')
  await expect(page.getByRole('button', { name: 'Choose Image', exact: true })).toBeEnabled()
  await page.screenshot({ path: `${folder}/01-empty-light.png`, fullPage: true })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click(); await page.screenshot({ path: `${folder}/02-empty-dark.png`, fullPage: true })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'Atelier mark.svg', mimeType: 'image/svg+xml', buffer: readFileSync(new URL('./corpus/simple-logo.svg', import.meta.url)) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled(); await page.screenshot({ path: `${folder}/03-imported-artwork.png`, fullPage: true })
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  for (const [i, style] of ['standard', 'smooth', 'crisp'].entries()) {
    if (i) await page.getByRole('combobox', { name: 'Stencil style' }).selectOption(style)
    await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
    await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
    await page.screenshot({ path: `${folder}/0${4 + i}-${style}.png`, fullPage: true })
  }
  await page.getByRole('tab', { name: 'Compare', exact: true }).click(); await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true'); await page.screenshot({ path: `${folder}/07-aligned-comparison.png`, fullPage: true })
  await page.getByRole('tab', { name: '3D', exact: true }).click(); await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true'); await page.screenshot({ path: `${folder}/09-crisp-3d.png`, fullPage: true })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click(); await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true'); await page.screenshot({ path: `${folder}/10-dark-3d.png`, fullPage: true })
  await page.getByRole('button', { name: 'All Settings', exact: true }).click(); await page.getByRole('searchbox').fill('bridge width'); await page.locator('.setting-reference summary').first().click(); await page.screenshot({ path: `${folder}/11-settings-dark.png`, fullPage: true }); await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  await page.getByRole('button', { name: 'All Settings', exact: true }).click(); await page.getByRole('checkbox', { name: 'In this project' }).check(); await page.getByRole('searchbox').fill('crop'); await page.locator('.setting-reference summary').first().click(); await page.screenshot({ path: `${folder}/12-settings-light.png`, fullPage: true }); await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await page.getByRole('button', { name: 'New Project', exact: true }).click()
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'Portrait.png', mimeType: 'image/png', buffer: readFileSync(new URL('./corpus/astronaut.png', import.meta.url)) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
  // Two explicit, saved photographic settings at a practical resolution.
  await page.getByRole('button', { name: 'Exact settings', exact: true }).click(); await page.getByRole('spinbutton', { name: 'Working resolution (px) · artwork', exact: true }).fill('400'); await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click(); await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 }); await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true'); await page.screenshot({ path: `${folder}/13-portrait-automatic.png`, fullPage: true })
  await page.getByRole('switch', { name: 'Automatic threshold' }).uncheck(); await page.getByRole('slider', { name: 'Threshold', exact: true }).fill('110'); await expect(page.getByRole('link', { name: 'Export STL', exact: true })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 }); await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true'); await page.screenshot({ path: `${folder}/14-portrait-threshold-110.png`, fullPage: true })
  for (const width of [1280, 800, 390]) { await page.setViewportSize({ width, height: 900 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await expect(page.getByRole('button', { name: 'All Settings', exact: true })).toBeVisible() }
  await page.screenshot({ path: `${folder}/15-mobile-portrait.png`, fullPage: true })
})
