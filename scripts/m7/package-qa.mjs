// Runs the extracted customer executable, never Vite or a source-tree server.
import {createRequire} from 'node:module'
import {spawn,execFileSync} from 'node:child_process'
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs'
import {resolve,dirname} from 'node:path'
import {fileURLToPath} from 'node:url'
import {createInterface} from 'node:readline'
import assert from 'node:assert/strict'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(resolve(root,'web/package.json'))
const {chromium,firefox,webkit,expect}=require('@playwright/test')
const [launcher,output,browserName='chromium',channel='']=process.argv.slice(2)
assert(launcher&&output,'launcher and output directory required')
const out=resolve(output);mkdirSync(out,{recursive:true})
const child=spawn(resolve(launcher),['--automation','--no-open','--profile-dir',resolve(out,'profile'),'--port','0','--idle-timeout','0'],{stdio:['pipe','pipe','pipe'],windowsHide:true})
let errors='';child.stderr.on('data',b=>errors+=b)
const line=await Promise.race([new Promise((ok,bad)=>{createInterface({input:child.stdout}).once('line',ok);child.on('exit',code=>bad(Error(`Launcher exited ${code}: ${errors}`)))}),new Promise((_,bad)=>setTimeout(()=>bad(Error('Startup timeout')),25000).unref())])
const instance=JSON.parse(line),outside=[],consoleErrors=[],consoleMessages=[],cases=[]
let browser,activePage
const report={platform:process.platform,arch:process.arch,instance,browser:browserName,channel,offline:'Browser requests to every non-loopback host blocked; not an OS-wide network disconnection',cases,outside,consoleErrors,consoleMessages,limitations:[],navigation_observer_errors:[]}
const python=process.env.M7_PYTHON||'python'
const prove=(file,baseline)=>JSON.parse(execFileSync(python,[resolve(root,'scripts/m7/prove_export.py'),file,...(baseline?[resolve(root,baseline)]:[])],{encoding:'utf8',maxBuffer:32_000_000,timeout:600000}))
async function download(page,action){
 // Complete manufacturing archives can take longer than a small STL. Register
 // both promises immediately so timeout failures still reach finally/cleanup.
 const [file]=await Promise.all([page.waitForEvent('download',{timeout:240000}),action()]);return file
}
async function reloadDraft(page){
 const previous=await page.evaluate(()=>performance.timeOrigin)
 try{await page.reload({waitUntil:'domcontentloaded'})}catch(e){
  // Firefox can report an aborted download/navigation observer even when the
  // requested new document commits. Require proof of a fresh local document;
  // never turn an unchanged document or our closed-session page into a pass.
  if(browserName!=='firefox'||!String(e).includes('NS_BINDING_ABORTED'))throw e
  await expect.poll(()=>page.evaluate(()=>performance.timeOrigin)).not.toBe(previous)
  assert.equal(new URL(page.url()).origin,new URL(instance.url).origin)
  report.navigation_observer_errors.push(String(e))
 }
 await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled({timeout:60000})
}
try {
 browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:process.env.M7_HEADFUL!=='1',...(channel?{channel}:{})})
 report.version=browser.version()
 const index=JSON.parse(readFileSync(resolve(root,'docs/m7/acceptance/index.json'))),selected=process.env.M7_CASES?.split(',').map(s=>s.trim()).filter(Boolean),fixtures=selected?.length?index.filter(c=>selected.includes(c.name)):index
 assert(fixtures.length>0,'No package acceptance cases selected')
 if(selected?.length)assert.equal(fixtures.length,selected.length,'A requested package case is missing')
 for(const fixture of fixtures){
  const started=Date.now(),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage()
  activePage=page
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname)){outside.push(url.href);return route.abort()}return route.continue()})
  page.on('pageerror',e=>consoleErrors.push(String(e)))
  page.on('console',m=>{if(['warning','error'].includes(m.type())&&consoleMessages.length<100)consoleMessages.push(m.text().slice(0,2000))})
  const project=resolve(root,'docs/m7/acceptance',fixture.project),raw=JSON.parse(readFileSync(project))
  await page.goto(instance.url);await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:60000})
  await page.setInputFiles('[aria-label="Open project file"]',project)
  // There is one primary printable result link; its disabled state tracks the current project.
  await expect(page.getByRole('link',{name:/^Export (STL|ZIP)$/})).toHaveAttribute('aria-disabled','false',{timeout:480000})
  const exportLink=page.getByRole('link',{name:/^Export (STL|ZIP)$/}),kind=(await exportLink.innerText()).includes('ZIP')?'zip':'stl'
  const printable=await download(page,()=>exportLink.click()),file=resolve(out,fixture.name+'.'+kind);await printable.saveAs(file)
  const proof=prove(file,fixture.m6_output)
  // A separate, empty canvas distinguishes a disabled runner graphics API
  // from a failure to render the actual application mesh. Do not force GPU
  // preferences or claim a 3D pass when the browser cannot create WebGL2.
  const capability=await page.evaluate(()=>{const c=document.createElement('canvas'),messages=[];c.addEventListener('webglcontextcreationerror',e=>messages.push(e.statusMessage));const g=c.getContext('webgl2',{antialias:true,alpha:true});const r={available:!!g,messages,version:g?.getParameter(g.VERSION)};g?.getExtension('WEBGL_lose_context')?.loseContext();return r})
  await page.getByRole('tab',{name:'3D',exact:true}).click();let gl
  if(capability.available){
   await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true',{timeout:120000})
   gl=await page.locator('.mesh-preview canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');return gl?{version:gl.getParameter(gl.VERSION),width:canvas.width,height:canvas.height}:null});assert(gl&&gl.width>0&&gl.height>0)
  }else{
   await expect(page.getByRole('alert').filter({hasText:'3D rendering is unavailable'})).toBeVisible()
   gl={tested:false,reason:'An independent empty canvas also cannot create WebGL2',capability};report.limitations.push({case:fixture.name,feature:'3D preview',...gl})
  }
  if(cases.length===0){
   await page.screenshot({path:resolve(out,'actual-3d-preview.png'),fullPage:true})
   await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('diagnostics');await page.getByRole('button',{name:'Engine diagnostics and processing reports',exact:true}).click();await page.locator('.engine-diagnostics>summary').click()
   const diagnostic=await download(page,()=>page.getByRole('button',{name:'Download diagnostic report JSON',exact:true}).click()),diagnosticFile=resolve(out,'initial-engine.json');await diagnostic.saveAs(diagnosticFile);report.initial_engine=JSON.parse(readFileSync(diagnosticFile)).engine
   await page.getByRole('button',{name:'Close settings',exact:true}).click()
  }
  const saved=await download(page,()=>page.getByRole('button',{name:'Save Project',exact:true}).click()),savedFile=resolve(out,fixture.name+'-saved.json');await saved.saveAs(savedFile)
  assert.deepEqual(JSON.parse(readFileSync(savedFile)),raw)
  await reloadDraft(page);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1'))),raw)
  await page.setInputFiles('[aria-label="Open project file"]',savedFile);await expect(exportLink).toHaveAttribute('aria-disabled','false',{timeout:480000})
  cases.push({name:fixture.name,passed:true,elapsed_ms:Date.now()-started,webgl:gl,proof,lossless_save_reopen:true})
  writeFileSync(resolve(out,'package-qa.json'),JSON.stringify(report,null,2));console.log(`PASS ${browserName} ${fixture.name}`)
  await context.close()
 }
 // Prove the real single-thread fallback using a blocked MT build.
 const context=await browser.newContext(),page=await context.newPage();activePage=page
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)){outside.push(u.href);return route.abort()}if(u.pathname.startsWith('/pkg-mt/'))return route.abort();return route.continue()})
 await page.goto(instance.url);await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:60000});await page.setInputFiles('[aria-label="Open project file"]',resolve(root,'docs/m7/acceptance/simple.json'));await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 const dl=await download(page,()=>page.getByRole('link',{name:'Export STL',exact:true}).click()),fallback=resolve(out,'single-thread.stl');await dl.saveAs(fallback);report.single_thread={passed:true,proof:prove(fallback,'docs/m6/workflows/simple.stl')}
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('diagnostics');await page.getByRole('button',{name:'Engine diagnostics and processing reports',exact:true}).click();await page.locator('.engine-diagnostics>summary').click();await expect(page.locator('.engine-diagnostics')).toContainText('1 threads')
 await page.getByRole('button',{name:'Close settings',exact:true}).click()
 // Reuse a portable recipe for a real local numeric sweep with two jobs.
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Batch processing and diagnostics',exact:true}).click();await page.setInputFiles('[aria-label="Batch saved project"]',resolve(root,'docs/m7/acceptance/layout-offsets.json'))
 await page.locator('.batch-workbench summary').filter({hasText:'Output settings'}).click();await page.getByRole('checkbox',{name:'Include actual layout PNG',exact:true}).check();await page.getByRole('checkbox',{name:'Include outlines SVG before bridges',exact:true}).check()
 await page.getByRole('button',{name:'Add parameter variation',exact:true}).click();const raw=JSON.parse(readFileSync(resolve(root,'docs/m7/acceptance/layout-offsets.json'))),layout=raw.graph.nodes.find(n=>n.type==='tile_layout')
 await page.getByRole('combobox',{name:'Variation setting 1',exact:true}).selectOption(JSON.stringify([layout.id,'depth']));await page.getByRole('spinbutton',{name:'Variation start 1',exact:true}).fill('6');await page.getByRole('spinbutton',{name:'Variation end 1',exact:true}).fill('8');await page.getByRole('spinbutton',{name:'Variation increment 1',exact:true}).fill('2')
 await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:480000});const batch=await download(page,()=>page.getByRole('link',{name:'Download batch collection',exact:true}).click()),batchFile=resolve(out,'batch-sweep.zip');await batch.saveAs(batchFile)
 report.batch=JSON.parse(execFileSync(python,[resolve(root,'scripts/m6/validate_batch.py'),batchFile],{encoding:'utf8',maxBuffer:32_000_000,timeout:600000}));assert.equal(report.batch.verified_jobs,2)
 assert(report.batch.jobs.every(job=>job.files.some(f=>f.path.endsWith('.png'))&&job.files.some(f=>f.path.endsWith('.svg'))),'Actual PNG and SVG attachments are required')
 report.batch_formats=JSON.parse(execFileSync(python,[resolve(root,'scripts/m7/batch_formats.py'),batchFile],{encoding:'utf8',maxBuffer:32_000_000,timeout:600000}))
 // Explicit launcher shutdown must end the old document and its entire worker tree.
 child.stdin.end();await expect(page.getByRole('heading',{name:'Stencil Studio is closed',exact:true})).toBeVisible({timeout:15000});report.shutdown_document=true
 await context.close();assert.equal(outside.length,0);assert.deepEqual(consoleErrors,[]);report.passed=true;report.qualification=report.limitations.length?'passed_with_graphics_limit':'passed'
}catch(e){
 report.passed=false;report.error=String(e.stack||e)
 if(activePage)try{report.failure_text=await activePage.locator('body').innerText({timeout:2000});await activePage.screenshot({path:resolve(out,'failure.png'),fullPage:true,timeout:5000})}catch{}
 throw e
}
finally{child.stdin.end();if(browser)await browser.close();writeFileSync(resolve(out,'package-qa.json'),JSON.stringify(report,null,2));setTimeout(()=>child.kill(),5000).unref()}
