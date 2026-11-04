# Detailed artwork and docked settings update

Requested 4 November 2026, following customer tiger, cat and typography recordings.
This is a targeted product update after M8; it does not publish a listing or
change the outstanding first-download/security release decision.

## Findings and changes

The supplied tiger PNG reproduced the customer's Smooth Vector STL **byte for
byte** (2,161,484 bytes). Small isolated marks and pinholes were already present
in the thresholded paint. Thin contours were also being softened by a 700 px
working image, mask smoothing/supersampling and curve smoothing. Physical bridges
account for some of the visible interruptions and are still needed to keep
material connected.

New **Detailed artwork > Preserve fine detail** prepares a simple image/vector
recipe at at least 1400 px, with gentler mask/outline smoothing and finer mesh
curve detail. It enables size-based speck/pinhole cleanup while retaining the
original artwork, threshold choice, print dimensions and bridge settings. This
is one undoable command. **Remove tiny marks** and **Cleanup area** expose the
ordinary saved cleanup parameters for adjustment. The cutoff uses square pixels
at the trace input resolution, including any saved supersampling.

For the actual tiger, the prepared outline has 39 loops instead of 49, with
ten intentional whisker spots checked and retained. The 46,364-triangle STL is
one closed, oriented component with zero degenerate faces or unmatched edges;
dimensions remain 200 x 200 x 5.2 mm. See [validation](tiger-validation.json) and
the actual before/after [whisker](whiskers-comparison.png) and
[eye/cheek](eye-and-cheek-comparison.png) crops. These show traced geometry before
physical bridges; they are not a claim that the input's shading can be perfectly
reconstructed from a binary stencil.

The preparation is opt-in. Ordinary style defaults, engine algorithms and the
existing raster/text/manufacturing workflows are preserved. Aggressive cleanup
can erase intentional dots, punctuation and letter counters: lower the area or
turn it off and compare before exporting. The generator cannot infer intent from
every shaded or textured pixel. Existing pixel morphology is kept intact when
adding the vector cleanup step. Custom/branched workflows are guarded rather
than rebuilt as simple recipes.

**All Settings** is now a nonmodal panel in the left workspace column. The canvas
remains available for zooming, rotating and selecting preview stages. Search,
all 217 settings, processing tools and close/Escape keyboard behavior remain.
Categories wrap into a scrollable two-column navigation area. On intermediate
screens Quick Adjustments moves below the preview; on small screens the panel
stacks above the canvas rather than covering it.

## Validation

The production frontend build and TypeScript checks passed. An initial focused
18-case run passed generation, offline processing, accessibility, project
round-trips, text/CLI replay, processing-step edits, crop/rotation, branched
imports, long artwork chains, software 3D and healthy WebGL rendering. The new
tests cover preset undo/redo, exact artwork and dimension retention, actual STL
validation, saved-project reopen, guarded custom workflows, missing cleanup-step
insertion and left-panel/canvas geometry down to 390 px.

The final small guard change additionally preserves a pre-existing morphology
operation when adding cleanup. Its focused test and the final responsive/theme
checks passed: three strengthened preparation/style checks and six light/dark
accessibility checks at 1366, 1024 and 390 px, with zero Axe violations.
There are 25 distinct browser checks across these focused runs; see the
[record](local-checks.json). Keyboard close returns focus to the actual opener,
including a canvas control when Settings was opened with Ctrl/Cmd+K.
Existing core/WASM
source is unchanged. No change to the Intel Safari software-renderer repair is
included. Previous M8 packages and their hashes are retained separately.

Customer examples are saved locally under `distribution/detail-update/examples/`:
`Tiger-fine-detail.stencil.json` embeds the original artwork and all generation
settings; `Tiger-fine-detail.stl` is the actual verified export. The saved recipe
also opens in the previous M7/M8 engine, because the update uses ordinary engine
parameters, without a new file format or engine operation.
This was exercised against the actual previous Windows customer package: opening
the new project reproduced the 2,318,284-byte improved STL byte for byte and
shutdown passed. [Previous-package parity](previous-package-parity.json).

## Review packages

Two updated review packages are saved in `distribution/detail-update/customer/`.
The [manifest](../../distribution/detail-update/delivery-manifest.json) records
exact source identities, sizes and SHA-256 values. Both archives passed CRC/hash
checks and are below 20,000,000 bytes. The previous five M8 delivery files retain
all of their original hashes; their first-download/security restrictions remain.

| Updated package | Bytes | SHA-256 |
|---|---:|---|
| Windows x64 | 8,266,183 | `e179261326cc8b3101f5d022f726d4459582211cf2e63b8f2b276a3d8823e6b1` |
| Intel Mac | 8,249,303 | `335d23d76c697f3d88ac9fb3bc3984b859578d157efcf9aa1ba1de87934f3d36` |

**Windows:** exact ZIP source `bf8278fa9beac101b7ec21b7fdd89a1379f3ebca`
passed all five customer workflows locally on Windows 11 Home 10.0.26300,
installed Chrome 151.0.7922.72: beginner creation, fine preparation/docked
settings, colours, tiling and mounting/hardware. Actual STL/ZIP exports, offline
processing, lossless project reopen and shutdown passed. All 17 hosted host
checks also passed. The CI job initially stopped when its independent Python
comparison exceeded the harness's 180-second limit; that retained tiled export
passed locally in 6.12 seconds, followed by the complete exact-package local
collection. This is not relabeled as a passing CI job.
[Package checks](windows-package-checks.json),
[tiled-export proof](windows-tiled-export.json), [host](windows-host-checks.json).
The independent proof harness now allows 600 seconds with every validity and
exact-equivalence assertion retained. That harness adjustment needs no executable
rebuild and is not presented as an executed CI retry.

**Intel Mac:** source `a6c35ddff3fe86675e0981e9e8747af6e63f433a`, using
verified frontend assets from source `bf8278fa9beac101b7ec21b7fdd89a1379f3ebca`,
passed all five packaged workflows in Chrome 151.0.7922.174, all 17 host checks
and genuine Safari 26.6 software rendering on macOS 15.7.9. Safari checked
actual camera/orbit/wireframe/cutaway pixels, exports, persistence and shutdown.
[Package checks](intel-package-checks.json), [host](intel-host-checks.json),
[Safari](intel-safari-checks.json). Collection run: `41895409626`.

**Apple Silicon updated download remains pending:** both hosted attempts were
cancelled while queued, before a runner was assigned. No new ARM binary or native
qualification is claimed. The accepted M8 ARM ZIP is kept unchanged. The shared
source implementation and ordinary fine-detail saved recipe are available, but
an updated ARM package still needs a native build/spot check when capacity is
available. This is a distribution limit, not an observed application defect.
The user's pre-existing deleted historical log files were left untouched.
