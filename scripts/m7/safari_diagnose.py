"""Expose the caught renderer exception in a local copy of production assets.

Diagnostic hosting only. No browser/OS graphics flags or production source are
changed. A real customer-package run must follow any eventual application fix.
"""
from pathlib import Path
import functools,http.server,json,os,re,subprocess,sys,threading
root=Path(__file__).resolve().parents[2];dist=root/'web/dist';out=root/'out/safari-diagnosis';out.mkdir(parents=True,exist_ok=True)
patched=[]
for p in(dist/'assets').glob('MeshPreview-*.js'):
    original=p.read_text(encoding='utf-8')
    text,count=re.subn(r'catch\{(?=[A-Za-z_$][\w$]*\(`3D rendering is unavailable)',r'catch(error){(globalThis.__m7RendererErrors??=[]).push({message:String(error),stack:error?.stack});',original)
    assert count==1, f'Expected one renderer error handler in {p}'
    p.write_text(text,encoding='utf-8');patched.append(p.name)
assert len(patched)==1
class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin');self.send_header('Cross-Origin-Embedder-Policy','require-corp');self.send_header('Cache-Control','no-store');super().end_headers()
server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(dist)))
threading.Thread(target=server.serve_forever,daemon=True).start()
env={**os.environ,'M7_SAFARI_URL':f'http://localhost:{server.server_port}/','M7_CASES':'simple'}
try:
    code=subprocess.call([sys.executable,str(root/'scripts/m7/safari_qa.py'),'unused-diagnostic-launcher',str(out)],env=env)
    (out/'instrumentation.json').write_text(json.dumps({'source_assets_run':41129666851,'patched_error_handlers':patched,'production_application_source_changed':False,'purpose':'capture previously swallowed renderer exception'},indent=2)+'\n')
finally:server.shutdown();server.server_close()
sys.exit(code)
