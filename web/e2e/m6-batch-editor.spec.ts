import {test,expect,type Page} from '@playwright/test'
import {mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {m5Project,step} from './m5-fixtures'

test.setTimeout(240000)
const output='../docs/m6/batch',temp='../sandbox/m6/batch'
async function workspace(page:Page){
 await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Batch processing and diagnostics',exact:true}).click()
 await expect(page.getByRole('region',{name:'Batch Processing',exact:true})).toBeVisible()
}
async function recipe(page:Page,raw:any){await page.setInputFiles('[aria-label="Batch saved project"]',{name:'Local recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});await expect(page.getByText('Saved recipe loaded. The main project is unchanged.',{exact:true})).toBeVisible()}
async function collection(page:Page,name:string){
 const event=page.waitForEvent('download');await page.getByRole('link',{name:'Download batch collection',exact:true}).click();const download=await event
 mkdirSync(output,{recursive:true});const file=resolve(output,`${name}.zip`);await download.saveAs(file)
 const checked=JSON.parse(execFileSync('python',['../scripts/m6/validate_batch.py',file],{encoding:'utf8',maxBuffer:16000000}));writeFileSync(`${output}/${name}-validation.json`,JSON.stringify(checked,null,2));return checked
}

test('graph-only recipes accept replacement artwork, optional attachments are scoped, and text/font choice sweeps run without image sources',async({page})=>{
 await workspace(page);const embedded=m5Project('tile_layout','edits'),raw:any=structuredClone(embedded);delete raw.images;await recipe(page,raw)
 await page.setInputFiles('[aria-label="Batch local images"]',{name:'Graph recipe input.svg',mimeType:'image/svg+xml',buffer:Buffer.from(embedded.images.original.base64,'base64')})
 await page.locator('.batch-workbench summary').filter({hasText:'Output settings'}).click();await page.getByRole('checkbox',{name:'Include project and original artwork',exact:true}).uncheck();await page.getByRole('checkbox',{name:'Include actual layout PNG',exact:true}).check();await page.getByRole('checkbox',{name:'Include outlines SVG before bridges',exact:true}).check();await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:120000})
 const attachments=await collection(page,'graph-recipe-optional-files');expect(attachments.verified_jobs).toBe(1);expect(attachments.jobs[0].files.some((f:any)=>f.path.endsWith('.png'))).toBe(true);expect(attachments.jobs[0].files.some((f:any)=>f.path.endsWith('.svg'))).toBe(true);expect(attachments.jobs[0].files.some((f:any)=>f.path==='original-project.json')).toBe(false)
 await page.getByRole('button',{name:'Use saved artwork instead',exact:true}).click();await expect(page.locator('[aria-label="Batch local images"]')).toHaveValue('');const text={version:2,graph:{nodes:[step('words','text',{text:'AB',size:100}),step('plate','stencil',{width_mm:80,margin_mm:8,thickness_mm:3,raised_bridges:false,extra_top_layers:0})],edges:[{from:['words','mask'],to:['plate','mask']}]},stencilStudio:{name:'Text variations'}};await recipe(page,text);await page.getByRole('combobox',{name:'Batch output format',exact:true}).selectOption('stl')
 await page.getByRole('button',{name:'Add parameter variation',exact:true}).click();await page.getByRole('combobox',{name:'Variation setting 1',exact:true}).selectOption(JSON.stringify(['words','font']));await expect(page.getByRole('checkbox',{name:'sans bold',exact:true})).toBeChecked();await expect(page.getByRole('checkbox',{name:'serif bold',exact:true})).toBeChecked()
 await page.getByRole('button',{name:'Add parameter variation',exact:true}).click();await page.getByRole('combobox',{name:'Variation setting 2',exact:true}).selectOption(JSON.stringify(['words','text']));await page.getByRole('textbox',{name:'Variation explicit values 2',exact:true}).fill('["AOBR","M6"]');await expect(page.locator('.batch-workload')).toContainText('4 jobs planned');await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:120000});const sweep=await collection(page,'text-and-font-sweep');expect(sweep.verified_jobs).toBe(4);expect(sweep.independent_stl_count).toBe(4);expect(sweep.summary.source).toBe('');expect(await page.evaluate(()=>localStorage.getItem('stencil-studio.project.v1'))).toBeNull()
})

