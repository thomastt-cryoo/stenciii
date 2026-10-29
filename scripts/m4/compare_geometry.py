"""Independent topology/volume checks and oriented triangle equivalence at 0.0001 mm."""
from pathlib import Path
import hashlib, json, struct, sys, zipfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import inspect
def triangle_hash(data):
    n,=struct.unpack_from('<I',data,80)
    triangles=[]
    for i in range(n):
        t=tuple(tuple(round(v,4) or 0.0 for v in struct.unpack_from('<3f',data,96+i*50+j*12)) for j in range(3))
        triangles.append(min(t,t[1:]+t[:1],t[2:]+t[:2]))
    return hashlib.sha256(repr(sorted(triangles)).encode('ascii')).hexdigest()
def check(path):
    p=Path(path);report=inspect(p)
    if report['format']=='ZIP':
        assert all(v.get('closed_oriented_mesh',True) for v in report['entries']),report
        with zipfile.ZipFile(p) as z:
            hashes={n:triangle_hash(z.read(n)) for n in sorted(z.namelist()) if n.lower().endswith('.stl')}
    else:
        assert report['closed_oriented_mesh'],report
        hashes={'solid':triangle_hash(p.read_bytes())}
    return {'validation':report,'oriented_triangles_rounded_mm':.0001,'geometry_hashes':hashes}
if __name__=='__main__':
    records=[check(p) for p in sys.argv[1:]]
    assert all(r['geometry_hashes']==records[0]['geometry_hashes'] for r in records),'Native/ST/MT geometry differs'
    print(json.dumps(records))
