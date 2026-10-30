// Customer binaries: simultaneous launches, two live projects and a folder update.
import {createRequire} from 'node:module'
import {spawn} from 'node:child_process'
import {createInterface} from 'node:readline'
import {mkdir,mkdtemp,cp,realpath,rm,readFile,writeFile} from 'node:fs/promises'
import {dirname,resolve,join,relative,basename} from 'node:path'
import {fileURLToPath} from 'node:url'
import assert from 'node:assert/strict'
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),require=createRequire(join(root,'web/package.json')),{chromium,expect}=require('@playwright/test')
const [launcherArg,outArg]=process.argv.slice(2);assert(launcherArg&&outArg)
const launcher=resolve(launcherArg),out=resolve(outArg),base=join(root,'sandbox/m7');await mkdir(base,{recursive:true});await mkdir(out,{recursive:true})
const temporary=await mkdtemp(join(base,'lifecycle-')),children=[],report={platform:process.platform,checks:[]};let browser
const delay=ms=>new Promise(ok=>setTimeout(ok,ms))
const exit=child=>child.exitCode!==null?Promise.resolve(child.exitCode):new Promise((ok,bad)=>{const t=setTimeout(()=>bad(Error('Launcher did not exit')),15000);child.once('exit',code=>{clearTimeout(t);ok(code)})})
async function boot(executable,profile,options=[]){
 const child=spawn(executable,['--automation','--no-open','--profile-dir',profile,...options],{stdio:['pipe','pipe','pipe'],windowsHide:true});children.push(child);child.stdin.on('error',()=>{})
 let error='';child.stderr.on('data',b=>error+=b)
 const data=await new Promise((ok,bad)=>{const t=setTimeout(()=>bad(Error('Launcher startup timed out: '+error)),30000);createInterface({input:child.stdout}).once('line',line=>{clearTimeout(t);try{ok(JSON.parse(line))}catch(e){bad(e)}});child.once('error',bad);child.once('exit',code=>{clearTimeout(t);bad(Error(`Launcher exited ${code}: ${error}`))})})
 return {child,data}
}
async function stop(child){if(child.exitCode===null)child.stdin.end();assert.equal(await exit(child),0)}
async function save(page){const [file]=await Promise.all([page.waitForEvent('download',{timeout:60000}),page.getByRole('button',{name:'Save Project',exact:true}).click()]);return JSON.parse(await readFile(await file.path(),'utf8'))}
try{
 const concurrent=await Promise.all(Array.from({length:6},()=>boot(launcher,join(temporary,'simultaneous'),['--port','0','--idle-timeout','0'])))
 assert.equal(concurrent.filter(r=>r.data.alreadyRunning===true).length,5);assert.equal(concurrent.filter(r=>r.data.port).length,1)
 for(const r of concurrent)await stop(r.child)
 report.checks.push('Six simultaneous launches produce one server and five duplicate refusals')
 const profile=join(temporary,'stable-profile'),first=await boot(launcher,profile,['--port','0','--idle-timeout','3'])
 browser=await chromium.launch({headless:true});const context=await browser.newContext({acceptDownloads:true})
 await context.addInitScript(()=>{const Native=WebSocket;globalThis.__m7sockets=[];globalThis.WebSocket=class extends Native{constructor(...args){super(...args);globalThis.__m7sockets.push(this)}}})
 const a=await context.newPage()
 const origin=new URL(first.data.url).origin,outside=[]
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===origin||u.protocol==='data:')return route.continue();outside.push(u.href);return route.abort()})
 const text=JSON.parse(await readFile(join(root,'docs/m7/acceptance/text.json'),'utf8')),one=structuredClone(text),two=structuredClone(text)
 one.stencilStudio={schema:1,name:'Concurrent project A'};two.stencilStudio={schema:1,name:'Concurrent project B'};one.graph.nodes.find(n=>n.type==='text').params.text='ALPHA 1';two.graph.nodes.find(n=>n.type==='text').params.text='BETA 2'
 const ready=page=>expect(page.getByRole('link',{name:'Export STL',exact:true})).toHaveAttribute('aria-disabled','false',{timeout:120000})
 const load=async(page,doc)=>{await page.setInputFiles('[aria-label="Open project file"]',{name:'Project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(doc))});await ready(page)}
 await a.goto(first.data.url);await expect(a.getByRole('button',{name:'Choose Image',exact:true})).toBeEnabled({timeout:60000});await load(a,one)
 await expect.poll(()=>a.evaluate(()=>globalThis.__m7sockets[0]?.readyState)).toBe(1)
 await a.evaluate(()=>globalThis.__m7sockets[0].close())
 await expect.poll(()=>a.evaluate(()=>globalThis.__m7sockets.filter(s=>s.readyState===1).length),{timeout:10000}).toBe(1)
 await ready(a);assert.equal(first.child.exitCode,null)
 report.checks.push('Transient socket closure recovers the same live session instead of ending the document')
 await a.reload();await ready(a);assert.deepEqual(await save(a),one)
 report.checks.push('Reload preserves the live session and exact saved project')
 const b=await context.newPage();await b.goto(first.data.url);await ready(b);await load(b,two)
 assert.deepEqual(await save(a),one);assert.deepEqual(await save(b),two)
 // Make the last browser draft explicit; there is one draft slot per origin.
 await load(b,two);await expect.poll(()=>b.evaluate(()=>JSON.parse(localStorage.getItem('stencil-studio.project.v1')))).toEqual(two)
 await a.close();await delay(3600);assert.equal(first.child.exitCode,null)
 report.checks.push('Two projects save independently; closing one tab keeps the other alive')
 first.child.stdin.end();await expect(b.getByRole('heading',{name:'Stencil Studio is closed',exact:true})).toBeVisible({timeout:15000});assert.equal(await exit(first.child),0)
 await expect.poll(()=>b.workers().length).toBe(0);report.checks.push('Quitting ends the old document and its main worker contexts')
 const appRoot=process.platform==='darwin'?resolve(dirname(launcher),'../..'):dirname(launcher),updated=join(temporary,'updated',process.platform==='darwin'?'Stencil Studio.app':'Studio')
 await cp(appRoot,updated,{recursive:true,preserveTimestamps:true})
 const second=await boot(join(updated,relative(appRoot,launcher)),profile,['--idle-timeout','3']);assert.equal(second.data.url,first.data.url)
 await b.goto(second.data.url);await ready(b);assert.deepEqual(await save(b),two)
 report.checks.push('Launching from an updated folder preserves the origin and exact browser draft')
 await b.close();assert.equal(await exit(second.child),0);report.checks.push('Closing the last tab automatically ends launcher and server')
 assert.deepEqual(outside,[]);await context.close();report.passed=true
}catch(e){report.passed=false;report.error=String(e.stack||e);throw e}
finally{
 for(const child of children)if(child.exitCode===null)child.stdin.end()
 if(browser)await browser.close()
 for(const child of children)if(child.exitCode===null)try{await exit(child)}catch{child.kill()}
 await writeFile(join(out,'lifecycle-qa.json'),JSON.stringify(report,null,2)+'\n')
 const canonical=await realpath(temporary),canonicalBase=await realpath(base);assert.equal(dirname(canonical),canonicalBase);assert(basename(canonical).startsWith('lifecycle-'));await rm(canonical,{recursive:true,force:true,maxRetries:5,retryDelay:300})
}
