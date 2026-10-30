"""Keep the exact bytes behind every nonidentical repaired-tile surface proof."""
from pathlib import Path
import hashlib,json,zipfile
from retain_discrepancies import retain
root=Path('docs/m6');path=root/'tile-mode-validation.json';data=json.loads(path.read_text(encoding='utf-8'))
assert data['all_structural_checks_passed'] and data['all_shape_comparisons_classified']
known={}
for manifest in sorted((root/'fixtures').glob('*-discrepancies/manifest.json')):
    known.update(json.loads(manifest.read_text(encoding='utf-8'))['entries'])
retained={};rows=[]
for case in data['cases']:
    for row in case['independent']['comparisons']:
        if row['category']=='A':continue
        bodies=[]
        for mode in row['engines']:
            if mode=='native':body=Path(f"sandbox/m6/native-tiles/{case['case']}/{row['file']}").read_bytes()
            else:
                with zipfile.ZipFile(case[mode]['path']) as archive:body=archive.read(row['file'])
            bodies.append(body)
        hashes=[hashlib.sha256(b).hexdigest()for b in bodies];assert hashes==row['file_sha256']
        row['retained_stl_entries']=[sha+'.stl'for sha in hashes]
        for sha,body in zip(hashes,bodies):
            if sha+'.stl'not in known:retained[sha]=body
        rows.append(row)
if retained:known.update(retain(retained,root/'fixtures/tile-discrepancies'))
for row in rows:row['retained_archives']=[known[name]for name in row['retained_stl_entries']]
path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'retained_tile_comparisons':len(rows),'new_original_stls':len(retained)}))
