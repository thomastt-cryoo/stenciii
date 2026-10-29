# M0 — Baseline builds, tests and readiness

Audit date: 29 October 2026 (Asia/Dubai). Upstream source: v2.9.4, `5d8df15b798b859faf72248a35d156d6e9aaffc7`. This records observed local outcomes, not an assumption that upstream CI passes. Original failures and subsequent verification are both retained.

## Environment and reproducibility

Windows x64; Rust stable 1.99.0 (`b940084d7`, 2026-09-28); Cargo 1.99.0; Node 26.3.0; npm 11.12.1; wasm-pack 0.15.0; Playwright 1.64.0 from the committed npm lock; Chromium 156.0.8078.4 (build 1248). Upstream CI uses Node 22, so a Node 22-specific run remains separate from this local result. Threaded builds use nightly 1.101.0 (`41089d07a`, 2026-10-27), rust-src and the wasm32-unknown-unknown target.

The initial shell could not find `link.exe`. Importing the installed Visual Studio Build Tools environment located the linker but still failed with missing `kernel32.lib`: the Windows SDK libraries were absent. A workspace-local Microsoft.Windows.SDK.CPP.x64 10.0.28000.2957 package supplied `c/um/x64` and `c/ucrt/x64`; the installed MSVC 14.44.35207 supplies the third library path and linker. No engine workaround, global PATH change or SDK installation was needed. Those local development files live under ignored `sandbox/m0/` and are not distributed with the product.

The full MSVC/SDK install is the usual reproducible setup on another Windows machine. In a prepared developer PowerShell, run:

```powershell
cargo test --release --workspace --no-fail-fast
cargo run --release -p stencil-core --example catalogue > docs/audit/runtime-catalogue.json
# On a fresh snapshot clone, fetch the provenance objects once for the source hash audit:
git fetch --no-tags https://github.com/filipealmeida/graffiti-stencil-maker.git 5d8df15b798b859faf72248a35d156d6e9aaffc7
python scripts/m0/audit.py --check
```

Single-thread browser engine and app:

```powershell
rustup target add wasm32-unknown-unknown
Set-Location crates/stencil-wasm
wasm-pack build --release --target web --out-dir ../../web/pkg
Set-Location ../../web
npm ci
npm audit --audit-level=high
npm run build
npx playwright install chromium
npx playwright test
```

For the threaded build use the RUSTFLAGS and `--features threads -Z build-std=panic_abort,std` command in INSTALL.md, then **run `node scripts/patch-mt-worker.mjs` before building the web app**. Test with `EXPECT_THREADS=1` so successful fallback cannot conceal broken thread startup. A separate CARGO_TARGET_DIR for nightly avoids locking/replacing the stable artifacts. `web/playwright.config.ts` uses port 5199, one worker and 90 s default timeout; several mounting tests extend the timeout themselves.

## Original baseline defects and minimal changes

| Item | Actual observation | Resolution / scope |
|---|---|---|
| Shell toolchain | `cargo test --release --workspace` failed before test execution because linker, then SDK libraries, were unavailable | Local development environment configured as above; not counted as an engine test failure |
| Windows parameter-reference test | First runnable suite: CLI 11 passed, 1 failed (`the_parameter_reference_is_up_to_date`); Cargo stopped before core tests. Git checked PARAMETERS.md out with CRLF while CLI stdout uses LF. Raw suffix comparison false; after newline normalization true. | Normalize CRLF only inside the existing test comparison; parameter content/engine untouched. Full rerun required below. |
| Released Windows studio thread startup | Verified ZIP launches HTTP server, but Chromium receives four 404s for `/pkg-mt/`; the worker helper still contains `import('../../..')`. Initialization waits without reaching its fallback, so image load never creates the recipe. | `patch-mt-worker.mjs` walked URL.pathname, which has `/C:/...` on Windows, then swallowed the filesystem failure. Change it to `fileURLToPath(root)`. Rebuild/patch and run threaded test below. No redesign or engine behavior changes. |
| Released studio single-thread isolation test | In a test-only route, removed isolation headers to force the release's ST fallback: original SVG → vector STL succeeded, 3D canvas opened, file downloaded, zero external requests/failures/page errors | Diagnoses the thread boot failure; not a claim that the downloaded Windows ZIP works unmodified |
| Expanded-border browser assertion races computation | The viewer toolbar is visible while it still displays an upstream plate. On ST, the border calculation took 53.4 seconds, consuming almost all the dimension assertion's 60-second budget before its output loaded. | Wait for the actual Expand margin operation to finish before checking its viewer dimensions. Keep the existing dimension assertion and overall test timeout. Record full/retry outcomes below. |

Only the reference-test newline handling, Windows worker-patch path handling, border-test synchronization, audit example/scripts and audit documents are changed in M0. The original UI remains available.

