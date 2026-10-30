use stencil_core::mesh::Mesh;

#[test]
fn stl_normals_follow_the_stored_float32_vertices_of_thin_facets() {
    // Derived from the actual retained vector-stencil margin reproduction.
    // The f64 face points down, but float32 coordinates describe an upward face.
    let a=[54.0369987487793,51.88890075683594,0.0];
    let b=[54.01850128173828-0.000001,52.444400787353516,0.0];
    let c=[54.0,53.0,0.0];
    let original_cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
    assert!(original_cross<0.0);
    let mesh=Mesh{v:vec![a,b,c],t:vec![[0,1,2]]};
    let bytes=mesh.to_stl();let decoded=Mesh::from_stl(&bytes).unwrap();
    let p=&decoded.v;let stored_cross=(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[1][1]-p[0][1])*(p[2][0]-p[0][0]);
    assert!(stored_cross>0.0);
    let normal_z=f32::from_le_bytes(bytes[92..96].try_into().unwrap());
    assert_eq!(normal_z,1.0);
    assert_eq!(decoded.t,mesh.t);
    for (actual,intended) in decoded.v.iter().zip(&mesh.v){for k in 0..3{assert_eq!(actual[k],(intended[k] as f32) as f64);}}
}
