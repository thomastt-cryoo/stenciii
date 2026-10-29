import {readFileSync} from 'node:fs'
import type {NodeType} from '../src/api'
export const catalogue:NodeType[]=JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json',import.meta.url),'utf8'))
export const geometrySvg='<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" fill="white"/><rect x="12" y="12" width="216" height="156" fill="black"/><g fill="white"><circle cx="50" cy="60" r="18"/><circle cx="105" cy="62" r="17"/><circle cx="145" cy="58" r="14"/><circle cx="185" cy="55" r="10"/><rect x="30" y="110" width="35" height="25"/><rect x="63" y="120" width="45" height="2"/><rect x="106" y="110" width="45" height="25"/><circle cx="195" cy="130" r="1.5"/></g></svg>'
function ringBmp(){const w=120,stride=w*3,b=Buffer.alloc(54+stride*w,255);b.write('BM');b.writeUInt32LE(b.length,2);b.fill(0,6,54);b.writeUInt32LE(54,10);b.writeUInt32LE(40,14);b.writeInt32LE(w,18);b.writeInt32LE(w,22);b.writeUInt16LE(1,26);b.writeUInt16LE(24,28);for(let y=0;y<w;y++)for(let x=0;x<w;x++){const d=Math.floor(Math.hypot(x-60,y-60)),n=d>=30&&d<40?0:255;for(let c=0;c<3;c++)b[54+(w-1-y)*stride+x*3+c]=n}return b}
export const changes:Record<string,unknown>={width_mm:140,thickness_mm:3.4,margin_mm:10,flip:true,bridge_mm:2.5,bridges_per_island:1,bridge_spacing:'spread',bridge_min_angle_deg:85,bridge_max_length:1,bridge_passes:1,raised_bridges:false,z_bridging:'steps',layer_height_mm:.3,extra_top_layers:4,max_overhang_deg:85,min_island_mm2:10,min_contact_mm:2.5,min_first_layer_width_mm:2.5,first_layer_taper_mm:1.6,detail:12,tile_method:'cut_whole',layer_from:4,layer_to:6,tolerance_mm:.4,smoothing:1,keep_material:false,decimate:true,decimate_mm:.15}
export function geometryProject(type:string,key:string){
 const step=(id:string,type:string,params:Record<string,unknown>={})=>({id,type,params:{...Object.fromEntries(catalogue.find(t=>t.id===type)!.params.map(p=>[p.name,p.default])),...params}})
 const common={width_mm:100,thickness_mm:2.4,margin_mm:4,bridge_mm:1.2,bridges_per_island:3,bridge_spacing:'spread',raised_bridges:true,layer_height_mm:.2,extra_top_layers:1}
 const source=step('source','source',{image_id:'original',resolution:160}),paint=step('paint','threshold'),trace=step('trace','trace',{smooth:0,tolerance:.2,min_area:.2,corner_deg:30}),builder=step(type==='remesh'?'build':'test',type==='stencil'?'stencil':'vector_stencil',common)
 if(key==='bridge_spacing')builder.params.bridge_spacing='closest'
 if(key==='bridge_min_angle_deg'){builder.params.bridges_per_island=5;builder.params.bridge_passes=8}
 if(key==='first_layer_taper_mm'){builder.params.min_first_layer_width_mm=type==='stencil'?5:2.5;builder.params.first_layer_taper_mm=.4}

 let nodes:any[]=type==='stencil'?[source,paint,builder]:[source,paint,trace,builder]
 if(type==='remesh'&&!['decimate','decimate_mm'].includes(key)){
  const base=step('build','stencil',{...common,raised_bridges:false})
  const settings:Record<string,unknown>={decimate:key==='decimate_mm',tolerance_mm:.2,smoothing:.5}
  if(key==='max_overhang_deg'){Object.assign(base.params,{min_first_layer_width_mm:3,first_layer_taper_mm:2.4});Object.assign(settings,{layer_from:1,layer_to:0,tolerance_mm:1,smoothing:1,keep_material:false,max_overhang_deg:10})}
  nodes=[step('text','text',{text:'BOA',size:160}),base,step('test','remesh',settings)]
 }
 if(type==='remesh'&&['decimate','decimate_mm'].includes(key)){builder.params.z_bridging='steps';nodes.push(step('test','remesh',{decimate:key==='decimate_mm',tolerance_mm:.2,smoothing:.5}))}
 let edges=nodes.slice(0,-1).map((n,i)=>({from:[n.id,catalogue.find(t=>t.id===n.type)!.outputs[0].name],to:[nodes[i+1].id,catalogue.find(t=>t.id===nodes[i+1].type)!.inputs[0].name]}))
 if(key==='tile_method'){
  builder.params.thickness_mm=5
  const layout=step('layout','tile_layout',{width_mm:100,margin_mm:4,max_x:60,max_y:150,depth:5,segments:12})
  nodes.splice(nodes.length-1,0,layout);edges=edges.filter(e=>e.to[0]!=='test');edges.push({from:['trace','shapes'],to:['layout','shapes']},{from:['layout','tiles'],to:['test','tiles']})
 }
 const bytes=key==='bridge_passes'&&type==='stencil'?ringBmp():Buffer.from(geometrySvg)
 if(key==='bridge_passes'&&type==='stencil'){source.params.resolution=120;builder.params.bridge_min_angle_deg=60;builder.params.bridge_mm=1.6;builder.params.margin_mm=8;builder.params.width_mm=200}
 return {version:2,graph:{nodes,edges},images:{original:{name:bytes[0]===66?'Ring.bmp':'Geometry.svg',base64:bytes.toString('base64')}},stencilStudio:{name:'Geometry verification',passNames:{test:'Geometry proof'}},opaque:{preserve:[1,false,'M4']}}
}
