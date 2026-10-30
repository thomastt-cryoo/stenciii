import {defineConfig} from '../../web/node_modules/@playwright/test/index.mjs'
import {resolve} from 'node:path'
import base from '../../web/playwright.config'
export default defineConfig({
 ...base,
 use:{...base.use,baseURL:process.env.M6_STUDIO_URL??base.use?.baseURL},
 webServer:process.env.M6_STUDIO_URL?undefined:base.webServer,
 testDir:resolve(__dirname,'../../web/e2e'),
 testIgnore:['**/studio.spec.ts','**/reliability.spec.ts','**/*-coverage.spec.ts','**/m6-controls.spec.ts'],
 outputDir:resolve(__dirname,'../../sandbox/m6/production-test-results'),
})
