import {readFileSync} from 'node:fs'
import type {NodeType} from '../src/api'
import {geometrySvg} from './m4-fixtures'
export const catalogue:NodeType[]=JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json',import.meta.url),'utf8'))
export const coloursSvg='<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120">'+Array.from({length:10},(_,i)=>`<rect x="${20*i}" width="20" height="120" fill="rgb(${i*25},${i*25},${i*25})"/>`).join('')+'<rect x="190" y="10" width="1" height="1" fill="black"/></svg>'
export const step=(id:string,type:string,params:Record<string,unknown>={})=>({id,type,params:{...Object.fromEntries(catalogue.find(t=>t.id===type)!.params.map(p=>[p.name,p.default])),...params}})
export function m5Project(type:string,key:string){
 const nodes=[step('source','source',{image_id:'original',resolution:200})],edges:{from:[string,string];to:[string,string]}[]=[]
 const wire=(from:[string,string],to:[string,string])=>edges.push({from,to})
 if(type==='split_colours'||type==='tone_patterns'){
  const target=step('test',type)
  if(type==='tone_patterns'&&/_\d+$/.test(key))target.params[`kind_${key.split('_').at(-1)}`]='lines'
  nodes.push(target);wire(['source','image'],['test','image'])
 }else if(type==='colour_set'){
  nodes.push(step('split','split_colours',{colours:10}))
  wire(['source','image'],['split','image'])
  for(let i=1;i<=3;i++){nodes.push(step(`trace-${i}`,'trace',{smooth:0,tolerance:.2,min_area:0}),step(`plate-${i}`,'vector_stencil',{width_mm:100,margin_mm:10,thickness_mm:3,detail:2}));wire(['split',`colour_${i*3}`],[`trace-${i}`,'mask']);wire([`trace-${i}`,'shapes'],[`plate-${i}`,'shapes']);wire([`plate-${i}`,'solid'],['test',`colour_${i}`])}
  nodes.push(step('test',type))
 }else if(['tile_layout','tiles','fragments'].includes(type)){
  let svg=geometrySvg,width=180,margin=18,maxX=110,maxY=160
  if(key==='seam_shift'){svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="white"/><rect x="48" y="10" width="4" height="50" fill="black"/></svg>';width=100;margin=0;maxX=60;maxY=2000}
  if(type==='tiles'&&key==='reinforce'){svg='<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="black"/><g fill="white"><rect width="30" height="60"/><rect x="30" y="28.5" width="40" height="3"/><rect x="70" width="30" height="60"/></g></svg>';width=100;margin=0;maxX=60;maxY=2000}
  if(type==='fragments'||['bridge_islands','bridge_mm','bridges_per_island','raised_bridges','z_bridging'].includes(key)){
   svg='<svg xmlns="http://www.w3.org/2000/svg" width="140" height="60"><rect width="140" height="60" fill="black"/><g fill="white"><rect width="60" height="60"/><rect x="60" y="15" width="20" height="30"/><rect x="72" y="10" width="18" height="40"/><rect x="100" width="40" height="60"/><rect y="56" width="140" height="4"/></g></svg>';width=140;margin=0;maxX=70;maxY=2000
  }
  nodes[0]=step('source','source',{image_id:'original',resolution:280});nodes.push(step('paint','threshold'),step('trace','trace',{smooth:0,tolerance:0,min_area:0}));wire(['source','image'],['paint','image']);wire(['paint','mask'],['trace','mask'])
  const build=step(type==='tile_layout'?'built':'build','vector_stencil',{width_mm:width,margin_mm:margin,thickness_mm:6,extra_top_layers:0,detail:2,raised_bridges:false})
  const tileParams={max_x:maxX,max_y:maxY,depth:6,seam_shift:key==='seam_shift'?(type==='tile_layout'?10:5):0,connector:key==='segments'?'round':'hex',segments:48}
  if(type==='tile_layout'){nodes.push(step('test',type,{...tileParams,width_mm:width,margin_mm:margin}),build);wire(['trace','shapes'],['test','shapes']);wire(['test','tiles'],['built','tiles'])}
  else{nodes.push(build,step(type==='fragments'?'split':'test','tiles',{...tileParams,bridge_islands:type!=='fragments',reinforce:key==='reinforce'}));wire(['trace','shapes'],['build','shapes']);wire(['build','solid'],[type==='fragments'?'split':'test','solid']);if(type==='fragments'){nodes.push(step('test',type));wire(['split','parts'],['test','parts'])}}
  return{version:2,stencilStudio:{schema:1,name:`M5 ${type}`},opaque:{keep:[17,false,'M5']},images:{original:{name:'tile-art.svg',base64:Buffer.from(svg).toString('base64')},unused:{name:'keep.svg',base64:Buffer.from('<svg/>').toString('base64')}},graph:{nodes,edges}}
 }else if(['pads','ring','hardware'].includes(type)){
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><circle cx="60" cy="60" r="35" fill="none" stroke="black" stroke-width="10"/></svg>'
  nodes[0]=step('source','source',{image_id:'original',resolution:120});nodes.push(step('paint','threshold'),step('build','stencil',{width_mm:140,margin_mm:12,thickness_mm:6,extra_top_layers:0}),step('sections','tiles',{max_x:80,max_y:80,seam_shift:0,depth:6,segments:24}),step(type==='pads'?'test':'mount','pads',{pad_thread:type==='pads'?'M4':'none',mount_screw:'M4',hole_spacing:40,long_edge:100,segments:24}))
  wire(['source','image'],['paint','image']);wire(['paint','mask'],['build','mask']);wire(['build','solid'],['sections','solid']);wire(['sections','parts'],[type==='pads'?'test':'mount','parts'])
  if(type==='ring'){nodes.push(step('test','ring',{width:30,slab_length:90,wall_holes:true,hole_spacing:50,segments:24}));wire(['mount','parts'],['test','parts'])}
  if(type==='hardware'){nodes.push(step('test','hardware',{fit_test:['connector','connector_d'].includes(key),segments:24}));wire(['mount','parts'],['test','parts'])}
  return{version:2,stencilStudio:{schema:1,name:`M5 ${type}`},opaque:{keep:[17,false,'M5']},images:{original:{name:'ring-art.svg',base64:Buffer.from(svg).toString('base64')},unused:{name:'keep.svg',base64:Buffer.from('<svg/>').toString('base64')}},graph:{nodes,edges}}
 }
 return{version:2,stencilStudio:{schema:1,name:`M5 ${type}`},opaque:{keep:[17,false,'M5']},images:{original:{name:'tones.svg',base64:Buffer.from(coloursSvg).toString('base64')},unused:{name:'keep.svg',base64:Buffer.from('<svg/>').toString('base64')}},graph:{nodes,edges}}
}
export const changesA:Record<string,unknown>={colours:5,invert:true,min_area:1,plate_width_mm:150,kind:'dots',spacing_mm:1.4,angle:20,holes:2,hole_d:3.5,inset:5.5,pins:false,pin_clearance:.4,pin_length:18,...Object.fromEntries(Array.from({length:8},(_,k)=>[[`kind_${k+1}`,'dots'],[`spacing_${k+1}`,3.3],[`cover_${k+1}`,41]]).flat())}
export const changesB:Record<string,unknown>={width_mm:220,margin_mm:22,max_x:80,max_y:80,seam_shift:0,connector:'round',connector_d:'4',depth:8,clearance:.4,spacing:55,segments:32,edits:'{"seams":{"x1":1},"pockets":{}}',seam_gap:.4,seam_angle_deg:20,reinforce:false,bridge_islands:false,bridge_mm:2.4,bridges_per_island:2,raised_bridges:false,z_bridging:'steps',keep:2}
export const changesC:Record<string,unknown>={pad_thread:'none',pad_height:6,thread_clearance:.35,long_edge:60,mount_screw:'M3',mount_threaded:true,mount_clearance:.6,hole_spacing:35,joiner_offset:16,extend:35,segments:32,width:40,rings:2,slab_length:160,gap:.3,joiner_thickness:5,hardware:false,screw_length:20,nut_clearance:.35,tip_taper:.5,tip_pitches:2,number_parts:false,number_size:7,pocket_depth:.4,wall_holes:false,plate:false,plate_distance:40,plate_height:5,plate_padding:5,plate_threaded:true,plate_clearance:.6,screw:'M6',length:25,fit_test:true,connector:'round',connector_d:'4'}
