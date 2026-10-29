"""Independent stored-mesh checks; CLI hardware packages include upstream plates."""
from pathlib import Path
import sys, json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m4'))
from compare_geometry import check
native,st,mt=[check(p) for p in sys.argv[1:4]]
n,s,m=[r['geometry_hashes'] for r in [native,st,mt]]
if '--report-differences' not in sys.argv: assert s==m,'ST/MT geometry differs'
assert set(s)<=set(n),'The native manufacturing package is missing leaf files'
result={'native':native,'st':st,'mt':mt,'native_upstream_files':sorted(set(n)-set(s)),
        'native_leaf_geometry_identical':all(n[k]==v for k,v in s.items()),'st_mt_geometry_identical':s==m,
        'native_different_leaf_files':[k for k,v in s.items() if n[k]!=v],
        'st_mt_different_leaf_files':sorted(k for k in set(s)|set(m) if s.get(k)!=m.get(k))}
def differences(a,b):
    aa={e['name']:e for e in a['validation']['entries'] if e['name'].endswith('.stl')}
    bb={e['name']:e for e in b['validation']['entries'] if e['name'].endswith('.stl')}
    return {k:{'triangles':[aa[k]['triangles'],bb[k]['triangles']],
               'volume_delta_mm3':bb[k]['signed_volume_mm3']-aa[k]['signed_volume_mm3'],
               'same_bounds':aa[k]['bounds_mm']==bb[k]['bounds_mm'],
               'components':[aa[k]['components'],bb[k]['components']]}
            for k in aa.keys()&bb.keys() if a['geometry_hashes'][k]!=b['geometry_hashes'][k]}
result['st_mt_differences']=differences(st,mt)
result['st_native_differences']=differences(st,native)
print(json.dumps(result))
