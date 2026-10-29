import type { NodeType } from '../api'
import mapping from '../../../docs/audit/parameter-mapping.json' with {type:'json'}
import { compileRecipe, copy, operations, rawGraph, type ProjectDocument } from './project'
import { validateRecipe } from './artwork'

export const manufacturingTypes=['split_colours','tone_patterns','tile_layout','export','tiles','pads','ring','fragments','colour_set','hardware']
export const implementedManufacturingTypes=['split_colours','tone_patterns','colour_set','tile_layout','tiles','fragments','pads','ring','hardware']
export const isManufacturing=(type:string)=>implementedManufacturingTypes.includes(type)
export const manufacturingNames:Record<string,string>={split_colours:'Separate colours',tone_patterns:'Apply tone patterns',colour_set:'Register colour plates',tile_layout:'Plan printable sections',tiles:'Split finished stencil',pads:'Pads & mounting holes',ring:'Expanded borders',hardware:'Screws, nuts & plates',fragments:'Remove tile fragments',export:'Legacy tiles & mounting'}
const help:Record<string,string>={
 'split_colours.colours':'Maximum separated colours, from two to ten. The engine reduces images with more colours; an image with fewer colours produces fewer masks.',
 'split_colours.invert':'Reverse the lightness order of the separated colours. It does not invert each individual mask.',
 'split_colours.min_area':'Remove separate regions smaller than this percentage of the whole image from each colour mask. Zero keeps them.',
 'tone_patterns.plate_width_mm':'Physical plate width used to convert pattern spacing in millimetres to working pixels. Match the width of the stencil you will build.',
 'tone_patterns.kind':'Default pattern for intermediate tones. Auto lets the engine choose; darkest is solid paint and lightest is empty.',
 'tone_patterns.spacing_mm':'Default distance between pattern marks in millimetres. Zero turns intermediate patterned tones into solid paint; use a positive spacing for patterns.',
 'tone_patterns.angle':'Pattern angle in degrees. This changes lines and crosshatching where the selected pattern uses direction.',
 'tone_patterns.invert':'Reverse lightness ranking before assigning solid paint, intermediate patterns and empty background.',
 'colour_set.holes':'Matching registration holes in each plate margin. Zero leaves the plates unchanged and disables pins.',
 'colour_set.hole_d':'Diameter of each registration hole. Each plate needs a margin at least this diameter plus 1 mm.',
 'colour_set.inset':'Hole centre distance from the outside edge. Zero chooses the middle of the margin band; holes must remain inside it.',
 'colour_set.pins':'Include a real alignment pin STL with the registered plates. Requires registration holes.',
 'colour_set.pin_clearance':'Diametral clearance: subtracted from hole diameter to size the pin. Printer fit still needs physical calibration.',
 'colour_set.pin_length':'Length of the alignment pins in millimetres.',
 'pads.pad_thread':'Size of the real threaded mounting pads. None omits pads while allowing separately configured mounting holes. The margin must fit the thread diameter plus 4 mm.',
 'pads.pad_height':'Pad and mounting-boss height above the plate. When printed upside down, the original engine uses threaded holes instead of raised pads.',
 'pads.thread_clearance':'Radial thread fit allowance. A 0.2 mm radial allowance changes the mating diameter by 0.4 mm; this differs from ordinary-hole diametral clearance.',
 'pads.long_edge':'Add intermediate pads along edges longer than this distance. Zero leaves the corner pads without this additional spacing rule.',
 'pads.mount_screw':'Select the screw size for mounting holes and their specialized joiner/extender plates. None omits mounting holes.',
 'pads.mount_threaded':'Cut real threads in mounting holes instead of plain clearance holes.',
 'pads.mount_clearance':'Diametral hole allowance, added to the nominal screw diameter. For threaded holes the engine converts this to a radial thread allowance.',
 'pads.hole_spacing':'Distance between mounting holes along the frame band. Zero omits regularly spaced extra holes; seam joining can still place required holes.',
 'pads.joiner_offset':'Distance of mounting holes from either side of a seam. The engine moves colliding positions or refuses an impossible layout.',
 'pads.extend':'Distance between the two rows of an extender plate, not the outer plate length.',
 'pads.segments':'Round and thread detail. Higher values increase the actual STL triangle count and processing cost.',
 'ring.width':'Physical width added around the assembled stencil in each ring. Every slab must retain a screw hole.',
 'ring.rings':'Number of nested border rings. Each wraps the previous ring and has its own numbered slabs.',
 'ring.slab_length':'Maximum border slab length. The engine keeps corner pieces and requires a mounting hole in every slab.',
 'ring.gap':'Total fit gap between slabs and between the border and plate. The engine offsets slab edges while keeping joint hole positions fixed.',
 'ring.joiner_thickness':'Thickness of the specialized border joiner plates.',
 'ring.hardware':'Include the actual threaded bolt and nut models required for border joints. When off, supply suitable fasteners separately.',
 'ring.screw_length':'Bolt length in millimetres. Zero calculates enough length for joiner, slab and nut.',
 'ring.nut_clearance':'Radial female-thread allowance for the nut. Physical calibration is still required for your printer and material.',
 'ring.tip_taper':'Radial narrowing at the bolt tip; zero keeps a plain end.',
 'ring.tip_pitches':'Length of the bolt-tip narrowing in thread pitches. Used only when tip taper is above zero.',
 'ring.number_parts':'Cut a number into each slab. Its number matches the engine’s slab order and assembly file.',
 'ring.number_size':'Size of the recessed slab number. If there is no safe position, the engine reports the unnumbered slab.',
 'ring.pocket_depth':'Depth of the number pocket. Zero uses one source print layer; the cut must leave material below it.',
 'ring.wall_holes':'Add outer-ring wall mounting holes, because the original plate holes are now used by the border joints.',
 'ring.hole_spacing':'Spacing of wall mounting holes on the outer ring. Applies when wall holes are enabled.',
 'ring.segments':'Round and thread detail for border holes and accompanying hardware.',
 'hardware.extend':'Distance between the rows of the four-hole hand-sized plate and any extender matched to connected mounting parts.',
 'hardware.joiner_thickness':'Thickness of joiners matched to a connected mounting assembly. Hand-sized plates have their own independent thickness.',
 'hardware.plate':'Include independently sized two-hole and four-hole plates, alongside the screw and nut.',
 'hardware.plate_distance':'Centre-to-centre distance between the two holes in the hand-sized plate.',
 'hardware.plate_height':'Thickness of the hand-sized plates in millimetres.',
 'hardware.plate_padding':'Material padding around the holes and rounded plate ends.',
 'hardware.plate_threaded':'Cut real female threads in the hand-sized plates instead of plain clearance holes.',
 'hardware.plate_clearance':'Diametral allowance for the hand-sized plate holes; the engine halves it when constructing female threads.',
 'hardware.screw':'Metric screw size. M3, M4, M5, M6, M8 and M10 use the original real-thread generator.',
 'hardware.length':'Threaded bolt length in millimetres, excluding its head.',
 'hardware.nut_clearance':'Radial female-thread allowance in the nut. Test the printed fit before committing a complete assembly.',
 'hardware.tip_taper':'Radial bolt-tip narrowing. Zero keeps the nominal thread through the tip.',
 'hardware.tip_pitches':'Length of tip narrowing in thread pitches; inactive when taper is zero.',
 'hardware.fit_test':'Generate the real connector calibration strip, with holes of increasing clearance. Use the matching nominal tile connector rod for physical calibration. Every file is still independently checked.',
 'hardware.connector':'Shape of the calibration strip holes and matching connector rod.',
 'hardware.connector_d':'Nominal calibration connector diameter. This is separate from the metric screw size.',
 'hardware.segments':'Round and thread detail in the generated meshes. Higher detail uses more memory and time.',
}
for(let i=1;i<=8;i++){
 help[`tone_patterns.kind_${i}`]=`Pattern for intermediate tone ${i}. Auto inherits the default pattern; solid and empty explicitly replace this tone. This override is used only if that tone exists.`
 help[`tone_patterns.spacing_${i}`]=`Spacing override for intermediate tone ${i}, in millimetres. Zero inherits the default spacing. Used only for a pattern with spacing.`
 help[`tone_patterns.cover_${i}`]=`Paint coverage override for intermediate tone ${i}, as a percentage. Zero uses the engine's tone-rank-based coverage; solid and empty patterns do not use coverage.`
}
export const manufacturingHelp:Record<string,string>=Object.fromEntries(mapping.filter(p=>manufacturingTypes.includes(p.type)).map(p=>[p.key,help[p.key]??p.dependency]))
Object.assign(manufacturingHelp,help)

