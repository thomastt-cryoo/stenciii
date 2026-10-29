# M4 — Stencil geometry, bridges, mesh optimization and 3D inspection

29 October 2026, Asia/Dubai. **M4 only. M5 has not begun.**

Implementation: [`893a88d5aeab06369a84d9e97f285890880d1a82`](https://github.com/thomastt-cryoo/stenciii/commit/893a88d5aeab06369a84d9e97f285890880d1a82). Its tree `cf05fd9cb9688291c7f334fcd7c6b9422696d10d` exactly matches the tested local source. The following documentation commit contains this report, fixtures, measurements, logs and screenshots; its exact SHA is supplied in the completion message. Approved M3 base: `6191ce7cd4476a0c45ed9f2c0047fa8fa1e2d1cf`. M0–M3 evidence remains unchanged.

## What is complete

The ordinary workflow remains upload → Make Stencil → customize → preview → export. Quick Adjustments stays small. The advanced controls are grouped inside All Settings, with a saved-operation selector, help, actual defaults, numeric alternatives, undo/redo and conditional availability. There is no customer node canvas or wiring diagram.

| Geometry family | Qualified controls | Previously editable | Newly editable |
|---|---:|---:|---:|
| Raster stencil | 19 | 8 | 11 |
| Vector stencil | 21 | 9 | 12 |
| Remesh | 8 | 0 | 8 |
| **Geometry total** | **48** | **17 reused** | **31 new** |

Together with the 41 artwork controls, the customer app now has **89 unique editable type-qualified settings**. Repeated operation instances do not inflate the count. The original registry retains **24 types and 217 qualified fields**; the remainder belongs to the specialist manufacturing scope.

The [31 newly editable fields](m4/NEW_PARAMETERS.md) and [complete 48-field table](m4/PARAMETER_COVERAGE.md) identify exact defaults, limits, increments and tested changes. Every field was edited through the actual UI, read back from saved JSON, reset to the runtime default and executed on a suitable real-engine fixture. Conditional tile method uses a compatible saved tiled project; reinforcement/taper, raised-Z and decimation fields have their prerequisites enabled.

**47 settings change output geometry or an applicable computed diagnostic.** The remaining setting, `remesh.max_overhang_deg`, is a safety constraint: active reconstruction from 119,048 to 7,326 triangles satisfies both tested 10° and 85° limits with zero reported added-overhang violation and identical output. The test checks that reconstruction really ran, has nonzero measured deviation, and complies at both limits. It does not manufacture a byte change or count a saved value as a diagnostic. [All measurements and project paths](m4/geometry-coverage.json).

## Bridges and physical construction

Bridge placement exposes width, requested count, Closest/Spread, angular separation, reach multiplier, generation passes and small-island deletion. Closest favours shorter routes; Spread seeks separated directions and may use longer routes. The engine can relax separation to support crowded islands. Requested counts can exceed what fits. No universal bridge-disable switch or manual bridge dragging is invented.

Source-vector diagnostics now distinguish **generated bridge strips** from material coverage. Overlapping strips can merge, so the strip count is not promised as a count of independent visible supports. Raster diagnostics report bridge-material pixels and the quantized base strip width. The actual STL and Compare/3D views show supports, including those absent at the bottom of a raised model. SVG remains traced artwork **before bridge corrections**.

| Suitable vector fixture | Actual observed result |
|---|---|
| Closest → Spread | 3,072 → 3,136 triangles; volume 9,357.275 → 9,453.468 mm³; both closed connected solids |
| Requested bridges per island 3 → 1 | Generated strips 16 → 6; 3,136 → 2,756 triangles |
| Bridge width 1.2 → 2.5 mm | 3,136 → 3,156 triangles; increased material volume |
| Raised → ordinary bridges | 3,136 → 2,620 triangles; overhang diagnostic 278.38 → 0 mm² |
| Easy → Steps Z construction | 3,136 → 4,988 triangles; different layered support geometry |

Rust investigation found that raster `bridge_passes` was being ignored: a hard-coded four-tier fallback was used regardless of the saved parameter. It now uses the requested one-to-eight spread-search levels. Four retains the original default; Closest is unaffected. The focused raster ring changes from 1,324 to 1,340 triangles with four versus one pass. A native regression verifies connected watertight output and unchanged Closest behavior.

Vector `max_overhang_deg` previously always reported zero. It now measures actual extruded layer sections using the same angle-from-vertical convention, accounts for flipping and treats zero as 45°. This is a diagnostic; changing 45° to 85° retains byte-identical STL while the measured area changes from 278.38 to 175.77 mm². Native tests verify this and the zero/default behavior.

Base thickness and final height are distinct. With 2.4 mm base, 0.2 mm layers and one extra top layer, the actual final height is 2.6 mm. Changing the base to 3.4 mm gives 3.6 mm final height; changing layer height to 0.3 mm gives 2.7 mm; four extra top layers give 3.2 mm. Raster and vector bounds are independently checked. Width 140 mm produces an actual 140 mm outer width; artwork aspect ratio and margins determine height.

Contact and first-layer reinforcement are measured using material volume, rather than expecting a different triangle count for every change. In the vector fixture, minimum contact 2.5 mm increases volume from 9,453.468 to 9,558.118 mm³. First-layer minimum width 2.5 mm increases it to 9,471.581 mm³. A reinforced taper of 0.4 → 1.6 mm increases volume 9,461.808 → 9,479.164 mm³. Both raster and vector tests assert real added material. With reinforcement enabled, taper must be positive and no larger than requested base thickness; invalid combinations produce a specific engine error and cannot release a stale model.

Separate first-layer areas are reported honestly: raised supports can join them above the bed. The completed solid is checked for connectivity independently; an intentionally separate first layer alone does not block a connected final mesh.

## Optional mesh optimization

Mesh Optimization adds the original Remesh operation to a compatible solid. It starts off. All eight fields are available: first/last reconstruction layer (zero last means top), outline tolerance, smoothing, material preservation, additional overhang limit, decimation and its deviation tolerance. The source print-layer interval is retained. Existing source overhangs are not erased by the remesh limit.

Add/disable/restore are reversible. Disabled steps keep original settings, IDs and connections. Shared compatible consumers are rewired deliberately; unrelated branches remain intact. Tiled builders and manufacturing Parts cannot feed a single-solid optimizer. An incompatible selection explains why instead of silently flattening or discarding its output.

The engine can reduce tolerance, retain unsafe original outlines, or simplify only flat faces. Reported layer-reconstruction and final triangle counts, maximum deviation and fallback reason stay visible. A retained source is not called a successful reconstructed outline.

| Actual example | Measured result |
|---|---|
| Reconstruction, 0.2 mm outline tolerance | Source 3,444 → 1,780 triangles; reported maximum deviation 0.199854 mm |
| Same source, 0.4 mm outline tolerance | 720 triangles; reported maximum deviation 0.396741 mm |
| Decimation on a difficult stepped solid | 4,988 → 3,874 triangles; layer reconstruction retains original outlines, flat-face simplification genuinely runs |
| Larger decimation allowance | 3,874 → 2,742 triangles |
| UI add/disable/restore demonstration | 3,136 → 2,492 triangles; disabling restores the exact original STL hash and restoring returns the exact optimized hash |

Phase-specific tolerance and maximum reported deviation are separate engine metrics; the report does not equate them. Invalid reconstruction intervals retain the previous verified preview, explain the error and block current export. [Openable before/after projects and STLs](m4/EXAMPLES.md), [UI remesh demonstration](m4/remesh-demo.json).

## 3D inspection and readiness

The collapsed View Options panel supplies orbit, pan, zoom, fit/reset, isometric/top/bottom/left/right/front/back views, genuine smooth/flat normals, wireframe, full/reduced/automatic display detail and monochrome height colouring. Camera position/up/target survive compatible regenerated results. Automatic display detail uses a reduced display mesh while moving a model above 60,000 triangles. It never replaces the STL or the audited geometry.

Height inspection clips the actual 3D mesh below a chosen bed height or within one physical print-layer interval. These are **uncapped cutaways**, not a manufacturing slicer or toolpath. Bounds, full source triangle count, actual final height and layer interval are displayed. Display-only tests change rendering and confirm the downloadable STL hash is unchanged. The original explode/assembly/tile viewer source and its tests remain preserved for M5.

**Ready** means no detected blocking issue, **Check** means usable geometry with warnings to review, and **Blocked** prevents release of the selected artifact. The browser independently audits finite coordinates and normals, nonzero facets, exact-float32 edge closure, opposite edge orientation, signed volume, edge-connected components and bounds. It does not weld or repair the model to make it pass. Tests include open, reversed, degenerate, nonfinite, disconnected and point-touching solids. Parts remain individual parts, rather than being misrepresented as one solid.

The audit runs in a separate cancellable worker. Superseded generations terminate it; exceptions and timeouts cannot publish the old artifact as current. The current verification budget is **two million triangles per STL**. Larger outputs are explicitly blocked with advice to lower detail or optimize. An oversized intermediate builder can be blocked while a valid smaller final optimized artifact remains selectable and exportable. This budget is not unlimited high-detail support.

Final downloads still require the exact current project/signature, completed full quality and the selected artifact's valid geometry. Draft, previous, intermediate and updating results are labelled. Final output selection follows actual connections, not raw array order; an unordered imported optimizer-first project still selects the optimized terminal result. Original pre-optimization results remain explicitly selectable as intermediates. Other processing-result warnings remain available separately instead of being suppressed.

Rust/UI findings remain parity-tested. Remesh fallback and measured added-overhang warnings are included; deleted islands are no longer misleadingly counted as bridged. The thin-bridge warning retains its severity but asks for printer review instead of inventing a known nozzle size. Geometry validity does not guarantee print success, material strength or printer suitability.

## Preservation, tests and performance

Processing Steps and operation presets now handle each geometry instance, including the saved legacy `complexity` alias for Remesh. Compilation projects that alias for execution while saved raw types remain intact. Tests cover repeated stencil instances, named branches, active/unused operations, disabled archives, stable IDs, unknown fields, opaque links, unused images, original source bytes, independent settings, undo/redo, save/open, style banks and templates. All 41 artwork controls were re-exercised with genuine engine output changes. Historical milestone evidence was not overwritten; replay output is under M4.

| Check | Result |
|---|---|
| Native Rust release workspace | **160 passed**, zero failed/ignored |
| Initial complete local browser run | **156 passed, 1 selector failure** in 11.7 min; diagnosed below |
| Corrected original cleanup regression | **1 passed**; geometry-change and exact-restoration assertions retained |
| Corrected full GitHub suite | **157 passed** in 6.3 min; Rust/web jobs and single-binary build passed |
| Customer-only production suite | **71 passed** in 7.9 min; no legacy/regression entries |
| Native/ST/MT production comparison | **96 fixtures / 288 valid output artifacts; 95 identical across all modes; ST = MT for all 96** |
| Native stencil corpus | **46 valid closed oriented meshes**, two expected blank-vector refusals; zero invalid emitted meshes |
| Runtime preservation | **24 types, 217 fields, 107 pinned source hashes** retained |
| Dependency audit | **Zero vulnerabilities** |
| Embedded Windows customer package | **15 production file hashes**, COOP/COEP and absent test entries verified |

The initial full run's sole failure was an old `.readiness p` locator becoming ambiguous after the new validation-limit paragraph. The test now identifies the triangle-statistics paragraph, retaining both its changed-geometry assertion and exact original-restoration assertion. The isolated recheck passes. No original test was deleted, skipped or disabled. Copy, fixture and selector corrections during development are documented in [test results/logs](m4/test-results.json).

All 96 suitable before/after projects are retained, alongside independent Python topology, winding, degeneracy, bounds and volume reports. Cross-engine comparison preserves triangle orientation and compares coordinates at 0.0001 mm, separately from byte hashes and ZIP metadata. **One-pass vector Spread differs between native and WASM:** native has 3,148 triangles and volume 9,440.244 mm³; both browser modes have 3,132 triangles and 9,461.708 mm³. Outer dimensions are identical and all are closed, connected, oriented solids. Three native replays are byte-identical. The native volume differs by about −0.227%. The exact numerical cause is unresolved; floating-point tie sensitivity is a hypothesis. The strict equality command correctly fails on this case. A separate comparison collector completes all 96 validations and records this difference without declaring equality. This is an open cross-platform geometry parity limitation. [Exact evidence](m4/native-variance.json). Four production threads and the non-isolated one-thread fallback are exercised. [Mode evidence](m4/production-modes.json), [production asset manifest](m4/production-manifest.json), [embedded package](m4/packaging.json).

Live scheduling retains the 180 ms draft throttle, 650 ms full debounce, pointer-release completion and cancellation/restart behavior. Remesh draft execution disables decimation and smoothing; saved full settings remain untouched. The last verified preview stays available while work runs, with current export blocked until matching full completion. This is responsive scheduling, not a promise that arbitrary heavy geometry finishes instantly.

The local native 48-case corpus had median times of **93.5 ms Standard**, **235 ms Smooth** and **170 ms Crisp**, with a maximum of **1.651 s**. A separate analytic, densely tessellated unit cube verified **1,769,472 triangles**, one component, volume approximately 1 mm³ and exact 1 × 1 × 1 mm bounds. The off-UI audit took about 7.29 s in the complete local run, with maximum sampled frame gap 16.67 ms; a 2,116,800-triangle model was explicitly refused by the budget guard. These are machine-specific observations. The dense fixture tests the shipped audit worker, not production speed for every complex stencil. [Complete-run dense timing](m4/dense-audit-full-run.json), [production dense replay](m4/dense-audit.json), [live scheduling replay](m4/m2-replay/live-performance.json).

Geometry dialogs were tested at 1440, 800 and 390 px with no document/dialog horizontal overflow and zero serious/critical WCAG A/AA axe findings. Real 3D options and existing workspace accessibility tests also pass. Processing remains local, including bundled text fonts and offline image bytes. [Accessibility](m4/accessibility.json), [retained branch/crop accessibility](m4/responsive-accessibility.json).

## Visual evidence

| View | Screenshots |
|---|---|
| Grouped geometry in light mode | [Bridge placement](m4/screenshots/geometry/01-bridges-light.png), [print layers](m4/screenshots/geometry/02-layers-light.png) |
| Actual bridge geometry | [Artwork comparison](m4/screenshots/geometry/03-artwork-and-bridges.png), [raised 3D](m4/screenshots/geometry/04-raised-bridges-light.png) |
| Height inspection | [First layer](m4/screenshots/geometry/05-first-layer-cutaway.png), [one layer interval](m4/screenshots/geometry/06-layer-interval.png) |
| Viewer | [Wireframe](m4/screenshots/geometry/07-wireframe-light.png), [dark 3D](m4/screenshots/geometry/08-raised-bridges-dark.png) |
| Dark geometry tools | [Strength](m4/screenshots/geometry/09-strength-dark.png), [mobile](m4/screenshots/geometry/10-mobile-geometry-dark.png), [optimization](m4/screenshots/geometry/11-mesh-optimization-dark.png) |
| Optimized real output | [Dark solid](m4/screenshots/geometry/12-optimized-solid-dark.png) |

Screenshots come from the running app; light/dark geometry, first-layer cutaway and optimizer were visually reviewed. These are actual generated geometries. The optimizer-settings screenshot intentionally retains the honest updating/previous-result state while processing.

## GitHub Actions and remaining release limits

The implementation [run 40880193435](https://github.com/thomastt-cryoo/stenciii/actions/runs/40880193435) passed **Rust and web**, all 160 native tests, both freshly built WASM variants, audit, native CLI, **157 preserved/extended browser tests in 6.3 minutes**, the production single-binary build and artifact upload. The optional deploy job failed with **404 Not Found**, explicitly asking for Pages to be enabled. Application/build verification succeeded; public Pages hosting is not live. Hosting configuration was left unchanged. [Exact jobs](m4/github-actions.json), [full job logs](m4/logs/).

The newly measured one-pass vector Spread native/WASM parity limitation remains open; it prevents a claim of universal cross-platform identical geometry. All measured variants pass independent mesh validation. The four approved issues also remain tracked: advanced hardware fit-test strips can contain zero-area triangles; direct CLI seam-angle routing is defective; complete manufacturing output aggregation is unfinished; macOS and fresh-machine offline installation testing remain pending. The browser still blocks known defective hardware exports. Physical print testing, Firefox/Safari and cross-platform desktop launch are not certified. Public Pages hosting depends on repository configuration and is separate from the locally verified app.

Remesh can preserve original geometry when reconstruction is unsafe. Raster bridge width is limited by working-pixel resolution. Vector generated strip counts can merge geometrically. Height cutaways do not generate print layers or machine instructions. The current exact mesh audit is bounded at two million triangles. Custom fonts and image/text composition remain outside the implemented scope. Browser-local preset/template libraries should be exported for backup.

**M5 remains:** complete colour separation/layer sets, tone patterns and registration, tiling/seams, mounting/pads/rings, screws/connectors/hardware, manufacturing-specific 3D tools and complete manufacturing output aggregation; resolve their tracked CLI/manufacturing defects with appropriate tests. Later release work includes platform packaging, fresh offline installation and physical QA.

**Stop after M4. No M5 implementation has begun.**
