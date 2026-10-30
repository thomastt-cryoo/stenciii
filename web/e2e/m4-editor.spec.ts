import {expect,test,type Page} from '@playwright/test'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import AxeBuilder from '@axe-core/playwright'
import {geometryProject,geometrySvg} from './m4-fixtures'
test.setTimeout(180_000)
async function ready(page:Page){await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})}
async function open(page:Page,doc=geometryProject('vector_stencil','bridge_mm')){await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();await page.setInputFiles('[aria-label="Open project file"]',{name:'geometry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await ready(page)}
async function settings(page:Page,category:string){await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:category,exact:true}).click()}
async function saved(page:Page){const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project',exact:true}).click();return JSON.parse(readFileSync((await(await wait).path())!,'utf8'))}
async function mesh(page:Page,name:string){mkdirSync('../sandbox/m6/replay/m4',{recursive:true});const wait=page.waitForEvent('download');await page.getByRole('link',{name:'Export STL',exact:true}).click();const path=resolve(`../sandbox/m6/replay/m4/${name}.stl`);await(await wait).saveAs(path);const data=readFileSync(path),info=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8'}));expect(info.closed_oriented_mesh).toBe(true);return {info,sha:createHash('sha256').update(data).digest('hex')}}
test('bridge strategy, physical layers, scoped editing, live preview, undo and save/open alter real verified STL',async({page})=>{
 await open(page);const before=await mesh(page,'bridges-before')
 await settings(page,'Bridges and stencil geometry');await page.locator('.geometry-group').filter({hasText:'Bridge placement'}).locator('summary').first().click()
 await page.getByRole('spinbutton',{name:'Bridge width (mm) · test',exact:true}).fill('2.5');await page.getByRole('combobox',{name:'Bridge spacing · test',exact:true}).selectOption('closest');await page.getByRole('button',{name:'Close settings',exact:true}).click();await ready(page)
 const after=await mesh(page,'bridges-after');expect(after.sha).not.toBe(before.sha)
 const doc=await saved(page);expect(doc.graph.nodes.find((n:any)=>n.id==='test').params).toMatchObject({bridge_mm:2.5,bridge_spacing:'closest'});expect(doc.opaque).toEqual({preserve:[1,false,'M4']})
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();await ready(page);expect(await saved(page)).toEqual(doc)
 await page.reload();await ready(page);expect((await mesh(page,'reopened')).sha).toBe(after.sha)
 mkdirSync('../docs/m6/replay/m5/replay/m4',{recursive:true});writeFileSync('../docs/m6/replay/m5/replay/m4/bridge-demo.json',JSON.stringify({before,after},null,2))
})
test('optional remesh changes exported geometry, restores exact bypass and retains the last valid result on an invalid interval',async({page})=>{
 await open(page);const original=await mesh(page,'optimization-before');await settings(page,'Mesh optimization');await page.getByRole('button',{name:'Add mesh optimization',exact:true}).click()
 await expect(page.getByRole('combobox',{name:'Geometry operation',exact:true})).toHaveValue('remesh-1')
 await page.locator('.geometry-group').filter({hasText:'Surface & outline precision'}).locator('summary').first().click();await page.getByRole('spinbutton',{name:'Largest shift of an outline (mm) · remesh-1',exact:true}).fill('.3');await page.getByRole('button',{name:'Close settings',exact:true}).click();await ready(page)
 const optimized=await mesh(page,'optimization-after');expect(optimized.sha).not.toBe(original.sha)
 await settings(page,'Mesh optimization');await page.getByRole('combobox',{name:'Geometry operation',exact:true}).selectOption('remesh-1');await page.locator('.geometry-group').filter({hasText:'Reconstruction interval'}).locator('summary').first().click();await page.getByRole('spinbutton',{name:'First layer · remesh-1',exact:true}).fill('999');await page.getByRole('button',{name:'Close settings',exact:true}).click()
 await expect(page.getByRole('alert')).toContainText(/layer interval|model has/);await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','true');await expect(page.locator('.stale-label')).toBeVisible()
 await page.getByRole('button',{name:'Undo',exact:true}).click();await ready(page);expect((await mesh(page,'optimization-recovered')).sha).toBe(optimized.sha)
 await settings(page,'Mesh optimization');await page.getByRole('combobox',{name:'Geometry operation',exact:true}).selectOption('remesh-1');await page.getByRole('button',{name:'Disable mesh optimization',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click();await ready(page)
 // Select the original solid explicitly; the optimized output is archived.
 expect((await mesh(page,'optimization-bypassed')).sha).toBe(original.sha)
 await settings(page,'Mesh optimization');await page.getByRole('button',{name:'Restore mesh optimization',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click();await ready(page);expect((await mesh(page,'optimization-restored')).sha).toBe(optimized.sha)
 writeFileSync('../docs/m6/replay/m5/replay/m4/remesh-demo.json',JSON.stringify({before:original,after:optimized},null,2))
})
test('all 3D display options change actual rendering and never change current export bytes',async({page})=>{
 await open(page);const original=await mesh(page,'viewer-reference');await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true');await page.locator('.view-options summary').click()
 const canvas=page.locator('.mesh-preview canvas'),shot=async()=>createHash('sha256').update(await canvas.screenshot()).digest('hex'),iso=await shot()
 await page.getByRole('combobox',{name:'Camera view',exact:true}).selectOption('bottom');expect(await shot()).not.toBe(iso)
 for(const view of ['top','left','right','front','back','iso'])await page.getByRole('combobox',{name:'Camera view',exact:true}).selectOption(view)
 await page.getByRole('checkbox',{name:'Wireframe',exact:true}).check();expect(await shot()).not.toBe(iso);await page.getByRole('checkbox',{name:'Wireframe',exact:true}).uncheck()
 await page.getByRole('combobox',{name:'Mesh shading',exact:true}).selectOption('flat');const flat=await shot();await page.getByRole('combobox',{name:'Mesh shading',exact:true}).selectOption('smooth');expect(await shot()).not.toBe(flat)
 await page.getByRole('combobox',{name:'Display detail',exact:true}).selectOption('reduced');await page.getByRole('combobox',{name:'Display detail',exact:true}).selectOption('full')
 await page.getByRole('checkbox',{name:'Colour by height',exact:true}).check();await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('below');await page.getByRole('spinbutton',{name:'Inspection height (mm)',exact:true}).fill('.1');const low=await shot();await page.getByRole('spinbutton',{name:'Inspection height (mm)',exact:true}).fill('2.5');expect(await shot()).not.toBe(low)
 await page.getByRole('combobox',{name:'Height inspection',exact:true}).selectOption('layer');await expect(page.locator('.view-options')).toContainText('not a manufacturing slicer');await page.getByRole('button',{name:'Reset camera',exact:true}).click()
 expect((await mesh(page,'viewer-after-options')).sha).toBe(original.sha)
 const axe=await new AxeBuilder({page}).include('.view-options').withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations.filter(v=>['critical','serious'].includes(v.impact??''))).toEqual([])
})
test('two stencil instances and an existing tiled branch keep independent settings and safe geometry dependencies',async({page})=>{
 const doc=geometryProject('vector_stencil','tile_method');doc.graph.nodes.push({id:'proof',type:'vector_stencil',params:{width_mm:80,bridge_mm:1.8},future:{keep:true}});doc.graph.edges.push({from:['trace','shapes'],to:['proof','shapes']})
 await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'branched.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled();await settings(page,'Mesh optimization')
 await page.getByRole('combobox',{name:'Geometry operation',exact:true}).selectOption('test');await expect(page.getByRole('button',{name:'Add mesh optimization',exact:true})).toBeDisabled()
 await page.getByRole('searchbox').fill('vector_stencil.tile_method');await page.locator('.setting-reference summary').click();await expect(page.getByRole('combobox',{name:'Tile method · test',exact:true})).toBeEnabled();await expect(page.getByRole('combobox',{name:'Tile method · proof',exact:true})).toBeDisabled();await page.getByRole('combobox',{name:'Tile method · test',exact:true}).selectOption('cut_whole')
 await page.getByRole('searchbox').fill('vector_stencil.width_mm');await page.locator('.setting-reference summary').click();await expect(page.getByRole('spinbutton',{name:'Plate width (mm) · test',exact:true})).toBeDisabled();await page.getByRole('spinbutton',{name:'Plate width (mm) · proof',exact:true}).fill('90');await page.getByRole('button',{name:'Close settings',exact:true}).click()
 const got=await saved(page);expect(got.graph.nodes.find((n:any)=>n.id==='proof')).toMatchObject({params:{width_mm:90,bridge_mm:1.8},future:{keep:true}});expect(got.images).toEqual(doc.images);expect(got.graph.edges).toEqual(doc.graph.edges)
})

test('unordered imported operations select the final optimized solid and label the original as an intermediate result',async({page})=>{
 const doc=geometryProject('remesh','tolerance_mm'),target=doc.graph.nodes.find((n:any)=>n.id==='test');target.params.tolerance_mm=.4
 doc.graph.nodes=[target,...doc.graph.nodes.filter((n:any)=>n.id!=='test')]
 await open(page,doc);const choice=page.locator('.output-choice select');await expect(choice).toHaveValue('test/solid');const optimized=await mesh(page,'unordered-optimized')
 await expect(choice.locator('option[value="build/solid"]')).toContainText('Before later processing');await choice.selectOption('build/solid');const original=await mesh(page,'unordered-original');expect(original.sha).not.toBe(optimized.sha)
 await page.reload();await ready(page);await expect(choice).toHaveValue('test/solid');expect(await saved(page)).toEqual(doc)
})
