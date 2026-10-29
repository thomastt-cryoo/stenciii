Historical checkpoint, superseded by the resumed verification and final M5 report.

# M5 paused at the user's request

Paused 2026-10-29, approximately 22:04 Dubai. The user said to stop because their usage is ending. Do not resume work until requested. M5 is not complete. Do not start M6.

Workspace: `C:/Users/mazin/Downloads/stencil`, branch `codex/m5-manufacturing`. All edits and generated evidence remain on disk. The preview on port 5199 was stopped; the older embedded server on 5210 had already been stopped. No recurring task was created.

## Brief and history

The full M5 brief is `C:/Users/mazin/.codex/attachments/c6492f8c-e68c-41d9-986d-b5d35d009c5e/Pasted text.txt`. Preserve the M0–M4 historical documentation and original tests. User requires completed source, actual output evidence, documentation and GitHub commits, then stop after M5.

Approved GitHub main is still M4 commit `9c1992ebd761cc006585a9f5ae3e23f387ddc3ea`, tree `45804c72929f6744542473e801f259f0ea04f1a5`. Main has NOT been updated for M5.

Local checkpoint commits:

- A `58f95a6`: colours, tones and registration, 38 fields.
- B `82f7455`: tiling, interactive layout and fragments, 29 fields.
- C `05165cf`: mounting, border and hardware, 44 fields; documented pre-repair calibration failures.
- D changes are currently uncommitted. Do not discard them.

Matching GitHub checkpoint commit objects were created through the GitHub connector, but no branch points to them yet:

- A `b520a6fa172259a3034128afcc01b29386b8d4c8`, tree `263ee22a88bc49a21dae6ec7f2d91a178cd73e22`.
- B `2de1589c0ccde9753ebf772f8af280a39385fac5`, tree `398e8f5da104b7a99f401905940a7c3323303743`.
- C `6d044d9c06e73641028cf3dbe3297f17db4aca5e`, tree `04fe3cb2ed2c2c89805a74a0d18a7746c083bf92`.

These form an A→B→C chain on the approved M4 commit. A final D implementation commit can use the remote C object as parent, then main can advance with an expected-head lease after verification.

## Implemented

A–C work and evidence are described in `docs/m5/WORK_LOG.md`. All ten manufacturing types now have real per-instance editors, including the 17-field legacy combined exporter. All 217 qualified runtime keys are structurally editable, with unknown keys excluded from that claim.

D adds `exportPlan.ts`, `ExportPanel.tsx`, ZIP worker/client/writer and `BatchWorkbench.tsx`. The header's Parts export collects actual upstream plates/tiles and auxiliary files rather than exporting the hardware leaf alone. The panel provides explicit assemblies, individual files, dimensions, quantities where known, optional project/layout/outlines, validation, completeness and current-generation guards. ZIP packaging preserves original STL bytes, computes hashes/CRCs, namespaces files and deduplicates shared upstream files. Invalid required files block the complete ZIP.

Batch runs locally in separate workers with a frozen saved recipe, selected embedded artwork source, progress, failed-item isolation and ZIP collection. Both tiled and single-STL Parts recipes were tested. Limits: 20 images, 128 MB combined input, 64 MB per image, 256 MB collection, two million triangles per audited STL. Folder discovery and parameter-sweep UI remain CLI-only limitations for M6.

Native CLI now also collects upstream Parts across terminal hardware branches, preserves closest transformed filenames, namespaces collisions and verifies stored STLs before writing. Direct `--seam-angle` routes through a validated execution-only Engine setting into the legacy exporter; the runtime catalogue remains exactly 24 types / 217 fields. The option bevels seam faces away from vertical; CLI help was corrected accordingly.

Mounting joiner clearance conversions were reconciled: ordinary/threaded mounting-hole clearance is diametral; nut/pad thread clearance remains radial. Registration now checks common hole insets even for equal square plates with differing margins. Border metadata records actual slab numbers, filenames and assembly coordinates.

## Geometry repairs and remaining limitation

Calibration root cause: the old fit strip appended overlapping dimple cutters into one non-manifold boolean operand. Sequential dimple cuts fix it. The retained real old 3 mm hex STL has 24 degenerate faces; the repaired strip has zero, with unchanged fit dimensions. Native regressions cover both shapes, all connector diameters and detail limits. The historical invalid STL still fails the unchanged independent export guard.

The exact M4 one-pass Spread fixture was reproduced. Its first divergent choice was between symmetric equal-length rays, ranked using platform-sensitive floating-point noise. Stable total ordering at 1e-9 mm with deterministic endpoint ties preserves the much coarser 0.0001 mm polygon grid and fixes the measured discrepancy: native, ST and MT produced matching 3,152 triangles, volume 9490.669796050599 mm³ and identical routes. Before/after diagnostics are in `docs/m5/spread-*-investigation.json`. Do not claim universal equivalence without the remaining broader replay.

A separate tiled-ring case exposed collinear CSG facets. `mesh/collinear.rs` implements a checked local manifold edge-collapse cleanup. Moved vertices must stay on every incident plane; winding, topology, used-vertex bounds, components and volume must be preserved. The actual retained fixture is a regression test. Cleanup is best effort: unrepairable files remain visible with `meta.tiling.facet_cleanup[].unresolved`; independent STL guards block them. Do not silently remove failed parts or weaken validation.