export const imageChoices=(doc:ProjectDocument,catalogue:NodeType[])=>compileRecipe(doc).nodes.flatMap(n=>(catalogue.find(t=>t.id===n.type)?.outputs??[]).filter(p=>p.type==='image').map(p=>({id:n.id,port:p.name,label:`${catalogue.find(t=>t.id===n.type)!.label} · ${n.id} · ${p.name}`})))
function metadata(doc:ProjectDocument){if(doc.raw.stencilStudio!=null&&(typeof doc.raw.stencilStudio!=='object'||Array.isArray(doc.raw.stencilStudio)))throw Error('Saved editor metadata is unsupported. The original project is retained.');return doc.raw.stencilStudio??={}}
export function appendOperation(doc:ProjectDocument,type:string,catalogue:NodeType[],inputs:Record<string,[string,string]>={},values:Record<string,unknown>={}){
 const g=rawGraph(doc),def=catalogue.find(t=>t.id===type);if(!def)throw Error('This operation is not available in the engine.')
 let id=`${type}-1`,i=1;while(g.nodes.some((n:any)=>n.id===id)||metadata(doc).disabled?.[id])id=`${type}-${++i}`
 g.nodes.push({id,type,params:{...Object.fromEntries(def.params.map(p=>[p.name,p.default])),...values}})
 for(const [port,from] of Object.entries(inputs))g.edges.push({from:[...from],to:[id,port]})
 return id
}
export function addColourAnalysis(doc:ProjectDocument,source:[string,string],colours:number,catalogue:NodeType[]){
 if(!Number.isInteger(colours)||colours<2||colours>10)throw Error('Choose two to ten colours.')
 if(!imageChoices(doc,catalogue).some(c=>c.id===source[0]&&c.port===source[1]))throw Error('Choose a compatible image result.')
 const next=copy(doc),split=appendOperation(next,'split_colours',catalogue,{image:source},{colours})
 validateRecipe(next,catalogue);return {doc:next,split}
}
function buildMask(doc:ProjectDocument,mask:[string,string],catalogue:NodeType[]){
 const template=operations(doc).find(n=>['stencil','vector_stencil'].includes(n.type)),type=template?.type??'vector_stencil',def=catalogue.find(t=>t.id===type)!
 const values=Object.fromEntries(def.params.filter(p=>template?.params[p.name]!==undefined).map(p=>[p.name,copy(template!.params[p.name])]))
 if(type==='vector_stencil'){const trace=appendOperation(doc,'trace',catalogue,{mask});return appendOperation(doc,type,catalogue,{shapes:[trace,'shapes']},values)}
 return appendOperation(doc,type,catalogue,{mask},values)
}
export interface ColourLayer{plate:string;split:string;port:string;name:string;colour:string;visible:boolean}
/** Append a new colour pass; never replace the original or unrelated branches. */
export function createColourLayers(doc:ProjectDocument,split:string,colours:string[],registered:boolean,catalogue:NodeType[]){
 if(colours.length<1||colours.length>10||!operations(doc).some(n=>n.id===split&&n.type==='split_colours'))throw Error('Analyse the actual image colours first.')
 const next=copy(doc),m=metadata(next),layers:ColourLayer[]=colours.map((colour,i)=>{const plate=buildMask(next,[split,`colour_${i+1}`],catalogue);return{plate,split,port:`colour_${i+1}`,name:`Colour ${i+1}`,colour,visible:true}})
 m.colourLayers=[...(m.colourLayers??[]),...layers];m.passNames={...m.passNames,...Object.fromEntries(layers.map(l=>[l.plate,l.name]))}
 const groups:string[]=[]
 if(registered)for(let i=0;i<layers.length;i+=6){const group=layers.slice(i,i+6),id=appendOperation(next,'colour_set',catalogue,Object.fromEntries(group.map((l,k)=>[`colour_${k+1}`,[l.plate,'solid']as[string,string]])));groups.push(id);m.colourAssemblies=[...(m.colourAssemblies??[]),{id,layers:group.map(l=>l.plate)}];m.passNames[id]=`Registration set ${groups.length} · ${group.length} colours`}
 m.colourGroups=[...(m.colourGroups??[]),...groups];validateRecipe(next,catalogue);return next
}
export function addToneWorkflow(doc:ProjectDocument,source:[string,string],catalogue:NodeType[]){
 if(!imageChoices(doc,catalogue).some(c=>c.id===source[0]&&c.port===source[1]))throw Error('Choose a compatible image result.')
 const next=copy(doc),reduce=appendOperation(next,'reduce',catalogue,{image:source},{colours:10,smooth:0}),tone=appendOperation(next,'tone_patterns',catalogue,{image:[reduce,'image']},{plate_width_mm:Number(operations(doc).find(n=>['stencil','vector_stencil'].includes(n.type))?.params.width_mm??200)})
 const plate=buildMask(next,[tone,'mask'],catalogue),m=metadata(next);m.passNames={...m.passNames,[plate]:'Tone-pattern stencil'};validateRecipe(next,catalogue);return next
}
export function editColourLayer(doc:ProjectDocument,id:string,change:Partial<Pick<ColourLayer,'name'|'visible'>>){
 const next=copy(doc),m=metadata(next),layer=m.colourLayers?.find((l:ColourLayer)=>l.plate===id);if(!layer)throw Error('This colour pass is no longer available.');Object.assign(layer,change);if(change.name)m.passNames={...m.passNames,[id]:change.name};return next
}

