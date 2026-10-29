export function writeZip(entries:{name:string;bytes:ArrayBuffer}[],signal?:AbortSignal):Promise<ArrayBuffer>{
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./zip.worker.ts',import.meta.url),{type:'module',name:'manufacturing-package'})
  const done=()=>{worker.terminate();signal?.removeEventListener('abort',cancel)}
  const cancel=()=>{done();reject(Error('Package creation was superseded or cancelled.'))}
  if(signal?.aborted){cancel();return}signal?.addEventListener('abort',cancel,{once:true})
  worker.onmessage=e=>{done();e.data.error?reject(Error(e.data.error)):resolve(e.data.bytes)};worker.onerror=e=>{done();reject(Error(e.message||'The package worker stopped. Try again.'))}
  worker.postMessage({entries},entries.map(e=>e.bytes))
 })
}
