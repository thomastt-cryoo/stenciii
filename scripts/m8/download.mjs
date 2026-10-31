// Native installed Chrome download: do not use saveAs/curl, which can lose OS origin metadata.
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
const require=createRequire(resolve('web/package.json')),{chromium}=require('@playwright/test')
const [name,directory,report]=process.argv.slice(2),folder=resolve(directory)
mkdirSync(folder,{recursive:true});mkdirSync(resolve(report,'..'),{recursive:true})
const url='https://raw.githubusercontent.com/thomastt-cryoo/stenciii/e2511ed68a0ec931b09c08f867f59a8f78100338/m7-current/customer/'+encodeURIComponent(name)
const result={url,method:'Installed Chrome, native CDP download directory; no saveAs or origin stamping',file:resolve(folder,name)}
let browser
try{
 result.headless=process.env.M8_DOWNLOAD_HEADLESS==='1'
 browser=await chromium.launch({channel:'chrome',headless:result.headless})
 result.browser=browser.version()
 const page=await browser.newPage(),cdp=await browser.newBrowserCDPSession()
 const {browserContextIds}=await cdp.send('Target.getBrowserContexts')
 if(browserContextIds.length!==1)throw Error('Expected one isolated download browser context')
 await cdp.send('Browser.setDownloadBehavior',{behavior:'allow',browserContextId:browserContextIds[0],downloadPath:folder,eventsEnabled:true})
 const done=new Promise((ok,bad)=>{
  cdp.on('Browser.downloadWillBegin',e=>result.suggestedFilename=e.suggestedFilename)
  cdp.on('Browser.downloadProgress',e=>{if(e.state==='completed')ok();if(e.state==='canceled')bad(Error('Native browser download canceled'))})
  setTimeout(()=>bad(Error('Native browser download timed out')),90000).unref()
 })
 // Attachment navigation normally reports ERR_ABORTED; completion is independently required.
 await page.goto(url).catch(e=>{result.navigation=String(e)})
 await done
 const b=readFileSync(result.file),m=JSON.parse(readFileSync('distribution/m7/delivery-manifest.json')).files.find(f=>f.file===name)
 result.bytes=b.length;result.sha256=createHash('sha256').update(b).digest('hex')
 if(result.bytes!==m.bytes||result.sha256!==m.sha256)throw Error('Downloaded bytes do not match accepted M7 manifest')
 result.passed=true
}catch(e){result.passed=false;result.error=String(e);process.exitCode=1}
finally{if(browser)await browser.close();writeFileSync(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))}
