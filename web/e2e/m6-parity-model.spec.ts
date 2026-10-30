import {test,expect} from '@playwright/test'
import {catalogue,m5Project} from './m5-fixtures'
import {openDocument,compileRecipe,editParameter,ProjectCommands,copy} from '../src/studio/project'
import {ParameterRegistry} from '../src/studio/registry'
import {originalWorkflow,originalWorkflows,applyOriginalWorkflow} from '../src/studio/workflowTemplates'
import {copyStepGroup,pasteStepGroup} from '../src/studio/stepClipboard'
import {setFitLink,synchronizeFit} from '../src/studio/sharedFit'
import {parseBook,mergeBook} from '../src/presetBook'
import {RunController} from '../src/studio/runController'
const registry=new ParameterRegistry(catalogue)

test('imported preset identities are data, preserve reserved names and cannot modify object prototypes',()=>{
 const raw=JSON.parse('{"presets":{"__proto__":{"pollutedByPreset":{"x":1}},"constructor":{"toString":{"__proto__":"retained","future":true}},"trace":{"constructor":{"smooth":2}}}}')
 const parsed=parseBook(raw),merged=mergeBook({},parsed)
 expect(({} as any).pollutedByPreset).toBeUndefined();expect(merged.added).toBe(3)
 expect(JSON.parse(JSON.stringify(merged.book))).toEqual(raw.presets)
 expect(mergeBook(merged.book,parseBook(raw)).added).toBe(0)
 expect(({} as any).pollutedByPreset).toBeUndefined()
})

