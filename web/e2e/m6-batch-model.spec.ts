import {expect,test} from '@playwright/test'
import {catalogue,m5Project} from './m5-fixtures'
import {openDocument,compileRecipe} from '../src/studio/project'
import {ParameterRegistry} from '../src/studio/registry'
import {planBatch,jobDocument,variationValues,csvCell,type BatchVariation} from '../src/studio/batchPlan'
import {inspectStl,partMeshProblems} from '../src/studio/meshAudit'

const registry=new ParameterRegistry(catalogue)
const variation=(patch:Partial<BatchVariation>={}):BatchVariation=>({id:1,step:'test',parameter:'max_x',mode:'range',start:'70',end:'80',increment:'5',values:'[70,80]',...patch})
test('batch ranges and Cartesian choices obey the real schema, preserve values and reject oversized job plans',()=>{
 const doc=openDocument(m5Project('tiles','max_x')),numeric=registry.types.get('transform')!.params.find(p=>p.name==='angle')!
 expect(variationValues(variation({start:'0',end:'.3',increment:'.1'}),numeric,registry,'transform')).toEqual([0,.1,.2,.3])
 const jobs=planBatch(doc,registry,[],'',[variation(),variation({id:2,parameter:'connector_d',mode:'list',values:'[3,4]'})])
 expect(jobs).toHaveLength(6);expect(jobs.map(j=>j.id)).toEqual(['1-1','1-2','1-3','1-4','1-5','1-6'])
 expect(jobs[1].overrides.map(o=>o.value)).toEqual([70,'4'])
 expect(()=>planBatch(doc,registry,[],'',[variation({start:'20',end:'655',increment:'5'})])).not.toThrow()
 expect(()=>planBatch(doc,registry,[],'',[variation({start:'20',end:'660',increment:'5'})])).toThrow(/128/)
 expect(()=>planBatch(doc,registry,[],'',[variation(),variation({id:2})])).toThrow(/only once/)
 expect(()=>planBatch(doc,registry,[],'',[variation({start:'-1'})])).toThrow(/value from/)
 expect(()=>planBatch(doc,registry,[],'',[variation({increment:'0'})])).toThrow(/positive/)
 expect(()=>planBatch(doc,registry,[],'',[variation({mode:'list',values:'[]'})])).toThrow(/between 1/)
 expect(()=>planBatch(doc,registry,[],'',[variation({parameter:'reinforce',mode:'list',values:'["false"]'})])).toThrow(/on or off/)
})
test('batch source replacement clones only the intended shared source and keeps unknown data and the original recipe',async()=>{
 const raw=m5Project('tiles','max_x'),source=raw.graph.nodes.find(n=>n.type==='source')!
 raw.graph.nodes.push({...structuredClone(source),id:'another-source'})
 const doc=openDocument(raw),original=structuredClone(doc.raw),file=new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'],'different.svg',{type:'image/svg+xml'})
 expect(()=>planBatch(doc,registry,[file],'',[])).toThrow(/artwork source/)
 const job=planBatch(doc,registry,[file],source.id,[variation()])[0],next=await jobDocument(doc,job,source.id),graph=compileRecipe(next)
 expect(doc.raw).toEqual(original);expect(next.raw.opaque).toEqual(original.opaque)
 expect(graph.nodes.find(n=>n.id==='another-source')!.params.image_id).toBe(source.params.image_id)
 expect(graph.nodes.find(n=>n.id===source.id)!.params.image_id).not.toBe(source.params.image_id)
 expect(next.raw.images[source.params.image_id]).toEqual(original.images[source.params.image_id])
 expect(next.raw.images[graph.nodes.find(n=>n.id===source.id)!.params.image_id as string].name).toBe('different.svg')
 expect(graph.nodes.find(n=>n.id==='test')!.params.max_x).toBe(70)
})
test('input quotas refuse work before reading oversized files and CSV names cannot become formulas',async()=>{
 const doc=openDocument(m5Project('tiles','max_x')),source=compileRecipe(doc).nodes.find(n=>n.type==='source')!.id
 const file=(size:number)=>({name:'safe.svg',size,webkitRelativePath:'',arrayBuffer:()=>{throw Error('Oversized input must not be read')}} as unknown as File)
 expect(()=>planBatch(doc,registry,Array.from({length:21},()=>file(1)),source,[])).toThrow(/20 images/)
 expect(()=>planBatch(doc,registry,[file(128*1024*1024+1)],source,[])).toThrow(/128 MB/)
 await expect(jobDocument(doc,planBatch(doc,registry,[file(64*1024*1024+1)],source,[])[0],source)).rejects.toThrow(/64 MB/)
 expect(csvCell('=1+1')).toBe('"\'=1+1"');expect(csvCell('name,"line\nnext')).toBe('"name,""line\nnext"')
})
function separatedBodies(count:number){
 const faces:number[][][]=[]
 for(let k=0;k<count;k++){
  const v=[[k*3,0,0],[k*3+1,0,0],[k*3,1,0],[k*3,0,1]]
  for(const f of [[0,2,1],[0,1,3],[0,3,2],[1,2,3]])faces.push(f.map(i=>v[i]))
 }
 const bytes=new ArrayBuffer(84+faces.length*50),view=new DataView(bytes);view.setUint32(80,faces.length,true)
 faces.forEach((f,i)=>f.forEach((v,j)=>v.forEach((x,k)=>view.setFloat32(96+i*50+j*12+k*4,x,true))))
 return inspectStl(bytes)
}
test('component checks allow explicit alignment pins and retained fragments while rejecting loose plate bodies',()=>{
 const mesh=separatedBodies(2);expect(mesh.closed).toBe(true);expect(mesh.components).toBe(2)
 expect(partMeshProblems(mesh,'stencil_r1c1.stl')).toContain('2 separate components; this file permits 1')
 expect(partMeshProblems(mesh,'pins_2x_d3.8mm.stl')).toEqual([])
 expect(partMeshProblems(mesh,'pins_3x_d3.8mm.stl')).toContain('expected 3 separate alignment pins, found 2 components')
 expect(partMeshProblems(mesh,'stencil_r1c1.stl',{meta:{fragments:{keep:2}}})).toEqual([])
 expect(partMeshProblems(mesh,'bolt_M4.stl',{meta:{fragments:{keep:2}}})).not.toEqual([])
})
