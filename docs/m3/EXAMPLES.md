# Actual before/after preparation results

These files were emitted by the Rust engine through WebAssembly. They show artwork before physical stencil bridges. Each row uses a suitable focused fixture; it is not a comparison of one universal recipe.

| Operation and change | Before | After |
|---|---|---|
| `source.image_id` → "two" | ![Before](examples/source-before.png) | ![After](examples/source-after.png) |
| `text.text` → "AOBR\nAB" | ![Before](examples/text-before.png) | ![After](examples/text-after.png) |
| `transform.crop_left` → 12 | ![Before](examples/transform-before.png) | ![After](examples/transform-after.png) |
| `threshold.threshold` → 180 | ![Before](examples/threshold-before.png) | ![After](examples/threshold-after.png) |
| `reduce.colours` → 5 | ![Before](examples/reduce-before.png) | ![After](examples/reduce-after.png) |
| `smooth.radius` → 0.25 | ![Before](examples/smooth-before.png) | ![After](examples/smooth-after.png) |
| `morphology.op` → "dilate" | ![Before](examples/morphology-before.png) | ![After](examples/morphology-after.png) |
| `trace.smooth` → 0 | ![Before](examples/trace-before.svg) | ![After](examples/trace-after.svg) |
| `round_corners.max_angle` → 140 | ![Before](examples/round_corners-before.svg) | ![After](examples/round_corners-after.svg) |
| `remove_islands.delete_specks` → false | ![Before](examples/remove_islands-before.svg) | ![After](examples/remove_islands-after.svg) |
| `shapes_to_mask.resolution` → 300 | ![Before](examples/shapes_to_mask-before.png) | ![After](examples/shapes_to_mask-after.png) |

## Openable demonstrations

Download [text-project.json](examples/text-project.json) or [long-chain-project.json](examples/long-chain-project.json), then choose Open Project in Stencil Studio. The complete saved preparation is retained. The text demo also has an independently validated [STL](examples/text-stencil.stl) and [pre-bridge traced SVG](examples/text-outlines.svg).