Important remaining defect: the additional ring probe still has four degenerate faces in `stencil_r1c2.stl` at both 0° and 20°; two other previously bad tiles are repaired. Some narrower-frame raster grids also remain unrepairable. This is an explicit manufacturing release limitation to document for M6, not a completed universal mesh repair. `docs/m5/cli-seam-angle.json` records the current checks; the earlier report is retained separately. The simple direct-CLI seam fixture passes every independent stored-STL check and differs between angles.

## Accepted checks so far

- Latest full Rust workspace: 153 core + 13 CLI + 1 findings parity = 167 passed. Log `sandbox/m5-rust-final.log`.
- Latest ST and MT WASM builds succeeded: `sandbox/m5-st-final-build.log`, `sandbox/m5-mt-final-build.log`. Threaded helper patched by `sandbox/m5_wasm.ps1`.
- Preservation: 24 types, 217 unique qualified names, all 107 pinned source hashes; `sandbox/m5-preservation.log`.
- Native corpus: 48 cases, 46 valid meshes and two blank-input refusals; `docs/m5/corpus-results.json`, `sandbox/m5-corpus.log`.
- A/B/D control matrices passed: 38 + 29 + 17 real change/reset/reopen/output checks; logs `sandbox/m5-abd-tests.log`.
- C editor/guide tests passed with repaired default fit strip; actual colour masks for 2–10 colours and two registration groups passed.
- Twelve targeted model/export/batch tests passed after fixing unknown-key qualification and single-STL batch handling: `sandbox/m5-targeted-browser.log`.
- Complete manufacturing ZIP independently extracted, CRC/hash checked, all actual STL entries validated; representative package in `docs/m5/exports/`.
- Light/dark/narrow export/settings accessibility passed: `sandbox/m5-manufacturing-visuals.log`, `docs/m5/manufacturing-accessibility.json`.
- npm audit was run to `sandbox/m5-npm-audit.json`; inspect before reporting its totals.

The full browser run was intentionally stopped to incorporate the final geometry work. It is NOT an accepted full run. An earlier run caught the now-fixed unknown-key `editable()` issue. Do not report its 174 tests as passing.

The strict C matrix is also NOT complete after repair: one run lost its shared preview server; another timed out under concurrent compiler/browser load. The isolated `pads.long_edge` probe passed. `docs/m5/c-coverage.json` currently contains only THREE rows; `c-pre-repair-coverage.json` retains all 44 diagnostic pre-repair rows. Final C must be rerun without `M5_PRE_REPAIR`. Replayed geometry coverage currently has 40/48 rows from an interrupted run. Do not merge these partial files as completed 217 coverage.

## Resume sequence

1. Read this note and the full brief. No new worktree or subagents are needed/authorized.
2. Source Rust and latest `web/pkg` / `web/public/pkg-mt` are current. `web/dist` is behind the final WASM and UI polish. Run `npm --prefix web run build:regression` before browser verification.
3. Start one independently owned preview on 5199 so parallel test runners cannot shut each other's server down. Prefer running the full browser suite alone after builds finish; heavy concurrent jobs caused proof timeouts. Run `npx playwright test --output ../sandbox/m5/full-test-results` from `web`, capturing a fresh full log. There should now be 175 tests. Fix actual failures without deleting original tests or weakening geometry checks.
4. Complete strict C44 and the preserved artwork41/geometry48 replays. Only then run `scripts/m5/collect_evidence.py` to merge 128 M5 + 89 prior slots. The script may need small evidence-format/path fixes; verify its assertions honestly.
5. Run dense hardware M3–M10 and 128-segment checks (`m5d-manufacturing.spec.ts`), full ZIP selections/shared branches, negative guards, final offline/cancellation cases and production-only tests. The dense hardware test has not yet been run.
6. `scripts/m5/verify_modes.mjs` is prepared for all 256 before/after M5 field fixtures (or a diagnostic sample via `M5_MODES_SAMPLE`). It has NOT been run. `compare_geometry.py` validates complete native packages and compares leaf files against ST/MT; hardware native ZIPs legitimately include upstream plates absent from a leaf-only worker output. Log any real discrepancies; do not hide invalid extras.
7. Update README/USAGE (still describe M4/89 fields), write the comprehensive M5 report, limits, examples, manifests, final matrix and accepted logs. M0–M4 evidence must remain untouched. Previous test writers were redirected to `docs/m5/replay/m4`.
8. Finish D commit/publication through the GitHub connector; ordinary shell push authentication is not configured. Preserve A/B/C checkpoint chain above. `sandbox/m5_payload.py` and `m5_payload_chunk.py` prepare canonical Git tree payloads; binary uploads must match expected Git blob SHA and created trees must match local trees before updating main with expected SHA. No PR was requested.
9. Verify GitHub Rust/web CI, build customer-only assets and embedded Windows binary from a clean published revision, verify all served asset hashes/isolation and test-entry 404s, restart the user-facing server on 5210 and open it if useful. Packaging helpers under `scripts/m4` can be adapted to write only M5 evidence. Never overwrite historical M4 reports.
10. Commit final verification documentation and stop after M5. No M6 implementation without new instructions.

Useful local scripts: `sandbox/m5_status.cjs`, `m5_read.cjs`, `m5_native.ps1`, `m5_wasm.ps1`, `m5_quality.ps1`. Always source `sandbox/m0/env.ps1` for native MSVC linking. Use `pwsh`, not Windows PowerShell 5.1, for clean UTF-8 logs. Python text edits must explicitly use UTF-8. Some STL/ZIP evidence is ignored by Git and will need explicit force-add. All current pending source and artifacts are preserved locally.
