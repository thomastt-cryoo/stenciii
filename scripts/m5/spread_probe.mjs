import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
const root='sandbox/m5/spread';mkdirSync(root,{recursive:true});const doc=JSON.parse(readFileSync('docs/m4/fixtures/vector_stencil-bridge_passes-after.json','utf8')),worker='/assets/'+readdirSync('web/dist/assets').find(f=>/^engine.worker.*\.js$/.test(f)),browser=await chromium.launch({headless:true}),rows={}
for(const mode of ['st','mt']){
 const page=await browser.newPage();await page.goto('http://localhost:5199/')
 const result=await page.evaluate(async({doc,worker,mode})=>{
  const engine=new Worker(worker,{type:'module',name:mode==='st'?'artwork-preview':'manufacturing-proof'}),pending=new Map();let seq=0
  const call=m=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});engine.postMessage({id,...m})})
  engine.onmessage=e=>{if(e.data.step)return;const p=pending.get(e.data.id);if(!p)return;pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
  const threads=await call({op:'threads'}),graph=doc.graph
  for(const n of graph.nodes)if(n.type==='source'){const bytes=Uint8Array.from(atob(doc.images[n.params.image_id].base64),c=>c.charCodeAt(0));n.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}
  const result=await call({op:'inspect',graph:JSON.stringify(graph),target:'test',out:'solid'});engine.terminate();let s='';for(let i=0;i<result.bytes.length;i+=0x8000)s+=String.fromCharCode(...result.bytes.subarray(i,i+0x8000));return{threads,info:result.info,bytes:btoa(s)}
 },{doc,worker,mode});writeFileSync(`${root}/${mode}.stl`,Buffer.from(result.bytes,'base64'));delete result.bytes;rows[mode]=result;await page.close()
}
await browser.close()
const native=spawnSync(resolve('target/release/stencil.exe'),['--project','docs/m4/fixtures/vector_stencil-bridge_passes-after.json','-o',`${root}/native.stl`],{encoding:'utf8',timeout:120000});if(native.status!==0)throw Error(native.stderr)
rows.native={stdout:native.stdout,stderr:native.stderr,stats:native.stdout.split(/\r?\n/).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l)).find(o=>o.triangles)}
for(const mode of ['native','st','mt']){const r=spawnSync('python',['scripts/m2/inspect_mesh.py',`${root}/${mode}.stl`],{encoding:'utf8'});rows[mode].validation=JSON.parse(r.stdout)}
writeFileSync(`${root}/investigation.json`,JSON.stringify(rows,null,2));console.log(JSON.stringify(Object.fromEntries(Object.entries(rows).map(([k,v])=>[k,{triangles:v.validation.triangles,volume:v.validation.signed_volume_mm3,routes:(v.stats??v.info?.stats)?.bridge_routes_mm}]))))
