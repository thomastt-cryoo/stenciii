import {api} from '../api'
import {operations,object,encodeBytes,type ProjectDocument} from './project'

/** Enrich an unpublished import with originals from the original browser store.
 * Existing image metadata and all workflow fields remain authoritative. */
export async function embedAvailableOriginals(doc:ProjectDocument,current:()=>boolean=()=>true){
 if(doc.raw.images!==undefined&&!object(doc.raw.images))return current()
 for(const source of operations(doc).filter(node=>node.type==='source')){
  const id=String(source.params.image_id??'')
  if(Object.hasOwn(doc.raw.images??{},id))continue
  const stored=await api.storedImage(id)
  if(!current())return false
  if(stored)doc.raw.images={...doc.raw.images,[id]:{name:stored.name,base64:encodeBytes(stored.bytes)}}
 }
 return current()
}
