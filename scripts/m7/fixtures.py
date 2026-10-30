"""Retain representative portable projects without changing accepted M6 evidence."""
from pathlib import Path
import base64,copy,json
ROOT=Path(__file__).resolve().parents[2]
def generate():
    out=ROOT/'docs/m7/acceptance';out.mkdir(parents=True,exist_ok=True);rows=[]
    def add(name,document,baseline=None):
        (out/f'{name}.json').write_text(json.dumps(document,indent=2)+'\n',encoding='utf-8',newline='\n');rows.append({'name':name,'project':f'{name}.json','m6_output':baseline})
    for name in ['simple','vector','tones','colours','first','mounted']:
        add(name,json.loads((ROOT/f'docs/m6/workflows/{name}.json').read_text()),f'docs/m6/workflows/{name}.'+('zip'if name in ['first','mounted','colours']else'stl'))
    for name in ['old-browser','registered-colour-branches','layout-offsets','shared-hardware-and-multiple-images']:
        add(name,json.loads((ROOT/f'docs/m6/projects/{name}.json').read_text()))
    source=json.loads((ROOT/'docs/m6/workflows/vector.json').read_text())
    for name,image in [('detailed-logo','detailed-logo.svg'),('transparent','transparent.png')]:
        doc=copy.deepcopy(source);key=next(n['params']['image_id']for n in doc['graph']['nodes']if n['type']=='source');doc['images'][key]={'name':image,'base64':base64.b64encode((ROOT/'web/e2e/corpus'/image).read_bytes()).decode()}
        for n in doc['graph']['nodes']:
            if n['type']=='source':n['params']['resolution']=300
        add(name,doc)
    photo=ROOT/'sandbox/m6/corpus/astronaut-standard.json'
    if photo.is_file():add('photograph',json.loads(photo.read_text()))
    catalogue=json.loads((ROOT/'docs/audit/runtime-catalogue.json').read_text())
    def step(id,type,params):return {'id':id,'type':type,'params':{**{p['name']:p['default']for t in catalogue if t['id']==type for p in t['params']},**params}}
    add('text',{'version':2,'graph':{'nodes':[step('words','text',{'text':'STUDIO 07','size':100}),step('plate','stencil',{'width_mm':100,'margin_mm':8,'thickness_mm':2,'extra_top_layers':0})],'edges':[{'from':['words','mask'],'to':['plate','mask']}]}})
    (out/'index.json').write_text(json.dumps(rows,indent=2)+'\n',encoding='utf-8',newline='\n');print(f'{len(rows)} acceptance projects')
if __name__=='__main__':generate()
