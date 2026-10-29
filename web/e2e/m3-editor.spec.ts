import { expect, test, type Page } from '@playwright/test'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { styleRecipe } from '../src/studio/recipes'
import { rawGraph } from '../src/studio/project'
import { duplicatePass } from '../src/studio/artwork'
import AxeBuilder from '@axe-core/playwright'
const catalogue = JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json', import.meta.url), 'utf8'))
const image = readFileSync(new URL('./corpus/colour-graphic.png', import.meta.url))
test.setTimeout(180_000)
async function upload(page: Page) {
  await page.goto('/'); await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
  await page.setInputFiles('[aria-label="Choose image file"]',{name:'Colour artwork.png',mimeType:'image/png',buffer:image})
  await expect(page.getByRole('button',{name:'Make Stencil',exact:true})).toBeEnabled()
}
async function saved(page: Page) { const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project',exact:true}).click();return JSON.parse(readFileSync((await(await wait).path())!,'utf8')) }
async function ready(page: Page) { await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:90000}) }
async function settings(page: Page, category: string) { await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:category,exact:true}).click() }
async function downloadMesh(page: Page, name: string) {
  mkdirSync('../sandbox/m3',{recursive:true});const wait=page.waitForEvent('download');await page.getByRole('link',{name:'Export STL',exact:true}).click();const path=resolve(`../sandbox/m3/${name}.stl`);await(await wait).saveAs(path)
  const mesh=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8'}));expect(mesh.closed_oriented_mesh).toBe(true);return mesh
}

test('multiline text, bundled fonts, actual artwork preview, bridged STL/SVG, CLI replay and persistence',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Create from Text',exact:true}).click()
  await page.getByRole('textbox',{name:'Text · text-artwork',exact:true}).fill('AOBR\nSTENCIL')
  await page.getByRole('combobox',{name:'Font · text-artwork',exact:true}).selectOption('serif bold')
  await page.getByRole('spinbutton',{name:'Letter height (px) · text-artwork',exact:true}).fill('120')
  await page.getByRole('spinbutton',{name:'Line spacing (x) · text-artwork',exact:true}).fill('1.35')
  await page.getByRole('spinbutton',{name:'Padding (px) · text-artwork',exact:true}).fill('30')
  await page.getByRole('button',{name:'Close settings',exact:true}).click()
  await expect(page.locator('.stage-image')).toHaveAttribute('data-ready','true')
  await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await ready(page)
  const doc=await saved(page);expect(doc.graph.nodes.find((n:any)=>n.type==='text').params).toMatchObject({text:'AOBR\nSTENCIL',font:'serif bold',size:120,line_spacing:1.35,padding:30});expect(doc.graph.nodes.some((n:any)=>n.type==='source')).toBe(false)
  const mesh=await downloadMesh(page,'text');expect(mesh.components).toBe(1)
  const file=resolve('../sandbox/m3/text-project.json'),native=resolve('../sandbox/m3/text-native.stl');writeFileSync(file,JSON.stringify(doc))
  execFileSync(resolve(`../target/release/stencil${process.platform==='win32'?'.exe':''}`),['--project',file,'-o',native])
  const nativeMesh=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',native],{encoding:'utf8'}));expect(nativeMesh.triangles).toBe(mesh.triangles);expect(nativeMesh.size_mm).toEqual(mesh.size_mm)
  const svgWait=page.waitForEvent('download');await page.getByRole('link',{name:/Save traced outlines SVG/}).click();const svgFile=resolve('../sandbox/m3/text-outlines.svg');await(await svgWait).saveAs(svgFile);const svg=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',svgFile],{encoding:'utf8'}));expect(svg.paths).toBeGreaterThan(0)
  mkdirSync('../docs/m3',{recursive:true});writeFileSync('../docs/m3/text-validation.json',JSON.stringify({mesh,native:nativeMesh,svg},null,2))
  await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true')
  await page.reload();await ready(page);expect(await saved(page)).toEqual(doc)
})