## Independent file validation

Run `python scripts/m0/validate_artifacts.py FILE... --output report.json`. The validator uses the standard library and does not call the stencil engine or repair output. For binary STL it checks exact header/triangle length, finite coordinates/normals, positive absolute enclosed volume, nondegenerate faces, edge sharing, opposite edge winding, connected-component counts and measured bounds. ZIP checks include CRC and duplicate names, and each contained STL is validated. SVG uses XML parsing; PNG checks signature/IHDR dimensions. Component counts are reported rather than assuming that alignment-pin sets must be one piece.

M0 generated native raster/vector ring STLs, a six-file stencil/hardware ZIP and a browser-downloaded vector STL. All files pass structure/finite-coordinate, edge-sharing, consistent-winding and nonzero-volume checks, but a stricter collinearity check **fails** the raster STL (2 zero-area triangles), the ZIP's raster plate (2), and its fit-test strip (24). The CLI vector and browser vector STLs have no degenerate faces and pass every check. Engine watertight checks therefore do not establish a clean triangulation; no files were silently repaired. The raster plate has 1,160 triangles; vector 432; both have one connected component. Requested 2 mm base thickness measured 2.2 mm after the default extra top layer, confirming why UI must show actual output height. Readiness of the raster example is `check` because of measured overhang; its current report does not detect degenerate triangles. Preserve that distinction and add geometry diagnostics before release.

## Coverage limits and remaining platform checks

Native workspace tests cover geometry, graph evaluation, parameters, saved projects, reports, hardware, layout and batch/sweeps. Browser tests cover UI behavior and shared findings/preset logic. Neither proves all 217 parameters across all valid combinations, print success on every printer, or lossless import through a future UI. The mapping's PC-1 checks catalogue coverage; UI-1 is a future control-wiring gate.

macOS/Linux binaries are measured from published asset metadata but not executed here. Safari/Firefox, macOS WKWebView, Windows Tauri/WebView2, signed installers, fresh offline machines, local browser storage failure/corruption, imported external-resource SVGs and arbitrary unsupported legacy JSON round trips require later platform/corpus testing. There is no new Tauri package or redesigned UI to test in M0. Do not call these tests passed.

The release package omits the DejaVu and consolidated dependency notices. That is a distribution issue to fix before shipping; the source notice files remain intact. The current CLI `--seam-angle` direct-image routing defect and hardware export aggregation risk are documented in FEATURE_INVENTORY.md; they are not quietly fixed by this milestone.

The source-built embedded server was also checked against the seven-file single-thread site manifest: every response is HTTP 200, its SHA-256 matches the build input, JavaScript/WASM MIME types are correct, and COOP/COEP headers are present. Its browser smoke blocks non-local HTTP requests, imports a real SVG, exports/validates trace SVG and STL, saves a version 2 project, verifies embedded original bytes, then reopens and explicitly reruns it. A preliminary rapid New → reopen without Rerun left the four processing steps without results for 90 seconds; explicit Rerun succeeds. This is a separate existing application-state defect, not evidence of lost image/project data. A CLI run of the browser-saved project and a layout-only PNG export are independently validated too.

## Final result table

