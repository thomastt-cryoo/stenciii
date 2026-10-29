# M5 — manufacturing implementation and verification

M5A–M5D are implemented in the existing local engine and node-free editor. The measured parameter total is **217/217 unique qualified slots across 24 processing types**: the earlier 89 plus 128 in M5. These are functioning controls with real engine execution, applicable constraints, reset and saved-project reopening evidence. M6 has not been started.

Manufacturing readiness remains limited by certain complex tiled meshes and by broader cross-engine triangle differences described below. Invalid meshes remain blocked from complete export. This milestone does not certify every possible model or physical printer fit.

## Published implementation

The approved M4 base is [`9c1992ebd761cc006585a9f5ae3e23f387ddc3ea`](https://github.com/thomastt-cryoo/stenciii/commit/9c1992ebd761cc006585a9f5ae3e23f387ddc3ea). The exact published implementation commits, in order, are:

| Work | GitHub commit | Result |
|---|---|---|
| M5A | [`b520a6fa172259a3034128afcc01b29386b8d4c8`](https://github.com/thomastt-cryoo/stenciii/commit/b520a6fa172259a3034128afcc01b29386b8d4c8) | Colour reduction/separation, ten masks, eight tone override groups, registration and pins; 38 fields |
| M5B | [`2de1589c0ccde9753ebf772f8af280a39385fac5`](https://github.com/thomastt-cryoo/stenciii/commit/2de1589c0ccde9753ebf772f8af280a39385fac5) | Tile-first and post-solid strategies, editable seams/pockets, fragments, assembled/exploded inspection; 29 fields |
| M5C | [`6d044d9c06e73641028cf3dbe3297f17db4aca5e`](https://github.com/thomastt-cryoo/stenciii/commit/6d044d9c06e73641028cf3dbe3297f17db4aca5e) | Pads, mounting holes/threads, expanded borders, numbered slabs, screws, nuts and calibration strips; 44 fields |
| M5D | [`54f64ccff0963902429f0e6e1a44180c9133832b`](https://github.com/thomastt-cryoo/stenciii/commit/54f64ccff0963902429f0e6e1a44180c9133832b) | Legacy export controls, complete collection/ZIP/manifests, local batches and engine repairs; 17 fields |
| Verification corrections | [`5ea4573d032e6aa75144e60ccd9097825bd5317d`](https://github.com/thomastt-cryoo/stenciii/commit/5ea4573d032e6aa75144e60ccd9097825bd5317d) | Keep operation labels discoverable after renaming; validate actual STL entries alongside package JSON; shared-branch export regression |
| Accepted source | [`001f3d6d79167d83d366c16bf9a187da4e140fd4`](https://github.com/thomastt-cryoo/stenciii/commit/001f3d6d79167d83d366c16bf9a187da4e140fd4) | Compare cached Part bytes instead of clock-dependent ZIP timestamps in the CLI regression |

Historical checkpoints are in [WORK_LOG.md](WORK_LOG.md). Their pending items are superseded by this report and the accepted final evidence.

## Controls and workflow

The [full human-readable matrix](PARAMETER_COVERAGE.md) lists all 217 qualified names and their evidence. The [machine-readable matrix](parameter-coverage-217.json) includes the original catalogue constraints, values, output checks and retained project references. There are no duplicate keys or extra counted execution-only flags.

Colour guides append real processing passes while retaining the input bytes and saved graph. Tests produce two through ten masks. Registration accepts at most six solids per operation: the ten-layer example contains explicit groups of six and four, with their own editable registration settings. Equal and unequal dimensions, hole-margin refusals, alignment pins, naming and visibility are exercised. Default tone spacing zero produces solid intermediate paint; per-tone zero inherits the default. Absent intermediate groups are disabled.

Both tiling strategies use the original processing routines. Manual layout edits use actual layout metadata and PNGs. Tests cover numeric edits, Enter, dragging seams and connector pockets, rejected positions and reasons, saved offsets, undo/reopen, and unknown metadata. Assembly views show real STL files with declared placement, bounds, visibility, exploded sections and current-generation download guards.

Mounting guides create compatible ancestry for holes, pads, threaded holes, joiners and extenders. Borders generate actual slabs, numbers, connectors, bolts and nuts. Dense hardware checks cover M3, M4, M5, M6, M8 and M10, including 128-segment M10 hardware and both 128-segment calibration shapes. See [hardware-size-and-detail.json](hardware-size-and-detail.json).

Complete export gathers selected terminal assemblies and their required upstream plates. It audits every printable file, prevents filename collisions, records shared files once with requested-path aliases, and includes the saved project, quantities, dimensions, layout PNG and traced SVG when selected. Invalid, stale, draft or failed required results block completion. The selected Solid STL export remains available. Batch processing freezes a saved recipe, replaces one embedded asset, processes images sequentially in a separate worker, isolates failures and collects independently checked output.

## Actual examples and independent validation

| Example | Reviewable files |
|---|---|
| Ten registered colours, grouped six/four | [Project](examples/ten-colour-project.json), [complete ZIP](exports/ten-registered-colours.zip), [mask counts](colour-mask-counts.json) |
| Tone patterns | [Pattern mask](examples/tone_patterns-kind-after.png), [rotated mask](examples/tone_patterns-angle-after.png), [spacing mask](examples/tone_patterns-spacing_mm-after.png), matching before/after projects in [fixtures](fixtures) |
| Manual layout | [Saved project](examples/manual-layout-project.json), [edit/rejection evidence](b-layout-validation.json), [screenshot](screenshots/b01-manual-layout-light.png) |
| Mounting, borders and auxiliary hardware | [Project](examples/mounted-border-hardware-project.json), [complete ZIP](exports/mounted-border-hardware.zip), [manifest and extracted geometry audit](exports/mounted-border-hardware-manifest.json) |
| Shared upstream branches with colliding names/IDs | [Project](examples/shared-branches-project.json), [complete ZIP](exports/shared-branches.zip), [manifest and geometry audit](exports/shared-branches-manifest.json) |
| Local batch, with an isolated failed input | [Collection ZIP](exports/local-batch.zip), [summary](exports/batch-summary.json) |
| Tile-first 640 / 900 mm | [640 mm project](examples/before-640.json), [ZIP](examples/before-640.zip); [900 mm project](examples/before-900.json), [ZIP](examples/before-900.zip) |
| Post-solid 640 / 900 mm | [640 mm project](examples/after-640.json), [ZIP](examples/after-640.zip); [900 mm project](examples/after-900.json), [ZIP](examples/after-900.zip) |

The independent Python reader checks stored coordinates, finite values, zero-area faces, two-face edge sharing, edge winding, signed volume, connected components and physical bounds. ZIP checks independently verify CRCs and extracted files; complete-package manifests include SHA-256 and copy counts. JSON/SVG/PNG entries are checked as their own formats and are not mistaken for meshes. The shared-branch example keeps common tiles once and a separate freestanding assembly, and preserves the exact original project.

## Geometry repairs and parity

**Calibration strip:** the old 3 mm hex fixture contained 24 degenerate faces. Overlapping dimple cutter operands were repaired by subtracting them sequentially. The repaired strip has 1,514 faces and zero degenerate faces; bounds and fit dimensions are preserved. The volume changes by approximately 0.055793 mm³ because the overlapping cuts now form the intended union. The original invalid bytes remain in [fit-test-before-m5.stl](fixtures/fit-test-before-m5.stl). The strict 44-field C replay and dense calibration checks accept no invalid Part. Physical printer fit has not been measured.

**Clearance units:** ordinary and threaded mounting-hole clearance now consistently means added diameter; ThreadPad/nut clearance remains radial. Native tests measure the actual resulting hole dimensions.

**Direct CLI seam bevel:** `--seam-angle` was being discarded by legacy catalogue cleanup. A validated execution-only setter now carries 0–60 degrees into the tiler/cache without inventing a 218th catalogue slot. This is bevel away from vertical. Direct 0° and 20° runs generate different independently valid tile geometry: [evidence](cli-seam-angle.json), [0° ZIP](examples/cli-angle-0.zip), [20° ZIP](examples/cli-angle-20.zip). Modern saved Tiles settings retain their meaning.

**Exact M4 Spread discrepancy:** the original fixture produced 3,148 native versus 3,132 WASM triangles. The first divergence was an equal-length diagonal candidate tie affected by platform floating point rounding. Deterministic length/endpoint ordering at 1e-9 mm resolves the tie, well below the 0.0001 mm polygon grid. The repaired native/ST/MT outputs all contain **3,152 triangles and 9,490.669796050599 mm³**, with identical routes and independently compared oriented triangles. See [before](spread-before-investigation.json), [after](spread-after-investigation.json), [independent comparison](spread-independent-comparison.json) and the three retained repaired STL fixtures.

**Broader manufacturing replay:** [manufacturing-modes.json](manufacturing-modes.json) records all 256 before/after fixtures, real single-thread/four-thread engine identities, SHA-256, native CLI results, topology validation and separate exact-geometry flags. All 191 successful Parts fixtures validate in all three engines; all 64 bitmap fixtures match in ST/MT, and the remaining fixture preserves its expected no-room refusal. Exact oriented triangles differ in **43 ST/MT** and **83 native/ST** leaf comparisons, across 87 distinct fixtures. Every measured bound matches; the largest absolute volume delta is about 5.1e-11 mm³. Matching validity, bounds or volume does not establish identical triangle coordinates. [ENGINE_PARITY.md](ENGINE_PARITY.md) lists every affected fixture and [final-results.json](final-results.json) records the per-file differences. Exact universal native/ST/MT equivalence is not claimed.

**Remaining tiled-mesh defect:** conservative local collinear-edge cleanup accepts only changes preserving incident planes, winding, topology, used bounds and volume. Some narrow raster layouts remain unrepaired. An additional ring probe still has four degenerate faces in `stencil_r1c2.stl` at both measured seam angles. The two other affected tiles are repaired; the remaining invalid tile stays visible and blocks complete export. This is an outstanding manufacturing release limitation.

## Verification

- Native Windows Rust workspace: **167 passed** (153 core, 13 CLI, one findings-parity test); fresh ST and MT WASM builds succeeded.
- Linux GitHub CI on accepted source: **167 Rust tests and all 176 browser tests passed**. Production assets and the embedded Linux binary build also passed. [Run](https://github.com/thomastt-cryoo/stenciii/actions/runs/40935283394), [job results](github-ci.json), [logs](logs).
- The optional GitHub Pages deployment failed with HTTP 404 because Pages is not enabled for this repository. This is a hosting configuration failure; the workflow as a whole is not green. No public deployment is claimed.
- Full Windows browser run: 173 passed and two failed; both failures were corrected. The subsequent targeted run passed all 15 tests, including the new branch check. Together these cover 176 unique tests. The unchanged full final suite is accepted by the Linux run above. Original failure and correction logs are retained honestly.
- Strict field runs: A38, B29, C44 and D17 passed; the collector verifies these 128 plus 89 replayed earlier fields against the unchanged 217-key catalogue. The original 107 pinned files pass preservation audit.
- The native input/style corpus contains 48 cases: 46 valid independently checked outputs and two expected blank-input refusals. See [corpus-results.json](corpus-results.json).
- The separate customer-only production run passed **all 91 tests in 9.3 minutes**. The Windows binary built successfully; its server matches all **18 production asset hashes**, returns the required COOP/COEP headers, and returns 404 for test/reference entry points. Exact results are in [final-results.json](final-results.json), [production-manifest.json](production-manifest.json) and [packaging.json](packaging.json). Its build label accurately shows the accepted source with `+dirty` because verification-only documentation/scripts were pending; no unpublished engine or app source changes were included.
- Offline tests block outside network requests and complete local processing/export and local batches. All runtime assets are local. A fresh-machine offline installation was not tested.
- Light/dark accessibility scans report no violations in the measured screens: [manufacturing-accessibility.json](manufacturing-accessibility.json). Keyboard controls, laptop/narrow layouts and the node-free customer screen are covered by the browser tests.
- Dependency audit: zero reported vulnerabilities. See [npm-audit.json](logs/npm-audit.json).

Actual screenshots: [colour/light](screenshots/a01-colour-analysis-light.png), [registered plate/dark](screenshots/a02-registered-plate-dark.png), [manual layout/light](screenshots/b01-manual-layout-light.png), [exploded sections/dark](screenshots/b02-exploded-sections-dark.png), [mounting/light](screenshots/c01-mounting-assembly-light.png), [border/dark](screenshots/c02-expanded-border-dark.png), [hardware/dark](screenshots/c03-real-hardware-dark.png), [export/light](screenshots/d02-export-light.png), [export/dark](screenshots/d02-export-dark.png), [narrow export](screenshots/d03-export-narrow.png).

## Performance and exact remaining M6 scope

The four measured large examples produce 12 tiles at 640 mm and 20 tiles at 900 mm, plus their real connector files. All validate. Four-thread engine startup/processing/serialization takes approximately **228–426 ms** in this Windows session; independent Python validation is outside that timing. ZIPs range from 250,047 to 502,355 bytes. These are simple vector-grid examples, not worst-case raster performance. [Measurements](large-assembly-performance.json).

The browser limits an STL audit to two million triangles, ZIP collection to 256 MB, and local batches to 20 images/128 MB combined input with 64 MB per image. Dense hardware takes materially longer than the simple grid examples. Peak process memory was not instrumented, so no measured peak-RAM or arbitrary-size claim is made. Workers, cancellation, generation checks, retained verified previews and stale export prevention remain in place.

M6 should address the remaining collinear tiled cases without weakening geometry checks; investigate the explicitly recorded broader native/ST/MT differences; add folder discovery, unattended batch jobs and parameter-sweep editing if full browser/CLI batch parity is wanted; and perform physical printer/fit trials, fresh-machine offline installation and additional desktop/browser platform validation. GitHub Pages requires repository configuration if public hosting is desired. Browser batches currently replace one chosen source asset in a frozen recipe; the original CLI batch and sweep capabilities are retained.

The complete current limits are in [KNOWN_LIMITS.md](KNOWN_LIMITS.md). No M6 implementation is included.
