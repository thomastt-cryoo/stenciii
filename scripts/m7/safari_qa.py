"""Real macOS Safari via Apple's WebDriver; no Playwright WebKit claim.

Import is dispatched through the customer file input. Export bytes are fetched
from its actual blob link; Chrome acceptance separately exercises disk downloads.
"""
from pathlib import Path
import base64,json,os,socket,subprocess,sys,time,urllib.request
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/m7'))
from prove_export import prove
launcher=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
def free_port():
    with socket.socket()as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]
port=free_port();driver=subprocess.Popen(['/usr/bin/safaridriver','--port',str(port)],stdout=(out/'driver.log').open('wb'),stderr=subprocess.STDOUT);host=None;session=None
base=f'http://localhost:{port}'
def command(method,path,body=None):
    request=urllib.request.Request(base+path,data=json.dumps(body).encode()if body is not None else None,method=method,headers={'Content-Type':'application/json'})
    return json.load(urllib.request.urlopen(request,timeout=600))['value']
def execute(script,*args,async_=False):return command('POST',f'/session/{session}/execute/'+('async'if async_ else'sync'),{'script':script,'args':list(args)})
def wait(script,seconds=180):
    until=time.monotonic()+seconds
    while time.monotonic()<until:
        value=execute(script)
        if value:return value
        time.sleep(.25)
    raise AssertionError('Safari wait expired: '+script+'\n'+str(execute('return document.body.innerText')))
report={'browser':'Safari','platform':'macOS','cases':[],'export_method':'actual customer blob links, retrieved through WebDriver; disk downloads qualified separately in Chromium'}
try:
    for _ in range(60):
        try:command('GET','/status');break
        except Exception:time.sleep(.25)
    value=command('POST','/session',{'capabilities':{'alwaysMatch':{'browserName':'safari'}}});session=value['sessionId'];report['capabilities']=value['capabilities']
    command('POST',f'/session/{session}/timeouts',{'script':600000,'pageLoad':120000,'implicit':0})
    host=subprocess.Popen([str(launcher),'--automation','--no-open','--profile-dir',str(out/'profile'),'--port','0','--idle-timeout','0'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=(out/'launcher.log').open('wb'),text=True)
    ready=json.loads(host.stdout.readline());report['instance']=ready
    index=json.loads((ROOT/'docs/m7/acceptance/index.json').read_text())
    selected=(os.environ.get('M7_CASES')or'simple,colours,mounted,old-browser').split(',')
    fixtures=[r for r in index if r['name']in selected];assert len(fixtures)==len(selected)
    for fixture in fixtures:
        command('POST',f'/session/{session}/url',{'url':ready['url']})
        # Each case needs an empty workspace. Safari's automation window keeps
        # origin storage across navigations; preserve/reopen is tested below,
        # then clear only this test origin's app draft before the next case.
        execute('localStorage.removeItem("stencil-studio.project.v1")')
        command('POST',f'/session/{session}/refresh',{})
        wait('return !!Array.from(document.querySelectorAll("button")).find(e=>e.textContent==="Choose Image"&&!e.disabled)')
        raw=json.loads((ROOT/'docs/m7/acceptance'/fixture['project']).read_text())
        execute('const input=document.querySelector("[aria-label=\\\"Open project file\\\"]"),dt=new DataTransfer();dt.items.add(new File([JSON.stringify(arguments[0])],"Safari project.json",{type:"application/json"}));input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));',raw)
        href=wait('return Array.from(document.querySelectorAll("a")).find(e=>/^Export (STL|ZIP)$/.test(e.textContent)&&e.getAttribute("aria-disabled")==="false")?.href',480)
        data=execute('const done=arguments[arguments.length-1];fetch(arguments[0]).then(r=>r.arrayBuffer()).then(b=>{let s="";for(const c of new Uint8Array(b))s+=String.fromCharCode(c);done(btoa(s))}).catch(e=>done({error:String(e)}))',href,async_=True)
        file=out/(fixture['name']+('.zip'if fixture['name']in('colours','mounted')else'.stl'));file.write_bytes(base64.b64decode(data));proof=prove(file,ROOT/fixture['m6_output']if fixture['m6_output']else None)
        execute('Array.from(document.querySelectorAll("[role=tab]")).find(e=>e.textContent==="3D").click()');wait('return document.querySelector(".mesh-preview")?.dataset.ready==="true"')
        gl=execute('const c=document.querySelector(".mesh-preview canvas"),g=c?.getContext("webgl2")||c?.getContext("webgl");return g?{version:g.getParameter(g.VERSION),width:c.width,height:c.height}:null');assert gl
        if not report['cases']:(out/'actual-safari.png').write_bytes(base64.b64decode(command('GET',f'/session/{session}/screenshot')))
        stored=execute('return JSON.parse(localStorage.getItem("stencil-studio.project.v1"))');assert stored==raw
        command('POST',f'/session/{session}/refresh',{});wait('return !!document.querySelector("[aria-label=\\\"Open project file\\\"]")');assert execute('return JSON.parse(localStorage.getItem("stencil-studio.project.v1"))')==raw
        report['cases'].append({'name':fixture['name'],'passed':True,'webgl':gl,'proof':proof,'draft_reopen':True});(out/'safari-qa.json').write_text(json.dumps(report,indent=2));print('PASS Safari',fixture['name'],flush=True)
    report['resource_hosts']=execute('return [...new Set(performance.getEntriesByType("resource").map(e=>{try{return new URL(e.name).hostname}catch{return ""}}))]');assert all(h in('localhost','127.0.0.1','')for h in report['resource_hosts'])
    host.stdin.close();assert host.wait(timeout=10)==0;wait('return document.querySelector("h1")?.textContent==="Stencil Studio is closed"',15);report['shutdown_document']=True;report['passed']=True
except Exception as e:report['passed']=False;report['error']=str(e);raise
finally:
    (out/'safari-qa.json').write_text(json.dumps(report,indent=2)+'\n')
    if session:
        try:command('DELETE',f'/session/{session}')
        except Exception:pass
    if host and host.poll()is None:host.stdin.close();host.wait(timeout=10)
    driver.terminate();driver.wait(timeout=10)
