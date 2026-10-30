import {snapshot} from './snapshot.mjs'
// Replay every measured value/allowed choice in the real native and MT engines.
import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync} from 'node:fs'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
const root='sandbox/m6/all-control-modes';mkdirSync(root+'/_assets',{recursive:true});const cases=[]
const definitions=JSON.parse(readFileSync('docs/audit/runtime-catalogue.json','utf8'))
for(const type of definitions){
 const data=JSON.parse(readFileSync(`docs/m6/controls/${type.id}.json`,'utf8'));if(data.slots!==type.params.length||!data.cases.every(r=>r.verified))throw Error('Complete the parameter control audit first: '+type.id)
 for(const row of data.cases)for(const [index,measured]of row.outputs.entries()){
  const key=row.key.split('.')[1],id=`${type.id}-${key}-${index}`,project=`sandbox/m6/controls/${type.id}/${key}-${index}.json`,doc=JSON.parse(readFileSync(project,'utf8')),images={}
  for(const node of doc.graph.nodes.filter(n=>n.type==='source')){
   const asset=doc.images[node.params.image_id],body=Buffer.from(asset.base64,'base64'),path=root+'/_assets/'+createHash('sha256').update(body).digest('hex');writeFileSync(path,body);images[node.params.image_id]=resolve(path)
  }
  const out=type.id==='tile_layout'?'parts':type.id==='split_colours'?(key==='colours'?'palette':'colour_1'):type.id==='tone_patterns'?'mask':['stencil','vector_stencil','remesh'].includes(type.id)?key==='tile_method'?'parts':'solid':type.outputs[0].name
  cases.push({case:id,key:row.key,value:measured.value,target:type.id==='tile_layout'?'built':'test',out,project,graph:doc.graph,images,path:resolve(root+'/native-'+id+'.'+(measured.extension??'data')),st:measured.diagnostic?{refusal:measured.diagnostic}:{path:project.replace(/\.json$/,'.'+measured.extension),sha256:measured.sha256},expectedDiagnostic:!!measured.diagnostic})
 }
}
if(new Set(cases.map(r=>r.key)).size!==217)throw Error('Qualified field count must be 217')
writeFileSync(root+'/native-config.json',JSON.stringify(cases))
const nativeRunner=resolve(`target/release/examples/m6_artifact_replay${process.platform==='win32'?'.exe':''}`),engineHashes=Object.fromEntries(['web/pkg/stencil_wasm_bg.wasm','web/public/pkg-mt/stencil_wasm_bg.wasm'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),sourceFingerprint=createHash('sha256').update(JSON.stringify(cases)).update(readFileSync(nativeRunner)).update(JSON.stringify(engineHashes)).digest('hex')
const cached=process.env.M6_RESUME_CONTROL_MODES==='1'&&existsSync('docs/m6/all-control-modes.json')?JSON.parse(readFileSync('docs/m6/all-control-modes.json','utf8')):null
if(cached&&cached.sourceFingerprint!==sourceFingerprint)throw Error('Cannot resume artifacts from different engine binaries or recipes')
if(cached&&cached.cases.some((old,index)=>old.case!==cases[index]?.case||old.st.sha256!==cases[index]?.st.sha256||JSON.stringify(old.value)!==JSON.stringify(cases[index]?.value)))throw Error('Cannot resume changed case data')
let nativeRows
if(cached)nativeRows=cached.cases.map(row=>row.native)
else{const native=spawnSync(resolve(`target/release/examples/m6_artifact_replay${process.platform==='win32'?'.exe':''}`),[root+'/native-config.json'],{encoding:'utf8',timeout:1800000,maxBuffer:24000000});if(native.status!==0)throw Error(native.stderr);nativeRows=JSON.parse(native.stdout)}
for(const row of cases){const actual=nativeRows.find(n=>n.case===row.case);if(!actual)throw Error('Missing native result');row.native=actual;if(!actual.error)row.native.sha256=createHash('sha256').update(readFileSync(actual.path)).digest('hex');const completed=cached?.cases.find(old=>old.case===row.case)?.mt;if(completed?.path&&createHash('sha256').update(readFileSync(completed.path)).digest('hex')===completed.sha256||completed?.refusal&&row.expectedDiagnostic)row.mt=completed;if(row.expectedDiagnostic&&!JSON.stringify(actual.error).includes(row.st.refusal.split('\n')[0].replace(/^Error: page\.evaluate: /,'').replace(/^Error: /,'')))throw Error('Native constraint differs: '+row.case);if(!!actual.error!==row.expectedDiagnostic)throw Error(row.case+JSON.stringify(actual));delete row.images;delete row.graph;delete row.path}
const result={qualified_slots:217,executed_values:cases.length,sourceFingerprint,engine_sha256:engineHashes,cases}
const file='docs/m6/all-control-modes.json';result.resumed_native_values=cached?nativeRows.length:0;result.resumed_mt_values=cases.filter(row=>row.mt).length;snapshot(file,result)
const worker='/assets/'+readdirSync('web/dist/assets').find(f=>/^engine.worker.*\.js$/.test(f)),entry=readFileSync('web/dist/index.html','utf8').match(/<script[^>]+src="([^"]+)"/)[1].split('/').at(-1);let browser=await chromium.launch({headless:true});const initialize=async()=>{const page=await browser.newPage();await page.route('**/'+entry,route=>route.abort());await page.goto('http://localhost:5200/')
const threads=await page.evaluate(async worker=>{
 const engine=new Worker(worker,{type:'module',name:'m6-all-parameter-modes'}),pending=new Map();let seq=0
 const call=message=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Parameter mode exceeded 240 seconds')),240000);pending.set(id,{resolve,reject,timer});engine.postMessage({id,...message})})
 engine.onmessage=e=>{const p=pending.get(e.data.id);if(!p||e.data.step)return;clearTimeout(p.timer);pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)};engine.onerror=e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(e.message))}pending.clear()};window.m6All={engine,call};return call({op:'threads'})
},worker);if(threads.n<=1)throw Error('Expected real threaded execution');return {page,threads}};let active=await initialize();result.threads=active.threads;result.worker_recycle_every_cases=8
try{for(const [index,row]of cases.entries()){if(index&&index%8===0){await browser.close();browser=await chromium.launch({headless:true});active=await initialize()}const page=active.page;
 if(row.mt)continue;const doc=JSON.parse(readFileSync(row.project,'utf8')),start=performance.now()
 try{
  const actual=await page.evaluate(async({doc,target,out})=>{const graph=doc.graph,call=window.m6All.call;for(const n of graph.nodes)if(n.type==='source'){const bytes=Uint8Array.from(atob(doc.images[n.params.image_id].base64),c=>c.charCodeAt(0));n.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}const artifact=await call({op:'inspect',graph:JSON.stringify(graph),target,out});let data='';for(let i=0;i<artifact.bytes.length;i+=0x8000)data+=String.fromCharCode(...artifact.bytes.subarray(i,i+0x8000));return{base64:btoa(data),info:artifact.info,mime:artifact.mime}},{doc,target:row.target,out:row.out})
  if(row.expectedDiagnostic)throw Error('Expected a constraint diagnostic');const body=Buffer.from(actual.base64,'base64'),path=root+'/mt-'+row.case+'.'+row.st.path.split('.').at(-1);writeFileSync(path,body);row.mt={path,sha256:createHash('sha256').update(body).digest('hex'),milliseconds:performance.now()-start,info:actual.info}
 }catch(error){const expected=row.st.refusal?.split('\n')[0].replace(/^Error: page\.evaluate: /,'').replace(/^Error: /,'');if(!row.expectedDiagnostic||!expected||!String(error).includes(expected))throw error;row.mt={refusal:String(error)}}
 snapshot(file,result)
}}finally{await browser.close()}
result.completed_values=cases.length;snapshot(file,result);console.log(`Replayed ${cases.length} values/choices covering all 217 fields in native/ST/MT; independent comparisons are a separate required step.`)
