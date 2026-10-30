import {ArtworkPreviewClient} from './artworkPreview'
import {compileRecipe,projectName,type ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'
import type {ArtifactSet,PartArtifact,MeshCheck} from './artifacts'
import {meshProblems,partMeshProblems} from './meshAudit'
import {badgesFor,type Badge} from '../badges'
import {crc32,PACKAGE_LIMIT} from './zip'
import {buildExportPackage,makeExportPlan,safeSegment} from './exportPlan'
import {jobDocument,csvCell,type BatchJob,type BatchOptions} from './batchPlan'

export function storedBatchEntries(bytes:ArrayBuffer){
 const v=new DataView(bytes),all=new Uint8Array(bytes),result:{name:string;bytes:ArrayBuffer}[]=[],seen=new Set<string>();let pos=0
 while(pos+4<=bytes.byteLength&&v.getUint32(pos,true)===0x04034b50){
  if(pos+30>bytes.byteLength||v.getUint16(pos+8,true)!==0||v.getUint16(pos+6,true)&8)throw Error('Unsupported engine ZIP encoding.')
  const size=v.getUint32(pos+18,true),length=v.getUint16(pos+26,true),extra=v.getUint16(pos+28,true),start=pos+30+length+extra,end=start+size
  if(end>bytes.byteLength)throw Error('Incomplete engine ZIP.')
  const name=new TextDecoder('utf-8',{fatal:true}).decode(all.subarray(pos+30,pos+30+length)),body=bytes.slice(start,end)
  if(!name||name.startsWith('/')||name.includes('\\')||name.split('/').some(p=>!p||p==='.'||p==='..')||seen.has(name))throw Error('Unsafe or duplicate engine ZIP entry.')
  if(crc32(new Uint8Array(body))!==v.getUint32(pos+14,true))throw Error('Engine ZIP CRC mismatch.')
  seen.add(name);result.push({name,bytes:body});pos=end
 }
 if(!result.length||pos+4>bytes.byteLength||![0x02014b50,0x06054b50].includes(v.getUint32(pos,true)))throw Error('Incomplete engine ZIP directory.')
 return result
}
class BatchAudit{
 private worker=new Worker(new URL('./meshAudit.worker.ts',import.meta.url),{type:'module',name:'batch-geometry-check'})
 private seq=0;private pending=new Map<number,{resolve:(m:MeshCheck)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>()
 constructor(){this.worker.onmessage=e=>{const p=this.pending.get(e.data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)};this.worker.onerror=()=>this.close()}
 check(bytes:ArrayBuffer){const id=++this.seq;return new Promise<MeshCheck>((resolve,reject)=>{const timer=setTimeout(()=>this.close(),120000);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({id,bytes},[bytes])})}
 close(){this.worker.terminate();this.pending.forEach(p=>{clearTimeout(p.timer);p.reject(Error('Batch geometry check stopped or exceeded its time budget.'))});this.pending.clear()}
}
export interface BatchMetrics {triangles:number;components:number;volumeMm3:number;sizeMm:number[];stlFiles:number;seamStepMm:number|null;paintUnderBlocksMm2:number|null;bytes:number}
export interface BatchResult {bytes:ArrayBuffer;extension:'zip'|'stl';manifest:any;metrics:BatchMetrics;findings:Badge[]}
export interface BatchRow {id:string;name:string;relativePath:string;overrides:BatchJob['overrides'];status:'Queued'|'Processing'|'Verified'|'Failed'|'Cancelled';error?:string;url?:string;downloadName?:string;milliseconds?:number;metrics?:BatchMetrics;findings?:Badge[]}
export async function executeBatchJob(snapshot:ProjectDocument,job:BatchJob,source:string,registry:ParameterRegistry,options:BatchOptions,signal:AbortSignal,progress:(done:number,total:number,message:string)=>void):Promise<BatchResult>{
 const active=()=>{if(signal.aborted)throw Error('Batch cancelled.')};active()
 const client=new ArtworkPreviewClient(),audit=new BatchAudit(),owned:string[]=[]
 const stop=()=>{client.dispose();audit.close()};signal.addEventListener('abort',stop,{once:true})
 const keep=(bytes:ArrayBuffer,mime='application/octet-stream')=>{const url=URL.createObjectURL(new Blob([bytes],{type:mime}));owned.push(url);return url}
 try{
  const doc=await jobDocument(snapshot,job,source,registry);active()
  const graph=compileRecipe(doc),set:ArtifactSet={artifacts:[],findings:[],stages:[],outlines:{}},findings:Badge[]=[]
  const outputs=graph.nodes.flatMap(n=>(registry.types.get(n.type)?.outputs??[]).filter(output=>{
   const layout=graph.edges.some(e=>e.to[0]===n.id&&e.to[1]==='tiles')
   if(['stencil','vector_stencil'].includes(n.type)&&((layout&&output.type==='solid')||(!layout&&output.type==='parts')))return false
   const consumed=graph.edges.some(e=>e.from[0]===n.id&&e.from[1]===output.name)
   return ['parts','solid'].includes(output.type)||options.layouts&&output.type==='tiles'||options.outlines&&output.type==='shapes'&&output.name==='shapes'||options.strict&&(consumed||output.name===registry.types.get(n.type)?.outputs[0]?.name)&&(!['removed','rounded'].includes(output.name)||consumed)
  }).map(output=>({n,output})))
  for(const [index,{n,output}]of outputs.entries()){
   active();progress(index,outputs.length,`Generating ${registry.types.get(n.type)?.label??n.type}`)
   const actual=await client.render(doc,n.id,output.name);owned.push(actual.url);active()
   const body=await(await fetch(actual.url)).arrayBuffer();active()
   const auxiliary=['removed','rounded'].includes(output.name)&&!graph.edges.some(e=>e.from[0]===n.id&&e.from[1]===output.name)
   const notes=auxiliary?[]:badgesFor(n.type,n.params,actual.info);findings.push(...notes)
   if(!['solid','parts'].includes(output.type)){
    if(output.type==='tiles')set.stages!.push({id:`${n.id}/${output.name}`,step:n.id,port:output.name,label:n.id,kind:'tiles',url:actual.url,info:actual.info})
    if(output.type==='shapes'&&output.name==='shapes')set.outlines![n.id]={url:actual.url,filename:`${safeSegment(n.id)}-outlines-before-bridges.svg`}
    continue
   }
   const names=Object.keys(actual.info.files??{}),list=output.type==='parts'?(body.byteLength>=4&&new DataView(body).getUint32(0,true)===0x04034b50?storedBatchEntries(body):names.length===1?[{name:names[0],bytes:body}]:(()=>{throw Error('Incomplete part collection.')})()):[{name:`${safeSegment(n.id)}.stl`,bytes:body}],parts:PartArtifact[]=[]
   for(const [partIndex,f]of list.entries()){
    active();progress(index+(partIndex+1)/(list.length+1),outputs.length,`Checking ${f.name}`)
    const mesh=/\.stl$/i.test(f.name)?await audit.check(f.bytes.slice(0)):null;active()
    const problems=mesh?(output.type==='parts'?partMeshProblems(mesh,f.name,actual.info):meshProblems(mesh)):[]
    if(mesh&&output.type==='solid'&&mesh.components!==1)problems.push(`${mesh.components} disconnected solid components`)
    const error=problems.join('; ');if(error)notes.push({level:'error',text:`${f.name}: ${error}`});parts.push({name:f.name,url:keep(f.bytes),mesh,error:error||undefined})
   }
   set.artifacts.push({id:`${n.id}/${output.name}`,step:n.id,label:n.id,kind:output.type as 'solid'|'parts',url:actual.url,filename:`${safeSegment(n.id)}.stl`,info:actual.info,findings:notes,mesh:output.type==='solid'?parts[0].mesh:null,parts,intermediate:graph.edges.some(e=>e.from[0]===n.id)})
  }
  active()
  const roots=set.artifacts.filter(a=>!a.intermediate&&!(a.kind==='solid'&&set.artifacts.some(b=>b.step===a.step&&b.kind==='parts'))).map(a=>a.id)
  const plan=makeExportPlan(doc,set,roots,options)
  if(!plan.complete)throw Error(plan.missing.join(' ')||plan.files.find(f=>f.error)?.error||'Every required printable part must pass verification.')
  if(options.strict&&findings.some(f=>f.level==='warn'||f.level==='error'))throw Error(`Strict checks: ${findings.filter(f=>f.level!=='info').map(f=>f.text).join('; ')}`)
  progress(outputs.length,outputs.length,'Collecting verified output')
  let bytes:ArrayBuffer,manifest:any
  if(options.format==='stl'){
   const files=plan.files.filter(f=>f.required&&f.selected)
   if(files.length!==1)throw Error('This recipe produces multiple printable files. Choose Manufacturing ZIP to retain every required part.')
   bytes=await(await fetch(files[0].url!)).arrayBuffer();active()
   manifest={complete_for_selected_outputs:true,files:[{path:files[0].path,geometry:files[0].mesh}],warnings:plan.warnings}
  }else{
   const packaged=await buildExportPackage(plan,signal);owned.push(packaged.url);active();manifest=packaged.manifest;bytes=await(await fetch(packaged.url)).arrayBuffer();active()
  }
  if(bytes.byteLength>PACKAGE_LIMIT)throw Error('This output exceeds the 256 MB browser collection budget.')
  const meshes:MeshCheck[]=manifest.files.filter((f:any)=>f.geometry).map((f:any)=>f.geometry)
  const tilings=set.artifacts.map(a=>a.info.meta?.tiling).filter(Boolean),seams=tilings.map(t=>Number(t.seam_step_mm)).filter(Number.isFinite),paint=tilings.map(t=>Number(t.paint_under_blocks_mm2)).filter(Number.isFinite)
  const metrics:BatchMetrics={triangles:meshes.reduce((n,m)=>n+m.triangles,0),components:meshes.reduce((n,m)=>n+m.components,0),volumeMm3:meshes.reduce((n,m)=>n+m.signedVolume,0),sizeMm:[0,1,2].map(k=>Math.max(0,...meshes.map(m=>m.size[k]))),stlFiles:meshes.length,seamStepMm:seams.length?Math.max(...seams):null,paintUnderBlocksMm2:paint.length?Math.max(...paint):null,bytes:bytes.byteLength}
  return {bytes,extension:options.format,manifest,metrics,findings:[...new Map(findings.map(f=>[f.level+f.text,f])).values()]}
 }finally{signal.removeEventListener('abort',stop);stop();owned.forEach(u=>URL.revokeObjectURL(u))}
}
export function batchSummary(doc:ProjectDocument,source:string,options:BatchOptions,rows:BatchRow[]){
 return {schema:2,recipe:projectName(doc),source,options,planned_jobs:rows.length,verified:rows.filter(r=>r.status==='Verified').length,failed:rows.filter(r=>r.status==='Failed').length,cancelled:rows.filter(r=>r.status==='Cancelled').length,items:rows.map(({url,downloadName,...row})=>({...row,output:downloadName??null}))}
}
export function batchCsv(rows:BatchRow[]){
 const header=['job','input','status','variations','milliseconds','stl_files','triangles','components','volume_mm3','maximum_part_extents_by_axis_mm','seam_step_mm','paint_under_blocks_mm2','output_bytes','error','findings']
 return '\ufeff'+[header,...rows.map(r=>[r.id,r.relativePath,r.status,JSON.stringify(r.overrides.map(o=>({step:o.step,parameter:o.parameter,value:o.value}))),r.milliseconds??'',r.metrics?.stlFiles??'',r.metrics?.triangles??'',r.metrics?.components??'',r.metrics?.volumeMm3??'',r.metrics?.sizeMm.join(' × ')??'',r.metrics?.seamStepMm??'',r.metrics?.paintUnderBlocksMm2??'',r.metrics?.bytes??'',r.error??'',r.findings?.map(f=>`${f.level}: ${f.text}`).join('; ')??''])].map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n'
}
