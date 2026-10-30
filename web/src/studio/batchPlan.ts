import {compileRecipe,copy,editParameter,encodeBytes,operations,projectName,object,type ProjectDocument} from './project'
import type {ParameterRegistry} from './registry'
import type {ParamDef} from '../api'
import {synchronizeFit} from './sharedFit'

export const BATCH_LIMITS={images:20,inputBytes:128*1024*1024,fileBytes:64*1024*1024,jobs:128,recipeBytes:100*1024*1024}
export interface BatchVariation {id:number;step:string;parameter:string;mode:'range'|'list';start:string;end:string;increment:string;values:string}
export interface BatchOverride {step:string;parameter:string;value:unknown;label:string}
export interface BatchJob {id:string;name:string;relativePath:string;file:File|null;overrides:BatchOverride[]}
export interface BatchOptions {format:'zip'|'stl';project:boolean;layouts:boolean;outlines:boolean;strict:boolean}
export const defaultBatchOptions:BatchOptions={format:'zip',project:true,layouts:false,outlines:false,strict:false}
export function variationFields(doc:ProjectDocument,registry:ParameterRegistry){
 return operations(doc).flatMap(op=>{const type=op.type==='complexity'?'remesh':op.type;return (registry.types.get(type)?.params??[]).map(parameter=>({step:op.id,type,parameter,label:`${registry.types.get(type)!.label} · ${parameter.label} · ${op.id}`}))})
}
export function variationValues(variation:BatchVariation,parameter:ParamDef,registry:ParameterRegistry,type:string){
 let values:unknown[]
 if(variation.mode==='range'){
  if(!['int','float'].includes(parameter.kind))throw Error('Ranges are available for numeric settings. Choose explicit values for this setting.')
  if([variation.start,variation.end,variation.increment].some(v=>!v.trim()))throw Error('Enter the start, end and increment.')
  const start=Number(variation.start),end=Number(variation.end),increment=Number(variation.increment)
  if(![start,end,increment].every(Number.isFinite)||increment<=0||end<start)throw Error('Use a finite start and end, with a positive increment and an end at least as large as the start.')
  const count=Math.floor((end-start)/increment+1e-9)+1
  if(count>BATCH_LIMITS.jobs)throw Error(`A range can contain at most ${BATCH_LIMITS.jobs} values. Increase its increment.`)
  values=Array.from({length:count},(_,i)=>Number((start+i*increment).toPrecision(15)))
 }else{
  let parsed:unknown
  try{parsed=JSON.parse(variation.values)}catch{throw Error('Enter explicit values as a JSON list, such as [100, 150] or ["closest", "spread"].')}
  if(!Array.isArray(parsed)||!parsed.length||parsed.length>BATCH_LIMITS.jobs)throw Error(`Choose between 1 and ${BATCH_LIMITS.jobs} values.`)
  values=parsed
 }
 values=values.map(value=>parameter.kind==='choice'?String(value):value)
 for(const value of values)registry.validate(type,parameter.name,value)
 return [...new Map(values.map(v=>[JSON.stringify(v),v])).values()]
}
export function planBatch(doc:ProjectDocument,registry:ParameterRegistry,files:File[],source:string,variations:BatchVariation[]):BatchJob[]{
 const graph=compileRecipe(doc),fields=variationFields(doc,registry)
 const unavailable=graph.nodes.find(n=>!registry.types.has(n.type));if(unavailable)throw Error(`This recipe contains an unsupported operation: ${unavailable.id}. Its saved data is retained; choose a compatible recipe for this batch.`)
 if(files.length>BATCH_LIMITS.images||files.reduce((n,f)=>n+f.size,0)>BATCH_LIMITS.inputBytes)throw Error('This browser batch is limited to 20 images and 128 MB of input. Choose a smaller group.')
 if(files.length&&!graph.nodes.some(n=>n.id===source&&n.type==='source'))throw Error('Choose the artwork source to replace in each run.')
 let combinations:BatchOverride[][]=[[]];const used=new Set<string>()
 for(const variation of variations){
  const field=fields.find(f=>f.step===variation.step&&f.parameter.name===variation.parameter)
  if(!field)throw Error('Choose a saved operation and setting for every variation.')
  const key=JSON.stringify([field.step,field.parameter.name]);if(used.has(key))throw Error('Choose each setting only once in a variation set.');used.add(key)
  if(files.length&&field.step===source&&field.parameter.name==='image_id')throw Error('The selected input images supply this artwork source. Vary its settings instead of its saved image identity.')
  const values=variationValues(variation,field.parameter,registry,field.type)
  if(field.type==='source'&&field.parameter.name==='image_id'&&values.some(v=>!doc.raw.images?.[String(v)]))throw Error('Choose image identities embedded in this saved project.')
  if(combinations.length*values.length*Math.max(1,files.length)>BATCH_LIMITS.jobs)throw Error(`This selection exceeds ${BATCH_LIMITS.jobs} jobs. Use fewer images or variations.`)
  combinations=combinations.flatMap(previous=>values.map(value=>[...previous,{step:field.step,parameter:field.parameter.name,value,label:field.parameter.label}]))
 }
 const inputs:(File|null)[]=files.length?files:[null]
 return inputs.flatMap((file,index)=>combinations.map((overrides,variant)=>({id:`${index+1}-${variant+1}`,name:file?.name??projectName(doc),relativePath:file?.webkitRelativePath||file?.name||projectName(doc),file,overrides})))
}
export async function jobDocument(snapshot:ProjectDocument,job:BatchJob,source:string,registry?:ParameterRegistry):Promise<ProjectDocument>{
 let next=copy(snapshot)
 for(const override of job.overrides)next=editParameter(next,override.step,override.parameter,override.value)
 if(registry)next=synchronizeFit(snapshot,next,registry)
 if(job.file){
  if(!/\.(png|jpe?g|bmp|svg)$/i.test(job.file.name)||!job.file.size||job.file.size>BATCH_LIMITS.fileBytes)throw Error('Choose a nonempty supported image up to 64 MB.')
  const selected=compileRecipe(next).nodes.find(n=>n.id===source&&n.type==='source')
  if(!selected)throw Error('The selected artwork source is unavailable.')
  if(next.raw.images!==undefined&&!object(next.raw.images))throw Error('This recipe uses unsupported image metadata. Its saved data is retained; choose a compatible recipe.')
  next.raw.images??={}
  const asset=next.raw.images[String(selected.params.image_id)]
  let id='batch-input';for(let n=1;next.raw.images[id];n++)id=`batch-input-${n}`
  // Clone only the chosen source's asset. Other sources sharing its old identity
  // retain their original bytes, and unused/unknown project data stays intact.
  next.raw.images[id]={...(object(asset)?asset:{}),name:job.file.name,base64:encodeBytes(await job.file.arrayBuffer())}
  next=editParameter(next,source,'image_id',id)
 }
 return next
}
export function csvCell(value:unknown){
 let text=String(value??'');if(/^[\s]*[=+@-]/.test(text))text="'"+text
 return '"'+text.replace(/"/g,'""')+'"'
}
