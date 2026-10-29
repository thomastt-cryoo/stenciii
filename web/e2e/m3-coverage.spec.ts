import { expect, test } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { compileRecipe, openDocument } from '../src/studio/project'
import { artworkTypes } from '../src/studio/artwork'
import type { NodeType } from '../src/api'
const catalogue: NodeType[]=JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json',import.meta.url),'utf8'))
const colour=readFileSync(new URL('./corpus/colour-graphic.png',import.meta.url)), second=readFileSync(new URL('./corpus/simple-logo.svg',import.meta.url))
const points = [[4,4],[5,4],[4,5],[12,11],[12,12],[11,11],[18,2],[15,4],[16,4], ...Array.from({length:25},(_,i)=>[2+i%5,12+Math.floor(i/5)])]
const grid=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="white"/>${points.map(([x,y])=>`<rect x="${x}" y="${y}" width="1" height="1"/>`).join('')}</svg>`)
const detail=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="white"/><path d="M20 150L70 20 90 130 130 25 165 145 205 35 225 150Z"/><circle cx="50" cy="130" r="7" fill="white"/><circle cx="120" cy="130" r="3" fill="white"/><circle cx="225" cy="15" r="2"/><circle cx="12" cy="35" r="5"/></svg>')
const changes:Record<string,unknown>={
 'source.image_id':'two','source.resolution':300,'text.text':'AOBR\nAB','text.font':'serif bold','text.size':200,'text.line_spacing':1.5,'text.padding':45,
 'transform.crop_left':12,'transform.crop_top':10,'transform.crop_right':17,'transform.crop_bottom':15,'transform.turn':'90','transform.angle':17,'transform.flip_h':true,'transform.flip_v':true,
 'threshold.threshold':180,'threshold.invert':true,'reduce.colours':5,'reduce.smooth':2,'smooth.radius':.25,'smooth.supersample':1,
 'morphology.op':'dilate','morphology.kernel':'square','morphology.radius':3,'morphology.angle':45,'morphology.iterations':2,'morphology.pattern':'isolated','morphology.custom':'111 111 111','morphology.rotate':false,
 'trace.smooth':0,'trace.corner_deg':150,'trace.tolerance':2.5,'trace.min_area':300,'round_corners.max_angle':140,'round_corners.radius':10,'round_corners.round_concave':true,
 'remove_islands.delete_specks':false,'remove_islands.fill_holes':false,'remove_islands.max_area':300,'remove_islands.keep_largest':1,'shapes_to_mask.resolution':300,
}
function project(type:string,key:string){
 const step=(id:string,type:string,params={})=>({id,type,params:{...Object.fromEntries(catalogue.find(t=>t.id===type)!.params.map(p=>[p.name,p.default])),...params}})
 const source=step('input','source',{image_id:'one',resolution:type==='morphology'?20:200}),paint=step('paint','threshold'),trace=step('trace','trace'),target=step('test',type),plate=step('plate',['source','transform','reduce','threshold','smooth','morphology','text','shapes_to_mask'].includes(type)?'stencil':'vector_stencil',{width_mm:100,thickness_mm:2})
 let nodes:any[]
 if(type==='source')nodes=[{...source,id:'test'},paint,plate]
 else if(type==='text')nodes=[target,plate]
 else if(['transform','reduce'].includes(type))nodes=[source,target,paint,plate]
 else if(type==='threshold')nodes=[source,target,plate]
 else if(['smooth','morphology'].includes(type))nodes=[source,paint,target,plate]
 else if(type==='trace')nodes=[source,paint,target,plate]
 else nodes=[source,paint,trace,target,plate]
 if(type==='morphology'){
   if(key==='angle')target.params.kernel='line'
   if(['pattern','custom','rotate'].includes(key))target.params.op='hit_or_miss'
   if(['custom','rotate'].includes(key))target.params.pattern='custom'
 }
 if(type==='text')target.params.text='AOBR\nSTENCIL'
 if(type==='round_corners'){trace.params.smooth=0;trace.params.corner_deg=20;trace.params.tolerance=2;if(['radius','round_concave'].includes(key))target.params.max_angle=140}
 const edges=nodes.slice(0,-1).map((n,i)=>{const port=catalogue.find(t=>t.id===n.type)!.outputs[0].name;return{from:[n.id,port],to:[nodes[i+1].id,catalogue.find(t=>t.id===nodes[i+1].type)!.inputs[0].name]}})
 const bytes=type==='morphology'?grid:['trace','round_corners','remove_islands','shapes_to_mask'].includes(type)?detail:colour
 return {version:2,graph:{nodes,edges},images:{one:{name:type==='morphology'?'Pattern.svg':bytes===colour?'Colour.png':'Corners.svg',base64:bytes.toString('base64')},two:{name:'Logo.svg',base64:second.toString('base64')}},stencilStudio:{name:'Coverage'}}
}
test('all 41 controls change saved execution parameters, reset to runtime defaults and execute real intermediate output',async({page})=>{
 test.setTimeout(600_000);mkdirSync('../docs/m5/replay/m4',{recursive:true});await page.goto('/')
 await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 const rows:any[]=[]
 const fingerprint=async(raw:any,type:string)=>{
   const graph=compileRecipe(openDocument(raw)),port=catalogue.find(t=>t.id===type)!.outputs[0].name
   const workerUrl=page.workers().find(w=>w.url().includes('engine.worker'))?.url();expect(workerUrl).toBeTruthy()
   return page.evaluate(async({graph,images,port,workerUrl})=>{
     const worker=new Worker(workerUrl!,{type:'module',name:'artwork-preview'}),pending=new Map<number,any>();let seq=0
     worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p||e.data.step)return;pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
     const call=(message:any)=>new Promise<any>((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});worker.postMessage({id,...message})})
     try{
       const remap=new Map<string,string>()
       for(const[id,asset]of Object.entries<any>(images)){const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));const got=await call({op:'image',bytes:bytes.buffer});remap.set(id,got.id)}
       for(const n of graph.nodes)if(n.type==='source')n.params.image_id=remap.get(String(n.params.image_id))
       const artifact=await call({op:'inspect',graph:JSON.stringify(graph),target:'test',out:port})
       const digest=await crypto.subtle.digest('SHA-256',artifact.bytes)
       let data='';for(let i=0;i<artifact.bytes.length;i+=0x8000)data+=String.fromCharCode(...artifact.bytes.subarray(i,i+0x8000))
       return {sha256:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),info:artifact.info,mime:artifact.mime,base64:btoa(data)}
     }finally{worker.terminate()}
   },{graph,images:raw.images,port,workerUrl})
 }
 for(const type of artworkTypes)for(const parameter of catalogue.find(t=>t.id===type)!.params){
   const key=`${type}.${parameter.name}`,doc=project(type,parameter.name)
   await page.setInputFiles('[aria-label="Open project file"]',{name:'coverage.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
   await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled()
   await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!).graph.nodes.some((n:any)=>n.id==='test'))).toBe(true)
   const before=await fingerprint(doc,type)
   await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill(key);await page.locator('.setting-reference summary').click()
   const label=`${parameter.label} · test`,value=changes[key]
   if(parameter.kind==='bool')await page.getByRole('checkbox',{name:label,exact:true}).setChecked(Boolean(value))
   else if(parameter.kind==='choice'||parameter.name==='image_id')await page.getByRole('combobox',{name:label,exact:true}).selectOption(String(value))
   else if(['int','float'].includes(parameter.kind))await page.getByRole('spinbutton',{name:label,exact:true}).fill(String(value))
   else await page.getByRole('textbox',{name:label,exact:true}).fill(String(value))
   let changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(changed.graph.nodes.find((n:any)=>n.id==='test').params[parameter.name]).toEqual(value)
   const after=await fingerprint(changed,type)
   mkdirSync('../docs/m5/replay/m4/examples',{recursive:true})
   if(!rows.some(r=>r.key.startsWith(`${type}.`)))for(const[label,artifact]of [['before',before],['after',after]]as const)writeFileSync(`../docs/m5/replay/m4/examples/${type}-${label}.${artifact.mime.includes('svg')?'svg':'png'}`,Buffer.from(artifact.base64,'base64'))
   delete (before as any).base64;delete (after as any).base64
   await page.getByRole('button',{name:`Reset ${label}`,exact:true}).click()
   changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(changed.graph.nodes.find((n:any)=>n.id==='test').params[parameter.name]).toEqual(parameter.default)
   await page.getByRole('button',{name:'Close settings',exact:true}).click()
   expect(changed.images).toEqual(doc.images)
   rows.push({key,changed_to:value,reset_to:parameter.default,before,after,output_changed:before.sha256!==after.sha256})
   writeFileSync('../docs/m5/replay/m4/artwork-coverage.json',JSON.stringify({scoped_slots:rows.length,cases:rows},null,2))
 }
 expect(rows).toHaveLength(41)
 // Every scoped field has a suitable fixture proving a real PNG/SVG change.
 for(const row of rows)expect(row.output_changed,row.key).toBe(true)
})
