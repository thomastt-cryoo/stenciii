import type { NodeType } from '../api'
import { compileRecipe, copy, object, operations, rawGraph, type ProjectDocument } from './project'
import { validateRecipe } from './artwork'

export const geometryTypes = ['stencil','vector_stencil','remesh'] as const
export const geometryType = (type: string) => type === 'complexity' ? 'remesh' : type
export const isGeometry = (type: string) => (geometryTypes as readonly string[]).includes(geometryType(type))
export const geometryNames: Record<string,string> = { stencil:'Make raster stencil', vector_stencil:'Make vector stencil', remesh:'Optimize mesh', complexity:'Optimize mesh' }
export const geometryGroups: Record<string,string[]> = {
  'Size & physical construction':['width_mm','thickness_mm','margin_mm','flip'],
  'Bridge placement':['bridge_mm','bridges_per_island','bridge_spacing','bridge_min_angle_deg','bridge_max_length','bridge_passes','min_island_mm2'],
  'Bridge height & layers':['raised_bridges','z_bridging','layer_height_mm','extra_top_layers'],
  'Strength & stability':['min_contact_mm','min_first_layer_width_mm','first_layer_taper_mm','max_overhang_deg'],
  'Vector precision':['detail'], 'Existing tile inputs':['tile_method'],
  'Reconstruction interval':['layer_from','layer_to'],
  'Surface & outline precision':['tolerance_mm','smoothing','keep_material','max_overhang_deg'],
  'Flat-face simplification':['decimate','decimate_mm'],
}
const common: Record<string,string> = {
  width_mm:'Full plate width, including its margins. The height follows the prepared artwork aspect ratio.',
  thickness_mm:'Requested base thickness. The engine rounds it to whole print layers, with at least one layer; additional top layers increase the final height.',
  margin_mm:'Solid border on each side. Keep twice the margin smaller than the plate width.',
  flip:'Turn the stencil upside down for printing. The engine mirrors left/right and reverses the height construction, including the first-layer reinforcement.',
  bridge_mm:'Requested width of automatic supports for enclosed material islands. Raster widths are quantized to working pixels; vector widths follow the outlines.',
  bridges_per_island:'Requested supports per enclosed island. Available space can limit the actual placement. There is no universal bridge-disable switch.',
  bridge_spacing:'Closest prefers short routes. Spread seeks separated directions and can use longer routes to support crowded islands.',
  bridge_min_angle_deg:'Desired angular separation in spread mode. The engine can relax it when space is limited to keep islands supported.',
  bridge_max_length:'Spread search reach relative to the shortest route; this is a multiplier, not millimetres.',
  bridge_passes:'Spread search passes. Vector placement stages nearby islands across passes; raster placement retries angular separation in this many levels, ending with a fallback route. Simple artwork may stay unchanged.',
  raised_bridges:'Start bridge material above the bed so paint can pass beneath. The complete solid can be connected even when its first layer has separate areas.',
  z_bridging:'Easy places raised supports at a common height. Steps builds rising supports in print-layer increments. Both need enough base layers to rise.',
  layer_height_mm:'Physical print-layer interval used to quantize base height, bridge steps, top layers and later mesh reconstruction.',
  extra_top_layers:'Full layers added above the quantized base. Final height is (rounded base layers + extra layers) × layer height.',
  max_overhang_deg:'Angle from vertical used to measure overhanging surface area. Zero uses the engine’s 45° default. This check reports geometry; it does not add supports or change the STL.',
  min_island_mm2:'Delete enclosed material islands smaller than this physical area before building bridges. Zero keeps them; deletion changes the artwork.',
  min_contact_mm:'Widen narrow material connections before selecting bridges. Zero keeps the original surface contacts.',
  min_first_layer_width_mm:'Add tapered material at narrow bed contacts. Zero disables first-layer widening; upper artwork and bridge selection are retained.',
  first_layer_taper_mm:'Height over which bed reinforcement returns to the original shape, rounded up to complete layers. With reinforcement enabled, this must be above zero and no greater than the requested base thickness.',
  detail:'Curve-flattening precision for vector extrusion. Higher values generally retain more outline detail and create more triangles.',
  tile_method:'For an existing tile layout: build each tile separately, or cut a complete vector stencil. Layout width and margin take precedence; tile design remains in the manufacturing editor.',
}
const remesh: Record<string,string> = {
  layer_from:'First layer to reconstruct, counted from 1 using the source stencil’s saved layer height.',
  layer_to:'Last layer to reconstruct. Zero means through the top of the model. A short interval may save few triangles.',
  tolerance_mm:'Largest permitted shift of reconstructed outlines. The engine can lower the tolerance or retain the original model if reconstruction is unsafe.',
  smoothing:'How strongly shared layer outlines are smoothed before simplification. Zero keeps sharp outline features.',
  keep_material:'Constrain reconstructed outlines toward material instead of removing it. The engine still applies its documented rounding tolerances.',
  max_overhang_deg:'Limit new overhang introduced by reconstruction, measured from vertical. Existing source overhangs are retained. 90° turns this additional limit off.',
  decimate:'Collapse redundant vertices on flat faces and straight edges after reconstruction. This changes the exported mesh, unlike display detail.',
  decimate_mm:'Maximum surface shift allowed during flat-face simplification, within the selected layer interval.',
}
export const geometryHelp: Record<string,string> = Object.fromEntries([
  ...['stencil','vector_stencil'].flatMap(t=>Object.entries(common).map(([k,v])=>[`${t}.${k}`,v])),
  ...Object.entries(remesh).map(([k,v])=>[`remesh.${k}`,v]),
])
export const quantizedHeight = (params: Record<string,unknown>) => {
  const layer=Number(params.layer_height_mm??.2), base=Math.max(1,Math.round(Number(params.thickness_mm??5)/layer)), extra=Number(params.extra_top_layers??1)
  return { layers:base+extra, height:(base+extra)*layer, baseLayers:base, layer }
}
/** Only declared single-solid results can enter reconstruction. Tiled builders
 * return Parts instead of their advertised alternative Solid output. */
