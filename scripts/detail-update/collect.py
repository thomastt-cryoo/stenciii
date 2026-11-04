"""Collect exact retained review builds after qualification; never publish a release."""
from pathlib import Path
import argparse,hashlib,json,urllib.request,zipfile
ROOT=Path(__file__).resolve().parents[2]
def collect(source,platforms):
 out=ROOT/'distribution/detail-update/customer';out.mkdir(parents=True,exist_ok=True)
 records=[]
 for platform in platforms:
  name={'windows-x64':'Windows-x64','macos-arm64':'macOS-Apple-Silicon','macos-x64':'macOS-Intel'}[platform]
  prefix=f'https://raw.githubusercontent.com/thomastt-cryoo/stenciii/codex/m7-artifacts/{source}/detail-{platform}/'
  def read(path):
   with urllib.request.urlopen(prefix+path,timeout=60)as response:return response.read()
  def data(path):return json.loads(read(path))
  meta=data(f'StencilStudio-{name}.json');assert meta['source_commit']==source
  smoke=data('customer-check/customer-smoke.json');host=data('host/host-qa.json')
  assert smoke['passed']and len(smoke['cases'])==5 and all(c['passed']for c in smoke['cases'])
  assert smoke['outside_requests']==[] and smoke['page_errors']==[] and smoke['shutdown_document']
  assert host['passed']
  safari=data('safari/safari-qa.json')if platform.startswith('macos-')else None
  if safari:assert safari['passed']and len(safari['cases'])==1
  raw=read(meta['file']);assert len(raw)==meta['bytes']<20_000_000 and hashlib.sha256(raw).hexdigest()==meta['sha256']
  path=out/meta['file'];path.write_bytes(raw)
  with zipfile.ZipFile(path)as archive:assert archive.testzip()is None
  records.append({'platform':platform,'file':meta['file'],'bytes':meta['bytes'],'sha256':meta['sha256'],'application_source':source,'browser':smoke['browser'],'customer_cases':[{'name':c['name'],'passed':c['passed']}for c in smoke['cases']],'offline_external_requests':0,'page_errors':0,'shutdown':True,'host_checks':len(host['checks']),'safari':{'version':safari.get('version'),'qualification':safari.get('qualification'),'projects':len(safari['cases'])}if safari else None,'retained_evidence':prefix,'first_download_security_approval':'Not requalified; prior M8 release limits remain'})
 record={'source':source,'workflow_run':41873236137,'platforms':records,'prior_M8_delivery_untouched':True,'public_release':False}
 (out.parent/'delivery-manifest.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf8',newline='\n')
 print(json.dumps(record))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('--platforms',nargs='+',default=['windows-x64','macos-arm64','macos-x64']);a=p.parse_args();collect(a.source,a.platforms)
