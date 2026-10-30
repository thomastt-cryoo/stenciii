import type {NodeType,GraphJson} from '../api'
import {compileRecipe,copy,operations,type ProjectDocument} from './project'
import {validateRecipe} from './artwork'

export const originalWorkflows=[
 {id:'simple',name:'Simple stencil'}, {id:'tones',name:'Colour tones'}, {id:'vector',name:'Vector stencil'},
 {id:'colours',name:'Two-colour registered set'}, {id:'mounted',name:'Tiles, pads and screws'}, {id:'first',name:'Tiles first'},
] as const
/** The six original starter recipes, with their original catalogue defaults. */
export function originalWorkflow(id:string,imageId:string,catalogue:NodeType[]):GraphJson{
 const nodes:GraphJson['nodes']=[],edges:GraphJson['edges']=[]
 const add=(type:string,params:Record<string,unknown>={})=>{const n=`${type}-${nodes.length+1}`,definition=catalogue.find(t=>t.id===type);if(!definition)throw Error('This workflow is unavailable in the current engine.');nodes.push({id:n,type,params:{...Object.fromEntries(definition.params.map(p=>[p.name,p.default])),...params}});return n}
 const wire=(a:string,port:string,b:string,input=port)=>edges.push({from:[a,port],to:[b,input]})
 const src=add('source',{image_id:imageId})
 if(id==='tones'){
  const reduce=add('reduce',{colours:3}),tones=add('tone_patterns'),stencil=add('stencil',{width_mm:100,margin_mm:6,raised_bridges:true,z_bridging:'easy',layer_height_mm:.2})
  wire(src,'image',reduce);wire(reduce,'image',tones);wire(tones,'mask',stencil)
 }else if(id==='colours'){
  const split=add('split_colours',{colours:2}),plate={width_mm:100,margin_mm:10,raised_bridges:true,z_bridging:'easy'},a=add('stencil',plate),b=add('stencil',plate),set=add('colour_set')
  wire(src,'image',split);wire(split,'colour_1',a,'mask');wire(split,'colour_2',b,'mask');wire(a,'solid',set,'colour_1');wire(b,'solid',set,'colour_2')
 }else{
  const mask=add('threshold');wire(src,'image',mask)
  if(id==='simple'){const stencil=add('stencil');wire(mask,'mask',stencil)}
  else if(id==='vector'){const trace=add('trace'),stencil=add('vector_stencil');wire(mask,'mask',trace);wire(trace,'shapes',stencil)}
  else if(id==='mounted'){
   const stencil=add('stencil',{width_mm:400,margin_mm:12,thickness_mm:6}),tiles=add('tiles',{max_x:200,max_y:200}),pads=add('pads'),hardware=add('hardware')
   wire(mask,'mask',stencil);wire(stencil,'solid',tiles);wire(tiles,'parts',pads);wire(pads,'parts',hardware)
  }else if(id==='first'){
   const layout=add('tile_layout',{width_mm:400,margin_mm:12,max_x:200,max_y:200}),stencil=add('stencil',{thickness_mm:6}),pads=add('pads'),hardware=add('hardware')
   wire(mask,'mask',layout);wire(mask,'mask',stencil);wire(layout,'tiles',stencil);wire(stencil,'parts',pads);wire(pads,'parts',hardware)
  }else throw Error('Choose one of the original workflow templates.')
 }
 return {nodes,edges}
}
export function applyOriginalWorkflow(current:ProjectDocument,id:string,sourceId:string,catalogue:NodeType[]):ProjectDocument{
 const source=operations(current).find(n=>n.id===sourceId&&n.type==='source');if(!source)throw Error('Choose the original image for the new workflow copy.')
 if(!current.raw.images?.[String(source.params.image_id)])throw Error('This image is not embedded. Save and reopen the complete project before applying a workflow copy.')
 const template=originalWorkflows.find(t=>t.id===id);if(!template)throw Error('Choose a workflow template.')
 const next:ProjectDocument={raw:{version:2,graph:originalWorkflow(id,String(source.params.image_id),catalogue),images:copy(current.raw.images),stencilStudio:{schema:2,name:template.name,previousProject:copy(current.raw)}}}
 validateRecipe(next,catalogue);compileRecipe(next);return next
}
