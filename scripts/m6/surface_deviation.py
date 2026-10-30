"""Certified spatial upper bound using exact rational triangle overlays.

For each source face, project candidate target faces along its dominant normal
axis. Exact polygon subtraction proves complete union coverage. On each
covered convex polygon, the axis separation is affine, so its maximum is at a
vertex. Bidirectional coverage bounds the Hausdorff distance, including face
interiors, rather than just matching original mesh vertices.
"""
from fractions import Fraction as F
from exact_surface import triangles,cross,sub,dot

def area(poly):
    return abs(sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(poly,poly[1:]+poly[:1])))/2 if poly else F(0)
def clip(poly,value):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        va,vb=value(a),value(b)
        if va>=0:result.append(a)
        if (va<0<vb) or (vb<0<va):
            t=va/(va-vb);result.append(tuple(x+t*(y-x) for x,y in zip(a,b)))
    return result
def intersect(poly,boundary):
    winding=sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(boundary,boundary[1:]+boundary[:1]))
    if winding==0:return []
    sign=1 if winding>0 else -1
    for a,b in zip(boundary,boundary[1:]+boundary[:1]):
        poly=clip(poly,lambda p:sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0])))
        if len(poly)<3:return []
    return poly
def subtract(poly,boundary):
    winding=sum(a[0]*b[1]-a[1]*b[0] for a,b in zip(boundary,boundary[1:]+boundary[:1]))
    sign=1 if winding>0 else -1
    outside=[]
    for a,b in zip(boundary,boundary[1:]+boundary[:1]):
        side=lambda p:sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))
        piece=clip(poly,lambda p:-side(p))
        if area(piece):outside.append(piece)
        poly=clip(poly,side)
        if not area(poly):break
    return outside
def rational(t):return tuple(tuple(F(x,1<<149) for x in p) for p in t)
def direction(source,targets,limit):
    bound=F(0);covered=0
    for source_face in source:
        a=rational(source_face);na=cross(sub(a[1],a[0]),sub(a[2],a[0]))
        axis=max(range(3),key=lambda k:abs(na[k]));xy=[k for k in range(3) if k!=axis]
        project=lambda t:[tuple(p[k] for k in xy) for p in t]
        pa=project(a);candidates=[]
        def height(n,p,q):return (dot(n,p)-sum(n[k]*q[j] for j,k in enumerate(xy)))/n[axis]
        for b,nb in targets:
            if not nb[axis] or dot(na,nb)<=0:continue
            pb=project(b)
            if any(max(p[k] for p in pa)<min(p[k] for p in pb) or max(p[k] for p in pb)<min(p[k] for p in pa) for k in range(2)):continue
            poly=intersect(pa,pb)
            if not area(poly):continue
            delta=lambda q:height(nb,b[0],q)-height(na,a[0],q)
            poly=clip(clip(poly,lambda q:limit-delta(q)),lambda q:limit+delta(q))
            if not area(poly):continue
            # Bind the target plane now; later iterations must not change it.
            values=[delta(q) for q in poly]
            candidates.append((max(map(abs,values)),poly,nb,b[0]))
        remaining=[pa]
        for _,poly,nb,b0 in sorted(candidates,key=lambda p:p[0]):
            next_remaining=[]
            for piece in remaining:
                overlap=intersect(piece,poly)
                if not area(overlap):next_remaining.append(piece);continue
                bound=max(bound,max(abs(height(nb,b0,q)-height(na,a[0],q)) for q in overlap))
                next_remaining.extend(subtract(piece,poly))
            remaining=next_remaining
            if not remaining:break
        if any(map(area,remaining)):
            return {'covered':False,'reason':'Exact projected coverage is incomplete within the requested spatial bound'}
        covered+=1
    return {'covered':True,'covered_residual_faces':covered,'bound':bound}
def certify(a,b,limit_mm='0.0001'):
    aa,bb=triangles(a),triangles(b);common=aa&bb;ra,rb=aa-common,bb-common
    def targets(counter):
        result=[]
        for t in counter:
            t=rational(t);result.append((t,cross(sub(t[1],t[0]),sub(t[2],t[0]))))
        return result
    ab=direction(ra,targets(rb),F(limit_mm));ba=direction(rb,targets(ra),F(limit_mm))
    valid=ab['covered'] and ba['covered']
    bound=max(ab.get('bound',F(0)),ba.get('bound',F(0))) if valid else None
    for d in [ab,ba]:
        if 'bound' in d:d['axis_distance_upper_bound_mm']=float(d.pop('bound'))
    return {'certified':valid,'method':'exact rational, bidirectional complete projected triangle union coverage',
            'requested_upper_bound_mm':float(F(limit_mm)),'hausdorff_upper_bound_mm':float(bound) if bound is not None else None,
            'exact_bound_rational':str(bound) if bound is not None else None,'directions':[ab,ba]}
