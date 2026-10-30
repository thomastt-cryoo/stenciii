import {test,expect,type Page} from '@playwright/test'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {m5Project} from './m5-fixtures'
test.setTimeout(240000)
const svg=readFileSync('e2e/corpus/simple-logo.svg')
async function ready(page:Page){await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:30000})}
async function save(page:Page){const event=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project',exact:true}).click();return JSON.parse(readFileSync((await (await event).path())!,'utf8'))}
async function make(page:Page){await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:180000})}

for(const fault of ['unavailable','full'])test(`actual processing and lossless project download survive ${fault} browser storage`,async({page})=>{
 await page.addInitScript(fault=>{
  const get=Storage.prototype.getItem,set=Storage.prototype.setItem
  Storage.prototype.getItem=function(key){if(key==='stencil-studio.project.v1'&&fault==='unavailable')throw new DOMException('Storage denied','SecurityError');return get.call(this,key)}
  Storage.prototype.setItem=function(key,value){if(key==='stencil-studio.project.v1')throw new DOMException('No persistent storage','QuotaExceededError');return set.call(this,key,value)}
  if(fault==='unavailable')IDBFactory.prototype.open=function(){throw new DOMException('Image storage denied','SecurityError')}
  else{const transaction=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args:any[]){if(args[1]==='readwrite')throw new DOMException('Image storage full','QuotaExceededError');return transaction.apply(this,args as any)}}
 },fault)
 await ready(page);await page.setInputFiles('[aria-label="Choose image file"]',{name:'recover.svg',mimeType:'image/svg+xml',buffer:svg})
 await expect(page.getByRole('button',{name:'Make Stencil',exact:true})).toBeEnabled();await make(page)
 await expect(page.getByText(/Keep this window open and use Save Project/).first()).toBeVisible()
 const first=await save(page);expect(Buffer.from(Object.values<any>(first.images)[0].base64,'base64')).toEqual(svg)
 await page.getByRole('spinbutton',{name:'Bridge width',exact:true}).fill('2.4');await page.getByRole('spinbutton',{name:'Bridge width',exact:true}).blur()
 const changed=await save(page);expect(changed.images).toEqual(first.images);expect(changed.graph.nodes.find((n:any)=>['stencil','vector_stencil'].includes(n.type)).params.bridge_mm).toBe(2.4)
 await page.reload();await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 await page.setInputFiles('[aria-label="Open project file"]',{name:'Recovered.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(changed))})
 await expect(page.getByRole('spinbutton',{name:'Bridge width',exact:true})).toHaveValue('2.4');await make(page);expect((await save(page)).images).toEqual(first.images)
})

test('a hung threaded pool falls back to the real bundled single-thread engine and settles startup requests',async({page})=>{
 let hangs=0
 await page.route('**/pkg-mt/stencil_wasm.js',async route=>{
  const response=await route.fetch(),body=await response.text()
  expect(body).toContain('export function initThreadPool(num_threads)')
  const modified=body.replace(/export function initThreadPool\(num_threads\)\s*\{[\s\S]*?\n\}/,'export function initThreadPool(num_threads) { return new Promise(() => {});\n}')
  hangs++;await route.fulfill({response,body:modified})
 })
 const start=Date.now();await ready(page);const startupMs=Date.now()-start;expect(hangs).toBe(1);expect(startupMs).toBeGreaterThanOrEqual(9000)
 await page.setInputFiles('[aria-label="Choose image file"]',{name:'fallback.svg',mimeType:'image/svg+xml',buffer:svg});await expect(page.getByRole('button',{name:'Make Stencil',exact:true})).toBeEnabled();await make(page)
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('diagnostics');await page.getByRole('button',{name:'Engine diagnostics and processing reports',exact:true}).click();await page.locator('.engine-diagnostics>summary').click()
 await expect(page.locator('.engine-diagnostics')).toContainText('1 threads');await expect(page.locator('.engine-diagnostics')).toContainText('timed out')
 const event=page.waitForEvent('download');await page.getByRole('button',{name:'Download diagnostic report JSON',exact:true}).click();const report=JSON.parse(readFileSync((await (await event).path())!,'utf8'))
 expect(report.outputMatchesCurrent).toBe(true);expect(report.engine.n).toBe(1);expect(Object.keys(report.steps).length).toBeGreaterThan(3);expect(report.outputs.every((a:any)=>a.mesh?.closed)).toBe(true)
 mkdirSync('../docs/m6/reliability',{recursive:true});writeFileSync('../docs/m6/reliability/thread-startup-fallback.json',JSON.stringify({...report,observedStartupMs:startupMs},null,2))
})

test('history jumps, copied step groups and keyboard panel resizing operate through customer controls',async({page})=>{
 await ready(page);await page.setInputFiles('[aria-label="Choose image file"]',{name:'history.svg',mimeType:'image/svg+xml',buffer:svg});await expect(page.getByRole('button',{name:'Make Stencil',exact:true})).toBeEnabled()
 const separator=page.getByRole('separator',{name:'Resize quick settings',exact:true});await separator.focus();await page.keyboard.press('ArrowLeft');await expect(separator).toHaveAttribute('aria-valuenow','328');await page.keyboard.press('Home');await expect(separator).toHaveAttribute('aria-valuenow','312');const handle=(await separator.boundingBox())!;await page.mouse.move(handle.x+handle.width/2,handle.y+20);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2-40,handle.y+20,{steps:4});await page.mouse.up();await expect(separator).toHaveAttribute('aria-valuenow','352');await separator.focus();await page.keyboard.press('Home');await expect(separator).toHaveAttribute('aria-valuenow','312')
 await page.getByRole('spinbutton',{name:'Bridge width',exact:true}).fill('2.4');await page.getByRole('spinbutton',{name:'Bridge width',exact:true}).blur()
 const changed=await save(page);await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('history');await page.getByRole('button',{name:'Original workflow templates, presets and edit history',exact:true}).click();await page.locator('.edit-history>summary').click()
 await page.getByRole('button',{name:/Restore history state 0:/}).click();await page.getByRole('button',{name:/Restore history state 1:/}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click();expect(await save(page)).toEqual(changed)
 await page.getByRole('button',{name:'Processing Steps',exact:true}).click();await page.locator('.step-copy-tools>summary').click();const plate=changed.graph.nodes.find((n:any)=>['stencil','vector_stencil'].includes(n.type))
 await page.getByRole('checkbox',{name:`Copy step ${plate.id}`,exact:true}).check();await page.getByRole('button',{name:'Copy selected steps',exact:true}).click();await page.getByRole('button',{name:'Paste copied steps',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click()
 const copied=await save(page);expect(copied.graph.nodes.length).toBe(changed.graph.nodes.length*2);expect(copied.images).toEqual(changed.images);expect(copied.graph.nodes.filter((n:any)=>n.id.startsWith('copy-'))).toHaveLength(changed.graph.nodes.length)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await save(page)).toEqual(changed);await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await save(page)).toEqual(copied)
})

test('damaged autosave is retained and an engine failure has actionable per-step diagnostics',async({page})=>{
 const damaged='{damaged original autosave';await page.addInitScript(raw=>localStorage.setItem('stencil-studio.project.v1',raw),damaged);await ready(page)
 expect(await page.evaluate(()=>localStorage.getItem('stencil-studio.project.v1'))).toBe(damaged);const recovery=page.waitForEvent('download');await page.getByRole('button',{name:'Save stored recovery file',exact:true}).click();expect(readFileSync((await(await recovery).path())!,'utf8')).toBe(damaged)
 const doc=m5Project('tiles','max_x');doc.images.original.base64=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" fill="white"/></svg>').toString('base64')
 await page.setInputFiles('[aria-label="Open project file"]',{name:'Blank.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'Something needs attention'})).toBeVisible({timeout:90000})
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Batch processing and diagnostics',exact:true}).click();await page.locator('.engine-diagnostics>summary').click();await expect(page.getByRole('button',{name:'Review failed operation',exact:true})).toBeVisible();await page.getByRole('button',{name:'Review failed operation',exact:true}).click();await expect(page.locator('.processing-list>li.selected')).toBeVisible()
})
