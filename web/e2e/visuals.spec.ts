import { expect, test } from '@playwright/test'
import { mkdirSync } from 'node:fs'
// Keep the approved M1 screenshots immutable; this replay also checks M2 presentation.
const folder = '../docs/m3/screenshots/m1-replay'
test('capture actual empty light/dark, generated stencil/3D and settings workspace', async ({ page }) => {
  mkdirSync(folder, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.emulateMedia({ colorScheme: 'light' }); await page.goto('/')
  await expect(page.getByRole('button', { name: 'Choose Image', exact: true })).toBeEnabled()
  await page.screenshot({ path: `${folder}/01-light-workspace.png`, fullPage: true })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await page.screenshot({ path: `${folder}/02-dark-workspace.png`, fullPage: true })
  await page.getByRole('button', { name: 'Switch to light mode' }).click()
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><rect width="300" height="300" fill="white"/><circle cx="150" cy="150" r="100" stroke="black" stroke-width="14" fill="none"/><path d="M85 179 Q150 80 215 179 M104 153 Q150 205 196 153" fill="none" stroke="black" stroke-width="17" stroke-linecap="round"/><circle cx="150" cy="106" r="16" fill="black"/></svg>'
  await page.setInputFiles('[aria-label="Choose image file"]', { name: 'Atelier mark.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) })
  await expect(page.getByRole('button', { name: 'Make Stencil', exact: true })).toBeEnabled()
  await page.screenshot({ path: `${folder}/03-original-artwork.png`, fullPage: true })
  await page.getByRole('button', { name: 'Make Stencil', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Export STL' })).toHaveAttribute('aria-disabled', 'false', { timeout: 90000 })
  await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
  await page.screenshot({ path: `${folder}/04-generated-stencil.png`, fullPage: true })
  await page.getByRole('tab', { name: '3D', exact: true }).click()
  await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
  await page.screenshot({ path: `${folder}/05-generated-3d.png`, fullPage: true })
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready', 'true')
  await page.screenshot({ path: `${folder}/06-dark-3d.png`, fullPage: true })
  await page.getByRole('button', { name: 'All Settings', exact: true }).click()
  await page.getByRole('searchbox').fill('bridge width')
  await page.screenshot({ path: `${folder}/07-settings-search.png`, fullPage: true })
})
