import {copy,object,operations,rawGraph,type ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'

export const sharedFitFields=['nut_clearance','tip_taper','tip_pitches'] as const
export const fitOperations=(doc:ProjectDocument,registry:ParameterRegistry)=>operations(doc).filter(op=>sharedFitFields.every(name=>registry.types.get(op.type)?.params.some(p=>p.name===name)))
export function setFitLink(doc:ProjectDocument,sourceId:string,enabled:boolean,registry:ParameterRegistry):ProjectDocument{
 if(doc.raw.stencilStudio&&!object(doc.raw.stencilStudio))throw Error('This imported project uses an unsupported settings namespace. Its saved metadata is preserved.')
 const saved=doc.raw.stencilStudio?.sharedFit
 if(saved!=null&&(!object(saved)||saved.schema!==1))throw Error('This project already contains unsupported shared-fit metadata. It has been preserved.')
 const source=fitOperations(doc,registry).find(op=>op.id===sourceId);if(enabled&&!source)throw Error('Choose the operation supplying the shared fit settings.')
 const next=copy(doc),values=source?Object.fromEntries(sharedFitFields.map(key=>[key,source.params[key]??registry.defaults(source.type)[key]])):saved?.values??{}
 next.raw.stencilStudio={...next.raw.stencilStudio,sharedFit:{...saved,schema:1,enabled,values}}
 return next
}
/** Only explicitly linked projects synchronize edits. Opening/importing, or an
 * unrelated edit of an imported unequal project, never normalizes its values. */
export function synchronizeFit(before:ProjectDocument,next:ProjectDocument,registry:ParameterRegistry):ProjectDocument{
 const link=next.raw.stencilStudio?.sharedFit,previous=before.raw.stencilStudio?.sharedFit
 if(!object(link)||link.schema!==1||link.enabled!==true)return next
 const ops=fitOperations(next,registry),old=fitOperations(before,registry),master={...link.values};let changed=previous?.enabled!==true||ops.some(op=>!old.some(p=>p.id===op.id))
 for(const key of sharedFitFields){
  const edits=ops.flatMap(op=>{const prior=old.find(p=>p.id===op.id);return prior&&(op.params[key]??registry.defaults(op.type)[key])!==(prior.params[key]??registry.defaults(prior.type)[key])?[op.params[key]??registry.defaults(op.type)[key]]:[]})
  const unique=[...new Set(edits)]
  if(unique.length>1)throw Error('Linked screw-fit settings received conflicting values. Unlink them before applying different presets.')
  if(unique.length){master[key]=unique[0];changed=true}
 }
 if(!changed)return next
 const result=copy(next)
 for(const op of ops){
  const node=rawGraph(result).nodes.find((n:any)=>n.id===op.id),data=object(node.data)?node.data:node
  if(!object(data.params))data.params={}
  for(const key of sharedFitFields){registry.validate(op.type,key,master[key]);data.params[key]=master[key]}
 }
 result.raw.stencilStudio.sharedFit={...link,values:master};return result
}