| Check | Observed outcome | Evidence |
|---|---|---|
| Runtime catalogue / PC-1 | PASS: 24 types, 217 qualified slots, all documented names mapped; all referenced tests exist; 107 pinned files hashed | `python scripts/m0/audit.py --check`; [catalogue](audit/runtime-catalogue.json), [mapping](audit/parameter-mapping.json), [source manifest](audit/source-manifest.json) |
| Rust workspace, release, no-fail-fast | PASS: **156 passed, 0 failed, 0 ignored**: 143 core + 12 CLI + 1 shared-finding parity test; other targets/doc-tests contain 0 tests | [Final Rust log](audit/logs/rust-tests-final.log) |
| Original runnable Rust baseline | CLI 11 passed, 1 failed from CRLF comparison; Cargo stopped before core; resolved by test normalization and full rerun | [Initial runnable log](audit/logs/rust-tests-configured.log) |
| npm install and audit | PASS: clean lockfile install; **0 vulnerabilities** at audit time | [npm log](audit/logs/npm-ci.log), [audit JSON](audit/npm-audit.json) |
| Stable single-thread WASM build | PASS, release + wasm-opt; engine 4,182,596 bytes | [Build log](audit/logs/wasm-build-configured.log) |
| Nightly multi-thread WASM build | PASS, release + build-std + atomics + wasm-opt; engine 4,385,841 bytes | [Build log](audit/logs/wasm-mt-build.log) |
| Windows threaded helper patch | PASS: one real helper patched; initialized threaded engine in full suite | [Patch log](audit/logs/mt-patch.log) |
| TypeScript + Vite production builds | PASS for ST and dual-engine sites | [ST build](audit/logs/web-build-st.log), [MT build](audit/logs/web-build-mt.log) |
| Initial ST Chromium suite | **82 passed, 1 failed**, 0 skipped/flaky; 676.4 s. Border-dimension check raced the running operation | [Every test result](audit/test-results.json) |
| ST border test after synchronization fix | PASS: **1 passed**, 0 failed/skipped/flaky; 77.3 s. The entire ST suite was not rerun after this test-only change | [Every test result](audit/test-results.json) |
| Final MT Chromium suite, `EXPECT_THREADS=1` | PASS: **83 passed**, 0 failed/skipped/flaky; 320.7 s. Includes thread-budget assertion requiring multi-thread mode, keyboard/responsive checks, axe, layout/hardware, findings and presets | [Every test result](audit/test-results.json) |
| Embedded Windows CLI + launcher build | PASS; 12,046,848-byte CLI and 266,752-byte launcher. This build embeds the ST site snapshot | [Build log](audit/logs/embedded-build.log) |
| Embedded server HTTP/build identity | PASS: all 7 embedded files byte-identical to ST site input, correct MIME/COOP/COEP | [HTTP checks](audit/embedded-http-check.json), [input manifest](audit/site-st-manifest.json) |
| Source-built browser export/project smoke | PASS with explicit Rerun after reopen; original embedded SVG bytes equal input, 4-step project preserved, SVG/STL downloaded, 3D view drawn, no non-local requests attempted | [Smoke result](audit/source-browser-smoke.json), [log](audit/logs/source-smoke.log) |
| Source browser SVG/STL + native project replay | PASS: valid SVG (1 path containing the traced loops), both vector STLs closed/oriented with 2,468 triangles each and no degenerate faces | [Independent validation](audit/source-artifact-validation.json) |
| Layout-only native PNG export | PASS: valid 1000 × 1000 layout PNG | [Validation](audit/layout-validation.json) |
| Additional raster/vector/hardware file checks | PARTIAL: every STL structurally valid and edge-closed, ZIP CRC/names valid; strict geometric check fails 2 zero-area faces in raster plate and 24 in calibration strip. Vector samples pass | [Per-file geometry results](audit/artifact-validation.json) |
| Direct CLI seam-angle experiment | FAIL: requests 0° and 30° both report 0°; canonical triangles match on all five output files | [Comparison](audit/seam-routing.json), [CLI log](audit/logs/seam-routing.log) |
| Unmodified upstream Windows ZIP | Server launches; MT browser initialization FAILS with directory import 404s; forced-ST diagnostic succeeds. Rebuild required for patch | [Browser diagnostic](audit/release-diagnostic.json) |
| Formatting / audit scripts | PASS: targeted Rust formatting, Python compilation, JS syntax, generated-matrix check and `git diff --check` | Commands run locally; no additional geometry changes |

The earlier nondegeneracy check detected duplicate vertices only; adding an actual triangle-area check exposed the zero-area faces above. The final validator/report includes that stronger check and intentionally returns nonzero for those files. A mesh is not relabelled clean simply because the engine or an earlier narrower check accepted it.

## Measured local package sizes

| Measurement archive | Bytes | Decimal MB | Scope |
|---|---:|---:|---|
| Windows CLI + launcher, ST baseline | 5,244,026 | 5.244 | Includes root docs/license and DejaVu notice; not a signed/final distribution |
| Browser static site, both engines | 3,884,917 | 3.885 | 9,578,323 bytes uncompressed; requires a local HTTP server/launcher |

Both are below 20,000,000 bytes. [package-sizes.json](audit/package-sizes.json) records these actual measurements. The browser archive alone is not a double-click `index.html` product; complete shipping notices, launchers, fresh-machine offline testing and final platform packaging still need work. No macOS or Tauri package was built in M0.

## M0 completion and M1 readiness

**M0 is complete: source is pinned, the existing application is built and run, available Rust/web suites are executed, every runtime parameter is mapped, complex workflow preservation is designed, and results/risks are documented. The original node UI is unchanged.** Audit evidence and the three narrow baseline fixes are committed with this report.

**Ready to begin M1 only when the user provides the next milestone instructions. Not release-ready.** Start with the lossless project/recipe adapter, import-generation regression fixtures and catalogue-backed inspector architecture. Keep the engine baseline and recorded defects visible; do not promise a clean raster/calibration mesh, working direct CLI bevel flag, automatic rapid reopen, complete shipping notices or tested macOS/Tauri support. Export aggregation and unknown-project preservation require explicit acceptance tests. M0 introduces no redesigned UI, packaging commitment, published application release or new processing algorithms.
