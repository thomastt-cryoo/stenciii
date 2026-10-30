"""Inspect exact stored STL adjacency; diagnostic only, never an export repair."""
from pathlib import Path
import struct, sys, json

def load(path):
    data=Path(path).read_bytes(); vertices=[]; ids={}; faces=[]
    count=struct.unpack_from('<I',data,80)[0]
    assert len(data)==84+50*count
    for i in range(count):
        face=[]
        for k in range(3):
            p=struct.unpack_from('<3f',data,96+i*50+k*12)
            if p not in ids: ids[p]=len(vertices);vertices.append(p)
            face.append(ids[p])
        faces.append(face)
    return vertices,faces
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def normal(v,t): return cross(sub(v[t[1]],v[t[0]]),sub(v[t[2]],v[t[0]]))
def bad(v,t): return dot(normal(v,t),normal(v,t))<=1e-24

if __name__=='__main__':
    v,t=load(sys.argv[1]); edges={(a,b):i for i,f in enumerate(t) for a,b in zip(f,f[1:]+f[:1])}
    result=[]
    for i,f in enumerate(t):
        if not bad(v,f):continue
        candidates=[]
        for a,b,c in [f,f[1:]+f[:1],f[2:]+f[:2]]:
            adjacent=edges[(b,a)]; other=t[adjacent];d=next(x for x in other if x not in [a,b])
            new=[[c,a,d],[c,d,b]]
            candidates.append({'edge':[a,b],'neighbour':adjacent,'neighbour_vertices':[v[x] for x in other],
                               'new_degenerates':sum(bad(v,x) for x in new),'new_diagonal_already_present':(c,d) in edges or (d,c) in edges,
                               'old_neighbour_normal':normal(v,other),'new_normals':[normal(v,x) for x in new]})
        result.append({'face':i,'vertices':[v[x] for x in f],'candidates':candidates})
    print(json.dumps({'file':sys.argv[1],'triangles':len(t),'degenerate_faces':result},indent=2))
