"""Exact oriented planar-chain comparison of stored float32 STL surfaces.

Coordinates are integers on the common 2**-149 float32 lattice. Equal oriented
boundary chains in each exact plane prove equal compact planar surfaces with
multiplicity, regardless of interior triangulation or collinear subdivision.
No spatial rounding, area tolerance, mesh welding or volume proxy is used.
"""
from collections import Counter, defaultdict
from functools import reduce
from math import gcd, isfinite
import hashlib, struct

def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def primitive(v):
    d=reduce(gcd,map(abs,v))
    if not d: raise ValueError('Degenerate surface triangle or edge')
    return tuple(x//d for x in v)
def lattice(x):
    a,b=x.as_integer_ratio()
    return a << (149-(b.bit_length()-1))
def triangles(data):
    if len(data)<84: raise ValueError('Truncated STL')
    n=struct.unpack_from('<I',data,80)[0]
    if len(data)!=84+50*n: raise ValueError('Invalid binary STL length')
    result=Counter()
    for i in range(n):
        values=struct.unpack_from('<12f',data,84+50*i)
        if not all(map(isfinite,values)): raise ValueError('Nonfinite stored normal or coordinate')
        t=tuple(tuple(lattice(float(x)) for x in values[3+3*k:6+3*k]) for k in range(3))
        result[min(t,t[1:]+t[:1],t[2:]+t[:2])]+=1
    return result
def plane(t):
    n=primitive(cross(sub(t[1],t[0]),sub(t[2],t[0])))
    return (*n,-dot(n,t[0]))
def add_chain(events,t,sign):
    for a,b in zip(t,t[1:]+t[:1]):
        d=primitive(sub(b,a))
        if next(x for x in d if x)!=abs(next(x for x in d if x)): d=tuple(-x for x in d)
        key=(d,cross(a,d));a,b=dot(a,d),dot(b,d)
        # An oriented interval is the distribution with + at its start and - at its end.
        events[key][a]+=sign;events[key][b]-=sign
def compare(a,b):
    aa,bb=triangles(a),triangles(b)
    common=aa&bb;ra,rb=aa-common,bb-common
    planes=defaultdict(lambda:defaultdict(Counter))
    for counter,sign in [(ra,1),(rb,-1)]:
        for t,n in counter.items(): add_chain(planes[plane(t)],t,sign*n)
    unmatched=sum(any(v for v in events.values()) for lines in planes.values() for events in lines.values())
    exact_triangles=not ra and not rb
    return {'file_bytes_equal':a==b,'file_sha256':[hashlib.sha256(x).hexdigest() for x in [a,b]],
            'exact_oriented_triangles_equal':exact_triangles,'exact_surface_equal':unmatched==0,
            'category':'A' if exact_triangles else 'B' if unmatched==0 else 'E',
            'method':'exact float32 integer lattice, oriented plane-boundary interval chains',
            'spatial_tolerance_mm':0,'maximum_surface_deviation_mm':0 if unmatched==0 else None,
            'triangles':[sum(aa.values()),sum(bb.values())],'shared_exact_triangles':sum(common.values()),
            'residual_triangles':[sum(ra.values()),sum(rb.values())],'residual_exact_planes':len(planes),
            'unmatched_plane_boundary_lines':unmatched}
