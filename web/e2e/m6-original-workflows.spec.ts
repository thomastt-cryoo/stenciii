import {test,expect} from '@playwright/test'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {originalWorkflows} from '../src/studio/workflowTemplates'
import {m5Project} from './m5-fixtures'
test.setTimeout(600000)
test.use({actionTimeout:30000})

for(const template of originalWorkflows)test(`original ${template.name} template creates, executes, saves and exports a valid complete workflow`,async({page})=>{
 const base=m5Project('tiles','max_x'),start=Date.now()
 await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'Original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(base))})
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Presets and history',exact:true}).click();await page.getByText('Original workflow templates',{exact:true}).click();await page.getByRole('combobox',{name:'Original workflow template',exact:true}).selectOption(template.id);await page.getByRole('button',{name:'Create workflow project copy',exact:true}).click();await page.getByRole('button',{name:'Close settings',exact:true}).click()
 const raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(raw.stencilStudio.previousProject).toEqual(base);expect(raw.images).toEqual(base.images)
 mkdirSync('../docs/m6/workflows',{recursive:true});writeFileSync(`../docs/m6/workflows/${template.id}.json`,JSON.stringify(raw,null,2))
 await page.getByRole('button',{name:'Make Stencil',exact:true}).click();const parts=['colours','mounted','first'].includes(template.id)
 await expect(page.getByRole('link',{name:parts?'Export ZIP':'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:480000})
 const event=page.waitForEvent('download');await page.getByRole('link',{name:parts?'Export ZIP':'Export STL',exact:true}).click();const file=`../docs/m6/workflows/${template.id}.${parts?'zip':'stl'}`;await(await event).saveAs(file)
 const checked=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',file],{encoding:'utf8',maxBuffer:24000000})),stls=parts?checked.entries.filter((e:any)=>e.name.endsWith('.stl')):[checked];expect(stls.length).toBeGreaterThan(0);expect(stls.every((e:any)=>e.closed_oriented_mesh)).toBe(true)
 writeFileSync(`../docs/m6/workflows/${template.id}-validation.json`,JSON.stringify({elapsedMs:Date.now()-start,independent:checked},null,2))
 await page.reload();await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!))).toEqual(raw)
})

test('shared screw-fit controls are opt-in, scoped, saved, undoable and applied to real hardware output',async({page})=>{
 const doc=m5Project('ring','width');doc.graph.nodes.push({id:'screws',type:'hardware',params:{nut_clearance:.45,tip_taper:.6,tip_pitches:2,segments:24}});doc.graph.edges.push({from:['test','parts'],to:['screws','parts']})
 await page.goto('/');await page.setInputFiles('[aria-label="Open project file"]',{name:'Fit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Screws, connectors and hardware',exact:true}).click();await page.locator('.shared-fit-tools>summary').click();await expect(page.locator('.shared-fit-tools')).toContainText('different saved fit settings');await page.getByRole('combobox',{name:'Shared fit source',exact:true}).selectOption('screws');await page.getByRole('checkbox',{name:'Link screw-fit settings in this project',exact:true}).check()
 let raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(raw.graph.nodes.find((n:any)=>n.id==='test').params.nut_clearance).toBe(.45)
 await page.getByRole('searchbox').fill('ring.nut_clearance');await page.locator('.setting-reference summary').click();await page.getByRole('spinbutton',{name:'Nut thread clearance (mm, radial) · test',exact:true}).fill('.35');await page.getByRole('spinbutton',{name:'Nut thread clearance (mm, radial) · test',exact:true}).blur();await page.getByRole('button',{name:'Close settings',exact:true}).click()
 raw=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(raw.graph.nodes.find((n:any)=>n.id==='screws').params.nut_clearance).toBe(.35);expect(raw.graph.nodes.find((n:any)=>n.id==='mount').params.mount_clearance).toEqual(doc.graph.nodes.find(n=>n.id==='mount')!.params.mount_clearance)
 await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!).graph.nodes.find((n:any)=>n.id==='screws').params.nut_clearance)).toBe(.45);await page.getByRole('button',{name:'Redo',exact:true}).click();await page.reload();await expect(page.getByRole('link',{name:'Export ZIP',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:240000})
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!))).toEqual(raw)
})
