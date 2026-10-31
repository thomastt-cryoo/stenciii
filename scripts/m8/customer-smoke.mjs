// Final customer spot check against the exact extracted Windows customer package.
// Existing complete M7 manufacturing/browser suites are carried forward separately.
import {createRequire} from 'node:module'
import {spawn,execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {createInterface} from 'node:readline'
import assert from 'node:assert/strict'
const require=createRequire(resolve('web/package.json')),{chromium,expect}=require('@playwright/test')
const [launcher,output]=process.argv.slice(2),out=resolve(output);mkdirSync(out,{recursive:true})
const report={cases:[],outside_requests:[],page_errors:[],security_qualification:false,scope:'Exact extracted customer ZIP; owned headless installed Chrome profile, not first-download approval'}
const child=spawn(resolve(launcher),['--automation','--no-open','--profile-dir',resolve(out,'profile'),'--port','0','--idle-timeout','0'],{stdio:['pipe','pipe','pipe'],windowsHide:true})
let browser,errors='';child.stderr.on('data',b=>errors+=b)
const prove=(file,baseline)=>JSON.parse(execFileSync('python',['scripts/m7/prove_export.py',file,...(baseline?[baseline]:[])],{encoding:'utf8',maxBuffer:32_000_000,timeout:180000}))
try{
 const line=await Promise.race([new Promise((ok,bad)=>{createInterface({input:child.stdout}).once('line',ok);child.on('exit',code=>bad(Error(`Launcher exited ${code}: ${errors}`)))}),new Promise((_,bad)=>setTimeout(()=>bad(Error('Startup timeout')),25000).unref())])
 const ready=JSON.parse(line);report.instance=ready
 browser=await chromium.launch({channel:'chrome',headless:true});report.browser=browser.version()
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage()
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)){report.outside_requests.push(u.href);return route.abort()}return route.continue()})
 page.on('pageerror',e=>report.page_errors.push(String(e)))
 const waitReady=async kind=>{await expect(page.getByRole('link',{name:'Export '+kind,exact:true})).toHaveAttribute('aria-disabled','false',{timeout:180000})}
 const download=async(action,name)=>{const [d]=await Promise.all([page.waitForEvent('download',{timeout:180000}),action()]);const p=resolve(out,name);await d.saveAs(p);return p}
 const save=async name=>{const p=await download(()=>page.getByRole('button',{name:'Save Project',exact:true}).click(),name);return {path:p,project:JSON.parse(readFileSync(p))}}
 const view=async()=>{await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true',{timeout:90000});assert(await page.locator('.mesh-preview canvas').count()>0)}
 await page.goto(ready.url);await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:60000})
 await page.setInputFiles('[aria-label="Choose image file"]','web/e2e/corpus/simple-logo.svg')
 await page.getByRole('button',{name:'Make Stencil',exact:true}).click();await waitReady('STL')
 await page.getByRole('spinbutton',{name:'Stencil width',exact:true}).fill('160')
 await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')).graph.nodes.some(n=>n.params.width_mm===160))).toBe(true)
 await waitReady('STL');await view()
 await expect(page.locator('.preview-caption')).toContainText('160.0')
 const file=await download(()=>page.getByRole('link',{name:'Export STL',exact:true}).click(),'beginner.stl')
 const proof=prove(file),saved=await save('beginner-project.json')
 await page.reload();await waitReady('STL')
 assert.deepEqual((await save('beginner-reload.json')).project,saved.project)
 await page.getByRole('button',{name:'New Project',exact:true}).click()
 await page.setInputFiles('[aria-label="Open project file"]',saved.path);await waitReady('STL')
 assert.deepEqual((await save('beginner-reopened.json')).project,saved.project)
 await page.screenshot({path:resolve(out,'beginner.png'),fullPage:true})
 report.cases.push({name:'beginner upload, generate, customize width, 3D, STL, save, reload and reopen',passed:true,proof})
 const index=JSON.parse(readFileSync('docs/m7/acceptance/index.json'))
 for(const name of ['colours','first','mounted']){
  const f=index.find(f=>f.name===name),p=resolve('docs/m7/acceptance',f.project),raw=JSON.parse(readFileSync(p))
  await page.setInputFiles('[aria-label="Open project file"]',p);await waitReady('ZIP');await view()
  const zip=await download(()=>page.getByRole('link',{name:'Export ZIP',exact:true}).click(),name+'.zip')
  const proof=prove(zip,f.m6_output),s=await save(name+'-saved.json');assert.deepEqual(s.project,raw)
  await page.setInputFiles('[aria-label="Open project file"]',s.path);await waitReady('ZIP');assert.deepEqual((await save(name+'-reopened.json')).project,raw)
  report.cases.push({name,passed:true,proof,lossless_reopen:true})
 }
 child.stdin.end();await expect(page.getByRole('heading',{name:'Stencil Studio is closed',exact:true})).toBeVisible({timeout:15000});await expect.poll(()=>page.workers().length).toBe(0)
 assert.deepEqual(report.outside_requests,[]);assert.deepEqual(report.page_errors,[])
 report.shutdown_document=true;report.passed=true;console.log('PASS beginner and three manufacturing workflows from exact customer ZIP')
}catch(e){report.passed=false;report.error=String(e.stack||e);process.exitCode=1}
finally{child.stdin.end();if(browser)await browser.close();writeFileSync(resolve(out,'customer-smoke.json'),JSON.stringify(report,null,2)+'\n');setTimeout(()=>child.kill(),5000).unref()}