test('processing list inserts, duplicates, reorders, disables, restores and inspects actual secondary results',async({page})=>{
  await upload(page);await page.getByRole('button',{name:'Processing Steps',exact:true}).click()
  await page.locator('.step-select').filter({hasText:'Trace outlines'}).click()
  await page.getByRole('combobox',{name:'Add before outlines',exact:true}).selectOption('morphology')
  await page.locator('.step-select').filter({hasText:'Reshape paint'}).click()
  await page.getByRole('spinbutton',{name:'Kernel radius (px) · morphology-1',exact:true}).fill('3')
  await page.getByRole('button',{name:'Duplicate step',exact:true}).click()
  await expect(page.locator('.step-select').filter({hasText:'Reshape paint'})).toHaveCount(2)
  await page.getByRole('button',{name:'Move earlier',exact:true}).click()
  await page.getByRole('button',{name:'Disable step',exact:true}).click()
  await expect(page.locator('.disabled-step')).toContainText('settings retained')
  await page.getByRole('button',{name:'Enable morphology-1',exact:true}).click()
  await page.getByRole('button',{name:'Close settings',exact:true}).click()
  await page.getByRole('switch',{name:'Automatic threshold',exact:true}).uncheck()
  await expect(page.getByRole('slider',{name:'Threshold',exact:true})).toHaveValue('128')
  expect((await saved(page)).graph.nodes.find((n:any)=>n.id==='paint').params.threshold).toBe(128)
  await page.getByRole('switch',{name:'Automatic threshold',exact:true}).check()
  const doc=await saved(page),morphs=doc.graph.nodes.filter((n:any)=>n.type==='morphology');expect(morphs).toHaveLength(2);expect(morphs.every((n:any)=>n.params.radius===3)).toBe(true)
  await page.getByRole('combobox',{name:'Inspect artwork stage',exact:true}).selectOption('cleanup/removed')
  await expect(page.locator('.stage-image')).toHaveAttribute('data-ready','true');await expect(page.getByAltText('Actual processed artwork')).toBeVisible()
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await saved(page)).toEqual(doc)
})

test('direct crop handles, zoom/pan, keyboard pixels, rotations and undo match actual Rust image dimensions',async({page})=>{
  await upload(page);await page.getByText('Artwork tools',{exact:true}).click();await page.getByRole('button',{name:'Visual crop',exact:true}).click()
  const plane=page.locator('.crop-plane');await expect(plane).toBeVisible();const width=Number(await plane.getAttribute('data-width')),height=Number(await plane.getAttribute('data-height'))
  const left=page.getByRole('button',{name:'Crop left',exact:true});await left.focus();await page.keyboard.press('ArrowRight')
  let raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(Math.round(raw.graph.nodes.find((n:any)=>n.type==='transform').params.crop_left*width/100)).toBe(1)
  await page.getByRole('button',{name:'Crop zoom in',exact:true}).click();const box=(await plane.boundingBox())!,handle=(await left.boundingBox())!
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.2,box.y+box.height/2,{steps:10});await page.mouse.up()
  await expect(page.locator('.crop-result .stage-image')).toHaveAttribute('data-ready','true')
  raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));const crop=raw.graph.nodes.find((n:any)=>n.type==='transform').params;expect(Math.round(crop.crop_left*width/100)).toBe(Math.round(width*.2))
  await page.getByRole('dialog',{name:'Crop & rotate artwork'}).getByRole('button',{name:'Rotate 90°',exact:true}).click();await page.getByRole('dialog',{name:'Crop & rotate artwork'}).getByRole('button',{name:'Flip horizontally',exact:true}).click()
  await expect(page.locator('.crop-result .stage-image')).toHaveAttribute('data-ready','true');await expect(page.locator('.crop-result .stage-state')).toContainText(`${height} × ${width-Math.round(width*.2)} px`)
  mkdirSync('../docs/m3/screenshots',{recursive:true});await page.screenshot({path:'../docs/m3/screenshots/03-visual-crop.png',fullPage:true})
  await page.getByRole('button',{name:'Done',exact:true}).click();const doc=await saved(page);expect(Buffer.from(Object.values<any>(doc.images)[0].base64,'base64')).toEqual(image)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await saved(page)).toEqual(doc)
})

