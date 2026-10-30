import {test,expect} from '@playwright/test'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {execFile,execFileSync} from 'node:child_process'
import {promisify} from 'node:util'
import {m5Project} from './m5-fixtures'
test.setTimeout(600000);test.use({actionTimeout:30000})
const exec=promisify(execFile)

for(const count of [20,128])test(`maximum supported browser ${count===20?'image batch':'128-job parameter sweep'} completes with real validated outputs`,async({page,browser})=>{
 const outside:string[]=[];await page.route('**/*',route=>{if(new URL(route.request().url()).hostname!=='localhost'){outside.push(route.request().url());return route.abort()}return route.continue()})
 const doc=m5Project('export','max_x');Object.assign(doc.graph.nodes.find(n=>n.id==='test')!.params,{max_x:0,max_y:0,pad_count:0,mount_screw:'none'});doc.graph.nodes.find(n=>n.type==='source')!.params.resolution=100
 await page.goto('/');await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled();await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Batch processing and diagnostics',exact:true}).click();await page.setInputFiles('[aria-label="Batch saved project"]',{name:'Limit recipe.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))})
 if(count===20)await page.setInputFiles('[aria-label="Batch local images"]',Array.from({length:20},(_,i)=>({name:`local-${i+1}.svg`,mimeType:'image/svg+xml',buffer:Buffer.from(doc.images.original.base64,'base64')})))
 else{
  await page.getByRole('button',{name:'Add parameter variation',exact:true}).click();await page.getByRole('combobox',{name:'Variation setting 1',exact:true}).selectOption(JSON.stringify(['build','width_mm']));await page.getByRole('spinbutton',{name:'Variation start 1',exact:true}).fill('100');await page.getByRole('spinbutton',{name:'Variation end 1',exact:true}).fill('228');await page.getByRole('spinbutton',{name:'Variation increment 1',exact:true}).fill('1');await expect(page.locator('.batch-workload')).toContainText('128 values');await expect(page.getByRole('button',{name:'Run local batch',exact:true})).toBeDisabled();await page.getByRole('spinbutton',{name:'Variation end 1',exact:true}).fill('227')
 }
 await expect(page.locator('.batch-workload')).toContainText(`${count} jobs planned`);await page.locator('.batch-workbench summary').filter({hasText:'Output settings'}).click();await page.getByRole('combobox',{name:'Batch output format',exact:true}).selectOption('stl')
 const session=await browser.newBrowserCDPSession(),samples:any[]=[],start=Date.now();let sampling=false
 const sample=async()=>{if(sampling)return;sampling=true;try{const info=await session.send('SystemInfo.getProcessInfo'),pids=info.processInfo.map((p:any)=>p.id);let memory:any
  if(process.platform==='win32'){const r=await exec('pwsh',['-NoProfile','-Command',`Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Compress`]);memory=JSON.parse(r.stdout||'[]')}
  else memory=pids.flatMap((id:number)=>{try{const s=readFileSync(`/proc/${id}/status`,'utf8'),rss=/VmRSS:\s+(\d+)/.exec(s);return[{Id:id,WorkingSet64:Number(rss?.[1]??0)*1024,PrivateMemorySize64:null}]}catch{return[]}})
  if(!Array.isArray(memory))memory=[memory];samples.push({elapsedMs:Date.now()-start,processes:info.processInfo,memory,sumWorkingSetBytes:memory.reduce((n:number,p:any)=>n+p.WorkingSet64,0)})
 }finally{sampling=false}}
 await page.evaluate(()=>{const w=window as any;w.__m6Frames={count:0,maxGapMs:0,last:performance.now(),active:true};const frame=(now:number)=>{const s=w.__m6Frames;s.count++;s.maxGapMs=Math.max(s.maxGapMs,now-s.last);s.last=now;if(s.active)requestAnimationFrame(frame)};requestAnimationFrame(frame)})
 await sample();const timer=setInterval(()=>void sample().catch(()=>{}),5000)
 try{
  await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:540000})
  await sample();const elapsedMs=Date.now()-start,frames=await page.evaluate(()=>{const s=(window as any).__m6Frames;s.active=false;return s})
  const event=page.waitForEvent('download');await page.getByRole('link',{name:'Download batch collection',exact:true}).click();const archive=`../sandbox/m6/batch/maximum-${count}.zip`;mkdirSync('../sandbox/m6/batch',{recursive:true});await(await event).saveAs(archive)
  const checked=JSON.parse(execFileSync('python',['../scripts/m6/validate_batch.py',archive],{encoding:'utf8',maxBuffer:24000000}));expect(checked.verified_jobs).toBe(count);expect(checked.all_stls_valid).toBe(true);expect(checked.summary.failed).toBe(0);expect(checked.summary.cancelled).toBe(0);expect(outside).toEqual([]);expect(frames.count).toBeGreaterThan(100);expect(frames.maxGapMs).toBeLessThan(2000)
  for(const name of ['CSV','JSON']){const download=page.waitForEvent('download');await page.getByRole('link',{name:`Download ${name} summary`,exact:true}).click();const file=(await(await download).path())!;expect(readFileSync(file).length).toBeGreaterThan(100);if(name==='JSON')expect(JSON.parse(readFileSync(file,'utf8'))).toEqual(checked.summary)}
  mkdirSync('../docs/m6/performance',{recursive:true});writeFileSync(`../docs/m6/performance/batch-${count}.json`,JSON.stringify({elapsedMs,frames,memoryMeasurement:'Observed samples of this owned Chromium process tree. Summed working sets include shared pages and are not unique physical memory. Worker WASM memory is included in its process, not separately attributed.',samples,observedPeakSumWorkingSetBytes:Math.max(...samples.map(s=>s.sumWorkingSetBytes)),validation:checked},null,2))
 }finally{clearInterval(timer);await session.detach()}
})