export function remeshCompatibility(doc: ProjectDocument, id: string) {
  const graph=compileRecipe(doc), node=graph.nodes.find(n=>n.id===id)
  if(!node || !['stencil','vector_stencil','remesh'].includes(node.type))return {allowed:false,reason:'Choose a stencil solid or an existing optimized solid.'}
  const seen=new Set<string>();let current=node
  while(current.type==='remesh'){
    if(seen.has(current.id))return {allowed:false,reason:'This saved input is circular.'};seen.add(current.id)
    const edge=graph.edges.find(e=>e.to[0]===current.id&&e.to[1]==='solid');const parent=graph.nodes.find(n=>n.id===edge?.from[0])
    if(!parent)return {allowed:false,reason:'Choose a connected stencil solid.'};current=parent
  }
  if(!['stencil','vector_stencil'].includes(current.type)||graph.edges.some(e=>e.to[0]===current.id&&e.to[1]==='tiles'))return {allowed:false,reason:'Mesh optimization needs one stencil solid. This saved result supplies tiled or manufacturing parts; its data stays intact.'}
  return {allowed:true,reason:'Reconstruct this solid after stencil construction and before manufacturing steps.'}
}
export function addRemesh(doc: ProjectDocument,id: string,catalogue: NodeType[]) {
  const compatible=remeshCompatibility(doc,id);if(!compatible.allowed)throw Error(compatible.reason)
  const next=copy(doc),g=rawGraph(next),reserved=new Set([...operations(next).map(n=>n.id),...Object.keys(next.raw.stencilStudio?.disabled??{})])
  let name='remesh-1',i=1;while(reserved.has(name))name=`remesh-${++i}`
  if(next.raw.stencilStudio!=null&&!object(next.raw.stencilStudio))throw Error('The saved editor metadata is unsupported and remains unchanged.')
  const metadata=next.raw.stencilStudio??={};if(metadata.retired!=null&&!Array.isArray(metadata.retired))throw Error('The project archive uses an unsupported format.')
  const outgoing=g.edges.filter((e:any)=>(e.from??[e.source,e.sourceHandle])[0]===id&&(e.from??[e.source,e.sourceHandle])[1]==='solid')
  ;(metadata.retired??=[]).push({label:'Add mesh optimization',data:copy(outgoing)})
  if(!outgoing.length && object(metadata.passNames) && typeof metadata.passNames[id]==='string') metadata.passNames={...metadata.passNames,[name]:metadata.passNames[id]}
  g.edges=g.edges.filter((e:any)=>!outgoing.includes(e))
  for(const original of outgoing){const e=copy(original);if(e.from)e.from[0]=name;else{e.source=name;e.id=`${name}/solid-${e.target}/${e.targetHandle}`};g.edges.push(e)}
  g.nodes.push({id:name,type:'remesh',params:Object.fromEntries(catalogue.find(t=>t.id==='remesh')!.params.map(p=>[p.name,p.default]))})
  g.edges.push({from:[id,'solid'],to:[name,'solid']});validateRecipe(next,catalogue);return next
}
