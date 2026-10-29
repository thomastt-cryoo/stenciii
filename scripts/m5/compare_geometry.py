"""Independent stored-mesh checks; CLI hardware packages include upstream plates."""
from pathlib import Path
import sys, json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m4'))
from compare_geometry import check
native,st,mt=[check(p) for p in sys.argv[1:4]]
n,s,m=[r['geometry_hashes'] for r in [native,st,mt]]
assert s==m,'ST/MT geometry differs'
assert set(s)<=set(n),'The native manufacturing package is missing leaf files'
result={'native':native,'st':st,'mt':mt,'native_upstream_files':sorted(set(n)-set(s)),
        'native_leaf_geometry_identical':all(n[k]==v for k,v in s.items()),'st_mt_geometry_identical':True,
        'native_different_leaf_files':[k for k,v in s.items() if n[k]!=v]}
print(json.dumps(result))
