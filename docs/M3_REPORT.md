# M3 — Complete artwork customization and Processing Steps

29 October 2026, Asia/Dubai. **M3 only. M4 has not begun.**

Final implementation commit: [`9b6d6f0bd7c1a23fb919bd95b34bf7934eb155d1`](https://github.com/thomastt-cryoo/stenciii/commit/9b6d6f0bd7c1a23fb919bd95b34bf7934eb155d1), following the initial M3 implementation `a3baab562c31750477062c7e7cc701a3a257cca4`. Its tree `06c7301043c533592b9090776c5710be9f3e999e` exactly matches the tested local source commit. The following evidence commit contains this report, results and screenshots. Approved M2 base: `48490e778d88408c070a64c94261e3efe4ee33ce`. Rust engine sources are unchanged in M3; upstream ancestry and the M2 raster geometry repair remain intact.

## What customers can do

The familiar image workflow remains: upload → Make Stencil → customize → inspect → export. Standard, Smooth Vector and Crisp Raster retain separate saved adjustments, live draft/full processing and the Original, Stencil, Compare and 3D views. M3 adds a separate Create from Text entry point.

Choose **Customize artwork** for five restrained groups. Each group opens individual operations, with plain-language help, runtime defaults, reset buttons and conditional availability. Repeated operations have separate settings. Search still covers all **24 types and 217 parameters**, ranks exact labels first and understands terms such as “smooth edges” and “remove small dots”. Future geometry/manufacturing entries remain labelled references.

| Group | Implemented capability | Scoped fields |
|---|---|---:|
| Image & framing | Select/replace each source independently; original format, dimensions and byte information; working resolution; exact crop, quarter/free rotation and both flips | 10 |
| Paint selection | Automatic/manual threshold, invert, colour count and pre-reduction smoothing | 4 |
| Cleanup | Mask smoothing/supersampling; morphology operation, neighbourhood, radius, direction, pass count and patterns; speck/hole/area/largest-shape cleanup | 14 |
| Outlines | Trace smoothing, protected corners, simplification and minimum area; corner rounding; outline-to-mask resolution | 8 |
| Text | Multiline content, two bundled fonts, letter size, line spacing and padding | 5 |
| **Total** | **41 genuinely editable type-qualified artwork fields** | **41** |

All 41 fields were changed through actual controls, read back from saved JSON, reset to runtime defaults and executed through the real engine. **Every field changed the emitted PNG/SVG bytes on a suitable fixture.** Model tests check bounds, choices, help and availability. See the [field-by-field evidence](m3/PARAMETER_COVERAGE.md) and [complete hashes/dimensions](m3/artwork-coverage.json). The 17 previously editable physical fields remain available, for 58 editable qualified fields across the whole customer app; specialist parity is not claimed.

Morphology follows verified engine semantics: zero iterations still runs one pass for ordinary operations; for thinning it means until stable. Kernel controls, line direction and custom-pattern controls are enabled only where used. Trace corner protection uses direction change, so increasing its threshold protects fewer corners.

## Direct crop and real preparation previews

The visual crop editor has eight edge/corner handles, zoom, pan, quarter turns, both flips, reset and numeric/free-angle alternatives. Arrow keys move one input pixel; Shift moves ten. Pointer coordinates use the displayed engine input's exact width/height and the actual zoom/pan rectangle. Crop percentages round to the same pixels as Rust. The overlay selects the input before flip/rotation; the adjacent image is the actual prepared result after them.

Tests cover odd sizes, unusual aspect ratios, a 4096 × 257 transparent SVG, repeated complete rotations, panning, keyboard moves, undo/redo and unchanged original bytes. The M2 corpus retains high-resolution, transparent, photographic, thin-line, solid and empty inputs.

**Inspect artwork** selects actual original/prepared images, paint masks, smoothing/cleanup results, traced outlines and removed-detail outputs. A separate single-thread worker computes only the selected step's dependencies. It cannot replace or cancel the final model worker. Cached outputs are still retrieved; image cache versions include the original bytes. Previous, draft, updating and failed states are labelled. Full preparation results can be downloaded as PNG/SVG. Disabled or removed results cannot appear as current.

Final STL downloads retain the M2 generation/signature checks and independent finite-coordinate/degenerate-triangle guards. Preparation SVGs are explicitly **before physical bridge corrections**. Compare remains available for workflows with a verified coordinate mapping; complex branches or outline rasterisation do not receive an invented alignment.

Production testing caught a rapid-rotation timing window in the new artwork view. Readiness and preparation downloads now also compare the result's exact project/step/port/quality identity during render, closing the gap before an asynchronous effect marks it busy. Eight repeated rotation runs retain the original byte-equality assertion and also check saved rotation and output dimensions after every turn.

## Processing Steps without a canvas

**Processing Steps** is a numbered vertical list inside the established inspector. Choose a named pass, select a step, configure it, inspect primary/secondary results, or choose its readable source input. Add choices are filtered by actual port types. Format-changing insertion uses explicitly labelled conversion pairs. The adapter rejects missing inputs, duplicate identities, invalid types and cycles before saving a change.

Optional operations can be duplicated, disabled, removed or moved between compatible neighbours. Invalid move buttons are unavailable. Source/conversion steps remain protected while their results are used. Disabling reconnects a valid executable bypass and archives the complete step, settings and original links. Re-enabling restores those exact identities and values. If subsequent edits occupy its original connections, restoration explains the conflict and retains the archive; it never overwrites the newer connections.

Named branches are preserved. Shared steps visibly indicate shared use. Duplicate artwork pass makes independent active steps while reusing immutable original bytes. Existing disabled archives remain with the project rather than being silently cloned into the new pass. Shared branches cannot be reordered unsafely; input selectors provide compatible alternatives. Manufacturing branches stay saved and executable where the engine supports them, with their specialist editors honestly deferred.

Structure and parameter changes use the existing undo/redo architecture. Renaming a pass does not rerun geometry. Restoring a starting style explicitly replaces one supported artwork pass, keeps physical settings and retains the complete previous project for recovery. Imported advanced recipes cannot be silently replaced by ordinary style selection.

## Text demonstration

Create from Text → enter `AOBR` and `STENCIL` on separate lines → select bundled serif bold → size 120, spacing 1.35, padding 30 → Make Stencil. The source is actual engine-rendered text, with no image overlay or custom-font claim. Original view shows that text mask; Stencil/3D show the actual bridged solid.

The exported demonstration has **3,376 triangles**, one connected component, no degenerate faces, closed consistently oriented edges and size **200 × 123.129 × 5.2 mm**. Browser and native CLI exports have identical bounds and triangle counts. Traced SVG parses independently. Save/open, font changes and project persistence are exercised. See [text validation](m3/text-validation.json), [text settings](m3/screenshots/12-text-editor-dark.png) and [real text model](m3/screenshots/13-text-stencil-dark.png). The screenshot uses the other supported bundled font; both font choices are tested.

## Presets and project safety

The original browser key `stencil-presets`, built-in library, `stencilPresets: 1` file envelope, parsing and non-overwriting merge behavior are reused. Save, scoped apply, rename, remove, import/export and engine-default restore work. Applying validates every known value atomically and changes only the selected instance. Portable source presets do not replace original image IDs. Unknown imported preset fields remain in the library and are not guessed into engine controls. Malformed existing preset storage is not overwritten as an empty library.

A style is a starting recipe; a default resets a field; an operation preset affects one instance; a workflow template supplies complete preparation; a saved project also contains originals. Templates have a separate library. Applying one is explicitly **Apply as project copy**, retains the full previous raw project, keeps the current compatible image/text and is undoable. Tests save a template, change settings, apply it, compare the retained previous project and undo the replacement.

The raw project remains authoritative. Compilation is an execution projection. Tests cover native and legacy-shaped steps/links, multiple instances, separate image replacements, named branches, unknown fields, unused images, opaque metadata, archived identities and refused destructive/circular changes. Untouched data is compared structurally, not reconstructed from a simplified list. Supported saved artwork/text projects replay through the existing CLI. The CLI's own format support is not expanded by M3.

## Examples and visual evidence

The [before/after gallery](m3/EXAMPLES.md) contains engine-emitted results for all 11 artwork processor families. Focused fixtures include sharp/rounded/concave corners, thin strokes, isolated dots, enclosed holes, cleanup sequences, colour reduction and island-bearing text.

| View | Light | Dark |
|---|---|---|
| Workspace | [Stencil](m3/screenshots/02-stencil-light.png) | [Prepared outlines](m3/screenshots/09-outlines-dark.png) |
| Artwork and crop | [Grouped tools](m3/screenshots/04-artwork-tools-light.png), [visual crop](m3/screenshots/03-visual-crop.png) | [Text editor](m3/screenshots/12-text-editor-dark.png) |
| Processing Steps | [Inspector](m3/screenshots/05-processing-light.png) | [Inspector](m3/screenshots/10-processing-dark.png), [390 px mobile](m3/screenshots/11-processing-mobile-dark.png) |
| Settings/presets | [Search](m3/screenshots/07-all-settings-light.png), [presets](m3/screenshots/06-presets-light.png) | [M2 settings replay](m3/screenshots/m2-replay/11-settings-dark.png) |
| Text 3D | [Model](m3/screenshots/14-text-stencil-light.png) | [Model](m3/screenshots/13-text-stencil-dark.png) |

Screenshots were captured from the running app and visually reviewed. Original M0–M2 evidence is unchanged; their replay screenshots are stored under M3.

## Validation and performance

| Check | Result |
|---|---|
| Rust workspace, release | **157 passed**, zero failed/ignored |
| Complete preserved and extended browser suite, corrected source | **141 passed** in 8.5 min |
| Production-only customer checks, no legacy/test entry | **57 passed** in 3.8 min |
| Repeated rotation/byte-safety stress | **8/8 passed** |
| Actual scoped control/output checks | **41/41 emitted different suitable PNG/SVG results**, with reset/readback |
| Runtime preservation | **24 types, 217 qualified parameters, 107 pinned source hashes** retained |
| Dependency audit | **Zero vulnerabilities** |
| Native / single-thread / multithread output | Five cases, closed outputs; triangle coordinates equivalent at **0.0001 mm** |
| Embedded Windows studio | All **14 production file hashes**, isolation headers and legacy 404 verified |

The full browser run includes every original test; none was removed or disabled. The production subset excludes only the test that intentionally opens the separate worker-restart regression entry. Independent mesh inspection checks exact float32 coordinates, finite values, nonzero facets, edge sharing/winding, components, bounds and volume; SVGs parse separately. Thirty retained example/direct-export files were inspected, in addition to the corpus and production-mode meshes. [Production-only package proof](m3/packaging.json), [thread modes](m3/production-modes.json), [preview correction evidence](m3/preview-safety.json).

The full 48-case M2 corpus was rerun through the native engine and independent exact-coordinate mesh validator: **46 valid closed oriented meshes**, zero invalid emitted meshes, and the same two expected blank vector-input refusals. The 14-step cleanup/conversion fixture exports an **11,852-triangle** closed mesh, one component, no degenerate facets. A named branched import also exports valid geometry while its untouched branch and opaque fields remain equal. See [corpus](m3/corpus-results.json), [long chain](m3/long-chain-validation.json), [artifact inspection](m3/artifact-validation.json) and [test results/logs](m3/test-results.json).

Live scheduling retains M2's 180 ms draft throttle, 650 ms full debounce and pointer-release completion. Artwork inspection uses a separate 120 ms draft / 300 ms full debounce. Full-quality computation is deferred during drag gestures; saved settings are never coarsened. Source/text/rasterised working sizes and smoothing are reduced only in draft execution. Up to 30 supported artwork/build steps receive automatic final updates after initial generation; larger or specialist workflows explicitly use Make Stencil. Selected intermediate previews remain available independently.

On this Windows machine the native corpus's median elapsed times were **138 ms Standard**, **303 ms Smooth**, and **268 ms Crisp**; the longest case was 1.582 s. Five production browser cases took approximately **126–1,399 ms** across the two modes while other validation work was running. These are local observations, not cross-platform benchmarks. The live interaction replay's longest sampled frame gap was **100 ms**, with throttled 200 px drafts followed by the saved 650 px final. The final worker used four threads under isolation; the preview worker used one in both modes. [Live timing sample](m3/m2-replay/live-performance.json).

Processing dialogs were checked at 1440, 800 and 390 px with no document/dialog horizontal overflow, and zero serious/critical WCAG A/AA axe findings. Light/dark cleanup editors and the retained workspace accessibility tests also pass. External processing requests are blocked in a long-chain test: none occur. Production assets contain neither a node canvas nor a legacy/regression entry. See [responsive/accessibility](m3/responsive-accessibility.json), [production manifest](m3/production-manifest.json) and [packaging](m3/packaging.json).

## GitHub Actions review

The approved M2 [run 40812681370](https://github.com/thomastt-cryoo/stenciii/actions/runs/40812681370) had a genuine browser-test failure, **not a Pages failure**: Rust, both WASM builds, audit, studio build and native CLI passed; 122/123 browser tests passed. The shading screenshot raced with the live final artifact replacing its canvas. M3 waits for actual processing/viewer completion and retains the original smooth-vs-flat inequality assertion. The corrected test is included in the complete local regression run. [Review evidence](m3/m2-actions-review.json).

The corrected M3 [run 40845907942](https://github.com/thomastt-cryoo/stenciii/actions/runs/40845907942), on source `9b6d6f0bd7c1a23fb919bd95b34bf7934eb155d1`, passed **Rust and web jobs**, both WASM builds, dependency audit, native CLI, **141 browser tests in 5.2 min**, single-binary build and Pages-artifact upload. The optional **deploy** job failed with **404 Not Found**, explicitly asking for GitHub Pages to be enabled in repository settings. The application/build checks succeeded; public Pages hosting is not live. Repository hosting configuration was left unchanged. [Exact jobs and deployment error](m3/github-actions.json).

## Known limits and the next milestones

The four approved tracked issues remain open: advanced hardware fit-test strips can contain degenerate triangles; direct CLI seam-angle routing is defective; complete export aggregation across manufacturing branches is unfinished; full macOS and fresh offline installation validation is pending. The browser geometry guard still blocks the known defective hardware export. Existing CLI “removed” unused-output warnings remain observable in replay logs. No physical-print or cross-platform release certification is claimed.

M3's safe reordering is intentionally restricted to compatible adjacent optional steps; connected source/conversion steps require valid input changes. Custom fonts and image/text composition are not implemented. Intermediate inspection costs an additional single-thread WASM instance while visible. Morphology and cleanup can erase thin strokes/letter counters; help explains their actual effects. Preset/template libraries are browser-local and should be exported for transfer. Complex manufacturing alignment and output aggregation await their specialized milestone.

**M4:** complete detailed stencil/bridge geometry, physical layer and island/contact controls, remeshing/optimization and specialist 3D controls; extend their validation and manufacturing-quality evidence.

**M5:** complete colour separation/layer sets, tone patterns/registration, tiling/seams, mounting/pads/rings, screws/connectors/hardware and full manufacturing output aggregation; address the tracked CLI/manufacturing defects with corresponding tests.

Later milestones retain full parity, platform packaging, fresh offline installation and release QA. **Stop at M3; do not begin M4 without the user's next instruction.**
