"""Exercise the extracted launcher/server, including hostile HTTP and lifecycle.

Uses only Python's standard library. No customer's browser profile is touched.
"""
from pathlib import Path
import argparse,base64,hashlib,http.client,json,os,socket,subprocess,tempfile,time,urllib.parse
def check(launcher,out):
    out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True);launcher=Path(launcher).resolve();results=[]
    def start(profile,*args):
        p=subprocess.Popen([str(launcher),'--automation','--no-open','--profile-dir',str(profile),*args],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
        line=p.stdout.readline();assert line,(p.poll(),p.stderr.read());return p,json.loads(line)
    def stop(p):
        p.stdin.close();assert p.wait(timeout=10)==0,p.stderr.read()
    with tempfile.TemporaryDirectory(prefix='studio-qa-',dir=out)as temp:
        profile=Path(temp)/'profile';p,ready=start(profile,'--port','0','--idle-timeout','0');port=ready['port'];origin=f'http://localhost:{port}'
        def get(path,method='GET',headers=None):
            c=http.client.HTTPConnection('127.0.0.1',port,timeout=10);c.request(method,path,headers={'Host':f'localhost:{port}',**(headers or{})});r=c.getresponse();status=r.status;h=dict((k.lower(),v)for k,v in r.getheaders());b=r.read();c.close();return status,h,b
        try:
            status,headers,body=get('/');assert status==200 and b'<html'in body
            for key,value in [('cross-origin-opener-policy','same-origin'),('cross-origin-embedder-policy','require-corp'),('x-content-type-options','nosniff')]:assert headers[key]==value
            assert "object-src 'none'"in headers['content-security-policy'];assert headers.get('access-control-allow-origin')is None
            status,h,b=get('/',headers={'If-None-Match':headers['etag']});assert status==304 and not b and h['cross-origin-embedder-policy']=='require-corp'
            assert get('/',method='HEAD')[2]==b''
            assert get('/',headers={'Accept-Encoding':'gzip'})[1]['content-encoding']=='gzip'
            assert 'content-encoding'not in get('/',headers={'Accept-Encoding':'gzip;q=0'})[1]
            for path in ['/../Cargo.toml','/%2e%2e/Cargo.toml','/foo/%2e%2e/index.html','/a%5cb','/C:%5cUsers','//example.com/','/x%00y']:
                assert get(path)[0]==400,path
            assert get('/',headers={'Host':'evil.example'})[0]==403
            assert get('/',headers={'Origin':'https://evil.example'})[0]==403
            assert get('/',method='POST')[0]==405
            assert get('/legacy.html')[0]==404
            assert get('/pkg-mt/stencil_wasm_bg.wasm')[1]['content-type']=='application/wasm'
            session=json.loads(get('/__studio/session')[2]);assert len(session['session'])==48
            # Origin and unpredictable session nonce are required for tab ownership.
            key=base64.b64encode(b'0123456789abcdef').decode();wsheaders={'Upgrade':'websocket','Connection':'Upgrade','Sec-WebSocket-Key':key,'Sec-WebSocket-Version':'13','Origin':origin}
            assert get('/__studio/lease?session=wrong',headers=wsheaders)[0]==403
            assert get('/__studio/lease?session='+session['session'],headers={**wsheaders,'Origin':'https://evil.example'})[0]==403
            duplicate,data=start(profile,'--port','0');assert data=={'alreadyRunning':True};assert duplicate.wait(timeout=10)==0
            results.extend(['embedded HTTP assets','WASM MIME','COOP/COEP/CSP on successful and cached responses','gzip including q=0','HEAD','unsafe paths rejected','foreign Host/Origin rejected','read-only methods','production bundle excludes legacy editor','lease nonce/Origin guard','duplicate launch without second server'])
        finally:stop(p)
        # Stable origin survives restart; an occupied old port gets a temporary
        # address without overwriting the draft's remembered origin.
        p,again=start(profile,'--idle-timeout','0');assert again['port']==port;stop(p)
        busy=socket.socket()
        # macOS retains closed TCP connections in TIME_WAIT. Match the Unix
        # listener's reuse policy so this fixture tests a genuinely occupied
        # port rather than failing before it can create the competing server.
        if os.name!='nt':busy.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        busy.bind(('127.0.0.1',port));busy.listen()
        try:
            p,conflict=start(profile,'--idle-timeout','0');assert conflict['temporarySession']and conflict['port']!=port;assert json.loads((profile/'startup.json').read_text())['port']==port;stop(p)
        finally:busy.close()
        results.extend(['stdin EOF closes launcher and server','stable saved origin','atomic occupied-port fallback preserves old draft address'])
        (profile/'startup.json').write_text('{broken')
        broken=subprocess.run([str(launcher),'--automation','--profile-dir',str(profile)],capture_output=True,text=True,timeout=10);assert broken.returncode==1 and 'damaged'in broken.stderr and(profile/'startup.json').read_text()=='{broken'
        results.append('damaged settings refused without deletion')
        # A real WebSocket survives longer than the idle grace and then closes
        # the entire hosted process when its tab connection is dropped.
        p,ready=start(Path(temp)/'lease','--port','0','--idle-timeout','1');port=ready['port'];origin=ready['url'].rstrip('/');session=json.loads(get('/__studio/session')[2])
        sock=socket.create_connection(('127.0.0.1',port),timeout=5)
        sock.sendall((f'GET /__studio/lease?session={session["session"]} HTTP/1.1\r\nHost: localhost:{port}\r\nOrigin: {origin}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {base64.b64encode(b"0123456789abcdef").decode()}\r\nSec-WebSocket-Version: 13\r\n\r\n').encode())
        response=sock.recv(4096);assert b'101 Switching Protocols'in response,response
        time.sleep(2);assert p.poll()is None;sock.close();assert p.wait(timeout=8)==0
        results.extend(['background connection survives idle grace','last tab disconnect automatically ends launcher and server'])
    report={'passed':True,'platform':os.name,'checks':results};(out/'host-qa.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('launcher');p.add_argument('out');a=p.parse_args();check(a.launcher,a.out)
