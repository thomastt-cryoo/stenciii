import {snapshot} from './snapshot.mjs'
import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
const root='sandbox/m6/tile-modes';mkdirSync(root,{recursive:true});mkdirSync('docs/m6/fixtures/projects',{recursive:true})
const native=JSON.parse(readFileSync('sandbox/m6-native-tile-matrix.json','utf8')),asset=readFileSync('docs/m5/fixtures/cli-seam-ring.svg').toString('base64')
const cases=native.filter(row=>row.strategy!=='legacy'||row.legacy_execution_seam_angle===0).map(row=>{
 const graph=JSON.parse(readFileSync(`sandbox/m6/native-tiles/${row.case}.json`,'utf8')),id=graph.nodes.find(n=>n.type==='source').params.image_id
 const project={version:2,graph,images:{[id]:{name:'Retained M5 ring.svg',base64:asset}},stencilStudio:{m6Fixture:row.case}}
 writeFileSync(`docs/m6/fixtures/projects/${row.case}.json`,JSON.stringify(project,null,2)+'\n')
 return {case:row.case,target:row.terminal,project}
})
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),stSha=digest(readFileSync('web/pkg/stencil_wasm_bg.wasm')),mtSha=digest(readFileSync('web/public/pkg-mt/stencil_wasm_bg.wasm'))
const bundledST=readdirSync('web/dist/assets').some(name=>name.endsWith('.wasm')&&digest(readFileSync('web/dist/assets/'+name))===stSha)
if(!bundledST||digest(readFileSync('web/dist/pkg-mt/stencil_wasm_bg.wasm'))!==mtSha)throw Error('Rebuild the frontend with the current engine variants first')
const worker='/assets/'+readdirSync('web/dist/assets').find(name=>/^engine.worker.*\.js$/.test(name)),entry=readFileSync('web/dist/index.html','utf8').match(/<script[^>]+src="([^"]+)"/)[1].split('/').at(-1)
const result={native_cases:40,applicable_three_engine_cases:cases.length,native_only_legacy_bevel_cases:native.filter(r=>r.strategy==='legacy'&&r.legacy_execution_seam_angle!==0).map(r=>r.case),engine_sha256:{st:stSha,mt:mtSha},modes:[],cases:cases.map(({project,...row})=>row)},browser=await chromium.launch({headless:true})
for(const mode of ['st','mt']){
 const page=await browser.newPage();await page.route('**/'+entry,route=>route.abort());await page.goto('http://localhost:5200/')
 const threads=await page.evaluate(async({worker,mode})=>{
  const engine=new Worker(worker,{type:'module',name:mode==='st'?'artwork-preview':'m6-tile-proof'}),pending=new Map();let sequence=0
  const call=message=>new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>reject(Error('Tile proof exceeded 240 seconds')),240000);pending.set(id,{resolve,reject,timer});engine.postMessage({id,...message})})
  engine.onmessage=e=>{if(e.data.step)return;const p=pending.get(e.data.id);if(!p)return;clearTimeout(p.timer);pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
  engine.onerror=e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(e.message))}pending.clear()};window.m6Tiles={engine,call};return call({op:'threads'})
 },{worker,mode})
 if(mode==='st'&&threads.n!==1||mode==='mt'&&threads.n<=1)throw Error('Required engine mode unavailable: '+JSON.stringify(threads));result.modes.push({mode,threads})
 for(const [index,test]of cases.entries()){
  const start=performance.now(),actual=await page.evaluate(async({project,target})=>{
   const call=window.m6Tiles.call,graph=structuredClone(project.graph)
   for(const node of graph.nodes)if(node.type==='source'){const bytes=Uint8Array.from(atob(project.images[node.params.image_id].base64),c=>c.charCodeAt(0));node.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}
   const r=await call({op:'inspect',graph:JSON.stringify(graph),target,out:'parts'});let data='';for(let i=0;i<r.bytes.length;i+=0x8000)data+=String.fromCharCode(...r.bytes.subarray(i,i+0x8000));return {info:r.info,data:btoa(data)}
  },test),bytes=Buffer.from(actual.data,'base64'),path=`${root}/${mode}-${test.case}.zip`;writeFileSync(path,bytes)
  result.cases[index][mode]={path,sha256:digest(bytes),milliseconds:performance.now()-start,info:actual.info}
 }
 await page.evaluate(()=>window.m6Tiles.engine.terminate());await page.close()
}
await browser.close()
snapshot('docs/m6/tile-mode-validation.json',result)
for(const row of result.cases){
 const checked=spawnSync('python',['scripts/m6/compare_tile_modes.py',`sandbox/m6/native-tiles/${row.case}`,row.st.path,row.mt.path],{encoding:'utf8',maxBuffer:12000000,timeout:180000})
 if(checked.status!==0)throw Error(row.case+': '+checked.stderr);row.independent=JSON.parse(checked.stdout)
 snapshot('docs/m6/tile-mode-validation.json',result)
}
result.all_structural_checks_passed=true;result.all_shape_comparisons_classified=true
snapshot('docs/m6/tile-mode-validation.json',result)
console.log(`Validated native/ST/MT for ${cases.length} applicable cases; five additional native legacy bevel executions use the CLI-only execution setting. Inspect all shape and exact-triangle flags.`)
