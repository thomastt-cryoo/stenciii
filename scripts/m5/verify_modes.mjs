// Replay retained manufacturing fixtures in real ST/MT workers and the native CLI.
import {chromium} from '../../web/node_modules/playwright/index.mjs'
import {readFileSync,writeFileSync,readdirSync,mkdirSync,existsSync,statSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import {resolve,basename} from 'node:path'
import {createHash} from 'node:crypto'
const root='sandbox/m5/modes';mkdirSync(root,{recursive:true});const worker='/assets/'+readdirSync('web/dist/assets').find(f=>/^engine.worker.*\.js$/.test(f)),cases=[]
for(const phase of 'abcd'){
 const data=JSON.parse(readFileSync(`docs/m5/${phase}-coverage.json`,'utf8'))
 for(const c of data.cases)for(const which of ['before','after']){
  const type=c.key.split('.')[0],originalProject=c[`project_${which}`]??`sandbox/m5/${phase}/${c.key.replace('.','-')}-${which}.json`,retained=`docs/m5/fixtures/${basename(originalProject)}`,project=existsSync(retained)?retained:originalProject
  // All before/after field fixtures are retained; M5_MODES_SAMPLE limits a diagnostic run only.
  if(process.env.M5_MODES_SAMPLE&&c.key.split('.').at(-1)!==({split_colours:'colours',tone_patterns:'spacing_mm',colour_set:'holes',tile_layout:'edits',tiles:'seam_angle_deg',fragments:'keep',pads:'mount_threaded',ring:'rings',hardware:'fit_test',export:'mount_threaded'}[type]))continue
  cases.push({key:c.key,phase:which,stem:`${c.key.replace('.','-')}-${which}`,project,target:type==='tile_layout'?'built':'test',out:type==='split_colours'?(c.key.endsWith('.colours')?'palette':'colour_1'):type==='tone_patterns'?'mask':'parts',expectedError:!!c[which]?.error,accepted_st:c[which],accepted_path:`sandbox/m5/${phase}/${c.key.replace('.','-')}-${which}.${c[which]?.extension??'zip'}`})
 }
}
if(!process.env.M5_MODES_SAMPLE&&cases.length!==256)throw Error('Complete all 128 parameter cases before replay.')
const result={modes:[],failures:[],engine_sha256:Object.fromEntries(['web/pkg/stencil_wasm_bg.wasm','web/public/pkg-mt/stencil_wasm_bg.wasm'].map(p=>[p,createHash('sha256').update(readFileSync(p)).digest('hex')])),cases:cases.map(c=>({...c}))},browser=await chromium.launch({headless:true})
for(const mode of ['st','mt']){
 if(mode==='st'&&!process.env.M5_REPLAY_ST){
  result.modes.push({mode,threads:{n:1},source:'Accepted real single-thread parameter runs; exact stored bytes and freshness checked'})
  for(const row of result.cases){if(row.expectedError){row.st={refusal:row.accepted_st.error,source:'accepted_parameter_run'};continue}
   if(!existsSync(row.accepted_path)||statSync(row.accepted_path).mtimeMs<statSync('web/pkg/stencil_wasm_bg.wasm').mtimeMs)throw Error('Stale ST evidence: '+row.stem)
   const sha256=createHash('sha256').update(readFileSync(row.accepted_path)).digest('hex');if(sha256!==row.accepted_st.sha256)throw Error('Changed ST evidence: '+row.stem)
   row.st={path:row.accepted_path,sha256,info:row.accepted_st.info,source:'accepted_parameter_run'}
  }continue
 }
 const page=await browser.newPage();await page.goto('http://localhost:5199/');const threads=await page.evaluate(async({worker,mode})=>{
  const engine=new Worker(worker,{type:'module',name:mode==='st'?'artwork-preview':'manufacturing-mode'}),pending=new Map();let seq=0
  const call=message=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{pending.delete(id);reject(Error('Manufacturing mode timed out'))},240000);pending.set(id,{resolve,reject,timer});engine.postMessage({id,...message})})
  engine.onmessage=e=>{if(e.data.step)return;const p=pending.get(e.data.id);if(!p)return;clearTimeout(p.timer);pending.delete(e.data.id);e.data.error?p.reject(Error(e.data.error)):p.resolve(e.data.ok)}
  engine.onerror=e=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error(e.message))}pending.clear()};window.m5Modes={engine,call};return call({op:'threads'})
 },{worker,mode});if(mode==='mt'&&threads.n<=1||mode==='st'&&threads.n!==1)throw Error('Wrong worker mode');result.modes.push({mode,threads})
 for(const row of result.cases){const doc=JSON.parse(readFileSync(row.project,'utf8')),start=performance.now()
  try{const actual=await page.evaluate(async({doc,target,out})=>{
   const call=window.m5Modes.call,graph=doc.graph
   for(const n of graph.nodes)if(n.type==='source'){const a=doc.images[n.params.image_id],bytes=Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0));n.params.image_id=(await call({op:'image',bytes:bytes.buffer})).id}
   const r=await call({op:'inspect',graph:JSON.stringify(graph),target,out});let s='';for(let i=0;i<r.bytes.length;i+=0x8000)s+=String.fromCharCode(...r.bytes.subarray(i,i+0x8000));return{info:r.info,mime:r.mime,data:btoa(s)}
  },{doc,target:row.target,out:row.out});if(row.expectedError)throw Error('Expected engine refusal disappeared; investigate the fixture')
   const bytes=Buffer.from(actual.data,'base64'),extension=row.out==='parts'?'zip':'png',path=`${root}/${mode}-${row.stem}.${extension}`;writeFileSync(path,bytes);row[mode]={path,milliseconds:performance.now()-start,sha256:createHash('sha256').update(bytes).digest('hex'),info:actual.info}
  }catch(error){if(!row.expectedError||!/no room/.test(String(error)))throw error;row[mode]={refusal:String(error)}}
  writeFileSync('docs/m5/manufacturing-modes.json',JSON.stringify(result,null,2)+'\n')
 }
 await page.evaluate(()=>window.m5Modes.engine.terminate());await page.close()
}
await browser.close()
for(const row of result.cases){
 if(row.out!=='parts'){row.st_mt_identical=row.st.sha256===row.mt.sha256;if(!row.st_mt_identical)result.failures.push({case:row.stem,error:'ST/MT bitmap differs'});continue}
 const into=`${root}/native-${row.stem}`;mkdirSync(into,{recursive:true});const cli=spawnSync(resolve(`target/release/stencil${process.platform==='win32'?'.exe':''}`),['--project',row.project,'--report','-o',into],{encoding:'utf8',timeout:180000,maxBuffer:8000000})
 if(row.expectedError){row.native={refusal:cli.stderr,exit_code:cli.status};row.verified_refusal=cli.status!==0&&/no room/.test(cli.stderr);if(!row.verified_refusal)result.failures.push({case:row.stem,error:'Native refusal did not match the recorded constraint'});continue}
 if(cli.status!==0){row.native={error:cli.stderr,exit_code:cli.status};result.failures.push({case:row.stem,error:cli.stderr});continue}
 const zip=`${into}/${basename(row.project,'.json')}.zip`,compare=spawnSync('python',['scripts/m5/compare_geometry.py',zip,row.st.path,row.mt.path,'--report-differences'],{encoding:'utf8',timeout:180000,maxBuffer:16000000})
 if(compare.status!==0){row.comparison_error=compare.stderr;result.failures.push({case:row.stem,error:compare.stderr});continue}
 row.native={path:zip};row.comparison=JSON.parse(compare.stdout);writeFileSync('docs/m5/manufacturing-modes.json',JSON.stringify(result,null,2)+'\n')
}
for(const row of result.cases){delete row.accepted_st;delete row.accepted_path}
result.completed_cases=cases.length;result.all_structural_checks_passed=result.failures.length===0
result.geometry_mismatches=result.cases.filter(c=>c.comparison&&(!c.comparison.st_mt_geometry_identical||!c.comparison.native_leaf_geometry_identical)).map(c=>c.stem)
writeFileSync('docs/m5/manufacturing-modes.json',JSON.stringify(result,null,2)+'\n');console.log(`Completed ${cases.length} field fixtures; ${result.failures.length} unexpected refusal or validation failures. Read all comparison flags before claiming equivalence.`)
