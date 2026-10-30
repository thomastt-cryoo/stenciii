"""Classify every recorded M5 manufacturing geometry discrepancy from real bytes."""
from pathlib import Path
from collections import Counter
import json, zipfile, hashlib
from exact_surface import compare
from surface_deviation import certify
from retain_discrepancies import retain

data=json.loads(Path('docs/m5/manufacturing-modes.json').read_text(encoding='utf-8'))
rows=[];cache={};retained={}
for row in data['cases']:
    c=row.get('comparison')
    if not c:continue
    for left,right,field in [('st','mt','st_mt_different_leaf_files'),('st','native','native_different_leaf_files')]:
        for name in c[field]:
            paths=[row[m]['path'] for m in [left,right]]
            with zipfile.ZipFile(paths[0]) as za,zipfile.ZipFile(paths[1]) as zb:
                a,b=za.read(name),zb.read(name)
            key=tuple(hashlib.sha256(x).hexdigest() for x in [a,b])
            for sha,body in zip(key,[a,b]):retained[sha]=body
            if key not in cache:
                cache[key]=compare(a,b)
                if not cache[key]['exact_surface_equal']:
                    proof=certify(a,b)
                    cache[key]['spatial_proof']=proof
                    if proof['certified']:cache[key]['category']='C'
            rows.append({'fixture':row['stem'],'file':name,'engines':[left,right],'archives':paths,
                         'retained_stl_entries':[sha+'.stl' for sha in key],**cache[key]})
out=Path('docs/m6');out.mkdir(exist_ok=True)
summary={'source':'M5 retained exact output bytes','fixtures':len({r['fixture'] for r in rows}),
         'compared_file_pairs':len(rows),'unique_file_pairs':len(cache),'categories':dict(Counter(r['category'] for r in rows)),
         'all_exact_surfaces_equal':all(r['exact_surface_equal'] for r in rows),'cases':rows}
entries=retain(retained)
for row in rows:row['retained_archives']=[entries[name] for name in row['retained_stl_entries']]
(out/'m5-discrepancy-classification.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in summary.items() if k!='cases'},indent=2))
