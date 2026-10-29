import type {ArtifactSet,MeshCheck} from './artifacts'
import {compileRecipe,projectName,type ProjectDocument} from './project'
import {PACKAGE_LIMIT} from './zip'
import {writeZip} from './zipClient'
export interface PlannedFile{key:string;path:string;name:string;source:string;assembly:string;family?:string;role:string;quantity:number|null;mesh:MeshCheck|null;error?:string;url?:string;data?:string;required:boolean;selected:boolean;replaces:string[]}
export interface ExportPlan{files:PlannedFile[];missing:string[];warnings:string[];complete:boolean;assemblies:{id:string;name:string;sources?:unknown[]}[]}
export const safeSegment=(name:string)=>name.replace(/[^a-z0-9._-]/gi,'_').replace(/\.{2,}/g,'_').replace(/^\.+/,'').slice(0,100)||'part'
export function makeExportPlan(doc:ProjectDocument,set:ArtifactSet,roots:string[],options:{layouts?:boolean;outlines?:boolean;project?:boolean;excluded?:string[]}={}):ExportPlan{
 const graph=compileRecipe(doc),plan:ExportPlan={files:[],missing:[],warnings:[],complete:true,assemblies:[]},excluded=new Set(options.excluded??[])
 for(const [index,id]of [...new Set(roots)].sort().entries()){
  const root=set.artifacts.find(a=>a.id===id);if(!root){plan.missing.push('A selected result is unavailable. Generate the project again.');continue}
  const title=String(doc.raw.stencilStudio?.passNames?.[root.step]??root.label),folder=`assembly-${index+1}-${safeSegment(title)}`,distances=new Map<string,number>(),queue:[string,number][]=[[root.step,0]],seen=new Map<string,PlannedFile>()
  plan.assemblies.push({id,name:title})
  while(queue.length){const [step,distance]=queue.shift()!;if(distances.has(step))continue;distances.set(step,distance);graph.edges.filter(e=>e.to[0]===step).forEach(e=>queue.push([e.from[0],distance+1]))}
  const outputs=set.artifacts.filter(a=>distances.has(a.step)).sort((a,b)=>distances.get(a.step)!-distances.get(b.step)!||a.id.localeCompare(b.id))
  const family=outputs.filter(a=>a.kind==='parts').at(-1)?.step??root.step
  const candidates=root.kind==='parts'?outputs.filter(a=>a.kind==='parts'):[root]
  plan.assemblies.at(-1)!.sources=candidates.map(a=>({step:a.step,kind:a.kind,metadata:a.info.meta??{},stats:a.info.stats??null}))
  for(const a of candidates){
   const files=a.kind==='parts'?a.parts??[]:[{name:a.filename,url:a.url,mesh:a.mesh,error:a.findings.find(f=>f.level==='error')?.text}]
   if(!files.length){plan.missing.push(`${a.label}: files were not captured. Generate the project again.`);continue}
   for(const f of files){
    const collision=f.name.toLowerCase(),old=seen.get(collision);if(old){old.replaces.push(a.step);continue}
    const meta=a.info.meta??{},role=/\.stl$/i.test(f.name)?/^colour_/.test(f.name)?'Colour plate':/^pins_/.test(f.name)?'Alignment pins':/^ring_\d+_/.test(f.name)?'Border slab':meta.plate?.parts?.some((p:any)=>p.file===f.name&&p.role==='tile')?'Stencil tile':/^connector_/.test(f.name)?'Connector rod':/bolt|nut/.test(f.name)?'Fastener':/joiner|extender/.test(f.name)?'Joiner / extender':/fit_test/.test(f.name)?'Calibration strip':a.kind==='solid'?'Stencil plate':'Printable part':'Auxiliary file'
    let quantity:number|null=['Colour plate','Border slab','Stencil tile','Stencil plate','Alignment pins','Calibration strip'].includes(role)?1:null
    if(role==='Connector rod')quantity=Array.isArray(meta.plate?.connectors)?meta.plate.connectors.length:typeof meta.tiling?.connectors==='number'?meta.tiling.connectors:null
    if(meta.ring?.hardware?.bolt_file===f.name)quantity=meta.ring.hardware.bolts_needed
    if(meta.ring?.hardware?.nut_file===f.name)quantity=meta.ring.hardware.nuts_needed
    if(meta.ring?.joiner_file===f.name)quantity=meta.ring.joiner_plates
    if(/^joiner_[^_]+\.stl$/.test(f.name))quantity=meta.pads?.joins??meta.joiners?.seams_joined??null
    const path=`${folder}/${safeSegment(f.name)}`,required=/\.stl$/i.test(f.name),key=`${id}/${f.name}`
    const file:PlannedFile={key,path,name:f.name,source:a.step,assembly:title,family,role,quantity,mesh:f.mesh,error:f.error,url:f.url,required,selected:!excluded.has(key)&&(required||!!options.layouts),replaces:[]}
    if(required&&!f.mesh&&!file.error)file.error='This STL has not passed independent geometry verification.'
    seen.set(collision,file);plan.files.push(file)
   }
  }
  for(const a of outputs)for(const f of a.findings.filter(f=>f.level!=='error'))if(!plan.warnings.includes(f.text))plan.warnings.push(f.text)
  if(options.layouts)for(const stage of set.stages??[])if(stage.kind==='tiles'&&distances.has(stage.step))plan.files.push({key:`${id}/layout/${stage.id}`,path:`${folder}/${safeSegment(stage.step)}-layout.png`,name:'Layout PNG',source:stage.step,assembly:title,role:'Actual layout preview',quantity:null,mesh:null,url:stage.url,required:false,selected:true,replaces:[]})
  if(options.outlines)for(const [step,outline]of Object.entries(set.outlines??{}))if(distances.has(step))plan.files.push({key:`${id}/outlines/${step}`,path:`${folder}/${safeSegment(step)}-traced-outlines-before-bridges.svg`,name:'Traced outlines before bridges.svg',source:step,assembly:title,role:'Artwork before physical bridge corrections',quantity:null,mesh:null,url:outline.url,required:false,selected:true,replaces:[]})
 }
 if(options.project!==false)plan.files.push({key:'project',path:'original-project.json',name:'Original project.json',source:'project',assembly:'Project',role:'Complete saved project with original artwork',quantity:null,mesh:null,data:JSON.stringify(doc.raw,null,2),required:false,selected:true,replaces:[]})
 plan.complete=!plan.missing.length&&plan.files.some(f=>f.required)&&plan.files.every(f=>!f.required||f.selected&&!f.error&&!!f.mesh?.closed)
 return plan
}
export async function buildExportPackage(plan:ExportPlan,signal?:AbortSignal,onProgress?:(message:string)=>void){
 if(plan.missing.length)throw Error(plan.missing.join(' '))
 const selected=plan.files.filter(f=>f.selected)
 if(!selected.some(f=>f.required))throw Error('Select at least one printable STL.')
 const bad=selected.find(f=>f.required&&(f.error||!f.mesh?.closed));if(bad)throw Error(`${bad.name}: ${bad.error??'Geometry verification failed'}. The file cannot be omitted from a complete package.`)
 const entries:{name:string;bytes:ArrayBuffer}[]=[],manifest:any={schema:1,complete_for_selected_outputs:plan.complete,assemblies:plan.assemblies,warnings:plan.warnings,files:[],excluded:plan.files.filter(f=>!f.selected).map(f=>({path:f.path,role:f.role,required:f.required,error:f.error}))}
 let bytes=0;const shared=new Map<string,any>()
 for(const [index,f]of selected.entries()){
  if(signal?.aborted)throw Error('Package creation cancelled.');onProgress?.(`Collecting ${index+1} of ${selected.length}: ${f.name}`)
  const data=f.data!==undefined?new TextEncoder().encode(f.data).buffer:await(await fetch(f.url!)).arrayBuffer();bytes+=data.byteLength
  if(bytes>PACKAGE_LIMIT)throw Error('This package exceeds the current 256 MB budget. Select smaller assemblies or export files individually.')
  const sha=await crypto.subtle.digest('SHA-256',data),sha256=Array.from(new Uint8Array(sha),x=>x.toString(16).padStart(2,'0')).join('')
  const sharedKey=`${f.family??f.key}/${f.name}/${sha256}`,existing=shared.get(sharedKey)
  if(existing){existing.also_used_by.push({assembly:f.assembly,source:f.source,requested_path:f.path});continue}
  const record={path:f.path,source:f.source,assembly:f.assembly,role:f.role,copies_to_print:f.quantity,bytes:data.byteLength,sha256,geometry:f.mesh,replaces_upstream_sources:f.replaces,also_used_by:[]};shared.set(sharedKey,record)
  entries.push({name:f.path,bytes:data});manifest.files.push(record)
 }
 entries.push({name:'manufacturing-manifest.json',bytes:new TextEncoder().encode(JSON.stringify(manifest,null,2)).buffer});onProgress?.('Checking file names and packing the local ZIP…')
 const zip=await writeZip(entries,signal);if(signal?.aborted)throw Error('Package creation cancelled.')
 return {url:URL.createObjectURL(new Blob([zip],{type:'application/zip'})),manifest,bytes:zip.byteLength}
}
export const packageFilename=(doc:ProjectDocument)=>`${safeSegment(projectName(doc))}-manufacturing.zip`
