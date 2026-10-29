import {expect,test} from '@playwright/test'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {catalogue,coloursSvg,m5Project} from './m5-fixtures'
import {addColourAnalysis,createColourLayers,addToneWorkflow} from '../src/studio/manufacturing'
import {openDocument,operations,saveDocument,ProjectCommands} from '../src/studio/project'
import {validateRecipe} from '../src/studio/artwork'
import {prove} from './m5-proof'

test('guided colour branches preserve raw originals, all ten layers, registration groups, history and unknown data',()=>{
 const original=openDocument(m5Project('tone_patterns','kind')),analysed=addColourAnalysis(original,['source','image'],10,catalogue),result=createColourLayers(analysed.doc,analysed.split,Array.from({length:10},(_,i)=>`#${i}`),true,catalogue)
 expect(original.raw).toEqual(m5Project('tone_patterns','kind'));expect(result.raw.images).toEqual(original.raw.images);expect(result.raw.opaque).toEqual(original.raw.opaque)
 for(const op of original.raw.graph.nodes)expect(result.raw.graph.nodes.find((n:any)=>n.id===op.id)).toEqual(op)
 expect(result.raw.stencilStudio.colourLayers).toHaveLength(10);expect(result.raw.stencilStudio.colourAssemblies.map((g:any)=>g.layers.length)).toEqual([6,4]);validateRecipe(result,catalogue)
 const history=new ProjectCommands();history.reset(original);history.apply('Colour layers',()=>result);history.undo();expect(history.current).toEqual(original);history.redo();expect(history.current).toEqual(result);expect(openDocument(JSON.parse(saveDocument(result)))).toEqual(result)
 const toned=addToneWorkflow(result,['source','image'],catalogue);expect(operations(toned).filter(o=>o.type==='tone_patterns')).toHaveLength(2);expect(toned.raw.images).toEqual(original.raw.images)
})

test('registration rejects unequal dimensions and holes outside margins; actual tone groups become inactive',async({page})=>{
 test.setTimeout(180_000);await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 const solidTones=m5Project('tone_patterns','spacing_mm');solidTones.graph.nodes.find(n=>n.id==='test')!.params.spacing_mm=0;expect((await prove(page,solidTones,'test','mask')).info.coverage).toBeCloseTo(.9,3)
 const wrongSize=m5Project('colour_set','holes');wrongSize.graph.nodes.find(n=>n.id==='plate-2')!.params.width_mm=120
 await expect(prove(page,wrongSize,'test','parts')).rejects.toThrow(/same plate width and margin/)
 const wrongMargin=m5Project('colour_set','holes');wrongMargin.graph.nodes.find(n=>n.id==='plate-1')!.params.margin_mm=2
 await expect(prove(page,wrongMargin,'test','parts')).rejects.toThrow(/raise the margin|smaller hole/)
 const doc=m5Project('tone_patterns','kind');doc.graph.nodes.unshift({id:'reduced',type:'reduce',params:{colours:2,smooth:0}});doc.graph.edges=[{from:['source','image'],to:['reduced','image']},{from:['reduced','image'],to:['test','image']}]
 await page.setInputFiles('[aria-label="Open project file"]',{name:'two-tones.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Colours and layers',exact:true}).click();await expect(page.locator('.manufacturing-editor')).toHaveAttribute('data-tone-count','2',{timeout:90000});await page.locator('.geometry-group').filter({hasText:'Tone 8'}).locator('summary').click();await expect(page.locator('[data-parameter="tone_patterns.kind_8"] select')).toBeDisabled()
})

test('real guided ten-colour creation, six/four registration groups, independent plate export, names and visibility survive reopen',async({page})=>{
 test.setTimeout(240_000);mkdirSync('../docs/m5/screenshots',{recursive:true});mkdirSync('../sandbox/m5/a',{recursive:true});await page.setViewportSize({width:1440,height:1000});await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 await page.setInputFiles('[aria-label="Choose image file"]',{name:'ten-colours.svg',mimeType:'image/svg+xml',buffer:Buffer.from(coloursSvg)});await expect(page.getByRole('button',{name:'Make Stencil',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!))
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Colours and layers',exact:true}).click();await page.locator('.manufacturing-guide summary').click();await page.getByRole('spinbutton',{name:'Maximum separated colours',exact:true}).fill('10');await page.getByRole('button',{name:'Analyse colours',exact:true}).click();await expect(page.getByText(/^10 actual colours found:/)).toBeVisible({timeout:90000});await page.screenshot({path:'../docs/m5/screenshots/a01-colour-analysis-light.png',fullPage:true});await page.getByRole('button',{name:'Create colour layers',exact:true}).click()
 const created=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(created.stencilStudio.colourLayers).toHaveLength(10);expect(created.stencilStudio.colourAssemblies.map((a:any)=>a.layers.length)).toEqual([6,4]);expect(created.images).toEqual(before.images)
 await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000});await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true');await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true');await page.screenshot({path:'../docs/m5/screenshots/a02-registered-plate-dark.png',fullPage:true})
 const download=page.waitForEvent('download');await page.getByRole('link',{name:'Save this STL',exact:true}).click();const path=resolve('../sandbox/m5/a/registered-colour.stl');await(await download).saveAs(path);const validation=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8'}));expect(validation.closed_oriented_mesh).toBe(true)
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('navigation',{name:'Settings categories'}).getByRole('button',{name:'Colours and layers',exact:true}).click();await page.getByText('Colour layers · 10',{exact:true}).click();const layer=created.stencilStudio.colourLayers[0];await page.getByRole('textbox',{name:`Name ${layer.plate}`,exact:true}).fill('Ink black');await page.getByRole('checkbox',{name:`Show ${layer.plate}`,exact:true}).uncheck();await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.reload();await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000});const reopened=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(reopened.stencilStudio.colourLayers[0]).toMatchObject({name:'Ink black',visible:false});expect(reopened.images).toEqual(before.images)
 mkdirSync('../docs/m5/examples',{recursive:true});writeFileSync('../docs/m5/examples/ten-colour-project.json',JSON.stringify(reopened,null,2));writeFileSync('../docs/m5/a-guide-validation.json',JSON.stringify({layers:10,registration_group_sizes:[6,4],registered_stl:validation,original_images_preserved:true,round_trip:true},null,2))
})