test('operation presets preserve the legacy file format, import merges, scoped apply, rename/remove and defaults',async({page})=>{
  await upload(page);await settings(page,'Presets and history')
  await page.getByRole('combobox',{name:'Preset operation',exact:true}).selectOption('outlines')
  await page.getByRole('textbox',{name:'Preset name',exact:true}).fill('My outlines');await page.getByRole('button',{name:'Save operation preset',exact:true}).click()
  const wait=page.waitForEvent('download');await page.getByRole('button',{name:'Export presets',exact:true}).click();const exported=JSON.parse(readFileSync((await(await wait).path())!,'utf8'));expect(exported.stencilPresets).toBe(1);expect(exported.presets.trace['My outlines'].tolerance).toBe(.4)
  await page.setInputFiles('[aria-label="Import presets file"]',{name:'legacy-presets.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({stencilPresets:1,presets:{trace:{'My outlines':{tolerance:3},'Shared outlines':{tolerance:1.5,smooth:0,future_flag:true}}}}))})
  await page.getByRole('combobox',{name:'Operation preset',exact:true}).selectOption('Shared outlines');await page.getByRole('button',{name:'Apply to selected operation',exact:true}).click()
  await page.getByRole('textbox',{name:'Preset name',exact:true}).fill('Renamed outlines');await page.getByRole('button',{name:'Rename preset',exact:true}).click();await expect(page.getByRole('combobox',{name:'Operation preset',exact:true})).toHaveValue('Renamed outlines')
  await page.getByRole('button',{name:'Close settings',exact:true}).click();let doc=await saved(page);expect(doc.graph.nodes.find((n:any)=>n.type==='trace').params).toMatchObject({tolerance:1.5,smooth:0})
  await settings(page,'Presets and history');await page.getByRole('combobox',{name:'Preset operation',exact:true}).selectOption('outlines');await page.getByRole('button',{name:'Restore operation defaults',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click();doc=await saved(page);expect(doc.graph.nodes.find((n:any)=>n.type==='trace').params.tolerance).toBe(.4)
  const library=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-presets')!));expect(library.trace['My outlines'].tolerance).toBe(.4);expect(library.trace['Renamed outlines'].future_flag).toBe(true)
  await settings(page,'Presets and history');await page.getByRole('combobox',{name:'Preset operation',exact:true}).selectOption('outlines');await page.getByRole('combobox',{name:'Operation preset',exact:true}).selectOption('Renamed outlines');await page.getByRole('button',{name:'Remove preset',exact:true}).click()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-presets')!).trace['Renamed outlines'])).toBeUndefined()
  await page.getByRole('textbox',{name:'Preset name',exact:true}).fill('My complete preparation');await page.locator('.workflow-templates summary').click();await page.getByRole('button',{name:'Save workflow template',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click()
  await settings(page,'Artwork and image cleanup');await page.getByRole('searchbox').fill('trace.tolerance');await page.locator('.setting-reference summary').click();await page.getByRole('spinbutton',{name:'Simplify tolerance (px) · outlines',exact:true}).fill('2');await page.getByRole('button',{name:'Close settings',exact:true}).click();const previous=await saved(page)
  await settings(page,'Presets and history');await page.locator('.workflow-templates summary').click();await page.getByRole('button',{name:'Apply as project copy',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click();const templateCopy=await saved(page)
  expect(templateCopy.stencilStudio.previousProject).toEqual(previous);expect(templateCopy.graph.nodes.find((n:any)=>n.type==='trace').params.tolerance).toBe(.4);expect(templateCopy.images).toEqual(previous.images)
  await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await saved(page)).toEqual(previous)
})

test('named branched import stays connected, unknown fields survive artwork edits, and a full long chain exports',async({page})=>{
  const doc=styleRecipe('fixture','Branches',catalogue);doc.raw.images={fixture:{name:'Colour.png',base64:image.toString('base64')}}
  rawGraph(doc).nodes.push({id:'proof',type:'vector_stencil',params:{width_mm:100},opaque:{keep:[1,false]}});rawGraph(doc).edges.push({from:['outlines','shapes'],to:['proof','shapes'],opaque:'keep'});doc.raw.future={keep:true}
  await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'branches.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc.raw))})
  await page.getByRole('button',{name:'Processing Steps',exact:true}).click();await expect(page.getByRole('combobox',{name:'Processing pass',exact:true}).locator('option')).toHaveCount(2)
  await page.getByRole('combobox',{name:'Processing pass',exact:true}).selectOption('proof');await page.getByRole('textbox',{name:'Pass name',exact:true}).fill('Proof lettering');await page.getByRole('button',{name:'Rename pass',exact:true}).click()
  await page.locator('.step-select').filter({hasText:'Make vector stencil'}).click();await page.getByRole('combobox',{name:'Add before proof',exact:true}).selectOption('round_corners');await page.getByRole('button',{name:'Close settings',exact:true}).click()
  const got=await saved(page);expect(got.graph.nodes.find((n:any)=>n.id==='proof')).toEqual(doc.raw.graph.nodes.find((n:any)=>n.id==='proof'));expect(got.graph.edges.find((e:any)=>e.to[0]==='plate')).toEqual(doc.raw.graph.edges.find((e:any)=>e.to[0]==='plate'));expect(got.future).toEqual(doc.raw.future)
  await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await ready(page);await downloadMesh(page,'branched')
})

test('multiple image instances replace independently, reopen safely and preserve disabled identities',async({page})=>{
  let doc=styleRecipe('first','Independent images',catalogue);doc.raw.images={first:{name:'First.png',base64:image.toString('base64')}};doc=duplicatePass(doc,'plate',catalogue)
  const secondSource=doc.raw.graph.nodes.find((n:any)=>n.type==='source'&&n.id!=='artwork').id
  await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'images.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc.raw))})
  await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('source.image_id');await page.locator('.setting-reference summary').click()
  const replacement=readFileSync(new URL('./corpus/transparent.png',import.meta.url));await page.setInputFiles(`[aria-label="Replace image · ${secondSource}"]`,{name:'Second.png',mimeType:'image/png',buffer:replacement})
  await expect(page.getByRole('combobox',{name:`Image · ${secondSource}`,exact:true})).not.toHaveValue('first')
  await page.getByRole('button',{name:'Close settings',exact:true}).click();const got=await saved(page)
  expect(got.graph.nodes.find((n:any)=>n.id==='artwork').params.image_id).toBe('first');expect(got.images.first).toEqual(doc.raw.images.first);expect(Object.keys(got.images)).toHaveLength(2)
  await page.reload();await expect(page.getByRole('button',{name:'Processing Steps',exact:true})).toBeEnabled();expect(await saved(page)).toEqual(got)
})

test('fourteen real preparation steps keep live output valid, SVGs inspectable, themes accessible and processing local',async({page})=>{
  const step=(id:string,type:string,params={})=>({id,type,params:{...Object.fromEntries(catalogue.find((t:any)=>t.id===type).params.map((p:any)=>[p.name,p.default])),...params}})
  const nodes=[step('input','source',{image_id:'original',resolution:240}),step('frame','transform'),step('reduce','reduce',{colours:3}),step('paint','threshold'),step('soft','smooth',{radius:.25,supersample:1}),step('open','morphology',{op:'open',radius:1}),step('close','morphology',{op:'close',radius:1}),step('trace','trace',{smooth:.3,corner_deg:30}),step('corners','round_corners',{radius:1,max_angle:100}),step('clean','remove_islands',{fill_holes:false,max_area:4}),step('pixels','shapes_to_mask',{resolution:300}),step('soft2','smooth',{radius:.25,supersample:1}),step('outlines','trace',{smooth:.3,corner_deg:30}),step('plate','vector_stencil',{width_mm:100,thickness_mm:2})]
  const edges=nodes.slice(0,-1).map((n,i)=>({from:[n.id,catalogue.find((t:any)=>t.id===n.type).outputs[0].name],to:[nodes[i+1].id,catalogue.find((t:any)=>t.id===nodes[i+1].type).inputs[0].name]}))
  const bytes=readFileSync(new URL('./corpus/simple-logo.svg',import.meta.url)),doc={version:2,graph:{nodes,edges},images:{original:{name:'Original.svg',base64:bytes.toString('base64')}},opaque:{keep:true}}
  mkdirSync('../sandbox/m3',{recursive:true});writeFileSync('../sandbox/m3/long-project.json',JSON.stringify(doc))
  const outside:string[]=[];await page.route('**/*',route=>{const u=route.request().url();if(/^https?:/.test(u)&&!u.startsWith('http://localhost:5199')){outside.push(u);return route.abort()}return route.continue()})
  await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'long.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await ready(page)
  const mesh=await downloadMesh(page,'long-chain');expect(mesh.degenerate_faces).toBe(0)
  await page.getByRole('combobox',{name:'Inspect artwork stage',exact:true}).selectOption('outlines/shapes');await expect(page.locator('.stage-image')).toHaveAttribute('data-ready','true')
  const svgWait=page.waitForEvent('download');await page.getByRole('link',{name:'Save artwork preview',exact:true}).click();const path=resolve('../sandbox/m3/long-outlines.svg');await(await svgWait).saveAs(path);expect(JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8'})).paths).toBeGreaterThan(0)
  await settings(page,'Artwork and image cleanup');await page.getByRole('button',{name:'Cleanup',exact:true}).click()
  for(const mode of ['dark','light']){
    await page.getByRole('button',{name:'Close settings',exact:true}).click();const toggle=page.getByRole('button',{name:`Switch to ${mode} mode`,exact:true});if(await toggle.count())await toggle.click();await settings(page,'Artwork and image cleanup');await page.getByRole('button',{name:'Cleanup',exact:true}).click()
    const axe=await new AxeBuilder({page}).include('.settings-dialog').withTags(['wcag2a','wcag2aa']).analyze();expect(axe.violations.filter(v=>['serious','critical'].includes(v.impact??''))).toEqual([])
  }
  expect(outside).toEqual([]);expect(await page.locator('.react-flow').count()).toBe(0)
  await page.getByRole('button',{name:'Close settings',exact:true}).click();expect(await saved(page)).toEqual(doc)
  mkdirSync('../docs/m3',{recursive:true});writeFileSync('../docs/m3/long-chain-validation.json',JSON.stringify({mesh,steps:nodes.length,external_requests:outside},null,2))
})

test('wide transparent artwork survives repeated rotations, crop panning and undo with identical prepared bytes',async({page})=>{
 const image=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="257"><rect x="120" y="32" width="1100" height="170" fill="black"/><circle cx="2800" cy="128" r="90" fill="#777"/></svg>')
 await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();await page.setInputFiles('[aria-label="Choose image file"]',{name:'wide-transparent.svg',mimeType:'image/svg+xml',buffer:image})
 await page.getByText('Artwork tools',{exact:true}).click();await page.getByRole('button',{name:'Visual crop',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Crop & rotate artwork'}),stage=page.locator('.crop-result .stage-image')
 await expect(stage).toHaveAttribute('data-ready','true')
 const bytes=async()=>page.locator('.crop-result img').evaluate(async e=>Array.from(new Uint8Array(await(await fetch((e as HTMLImageElement).src)).arrayBuffer())))
 const before=await bytes()
 for(let i=0;i<4;i++){await dialog.getByRole('button',{name:'Rotate 90°',exact:true}).click();await expect(stage).toHaveAttribute('data-ready','true')}
 expect(await bytes()).toEqual(before)
 await dialog.getByRole('button',{name:'Pan artwork',exact:true}).click();const surface=(await page.locator('.crop-surface').boundingBox())!,plane=page.locator('.crop-plane'),old=(await plane.boundingBox())!
 await page.mouse.move(surface.x+surface.width/2,surface.y+surface.height/2);await page.mouse.down();await page.mouse.move(surface.x+surface.width/2+30,surface.y+surface.height/2+15);await page.mouse.up();const moved=(await plane.boundingBox())!
 expect(Math.round(moved.x-old.x)).toBe(30);expect(Math.round(moved.y-old.y)).toBe(15)
 await dialog.getByRole('button',{name:'Pan artwork',exact:true}).click();const left=dialog.getByRole('button',{name:'Crop left',exact:true});await left.focus();await page.keyboard.press('ArrowRight');await expect(stage).toHaveAttribute('data-ready','true')
 await dialog.getByRole('button',{name:'Done',exact:true}).click();const after=await saved(page);expect(Buffer.from(Object.values<any>(after.images)[0].base64,'base64')).toEqual(image)
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await saved(page)).toEqual(after)
})
