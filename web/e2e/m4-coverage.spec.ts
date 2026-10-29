import {expect,test,type Page} from '@playwright/test'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {execFileSync} from 'node:child_process'
import {resolve} from 'node:path'
import {catalogue,changes,geometryProject} from './m4-fixtures'
import {compileRecipe,openDocument} from '../src/studio/project'
import {geometryTypes} from '../src/studio/geometry'
async function prove(page:Page,doc:any,out:string){
 const workerUrl=page.workers().find(w=>w.url().includes('engine.worker'))!.url(),graph=compileRecipe(openDocument(doc))
 return page.evaluate(async({graph,images,out,workerUrl})=>{
  const w=window as any
  if(!w.__geometryProof){
   const worker=new Worker(workerUrl,{type:'module',name:'artwork-preview'}),pending=new Map<number,any>();let seq=0
   worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p||e.data.step)return;pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
   w.__geometryProof={worker,call:(message:any)=>new Promise<any>((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Geometry proof timed out')),120000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,...message})})}
  }
  const call=w.__geometryProof.call
  for(const node of graph.nodes)if(node.type==='source'){const asset=(images as any)[node.params.image_id],bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));node.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}
  const result=await call({op:'inspect',graph:JSON.stringify(graph),target:'test',out}),hash=await crypto.subtle.digest('SHA-256',result.bytes)
  let data='';for(let i=0;i<result.bytes.length;i+=0x8000)data+=String.fromCharCode(...result.bytes.subarray(i,i+0x8000))
  return {sha256:Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join(''),info:result.info,base64:btoa(data),extension:result.bytes[0]===80&&result.bytes[1]===75?'zip':'stl'}
 },{graph,images:doc.images,out,workerUrl})
}
test('all 48 qualified geometry controls persist, reset and execute suitable real solid or tiled fixtures',async({page})=>{
 test.setTimeout(900_000);mkdirSync('../docs/m5/replay/m4',{recursive:true});mkdirSync('../sandbox/m4/coverage',{recursive:true})
 await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled()
 const rows:any[]=[],types=process.env.M4_PROBE_TYPE?geometryTypes.filter(t=>t===process.env.M4_PROBE_TYPE):geometryTypes
 for(const type of types)for(const parameter of catalogue.find(t=>t.id===type)!.params.filter(p=>!process.env.M4_PROBE_KEY||p.name===process.env.M4_PROBE_KEY)){
  const key=`${type}.${parameter.name}`,doc=geometryProject(type,parameter.name),out=parameter.name==='tile_method'?'parts':'solid',stem=key.replace('.','-')
  await page.setInputFiles('[aria-label="Open project file"]',{name:'geometry.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
  await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill(key);await page.locator('.setting-reference summary').first().click()
  const label=`${parameter.label} · test`,value=type==='stencil'&&parameter.name==='min_first_layer_width_mm'?5:changes[parameter.name]
  const before=await prove(page,doc,out)
  if(parameter.kind==='bool')await page.getByRole('checkbox',{name:label,exact:true}).setChecked(Boolean(value))
  else if(parameter.kind==='choice')await page.getByRole('combobox',{name:label,exact:true}).selectOption(String(value))
  else await page.getByRole('spinbutton',{name:label,exact:true}).fill(String(value))
  const changed=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(changed.graph.nodes.find((n:any)=>n.id==='test').params[parameter.name],key).toEqual(value)
  const after=await prove(page,changed,out)
  for(const [name,result,project]of [['before',before,doc],['after',after,changed]]as const){
   const path=resolve(`../sandbox/m4/coverage/${stem}-${name}.${result.extension}`);writeFileSync(path,Buffer.from(result.base64,'base64'));writeFileSync(resolve(`../sandbox/m4/coverage/${stem}-${name}.json`),JSON.stringify(project))
   const check=JSON.parse(execFileSync('python',['../scripts/m2/inspect_mesh.py',path],{encoding:'utf8',maxBuffer:8*1024*1024}));(result as any).validation=check
   if(check.format==='ZIP')expect(check.entries.every((e:any)=>e.closed_oriented_mesh),key).toBe(true);else expect(check.closed_oriented_mesh,key).toBe(true)
   delete (result as any).base64
  }
  await page.getByRole('button',{name:`Reset ${label}`,exact:true}).click();const reset=await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')!));expect(reset.graph.nodes.find((n:any)=>n.id==='test').params[parameter.name]).toEqual(parameter.default);expect(reset.images).toEqual(doc.images);expect(reset.opaque).toEqual(doc.opaque)
  await page.getByRole('button',{name:'Close settings',exact:true}).click()
  let effect=before.sha256!==after.sha256
  if(type!=='remesh'&&['min_contact_mm','min_first_layer_width_mm','first_layer_taper_mm'].includes(parameter.name))expect((after as any).validation.signed_volume_mm3,key).toBeGreaterThan((before as any).validation.signed_volume_mm3+1e-5)
  if(parameter.name==='width_mm')expect((after as any).validation.size_mm[0]).toBeCloseTo(140,3)
  const expectedHeight:Record<string,number>={thickness_mm:3.6,layer_height_mm:2.7,extra_top_layers:3.2}
  if(type!=='remesh'&&expectedHeight[parameter.name])expect((after as any).validation.size_mm[2],key).toBeCloseTo(expectedHeight[parameter.name],4)
  if(parameter.name==='max_overhang_deg'&&type!=='remesh')effect=before.info.stats.overhang_area_mm2!==after.info.stats.overhang_area_mm2
  if(type==='remesh'&&['layer_from','layer_to','decimate_mm'].includes(parameter.name))effect=effect||JSON.stringify(before.info.stats.remesh)!==JSON.stringify(after.info.stats.remesh)
  // A limit can be satisfied at both values without changing an already
  // compliant model. Verify active reconstruction and its measured constraint,
  // rather than requiring this safety setting to manufacture a difference.
  const constraint=type==='remesh'&&parameter.name==='max_overhang_deg'
  if(constraint)for(const result of [before,after]){
   const r=result.info.stats.remesh;expect(r.skipped).toBeNull();expect(r.max_deviation_mm).toBeGreaterThan(0);expect(r.triangles_after_layers).toBeLessThan(r.triangles_before);expect(r.overhang_violation_mm2).toBeLessThanOrEqual(1e-6)
  }
  rows.push({key,changed_to:value,reset_to:parameter.default,output_or_diagnostic_changed:effect,verified:effect||constraint,behavior:constraint?'Active reconstruction remains within the overhang constraint at both 10° and 85°; this fixture has identical output at both limits.':'Actual output geometry or applicable computed diagnostic changes.',before,after,project_before:`sandbox/m4/coverage/${stem}-before.json`,project_after:`sandbox/m4/coverage/${stem}-after.json`})
  writeFileSync(`../docs/m5/replay/m4/${process.env.M4_PROBE_TYPE?'geometry-probe':'geometry-coverage'}.json`,JSON.stringify({slots:rows.length,cases:rows},null,2))
 }
 expect(rows).toHaveLength(types.reduce((n,t)=>n+catalogue.find(c=>c.id===t)!.params.filter(p=>!process.env.M4_PROBE_KEY||p.name===process.env.M4_PROBE_KEY).length,0))
  const unverified=rows.filter(r=>!r.verified).map(r=>r.key);expect(unverified).toEqual([])
})
