# Artwork parameter evidence

All 41 fields were edited through the actual All Settings controls, read back from the saved document, reset to runtime defaults, and executed by the real WebAssembly engine. Every suitable fixture changed its emitted PNG or SVG bytes. The tests retain original image maps. Runtime bounds/choices are also checked independently by model tests.

| Scoped field | Engine default | Allowed | Tested change | Output changed |
|---|---|---|---|---|
| `source.image_id` | "" | text | "two" | Yes |
| `source.resolution` | 1000.0 | 20.0–2000.0 | 300 | Yes |
| `text.text` | "STENCIL" | string | "AOBR\nAB" | Yes |
| `text.font` | "sans bold" | sans bold, serif bold | "serif bold" | Yes |
| `text.size` | 160.0 | 20.0–600.0 | 200 | Yes |
| `text.line_spacing` | 1.0 | 0.7–2.0 | 1.5 | Yes |
| `text.padding` | 20.0 | 0.0–200.0 | 45 | Yes |
| `transform.crop_left` | 0.0 | 0.0–90.0 | 12 | Yes |
| `transform.crop_top` | 0.0 | 0.0–90.0 | 10 | Yes |
| `transform.crop_right` | 0.0 | 0.0–90.0 | 17 | Yes |
| `transform.crop_bottom` | 0.0 | 0.0–90.0 | 15 | Yes |
| `transform.turn` | "0" | 0, 90, 180, 270 | "90" | Yes |
| `transform.angle` | 0.0 | -45.0–45.0 | 17 | Yes |
| `transform.flip_h` | false | bool | true | Yes |
| `transform.flip_v` | false | bool | true | Yes |
| `threshold.threshold` | 256.0 | 0.0–256.0 | 180 | Yes |
| `threshold.invert` | false | bool | true | Yes |
| `reduce.colours` | 3.0 | 2.0–10.0 | 5 | Yes |
| `reduce.smooth` | 0.0 | 0.0–6.0 | 2 | Yes |
| `smooth.radius` | 1.5 | 0.0–10.0 | 0.25 | Yes |
| `smooth.supersample` | 2.0 | 1.0–4.0 | 1 | Yes |
| `morphology.op` | "open" | erode, dilate, open, close, gradient, white_hat, black_hat, thin, skeleton, hit_or_miss | "dilate" | Yes |
| `morphology.kernel` | "disc" | square, disc, diamond, cross, line, ring | "square" | Yes |
| `morphology.radius` | 2.0 | 1.0–30.0 | 3 | Yes |
| `morphology.angle` | 0.0 | 0.0–179.0 | 45 | Yes |
| `morphology.iterations` | 1.0 | 0.0–10.0 | 2 | Yes |
| `morphology.pattern` | "endpoints" | isolated, endpoints, corners, junctions, custom | "isolated" | Yes |
| `morphology.custom` | "x00 011 x1x" | string | "111 111 111" | Yes |
| `morphology.rotate` | true | bool | false | Yes |
| `trace.smooth` | 1.5 | 0.0–8.0 | 0 | Yes |
| `trace.corner_deg` | 60.0 | 20.0–180.0 | 150 | Yes |
| `trace.tolerance` | 0.4 | 0.05–3.0 | 2.5 | Yes |
| `trace.min_area` | 4.0 | 0.0–1000.0 | 300 | Yes |
| `round_corners.max_angle` | 60.0 | 10.0–170.0 | 140 | Yes |
| `round_corners.radius` | 3.0 | 0.5–50.0 | 10 | Yes |
| `round_corners.round_concave` | false | bool | true | Yes |
| `remove_islands.delete_specks` | true | bool | false | Yes |
| `remove_islands.fill_holes` | true | bool | false | Yes |
| `remove_islands.max_area` | 50.0 | 1.0–100000.0 | 300 | Yes |
| `remove_islands.keep_largest` | 0.0 | 0.0–1000.0 | 1 | Yes |
| `shapes_to_mask.resolution` | 1000.0 | 20.0–4000.0 | 300 | Yes |

The first suitable field for each processor supplies the [before/after examples](examples/). These are preparation images/outlines, before physical bridge corrections. Complete hashes, dimensions and coverage are in [artwork-coverage.json](artwork-coverage.json).
