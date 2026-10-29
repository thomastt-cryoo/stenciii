import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync,readdirSync,mkdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
const root='sandbox/m5/performance';mkdirSync(root,{recursive:true});const worker='/assets/'+readdirSync('web/dist/assets').find(f=>/^engine.worker.*\.js$/.test(f)),browser=await chromium.launch({headless:true}),page=await browser.newPage(),rows=[]
await page.goto('http://localhost:5199/')
for(const strategy of ['before','after'])for(const width of [640,900]){
 const max=width===640?160:180,doc=JSON.parse(readFileSync(`sandbox/m5/b/${strategy==='before'?'tile_layout':'tiles'}-max_x-before.json`,'utf8'))
 doc.images.original={name:'Local grid.svg',base64:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="white"/>'+Array.from({length:4},(_,y)=>Array.from({length:4},(_,x)=>`<rect x="${42+x*150}" y="${34+y*100}" width="28" height="18" fill="black"/>`).join('')).join('')+'</svg>').toString('base64')}
 doc.graph.nodes.find(n=>n.type==='source').params.resolution=300
 const build=doc.graph.nodes.find(n=>n.type==='vector_stencil');Object.assign(build.params,{width_mm:width,margin_mm:20,thickness_mm:8,extra_top_layers:0,detail:2})
 Object.assign(doc.graph.nodes.find(n=>n.id==='test').params,{max_x:max,max_y:max,seam_shift:0,...(strategy==='before'?{width_mm:width,margin_mm:20}:{seam_gap:.2})})
 const target=strategy==='before'?'built':'test',name=`${strategy}-${width}`,start=performance.now(),row={strategy,width_mm:width,largest_tile_mm:max,project:`${root}/${name}.json`};writeFileSync(row.project,JSON.stringify(doc))
 try{const actual=await page.evaluate(async({doc,target,worker})=>{
  const engine=new Worker(worker,{type:'module'}),pending=new Map();let seq=0;const call=m=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>reject(Error('Large assembly exceeded 180 seconds')),180000);pending.set(id,{resolve,reject,timer});engine.postMessage({id,...m})});engine.onmessage=e=>{if(e.data.step)return;const p=pending.get(e.data.id);if(!p)return;clearTimeout(p.timer);pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)};engine.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message));pending.clear()}
  try{const threads=await call({op:'threads'}),graph=doc.graph;for(const n of graph.nodes)if(n.type==='source'){const bytes=Uint8Array.from(atob(doc.images[n.params.image_id].base64),c=>c.charCodeAt(0));n.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}const r=await call({op:'inspect',graph:JSON.stringify(graph),target,out:'parts'});let s='';for(let i=0;i<r.bytes.length;i+=0x8000)s+=String.fromCharCode(...r.bytes.subarray(i,i+0x8000));return{info:r.info,threads,data:btoa(s)}}finally{engine.terminate()}
 },{doc,target,worker});row.milliseconds=performance.now()-start;row.threads=actual.threads;row.info=actual.info;const zip=`${root}/${name}.zip`;writeFileSync(zip,Buffer.from(actual.data,'base64'));row.bytes=Buffer.from(actual.data,'base64').length;const p=spawnSync('python',['scripts/m2/inspect_mesh.py',zip],{encoding:'utf8',maxBuffer:16000000});if(p.status!==0)throw Error(p.stderr);row.validation=JSON.parse(p.stdout);row.valid=row.validation.entries.every(e=>e.closed_oriented_mesh);if(!row.valid)row.error='Independent STL validation rejected at least one part'
 }catch(error){row.error=String(error);row.milliseconds=performance.now()-start}
 rows.push(row);writeFileSync('docs/m5/large-assembly-performance.json',JSON.stringify(rows,null,2)+'\n');console.log(name,row.valid?'valid':row.error,Math.round(row.milliseconds)+' ms')
}
await browser.close()
