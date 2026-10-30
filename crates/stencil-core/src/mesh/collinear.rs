//! Remove collinear CSG facets by local manifold edge collapses. Every moved
//! vertex stays on every incident face plane; topology, bounds and volume are
//! checked before accepting the trial. Deleting zero-area faces alone opens holes.
use super::{Mesh, P3};
use std::collections::BTreeSet;

#[derive(Default, Debug)]
pub(crate) struct RepairStats {
    pub edge_collapses: usize,
    pub removed_collinear_faces: usize,
    pub edge_subdivisions: usize,
}
impl RepairStats {
    pub fn is_empty(&self) -> bool { self.removed_collinear_faces == 0 }
    pub fn info(&self, file: &str) -> serde_json::Value {
        serde_json::json!({"file":file,
            "surface_preserving_edge_collapses":self.edge_collapses,
            "removed_collinear_faces":self.removed_collinear_faces,
            "preserved_edge_subdivisions":self.edge_subdivisions})
    }
}

fn sub(a: P3, b: P3) -> P3 {
    [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
fn dot(a: P3, b: P3) -> f64 {
    a.into_iter().zip(b).map(|(a, b)| a * b).sum()
}
fn normal(m: &Mesh, t: [usize; 3]) -> P3 {
    let a = sub(m.v[t[1]], m.v[t[0]]);
    let b = sub(m.v[t[2]], m.v[t[0]]);
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}
fn bad(m: &Mesh, t: [usize; 3]) -> bool {
    let n = normal(m, t);
    dot(n, n) <= 1e-24
}
fn count(m: &Mesh) -> usize {
    m.t.iter().filter(|&&t| bad(m, t)).count()
}
fn bounds(m: &Mesh) -> (P3, P3) {
    let (mut lo, mut hi) = ([f64::INFINITY; 3], [f64::NEG_INFINITY; 3]);
    for &v in m.t.iter().flatten() {
        for k in 0..3 {
            lo[k] = lo[k].min(m.v[v][k]);
            hi[k] = hi[k].max(m.v[v][k])
        }
    }
    (lo, hi)
}

fn interior(p: P3, a: P3, b: P3) -> bool {
    let d = sub(b, a);
    let q = sub(p, a);
    let length2 = dot(d, d);
    let along = dot(q, d);
    let cross = [q[1]*d[2]-q[2]*d[1],q[2]*d[0]-q[0]*d[2],q[0]*d[1]-q[1]*d[0]];
    along > 0.0 && along < length2 && dot(cross, cross) <= 1e-24 * length2
}

fn euler(m: &Mesh) -> isize {
    let mut vertices: BTreeSet<usize> = BTreeSet::new();
    let mut edges = BTreeSet::new();
    for t in &m.t {
        vertices.extend(t.iter().copied());
        for k in 0..3 {
            let (a,b)=(t[k],t[(k+1)%3]);
            edges.insert((a.min(b),a.max(b)));
        }
    }
    vertices.len() as isize - edges.len() as isize + m.t.len() as isize
}

/// Zero-area Boolean facets can encode two different subdivisions of the same
/// geometric edge. Removing them alone leaves T-junctions, and collapsing their
/// vertices can destroy a real corner on an incident face. Instead, give every
/// adjacent nonzero face the common boundary subdivision, using existing stored
/// coordinates only. Each split partitions one triangle on its original plane.
fn subdivide_boundaries(mesh: &mut Mesh) -> Result<RepairStats, String> {
    let removed = count(mesh);
    if removed > 128 || !mesh.is_watertight() {
        return Err("collinear facets need a closed mesh within the local repair budget".into());
    }
    let candidates: BTreeSet<_> = mesh.t.iter().filter(|&&t| bad(mesh,t)).flatten().copied().collect();
    let mut trial = mesh.clone();
    trial.t.clear();
    let mut splits = 0;
    for &t in &mesh.t {
        if bad(mesh,t) { continue; }
        let old = normal(mesh,t);
        let old_area = dot(old,old).sqrt();
        let mut parts = vec![t];
        for &p in &candidates {
            if !(0..3).any(|k| interior(mesh.v[p],mesh.v[t[k]],mesh.v[t[(k+1)%3]])) { continue; }
            'piece: for j in 0..parts.len() {
                let f=parts[j];
                for k in 0..3 {
                    let (a,b,c)=(f[k],f[(k+1)%3],f[(k+2)%3]);
                    if !interior(mesh.v[p],mesh.v[a],mesh.v[b]) { continue; }
                    let next=[[a,p,c],[p,b,c]];
                    if next.iter().any(|&n| bad(mesh,n) || dot(old,normal(mesh,n)) <= 0.0) {
                        return Err("edge subdivision would reverse or flatten a required surface".into());
                    }
                    parts[j]=next[0];
                    parts.push(next[1]);
                    splits+=1;
                    break 'piece;
                }
            }
        }
        let area: f64=parts.iter().map(|&t| { let n=normal(mesh,t);dot(n,n).sqrt() }).sum();
        if !area.is_finite() || (area-old_area).abs()>old_area.max(1.0)*1e-12 {
            return Err("boundary subdivision did not preserve the original triangle area".into());
        }
        trial.t.extend(parts);
    }
    if count(&trial)!=0 || !trial.is_watertight() || bounds(mesh)!=bounds(&trial)
        || euler(mesh)!=euler(&trial)
        || crate::tile_bridge::components(mesh).0!=crate::tile_bridge::components(&trial).0
        || (mesh.volume()-trial.volume()).abs()>mesh.volume().abs().max(1.0)*1e-12 {
        return Err("boundary subdivision did not preserve valid closed topology, dimensions and volume".into());
    }
    *mesh=trial;
    Ok(RepairStats {edge_collapses:0,removed_collinear_faces:removed,edge_subdivisions:splits})
}

pub(super) fn repair_surface(mesh: &mut Mesh) -> Result<RepairStats, String> {
    let removed=count(mesh);
    if removed==0 { return Ok(RepairStats::default()); }
    match repair(mesh) {
        Ok(edge_collapses) => Ok(RepairStats {edge_collapses,removed_collinear_faces:removed,edge_subdivisions:0}),
        Err(_) => subdivide_boundaries(mesh),
    }
}

pub(super) fn repair(mesh: &mut Mesh) -> Result<usize, String> {
    let original_bad = count(mesh);
    if original_bad == 0 {
        return Ok(0);
    }
    // This is a local CSG cleanup, not a general damaged-mesh repair service.
    if original_bad > 128 || !mesh.is_watertight() {
        return Err("collinear tile facets require a different tile layout; local closed-surface repair is unavailable".into());
    }
    let original_bounds = bounds(mesh);
    let volume = mesh.volume();
    let components = crate::tile_bridge::components(mesh).0;
    let mut trial = mesh.clone();
    let mut collapses = 0;
    loop {
        let Some(degenerate) = trial.t.iter().copied().find(|&t| bad(&trial, t)) else {
            break;
        };
        let previous = count(&trial);
        let mut repaired = false;
        'candidate: for v in degenerate {
            for u in degenerate {
                if v == u {
                    continue;
                }
                let fan: Vec<_> = trial.t.iter().copied().filter(|t| t.contains(&v)).collect();
                let shared = fan.iter().filter(|t| t.contains(&u)).count();
                let nv: BTreeSet<_> = fan.iter().flatten().copied().filter(|&x| x != v).collect();
                let nu: BTreeSet<_> = trial
                    .t
                    .iter()
                    .filter(|t| t.contains(&u))
                    .flatten()
                    .copied()
                    .filter(|&x| x != u)
                    .collect();
                if shared != 2 || nv.intersection(&nu).count() != shared {
                    continue;
                }
                let preserves_planes = fan.iter().all(|&t| {
                    let old = normal(&trial, t);
                    let length = dot(old, old).sqrt();
                    if !length.is_finite() {
                        return false;
                    }
                    if length > 1e-12
                        && dot(old, sub(trial.v[u], trial.v[t[0]])).abs() / length > 1e-12
                    {
                        return false;
                    }
                    if t.contains(&u) || length <= 1e-12 {
                        return true;
                    }
                    let new = normal(&trial, t.map(|x| if x == v { u } else { x }));
                    let new_length = dot(new, new).sqrt();
                    new_length > 1e-12 && dot(old, new) >= 0.2 * length * new_length
                });
                if !preserves_planes {
                    continue;
                }
                let next: Vec<_> = trial
                    .t
                    .iter()
                    .filter(|t| !(t.contains(&v) && t.contains(&u)))
                    .map(|t| t.map(|x| if x == v { u } else { x }))
                    .collect();
                if next.iter().filter(|&&t| bad(&trial, t)).count() >= previous {
                    continue;
                }
                trial.t = next;
                collapses += 1;
                repaired = true;
                break 'candidate;
            }
        }
        if !repaired {
            return Err("collinear tile facets cannot be repaired without changing the surface; adjust the tile sizes or seam placement".into());
        }
    }
    let checked_bounds = bounds(&trial);
    let same_bounds = [original_bounds.0, original_bounds.1]
        .into_iter()
        .flatten()
        .zip([checked_bounds.0, checked_bounds.1].into_iter().flatten())
        .all(|(a, b)| (a - b).abs() <= 1e-9);
    if !same_bounds
        || !trial.is_watertight()
        || crate::tile_bridge::components(&trial).0 != components
        || (trial.volume() - volume).abs() > volume.abs().max(1.) * 1e-12
    {
        return Err("local tile facet repair did not preserve closed topology, dimensions and volume; change the tile layout".into());
    }
    *mesh = trial;
    Ok(collapses)
}

