import {copy,editParameter,quickRecipe,rawGraph,type ProjectDocument} from './project'

/** Opt-in preparation for dense illustrations. An ordinary saved recipe: the
 * native engine, batch runner and reopened project execute the same settings. */
export function prepareFineArtwork(doc:ProjectDocument):ProjectDocument {
 const q=quickRecipe(doc)
 if(!q?.vector||!q.trace)throw Error('Fine artwork preparation needs a simple vector image workflow. This project is unchanged.')
 let next=copy(doc)
 const set=(id:string,key:string,value:unknown)=>{next=editParameter(next,id,key,value)}
 const resolution=Math.max(1400,Number(q.source.params.resolution)||0)
 set(q.source.id,'resolution',resolution);set(q.build.id,'detail',6)
 // Avoid the doubled mask + strong curve blur that rounds off narrow whiskers.
 if(q.smoothing){set(q.smoothing.id,'radius',.4);set(q.smoothing.id,'supersample',1)}
 for(const [key,value] of Object.entries({smooth:1.25,corner_deg:60,tolerance:.35,min_area:2}))set(q.trace.id,key,value)
 let cleanup=q.cleanup?.type==='remove_islands'?q.cleanup:undefined
 if(!cleanup){
  const graph=rawGraph(next);let id='fine-cleanup',i=1
  while(graph.nodes.some((n:any)=>n.id===id))id=`fine-cleanup-${i++}`
  const edge=graph.edges.find((e:any)=>e.from[0]===q.trace!.id&&e.to[0]===q.build.id)
  if(!edge)throw Error('The artwork cleanup cannot be connected safely. This project is unchanged.')
  cleanup={id,type:'remove_islands',params:{}}
  graph.nodes.splice(graph.nodes.findIndex((n:any)=>n.id===q.build.id),0,{id,type:cleanup.type,params:{}})
  graph.edges=graph.edges.filter((e:any)=>e!==edge)
  graph.edges.push({from:[q.trace.id,'shapes'],to:[id,'shapes']},{from:[id,'shapes'],to:[q.build.id,'shapes']})
 }
 for(const [key,value] of Object.entries({delete_specks:true,fill_holes:true,max_area:Math.round(64*(resolution/1400)**2),keep_largest:0}))set(cleanup.id,key,value)
 return next
}

/** One undoable change; disabling retains the customer's cutoff for next time. */
export function cleanTinyMarks(doc:ProjectDocument,enabled:boolean):ProjectDocument {
 const q=quickRecipe(doc)
 if(q?.cleanup?.type!=='remove_islands')throw Error('This workflow needs a vector cleanup step. Add it in Processing steps.')
 return editParameter(editParameter(doc,q.cleanup.id,'delete_specks',enabled),q.cleanup.id,'fill_holes',enabled)
}
