# M6 geometry investigation

## Remaining M5 invalid tile

The exact M5 ring uses the committed `docs/m5/fixtures/cli-seam-ring.svg`, a 160-pixel raster source, 140 mm width, 8 mm base thickness, 18 mm margin, 80 mm tile limits, 6 mm connector depth and 24 segments. At both 0° and 20° seam bevel, `stencil_r1c2.stl` has four collinear facets after the M5 cleanup. The exact invalid stored files are retained in this milestone's fixtures.

The facets connect two different subdivisions of the same line. For example, at y=6 and z=8.199999809265137 mm, the boundary has x positions approximately 24.4, 24.95049, 43.66337 and 44.4. Simply deleting the facets leaves unsplit edges. Collapsing a point can change an incident corner, so M5 correctly refused that repair.

The Rust repair first retains the already checked M5 collapse path. When that cannot preserve the surface, it partitions neighbouring nonzero triangles at the existing collinear boundary vertices. This gives both sides the same edge subdivisions. No vertex moves or new coordinate approximation is introduced. The trial must retain face orientation and area, closed directed edges, components, Euler characteristic, bounds and volume, and have no degenerate facets. Failed trials remain errors; the independent export validator is unchanged. Both post-solid and tile-first processing call this checked geometry routine and disclose any cleanup in their output metadata.

The exact two stored cases retain every vertex, triangle count, bounds and volume and become independently valid. A permanent integration test runs 40 actual ring configurations over legacy/post-solid, raster/vector tile-first and vector cut-whole routes, including narrower margins, dimensions, bevel angles, connector shapes/sizes, clearances, ordinary/raised/stepped bridges and gaps. The native matrix's **200 actual STL files independently validate**. Rebuilt single-thread and four-thread WASM verification passes for 35 applicable cases: 350 native/ST/MT file comparisons have equal exact oriented triangles, 346 are byte-identical, and all files validate. Five additional native legacy bevel executions exercise a CLI-only setting. Tile-first has no seam-bevel parameter; the report does not imply that it does.

## M5 discrepancy classification

The original 87 affected fixtures contain 265 differing file comparisons (125 distinct raw file pairs). Every original pair is compared using its actual stored float32 coordinates, preserving orientation.

- **263 file comparisons are B:** exactly the same oriented physical surface with different triangulation. The proof converts coordinates to integers on the exact float32 lattice, groups residual triangles by exact oriented plane, and compares oriented boundary interval chains. It uses no spatial rounding, welding or volume proxy.
- **Two comparisons are C:** one `ring_1_corner_bl.stl` in `ring-rings-after`, comparing ST to MT and ST to native. All original vertices match, but different diagonals on slightly nonplanar faces make the surfaces numerically different. Exact rational polygon overlays prove complete bidirectional surface coverage, including face interiors. The certified Hausdorff upper bound is **17251/78331510784 mm**, approximately **0.000000220231 mm**. This is more than 450 times smaller than the 0.0001 mm polygon grid and is below the relevant float32 representation scale. No physical printer tolerance is inferred.
- There are no A-only, D or unresolved E cases among these recorded M5 discrepancies after the geometric proofs. This classifies this measured corpus, not every possible input.

The Boolean dependency's face assembly, planar triangulation and diagonal choices explain the observed tessellation changes. Its triangulation selects loop starts from vertex/halfedge identities and chooses between valid diagonals; native and threaded paths also use parallel face/halfedge processing. Float32 storage makes some nominally planar patches slightly nonplanar, so changing diagonals can yield the measured tiny C difference. The boundary/surface proofs establish what changed in each actual file. They do not prove one unique scheduling or rounding trigger for every original comparison. No dependency code or correct geometry is changed to force byte equality.

Structural validity, physical-surface equivalence, exact triangle equivalence and file-byte equivalence remain separate recorded properties. The original M5 structural audits are retained. The comparison algorithms also have permanent tests for reordered triangles, alternate planar diagonals, nonplanar same-vertex surfaces, material displacement, missing faces and reversed winding.

See `m5-discrepancy-classification.json`, the retained original STL evidence and the comparison scripts in `scripts/m6/`. Fresh M6 results are retained in `all-control-parity.json`, `current-engine-classification.json`, `tile-mode-validation.json` and the compact `parity-summary.json`. All B/C proofs replay from the committed full-byte archives using `scripts/m6/verify_retained_parity.py`. The final gate is recorded in `../M6_REPORT.md`.

## Stored-normal serialization repair

The expanded audit found two opposed stored normals in the actual vector-stencil margin fixture. Its nearly collinear f64 triangle had the opposite cross-product sign after its positions rounded to stored float32. The STL encoder now computes its normal from those stored positions. It does not move a vertex, reorder a triangle, filter a surface or relax an audit tolerance. The retained before/after files have exactly the same oriented triangles and physical surface; opposed normals fall from two to zero. A permanent integration test isolates the rounding case. Both WASM engines were rebuilt after this change. See `normal-repair-validation.json` and the original project/invalid-normal fixture.

## Structural validity and export eligibility

Turning `tiles.bridge_islands` off intentionally leaves two closed bodies in the retained tile-island fixture. That is a negative manufacturing case, even though its binary STL is structurally closed. Ordinary export, the complete manufacturing ZIP and local batch all reject it; restoring tile-island bridging restores a complete export. The measured browser proof is `disconnected-guard-validation.json`. Alignment pins and explicitly retained fragments have their own intentional component semantics. No disconnected required tile is silently omitted or published as a complete package.
