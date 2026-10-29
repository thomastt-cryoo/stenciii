import {packZip} from './zip'
self.onmessage=e=>{try{const bytes=packZip(e.data.entries.map((f:{name:string;bytes:ArrayBuffer})=>({name:f.name,bytes:new Uint8Array(f.bytes)})));self.postMessage({bytes},{transfer:[bytes]})}catch(error){self.postMessage({error:String(error instanceof Error?error.message:error)})}}
