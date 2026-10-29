//! Inspect direct-CLI seam execution outputs without publishing them as validated deliveries.
use stencil_core::graph::Engine;
use serde_json::json;
fn main(){
 let args:Vec<_>=std::env::args().collect();let file=&args[1];let mut engine=Engine::new();let id=engine.add_image(std::fs::read(file).unwrap()).unwrap()["id"].as_str().unwrap().to_string();
 let graph=json!({"nodes":[{"id":"src","type":"source","params":{"image_id":id,"resolution":160}},{"id":"thr","type":"threshold","params":{}},{"id":"st","type":"stencil","params":{"width_mm":140,"thickness_mm":8,"margin_mm":18}},{"id":"ex","type":"export","params":{"max_x":80,"max_y":80,"segments":24,"depth":6}}],"edges":[{"from":["src","image"],"to":["thr","image"]},{"from":["thr","mask"],"to":["st","mask"]},{"from":["st","solid"],"to":["ex","solid"]}]});
 for angle in [0.,20.] {engine.set_legacy_seam_angle(angle).unwrap();let r=engine.run(&graph,None,&||0.);let key=r["nodes"]["ex"]["key"].as_str().unwrap();let parts=engine.value(key,"parts").unwrap();let dir=format!("sandbox/m5/seam-probe/{angle}");std::fs::create_dir_all(&dir).unwrap();for name in parts.info()["files"].as_object().unwrap().keys(){std::fs::write(format!("{dir}/{name}"),parts.part(name).unwrap()).unwrap();}}
}
