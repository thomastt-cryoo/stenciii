import type { MeshCheck } from './meshAudit'
let worker:Worker|undefined,sequence=0
const pending=new Map<number,{resolve:(m:MeshCheck)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>()
export function cancelMeshAudit(){worker?.terminate();worker=undefined;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('Geometry check superseded.'))}pending.clear()}
export function auditMesh(bytes:ArrayBuffer):Promise<MeshCheck>{
 if(!worker){worker=new Worker(new URL('./meshAudit.worker.ts',import.meta.url),{type:'module',name:'geometry-verification'});worker.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)};worker.onerror=()=>cancelMeshAudit()}
 const id=++sequence
 return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cancelMeshAudit();reject(Error('Geometry verification timed out. Lower detail and retry.'))},120_000);pending.set(id,{resolve,reject,timer});worker!.postMessage({id,bytes},[bytes])})
}
