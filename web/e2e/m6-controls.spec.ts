import {test,expect,type Page} from '@playwright/test'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {catalogue,m5Project,changesA,changesB,changesC,changesD} from './m5-fixtures'
import {geometryProject,changes as geometryChanges} from './m4-fixtures'
import {artworkProject,artworkChanges} from './m6-artwork-fixtures'
import {prove} from './m5-proof'
import {ParameterRegistry} from '../src/studio/registry'
import type {ParamDef} from '../src/api'
test.setTimeout(1200000);test.use({actionTimeout:30000})
const registry=new ParameterRegistry(catalogue),artwork=new Set(['source','text','transform','threshold','reduce','smooth','morphology','trace','round_corners','remove_islands','shapes_to_mask']),geometry=new Set(['stencil','vector_stencil','remesh'])
const read=(page:Page)=>page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!))
const rawValue=(raw:any,key:string)=>raw.graph.nodes.find((n:any)=>n.id==='test').params[key]
async function openControl(page:Page,key:string){await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill(key);await page.locator('.setting-reference summary').first().click()}
async function edit(page:Page,p:ParamDef,value:unknown){
 const label=`${p.label} · test`
 if(p.kind==='bool')await page.getByRole('checkbox',{name:label,exact:true}).setChecked(Boolean(value))
 else if(p.kind==='choice'||p.name==='image_id')await page.getByRole('combobox',{name:label,exact:true}).selectOption(String(value))
 else if(['int','float'].includes(p.kind)){const input=page.getByRole('spinbutton',{name:label,exact:true});await input.fill(String(value));await input.blur()}
 else if(p.name==='edits'){await page.locator('.saved-layout-offsets summary').click();await page.getByRole('textbox',{name:label,exact:true}).fill(String(value));await page.getByRole('button',{name:'Apply saved offsets',exact:true}).click()}
 else{const input=page.getByRole('textbox',{name:label,exact:true});await input.fill(String(value));await input.blur()}
}
function fixture(type:string,key:string){const doc=artwork.has(type)?artworkProject(type,key):geometry.has(type)?geometryProject(type,key):m5Project(type,key);if(['tile_layout','tiles'].includes(type)&&key==='connector_d')doc.graph.nodes.find((n:any)=>['stencil','vector_stencil'].includes(n.type))!.params.thickness_mm=10;return doc}
function changed(type:string,key:string){return artwork.has(type)?artworkChanges[`${type}.${key}`]:geometry.has(type)?geometryChanges[key]:(['split_colours','tone_patterns','colour_set'].includes(type)?changesA:['tile_layout','tiles','fragments'].includes(type)?changesB:['pads','ring','hardware'].includes(type)?changesC:changesD)[key]}
function port(type:string,key:string){return type==='tile_layout'?{target:'built',out:'parts'}:type==='split_colours'?{target:'test',out:key==='colours'?'palette':'colour_1'}:type==='tone_patterns'?{target:'test',out:'mask'}:geometry.has(type)?{target:'test',out:key==='tile_method'?'parts':'solid'}:{target:'test',out:catalogue.find(t=>t.id===type)!.outputs[0].name}}

