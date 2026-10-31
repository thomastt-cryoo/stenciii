# M7 - Offline browser distribution

Review date: 31 October 2026. Scope follows the user's explicit change to a browser edition for Windows and Mac. No native editor, public hosting, commercial release or M8 work is included.

**M7 browser delivery: qualified with documented limits for the measured configurations.** The [Intel Safari viewer repair](m7/SAFARI_INTEL_FIX.md) now provides tested software 3D on Safari 26.6. Windows Firefox in the unchanged Windows download had no working WebGL2 on its test runner. Windows 10 and first-download OS approval UI are unverified. There is no blanket all-browser/all-OS certification. This report distinguishes a successful build, a real graphical launcher, browser integration and first-download OS security approval.

## 1. Exact implementation and verification sources

The browser product implementation began at `900c14cf424eb2532b42e9da67df7176fca2a84f`. The demonstrated Firefox reload defect was fixed at `670aad80fe5fe648f802fa429aa67c55ea2b538a`: a WebSocket close now prompts an HTTP session check and reconnect, rather than immediately replacing the document. This preserves Firefox refresh while still ending browser workers after real shutdown. Other later commits add shipping notices, packaging, tests and documentation. Historical complete-notice Windows and Apple Silicon candidates were built at `1561d8d22bcbc36e4f1325a7f632e52369358156`; the historical Intel candidate was built at `1f31e1f29703b0181e02d8e7453c331fc69089c3`. The pre-repair package harness was `756a4251e3737e10c80279824aadbb35ccfcc972`; final runtime qualification uses the repaired source above. Old candidates are retained for provenance, not relabeled as the repaired delivery.

The accepted M6 baseline remains `b5756e733b59dc63abf3f1d7c22c371a03adba47`. [Core preservation evidence](m7/core-preservation.json) records all 57 engine/WASM source files unchanged. No core geometry algorithm was changed for packaging. Existing M6 reports and reference outputs remain intact.

## 2. Packaging architecture and decision

A small graphical launcher opens the complete embedded React/WASM editor in an installed browser. Its read-only Rust server binds only to loopback. It serves both WASM engines, scripts, workers and fonts locally. Customers install no Rust, Node, npm, Python, WebView runtime or separate server. No browser is bundled.

Portable ZIPs avoid an administrator installer, extra setup runtime and installer/uninstaller state. Each package is below the conservative 20,000,000-byte limit. Updates replace a complete folder or app bundle; saved projects stay outside it. Native editor windows were removed from scope by the user, rather than being claimed as implemented through a launcher. See [architecture](m7/PACKAGING_ARCHITECTURE.md).

The server validates Host/Origin, rejects unsafe decoded paths, exposes no customer filesystem or write API, applies isolation/security headers, and guards its tab-presence WebSocket with a random session nonce. File hashes detect damage, not publisher authenticity. A stable remembered port preserves browser origin; a busy port offers an explicitly temporary session without overwriting the old address.

## 3. Windows package

`StencilStudio-Windows-x64.zip` is a portable x64 browser edition. Root `Stencil Studio.exe` is a Windows GUI launcher; `Studio Support/stencil.exe` contains the embedded app. The backend is hidden. Both link the CRT statically. The import audit identifies only Windows system DLLs, with no separate Visual C++ runtime DLL or WebView2 requirement.

## 4. Apple Silicon package

`StencilStudio-macOS-Apple-Silicon.zip` contains a native ARM64 `Stencil Studio.app` launcher plus outer instructions. The editor runs in the browser. The launcher and backend were compiled and executed on genuine Mac runners, not cross-compiled on Windows. The complete-notice candidate has ad hoc signatures verified with `codesign --verify --deep --strict`.

## 5. Intel Mac package

`StencilStudio-macOS-Intel.zip` contains the x86_64 app launcher. It was built and launched on a genuine macOS Intel runner. Chromium passed all 15 representative projects in run `41119450234`; Chrome passed four projects, single-thread fallback and a two-job manufacturing sweep. Safari/Firefox results are recorded separately. No Universal download is needed: separate ZIPs plus the PDF and checksum file total five uploads.