test('strict warnings and multi-file single-STL choices refuse clearly without exporting incomplete results',async({page})=>{
 await workspace(page);await recipe(page,{version:2,graph:{nodes:[step('words','text',{text:'O',size:120}),step('plate','stencil',{width_mm:80,margin_mm:8,thickness_mm:3,raised_bridges:true,extra_top_layers:0})],edges:[{from:['words','mask'],to:['plate','mask']}]},stencilStudio:{name:'Strict raised O'}})
 await page.locator('.batch-workbench summary').filter({hasText:'Output settings'}).click();await page.getByRole('checkbox',{name:'Require warning-free readiness',exact:true}).check();await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.locator('.batch-results')).toContainText('Strict raised O · Failed',{timeout:120000});await expect(page.locator('.batch-results')).toContainText('Strict checks:');await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toHaveCount(0)
 const tiles=m5Project('tile_layout','edits');tiles.stencilStudio.name='Multiple printable tiles';await recipe(page,tiles);await page.getByRole('checkbox',{name:'Require warning-free readiness',exact:true}).uncheck();await page.getByRole('combobox',{name:'Batch output format',exact:true}).selectOption('stl');await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.locator('.batch-results')).toContainText('Multiple printable tiles · Failed',{timeout:120000});await expect(page.locator('.batch-results')).toContainText('multiple printable files');await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toHaveCount(0)
})
test('saved recipe selection, numeric sweeps, isolated failures and JSON/CSV summaries remain offline and lossless',async({page})=>{
 const outside:string[]=[];await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='localhost'){outside.push(route.request().url());return route.abort()}return route.continue()})
 await workspace(page);const doc=m5Project('tiles','max_x');await recipe(page,doc)
 const svg=Buffer.from(doc.images.original.base64,'base64')
 await page.setInputFiles('[aria-label="Batch local images"]',[{name:'one.svg',mimeType:'image/svg+xml',buffer:svg},{name:'damaged.svg',mimeType:'image/svg+xml',buffer:Buffer.from('damaged input')},{name:'two.svg',mimeType:'image/svg+xml',buffer:svg}])
 await page.getByRole('button',{name:'Add parameter variation',exact:true}).click();await page.getByRole('combobox',{name:'Variation setting 1',exact:true}).selectOption(JSON.stringify(['test','seam_angle_deg']))
 await page.getByRole('spinbutton',{name:'Variation end 1',exact:true}).fill('20');await page.getByRole('spinbutton',{name:'Variation increment 1',exact:true}).fill('20')
 await expect(page.locator('.batch-workload')).toContainText('6 jobs planned');await page.getByRole('button',{name:'Run local batch',exact:true}).click()
 await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:180000})
 const checked=await collection(page,'sweep-with-isolated-errors');expect(checked.summary.verified).toBe(4);expect(checked.summary.failed).toBe(2);expect(checked.csv_rows).toBe(6);expect(checked.all_stls_valid).toBe(true)
 expect(checked.summary.items.filter((r:any)=>r.status==='Verified').map((r:any)=>r.overrides[0].value)).toEqual([0,20,0,20])
 await expect(page.getByRole('link',{name:'Download JSON summary',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Download CSV summary',exact:true})).toBeVisible()
 await page.getByRole('combobox',{name:'Compare batch results',exact:true}).selectOption('triangles');expect(outside).toEqual([]);expect(await page.evaluate(()=>localStorage.getItem('stencil-studio.project.v1'))).toBeNull()
 await page.locator('.batch-results').scrollIntoViewIfNeeded();mkdirSync('../docs/m6/screenshots',{recursive:true});await page.screenshot({path:'../docs/m6/screenshots/batch-sweep-results-light.png',fullPage:true})
})
test('folder input preserves mixed-format paths and a multiple-file fallback is available without folder support',async({page})=>{
 mkdirSync(temp+'/folder',{recursive:true});const dir=resolve(temp,'folder')
 for(const [name,source]of [['original.svg','simple-logo.svg'],['alpha.png','transparent.png'],['pixels.bmp','small-pixel.bmp']])copyFileSync(`e2e/corpus/${source}`,`${dir}/${name}`)
 writeFileSync(`${dir}/notes.txt`,'A non-image file must be reported as excluded.')
 const doc=m5Project('export','max_x');Object.assign(doc.graph.nodes.find(n=>n.id==='test')!.params,{max_x:0,max_y:0,pad_count:0,mount_screw:'none'})
 await workspace(page);await recipe(page,doc);await page.setInputFiles('[aria-label="Batch image folder"]',dir)
 await expect(page.locator('.batch-workbench')).toContainText('1 non-image files excluded');await expect(page.locator('.batch-workload')).toContainText('3 jobs planned')
 await page.locator('.batch-workbench summary').filter({hasText:'Output settings'}).click();await page.getByRole('combobox',{name:'Batch output format',exact:true}).selectOption('stl')
 await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:180000})
 const checked=await collection(page,'folder-mixed-formats');expect(checked.verified_jobs).toBe(3);expect(checked.independent_stl_count).toBe(3);expect(checked.summary.items.every((r:any)=>r.relativePath.includes('folder/'))).toBe(true)
 await page.getByRole('button',{name:'Close settings',exact:true}).click()
 await page.addInitScript(()=>{delete (HTMLInputElement.prototype as any).webkitdirectory})
 await page.reload();await workspace(page);await recipe(page,doc);await expect(page.locator('[aria-label="Batch image folder"]')).toHaveCount(0)
 await expect(page.locator('.batch-workbench')).toContainText('Use Choose images to select multiple local files.')
 await page.setInputFiles('[aria-label="Batch local images"]',[{name:'one.svg',mimeType:'image/svg+xml',buffer:readFileSync('e2e/corpus/simple-logo.svg')},{name:'two.png',mimeType:'image/png',buffer:readFileSync('e2e/corpus/transparent.png')}])
 await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:180000});expect((await collection(page,'multi-file-fallback')).verified_jobs).toBe(2)
})
test('cancellation retains verified jobs and restarting cannot publish results from the cancelled generation',async({page})=>{
 await workspace(page);const doc=m5Project('export','max_x');Object.assign(doc.graph.nodes.find(n=>n.id==='test')!.params,{max_x:0,max_y:0,pad_count:0,mount_screw:'none'});await recipe(page,doc)
 const svg=Buffer.from(doc.images.original.base64,'base64')
 await page.setInputFiles('[aria-label="Batch local images"]',Array.from({length:20},(_,i)=>({name:`cancel-${i}.svg`,mimeType:'image/svg+xml',buffer:svg})))
 await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.locator('.batch-results b').filter({hasText:'cancel-0.svg · Verified'})).toBeVisible({timeout:120000})
 await page.getByRole('button',{name:'Cancel batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download JSON summary',exact:true})).toBeVisible()
 await expect(page.locator('.batch-results b').filter({hasText:'Cancelled'}).first()).toBeVisible();await page.getByRole('button',{name:'Collect completed results',exact:true}).click()
 await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible();const partial=await collection(page,'cancelled-completed-results')
 expect(partial.summary.cancelled).toBeGreaterThan(0);expect(partial.summary.verified).toBeGreaterThan(0);expect(partial.summary.items.some((r:any)=>r.status==='Processing'||r.status==='Queued')).toBe(false)
 await expect(page.getByRole('button',{name:'Run local batch',exact:true})).toBeEnabled()
 await page.setInputFiles('[aria-label="Batch local images"]',[{name:'restart.svg',mimeType:'image/svg+xml',buffer:svg}]);await page.getByRole('button',{name:'Run local batch',exact:true}).click()
 await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:120000});const restarted=await collection(page,'after-cancellation-restart')
 expect(restarted.summary.planned_jobs).toBe(1);expect(restarted.summary.verified).toBe(1);expect(restarted.summary.items[0].name).toBe('restart.svg');expect(restarted.summary.items[0].status).toBe('Verified')
})
