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
const instance=JSON.parse(line),outside=[],consoleErrors=[],cases=[]
let browser
const report={platform:process.platform,arch:process.arch,instance,browser:browserName,channel,offline:'Browser requests to every non-loopback host blocked; not an OS-wide network disconnection',cases,outside,consoleErrors}
const python=process.env.M7_PYTHON||'python'
const prove=(file,baseline)=>JSON.parse(execFileSync(python,[resolve(root,'scripts/m7/prove_export.py'),file,...(baseline?[resolve(root,baseline)]:[])],{encoding:'utf8',maxBuffer:32_000_000,timeout:600000}))
try {
 browser=await ({chromium,firefox,webkit}[browserName]).launch({headless:process.env.M7_HEADFUL!=='1',...(channel?{channel}:{})})
 report.version=browser.version()
 const index=JSON.parse(readFileSync(resolve(root,'docs/m7/acceptance/index.json'))),selected=process.env.M7_CASES?.split(','),fixtures=selected?index.filter(c=>selected.includes(c.name)):index
 for(const fixture of fixtures){
  const started=Date.now(),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage()
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(url.hostname)){outside.push(url.href);return route.abort()}return route.continue()})
  page.on('pageerror',e=>consoleErrors.push(String(e)))
  const project=resolve(root,'docs/m7/acceptance',fixture.project),raw=JSON.parse(readFileSync(project))
  await page.goto(instance.url);await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:60000})
  await page.setInputFiles('[aria-label="Open project file"]',project)
  // There is one primary printable result link; its disabled state tracks the current project.
  await expect(page.getByRole('link',{name:/^Export (STL|ZIP)$/})).toHaveAttribute('aria-disabled','false',{timeout:480000})
  const exportLink=page.getByRole('link',{name:/^Export (STL|ZIP)$/}),kind=(await exportLink.innerText()).includes('ZIP')?'zip':'stl'
  const downloadEvent=page.waitForEvent('download');await exportLink.click();const file=resolve(out,fixture.name+'.'+kind);await(await downloadEvent).saveAs(file)
  const proof=prove(file,fixture.m6_output)
  await page.getByRole('tab',{name:'3D',exact:true}).click();await expect(page.locator('.mesh-preview')).toHaveAttribute('data-ready','true',{timeout:120000})
  const gl=await page.locator('.mesh-preview canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');return gl?{version:gl.getParameter(gl.VERSION),width:canvas.width,height:canvas.height}:null});assert(gl&&gl.width>0&&gl.height>0)
  if(cases.length===0){
   await page.screenshot({path:resolve(out,'actual-3d-preview.png'),fullPage:true})
   await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('diagnostics');await page.getByRole('button',{name:'Engine diagnostics and processing reports',exact:true}).click();await page.locator('.engine-diagnostics>summary').click()
   const diagnosticEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Download diagnostic report JSON',exact:true}).click();const diagnosticFile=resolve(out,'initial-engine.json');await(await diagnosticEvent).saveAs(diagnosticFile);report.initial_engine=JSON.parse(readFileSync(diagnosticFile)).engine
   await page.getByRole('button',{name:'Close settings',exact:true}).click()
  }
  const saved=page.waitForEvent('download');await page.getByRole('button',{name:'Save Project',exact:true}).click();const savedFile=resolve(out,fixture.name+'-saved.json');await(await saved).saveAs(savedFile)
  assert.deepEqual(JSON.parse(readFileSync(savedFile)),raw)
  await page.reload();await expect(page.getByRole('button',{name:'All Settings',exact:true})).toBeEnabled({timeout:60000});assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1'))),raw)
  await page.setInputFiles('[aria-label="Open project file"]',savedFile);await expect(exportLink).toHaveAttribute('aria-disabled','false',{timeout:480000})
  cases.push({name:fixture.name,passed:true,elapsed_ms:Date.now()-started,webgl:gl,proof,lossless_save_reopen:true})
  writeFileSync(resolve(out,'package-qa.json'),JSON.stringify(report,null,2));console.log(`PASS ${browserName} ${fixture.name}`)
  await context.close()
 }
 // Prove the real single-thread fallback using a blocked MT build.
 const context=await browser.newContext(),page=await context.newPage()
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!['localhost','127.0.0.1'].includes(u.hostname)){outside.push(u.href);return route.abort()}if(u.pathname.startsWith('/pkg-mt/'))return route.abort();return route.continue()})
 await page.goto(instance.url);await expect(page.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:60000});await page.setInputFiles('[aria-label="Open project file"]',resolve(root,'docs/m7/acceptance/simple.json'));await expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 const dl=page.waitForEvent('download');await page.getByRole('link',{name:'Export STL',exact:true}).click();const fallback=resolve(out,'single-thread.stl');await(await dl).saveAs(fallback);report.single_thread={passed:true,proof:prove(fallback,'docs/m6/workflows/simple.stl')}
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('searchbox').fill('diagnostics');await page.getByRole('button',{name:'Engine diagnostics and processing reports',exact:true}).click();await page.locator('.engine-diagnostics>summary').click();await expect(page.locator('.engine-diagnostics')).toContainText('1 threads')
 await page.getByRole('button',{name:'Close settings',exact:true}).click()
 // Reuse a portable recipe for a real local numeric sweep with two jobs.
 await page.getByRole('button',{name:'All Settings',exact:true}).click();await page.getByRole('button',{name:'Batch processing and diagnostics',exact:true}).click();await page.setInputFiles('[aria-label="Batch saved project"]',resolve(root,'docs/m7/acceptance/simple.json'))
 await page.getByRole('button',{name:'Add parameter variation',exact:true}).click();const raw=JSON.parse(readFileSync(resolve(root,'docs/m7/acceptance/simple.json'))),plate=raw.graph.nodes.find(n=>n.type==='stencil')
 await page.getByRole('combobox',{name:'Variation setting 1',exact:true}).selectOption(JSON.stringify([plate.id,'thickness_mm']));await page.getByRole('spinbutton',{name:'Variation start 1',exact:true}).fill('2');await page.getByRole('spinbutton',{name:'Variation end 1',exact:true}).fill('3');await page.getByRole('spinbutton',{name:'Variation increment 1',exact:true}).fill('1')
 await page.getByRole('button',{name:'Run local batch',exact:true}).click();await expect(page.getByRole('link',{name:'Download batch collection',exact:true})).toBeVisible({timeout:480000});const batchEvent=page.waitForEvent('download');await page.getByRole('link',{name:'Download batch collection',exact:true}).click();const batchFile=resolve(out,'batch-sweep.zip');await(await batchEvent).saveAs(batchFile)
 report.batch=JSON.parse(execFileSync(python,[resolve(root,'scripts/m6/validate_batch.py'),batchFile],{encoding:'utf8',maxBuffer:32_000_000,timeout:600000}));assert.equal(report.batch.verified_jobs,2)
 // Explicit launcher shutdown must end the old document and its entire worker tree.
 child.stdin.end();await expect(page.getByRole('heading',{name:'Stencil Studio is closed',exact:true})).toBeVisible({timeout:15000});report.shutdown_document=true
 await context.close();assert.equal(outside.length,0);assert.deepEqual(consoleErrors,[]);report.passed=true
}catch(e){report.passed=false;report.error=String(e.stack||e);throw e}
finally{child.stdin.end();if(browser)await browser.close();writeFileSync(resolve(out,'package-qa.json'),JSON.stringify(report,null,2));setTimeout(()=>child.kill(),5000).unref()}
