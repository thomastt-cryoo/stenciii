# Verified parameter coverage

217 unique qualified fields: 41 artwork + 48 geometry + 128 manufacturing. Each row links to the recorded real control and engine evidence in parameter-coverage-217.json. Conditional settings are exercised with compatible fixtures; reset and save/reopen checks retain original artwork and unknown data.

| Field | Milestone | Engine default | Allowed values | Tested value |
|---|---|---|---|---|
| `source.image_id` | M3 replay | "" | text | "two" |
| `source.resolution` | M3 replay | 1000.0 | 20.0 to 2000.0; step 10.0 | 300 |
| `text.text` | M3 replay | "STENCIL" | string | "AOBR\nAB" |
| `text.font` | M3 replay | "sans bold" | sans bold, serif bold | "serif bold" |
| `text.size` | M3 replay | 160.0 | 20.0 to 600.0; step 5.0 | 200 |
| `text.line_spacing` | M3 replay | 1.0 | 0.7 to 2.0; step 0.05 | 1.5 |
| `text.padding` | M3 replay | 20.0 | 0.0 to 200.0; step 1.0 | 45 |
| `transform.crop_left` | M3 replay | 0.0 | 0.0 to 90.0; step 0.5 | 12 |
| `transform.crop_top` | M3 replay | 0.0 | 0.0 to 90.0; step 0.5 | 10 |
| `transform.crop_right` | M3 replay | 0.0 | 0.0 to 90.0; step 0.5 | 17 |
| `transform.crop_bottom` | M3 replay | 0.0 | 0.0 to 90.0; step 0.5 | 15 |
| `transform.turn` | M3 replay | "0" | 0, 90, 180, 270 | "90" |
| `transform.angle` | M3 replay | 0.0 | -45.0 to 45.0; step 0.5 | 17 |
| `transform.flip_h` | M3 replay | false | bool | true |
| `transform.flip_v` | M3 replay | false | bool | true |
| `threshold.threshold` | M3 replay | 256.0 | 0.0 to 256.0; step 1.0 | 180 |
| `threshold.invert` | M3 replay | false | bool | true |
| `reduce.colours` | M3 replay | 3.0 | 2.0 to 10.0; step 1.0 | 5 |
| `reduce.smooth` | M3 replay | 0.0 | 0.0 to 6.0; step 0.5 | 2 |
| `smooth.radius` | M3 replay | 1.5 | 0.0 to 10.0; step 0.25 | 0.25 |
| `smooth.supersample` | M3 replay | 2.0 | 1.0 to 4.0; step 1.0 | 1 |
| `morphology.op` | M3 replay | "open" | erode, dilate, open, close, gradient, white_hat, black_hat, thin, skeleton, hit_or_miss | "dilate" |
| `morphology.kernel` | M3 replay | "disc" | square, disc, diamond, cross, line, ring | "square" |
| `morphology.radius` | M3 replay | 2.0 | 1.0 to 30.0; step 1.0 | 3 |
| `morphology.angle` | M3 replay | 0.0 | 0.0 to 179.0; step 1.0 | 45 |
| `morphology.iterations` | M3 replay | 1.0 | 0.0 to 10.0; step 1.0 | 2 |
| `morphology.pattern` | M3 replay | "endpoints" | isolated, endpoints, corners, junctions, custom | "isolated" |
| `morphology.custom` | M3 replay | "x00 011 x1x" | string | "111 111 111" |
| `morphology.rotate` | M3 replay | true | bool | false |
| `trace.smooth` | M3 replay | 1.5 | 0.0 to 8.0; step 0.25 | 0 |
| `trace.corner_deg` | M3 replay | 60.0 | 20.0 to 180.0; step 5.0 | 150 |
| `trace.tolerance` | M3 replay | 0.4 | 0.05 to 3.0; step 0.05 | 2.5 |
| `trace.min_area` | M3 replay | 4.0 | 0.0 to 1000.0; step 1.0 | 300 |
| `round_corners.max_angle` | M3 replay | 60.0 | 10.0 to 170.0; step 5.0 | 140 |
| `round_corners.radius` | M3 replay | 3.0 | 0.5 to 50.0; step 0.5 | 10 |
| `round_corners.round_concave` | M3 replay | false | bool | true |
| `remove_islands.delete_specks` | M3 replay | true | bool | false |
| `remove_islands.fill_holes` | M3 replay | true | bool | false |
| `remove_islands.max_area` | M3 replay | 50.0 | 1.0 to 100000.0; step 1.0 | 300 |
| `remove_islands.keep_largest` | M3 replay | 0.0 | 0.0 to 1000.0; step 1.0 | 1 |
| `shapes_to_mask.resolution` | M3 replay | 1000.0 | 20.0 to 4000.0; step 10.0 | 300 |
| `stencil.width_mm` | M4 replay | 200.0 | 20.0 to 2000.0; step 1.0 | 140 |
| `stencil.thickness_mm` | M4 replay | 5.0 | 0.2 to 100.0; step 0.2 | 3.4 |
| `stencil.margin_mm` | M4 replay | 8.0 | 0.0 to 500.0; step 1.0 | 10 |
| `stencil.flip` | M4 replay | false | bool | true |
| `stencil.bridge_mm` | M4 replay | 1.6 | 0.6 to 50.0; step 0.1 | 2.5 |
| `stencil.bridges_per_island` | M4 replay | 1.0 | 1.0 to 5.0; step 1.0 | 1 |
| `stencil.bridge_spacing` | M4 replay | "closest" | closest, spread | "spread" |
| `stencil.bridge_min_angle_deg` | M4 replay | 45.0 | 15.0 to 90.0; step 5.0 | 85 |
| `stencil.bridge_max_length` | M4 replay | 4.0 | 1.0 to 16.0; step 0.5 | 1 |
| `stencil.bridge_passes` | M4 replay | 4.0 | 1.0 to 8.0; step 1.0 | 1 |
| `stencil.raised_bridges` | M4 replay | true | bool | false |
| `stencil.z_bridging` | M4 replay | "easy" | easy, steps | "steps" |
| `stencil.layer_height_mm` | M4 replay | 0.2 | 0.05 to 5.0; step 0.05 | 0.3 |
| `stencil.extra_top_layers` | M4 replay | 1.0 | 0.0 to 50.0; step 1.0 | 4 |
| `stencil.max_overhang_deg` | M4 replay | 0.0 | 0.0 to 89.0; step 1.0 | 85 |
| `stencil.min_island_mm2` | M4 replay | 0.0 | 0.0 to 100000.0; step 1.0 | 10 |
| `stencil.min_contact_mm` | M4 replay | 0.0 | 0.0 to 3.0; step 0.1 | 2.5 |
| `stencil.min_first_layer_width_mm` | M4 replay | 0.0 | 0.0 to 10.0; step 0.1 | 5 |
| `stencil.first_layer_taper_mm` | M4 replay | 1.0 | 0.0 to 50.0; step 0.1 | 1.6 |
| `vector_stencil.detail` | M4 replay | 5.0 | 0.5 to 20.0; step 0.5 | 12 |
| `vector_stencil.width_mm` | M4 replay | 200.0 | 20.0 to 2000.0; step 1.0 | 140 |
| `vector_stencil.thickness_mm` | M4 replay | 5.0 | 0.2 to 100.0; step 0.2 | 3.4 |
| `vector_stencil.margin_mm` | M4 replay | 8.0 | 0.0 to 500.0; step 1.0 | 10 |
| `vector_stencil.flip` | M4 replay | false | bool | true |
| `vector_stencil.bridge_mm` | M4 replay | 1.6 | 0.6 to 50.0; step 0.1 | 2.5 |
| `vector_stencil.bridges_per_island` | M4 replay | 1.0 | 1.0 to 5.0; step 1.0 | 1 |
| `vector_stencil.bridge_spacing` | M4 replay | "closest" | closest, spread | "spread" |
| `vector_stencil.bridge_min_angle_deg` | M4 replay | 45.0 | 15.0 to 90.0; step 5.0 | 85 |
| `vector_stencil.bridge_max_length` | M4 replay | 4.0 | 1.0 to 16.0; step 0.5 | 1 |
| `vector_stencil.bridge_passes` | M4 replay | 4.0 | 1.0 to 8.0; step 1.0 | 1 |
| `vector_stencil.raised_bridges` | M4 replay | true | bool | false |
| `vector_stencil.z_bridging` | M4 replay | "easy" | easy, steps | "steps" |
| `vector_stencil.layer_height_mm` | M4 replay | 0.2 | 0.05 to 5.0; step 0.05 | 0.3 |
| `vector_stencil.extra_top_layers` | M4 replay | 1.0 | 0.0 to 50.0; step 1.0 | 4 |
| `vector_stencil.max_overhang_deg` | M4 replay | 0.0 | 0.0 to 89.0; step 1.0 | 85 |
| `vector_stencil.min_island_mm2` | M4 replay | 0.0 | 0.0 to 100000.0; step 1.0 | 10 |
| `vector_stencil.min_contact_mm` | M4 replay | 0.0 | 0.0 to 3.0; step 0.1 | 2.5 |
| `vector_stencil.min_first_layer_width_mm` | M4 replay | 0.0 | 0.0 to 10.0; step 0.1 | 2.5 |
| `vector_stencil.first_layer_taper_mm` | M4 replay | 1.0 | 0.0 to 50.0; step 0.1 | 1.6 |
| `vector_stencil.tile_method` | M4 replay | "per_tile" | per_tile, cut_whole | "cut_whole" |
| `remesh.layer_from` | M4 replay | 1.0 | 1.0 to 1000.0; step 1.0 | 4 |
| `remesh.layer_to` | M4 replay | 0.0 | 0.0 to 1000.0; step 1.0 | 6 |
| `remesh.tolerance_mm` | M4 replay | 0.1 | 0.01 to 1.0; step 0.01 | 0.4 |
| `remesh.smoothing` | M4 replay | 0.5 | 0.0 to 1.0; step 0.05 | 1 |
| `remesh.keep_material` | M4 replay | true | bool | false |
| `remesh.max_overhang_deg` | M4 replay | 45.0 | 10.0 to 90.0; step 1.0 | 85 |
| `remesh.decimate` | M4 replay | true | bool | true |
| `remesh.decimate_mm` | M4 replay | 0.02 | 0.005 to 0.5; step 0.005 | 0.15 |
| `split_colours.invert` | M5A | false | bool | true |
| `split_colours.colours` | M5A | 10.0 | 2.0 to 10.0; step 1.0 | 5 |
| `split_colours.min_area` | M5A | 0.0 | 0.0 to 5.0; step 0.05 | 1 |
| `tone_patterns.plate_width_mm` | M5A | 100.0 | 20.0 to 2000.0; step 1.0 | 150 |
| `tone_patterns.invert` | M5A | false | bool | true |
| `tone_patterns.kind` | M5A | "auto" | auto, lines, dots, crosshatch, checker | "dots" |
| `tone_patterns.spacing_mm` | M5A | 2.5 | 0.0 to 20.0; step 0.1 | 1.4 |
| `tone_patterns.angle` | M5A | 45.0 | 0.0 to 90.0; step 5.0 | 20 |
| `tone_patterns.kind_1` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_1` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_1` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_2` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_2` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_2` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_3` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_3` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_3` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_4` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_4` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_4` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_5` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_5` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_5` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_6` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_6` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_6` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_7` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_7` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_7` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `tone_patterns.kind_8` | M5A | "auto" | auto, lines, dots, crosshatch, checker, solid, empty | "dots" |
| `tone_patterns.spacing_8` | M5A | 0.0 | 0.0 to 20.0; step 0.1 | 3.3 |
| `tone_patterns.cover_8` | M5A | 0.0 | 0.0 to 95.0; step 1.0 | 41 |
| `colour_set.holes` | M5A | 3.0 | 0.0 to 4.0; step 1.0 | 2 |
| `colour_set.hole_d` | M5A | 4.0 | 2.0 to 12.0; step 0.5 | 3.5 |
| `colour_set.inset` | M5A | 0.0 | 0.0 to 100.0; step 0.5 | 5.5 |
| `colour_set.pins` | M5A | true | bool | false |
| `colour_set.pin_clearance` | M5A | 0.2 | 0.0 to 1.0; step 0.05 | 0.4 |
| `colour_set.pin_length` | M5A | 12.0 | 4.0 to 60.0; step 1.0 | 18 |
| `tile_layout.width_mm` | M5B | 100.0 | 20.0 to 2000.0; step 1.0 | 220 |
| `tile_layout.margin_mm` | M5B | 8.0 | 0.0 to 500.0; step 1.0 | 22 |
| `tile_layout.max_x` | M5B | 150.0 | 0.0 to 2000.0; step 5.0 | 80 |
| `tile_layout.max_y` | M5B | 150.0 | 0.0 to 2000.0; step 5.0 | 80 |
| `tile_layout.seam_shift` | M5B | 8.0 | 0.0 to 50.0; step 1.0 | 0 |
| `tile_layout.connector` | M5B | "hex" | hex, round | "round" |
| `tile_layout.connector_d` | M5B | "3" | 2.5, 3, 4, 5, 6 | "4" |
| `tile_layout.depth` | M5B | 10.0 | 4.0 to 20.0; step 0.5 | 8 |
| `tile_layout.clearance` | M5B | 0.2 | 0.0 to 0.6; step 0.05 | 0.4 |
| `tile_layout.spacing` | M5B | 30.0 | 10.0 to 200.0; step 5.0 | 55 |
| `tile_layout.segments` | M5B | 48.0 | 24.0 to 128.0; step 4.0 | 32 |
| `tile_layout.edits` | M5B | "" | text | "{\"seams\":{\"x1\":1},\"pockets\":{}}" |
| `tiles.max_x` | M5B | 200.0 | 20.0 to 2000.0; step 5.0 | 80 |
| `tiles.max_y` | M5B | 200.0 | 20.0 to 2000.0; step 5.0 | 80 |
| `tiles.seam_shift` | M5B | 5.0 | 0.0 to 30.0; step 0.5 | 0 |
| `tiles.seam_gap` | M5B | 0.0 | 0.0 to 1.0; step 0.05 | 0.4 |
| `tiles.seam_angle_deg` | M5B | 0.0 | 0.0 to 60.0; step 1.0 | 20 |
| `tiles.reinforce` | M5B | true | bool | false |
| `tiles.connector` | M5B | "hex" | hex, round | "round" |
| `tiles.connector_d` | M5B | "3" | 2.5, 3, 4, 5, 6 | "4" |
| `tiles.depth` | M5B | 10.0 | 4.0 to 20.0; step 0.5 | 8 |
| `tiles.clearance` | M5B | 0.2 | 0.0 to 0.6; step 0.05 | 0.4 |
| `tiles.segments` | M5B | 48.0 | 24.0 to 128.0; step 4.0 | 32 |
| `tiles.bridge_islands` | M5B | true | bool | false |
| `tiles.bridge_mm` | M5B | 1.6 | 0.4 to 6.0; step 0.1 | 2.4 |
| `tiles.bridges_per_island` | M5B | 1.0 | 1.0 to 4.0; step 1.0 | 2 |
| `tiles.raised_bridges` | M5B | true | bool | false |
| `tiles.z_bridging` | M5B | "easy" | easy, steps | "steps" |
| `fragments.keep` | M5B | 1.0 | 1.0 to 20.0; step 1.0 | 2 |
| `pads.pad_thread` | M5C | "M4" | none, M3, M4, M5, M6, M8, M10 | "none" |
| `pads.pad_height` | M5C | 4.0 | 1.0 to 20.0; step 0.5 | 6 |
| `pads.thread_clearance` | M5C | 0.2 | 0.0 to 0.6; step 0.05 | 0.35 |
| `pads.long_edge` | M5C | 300.0 | 0.0 to 2000.0; step 10.0 | 60 |
| `pads.mount_screw` | M5C | "M4" | none, M3, M4, M5, M6, M8, M10 | "M3" |
| `pads.mount_threaded` | M5C | false | bool | true |
| `pads.mount_clearance` | M5C | 0.4 | 0.0 to 1.5; step 0.05 | 0.6 |
| `pads.hole_spacing` | M5C | 120.0 | 0.0 to 1000.0; step 5.0 | 35 |
| `pads.joiner_offset` | M5C | 12.0 | 0.0 to 60.0; step 0.5 | 16 |
| `pads.extend` | M5C | 25.0 | 10.0 to 120.0; step 1.0 | 35 |
| `pads.segments` | M5C | 48.0 | 24.0 to 128.0; step 4.0 | 32 |
| `ring.width` | M5C | 40.0 | 20.0 to 400.0; step 1.0 | 40 |
| `ring.rings` | M5C | 1.0 | 1.0 to 5.0; step 1.0 | 2 |
| `ring.slab_length` | M5C | 200.0 | 40.0 to 1000.0; step 5.0 | 160 |
| `ring.gap` | M5C | 0.0 | 0.0 to 1.0; step 0.05 | 0.3 |
| `ring.joiner_thickness` | M5C | 4.0 | 2.0 to 12.0; step 0.5 | 5 |
| `ring.hardware` | M5C | true | bool | false |
| `ring.screw_length` | M5C | 0.0 | 0.0 to 120.0; step 1.0 | 20 |
| `ring.nut_clearance` | M5C | 0.2 | 0.0 to 0.6; step 0.05 | 0.35 |
| `ring.tip_taper` | M5C | 1.0 | 0.0 to 2.0; step 0.1 | 0.5 |
| `ring.tip_pitches` | M5C | 1.0 | 0.5 to 4.0; step 0.5 | 2 |
| `ring.number_parts` | M5C | true | bool | false |
| `ring.number_size` | M5C | 10.0 | 4.0 to 30.0; step 1.0 | 7 |
| `ring.pocket_depth` | M5C | 0.0 | 0.0 to 3.0; step 0.05 | 0.4 |
| `ring.wall_holes` | M5C | false | bool | false |
| `ring.hole_spacing` | M5C | 120.0 | 20.0 to 1000.0; step 5.0 | 35 |
| `ring.segments` | M5C | 48.0 | 24.0 to 128.0; step 4.0 | 32 |
| `hardware.extend` | M5C | 25.0 | 10.0 to 120.0; step 1.0 | 35 |
| `hardware.joiner_thickness` | M5C | 4.0 | 2.0 to 10.0; step 0.5 | 5 |
| `hardware.plate` | M5C | true | bool | false |
| `hardware.plate_distance` | M5C | 30.0 | 8.0 to 300.0; step 1.0 | 40 |
| `hardware.plate_height` | M5C | 4.0 | 1.0 to 20.0; step 0.5 | 5 |
| `hardware.plate_padding` | M5C | 3.0 | 1.0 to 20.0; step 0.5 | 5 |
| `hardware.plate_threaded` | M5C | false | bool | true |
| `hardware.plate_clearance` | M5C | 0.4 | 0.0 to 1.5; step 0.05 | 0.6 |
| `hardware.screw` | M5C | "M4" | M3, M4, M5, M6, M8, M10 | "M6" |
| `hardware.length` | M5C | 20.0 | 4.0 to 120.0; step 1.0 | 25 |
| `hardware.nut_clearance` | M5C | 0.2 | 0.0 to 0.6; step 0.05 | 0.35 |
| `hardware.tip_taper` | M5C | 1.0 | 0.0 to 2.0; step 0.1 | 0.5 |
| `hardware.tip_pitches` | M5C | 1.0 | 0.5 to 4.0; step 0.5 | 2 |
| `hardware.fit_test` | M5C | true | bool | true |
| `hardware.connector` | M5C | "hex" | hex, round | "round" |
| `hardware.connector_d` | M5C | "3" | 2.5, 3, 4, 5, 6 | "4" |
| `hardware.segments` | M5C | 48.0 | 24.0 to 128.0; step 4.0 | 32 |
| `export.max_x` | M5D | 0.0 | 0.0 to 2000.0; step 5.0 | 70 |
| `export.max_y` | M5D | 0.0 | 0.0 to 2000.0; step 5.0 | 70 |
| `export.seam_gap` | M5D | 0.0 | 0.0 to 1.0; step 0.05 | 0.3 |
| `export.connector` | M5D | "hex" | hex, round | "round" |
| `export.connector_d` | M5D | "3" | 2.5, 3, 4, 5, 6 | "4" |
| `export.depth` | M5D | 10.0 | 4.0 to 20.0; step 0.5 | 8 |
| `export.clearance` | M5D | 0.2 | 0.0 to 0.6; step 0.05 | 0.4 |
| `export.segments` | M5D | 48.0 | 24.0 to 128.0; step 4.0 | 32 |
| `export.pad_count` | M5D | 0.0 | 0.0 to 4.0; step 1.0 | 4 |
| `export.pad_thread` | M5D | "M8" | M3, M4, M5, M6, M8, M10 | "M6" |
| `export.pad_height` | M5D | 6.0 | 1.0 to 30.0; step 0.5 | 8 |
| `export.thread_clearance` | M5D | 0.2 | 0.0 to 0.6; step 0.05 | 0.35 |
| `export.mount_screw` | M5D | "none" | none, M3, M4, M5, M6, M8, M10 | "M3" |
| `export.mount_clearance` | M5D | 0.3 | 0.0 to 1.0; step 0.05 | 0.5 |
| `export.mount_threaded` | M5D | true | bool | true |
| `export.mount_offset` | M5D | 10.0 | 4.0 to 60.0; step 1.0 | 16 |
| `export.mount_extend` | M5D | 20.0 | 8.0 to 100.0; step 1.0 | 28 |