## 6. Offline layout

Windows: launcher, `Studio Support/`, `Read First.txt` and `Platform Test Record.txt`. Mac: intact `.app`, `Read First.txt` and `Platform Test Record.txt`. Support resources include the backend, `build-info.json`, a package integrity manifest, full notices, font licenses, Rust runtime copyright material and required MPL source archives. The normal production bundle excludes legacy editor and regression harness pages.

## 7-8. Exact delivered sizes and SHA-256

Windows and Apple Silicon retain runtime source `670aad80fe5fe648f802fa429aa67c55ea2b538a`; the updated Intel runtime uses `11819c3b87556ab152f28f351bcc0235bed4f3ea`. The Intel follow-up and per-platform current records are in [the repair report](m7/SAFARI_INTEL_FIX.md). The five final files and exact hashes are recorded in [delivery-manifest.json](../distribution/m7/delivery-manifest.json). The canonical compressed bytes come from delivery assembly run [41134317606](https://github.com/thomastt-cryoo/stenciii/actions/runs/41134317606), source `a87c391e7ea3f059f525bbd63150842e5b3100c5`. Archive bytes differed between the local and CI Python environments; the final local files were replaced with the retained CI bytes and rehashed. All runtime/notice member hashes matched in both assemblies. Its per-member audit proves that adding the reviewed outer instructions did not change a tested runtime, signature, manifest, permission or license file. The checksum text hashes the other four deliverables; its own hash appears in the manifest/report to avoid a circular self-hash.

| Final deliverable | Exact bytes | SHA-256 |
|---|---:|---|
| StencilStudio-Windows-x64.zip | 8,242,785 | `bb8c5a8a14e6d2acaef36d5e0a39e8b3a1c179fefd3d16f9acd3b37825f935f5` |
| StencilStudio-macOS-Apple-Silicon.zip | 7,832,696 | `c602b64f5894fea31b3e75511e61f3e6825074ed557e678573c0b5b09b23655a` |
| StencilStudio-macOS-Intel.zip | 8,225,479 | `21298dcc72cbb397854989886cad2f942b0ba2320a1c2d8d85db4c186beb8d1c` |
| StencilStudio-Quick-Start.pdf | 43,171 | `89868c6d2cebf0684ee81591a603c457398744fd008269387e226ea8d38f6a03` |
| Read Me and Checksums.txt | 700 | `038b3a8c986e39520789bb112dfd4cb5f14d1e81b3e871c6dbba3c8a09f0ab88` |

Final tested runtime ZIPs before the outer instruction update:

| Platform | Exact bytes | SHA-256 |
|---|---:|---|
| windows-x64 | 8,262,443 | `f675a8877673c2cf8925eb2dd1165c7ea9d1d8bfb2f8bf0a9e9aae27628eff09` |
| macos-arm64 | 7,845,887 | `a58ca2840ae07ae6c9fb7dbdcd7bdc8a64056ab7a6296392d57dcd9be36a50ad` |
| macos-x64 | 8,242,918 | `e632e643d64f3c152a4dd2f970866f14d6a3e94ba82b20e166cf034cdd6f96ee` |

Historical candidates retained for provenance (not the final delivery):

| Candidate | Exact ZIP bytes | SHA-256 |
|---|---:|---|
| Windows CI | 8,262,105 | `6878e2b9f7949b69a372701f5c38ba77cf3360ae6b4ea57f827a6846f9ddfed3` |
| Apple Silicon | 7,917,733 | `ab83cd37550a899156d9268281208409c46829b72eba10024ecb5afd67dfb792` |
| Intel | 8,242,864 | `e167469691e2d0401df3bcead28662fa8669d19a73e82dd613965630671a64bb` |
| Additional local Windows validation build | 8,430,682 | `f420f254389dcf3776cb20fdc408972fd8f7660bad904392642dc913bbb72240` |

Local and CI Windows builds share product source but differ in build provenance and exact binary bytes. The local 139-test result is explicitly attributed to the local ZIP, not silently relabeled as a test of the CI binary.

## 9. Windows actual launch and offline evidence

The local package ran on Windows 11 Home, build 10.0.26300, using an isolated app/browser profile. Normal graphical launch opened the OS default Chrome browser and displayed the native controller without a command window; its Quit Studio button ended both launcher and backend. An actual screenshot is retained in [screenshots](m7/screenshots/windows-launcher.jpg). This interaction occurred before the user disabled Computer Use; subsequent work used code and isolated automated tests.

The extracted local package passed all 14 original acceptance projects plus the explicit Smooth Vector case, actual STL/ZIP disk downloads, lossless saved-project reopen, single-thread fallback and a real batch sweep. Threaded diagnostics reported four workers. Both the historical package and the repaired local build passed all 139 unchanged M6 production-browser tests with zero skipped, unexpected or flaky tests. The repaired local ZIP is 8,431,015 bytes, SHA-256 `288b8f9cd435c1df793607290e7bc9a56069992426fd745184509d0424414ee1`. [Repaired production summary](m7/evidence/fixed-local-windows-production.json). Its seven lifecycle checks additionally verify transient socket reconnection and refresh. [Repaired lifecycle evidence](m7/evidence/fixed-local-windows-lifecycle.json).

The exact shipped CI runtime additionally ran on Windows 11: mounting/hardware, registered colour branches and Smooth Vector passed actual 3D, disk downloads, lossless reopen, forced single-thread fallback, four-worker initialization and a two-job all-format sweep. All 17 host checks and seven damage/removal checks passed on that exact ZIP. [Shipping Windows 11 evidence](m7/evidence/shipping-windows11-package.json), [host](m7/evidence/shipping-windows11-host.json), [damage](m7/evidence/shipping-windows11-damage.json). Simultaneous-launch/multiple-project/update-origin checks also passed. The restricted-PATH test used only Windows system directories and still launched, returned HTTP 200 and shut down. [Runtime prerequisites](m7/windows-runtime-prerequisites.json).

Fresh hosted Windows Server 2025 package tests supplement this consumer Windows 11 test. A clean Windows 10 machine and a fresh consumer Windows 11 VM were unavailable; neither is claimed tested. Initial SmartScreen/reputation handling on a downloaded file with Mark of the Web is not certified.

## 10. Mac actual launch and offline evidence

The initial ARM runtime completed all 14 original projects on macOS 15 in run `41100143518`; that early ZIP is not delivered because its notices were incomplete. The final complete-notice ARM candidate subsequently ran on macOS 26.6.2 (25G83), with native launcher/default-Safari startup and actual Chrome/Chromium 3D and export tests. Intel ran on macOS 15.7.9 (24G830), with the native controller and all 15 Chromium projects. The repaired final ARM and Intel packages each passed all 15 Chromium projects, four Chrome projects, four Firefox projects, forced single-thread fallback, real two-job all-format sweeps, host checks and seven lifecycle checks. ARM Safari passed four projects with actual WebGL. The original Intel Safari attempt failed 3D; the [subsequent repaired Intel package](m7/SAFARI_INTEL_FIX.md) passed four Safari projects with real software-rasterized 3D and native pointer controls. [Final package matrix](m7/evidence/final-browser-matrix.json).

Offline automation blocks every browser request to a non-loopback HTTP host during the Chromium/Firefox collection. The app still initializes real WASM, imports projects and produces independently valid exports. Safari additionally records resource hosts; this is not an OS-wide physical network disconnection. No claim is made that browser-vendor/OS background traffic was captured. Static asset/source review found no telemetry, accounts, external artwork upload, remote API or recurring license check.

## 11. Browser compatibility

Chrome is the recommended cross-platform browser; Edge is additionally tested on Windows. Exact package/browser versions, case counts, graphics prerequisites and final failures are retained in the qualification evidence and customer Platform Test Record. Browser requirements include WebAssembly, workers, local downloads/storage and working WebGL2 for 3D inspection. No GPU blocklist or security preference is forcibly disabled.

| System | Browser / exact version | Project cases | Result |
|---|---|---:|---|
| windows-x64 | chromium 156.0.8078.4 | 15 | Passed |
| windows-x64 | chrome 156.0.8078.48 | 4 | Passed |
| windows-x64 | firefox 157.0 | 4 | Partial: generation/reopen/batch passed; 3D unavailable on this runner |
| windows-x64 | edge 155.0.4283.62 | 4 | Passed |
| macos-arm64 | chromium 156.0.8078.4 | 15 | Passed with single-thread execution (runner core budget) |
| macos-arm64 | chrome 155.0.8059.40 | 4 | Passed with single-thread execution (runner core budget) |
| macos-arm64 | firefox 157.0 | 4 | Passed with single-thread execution (runner core budget) |
| macos-arm64 | safari 26.6.2 | 4 | Passed |
| macos-x64 | chromium 156.0.8078.4 | 15 | Passed |
| macos-x64 | chrome 151.0.7922.174 | 4 | Passed |
| macos-x64 | firefox 157.0 | 4 | Passed |
| macos-x64 | safari 26.6 | 4 | Passed with software 3D in the Intel viewer follow-up |

Chromium includes the complete 15-case collection. Each Chrome/Firefox run additionally exercises forced single-thread fallback and the two-job all-format sweep. Safari uses actual Apple WebDriver and retrieves real Blob export bytes; OS disk downloads are separately tested in Chromium. Safari thread mode was not recorded. Edge on Mac was not tested. The archived original M7 matrix has zero Safari Intel completed cases because its first case failed 3D after export validation; the current Intel follow-up completed all four.

An independent empty canvas is checked before attributing an unavailable WebGL2 context to the application. A browser that cannot create WebGL2 receives an explicit 3D-unavailable notice while verified STL export remains available. Such a result is recorded as a graphics limitation, never a 3D pass. A working empty context followed by an application rendering failure still fails qualification.

## 12. Native UI screenshots

The Windows screenshot above is the actual normal launcher. Actual [ARM](https://github.com/thomastt-cryoo/stenciii/blob/codex/m7-artifacts/670aad80fe5fe648f802fa429aa67c55ea2b538a/macos-arm64/actual-launcher.png) and [Intel](https://github.com/thomastt-cryoo/stenciii/blob/codex/m7-artifacts/670aad80fe5fe648f802fa429aa67c55ea2b538a/macos-x64/actual-launcher.png) native controller screenshots are retained under the platform directories on `codex/m7-artifacts`. ARM shows the controller in front of the local Safari editor; Intel shows the native controller. Both current Mac screenshots were visually inspected. These prove native launcher rendering, not a native editor or interactive Finder/Gatekeeper walkthrough. Automated browser screenshots show actual generated 3D meshes.

## 13. Extraction, updates and removal

Every CI candidate is extracted as a customer download. Mac uses `ditto` and verifies bundle signatures. Windows tests extraction into Unicode/spaced paths and damaged, missing, unsafe or locked support-file refusal. Removing/replacing the portable folder preserves separately saved project files. The lifecycle check launches six copies simultaneously, keeps two independent project tabs, saves both, closes one, stops the launcher, verifies worker-document shutdown, launches a complete copy from an updated folder at the same origin, restores the exact draft, and closes the last tab.

Windows settings: `%LOCALAPPDATA%\Stencil Studio\Stencil Studio\data`. Mac settings: `~/Library/Application Support/com.Stencil-Studio.Stencil-Studio`. Browser drafts belong to browser/profile/origin and have one shared draft slot. Multiple tabs can hold and save separate live projects, but do not get separate automatic draft slots. Private/full/blocked storage needs Save Project. Saved projects should be outside the app folder. Company security policies and first-download quarantine approval are separate limits.

## 14. Full production regressions

Unmodified standard CI run [41129672908](https://github.com/thomastt-cryoo/stenciii/actions/runs/41129672908) for repaired source `670aad80fe5fe648f802fa429aa67c55ea2b538a` passed **173 Rust tests and 248 browser tests**. It built both real WASM engines, checked the threaded helper and production assets, ran native equivalence tests, and skipped public deployment. The repaired extracted local Windows customer build separately passed **139 production tests**, all enabled. [Final suite evidence](m7/evidence/final-standard-ci.json) and complete run history are retained. Interrupted local duplicate Rust/full-web runs are not counted as passes.

## 15. Independent output validation and parity

The 15-project acceptance collection covers image transparency, photographs, text, all stencil styles, tone patterns, colour registration, 400 mm tiled assemblies, manual layout edits, shared hardware/multiple images, legacy projects and Smooth Vector explicitly. It uses real processing, 3D, exports and lossless save/reopen. This does not claim all 217 controls were manually clicked on Mac; that comprehensive M6 audit remains separate.

`prove_export.py` independently checks STL closure/orientation, dimensions, volume and unit normals; ZIP CRC, safe paths and required manufacturing content; and exact M6 oriented-surface equivalence by methods A/B where references exist. Missing required references fail. Alternate triangulations receive no arbitrary visual tolerance. Batch validation checks the manifest and file hashes, JSON/CSV, full PNG decode/chunk CRC and SVG XML/viewBox. The actual two-job all-format sweep includes six STLs, two PNGs, two SVGs, five JSONs and one CSV. All 15 final Windows outputs were also independently compared against both Mac outputs: **30 cross-platform comparisons**, exact oriented-surface equivalence A/B, **zero surface deviation**. This is a cross-platform check, not a replacement for accepted M6 reference files. [Cross-platform evidence](m7/evidence/cross-platform-surfaces.json). [Local all-format evidence](m7/evidence/local-windows-formats.json).

## 16. WebView2 and WKWebView

Not applicable after the user's browser-only scope change. Neither runtime is embedded, installed, required or advertised. Safari WebDriver tests exercise genuine installed Safari; Playwright Chromium/Firefox tests are labeled by their actual engine. No Playwright WebKit result is presented as Safari or WKWebView verification.

## 17. Signing and first-run findings

Windows executables are unsigned. The locally built normal launch showed no SmartScreen warning, but this is not evidence for an internet download's reputation warning. Mac uses ad hoc integrity signing, without Developer ID or notarization. Actual `spctl --assess --type execute` rejected both Mac bundles, even though normal unquarantined CI app launch worked. The customer instructions disclose this and link Apple's app-specific Open Anyway procedure. A quarantined first-download approval/reopen UI was not exercised; no global Gatekeeper/antivirus/security exception is requested or applied.

## 18. Licenses and assets

[Shipping review](m7/LICENSE_REVIEW.md) covers 209 indexed components and 371 notice files with no missing notice material. Full fonts, third-party JS/Rust notices and pinned Rust standard-library copyright material are included. Unchanged complete published source archives are provided for MPL boolmesh 0.2.0 and option-ext 0.2.0, with independent integrity evidence. r-efi uses its MIT alternative. No GPL-only dependency was identified. The conservative resolution inventory is not a claim that every listed target/build dependency is linked into every binary. No browser, compiler, SDK, customer artwork corpus or test harness is redistributed in the app. This is an engineering compliance review, not legal certification.

## 19. Complete CI status and durable evidence

| Run | Purpose | Outcome |
|---|---|---|
| 41100143518 | Production assets, initial ARM real GUI/Chromium 14-case smoke | Passed; early license-incomplete ZIP not delivered |
| 41101821977 | Complete shipping notices and native packages | Failed QA fixture/download wait; retained packages reused |
| 41104838223 | ARM retest | Runner never acquired; capacity annotations, not an app launch failure |
| 41106596959 | Windows package reuse | Failed missing QA dependency; setup corrected |
| 41109193185 | Exact packages | Windows Chromium/Chrome/Edge passed; Firefox 3D failed; ARM capacity unavailable |
| 41119450234 | Explicit Smooth/format qualification; first Intel build | Chromium/Chrome/Edge passed; Firefox navigation/graphics and Safari validation/graphics failures retained |
| 41119457679 | Full preserved Rust/web CI | Passed 173 + 248; deploy skipped |
| 41128675152 | Corrected validation, graphics probe, reload and lifecycle checks | ARM Chromium 15, Chrome 4, Safari 4 and lifecycle passed; Firefox confirmed a real reload/session defect, then repaired |
| 41129666851 | Rebuilt repaired runtime and exact package qualification | Windows and ARM jobs passed. Intel Chromium/Chrome/Firefox/host/lifecycle passed; Safari Intel 3D failed, so the overall run remains red |
| 41129672908 | Full preserved CI for repaired runtime | Passed 173 Rust + 248 browser tests; deploy skipped |
| 41128683600 | Preserved standard CI after harness/workflow changes | Passed; not substituted for the repaired-source result above |

Raw reports, generated exports, screenshots and exact candidate ZIPs are retained on [`codex/m7-artifacts`](https://github.com/thomastt-cryoo/stenciii/tree/codex/m7-artifacts), under each QA source SHA/platform. This avoids relying only on expiring Actions artifacts. Source and review are tracked in [PR 1](https://github.com/thomastt-cryoo/stenciii/pull/1). [Complete M7 CI run snapshot](m7/evidence/ci-runs.json) includes every run on the milestone branch, including skipped producer workflows and earlier failed attempts. No test failure is relabeled as a successful browser qualification. Delivery assembly [41134317606](https://github.com/thomastt-cryoo/stenciii/actions/runs/41134317606) passed and retained the canonical five-file layout on the artifact branch. [Assembly evidence](m7/evidence/delivery-assembly.json) records all five canonical delivery hashes and their durable artifact commit. The final documentation/delivery assembly does not alter application source after the fully tested runtime commit.

## 20. Remaining limits

Only the exact exercised OS/browser configurations are qualified. Windows 10, older Mac versions, first-download quarantine/SmartScreen approval UI, managed corporate policies and every possible GPU/driver are untested. The Mac build target/Info.plist minimum 13.3 is not evidence that every macOS 13.3+ browser pair works. Physical print strength, fastener fit and material calibration retain M6's limits. Saved projects are the portable backup; browser storage can be unavailable. A browser that blocks local WebSockets needs the visible Quit Studio control. Offline browser-request isolation is not a packet capture of the whole OS. The unchanged Windows runtime retains its Firefox graphics limitation. The Intel follow-up corrected the old availability check: the returned WebGL objects were already lost, so their existence did not establish a usable graphics API. The updated Intel runtime renders real interactive 3D through its software path in that environment. Software preview uses CSS-pixel resolution, may rotate more slowly on large models and does not claim identical PBR lighting or physical-GPU qualification.

## 21. Proposed Etsy layout

Exactly five files in `distribution/m7/customer/`: Windows x64 ZIP, Mac Apple Silicon ZIP, Mac Intel ZIP, Quick Start PDF and Read Me/checksums text. Each is measured against the conservative 20,000,000-byte limit; no runtime is hidden behind a bootstrapper or external download. Customers choose their platform ZIP and keep their own saved projects. This is a reviewable technical delivery layout, not a published listing.

## 22. M8 readiness decision

M7 technical browser delivery is complete for the documented recommended configurations, with the explicit browser/OS/signing limits above. The three customer runtime packages are genuinely built, launched and exercised on their target architectures, and all final runtime/notice members are preserved exactly through the reviewed instruction update. M8 may be considered for those qualified configurations after user review. Broad Windows 10 and older-macOS claims remain unverified. Intel Safari follow-up results and its software-rendering limits are explicit in the linked repair report. Public hosting, tags, commercial release and M8 remain disabled until the user's next instructions.
