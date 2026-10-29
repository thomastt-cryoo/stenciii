// Exercise all measured geometry fixtures in real production ST/MT workers,
// replay their exact saved projects in the CLI, and compare oriented triangles.
import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve,basename} from 'node:path'
const url=process.argv[2]??'http://localhost:5199/',manifest=JSON.parse(readFileSync('docs/m4/production-manifest.json','utf8'))
const worker=manifest.files.find(f=>/engine\.worker.*\.js$/.test(f.path)).path,coverage=JSON.parse(readFileSync('docs/m4/geometry-coverage.json','utf8'))
const cases=coverage.cases.flatMap(c=>['before','after'].map(phase=>({key:c.key,phase,stem:`${c.key.replace('.','-')}-${phase}`,project:c[`project_${phase}`],out:c.key.endsWith('.tile_method')?'parts':'solid',expected:c[phase]})))
const root='sandbox/m4/modes';mkdirSync(root,{recursive:true});const results={modes:[],cases:[]},browser=await chromium.launch({headless:true})
for(const isolated of [true,false]){
 const page=await browser.newPage()
 if(!isolated)await page.route(url,async route=>{const response=await route.fetch(),headers=response.headers();delete headers['cross-origin-opener-policy'];delete headers['cross-origin-embedder-policy'];await route.fulfill({response,headers})})
 await page.goto(url)
 const mode=await page.evaluate(async worker=>{
  const w=window,engine=new Worker(new URL(worker,location.href),{type:'module'}),pending=new Map();let seq=0
  engine.onmessage=e=>{const p=pending.get(e.data.id);if(!p||e.data.step)return;pending.delete(e.data.id);clearTimeout(p.timer);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
  const call=message=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Geometry mode test timed out')),120000);pending.set(id,{resolve,reject,timer});engine.postMessage({id,...message})});w.proof={engine,call};return {isolated:crossOriginIsolated,threads:await call({op:'threads'})}
 },worker)
 if(mode.isolated!==isolated||(isolated?mode.threads.n<=1:mode.threads.n!==1))throw Error('Wrong production worker mode')
 results.modes.push(mode)
 for(const c of cases){
  const doc=JSON.parse(readFileSync(c.project,'utf8')),start=performance.now()
  const artifact=await page.evaluate(async({doc,out})=>{
   const call=window.proof.call,graph=doc.graph
   for(const n of graph.nodes)if(n.type==='source'){const asset=doc.images[n.params.image_id],bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));n.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}
   const a=await call({op:'inspect',graph:JSON.stringify(graph),target:'test',out});let data='';for(let i=0;i<a.bytes.length;i+=0x8000)data+=String.fromCharCode(...a.bytes.subarray(i,i+0x8000));return {base64:btoa(data),info:a.info,extension:a.bytes[0]===80&&a.bytes[1]===75?'zip':'stl'}
  },{doc,out:c.out})
  const modeName=isolated?'mt':'st',path=`${root}/${modeName}-${c.stem}.${artifact.extension}`;writeFileSync(path,Buffer.from(artifact.base64,'base64'))
  let row=results.cases.find(r=>r.stem===c.stem);if(!row){row={key:c.key,phase:c.phase,stem:c.stem,project:c.project};results.cases.push(row)}
  row[modeName]={path,milliseconds:performance.now()-start,stats:artifact.info.stats,meta:artifact.info.meta}
 }
 await page.evaluate(()=>window.proof.engine.terminate());await page.close()
}
await browser.close()
for(const row of results.cases){
 const tiled=row.key.endsWith('.tile_method'),out=tiled?`${root}/native-${row.stem}`:`${root}/native-${row.stem}.stl`
 if(tiled)mkdirSync(out,{recursive:true})
 const native=spawnSync(resolve(`target/release/stencil${process.platform==='win32'?'.exe':''}`),['--project',row.project,'-o',out],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024})
 if(native.status!==0)throw Error(`${row.stem}: ${native.stderr}`)
 const path=tiled?`${out}/${basename(row.project,'.json')}.zip`:out
 const compare=spawnSync('python',['scripts/m4/compare_geometry.py',path,row.st.path,row.mt.path],{encoding:'utf8',timeout:120000,maxBuffer:16*1024*1024})
 if(compare.status!==0)throw Error(`${row.stem}: ${compare.stderr}`)
 row.comparison=JSON.parse(compare.stdout);row.native={path,stats:native.stdout.split(/\r?\n/).filter(l=>l.startsWith('{')).map(l=>JSON.parse(l))}
 writeFileSync('docs/m4/production-modes.json',JSON.stringify(results,null,2)+'\n')
}
console.log(`Verified ${cases.length} saved fixtures in native, single-thread and multithread production engines; exact oriented triangle coordinates match at 0.0001 mm.`)
