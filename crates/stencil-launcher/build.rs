fn main() {
    #[cfg(target_os = "windows")]
    embed_manifest::embed_manifest(embed_manifest::new_manifest("StencilStudio.Browser"))
        .expect("could not embed the standard Windows application manifest");
    println!("cargo:rerun-if-changed=build.rs");
}
