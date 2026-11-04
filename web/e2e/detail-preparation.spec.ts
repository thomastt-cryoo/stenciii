import {test,expect,type Page} from '@playwright/test'
import {readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {prepareFineArtwork,cleanTinyMarks} from '../src/studio/detailPreparation'
import {openDocument,quickRecipe} from '../src/studio/project'

const source=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700"><rect width="700" height="700" fill="white"/><path d="M100 320 Q350 80 600 320 L350 160 Z" fill="black"/><path d="M110 420 Q350 310 590 440 L160 450 Z" fill="black"/><circle cx="330" cy="500" r="16"/><circle cx="390" cy="500" r="16"/><circle cx="40" cy="40" r="1"/><circle cx="80" cy="60" r="2"/></svg>')
const ready=(page:Page)=>expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
async function saved(page:Page){const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Save Project',exact:true}).click()]);return JSON.parse(readFileSync((await d.path())!,'utf8'))}
async function open(page:Page){await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();await page.setInputFiles('[aria-label="Choose image file"]',{name:'fine-whiskers.svg',mimeType:'image/svg+xml',buffer:source});await page.getByRole('combobox',{name:'Stencil style',exact:true}).selectOption('smooth');await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await ready(page)}

test('fine preparation keeps artwork/print dimensions, is undoable, saves and produces a closed export',async({page},info)=>{
 test.setTimeout(240000);await open(page)
 const before=await saved(page),original=openDocument(before),old=quickRecipe(original)!
 await page.locator('.fine-artwork-tools>summary').click();await page.getByRole('button',{name:'Preserve fine detail',exact:true}).click();await ready(page)
 const after=await saved(page),next=quickRecipe(openDocument(after))!
 expect(after.images).toEqual(before.images);expect(next.build.params.width_mm).toBe(old.build.params.width_mm)
 expect(next.build.params.bridge_mm).toBe(old.build.params.bridge_mm);expect(next.build.params.thickness_mm).toBe(old.build.params.thickness_mm)
 expect(next.source.params.resolution).toBe(1400);expect(next.smoothing?.params.supersample).toBe(1)
 expect(next.cleanup?.params).toMatchObject({delete_specks:true,fill_holes:true,keep_largest:0})
 const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Export STL',exact:true}).click()]);const path=info.outputPath('fine.stl');await d.saveAs(path)
 const mesh=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8'}));expect(mesh.closed_oriented_mesh).toBe(true);expect(mesh.components).toBe(1)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await saved(page)).toEqual(before)
 await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await saved(page)).toEqual(after)
 await page.getByRole('checkbox',{name:'Remove tiny marks',exact:true}).uncheck();const off=await saved(page)
 expect(quickRecipe(openDocument(off))?.cleanup?.params).toMatchObject({delete_specks:false,fill_holes:false,max_area:64})
 await page.setInputFiles('[aria-label="Open project file"]',{name:'fine.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(after))});await ready(page);expect(await saved(page)).toEqual(after)
 const metadata=structuredClone(after);metadata.opaque={keep:['unknown',123]};const prepared=prepareFineArtwork(openDocument(metadata));expect(prepared.raw.opaque).toEqual(metadata.opaque)
 const noCleanup=openDocument(before),q=quickRecipe(noCleanup)!,g=noCleanup.raw.graph;g.nodes=g.nodes.filter((n:any)=>n.id!==q.cleanup!.id);g.edges=g.edges.filter((e:any)=>![e.from[0],e.to[0]].includes(q.cleanup!.id));g.edges.push({from:[q.trace!.id,'shapes'],to:[q.build.id,'shapes']})
 expect(quickRecipe(prepareFineArtwork(noCleanup))?.cleanup?.type).toBe('remove_islands')
 const custom=openDocument(after);custom.raw.graph.nodes.push({id:'unrelated',type:'source',params:{}});expect(()=>prepareFineArtwork(custom)).toThrow();expect(()=>cleanTinyMarks(custom,true)).toThrow()
})

test('left settings stays alongside the canvas, supports inspection and fits narrow windows',async({page},info)=>{
 test.setTimeout(180000);await page.setViewportSize({width:1600,height:1000});await open(page)
 await page.getByRole('button',{name:'All Settings',exact:true}).click()
 const panel=page.getByRole('region',{name:'All Settings',exact:true});await expect(panel).toBeVisible();expect(await page.locator('dialog[open]').count()).toBe(0)
 const left=await panel.boundingBox(),canvas=await page.locator('.preview-surface').boundingBox();expect(left!.x+left!.width).toBeLessThanOrEqual(canvas!.x);expect(canvas!.width).toBeGreaterThan(450)
 await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true');await expect(panel).toBeVisible()
 await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Processing steps',exact:true}).click()
 await expect(panel).toContainText('Processing steps');await page.screenshot({path:info.outputPath('settings-left.png'),fullPage:true})
 for(const width of [1100,850,390]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(panel).toBeVisible()}
 await page.setViewportSize({width:1600,height:1000});await panel.getByRole('searchbox').fill('trace.tolerance');await expect(panel).toContainText('Simplify tolerance')
 await page.keyboard.press('Escape');await expect(panel).toHaveCount(0)
})
