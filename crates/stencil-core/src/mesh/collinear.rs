//! Remove collinear CSG facets by local manifold edge collapses. Every moved
//! vertex stays on every incident face plane; topology, bounds and volume are
//! checked before accepting the trial. Deleting zero-area faces alone opens holes.
use super::{Mesh, P3};
use std::collections::BTreeSet;

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
