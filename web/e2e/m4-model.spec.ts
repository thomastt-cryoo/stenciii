import { expect,test } from '@playwright/test'
import {readFileSync} from 'node:fs'
import {ParameterRegistry} from '../src/studio/registry'
import {editable,switchStyle,styleRecipe} from '../src/studio/recipes'
import {addRemesh,geometryHelp,geometryTypes,quantizedHeight,remeshCompatibility} from '../src/studio/geometry'
import {bypassArtwork,enableArtwork,validateRecipe,duplicatePass,inputChoices} from '../src/studio/artwork'
import {operations,rawGraph,editParameter,ProjectCommands,copy,compileRecipe} from '../src/studio/project'
import {inspectStl,meshProblems} from '../src/studio/meshAudit'
import {applyOperationPreset} from '../src/studio/Presets'
const catalogue=JSON.parse(readFileSync(new URL('../../docs/audit/runtime-catalogue.json',import.meta.url),'utf8')),registry=new ParameterRegistry(catalogue)
test('48 geometry slots and 89 unique editable slots keep every authoritative constraint, help and reset default',()=>{
 const scoped=registry.settings.filter(s=>(geometryTypes as readonly string[]).includes(s.type));expect(scoped).toHaveLength(48)
 expect(registry.settings.filter(s=>editable(s.type,s.parameter.name))).toHaveLength(89);expect(registry.settings).toHaveLength(217)
 for(const s of scoped){const p=s.parameter;expect(geometryHelp[s.key].length).toBeGreaterThan(20);expect(()=>registry.validate(s.type,p.name,p.default)).not.toThrow();if(['int','float'].includes(p.kind)){expect(()=>registry.validate(s.type,p.name,p.min!-p.step!)).toThrow();expect(()=>registry.validate(s.type,p.name,p.max!+p.step!)).toThrow()}if(p.choices)expect(()=>registry.validate(s.type,p.name,'invalid')).toThrow()}
})
test('quantized base, extra layers, special values and conditional geometry controls match actual engine semantics',()=>{
 expect(quantizedHeight({thickness_mm:2.11,layer_height_mm:.3,extra_top_layers:2})).toEqual({baseLayers:7,layers:9,height:2.6999999999999997,layer:.3})
 const active=(key:string,p={},ctx={})=>registry.availability(registry.settings.find(s=>s.key===key)!,p,ctx).active
 expect(active('stencil.bridge_min_angle_deg',{bridge_spacing:'closest'})).toBe(false);expect(active('stencil.bridge_passes',{bridge_spacing:'spread'})).toBe(true)
 expect(active('stencil.z_bridging',{raised_bridges:false})).toBe(false);expect(active('stencil.z_bridging',{raised_bridges:true,thickness_mm:.2,layer_height_mm:.2})).toBe(false)
 expect(active('vector_stencil.tile_method',{}, {hasLayout:true})).toBe(true);expect(active('vector_stencil.width_mm',{}, {hasLayout:true})).toBe(false)
 expect(active('stencil.first_layer_taper_mm',{min_first_layer_width_mm:0})).toBe(false);expect(active('remesh.decimate_mm',{decimate:false})).toBe(false)
})
test('mesh optimization is an ordinary typed reversible step with stable identity and saved settings',()=>{
 const history=new ProjectCommands(styleRecipe('image','A',catalogue));history.apply('add',d=>addRemesh(d,'plate',catalogue));validateRecipe(history.current!,catalogue)
 history.apply('adjust',d=>editParameter(d,'remesh-1','tolerance_mm',.25));const configured=copy(history.current!)
 history.apply('off',d=>bypassArtwork(d,'remesh-1',catalogue));expect(operations(history.current!).some(n=>n.type==='remesh')).toBe(false)
 history.apply('on',d=>enableArtwork(d,'remesh-1',catalogue));expect(operations(history.current!).find(n=>n.id==='remesh-1')!.params.tolerance_mm).toBe(.25)
 history.undo();history.undo();expect(history.current).toEqual(configured)
 let bank=switchStyle(configured,'smooth',catalogue);bank=switchStyle(bank,'standard',catalogue);expect(operations(bank).find(n=>n.id==='remesh-1')!.params.tolerance_mm).toBe(.25)
})
test('branch-scoped optimization preserves unknown raw data and rejects parts-producing stencil inputs',()=>{
 let doc=styleRecipe('i','A',catalogue);rawGraph(doc).nodes.push({id:'other',type:'vector_stencil',params:{width_mm:120},unknown:{keep:true}});rawGraph(doc).edges.push({from:['outlines','shapes'],to:['other','shapes'],opaque:'unchanged'});doc.raw.future={keep:[1,false]};doc.raw.images={unused:{base64:'AQID'}}
 const before=copy(doc);doc=addRemesh(doc,'plate',catalogue);expect(rawGraph(doc).nodes.find((n:any)=>n.id==='other')).toEqual(rawGraph(before).nodes.find((n:any)=>n.id==='other'));expect(rawGraph(doc).edges.find((e:any)=>e.to[0]==='other')).toEqual(rawGraph(before).edges.find((e:any)=>e.to[0]==='other'));expect(doc.raw.future).toEqual(before.raw.future);expect(doc.raw.images).toEqual(before.raw.images)
 doc=duplicatePass(doc,'remesh-1',catalogue);validateRecipe(doc,catalogue)
 const tiled=copy(before);rawGraph(tiled).nodes.push({id:'layout',type:'tile_layout',params:{}});rawGraph(tiled).edges.push({from:['outlines','shapes'],to:['layout','shapes']},{from:['layout','tiles'],to:['plate','tiles']})
 expect(remeshCompatibility(tiled,'plate').allowed).toBe(false);expect(()=>addRemesh(tiled,'plate',catalogue)).toThrow(/parts/)
})
test('legacy remesh alias and geometry presets edit only the chosen raw instance',()=>{
 let doc=addRemesh(styleRecipe('i','A',catalogue),'plate',catalogue);const n=rawGraph(doc).nodes.find((n:any)=>n.id==='remesh-1');n.type='complexity';n.opaque={keep:true}
 doc=applyOperationPreset(doc,'remesh-1',{tolerance_mm:.2,decimate:false},registry);expect(operations(doc).find(n=>n.id==='remesh-1')!.type).toBe('complexity');expect(compileRecipe(doc).nodes.find(n=>n.id==='remesh-1')!.type).toBe('remesh');expect(n.opaque).toEqual({keep:true})
 expect(inputChoices(doc,'remesh-1','solid',catalogue).some(c=>c.from[0]==='plate')).toBe(true)
})
const cube=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]],faces=[[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]]
function stl(parts=1,change=''){
 const count=(change==='open'?11:12)*parts,b=new ArrayBuffer(84+count*50),v=new DataView(b);v.setUint32(80,count,true);let t=0
 for(let k=0;k<parts;k++)for(let f=0;f<(change==='open'?11:12);f++,t++){
  let indices=[...faces[f]];if(f===0&&change==='reverse')indices.reverse();if(f===0&&change==='degenerate')indices=[0,0,1]
  indices.forEach((id,j)=>cube[id].forEach((n,c)=>v.setFloat32(96+t*50+j*12+c*4,n+(c===0?k*(change==='touch'?1:3):0)+(change==='touch'&&c!==0?k:0),true)))
 }return b
}
test('independent exact STL audit detects closure, winding, degeneracy, nonfinite normals and distinct closed components',()=>{
 const clean=inspectStl(stl());expect(clean.closed).toBe(true);expect(clean.components).toBe(1);expect(clean.signedVolume).toBeCloseTo(1);expect(clean.size).toEqual([1,1,1])
 expect(inspectStl(stl(1,'open')).edgesNotSharedTwice).toBeGreaterThan(0);expect(inspectStl(stl(1,'reverse')).inconsistentWinding).toBeGreaterThan(0);expect(inspectStl(stl(1,'degenerate')).degenerate).toBeGreaterThan(0)
 expect(inspectStl(stl(2)).components).toBe(2);expect(inspectStl(stl(2,'touch')).components).toBe(2)
 const bad=stl();new DataView(bad).setFloat32(84,Infinity,true);expect(()=>inspectStl(bad)).toThrow(/normals/)
 expect(meshProblems(inspectStl(stl(1,'open'))).length).toBeGreaterThan(0)
})
