//! Real ring/connector regression matrix, also exercised by the integration test.
use serde_json::{json, Value};
use std::path::Path;
use stencil_core::{graph::Engine, mesh::Mesh};

pub fn exercise(destination: Option<&Path>) -> Vec<Value> {
    let mut rows = Vec::new();
    for strategy in ["legacy", "post-solid", "tile-first-raster", "tile-first-vector", "cut-whole"] {
        for variant in 0..8 {
            let (width, tile, angle, diameter, clearance, raised, gap, z) = [
                (140., 80., 0., "3", 0.2, true, 0., "easy"),
                (140., 80., 20., "3", 0.2, true, 0., "easy"),
                (160., 90., 35., "2.5", 0., true, 0., "easy"),
                (200., 110., 45., "4", 0.4, false, 0., "easy"),
                (180., 95., 20., "3", 0.3, true, 0.2, "steps"),
                (120., 70., 0., "3", 0.2, true, 0., "easy"),
                (140., 80., 0., "3", 0.2, true, 0., "easy"),
                (160., 90., 20., "4", 0.4, true, 0., "steps"),
            ][variant];
            let margin=if variant==6 {8} else if variant==7 {10} else {18};
            let case = format!("{strategy}-{variant}");
            let mut engine = Engine::new();
            let image = engine.add_image(include_bytes!("../../../docs/m5/fixtures/cli-seam-ring.svg").to_vec()).unwrap()["id"].as_str().unwrap().to_string();
            let vector = strategy == "tile-first-vector" || strategy == "cut-whole";
            let first = strategy.starts_with("tile-first") || strategy == "cut-whole";
            let connector = if variant == 2 { "round" } else { "hex" };
            let mut nodes = vec![json!({"id":"src","type":"source","params":{"image_id":image,"resolution":if variant==7 {240} else {160}}}),json!({"id":"mask","type":"threshold","params":{}})];
            let mut edges = vec![json!({"from":["src","image"],"to":["mask","image"]})];
            let (upstream,port)=if vector {
                nodes.push(json!({"id":"outlines","type":"trace","params":{}}));
                edges.push(json!({"from":["mask","mask"],"to":["outlines","mask"]}));
                ("outlines","shapes")
            } else { ("mask","mask") };
            let mut builder=json!({"id":"built","type":if vector {"vector_stencil"} else {"stencil"},"params":{"width_mm":width,"thickness_mm":8,"margin_mm":margin,"raised_bridges":raised,"z_bridging":z,"detail":2}});
            if strategy=="cut-whole" { builder["params"]["tile_method"]=json!("cut_whole"); }
            let terminal=if first {
                nodes.push(json!({"id":"layout","type":"tile_layout","params":{"width_mm":width,"margin_mm":margin,"max_x":tile,"max_y":tile,"depth":6,"segments":24,"seam_shift":0,"connector":connector,"connector_d":diameter,"clearance":clearance}}));
                edges.push(json!({"from":[upstream,port],"to":["layout",port]}));
                edges.push(json!({"from":["layout","tiles"],"to":["built","tiles"]}));
                "built"
            } else {
                edges.push(json!({"from":[upstream,port],"to":["built",port]}));
                nodes.push(json!({"id":"parts","type":if strategy=="legacy" {"export"} else {"tiles"},"params":{"max_x":tile,"max_y":tile,"depth":6,"segments":24,"seam_shift":0,"seam_angle_deg":angle,"seam_gap":gap,"connector":connector,"connector_d":diameter,"clearance":clearance,"raised_bridges":raised,"z_bridging":z}}));
                edges.push(json!({"from":["built","solid"],"to":["parts","solid"]}));
                "parts"
            };
            nodes.push(builder);
            let graph=json!({"nodes":nodes,"edges":edges});
            if strategy=="legacy" {engine.set_legacy_seam_angle(angle).unwrap();}
            let result=engine.run(&graph,None,&||0.0);
            let key=result["nodes"][terminal]["key"].as_str().unwrap_or_else(||panic!("{case}: {result}"));
            let parts=engine.value(key,"parts").unwrap();
            let info=parts.info();
            let mut files=Vec::new();
            for name in info["files"].as_object().unwrap().keys() {
                let bytes=parts.part(name).unwrap();
                let mesh=Mesh::from_stl(&bytes).unwrap();
                let degenerate=mesh.t.iter().filter(|t| {
                    let a=mesh.v[t[0]];let b=mesh.v[t[1]];let c=mesh.v[t[2]];
                    let u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];let v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];
                    let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
                    n.iter().map(|x|x*x).sum::<f64>()<=1e-24
                }).count();
                assert_eq!(degenerate,0,"{case}/{name}");
                assert!(mesh.is_watertight(),"{case}/{name}");
                assert!(mesh.volume()>0.,"{case}/{name}");
                files.push(json!({"name":name,"triangles":mesh.t.len(),"volume_mm3":mesh.volume(),"bounds_mm":mesh.bounds()}));
                if let Some(destination)=destination {
                    let dir=destination.join(&case);std::fs::create_dir_all(&dir).unwrap();
                    std::fs::write(dir.join(name),bytes).unwrap();
                }
            }
            if let Some(destination)=destination {
                std::fs::write(destination.join(&case).with_extension("json"),serde_json::to_vec_pretty(&graph).unwrap()).unwrap();
            }
            rows.push(json!({"case":case,"strategy":strategy,"variant":variant,"terminal":terminal,"files":files,"info":info,"legacy_execution_seam_angle":if strategy=="legacy" {json!(angle)} else {Value::Null}}));
        }
    }
    rows
}
fn main() {
    let destination=std::env::args().nth(1).unwrap_or_else(||"sandbox/m6/native-tiles".into());
    std::fs::create_dir_all(&destination).unwrap();
    let rows=exercise(Some(Path::new(&destination)));
    println!("{}",serde_json::to_string_pretty(&rows).unwrap());
}
