import {useEffect,useRef,useState} from 'react'
import {ArtworkPreviewClient} from './artworkPreview'
import {compileRecipe,copy,encodeBytes,type ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'
import type {ArtifactSet,PartArtifact,MeshCheck} from './artifacts'
import {meshProblems} from './meshAudit'
import {crc32,PACKAGE_LIMIT} from './zip'
import {buildExportPackage,makeExportPlan,safeSegment} from './exportPlan'
import {writeZip} from './zipClient'

function storedEntries(bytes:ArrayBuffer){
 const v=new DataView(bytes),all=new Uint8Array(bytes),result:{name:string;bytes:ArrayBuffer}[]=[];let pos=0
 while(pos+4<bytes.byteLength&&v.getUint32(pos,true)===0x04034b50){
  if(pos+30>bytes.byteLength||v.getUint16(pos+8,true)!==0||v.getUint16(pos+6,true)&8)throw Error('Unsupported engine ZIP encoding.')
  const size=v.getUint32(pos+18,true),length=v.getUint16(pos+26,true),extra=v.getUint16(pos+28,true),start=pos+30+length+extra,end=start+size
  if(end>bytes.byteLength)throw Error('Incomplete engine ZIP.')
  const name=new TextDecoder().decode(all.subarray(pos+30,pos+30+length)),body=bytes.slice(start,end)
  if(crc32(new Uint8Array(body))!==v.getUint32(pos+14,true))throw Error('Engine ZIP CRC mismatch.')
  result.push({name,bytes:body});pos=end
 }
 if(!result.length)throw Error('No files in engine ZIP.');return result
}
class BatchAudit{
 private worker=new Worker(new URL('./meshAudit.worker.ts',import.meta.url),{type:'module',name:'batch-geometry-check'})
 private seq=0;private pending=new Map<number,{resolve:(m:MeshCheck)=>void;reject:(e:Error)=>void}>()
 constructor(){this.worker.onmessage=e=>{const p=this.pending.get(e.data.id);if(!p)return;this.pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)};this.worker.onerror=()=>this.close()}
 check(bytes:ArrayBuffer){const id=++this.seq;return new Promise<MeshCheck>((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.worker.postMessage({id,bytes},[bytes])})}
 close(){this.worker.terminate();this.pending.forEach(p=>p.reject(Error('Batch geometry check stopped.')));this.pending.clear()}
}
export default function BatchWorkbench({doc,registry}:{doc:ProjectDocument;registry:ParameterRegistry}){
 const sources=compileRecipe(doc).nodes.filter(n=>n.type==='source'),[source,setSource]=useState(sources.length===1?sources[0].id:''),[files,setFiles]=useState<File[]>([]),[rows,setRows]=useState<{name:string;status:string;url?:string}[]>([]),[running,setRunning]=useState(false),[collection,setCollection]=useState(''),[message,setMessage]=useState('')
 const job=useRef<{abort:AbortController;client:ArtworkPreviewClient;audit:BatchAudit}|null>(null),urls=useRef<string[]>([])
 const cancel=()=>{job.current?.abort.abort();job.current?.client.dispose();job.current?.audit.close();job.current=null;setRunning(false)}
 useEffect(()=>()=>{cancel();urls.current.forEach(u=>URL.revokeObjectURL(u))},[doc])
 const start=async()=>{
  cancel();urls.current.forEach(u=>URL.revokeObjectURL(u));urls.current=[];setCollection('');setRows([])
  if(!source||!files.length){setMessage('Choose a source step and local images.');return}
  if(files.length>20||files.reduce((n,f)=>n+f.size,0)>128*1024*1024){setMessage('This browser batch is limited to 20 images and 128 MB of input. Split larger jobs into smaller batches or use the CLI.');return}
  const task={abort:new AbortController(),client:new ArtworkPreviewClient(),audit:new BatchAudit()},snapshot=copy(doc);job.current=task;setRunning(true)
  const completed:{name:string;status:string;url?:string}[]=[],entries:{name:string;bytes:ArrayBuffer}[]=[];let bytesTotal=0
  for(const [index,file]of files.entries()){
   if(task.abort.signal.aborted)break;setMessage(`Processing ${index+1} of ${files.length}: ${file.name}`)
   const owned:string[]=[]
   try{
    if(!/\.(png|jpe?g|bmp|svg)$/i.test(file.name)||!file.size||file.size>64*1024*1024)throw Error('Choose a nonempty supported image up to 64 MB.')
    const next=copy(snapshot),graph=compileRecipe(next),original=graph.nodes.find(n=>n.id===source)!,assetId=String(original.params.image_id),asset=next.raw.images?.[assetId]
    if(!asset)throw Error('Save a project with embedded original artwork before batching.')
    // Updating this one embedded asset leaves all other sources and settings intact.
    next.raw.images[assetId]={...asset,name:file.name,base64:encodeBytes(await file.arrayBuffer())}
    const set:ArtifactSet={artifacts:[],findings:[]}
    for(const n of graph.nodes){for(const output of registry.types.get(n.type)?.outputs??[]){
     if(!['parts','solid'].includes(output.type))continue
     const layout=graph.edges.some(e=>e.to[0]===n.id&&e.to[1]==='tiles')
     if(['stencil','vector_stencil'].includes(n.type)&&(layout?output.type==='solid':output.type==='parts'))continue
     const actual=await task.client.render(next,n.id,output.name),body=await(await fetch(actual.url)).arrayBuffer();URL.revokeObjectURL(actual.url)
     const names=Object.keys(actual.info.files??{})
     const list=output.type==='parts'?(new DataView(body).getUint32(0,true)===0x04034b50?storedEntries(body):names.length===1?[{name:names[0],bytes:body}]:(()=>{throw Error('Incomplete part collection.')})()):[{name:`${safeSegment(n.id)}.stl`,bytes:body}],parts:PartArtifact[]=[]
     for(const f of list){const url=URL.createObjectURL(new Blob([f.bytes]));owned.push(url);const mesh=/\.stl$/i.test(f.name)?await task.audit.check(f.bytes.slice(0)):null,error=mesh?meshProblems(mesh).join('; '):'';parts.push({name:f.name,url,mesh,error:error||undefined})}
     const url=URL.createObjectURL(new Blob([body]));owned.push(url)
     set.artifacts.push({id:`${n.id}/${output.name}`,step:n.id,label:n.id,kind:output.type as 'solid'|'parts',url,filename:`${n.id}.stl`,info:actual.info,findings:[],mesh:output.type==='solid'?parts[0].mesh:null,parts,intermediate:graph.edges.some(e=>e.from[0]===n.id)})
    }}
    const roots=set.artifacts.filter(a=>!a.intermediate&&!(a.kind==='solid'&&set.artifacts.some(b=>b.step===a.step&&b.kind==='parts'))).map(a=>a.id),plan=makeExportPlan(next,set,roots),result=await buildExportPackage(plan,task.abort.signal)
    urls.current.push(result.url);const bytes=await(await fetch(result.url)).arrayBuffer();bytesTotal+=bytes.byteLength
    if(bytesTotal>PACKAGE_LIMIT)throw Error('Batch collection exceeds 256 MB. Use smaller batches.')
    entries.push({name:`${index+1}-${safeSegment(file.name)}/manufacturing.zip`,bytes});completed.push({name:file.name,status:'Verified',url:result.url})
   }catch(error){if(task.abort.signal.aborted)break;completed.push({name:file.name,status:String(error instanceof Error?error.message:error)})}
   finally{owned.forEach(u=>URL.revokeObjectURL(u))}
   if(!task.abort.signal.aborted)setRows([...completed])
  }
  try{if(entries.length&&!task.abort.signal.aborted){entries.push({name:'batch-summary.json',bytes:new TextEncoder().encode(JSON.stringify({recipe:snapshot.raw.stencilStudio?.name??'Saved recipe',source,items:completed.map(({name,status})=>({name,status}))},null,2)).buffer});const bytes=await writeZip(entries,task.abort.signal),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'}));urls.current.push(url);setCollection(url)}}catch(error){if(!task.abort.signal.aborted)setMessage(String(error))}
  if(!task.abort.signal.aborted){setMessage(`Finished ${completed.length} items. Each failure is isolated.`);setRunning(false)}task.client.dispose();task.audit.close();if(job.current===task)job.current=null
 }
 return <section className="batch-workbench"><h4>Local image batch</h4><p>Use this saved recipe for up to 20 images, one after another in a separate local worker. Keep this window open. Each ZIP includes all generated terminal assemblies and their upstream parts.</p><label>Artwork source<select aria-label="Batch artwork source" disabled={running} value={source} onChange={e=>setSource(e.target.value)}><option value="">Choose a source…</option>{sources.map(n=><option key={n.id}>{n.id}</option>)}</select></label><input aria-label="Batch local images" type="file" multiple accept=".png,.jpg,.jpeg,.bmp,.svg" disabled={running} onChange={e=>setFiles(Array.from(e.target.files??[]))}/><p>{files.length} images selected. Recipe settings are frozen when the batch starts. Editing the project cancels this batch.</p><div className="editor-actions"><button disabled={running||!files.length||!source} onClick={()=>void start()}>Run local batch</button>{running&&<button onClick={()=>{cancel();setMessage('Batch cancelled.')}}>Cancel batch</button>}{collection&&<a href={collection} download="stencil-batch.zip">Download batch collection</a>}</div><p role="status">{message}</p><ol>{rows.map((r,i)=><li key={i}>{r.name} · {r.status}{r.url&&<a href={r.url} download={`${safeSegment(r.name)}-manufacturing.zip`}> Save verified result</a>}</li>)}</ol><details><summary>Batch limits and diagnostics</summary><p>This interface replaces one selected embedded image asset. Other source assets keep their saved bytes. Shared uses of that asset change together. Parameter sweeps, folder discovery and unattended command jobs remain available through the existing CLI. Browser batches have no parameter-variation editor. Inputs are limited to 128 MB; the collection is limited to 256 MB, and each STL to two million triangles for verification.</p><p>Use the readiness notes and Manufacturing export for part diagnostics. CLI reports and strict checks remain available locally.</p></details></section>
}