#[test]
fn actual_split_ring_collinear_facets_repair_without_surface_or_topology_change() {
    let original = Mesh::from_stl(include_bytes!(
        "../../../../docs/m5/fixtures/tile-bridge-collinear-before.stl"
    ))
    .unwrap();
    assert_eq!(count(&original), 4);
    assert!(original.is_watertight());
    let mut fixed = original.clone();
    assert_eq!(repair(&mut fixed).unwrap(), 3);
    assert_eq!(count(&fixed), 0);
    assert_eq!(bounds(&original), bounds(&fixed));
    assert!((original.volume() - fixed.volume()).abs() < 1e-8);
    assert_eq!(crate::tile_bridge::components(&fixed).0, 1);
    let stored = Mesh::from_stl(&fixed.to_stl()).unwrap();
    assert_eq!(count(&stored), 0);
    assert!(stored.is_watertight());
}

#[test]
fn retained_m5_remaining_ring_facets_keep_every_vertex_and_boundary_subdivision() {
    for bytes in [
        include_bytes!("../../../../docs/m6/fixtures/ring-seam-0-invalid-before.stl").as_slice(),
        include_bytes!("../../../../docs/m6/fixtures/ring-seam-20-invalid-before.stl").as_slice(),
    ] {
        let original=Mesh::from_stl(bytes).unwrap();
        assert_eq!(count(&original),4);
        assert!(original.is_watertight());
        assert!(repair(&mut original.clone()).is_err());
        let mut fixed=original.clone();
        let result=repair_surface(&mut fixed).unwrap();
        assert_eq!(result.edge_collapses,0);
        assert_eq!(result.removed_collinear_faces,4);
        assert_eq!(result.edge_subdivisions,4);
        assert_eq!(fixed.v,original.v);
        assert_eq!(fixed.t.len(),original.t.len());
        assert_eq!(bounds(&fixed),bounds(&original));
        assert_eq!(euler(&fixed),euler(&original));
        assert_eq!(count(&fixed),0);
        assert!((fixed.volume()-original.volume()).abs()<1e-9);
        let stored=Mesh::from_stl(&fixed.to_stl()).unwrap();
        assert_eq!(count(&stored),0);
        assert!(stored.is_watertight());
        assert_eq!(crate::tile_bridge::components(&stored).0,1);
        let good=fixed.to_stl();
        assert!(repair_surface(&mut fixed).unwrap().is_empty());
        assert_eq!(fixed.to_stl(),good);
        let mut open=original.clone();open.t.pop();
        let before=open.to_stl();
        assert!(repair_surface(&mut open).is_err());
        assert_eq!(open.to_stl(),before);
    }
}
