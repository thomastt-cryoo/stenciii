"""Replay the retained thin-facet normal defect through the actual native engine."""
from pathlib import Path
import base64,json,subprocess,sys,struct,math
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import stl
from output_formats import normals
from exact_surface import compare
root=Path(__file__).resolve().parents[2];work=root/'sandbox/m6/normal-repair';work.mkdir(exist_ok=True)
doc=json.loads((root/'docs/m6/fixtures/normal-orientation-project.json').read_text(encoding='utf-8'));images={}
for node in doc['graph']['nodes']:
    if node['type']=='source':
        identity=node['params']['image_id'];path=work/'original.svg';path.write_bytes(base64.b64decode(doc['images'][identity]['base64']));images[identity]=str(path)
output=root/'docs/m6/examples/normal-orientation-after.stl';output.parent.mkdir(exist_ok=True)
config=work/'config.json';config.write_text(json.dumps([{'case':'retained-normal-defect','graph':doc['graph'],'images':images,'target':'test','out':'solid','path':str(output)}]),encoding='utf-8')
exe=root/'target/release/examples'/('m6_artifact_replay.exe' if sys.platform=='win32' else 'm6_artifact_replay')
process=subprocess.run([str(exe),str(config)],capture_output=True,text=True,encoding='utf-8',timeout=120);assert process.returncode==0,process.stderr
before=(root/'docs/m6/fixtures/stored-normals-before.stl').read_bytes();after=output.read_bytes()
opposed=[]
for i,face in enumerate(struct.iter_unpack('<12fH',before[84:])):
    n=face[:3];p=[face[j:j+3] for j in [3,6,9]];u=[p[1][k]-p[0][k] for k in range(3)];v=[p[2][k]-p[0][k] for k in range(3)];cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
    if sum(a*b for a,b in zip(n,cross))<=0:opposed.append(i)
assert len(opposed)==2
shape=compare(before,after);assert shape['exact_surface_equal']
mesh=stl(after);assert mesh['closed_oriented_mesh'];normal=normals(after)
report={'before_opposed_facets':opposed,'after':{**mesh,**normal},'exact_shape_proof':shape,'native':json.loads(process.stdout),'encoder_scope':'Normals now use the stored float32 coordinates. Triangle coordinates and ordering are unchanged by serialization; the validator and geometry tolerances are unchanged.'}
(root/'docs/m6/normal-repair-validation.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({'before_opposed_normals':len(opposed),'after_opposed_normals':normal['zero_or_opposed_normals'],'shape_category':shape['category'],'closed':mesh['closed_oriented_mesh']}))
