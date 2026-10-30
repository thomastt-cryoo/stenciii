use serde_json::json;
use stencil_core::graph::Engine;

#[test]
fn unused_empty_cleanup_diagnostic_does_not_warn_but_consuming_it_stays_blocked(){
 let mut engine=Engine::new();
 let id=engine.add_image(include_bytes!("../../../docs/m5/fixtures/cli-seam-simple.svg").to_vec()).unwrap()["id"].as_str().unwrap().to_string();
 let mut graph=json!({"nodes":[
  {"id":"source","type":"source","params":{"image_id":id,"resolution":120}},
  {"id":"mask","type":"threshold","params":{}},
  {"id":"trace","type":"trace","params":{}},
  {"id":"clean","type":"remove_islands","params":{"delete_specks":false,"fill_holes":false}},
  {"id":"plate","type":"vector_stencil","params":{"width_mm":120,"thickness_mm":3,"raised_bridges":false}}
 ],"edges":[
  {"from":["source","image"],"to":["mask","image"]},
  {"from":["mask","mask"],"to":["trace","mask"]},
  {"from":["trace","shapes"],"to":["clean","shapes"]},
  {"from":["clean","shapes"],"to":["plate","shapes"]}
 ]});
 let result=engine.run(&graph,None,&||0.0);let report=engine.report(&graph,&result);
 assert_eq!(report["verdict"],"ready","{report}");
 assert!(!report["findings"].as_array().unwrap().iter().any(|f|f["node"]=="clean"));
 graph["nodes"].as_array_mut().unwrap().push(json!({"id":"removed-plate","type":"vector_stencil","params":{}}));
 graph["edges"].as_array_mut().unwrap().push(json!({"from":["clean","removed"],"to":["removed-plate","shapes"]}));
 let result=engine.run(&graph,None,&||0.0);let report=engine.report(&graph,&result);
 assert_eq!(report["verdict"],"blocked");
 assert!(report["findings"].as_array().unwrap().iter().any(|f|f["node"]=="removed-plate"&&f["level"]=="error"));
 assert!(report["findings"].as_array().unwrap().iter().any(|f|f["node"]=="clean"));
}