for(const type of catalogue)test(`M6 ${type.id}: every parameter control, every allowed choice, scope, bounds, undo/redo and saved-file reopen`,async({page})=>{
 const rows:any[]=[];mkdirSync('../docs/m6/controls',{recursive:true});mkdirSync(`../sandbox/m6/controls/${type.id}`,{recursive:true});await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 for(const p of type.params){
  const key=`${type.id}.${p.name}`,raw=fixture(type.id,p.name),initial=rawValue(raw,p.name),value=changed(type.id,p.name),row:any={key,schema:p,initial,changed:value,choices:[],scope:true,reset:false,undo:false,redo:false,reopened:false,outputs:[]}
  expect(value,key).toBeDefined();registry.validate(type.id,p.name,value)
  await page.setInputFiles('[aria-label="Open project file"]',{name:'Parameter.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(raw))});await expect.poll(async()=>JSON.stringify((await read(page)).graph)).toBe(JSON.stringify(raw.graph));await openControl(page,key)
  const label=`${p.label} · test`,control=page.getByRole(p.kind==='bool'?'checkbox':p.kind==='choice'||p.name==='image_id'?'combobox':['int','float'].includes(p.kind)?'spinbutton':'textbox',{name:label,exact:true})
  if(p.name==='edits')await page.locator('.saved-layout-offsets summary').click()
  await expect(control,key).toBeVisible();await expect(control,key).toBeEnabled()
  if(['int','float'].includes(p.kind)){
   for(const attribute of ['min','max','step']as const)await expect(control,key).toHaveAttribute(attribute,String(p[attribute]))
   for(const bad of [Number(p.min)-Number(p.step),Number(p.max)+Number(p.step)]){await control.fill(String(bad));await control.blur();expect(rawValue(await read(page),p.name),key).toEqual(initial)}
  }
  if(p.choices){expect(await control.locator('option').evaluateAll(options=>options.map(o=>(o as HTMLOptionElement).value))).toEqual(p.choices);for(const choice of p.choices){await edit(page,p,choice);expect(rawValue(await read(page),p.name),key).toEqual(choice);row.choices.push(choice)}}
  if(p.name==='edits')await page.locator('.saved-layout-offsets summary').click()
  await edit(page,p,value);let saved=await read(page);expect(rawValue(saved,p.name),key).toEqual(value)
  const scoped=structuredClone(saved);scoped.graph.nodes.find((n:any)=>n.id==='test').params[p.name]=initial;expect(scoped,key).toEqual(raw)
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();const undone=await read(page);expect(rawValue(undone,p.name),key).not.toEqual(value);row.undo=true;await page.getByRole('button',{name:'Redo',exact:true}).click();expect(await read(page),key).toEqual(saved);row.redo=true
  await openControl(page,key);await page.getByRole('button',{name:`Reset ${label}`,exact:true}).click();expect(rawValue(await read(page),p.name),key).toEqual(p.default);row.reset=true;await page.getByRole('button',{name:'Close settings',exact:true}).click()
  if(value!==p.default){await page.getByRole('button',{name:'Undo',exact:true}).click();expect(await read(page),key).toEqual(saved)}
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project',exact:true}).click();const path=(await(await download).path())!,reopened=JSON.parse(readFileSync(path,'utf8'));expect(reopened,key).toEqual(saved)
  await page.setInputFiles('[aria-label="Open project file"]',path);await expect.poll(()=>read(page)).toEqual(saved);row.reopened=true
  const variations=p.choices??[value]
  for(const choice of variations){
   const executed=structuredClone(saved);executed.graph.nodes.find((n:any)=>n.id==='test').params[p.name]=choice
   const stem=`../sandbox/m6/controls/${type.id}/${p.name}-${row.outputs.length}`,target=port(type.id,p.name);writeFileSync(stem+'.json',JSON.stringify(executed));let artifact:any
   try{artifact=await prove(page,executed,target.target,target.out)}catch(error){const message=String(error);const known=(type.id==='tiles'&&p.name==='reinforce'&&/no room/.test(message))||(['export','pads'].includes(type.id)&&/no room for a connector hole on|the margin is [\d.]+ mm but a M\d+ pad is/.test(message));expect(known,`${key}=${choice}: ${message}`).toBe(true);row.outputs.push({value:choice,diagnostic:message,verified:true});continue}
   const file=stem+'.'+artifact.extension;writeFileSync(file,Buffer.from(artifact.base64,'base64'));delete artifact.base64
   const independent=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',file],{encoding:'utf8',maxBuffer:24000000}));if(artifact.extension==='stl')expect(independent.closed_oriented_mesh,`${key}=${choice}`).toBe(true);if(artifact.extension==='zip')expect(independent.entries.filter((e:any)=>e.name.endsWith('.stl')).every((e:any)=>e.closed_oriented_mesh),`${key}=${choice}`).toBe(true)
   row.outputs.push({value:choice,...artifact,independent,verified:true,project:stem.slice(3)+'.json'})
  }
  row.verified=row.reset&&row.undo&&row.redo&&row.reopened&&row.outputs.every((r:any)=>r.verified);rows.push(row);writeFileSync(`../docs/m6/controls/${type.id}.json`,JSON.stringify({type:type.id,slots:rows.length,cases:rows},null,2))
 }
 expect(rows).toHaveLength(type.params.length);expect(rows.every(r=>r.verified)).toBe(true)
})
