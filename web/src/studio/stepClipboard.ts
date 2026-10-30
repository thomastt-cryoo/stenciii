import type {NodeType} from '../api'
import {compileRecipe,copy,object,operations,rawGraph,type ProjectDocument} from './project'
import {validateRecipe} from './artwork'

export interface StepClipboard {nodes:any[];edges:any[];images:Record<string,any>}
export function copyStepGroup(doc:ProjectDocument,selected:string[]):StepClipboard{
 const graph=compileRecipe(doc),ids=new Set<string>(),visit=(id:string)=>{if(ids.has(id))return;ids.add(id);graph.edges.filter(e=>e.to[0]===id).forEach(e=>visit(e.from[0]))}
 if(!selected.length)throw Error('Select one or more processing steps to copy.')
 if(selected.some(id=>!graph.nodes.some(n=>n.id===id)))throw Error('A selected step is no longer available. Select the current steps again.')
 selected.forEach(visit)
 const raw=rawGraph(doc),nodes=copy(raw.nodes.filter((n:any)=>ids.has(n.id))),edges=copy(raw.edges.filter((e:any)=>ids.has(e.from?.[0]??e.source)&&ids.has(e.to?.[0]??e.target))),images:Record<string,any>={}
 for(const source of operations(doc).filter(n=>ids.has(n.id)&&n.type==='source')){
  const id=String(source.params.image_id),asset=doc.raw.images?.[id];if(!asset)throw Error('Save and reopen an embedded project before copying its image source.');images[id]=copy(asset)
 }
 return {nodes,edges,images}
}
export function pasteStepGroup(doc:ProjectDocument,clipboard:StepClipboard,catalogue:NodeType[]):ProjectDocument{
 const next=copy(doc),graph=rawGraph(next),used=new Set(operations(next).map(n=>n.id)),map=new Map<string,string>(),assetMap=new Map<string,string>()
 const fresh=(base:string,seen:Set<string>)=>{let id=base;for(let i=1;seen.has(id);i++)id=`${base}-${i}`;seen.add(id);return id}
 for(const node of clipboard.nodes)map.set(node.id,fresh(`copy-${node.id}`,used))
 if(!object(next.raw.images))next.raw.images={}
 const imageIds=new Set(Object.keys(next.raw.images))
 for(const [id,asset]of Object.entries(clipboard.images)){
  const destination=next.raw.images[id]&&JSON.stringify(next.raw.images[id])!==JSON.stringify(asset)?fresh(`copy-${id}`,imageIds):id
  next.raw.images[destination]=copy(asset);assetMap.set(id,destination)
 }
 for(const original of clipboard.nodes){
  const node=copy(original);node.id=map.get(original.id)!
  const data=object(node.data)?node.data:node
  if(data.type==='source'&&object(data.params))data.params.image_id=assetMap.get(String(data.params.image_id))??data.params.image_id
  if(object(node.position)&&Number.isFinite(node.position.x)&&Number.isFinite(node.position.y))node.position={...node.position,x:node.position.x+40,y:node.position.y+40}
  graph.nodes.push(node)
 }
 for(const original of clipboard.edges){
  const edge=copy(original)
  if(Array.isArray(edge.from)){edge.from=[map.get(edge.from[0]),edge.from[1]];edge.to=[map.get(edge.to[0]),edge.to[1]]}
  else{edge.source=map.get(edge.source);edge.target=map.get(edge.target)}
  if('id'in edge)edge.id=`copy-${edge.source??edge.from[0]}-${edge.target??edge.to[0]}-${graph.edges.length}`
  graph.edges.push(edge)
 }
 validateRecipe(next,catalogue);return next
}
