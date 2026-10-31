# Intel Mac Safari 3D viewer repair

Follow-up to M7, 31 October 2026. Application repair source: `11819c3b87556ab152f28f351bcc0235bed4f3ea`. No M8 or commercial release work is included.

## Finding

The genuine Intel runner uses an Apple Paravirtualized Graphics Device with 64 MB VRAM. Safari 26.6 on macOS 15.7.9 returns a WebGL object that is **already lost**: its version, precision and framebuffer data are unavailable. The old availability check only tested whether an object existed. Three.js then dereferenced the missing shader precision and the application caught that exception as a generic viewer failure.

The original exception was `TypeError: null is not an object (evaluating 'e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision')`. Diagnostic run `41147521427` captured it from the retained production bundle without changing production application source. Run `41147868094` tested WebGL 1/2, antialiasing on/off, alpha on/off and all three safe power preferences: all **24** configurations were already lost before drawing a pixel. [Measured context matrix](safari-intel/diagnosis.json).

This demonstrates a virtual graphics limitation, not general physical Intel Mac Safari incompatibility. GitHub's runner maintainers also describe unavailable native WebGL on their older virtual Mac environments in [runner-images issue 6924](https://github.com/actions/runner-images/issues/6924). A related null-precision failure is discussed in [Three.js issue 30767](https://github.com/mrdoob/three.js/issues/30767); that issue alone is not evidence about our runner.

## Repair

`createStudioRenderer` validates context loss, version and precision before constructing Three.js. It can retry a fresh context without multisampling. Healthy contexts retain the existing Three.js WebGL renderer. Disposed WebGL viewers release their contexts.

If neither context is usable, a Canvas software renderer draws the existing Three scene from the actual STL. It supports perspective/orthographic cameras, depth-buffered surfaces, clipping planes, shading, vertex colours, wireframe, texture-backed artwork comparison, multi-part assemblies, hidden parts and layout lines. The same orbit controls and UI remain active. Static views are cached so they do not continually rerasterize. Both single-part and assembly viewers use this factory.

The interface labels this path **Software 3D preview**. It uses CSS-pixel resolution and can be slower on large models. It does not claim GPU acceleration or pixel-identical PBR lighting. Geometry generation, original STL files, manufacturing output and independent validators are unchanged. No OS/browser graphics blocklist or security flag is forced.

## Verification

Local regressions passed:

- An already-lost context reproducing Safari's response still renders real mesh pixels; camera presets, pointer orbit, smooth/flat shading, wireframe and height cutaways change those pixels.
- Artwork comparison renders through the software path, and exported STL bytes are identical before and after inspection controls.
- Healthy WebGL continues selecting the Three.js WebGL renderer.
- Software assembly perspective, wireframe, part hiding/restoration and layout guides work. Hiding every part leaves exactly the scene background colour.

Genuine Intel Safari **26.6** on macOS **15.7.9** passed the rebuilt customer package in run **41149374597**. Four projects passed: simple, colours, mounting/hardware and a legacy project. Each rendered real mesh pixels, produced independently valid STL/ZIP bytes, preserved its saved project and closed its processing document correctly. Native pointer orbit, camera presets, wireframe and height cutaways changed actual canvas pixels. This is **software 3D**, not a successful native WebGL context or physical-GPU certificate. [Package evidence](safari-intel/package-qualification.json).

The same Intel ZIP passed all 15 Chromium projects, four Chrome projects, four Firefox projects, forced single-thread fallback, the real two-job all-format sweep, all managed-host checks and all seven lifecycle checks. The tested runtime archive is **8,247,583 bytes**, SHA-256 `770fc4fca1d4ca7222d389bbe1337a87fbce5ba16097c4083bdafc623518a86a`. All 15 rebuilt project outputs were independently compared with the original Intel package using M6's unchanged A/B method: every oriented surface is exactly equal, with zero tolerance and zero deviation. Some face serialization/triangulations differ across builds; this is not a claim that every rebuilt STL file is byte-identical. The local before/after inspection-control test does prove identical STL bytes within the same session. [Export parity](safari-intel/export-parity.json). The final outer-instruction update is audited separately. The full preserved suite passed **173 Rust tests and 250 browser tests** (248 existing cases plus the two initial renderer regressions) in run **41149380221**; deployment was skipped. The additional strengthened assembly regression passed locally. [Full-suite evidence](safari-intel/standard-ci.json). Local tests are not represented as physical Intel GPU testing.

Actual Safari screenshot: [software 3D with native pointer orbit](https://github.com/thomastt-cryoo/stenciii/blob/codex/m7-artifacts/11819c3b87556ab152f28f351bcc0235bed4f3ea/macos-x64/safari/actual-safari.png). It was visually inspected.

## Delivery

Only the Intel runtime ZIP is rebuilt for this follow-up. Windows and Apple Silicon retain their previously qualified runtime bytes; reviewed outer instructions and the checksum file identify each runtime revision. The Quick Start PDF is unchanged. Canonical review downloads remain on `codex/m7-artifacts/m7-current/customer`, with an audited five-file layout and every file below 20,000,000 bytes. Final SHA-256 values are in `distribution/m7/delivery-manifest.json`.

Canonical Intel download: **8,229,294 bytes**, SHA-256 `1d9ff761a82dee967f16a9bd76a7165b5b1ac74459ee844e610099b47db87d7f`. Delivery assembly [41152315330](https://github.com/thomastt-cryoo/stenciii/actions/runs/41152315330) passed. Its member audit verifies all tested app, signature, manifest and notice bytes unchanged; only outer instructions differ.
