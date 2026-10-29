"""Assemble only measured M5 coverage, plus the independently replayed M3/M4 slots."""
import json, shutil, hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
docs=root/'docs/m5'
def read(p): return json.loads(p.read_text())
catalogue=read(root/'docs/audit/runtime-catalogue.json')
qualified={f"{t['id']}.{p['name']}":p for t in catalogue for p in t['params']}
rows=[]
for phase in 'abcd':
    data=read(docs/f'{phase}-coverage.json')
    expected=dict(a=38,b=29,c=44,d=17)[phase]
    assert data['slots']==expected,(phase,data['slots'])
    for row in data['cases']:
        assert row['verified'] and row['reset'] and row['reopened'],row['key']
        for which in ['before','after']:
            result=row[which]
            if result.get('error'): continue
            report=result.get('validation')
            if report:
                parts=report.get('entries',[report])
                assert all(p.get('closed_oriented_mesh',True) for p in parts),row['key']
        row['milestone']=f'M5{phase.upper()}'
        rows.append(row)
        for which in ['before','after']:
            fixture=row.get(f'project_{which}')
            if fixture:
                source=root/fixture
                target=docs/'fixtures'/source.name
                shutil.copyfile(source,target)
                row[f'committed_project_{which}']=str(target.relative_to(root)).replace('\\','/')
assert len(rows)==len({r['key'] for r in rows})==128
prior=[]
for name in ['artwork-coverage.json','geometry-coverage.json']:
    data=read(docs/'replay/m4'/name)
    for row in data['cases']:
        row['milestone']='M3 replay' if name.startswith('artwork') else 'M4 replay'
        prior.append(row)
allrows=prior+rows
assert len(allrows)==len({r['key'] for r in allrows})==217
assert set(qualified)=={r['key'] for r in allrows}
for row in allrows:
    original=qualified[row['key']]
    if 'default' in row: assert row['default']==original['default'],row['key']
    row['original_catalogue_constraint']=original
out={'runtime_processing_types':len(catalogue),'qualified_slots':217,'m5_slots':128,'unique_editable_and_exercised_slots':217,'cases':allrows}
(docs/'parameter-coverage-217.json').write_text(json.dumps(out,indent=2)+'\n')
archive=read(root/'docs/audit/archive-manifest.json') if (root/'docs/audit/archive-manifest.json').exists() else None
print('Verified 128 M5 + 89 replayed slots = 217 unique runtime keys with original constraints.')
