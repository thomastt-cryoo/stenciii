//! Emit the runtime catalogue for the M0 preservation audit.
//! Run: cargo run --release -p stencil-core --example catalogue
fn main() {
    println!("{}", stencil_core::graph::node_types());
}
