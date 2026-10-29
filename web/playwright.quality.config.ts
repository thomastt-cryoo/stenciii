import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: 'quality', testMatch: 'quality.spec.ts', outputDir: '../sandbox/m2/quality-test-results', workers: 1, timeout: 30 * 60_000 })
