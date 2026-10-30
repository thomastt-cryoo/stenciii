//! Verification helper: encode the named real native intermediate output.
//! Assets are local files supplied by the audit; no runtime product API is added.
use serde_json::{json,Value};
use std::{fs,path::Path,time::Instant};
use stencil_core::graph::Engine;

fn main(){
    let input=std::env::args().nth(1).expect("audit configuration JSON");
    let cases:Value=serde_json::from_slice(&fs::read(input).unwrap()).unwrap();
    let mut rows=Vec::new();
    for case in cases.as_array().unwrap(){
        let started=Instant::now();let mut engine=Engine::new();let mut graph=case["graph"].clone();
        let images=case["images"].as_object().unwrap();let mut ids=serde_json::Map::new();
        for (id,path) in images {let image=engine.add_image(fs::read(path.as_str().unwrap()).unwrap()).unwrap();ids.insert(id.clone(),image["id"].clone());}
        for node in graph["nodes"].as_array_mut().unwrap(){if node["type"]=="source"{let id=node["params"]["image_id"].as_str().unwrap();if let Some(mapped)=ids.get(id){node["params"]["image_id"]=mapped.clone();}}}
        let target=case["target"].as_str().unwrap();let out=case["out"].as_str().unwrap();
        let result=engine.run(&graph,None,&||0.0);let key=result["nodes"][target]["key"].as_str();
        let record=if let Some(value)=key.and_then(|key|engine.value(key,out)){
            let (mime,bytes)=value.encode().expect("real output encoding");let output=Path::new(case["path"].as_str().unwrap());if let Some(parent)=output.parent(){fs::create_dir_all(parent).unwrap();}fs::write(output,bytes).unwrap();
            json!({"case":case["case"],"path":output,"mime":mime,"info":value.info(),"milliseconds":started.elapsed().as_secs_f64()*1000.})
        }else{json!({"case":case["case"],"error":result["nodes"][target],"milliseconds":started.elapsed().as_secs_f64()*1000.})};
        rows.push(record);
    }
    println!("{}",json!(rows));
}
