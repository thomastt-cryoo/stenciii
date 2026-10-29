import { inspectStl } from './meshAudit'
self.onmessage=(e:MessageEvent<{id:number;bytes:ArrayBuffer}>)=>{
 try{self.postMessage({id:e.data.id,ok:inspectStl(e.data.bytes)})}
 catch(error){self.postMessage({id:e.data.id,error:String(error instanceof Error?error.message:error)})}
}
