"""Diagnostic proof of boundary subdivision on retained invalid tile bytes."""
from pathlib import Path
import sys, struct, json, math
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import inspect
from inspect_collinear import load,bad,sub,dot,cross,normal

def interior(p,a,b):
    d=sub(b,a);q=sub(p,a);length2=dot(d,d);along=dot(q,d)
    return 0<along<length2 and dot(cross(q,d),cross(q,d))<=1e-24*length2
def refine(v,t):
    candidates=sorted({x for f in t if bad(v,f) for x in f})
    result=[];splits=0
    for f in t:
        if bad(v,f):continue
        parts=[f]
        for p in candidates:
            if not any(interior(v[p],v[a],v[b]) for a,b in zip(f,f[1:]+f[:1])):continue
            for j,part in enumerate(parts):
                for k in range(3):
                    a,b,c=part[k:]+part[:k]
                    if interior(v[p],v[a],v[b]):
                        new=[[a,p,c],[p,b,c]]
                        assert all(dot(normal(v,f),normal(v,n))>0 and not bad(v,n) for n in new)
                        parts[j:j+1]=new;splits+=1;break
                else:continue
                break
        result.extend(parts)
    return result,splits
def save(path,v,t):
    data=bytearray(80)+struct.pack('<I',len(t))
    for f in t:
        n=normal(v,f);length=math.sqrt(dot(n,n));n=[x/length for x in n]
        data+=struct.pack('<12fH',*n,*(x for i in f for x in v[i]),0)
    path.write_bytes(data)

if __name__=='__main__':
    dest=Path('sandbox/m6/subdivision-probe');dest.mkdir(parents=True,exist_ok=True);rows=[]
    for source in sys.argv[1:]:
        p=Path(source);v,t=load(p);fixed,splits=refine(v,t);out=dest/(p.parent.name+'-'+p.name);save(out,v,fixed)
        before,after=inspect(p),inspect(out)
        rows.append({'input':p.as_posix(),'before':before,'after':after,'edge_subdivisions':splits,'same_bounds':before['bounds_mm']==after['bounds_mm'],'volume_delta_mm3':after['signed_volume_mm3']-before['signed_volume_mm3']})
    print(json.dumps(rows,indent=2))
