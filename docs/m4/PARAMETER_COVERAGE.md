# Geometry parameter evidence

All 48 fields use genuine per-instance controls, exact saved readback, runtime-default reset and suitable engine execution. 17 existing physical fields are reused; 31 are new. Together with 41 artwork fields, the customer app has 89 unique editable qualified fields.

47 fields change geometry or an applicable computed diagnostic. The remesh overhang limit is verified during active reconstruction at 10° and 85°: both outputs satisfy the constraint and are identical. A limit need not change an already compliant result. No fake diagnostic echo is counted.

| Qualified field | Added in M4 | Engine default | Allowed / increment | Tested change | Evidence |
|---|---|---|---|---|---|
| `stencil.width_mm` | Reused | 200.0 | 20.0–2000.0; step 1.0 | 140 | Changed |
| `stencil.thickness_mm` | Reused | 5.0 | 0.2–100.0; step 0.2 | 3.4 | Changed |
| `stencil.margin_mm` | Reused | 8.0 | 0.0–500.0; step 1.0 | 10 | Changed |
| `stencil.flip` | Yes | false | bool | true | Changed |
| `stencil.bridge_mm` | Reused | 1.6 | 0.6–50.0; step 0.1 | 2.5 | Changed |
| `stencil.bridges_per_island` | Reused | 1.0 | 1.0–5.0; step 1.0 | 1 | Changed |
| `stencil.bridge_spacing` | Yes | "closest" | closest, spread | "spread" | Changed |
| `stencil.bridge_min_angle_deg` | Yes | 45.0 | 15.0–90.0; step 5.0 | 85 | Changed |
| `stencil.bridge_max_length` | Yes | 4.0 | 1.0–16.0; step 0.5 | 1 | Changed |
| `stencil.bridge_passes` | Yes | 4.0 | 1.0–8.0; step 1.0 | 1 | Changed |
| `stencil.raised_bridges` | Reused | true | bool | false | Changed |
| `stencil.z_bridging` | Yes | "easy" | easy, steps | "steps" | Changed |
| `stencil.layer_height_mm` | Reused | 0.2 | 0.05–5.0; step 0.05 | 0.3 | Changed |
| `stencil.extra_top_layers` | Reused | 1.0 | 0.0–50.0; step 1.0 | 4 | Changed |
| `stencil.max_overhang_deg` | Yes | 0.0 | 0.0–89.0; step 1.0 | 85 | Changed |
| `stencil.min_island_mm2` | Yes | 0.0 | 0.0–100000.0; step 1.0 | 10 | Changed |
| `stencil.min_contact_mm` | Yes | 0.0 | 0.0–3.0; step 0.1 | 2.5 | Changed |
| `stencil.min_first_layer_width_mm` | Yes | 0.0 | 0.0–10.0; step 0.1 | 5 | Changed |
| `stencil.first_layer_taper_mm` | Yes | 1.0 | 0.0–50.0; step 0.1 | 1.6 | Changed |
| `vector_stencil.detail` | Reused | 5.0 | 0.5–20.0; step 0.5 | 12 | Changed |
| `vector_stencil.width_mm` | Reused | 200.0 | 20.0–2000.0; step 1.0 | 140 | Changed |
| `vector_stencil.thickness_mm` | Reused | 5.0 | 0.2–100.0; step 0.2 | 3.4 | Changed |
| `vector_stencil.margin_mm` | Reused | 8.0 | 0.0–500.0; step 1.0 | 10 | Changed |
| `vector_stencil.flip` | Yes | false | bool | true | Changed |
| `vector_stencil.bridge_mm` | Reused | 1.6 | 0.6–50.0; step 0.1 | 2.5 | Changed |
| `vector_stencil.bridges_per_island` | Reused | 1.0 | 1.0–5.0; step 1.0 | 1 | Changed |
| `vector_stencil.bridge_spacing` | Yes | "closest" | closest, spread | "spread" | Changed |
| `vector_stencil.bridge_min_angle_deg` | Yes | 45.0 | 15.0–90.0; step 5.0 | 85 | Changed |
| `vector_stencil.bridge_max_length` | Yes | 4.0 | 1.0–16.0; step 0.5 | 1 | Changed |
| `vector_stencil.bridge_passes` | Yes | 4.0 | 1.0–8.0; step 1.0 | 1 | Changed |
| `vector_stencil.raised_bridges` | Reused | true | bool | false | Changed |
| `vector_stencil.z_bridging` | Yes | "easy" | easy, steps | "steps" | Changed |
| `vector_stencil.layer_height_mm` | Reused | 0.2 | 0.05–5.0; step 0.05 | 0.3 | Changed |
| `vector_stencil.extra_top_layers` | Reused | 1.0 | 0.0–50.0; step 1.0 | 4 | Changed |
| `vector_stencil.max_overhang_deg` | Yes | 0.0 | 0.0–89.0; step 1.0 | 85 | Changed |
| `vector_stencil.min_island_mm2` | Yes | 0.0 | 0.0–100000.0; step 1.0 | 10 | Changed |
| `vector_stencil.min_contact_mm` | Yes | 0.0 | 0.0–3.0; step 0.1 | 2.5 | Changed |
| `vector_stencil.min_first_layer_width_mm` | Yes | 0.0 | 0.0–10.0; step 0.1 | 2.5 | Changed |
| `vector_stencil.first_layer_taper_mm` | Yes | 1.0 | 0.0–50.0; step 0.1 | 1.6 | Changed |
| `vector_stencil.tile_method` | Yes | "per_tile" | per_tile, cut_whole | "cut_whole" | Changed |
| `remesh.layer_from` | Yes | 1.0 | 1.0–1000.0; step 1.0 | 4 | Changed |
| `remesh.layer_to` | Yes | 0.0 | 0.0–1000.0; step 1.0 | 6 | Changed |
| `remesh.tolerance_mm` | Yes | 0.1 | 0.01–1.0; step 0.01 | 0.4 | Changed |
| `remesh.smoothing` | Yes | 0.5 | 0.0–1.0; step 0.05 | 1 | Changed |
| `remesh.keep_material` | Yes | true | bool | false | Changed |
| `remesh.max_overhang_deg` | Yes | 45.0 | 10.0–90.0; step 1.0 | 85 | Active constraint satisfied |
| `remesh.decimate` | Yes | true | bool | true | Changed |
| `remesh.decimate_mm` | Yes | 0.02 | 0.005–0.5; step 0.005 | 0.15 | Changed |
