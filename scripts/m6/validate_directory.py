from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import inspect
files=[{'file':p.name,**inspect(p)} for p in sorted(Path(sys.argv[1]).rglob('*.stl'))]
assert files and all(f['closed_oriented_mesh'] for f in files)
print(json.dumps({'files':files,'all_valid':True}))
