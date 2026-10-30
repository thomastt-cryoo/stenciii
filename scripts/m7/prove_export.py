"""Independently validate exact stored output and compare M6 surfaces."""
from pathlib import Path
import io,json,sys,zipfile
ROOT=Path(__file__).resolve().parents[2]
sys.path[:0]=[str(ROOT/'scripts/m0'),str(ROOT/'scripts/m6')]
from validate_artifacts import inspect
from output_formats import normals
from exact_surface import compare
def meshes(path):
    if path.suffix=='.stl':return {path.name:path.read_bytes()}
    with zipfile.ZipFile(path)as z:
        assert z.testzip()is None
        assert all(not n.startswith(('/','\\'))and '..'not in Path(n).parts for n in z.namelist())
        return {n:z.read(n)for n in z.namelist()if n.endswith('.stl')}
def prove(path,baseline=None):
    path=Path(path);validation=inspect(path);parts=validation.get('entries',[validation]);assert parts and all(p.get('closed_oriented_mesh',True)for p in parts),validation
    models=meshes(path);assert models;normal_checks={k:normals(v)for k,v in models.items()}
    comparisons={}
    if baseline and Path(baseline).is_file():
        previous=meshes(Path(baseline));assert len(previous)==len(models)
        if path.suffix=='.stl':comparisons[path.name]=compare(next(iter(previous.values())),next(iter(models.values())))
        else:
            assert previous.keys()==models.keys()
            comparisons={k:compare(previous[k],v)for k,v in models.items()}
        assert all(c['category']in('A','B')for c in comparisons.values()),comparisons
    return {'independent':validation,'normals':normal_checks,'m6_equivalence':comparisons}
if __name__=='__main__':print(json.dumps(prove(sys.argv[1],sys.argv[2]if len(sys.argv)>2 else None)))