export function solidChoices(doc:ProjectDocument){const g=compileRecipe(doc);return g.nodes.filter(n=>n.type==='remesh'||['stencil','vector_stencil'].includes(n.type)&&!g.edges.some(e=>e.to[0]===n.id&&e.to[1]==='tiles'))}
export function partsChoices(doc:ProjectDocument,catalogue:NodeType[]){const g=compileRecipe(doc);return g.nodes.filter(n=>catalogue.find(t=>t.id===n.type)?.outputs.some(p=>p.type==='parts')&&(!['stencil','vector_stencil'].includes(n.type)||g.edges.some(e=>e.to[0]===n.id&&e.to[1]==='tiles')))}
export function tilePartChoices(doc:ProjectDocument,catalogue:NodeType[]){
 const g=compileRecipe(doc),seen=new Set<string>(),compatible=(id:string):boolean=>{if(seen.has(id))return false;seen.add(id);const n=g.nodes.find(n=>n.id===id);if(!n)return false;if(['tiles','export'].includes(n.type)||['stencil','vector_stencil'].includes(n.type)&&g.edges.some(e=>e.to[0]===id&&e.to[1]==='tiles'))return true;if(!['pads','ring','fragments'].includes(n.type))return false;const parent=g.edges.find(e=>e.to[0]===id&&e.to[1]==='parts');return !!parent&&compatible(parent.from[0])}
 return partsChoices(doc,catalogue).filter(n=>{seen.clear();return compatible(n.id)})
}
export function hasMountingInput(doc:ProjectDocument,id:string){
 const g=compileRecipe(doc),seen=new Set<string>();let n=g.nodes.find(n=>n.id===id)
 while(n&&!seen.has(n.id)){seen.add(n.id);if(n.type==='pads')return n.params.mount_screw!=='none';if(n.type==='export')return n.params.mount_screw!=null&&n.params.mount_screw!=='none';const edge=g.edges.find(e=>e.to[0]===n!.id&&e.to[1]==='parts');n=g.nodes.find(n=>n.id===edge?.from[0])}return false
}
export function createMountablePlate(doc:ProjectDocument,source:string,catalogue:NodeType[]){return createTiledWorkflow(doc,source,'after',2000,2000,catalogue)}
export function createHardware(doc:ProjectDocument,source:string|undefined,catalogue:NodeType[]){
 if(source&&!hasMountingInput(doc,source))throw Error('Choose parts with a mounting description, or create standalone hardware without an assembly input.')
 const next=copy(doc),id=appendOperation(next,'hardware',catalogue,source?{parts:[source,'parts']}:{}),m=metadata(next);m.passNames={...m.passNames,[id]:source?'Hardware for mounting assembly':'Standalone screws, nuts & plates'};validateRecipe(next,catalogue);return next
}
export function createTiledWorkflow(doc:ProjectDocument,source:string,strategy:'before'|'after',maxX:number,maxY:number,catalogue:NodeType[]){
 const g=compileRecipe(doc),base=g.nodes.find(n=>n.id===source);if(!base||!solidChoices(doc).some(n=>n.id===source))throw Error('Choose one compatible stencil solid before adding tiling.')
 if(!Number.isFinite(maxX)||!Number.isFinite(maxY)||maxX<25||maxY<25||maxX>2000||maxY>2000)throw Error('Enter printable dimensions from 25 to 2000 mm. Individual operation settings retain their own engine ranges.')
 const next=copy(doc),m=metadata(next);let output:string
 if(strategy==='before'){
  if(!['stencil','vector_stencil'].includes(base.type))throw Error('Planning before construction needs a stencil builder. For an optimized solid, use Split a finished stencil.')
  const port=base.type==='stencil'?'mask':'shapes',input=g.edges.find(e=>e.to[0]===source&&e.to[1]===port);if(!input)throw Error('This stencil has no compatible artwork input for a new layout.')
  const layout=appendOperation(next,'tile_layout',catalogue,{[port]:input.from},{width_mm:base.params.width_mm??200,margin_mm:base.params.margin_mm??8,max_x:maxX,max_y:maxY})
  output=appendOperation(next,base.type,catalogue,{tiles:[layout,'tiles']},copy(base.params))
 }else output=appendOperation(next,'tiles',catalogue,{solid:[source,'solid']},{max_x:maxX,max_y:maxY})
 m.passNames={...m.passNames,[output]:strategy==='before'?'Tile-first sections':'Sections from finished stencil'}
 m.manufacturingAssemblies=[...(m.manufacturingAssemblies??[]),{id:output,strategy,source}];validateRecipe(next,catalogue);return next
}
export function appendPartsProcessing(doc:ProjectDocument,source:string,type:string,catalogue:NodeType[]){
 if(!partsChoices(doc,catalogue).some(n=>n.id===source))throw Error('Choose compatible generated parts first.')
 if(!['fragments','pads','ring','hardware'].includes(type))throw Error('Choose a supported manufacturing operation.')
 const next=copy(doc),id=appendOperation(next,type,catalogue,{parts:[source,'parts']}),m=metadata(next);m.passNames={...m.passNames,[id]:manufacturingNames[type]};validateRecipe(next,catalogue);return next
}
