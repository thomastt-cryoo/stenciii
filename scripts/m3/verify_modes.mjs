// Verify actual customer workers, isolated MT and ordinary ST, against native CLI.
import { chromium } from '../../web/node_modules/playwright/index.mjs'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const baseURL = process.argv[2] ?? 'http://127.0.0.1:5200/'
const manifest = JSON.parse(readFileSync('docs/m3/production-manifest.json', 'utf8'))
const worker = manifest.files.find(f => /engine\.worker.*\.js$/.test(f.path)).path
const recipes = ['standard','smooth','crisp'].map(style=>({name:style,path:`sandbox/m3/corpus/simple-logo-${style}.json`}))
recipes.push({name:'text',path:'sandbox/m3/text-project.json'},{name:'long',path:'sandbox/m3/long-project.json'})
for(const recipe of recipes)recipe.doc=JSON.parse(readFileSync(recipe.path,'utf8'))
mkdirSync('sandbox/m3/modes',{recursive:true})
const browser=await chromium.launch({headless:true}),results=[]
for(const isolated of [true,false]){
 const page=await browser.newPage()
 if(!isolated)await page.route(baseURL,async route=>{const response=await route.fetch(),headers=response.headers();delete headers['cross-origin-opener-policy'];delete headers['cross-origin-embedder-policy'];await route.fulfill({response,headers})})
 await page.goto(baseURL)
 const outputs=await page.evaluate(async({worker,recipes})=>{
  const engine=new Worker(new URL(worker,location.href),{type:'module'}),inspector=new Worker(new URL(worker,location.href),{type:'module',name:'artwork-preview'})
  function client(engine){let seq=0;const pending=new Map();engine.onmessage=e=>{const p=pending.get(e.data.id);if(!p)return;if(e.data.step){p.steps.push(e.data.step);return}clearTimeout(p.timeout);pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve({response:e.data.ok,steps:p.steps})};return message=>new Promise((resolve,reject)=>{const id=++seq,timeout=setTimeout(()=>reject(Error('Worker timed out')),90000);pending.set(id,{resolve,reject,steps:[],timeout});engine.postMessage({id,...message})})}
  const request=client(engine),inspect=client(inspector),{response:mode}=await request({op:'threads'}),{response:preview_mode}=await inspect({op:'threads'}),cases=[]
  for(const {name,doc}of recipes){
   const graph=structuredClone(doc.graph)
   for(const node of graph.nodes)if(node.type==='source'){
    const image=doc.images[node.params.image_id].base64,bytes=Uint8Array.from(atob(image),c=>c.charCodeAt(0))
    const {response:asset}=await request({op:'image',bytes:bytes.buffer});node.params.image_id=asset.id
   }
   const started=performance.now(),result=await request({op:'run',graph:JSON.stringify(graph),targets:''})
   const failed=result.steps.find(s=>s.state.state==='error');if(failed)throw Error(JSON.stringify(failed))
   const artifact=result.steps.flatMap(s=>s.artifacts??[]).find(a=>a.info?.kind==='solid');if(!artifact)throw Error('No stencil output')
   let data='';for(const b of artifact.bytes)data+=String.fromCharCode(b)
   cases.push({name,milliseconds:performance.now()-started,base64:btoa(data),stats:artifact.info.stats})
  }
  engine.terminate();inspector.terminate();return{mode,preview_mode,isolated:crossOriginIsolated,cases}
 },{worker,recipes})
 if(outputs.isolated!==isolated||isolated&&outputs.mode.n<=1||!isolated&&outputs.mode.n!==1||outputs.preview_mode.n!==1)throw Error('Wrong engine thread mode')
 for(const row of outputs.cases){
  const path=`sandbox/m3/modes/${isolated?'mt':'st'}-${row.name}.stl`;writeFileSync(path,Buffer.from(row.base64,'base64'));delete row.base64
  const check=spawnSync('python',['scripts/m2/inspect_mesh.py',path],{encoding:'utf8'});if(check.status!==0)throw Error(check.stderr)
  row.mesh=JSON.parse(check.stdout);if(!row.mesh.closed_oriented_mesh)throw Error(`Invalid geometry ${path}`)
 }
 results.push(outputs);await page.close()
}
await browser.close()
for(const recipe of recipes){const run=spawnSync(`target/release/stencil${process.platform==='win32'?'.exe':''}`,['--project',recipe.path,'-o',`sandbox/m3/modes/native-${recipe.name}.stl`],{encoding:'utf8'});if(run.status!==0)throw Error(run.stderr)}
writeFileSync('docs/m3/production-modes.json',JSON.stringify(results,null,2)+'\n')
console.log(JSON.stringify(results.map(r=>({mode:r.mode,preview_mode:r.preview_mode,cases:r.cases.map(c=>({name:c.name,milliseconds:c.milliseconds,triangles:c.mesh.triangles,closed:c.mesh.closed_oriented_mesh}))}))))
