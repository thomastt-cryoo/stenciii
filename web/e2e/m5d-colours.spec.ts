import {test,expect} from '@playwright/test'
import {writeFileSync,mkdirSync,readFileSync} from 'node:fs'
import {m5Project} from './m5-fixtures'
import {prove} from './m5-proof'
test('two through ten colour reductions expose every real mask and complete registration groups collect all ten plates',async({page})=>{
 test.setTimeout(240000);await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();const rows=[]
 for(let n=2;n<=10;n++){
  const doc=m5Project('split_colours','colours');doc.graph.nodes.find(s=>s.id==='test')!.params.colours=n
  const palette=await prove(page,doc,'test','palette'),hashes=[]
  expect(palette.info.width).toBe(n*40)
  for(let i=1;i<=n;i++){const mask=await prove(page,doc,'test',`colour_${i}`);expect(mask.extension).toBe('png');hashes.push(mask.sha256)}
  expect(new Set(hashes).size).toBe(n);rows.push({colours:n,palette_width:palette.info.width,masks:hashes})
 }
 mkdirSync('../docs/m5',{recursive:true});writeFileSync('../docs/m5/colour-mask-counts.json',JSON.stringify(rows,null,2))
 const doc=JSON.parse(readFileSync('../docs/m5/examples/ten-colour-project.json','utf8'))
 await page.setInputFiles('[aria-label="Open project file"]',{name:'ten-colours.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000});await page.getByRole('button',{name:'Export options',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Manufacturing export'});expect(await dialog.getByRole('checkbox',{name:/Include assembly .* parts/}).evaluateAll(es=>es.filter(e=>(e as HTMLInputElement).checked).length)).toBe(2);expect(await dialog.locator('tbody tr').filter({hasText:'Colour plate'}).count()).toBe(10)
 const download=page.waitForEvent('download');await dialog.getByRole('link',{name:'Download manufacturing ZIP',exact:true}).click();mkdirSync('../docs/m5/exports',{recursive:true});writeFileSync('../docs/m5/exports/ten-registered-colours.zip',readFileSync((await(await download).path())!))
})
