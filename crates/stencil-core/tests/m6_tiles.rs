#[allow(dead_code)]
#[path = "../examples/m6_tile_matrix.rs"]
mod matrix;

#[test]
fn real_ring_tiles_cover_both_strategies_dimensions_bevels_connectors_and_bridges() {
    let rows=matrix::exercise(None);
    assert_eq!(rows.len(),40);
    assert!(rows.iter().all(|r|r["files"].as_array().unwrap().len()>=5));
}
