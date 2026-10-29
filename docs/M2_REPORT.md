# M2 — Beginner creation, live adjustment and preview polish

Completed 29 October 2026, Asia/Dubai. **M2 only; M3 has not started.**

Source commit: [`888fcfc871fa6d3970de1f8e96fb663e2fae93c3`](https://github.com/thomastt-cryoo/stenciii/commit/888fcfc871fa6d3970de1f8e96fb663e2fae93c3) (the implementation commit; the following evidence/documentation commit does not change application behavior). Its tree is `f11cd60f91f3213e54fa8239bf603cdfd3c70694`, identical to the tested local implementation tree. Approved M1 base: `61a98108b2cab1d248585ef9c465abcde9fd54e6`. Engine ancestry remains upstream v2.9.4, `5d8df15b798b859faf72248a35d156d6e9aaffc7`.

## What works

Drop PNG/JPG/BMP/SVG → see original → choose a style → Make Stencil → adjust live → inspect → export. All processing is local. New imports validate type, empty/corrupt data and size before replacing the current project. The original image bytes are embedded and retained for undo. Transparent originals are presented on white in both themes, matching the engine's alpha compositing.

The sidebar now has a compact real style selector, understandable Detail profiles, automatic/manual paint selection with remembered manual threshold, invert, width, base thickness and bridge width. Exact pixel and geometry values live in All Settings. On laptops the action area remains visible while longer controls scroll. At narrow widths the controls move below the large preview. No gradient, decorative dashboard, node canvas or development placeholder was added.

Artwork tools expose crop percentages, clockwise quarter turns/free rotation, horizontal/vertical flip, margin and tested cleanup controls. The sequence is intentional: resize source → crop → flip → rotate → threshold → optional smoothing → tracing/cleanup → build. Original view always shows the original file. Compare uses the engine-produced image after framing, not a browser approximation of the crop.

## Actual styles and mappings

Every recipe is ordinary saved engine JSON, replayable through the existing native CLI. All defaults not listed below come from the live runtime catalogue.

| Style | Engine sequence | Balanced settings | Intended use |
|---|---|---|---|
| Standard | source → transform → threshold → trace → remove_islands → vector_stencil | source.resolution=650; trace.smooth=1.5, corner_deg=60, tolerance=.4, min_area=4; vector_stencil.detail=4 | Logos, lettering and general graphics |
| Smooth Vector | source → transform → threshold → smooth → trace → remove_islands → vector_stencil | resolution=700; smooth.radius=.8, supersample=2; trace.smooth=2, corner_deg=100, tolerance=.25, min_area=2; detail=4 | Organic shapes and softer curves |
| Crisp Raster | source → transform → threshold → stencil | resolution=500; no smoothing or tracing | Pixel-defined and hard-edged artwork |

Vector cleanup initially sets delete_specks=false, fill_holes=false and keep_largest=0, preserving shapes. Raster pixel cleanup is **absent by default**, rather than falsely claiming iterations=0 disables it: the engine clamps opening to at least one pass. Explicit Pixel cleanup inserts morphology.open with radius=1, iterations=1 before the raster builder. Bypassing it retains the exact step/settings/connections so re-enabling and undo restore them. Larger cleanup radii can erase thin strokes; the UI says so.

| Detail | Standard source / vector detail | Smooth source / vector detail | Crisp source pixels |
|---|---|---|---|
| Quick | 300 / 2 | 350 / 2 | 250 |
| Balanced | 650 / 4 | 700 / 4 | 500 |
| Fine | 1000 / 6 | 1100 / 6 | 850 |

These are style-specific profiles, not a claim that raster resolution and vector detail are equivalent. Exact edits show Custom. Width defaults to 200 mm, base thickness 5 mm, margin 8 mm, bridge width 1.6 mm, one raised bridge per island, easy Z bridging, .2 mm layers and one extra top layer. Therefore default final height is 5.2 mm. Mesh measurements come from actual STL coordinates. Raster margins are rounded to pixels by the engine; equal width can yield slightly different heights across styles. Comparison uses that actual raster scaling.

Style banks retain complete prior graphs and per-style settings. A new style inherits current physical dimensions and supported artwork choices; a revisited style restores its own settings. Image replacement is shared when switching. Old simple raster/vector recipes can switch back to their original graph including unknown fields. Exact chain recognition rejects extra branches/unknown processors; complex projects do not offer destructive style replacement. Native-root banking avoids nesting project/image metadata recursively.

## Live preview and export truthfulness

After the first completed full generation, changes automatically schedule drafts at most every 180 ms and a full run after 650 ms of settling. Full work waits for slider release; ordinary numeric typing settles even while the input remains focused. Draft execution caps source resolution at 200, vector detail at 2 and smoothing supersampling at 1, and uses easy Z bridging. This coarsening never changes the saved recipe.

Every edit/open/new/cancel/run advances a controller epoch. Preparation, progress, capture and final publication check it; obsolete work cannot overwrite the active project. The existing worker cancellation/restart mechanism is retained. Last valid output remains visible until replaced. Draft and stale badges are explicit. Cancel clears queued work; Make Stencil retries. Export is enabled only for a completed **full** generation matching the active signature and without blocking findings. STL filenames include artwork and style. ZIP parts are inspected as well as standalone STLs.

Original, Stencil, Compare and 3D are genuine views. Stencil is an orthographic top projection of the actual exported STL, including bridge corrections at every height. Captions explain raised bridges. Compare uses one camera/viewport for prepared artwork and STL, with engine-derived physical placement and a draggable/keyboard-adjustable split. It is unavailable for arbitrary advanced workflows whose alignment cannot be established. Zoom/pan/orbit persist across live generations; Fit is explicit. Traced-outline SVG export remains available for vector recipes and is labelled **before bridge corrections**.

## All Settings

All 24 processing types and 217 qualified parameters remain searchable. Exact qualified keys, names and titles rank before descriptive matches. Categories prioritize artwork, size and bridges; active instances appear first. In this project narrows the catalogue without deleting it. Adjustable, In project · Reference and Reference labels distinguish implemented controls from future editors. Per-instance ids and qualified keys remain available in expanded details; conditional settings explain why they are inactive. Quick links route to exact resolution, framing, cleanup, margin and smoothing. Specialist workflows remain preserved, with M3–M5 editors honestly marked as future scope.

## Quality audit and actual weaknesses

The committed [16-input corpus and provenance](../web/e2e/corpus/SOURCES.md) includes original logos, detailed ornament, OABR lettering with islands, line drawing, thin strokes, colour graphics, transparent PNG, low contrast JPG, small BMP, a 3200×2400 image, nearly empty/solid and completely empty/solid masks, NASA portrait and textured coin photograph. The native audit uses the actual application recipe constructor, embeds the real images and tests all three styles: **48 cases**. [Full measured results](m2/corpus-results.json).

**46 emitted STLs passed exact independent validation.** They have finite coordinates, nonzero faces, every edge shared twice, consistent winding, one connected component and nonzero signed volume. No welding, triangle repair or tolerance-based hiding was used. These checks do not certify freedom from every possible self-intersection or prove mechanical strength. The two unsuccessful cases are the completely white image in Standard and Smooth Vector; the engine correctly refuses no closed outlines and produces no STL. Crisp Raster can produce a valid solid plate for the same empty input, with a near-empty warning. Blank/solid geometry is not presented as useful artwork.

Review sheets are rendered independently from actual STL triangles, with source artwork alongside:

- [Logos, drawing and thin lines](m2/screenshots/quality-1.png)
- [Lettering, colour, transparency and low contrast](m2/screenshots/quality-2.png)
- [Small/large artwork and extreme masks](m2/screenshots/quality-3.png)
- [Blank/solid, portrait and photo](m2/screenshots/quality-4.png)

Visual review found and corrected the initial raster cleanup problem: its opening pass removed six of eight thin strokes. Bypassing cleanup by default restores all eight visible strokes in the final raster projection. Standard loses the finest hairlines; Smooth Vector rounds corners and loses additional very thin detail. These remain real smoothing/sampling limitations. At small source size, Crisp Raster retains visible pixel steps; higher resolution cannot reconstruct missing original detail. Letter counters are bridged and remain recognizable. Bridge locations differ legitimately by style and can cross a visible stroke.

Automatic threshold separates the low-contrast example successfully. Colour graphics merge tones with similar darkness and can lose an entire light colour. Photographs become two-tone silhouettes: the portrait outline and clothing remain recognizable, but face highlights and fabric detail fragment; the coin layout remains recognizable while engraved faces/details disappear and many bridges traverse the paint area. Smooth is not universally better: extra contours cost more triangles and can remove small features. Manual threshold materially changes the portrait, as the screenshots show. No claim of perfect photographic stencils or physical print certification is made.

The original CLI report currently treats the empty, unused remove_islands.removed diagnostic as “no outlines found.” The new customer readiness view correctly excludes that unused diagnostic; a connected auxiliary output is still checked. The underlying CLI behavior is recorded in the corpus results and not silently changed or hidden.

## Raster defect and remaining blocker

M0's exact ring reproduction (`--width 60 --thickness 2 --resolution 100`) had two zero-area triangles. The cause was a fan anchored on a vertical edge with intermediate collinear height vertices. Simply dropping its zero-area faces would leave unsplit boundary edges. M2 zips the two vertical vertex chains instead, preserving every boundary subdivision and winding while ensuring each triangle spans both columns.

The new Rust regression exhausts all 256 small height maps: every emitted face is nonzero; maps without diagonal-only point contacts are also checked closed. The exact M0 ring now has **0 degenerate faces**, closed/oriented edges, the **same 1,160 triangles, bounds and signed volume**. [Before/after evidence](m2/raster-fix.json). The fix is included in native, single-thread WASM and threaded WASM builds.

The separate advanced **hardware fit-test strip still contains zero-area faces**. It is outside the raster wall routine and M2's specialist scope. Browser STL/ZIP export now blocks defective facets, with a real hardware-project regression proving the guard and lossless project saving. This remains a release blocker for that advanced export path; it is not a Crisp Raster defect. Existing CLI exports retain their historical behavior, so browser validation does not imply every arbitrary legacy CLI output is repaired.

## Verification and performance

Detailed observed runs and portable logs are in [test-results.json](m2/test-results.json) and [logs](m2/logs). All original tests are retained; the M1 exact-resolution UI test now reaches that real control through All Settings. M1 screenshots remain immutable; its screenshot replay writes into M2 evidence.

- Rust: **157 passed**, including the previous 156 and the new exhaustive raster regression.
- Browser regression: **123 passed** in 7.3 minutes, retaining all 107 M1/original checks plus 16 M2 checks.
- Production customer/model checks: **38 passed** in 2.5 minutes against the customer-only build, including both WASM-mode customer flows, late ordering, final live submission metrics and final screenshots. The explicit worker-restart API harness is exercised in the full regression build; it is intentionally absent from production.
- Quality audit: 48 cases; 46 valid meshes, 2 expected no-artwork refusals; no emitted invalid meshes.
- Native/browser triangle-coordinate equivalence, project reopen cycles, original bytes, unknown/branched legacy data, drafts/full ordering, rapid edits, cancel/restart, style persistence, crop, cleanup, comparison, themes, accessibility, responsive layouts and blocked external requests are covered.
- Catalogue preservation check: 24 types, 217 mappings and the pinned 107-file upstream source manifest pass.

Final native corpus process timings (including CLI startup) have median/max: Standard **61/716 ms**, Smooth **146/816 ms**, Crisp **112/373 ms** on this Windows machine. These are observations for this corpus, not universal speed claims. [Live browser measurements](m2/live-performance.json) recorded 10 coarse runs and one settled full run after the initial generation during the repeated slider interaction. The maximum animation-frame gap across startup, generation and interaction was 100 ms; this is not a claim of uninterrupted 60 fps. One settled full run follows the gesture instead of a full run per input. Drafts are an approximation and can temporarily lose fine strokes. Large/custom projects remain explicit Make Stencil workflows. Fine settings and complex photos can take longer; worker restart and cancellation remain available.

Development failures were investigated: browser timer receiver fixed after real UI tests; quality runner output directory isolated after it deleted a browser download; raster cleanup default corrected after visual comparison. No original test was deleted, no assertion was disabled and no error was suppressed to claim a green result.

The production-only build contains 14 local files with no legacy/test-only entry. [Asset/engine hashes](m2/production-manifest.json) record the single-thread and threaded WASM packages. The rebuilt Windows embedded studio was served on port 5210: all 14 HTTP asset hashes match production, COOP/COEP headers are correct, and the legacy harness returns 404. [Packaging evidence](m2/packaging.json).

The actual bundled production worker was exercised with four threads under isolation and one thread without isolation. All three styles generated closed meshes in both modes. Sorted triangle coordinates match the native corpus outputs at .0001 mm for **all three styles across native/ST/MT**. [Observed modes and independently checked meshes](m2/production-modes.json). The rebuilt standalone preview is running locally at http://127.0.0.1:5210/.

Not run: physical printing, fresh-machine installation, macOS/Linux desktop launch, Firefox/Safari, future specialist editors. No cross-platform release claim is made.

To reproduce: build native CLI and both WASM variants as in INSTALL.md; run `cargo test --release --workspace`; in `web/`, run `npm run e2e` and `npm run quality`. The quality runner has its own output directory and a 120-second per-case native timeout. From the root, `python scripts/m2/render_corpus.py` and `node scripts/m2/capture_quality.mjs` regenerate independent projections/review sheets. Those developer-only Python scripts use Pillow; committed fixtures need no download. `python scripts/m2/create_corpus.py` regenerates synthetic inputs and downloads only the two pinned photographs when missing. `python scripts/m2/collect_evidence.py` collects observed logs without touching M0/M1 evidence. After a production build, `production_manifest.py` records hashes; serve the embedded studio on port 5210, run `node scripts/m2/verify_modes.mjs http://127.0.0.1:5210/` and `python scripts/m2/verify_package.py` to repeat the packaged-mode/equivalence checks.

## GitHub Actions investigation

[M1 run 40805613840](https://github.com/thomastt-cryoo/stenciii/actions/runs/40805613840) completed with **Rust and web jobs successful**, including original/new browser tests, both WASM builds and embedded studio. Only `actions/deploy-pages@v4` failed: HTTP 404 with “Ensure GitHub Pages has been enabled.” This is repository Pages configuration, not a broken application build. No repository Pages setting was changed. [Observed jobs and error](m2/m1-actions.json).

## Acceptance and scope boundary

| M2 requirement | Result |
|---|---|
| Three genuine styles, documented mappings and measured differences | Implemented and independently validated |
| Beginner quick controls and first import flow | Implemented; real local generation and readable validation |
| Draft/full live updates, cancellation and stale export protection | Implemented and tested |
| Truthful original/STL/3D and aligned comparison | Implemented; advanced alignment unavailable when unknown |
| Crop/rotate/flip/cleanup/margin | Implemented, reversible, original bytes retained |
| Useful All Settings, ranking, dependencies, instance identity | Implemented; all 217 entries retained |
| Representative corpus and honest quality review | 48 measured cases, four reviewed sheets; weaknesses documented |
| Correct export/project/style undo and legacy safety | Implemented and tested; invalid geometry guarded |
| Light/dark, minimal visual polish, laptop/mobile | Implemented and actual screenshots recorded |
| Regression tests, independent geometry, M1 Actions investigation | Evidence linked above; final counts below |
| Commit code/tests/docs and stop at M2 | Published implementation plus evidence commits; no M3 work |

M2's customer workflow is complete within this milestone. Broad release readiness remains limited by the named advanced hardware defect, later export aggregation/specialist scope, physical-print evaluation and untested platforms. Deferred to M3: visual crop handles/expanded artwork editors, adding/reordering processing steps, specialist parameter editors and presets; later milestones retain multi-colour, tiling, mounting/hardware and full multi-branch export aggregation. This report does not present those as completed.

## Actual application screenshots

| Empty and import | Styles on the same image | Comparison, geometry and settings |
|---|---|---|
| [Empty light](m2/screenshots/01-empty-light.png) | [Standard](m2/screenshots/04-standard.png) | [Aligned comparison](m2/screenshots/07-aligned-comparison.png) |
| [Empty dark](m2/screenshots/02-empty-dark.png) | [Smooth Vector](m2/screenshots/05-smooth.png) | [Crop/rotate/flip comparison](m2/screenshots/08-crop-comparison.png) |
| [Imported artwork](m2/screenshots/03-imported-artwork.png) | [Crisp Raster](m2/screenshots/06-crisp.png) | [Actual 3D](m2/screenshots/09-crisp-3d.png), [dark 3D](m2/screenshots/10-dark-3d.png) |
| [Portrait automatic](m2/screenshots/13-portrait-automatic.png) | [Portrait threshold 110](m2/screenshots/14-portrait-threshold-110.png) | [Dark settings](m2/screenshots/11-settings-dark.png), [light settings](m2/screenshots/12-settings-light.png) |
| [Narrow-screen portrait](m2/screenshots/15-mobile-portrait.png) | | |
