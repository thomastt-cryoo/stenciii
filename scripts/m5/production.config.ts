import {defineConfig} from '../../web/node_modules/@playwright/test/index.mjs'
import {resolve} from 'node:path'
import base from '../../web/playwright.config'
export default defineConfig({
 ...base,
 testDir:resolve(__dirname,'../../web/e2e'),
 testIgnore:['**/studio.spec.ts','**/reliability.spec.ts','**/*-coverage.spec.ts'],
 outputDir:resolve(__dirname,'../../sandbox/m5/production-test-results'),
})
