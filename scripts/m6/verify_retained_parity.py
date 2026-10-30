"""Reproduce every retained B/C proof using committed full-byte archives only."""
from pathlib import Path
from collections import Counter
import hashlib,json,zipfile,time
from exact_surface import compare
from surface_deviation import certify

start=time.monotonic();root=Path('docs/m6');bodies={};archives={}
for manifest in sorted((root/'fixtures').glob('*-discrepancies/manifest.json')):
    data=json.loads(manifest.read_text(encoding='utf-8'))
    for part in data['parts']:
        path=Path(part['path']);raw=path.read_bytes();assert hashlib.sha256(raw).hexdigest()==part['sha256']
        with zipfile.ZipFile(path) as archive:
            assert archive.testzip() is None
            assert len(archive.namelist())==len(set(archive.namelist()))==part['entries']
            for name in archive.namelist():
                body=archive.read(name);assert hashlib.sha256(body).hexdigest()+'.stl'==name
                if name in bodies:assert bodies[name]==body
                bodies[name]=body
        archives[path.as_posix()]=part['sha256']
cache={};summaries=[]
for filename in ['m5-discrepancy-classification.json','all-control-parity.json','current-engine-classification.json','tile-mode-validation.json']:
    data=json.loads((root/filename).read_text(encoding='utf-8'))
    rows=[r for case in data['cases'] for r in case['independent']['comparisons']] if filename.startswith('tile-') else data['cases']
    counts=Counter()
    for row in rows:
        if row['category']=='A':continue
        names=tuple(row['retained_stl_entries']);assert all(name in bodies for name in names)
        assert all(path in archives for path in row['retained_archives'])
        if names not in cache:
            result=compare(*(bodies[name] for name in names))
            if not result['exact_surface_equal']:
                proof=certify(*(bodies[name] for name in names));assert proof['certified'];result['category']='C';result['spatial_proof']=proof
            cache[names]=result
        result=cache[names];assert result=={key:row[key] for key in result}
        counts[result['category']]+=1
    summaries.append({'evidence':filename,'reproduced_differing_file_proofs':sum(counts.values()),'categories':dict(counts)})
result={'archives':len(archives),'retained_distinct_stls':len(bodies),'unique_differing_pairs':len(cache),'all_retained_proofs_reproduced':True,'elapsed_seconds':time.monotonic()-start,'datasets':summaries}
(root/'retained-parity-replay.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps(result))
