"""Independent structural checks and shape comparisons for one M6 tile case."""
from pathlib import Path
import sys,json,zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import inspect
from exact_surface import compare
from surface_deviation import certify

native,st,mt=map(Path,sys.argv[1:4])
checks={mode:inspect(path) for mode,path in [('st',st),('mt',mt)]}
for report in checks.values():
    assert all(e['closed_oriented_mesh'] and e['components']==1 for e in report['entries']), 'Invalid required tile or connector'
native_files={p.name:p.read_bytes() for p in Path(native).glob('*.stl')}
with zipfile.ZipFile(st) as sa,zipfile.ZipFile(mt) as ma:
    assert set(sa.namelist())==set(ma.namelist())==set(native_files), 'Missing required file'
    comparisons=[]
    for name in sorted(native_files):
        checks.setdefault('native',{})[name]=inspect(Path(native)/name)
        assert checks['native'][name]['closed_oriented_mesh'] and checks['native'][name]['components']==1
        for left,right,a,b in [('native','st',native_files[name],sa.read(name)),('st','mt',sa.read(name),ma.read(name))]:
            result=compare(a,b)
            if not result['exact_surface_equal']:
                result['spatial_proof']=certify(a,b)
                if result['spatial_proof']['certified']:result['category']='C'
            assert result['category'] in ['A','B','C'], (name,left,right,result)
            comparisons.append({'file':name,'engines':[left,right],**result})
print(json.dumps({'all_structurally_valid':True,'validation':checks,'comparisons':comparisons}))
