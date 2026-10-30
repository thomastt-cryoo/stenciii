"""Audit all M6 generated output bytes, without historical invalid reproductions."""
from pathlib import Path,PurePosixPath
from collections import Counter
import hashlib,io,json,sys,zipfile,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import stl
from output_formats import normals,png,svg

roots=['docs/m6/examples','docs/m6/replay','docs/m6/workflows','docs/m6/batch','sandbox/m6/controls','sandbox/m6/native-tiles','sandbox/m6/tile-modes','sandbox/m6/batch','sandbox/m6/project-replay','sandbox/m6/cli/batch','sandbox/m6/cli/strict.stl','sandbox/m6/all-control-modes','sandbox/m6/manufacturing-modes','sandbox/m6/corpus','sandbox/m6/performance']
records={};references=[];start=time.monotonic()
def verify(name,body,depth=0):
    suffix=Path(name).suffix.lower()
    if suffix not in ['.stl','.zip','.png','.svg']:return
    sha=hashlib.sha256(body).hexdigest();references.append({'path':name,'sha256':sha})
    if sha in records:return records[sha]
    result={'format':suffix,'bytes':len(body)};records[sha]=result
    if suffix=='.stl':
        result.update(stl(body));assert result['closed_oriented_mesh'],name;assert result['signed_volume_mm3']>0,name;result.update(normals(body))
    elif suffix=='.png':result.update(png(body))
    elif suffix=='.svg':result.update(svg(body))
    else:
        assert depth<3
        with zipfile.ZipFile(io.BytesIO(body)) as archive:
            assert archive.testzip() is None;names=archive.namelist();assert len(names)==len(set(n.casefold() for n in names))
            for n in names:assert n and not n.startswith('/') and '\\' not in n and ':' not in n and all(p not in ['','..','.'] for p in n.split('/')),n
            result['entries']=len(names);result['crc_valid']=True
            for n in names:verify(name+'!'+n,archive.read(n),depth+1)
            if 'manufacturing-manifest.json' in names:
                manifest=json.loads(archive.read('manufacturing-manifest.json'));assert manifest['complete_for_selected_outputs']
                assert set(names)=={'manufacturing-manifest.json'}|{r['path'] for r in manifest['files']}
                for r in manifest['files']:
                    actual=archive.read(r['path']);digest=hashlib.sha256(actual).hexdigest();assert digest==r['sha256'] and len(actual)==r['bytes']
                    if r.get('geometry'):
                        actual_mesh=records[digest];assert actual_mesh['components']==r['geometry']['components']
                        assert all(abs(a-b)<1e-8 for a,b in zip(actual_mesh['size_mm'],r['geometry']['size']))
                result['complete_manifest']=True
    return result
for root in roots:
    for path in ([Path(root)] if Path(root).is_file() else sorted(Path(root).rglob('*'))):
        if path.is_file() and path.suffix.lower() in ['.stl','.zip','.png','.svg']:verify(path.as_posix(),path.read_bytes())
summary={'generated_roots':roots,'referenced_outputs':len(references),'unique_bytes':len(records),'unique_formats':dict(Counter(r['format'] for r in records.values())),'all_outputs_valid':True,'elapsed_seconds':time.monotonic()-start,'outputs':records,'references':references}
Path('docs/m6/output-validation.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in summary.items() if k not in ['outputs','references']}))
