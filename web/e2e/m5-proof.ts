import type {Page} from '@playwright/test'
import {compileRecipe,openDocument} from '../src/studio/project'
export async function prove(page:Page,doc:any,target:string,out:string){
 const workerUrl=page.workers().find(w=>w.url().includes('engine.worker'))!.url(),graph=compileRecipe(openDocument(doc))
 return page.evaluate(async({graph,images,target,out,workerUrl})=>{
  const w=window as any
  if(!w.__manufacturingProof){
   const worker=new Worker(workerUrl,{type:'module',name:'artwork-preview'}),pending=new Map<number,any>();let seq=0
   worker.onerror=e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(`Manufacturing worker: ${e.message}`))}pending.clear()}
   worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p||e.data.step)return;pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
   w.__manufacturingProof={worker,call:(message:any)=>new Promise<any>((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Manufacturing proof timed out')),120000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,...message})})}
  }
  const call=w.__manufacturingProof.call
  for(const node of graph.nodes)if(node.type==='source'){const asset=(images as any)[node.params.image_id],bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));node.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}
  const result=await call({op:'inspect',graph:JSON.stringify(graph),target,out}),hash=await crypto.subtle.digest('SHA-256',result.bytes)
  let data='';for(let i=0;i<result.bytes.length;i+=0x8000)data+=String.fromCharCode(...result.bytes.subarray(i,i+0x8000))
  return {sha256:Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join(''),info:result.info,base64:btoa(data),mime:result.mime,extension:result.bytes[0]===80&&result.bytes[1]===75?'zip':result.bytes[0]===137?'png':result.bytes[0]===60?'svg':'stl'}
 },{graph,images:doc.images,target,out,workerUrl})
}
