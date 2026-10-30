"""Replay the geometry proof using only committed M6 full-byte ZIP fixtures."""
from pathlib import Path
from collections import Counter
import json,hashlib,zipfile,time
from exact_surface import compare
from surface_deviation import certify
start=time.monotonic();root=Path('docs/m6')
data=json.loads((root/'m5-discrepancy-classification.json').read_text(encoding='utf-8'))
manifest=json.loads((root/'fixtures/m5-discrepancies/manifest.json').read_text(encoding='utf-8'));bodies={}
for part in manifest['parts']:
    path=Path(part['path']);assert hashlib.sha256(path.read_bytes()).hexdigest()==part['sha256']
    with zipfile.ZipFile(path) as archive:
        assert archive.testzip() is None
        assert len(archive.namelist())==len(set(archive.namelist()))==part['entries']
        for name in archive.namelist():
            body=archive.read(name);assert hashlib.sha256(body).hexdigest()+'.stl'==name
            assert name not in bodies;bodies[name]=body
cache={};counts=Counter()
for row in data['cases']:
    names=tuple(row['retained_stl_entries'])
    assert [manifest['entries'][name] for name in names]==row['retained_archives']
    if names not in cache:
        result=compare(*(bodies[name] for name in names))
        if not result['exact_surface_equal']:
            proof=certify(*(bodies[name] for name in names));assert proof['certified'];result['category']='C';result['spatial_proof']=proof
        cache[names]=result
    result=cache[names];assert result=={key:row[key] for key in result},row['fixture'];counts[result['category']]+=1
assert dict(counts)==data['categories'];assert len(cache)==data['unique_file_pairs']
report={'archives':len(manifest['parts']),'retained_original_stls':len(bodies),'comparisons':len(data['cases']),'unique_pairs':len(cache),'categories':dict(counts),'all_proofs_reproduced':True,'elapsed_seconds':time.monotonic()-start}
(root/'classification-replay.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps(report))
