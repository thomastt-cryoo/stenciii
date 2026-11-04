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

## Review packages

Windows x64, Apple Silicon and Intel review packages are being rebuilt from the
updated frontend. Each is checked using its extracted graphical launcher,
beginner/fine-preparation/manufacturing workflows, real exports, offline requests,
project reopen and shutdown. Mac checks additionally exercise genuine Safari.
Final source/run identities and file hashes are recorded here after collection.
