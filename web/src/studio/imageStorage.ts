/** Persistent originals with a bounded session fallback when browser storage is
 * blocked/full. Persistence failures must not prevent local processing/saving. */
export interface ImageRecord {name:string;bytes:ArrayBuffer}
const memory=new Map<string,ImageRecord>(),MEMORY_LIMIT=128*1024*1024
let memoryBytes=0,database:Promise<IDBDatabase>|null=null,storageError:string|null=null
function remember(id:string,image:ImageRecord){
 if(image.bytes.byteLength>MEMORY_LIMIT)throw Error('This image exceeds the session image-cache budget.')
 const previous=memory.get(id);if(previous)memoryBytes-=previous.bytes.byteLength
 memory.delete(id);memory.set(id,image);memoryBytes+=image.bytes.byteLength
 for(const [key,old]of memory){if(memoryBytes<=MEMORY_LIMIT)break;memory.delete(key);memoryBytes-=old.bytes.byteLength}
}
function db():Promise<IDBDatabase>{
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  let settled=false,request:IDBOpenDBRequest
  const fail=(error:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);database=null;reject(error)}
  const timer=setTimeout(()=>fail(Error('Browser image storage did not open.')),5000)
  try{request=indexedDB.open('stencil-studio',1)}catch(error){fail(error);return}
  request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('images'))request.result.createObjectStore('images')}
  request.onsuccess=()=>{if(settled){request.result.close();return}settled=true;clearTimeout(timer);const result=request.result;result.onversionchange=()=>{result.close();database=null};resolve(result)}
  request.onerror=()=>fail(request.error);request.onblocked=()=>fail(Error('Browser image storage is blocked by another session.'))
 }).catch(error=>{database=null;throw error})
 return database
}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const database=await db()
 return new Promise((resolve,reject)=>{
  let settled=false,result:T,tx:IDBTransaction
  const fail=(error:unknown)=>{if(settled)return;settled=true;clearTimeout(timer);reject(error)}
  const timer=setTimeout(()=>{try{tx?.abort()}catch{}fail(Error('Browser image storage timed out.'))},5000)
  try{
   tx=database.transaction('images',mode);const request=action(tx.objectStore('images'))
   request.onsuccess=()=>{result=request.result};request.onerror=()=>fail(request.error)
   tx.oncomplete=()=>{if(settled)return;settled=true;clearTimeout(timer);resolve(result)}
   tx.onabort=()=>fail(tx.error??Error('Image storage transaction was aborted.'));tx.onerror=()=>fail(tx.error)
  }catch(error){fail(error)}
 })
}
function unavailable(error:unknown){storageError=String(error instanceof Error?error.message:error)}
export async function storeImage(id:string,image:ImageRecord){
 remember(id,image)
 try{await transaction('readwrite',store=>store.put(image,id));storageError=null}catch(error){unavailable(error)}
}
export async function readImage(id:string):Promise<ImageRecord|undefined>{
 const cached=memory.get(id);if(cached){memory.delete(id);memory.set(id,cached);return cached}
 try{const image=await transaction('readonly',store=>store.get(id)) as ImageRecord|undefined;if(image)remember(id,image);return image}catch(error){unavailable(error);return undefined}
}
export async function imageKeys(){
 try{return [...new Set([...memory.keys(),...(await transaction('readonly',store=>store.getAllKeys())).map(String)])]}catch(error){unavailable(error);return [...memory.keys()]}
}
export const imageStorageStatus=()=>({sessionBytes:memoryBytes,sessionLimitBytes:MEMORY_LIMIT,persistentAvailable:storageError===null,error:storageError})
