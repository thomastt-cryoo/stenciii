"""Classify all current manufacturing leaf comparisons at stored float32 precision."""
from pathlib import Path
from collections import Counter
import hashlib,json,zipfile,time,sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import stl
from exact_surface import compare
from surface_deviation import certify
from retain_discrepancies import retain
start=time.monotonic();path=Path('docs/m6/manufacturing-modes.json');data=json.loads(path.read_text(encoding='utf-8'));assert data['completed_cases']==256 and data['all_structural_checks_passed']
checks={};proofs={};rows=[];retained={};old=json.loads(Path('docs/m6/fixtures/m5-discrepancies/manifest.json').read_text(encoding='utf-8'))['entries']
for row in data['cases']:
    if row['out']!='parts' or row['expectedError']:continue
    with zipfile.ZipFile(row['native']['path']) as na,zipfile.ZipFile(row['st']['path']) as sa,zipfile.ZipFile(row['mt']['path']) as ma:
        for archive in [na,sa,ma]:assert archive.testzip() is None
        native,st,mt=[{n:archive.read(n) for n in archive.namelist() if n.endswith('.stl')} for archive in [na,sa,ma]]
    assert set(st)==set(mt) and set(st)<=set(native)
    for mode,files in [('native',native),('st',st),('mt',mt)]:
        for name,body in files.items():
            sha=hashlib.sha256(body).hexdigest()
            if sha not in checks:checks[sha]=stl(body)
            assert checks[sha]['closed_oriented_mesh'],(row['stem'],mode,name)
    for name in sorted(st):
        for left,right,a,b in [('native','st',native[name],st[name]),('st','mt',st[name],mt[name])]:
            hashes=tuple(hashlib.sha256(body).hexdigest() for body in [a,b])
            if hashes not in proofs:
                proof=compare(a,b)
                if not proof['exact_surface_equal']:
                    proof['spatial_proof']=certify(a,b)
                    if proof['spatial_proof']['certified']:proof['category']='C'
                proofs[hashes]=proof
            proof=proofs[hashes];assert proof['category'] in ['A','B','C'],(row['stem'],name,proof)
            entry={'fixture':row['stem'],'file':name,'engines':[left,right],**proof}
            if proof['category']!='A':
                entry['retained_stl_entries']=[sha+'.stl' for sha in hashes]
                for sha,body in zip(hashes,[a,b]):
                    if sha+'.stl' not in old:retained[sha]=body
            rows.append(entry)
new=retain(retained,Path('docs/m6/fixtures/current-discrepancies')) if retained else {}
for row in rows:
    if 'retained_stl_entries' in row:row['retained_archives']=[old.get(n) or new[n] for n in row['retained_stl_entries']]
summary={'field_fixtures':256,'part_fixtures':191,'bitmap_fixtures':64,'expected_constraints':1,'compared_file_pairs':len(rows),'unique_file_pairs':len(proofs),'independently_valid_unique_stls':len(checks),'categories':dict(Counter(r['category'] for r in rows)),'all_comparisons_classified':True,'all_required_stls_valid':True,'elapsed_seconds':time.monotonic()-start,'cases':rows}
Path('docs/m6/current-engine-classification.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in summary.items() if k!='cases'}))
