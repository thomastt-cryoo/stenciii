//! Reproduce calibration CSG in alternate operation orders without weakening validation.
use stencil_core::{hardware as hw, mesh::Mesh};
fn areas(m: &Mesh) -> usize {
    m.t.iter().filter(|t| {
        let a=m.v[t[0]];let b=m.v[t[1]];let c=m.v[t[2]];
        let u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];let v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
        let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
        n.iter().map(|x|x*x).sum::<f64>()<=1e-24
    }).count()
}
fn alternate(hex:bool,d:f64,sequential:bool,round_height:bool)->Result<Mesh,String>{
 let pitch=d+2.0*stencil_core::tiles::WALL_MM+5.0;
 let ext=if hex{3f64.sqrt()/2.0*(d+0.5)}else{d+0.5};
 let h=ext+2.0*stencil_core::tiles::WALL_MM+1.0;
 let h=if round_height{(h*1e6).round()/1e6}else{h};
 let mut block=Mesh::cuboid([0.0,-6.0,0.0],[pitch*6.0+4.0,6.0,h]);let mut holes=Vec::new();let mut dots=Vec::new();
 for i in 0..6 {let x=2.0+pitch*(i as f64+0.5);let mut hole=Mesh::prism_z(if hex{6}else{24},(d+i as f64*0.1)/2.0,-7.0,7.0).along(1);hole.translate([x,0.0,h/2.0]);holes.push(hole);
  for k in 0..=i{let mut dim=hw::cylinder(0.6,h-0.7,h+0.7,16);dim.translate([x+(k as f64-i as f64/2.0)*2.0,-4.0,0.0]);dots.push(dim)}
 }
 block=block.subtract(&hw::union_all(holes))?;
 if sequential{for dot in dots{block=block.subtract(&dot)?;}}else{block=block.subtract(&hw::union_all(dots))?;}
 Ok(block)
}
fn main(){
 std::fs::create_dir_all("sandbox/m5/fit-probes").unwrap();
 for hex in [true,false]{for (label,result)in [
  ("original",hw::fit_test(hex,3.0,&[0.0,0.1,0.2,0.3,0.4,0.5],24)),
  ("separate-groups",alternate(hex,3.0,false,false)),
  ("sequential",alternate(hex,3.0,true,false)),
  ("rounded-height",alternate(hex,3.0,true,true))
 ]{match result {Ok(mesh)=>{let bytes=mesh.to_stl();let stored=Mesh::from_stl(&bytes).unwrap();let mode=if hex{"hex"}else{"round"};std::fs::write(format!("sandbox/m5/fit-probes/{mode}-{label}.stl"),bytes).unwrap();println!("{mode} {label}: faces {}, f64 degenerates {}, stored degenerates {}, closed {}, volume {}",mesh.t.len(),areas(&mesh),areas(&stored),stored.is_watertight(),stored.volume());},Err(error)=>println!("{label}: {error}")}}
 }
}