test('reserved imported operation IDs retain failure state and cannot become exportable',async()=>{
 let captured=false
 const controller=new RunController({cancel(){},async run(_graph,step){step({node:'__proto__',state:{state:'error',error:'Actual operation failed'},n:0,total:1,log:[]});return{status:'done'}}},()=>{})
 await controller.execute('retained identity',async()=>({nodes:[{id:'__proto__',type:'source',params:{}}],edges:[]}),async()=>{captured=true;return 'invalid result'})
 expect(captured).toBe(false);expect(controller.state.status).toBe('error');expect(controller.state.failedStep).toBe('__proto__');expect(controller.exportable).toBe(false)
})
test('all six original workflows retain original topology, settings and complete source/project recovery',()=>{
 const expected:Record<string,string[]>={simple:['source','threshold','stencil'],tones:['source','reduce','tone_patterns','stencil'],vector:['source','threshold','trace','vector_stencil'],colours:['source','split_colours','stencil','stencil','colour_set'],mounted:['source','threshold','stencil','tiles','pads','hardware'],first:['source','threshold','tile_layout','stencil','pads','hardware']}
 const doc=openDocument(m5Project('tiles','max_x')),source=compileRecipe(doc).nodes.find(n=>n.type==='source')!,before=copy(doc.raw)
 for(const template of originalWorkflows){
  const graph=originalWorkflow(template.id,String(source.params.image_id),catalogue);expect(graph.nodes.map(n=>n.type)).toEqual(expected[template.id])
  for(const node of graph.nodes)expect(Object.keys(node.params).sort()).toEqual(catalogue.find(t=>t.id===node.type)!.params.map(p=>p.name).sort())
  const next=applyOriginalWorkflow(doc,template.id,source.id,catalogue);expect(next.raw.images).toEqual(before.images);expect(next.raw.stencilStudio.previousProject).toEqual(before)
  if(['mounted','first'].includes(template.id)){expect(graph.nodes.find(n=>n.type===(template.id==='first'?'tile_layout':'stencil'))!.params.width_mm).toBe(400);expect(graph.nodes.find(n=>n.type==='stencil')!.params.thickness_mm).toBe(6)}
  if(template.id==='first')expect(graph.edges.filter(e=>e.to[0]===graph.nodes.find(n=>n.type==='stencil')!.id)).toHaveLength(2)
 }
 expect(doc.raw).toEqual(before)
})
test('group clipboard retains connections and unknown fields, remaps identities and protects colliding original images',()=>{
 const doc=openDocument(m5Project('tiles','max_x')),graph=doc.raw.graph,source=graph.nodes.find((n:any)=>n.type==='source')
 graph.nodes.find((n:any)=>n.id==='test').custom={nested:[false,19]};graph.edges[0].opaque={keep:'edge data'}
 const before=copy(doc.raw),clip=copyStepGroup(doc,['test']);expect(clip.nodes).toHaveLength(graph.nodes.length)
 const target=openDocument(m5Project('tiles','seam_gap'));target.raw.images.original={name:'different.svg',base64:btoa('<svg/>'),opaque:{keep:true}}
 const originalTarget=copy(target.raw),pasted=pasteStepGroup(target,clip,catalogue),compiled=compileRecipe(pasted)
 expect(doc.raw).toEqual(before);expect(target.raw).toEqual(originalTarget);expect(pasted.raw.opaque).toEqual(originalTarget.opaque)
 expect(pasted.raw.graph.nodes.filter((n:any)=>!n.id.startsWith('copy-'))).toEqual(originalTarget.graph.nodes)
 expect(pasted.raw.graph.nodes.find((n:any)=>n.id==='copy-test').custom).toEqual({nested:[false,19]})
 expect(pasted.raw.graph.edges.filter((e:any)=>e.opaque)).toHaveLength(1)
 const copiedSource=compiled.nodes.find(n=>n.id===`copy-${source.id}`)!
 expect(copiedSource.params.image_id).not.toBe('original');expect(pasted.raw.images[copiedSource.params.image_id as string]).toEqual(before.images.original)
 expect(pasted.raw.images.original).toEqual(originalTarget.images.original)
 expect(new Set(compiled.nodes.map(n=>n.id)).size).toBe(compiled.nodes.length)
})
test('history jumping preserves future states and accurately labels its bounded retained history',()=>{
 const doc=openDocument(m5Project('tiles','max_x')),commands=new ProjectCommands(doc)
 for(let i=1;i<=105;i++)commands.apply(`Width ${i}`,d=>editParameter(d,'test','max_x',i))
 expect(commands.past).toHaveLength(100);expect(commands.timeline()[0].label).toBe('Oldest retained state')
 expect(commands.jumpTo(0)).toBe(true);expect(compileRecipe(commands.current!).nodes.find(n=>n.id==='test')!.params.max_x).toBe(5);expect(commands.undo()).toBe(false)
 expect(commands.jumpTo(100)).toBe(true);expect(compileRecipe(commands.current!).nodes.find(n=>n.id==='test')!.params.max_x).toBe(105)
 expect(commands.jumpTo(2.5)).toBe(false);expect(commands.jumpTo(101)).toBe(false)
 commands.jumpTo(50);commands.apply('New branch',d=>editParameter(d,'test','max_x',250));expect(commands.future).toHaveLength(0)
})
test('shared screw fit is explicit, atomic, scoped to supported hardware and retained through undo',()=>{
 let doc=openDocument(m5Project('hardware','nut_clearance')),graph=doc.raw.graph
 const hardware=graph.nodes.find((n:any)=>n.type==='hardware')!;hardware.params.nut_clearance=.1
 graph.nodes.push({id:'other-hardware',type:'hardware',params:{nut_clearance:.4,tip_taper:.5,tip_pitches:2,unknown:'keep'}})
 const before=copy(doc),unrelated=editParameter(doc,'other-hardware','length',22)
 expect(synchronizeFit(doc,unrelated,registry).raw.graph.nodes.find((n:any)=>n.id===hardware.id).params.nut_clearance).toBe(.1)
 doc=synchronizeFit(doc,setFitLink(doc,hardware.id,true,registry),registry)
 expect(doc.raw.graph.nodes.filter((n:any)=>n.type==='hardware').every((n:any)=>n.params.nut_clearance===.1)).toBe(true)
 const adjusted=synchronizeFit(doc,editParameter(doc,'other-hardware','nut_clearance',.3),registry)
 expect(adjusted.raw.graph.nodes.filter((n:any)=>n.type==='hardware').every((n:any)=>n.params.nut_clearance===.3)).toBe(true)
 expect(adjusted.raw.graph.nodes.find((n:any)=>n.id==='other-hardware').params.unknown).toBe('keep')
 const commands=new ProjectCommands(before);commands.apply('Link and edit',()=>adjusted);commands.undo();expect(commands.current).toEqual(before)
 let conflicting=editParameter(doc,hardware.id,'tip_taper',.2);conflicting=editParameter(conflicting,'other-hardware','tip_taper',.8)
 expect(()=>synchronizeFit(doc,conflicting,registry)).toThrow(/conflicting/)
})
