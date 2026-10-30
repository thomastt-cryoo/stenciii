// Exercise the customer export policy for an explicitly disabled tile-island bridge.
import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {expect} from '../../web/node_modules/@playwright/test/index.mjs'
import {readFileSync,writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),page=await browser.newPage(),doc=JSON.parse(readFileSync('docs/m6/fixtures/control-projects/tiles/bridge_islands-0.json','utf8'))
try{
 await page.goto('http://localhost:5200/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 await page.setInputFiles('[aria-label="Open project file"]',{name:'Unbridged tile.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
 await expect(page.getByRole('button',{name:'Export options',exact:true})).toBeVisible({timeout:120000});await page.getByRole('button',{name:'Export options',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Manufacturing export'});await expect(dialog).toContainText('2 separate components; this file permits 1',{timeout:120000});await expect(dialog.getByRole('link',{name:'Download manufacturing ZIP',exact:true})).toHaveAttribute('aria-disabled','true')
 await page.keyboard.press('Escape');await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','true')
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Batch processing and diagnostics',exact:true}).click();await page.getByRole('button',{name:'Run local batch',exact:true}).click()
 await expect(page.locator('.batch-results')).toContainText('Failed',{timeout:120000});await expect(page.locator('.batch-results')).toContainText('2 separate components; this file permits 1');await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('tiles.bridge_islands');await page.locator('.setting-reference summary').first().click();await page.getByRole('checkbox',{name:/ · test$/,exact:false}).check();await page.getByRole('button',{name:'Close settings',exact:true}).click()
 await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 const result={fixture:'docs/m6/fixtures/control-projects/tiles/bridge_islands-0.json',raw_file:'stencil_r1c2.stl',raw_components:2,ordinary_export_blocked:true,manufacturing_zip_blocked:true,batch_item_failed_without_collection:true,reenabling_tile_island_bridges_restores_complete_export:true}
 writeFileSync('docs/m6/disconnected-guard-validation.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))
}finally{await browser.close()}
