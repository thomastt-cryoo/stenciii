"""Independently verify a browser batch collection, its summaries and inner files."""
from pathlib import Path
import csv,hashlib,io,json,sys,zipfile,xml.etree.ElementTree as ET,struct
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import stl

def safe(archive):
    names=archive.namelist();assert len(names)==len(set(names));assert archive.testzip() is None
    assert all(not n.startswith('/') and '\\' not in n and all(p not in ['','..','.'] for p in n.split('/')) for n in names)
def verify(path):
    meshes=[];jobs=[]
    with zipfile.ZipFile(path) as outer:
        safe(outer);summary=json.loads(outer.read('batch-summary.json'))
        csv_rows=list(csv.DictReader(io.StringIO(outer.read('batch-summary.csv').decode('utf-8-sig'))))
        assert len(csv_rows)==len(summary['items'])==summary['planned_jobs']
        output=[n for n in outer.namelist() if n.endswith('.zip') or n.endswith('.stl')]
        assert len(output)==sum(r['status']=='Verified' for r in summary['items'])
        for name in output:
            body=outer.read(name)
            if name.endswith('.stl'):
                checked=stl(body);assert checked['closed_oriented_mesh'];meshes.append(checked);continue
            with zipfile.ZipFile(io.BytesIO(body)) as inner:
                safe(inner);manifest=json.loads(inner.read('manufacturing-manifest.json'));assert manifest['complete_for_selected_outputs']
                expected={'manufacturing-manifest.json'}
                for record in manifest['files']:
                    expected.add(record['path']);data=inner.read(record['path'])
                    assert len(data)==record['bytes'] and hashlib.sha256(data).hexdigest()==record['sha256']
                    if record['path'].endswith('.stl'):
                        checked=stl(data);assert checked['closed_oriented_mesh'];assert checked['components']==record['geometry']['components'];meshes.append(checked)
                    elif record['path'].endswith('.svg'):ET.fromstring(data)
                    elif record['path'].endswith('.png'):
                        assert data[:8]==b'\x89PNG\r\n\x1a\n';assert all(struct.unpack_from('>II',data,16))
                    elif record['path'].endswith('.json'):
                        project=json.loads(data)
                        if record['path']=='original-project.json':
                            for asset in project.get('images',{}).values():
                                import base64
                                assert base64.b64decode(asset['base64'],validate=True)
                assert set(inner.namelist())==expected
                jobs.append({'entry':name,'files':manifest['files'],'assemblies':manifest['assemblies']})
    return {'summary':summary,'csv_rows':len(csv_rows),'verified_jobs':len(output),'independent_stl_count':len(meshes),'all_stls_valid':True,'jobs':jobs,'meshes':meshes}
if __name__=='__main__':print(json.dumps(verify(sys.argv[1])))
