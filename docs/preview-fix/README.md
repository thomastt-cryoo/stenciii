# Faithful live previews and fine artwork defaults

Requested on 11 November 2026 after the tiger recording and the customer's
instruction to use the tested settings by default in all three browser builds.

The previous interactive draft reduced a 1000 px image to 200 px and mesh detail
from 6 to 2. The tiger had 28 traced loops in that draft and 50 at full quality.
At the recorded manual threshold of 128, shaded orange areas created small
regions around the eyes and cheeks. Several became extra material islands and
automatic bridge routes in the finished stencil.

Draft execution now keeps source resolution, mask supersampling, text sizing,
shape rasterization and curve precision. Later stepped bridge and remesh passes
can still use explicitly marked manufacturing drafts. The customer's ordinary
image-to-stencil workflow produces identical draft and final STL bytes.
The Detail control scales vector cleanup area with image area and preserves a
finer custom source when Fine is selected. The sidebar shows working resolution
and explains manual threshold selection.

New image projects start in Standard with a 1400 px source, mesh detail 6,
threshold 110, trace smoothing 1.25 px, corner angle 60 degrees, tolerance
0.35 px and minimum traced area 2 px². Speck and pinhole cleanup is enabled at
64 px². These are the settings measured on the tiger. Smooth Vector and Crisp
Raster remain selectable styles with their own preparation. Saved project files
are authoritative. Start a new project or open the provided clean tiger project
to use the new setup for previous artwork.

The clean tiger STL has 45,792 triangles, one component, consistent winding and
zero open edges or degenerate triangles. The 200 × 200 × 5.2 mm dimensions and
original embedded image are retained. A fresh upload through the extracted
Windows package produced the same SHA-256 for its interactive draft and final
export. See [tiger preview proof](tiger-preview-proof.json) and
[independent mesh inspection](tiger-mesh.json).

Nine focused browser/model checks cover defaults, live slider cancellation and
settling, proportional cleanup, custom detail, styles, valid exports, undo/redo,
project reopen and the left settings panel. One initial browser attempt overlapped
an asset rebuild and lost the workspace. Its repeat passed against stable files.
The other eight checks passed. See [style mesh checks](browser-meshes.json) and
[live run measurements](live-performance.json).

The production frontend build and TypeScript check passed. Both reused local
WASM binaries match the accepted [M6 provenance](../m6/source-provenance.json)
and its complete control checks. Later CI rebuilds of the same engine source
have different binary hashes. Native packages embed the same frontend
tarball identified in [production assets](production-assets.json).
The package records and delivery manifest retain exact ZIP hashes, tested
defaults, browser versions and the relevant packaged workflow results. Mac
execution checks use hosted macOS runners.
