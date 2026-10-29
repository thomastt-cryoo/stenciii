import {readFileSync} from 'node:fs'
import type {NodeType} from '../src/api'
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
 }
 return{version:2,stencilStudio:{schema:1,name:`M5 ${type}`},opaque:{keep:[17,false,'M5']},images:{original:{name:'tones.svg',base64:Buffer.from(coloursSvg).toString('base64')},unused:{name:'keep.svg',base64:Buffer.from('<svg/>').toString('base64')}},graph:{nodes,edges}}
}
export const changesA:Record<string,unknown>={colours:5,invert:true,min_area:1,plate_width_mm:150,kind:'dots',spacing_mm:1.4,angle:20,holes:2,hole_d:3.5,inset:5.5,pins:false,pin_clearance:.4,pin_length:18,...Object.fromEntries(Array.from({length:8},(_,k)=>[[`kind_${k+1}`,'dots'],[`spacing_${k+1}`,3.3],[`cover_${k+1}`,41]]).flat())}
