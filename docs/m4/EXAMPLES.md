# Openable geometry demonstrations

All 96 saved before/after projects are in [fixtures](fixtures/). Open one in Stencil Studio or replay it with `stencil --project <file> -o <output.stl>`. Tile-method projects produce part sets and should use an output directory. Original artwork bytes and opaque metadata are embedded.

The selected STL pairs below were independently checked for closed oriented geometry. They show actual engine output, not rendered substitutes.

| Changed field | Before STL | After STL | Triangles before → after |
|---|---|---|---|
| `vector_stencil.bridge_spacing` | [Before](examples/vector_stencil-bridge_spacing-before.stl) | [After](examples/vector_stencil-bridge_spacing-after.stl) | 3072 → 3136 |
| `vector_stencil.z_bridging` | [Before](examples/vector_stencil-z_bridging-before.stl) | [After](examples/vector_stencil-z_bridging-after.stl) | 3136 → 4988 |
| `vector_stencil.layer_height_mm` | [Before](examples/vector_stencil-layer_height_mm-before.stl) | [After](examples/vector_stencil-layer_height_mm-after.stl) | 3136 → 3136 |
| `vector_stencil.min_first_layer_width_mm` | [Before](examples/vector_stencil-min_first_layer_width_mm-before.stl) | [After](examples/vector_stencil-min_first_layer_width_mm-after.stl) | 3136 → 3272 |
| `remesh.tolerance_mm` | [Before](examples/remesh-tolerance_mm-before.stl) | [After](examples/remesh-tolerance_mm-after.stl) | 1780 → 720 |
| `remesh.decimate` | [Before](examples/remesh-decimate-before.stl) | [After](examples/remesh-decimate-after.stl) | 4988 → 3874 |

Reconstruction tolerance changes from 0.2 to 0.4 mm in the tolerance pair (source 3,444 triangles). The decimation pair retains source outlines when layer reconstruction is unsafe, then genuinely simplifies flat faces. Engine-reported maximum deviation and the phase-specific tolerances are recorded separately; they are not interchangeable metrics. See geometry-coverage.json for all bounds, volumes, hashes and diagnostics.
