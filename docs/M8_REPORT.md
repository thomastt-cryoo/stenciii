# M8 - Final customer QA and Etsy preparation

Review date: 31 October 2026. **Five review files are prepared. Commercial release
is on HOLD pending completion of first-download approval checks.** No Etsy
listing, public release, tag, hosting or later milestone was started.

## Changes

No application executable, engine, WASM source or feature was changed/rebuilt.
All three ZIPs are byte-for-byte the accepted M7 customer downloads. Intel keeps
the verified Safari repair at `11819c3b87556ab152f28f351bcc0235bed4f3ea`.
Windows/Apple Silicon keep `670aad80fe5fe648f802fa429aa67c55ea2b538a`.

The Quick Start is now six visually checked pages covering installation,
unsigned-app warnings, beginner and manufacturing workflows, offline operation,
project backups, troubleshooting, measured compatibility and factual product
information. It explains the second macOS Open Anyway confirmation and possible
administrator authentication. The Read Me/checksum text now carries the M8
security decision. Git binary attributes preserve PDF/archive evidence bytes
across Windows/Unix checkouts. [Seller information](m8/ETSY_PRODUCT_INFORMATION.md) and a
[bounded remaining-QA checklist](m8/CUSTOMER_QA_CHECKLIST.md) are committed.
No product defect was found by the bounded M8 functional spot checks.

## Actual first-download results

The exact customer ZIPs were downloaded through installed, headed Chrome on
isolated OS runners, using native download handling, then extracted with the
Windows shell or Mac Archive Utility. Download bytes matched the M7 manifest.
No `saveAs`, manually stamped origin, quarantine removal, re-signing or global
security exception was used. These were GitHub review downloads, not an Etsy
download/reputation test. A successful evidence-collection job is not a customer
approval pass.

| Platform / measured security-test OS | Actual observation | Qualification |
|---|---|---|
| Windows Server 2025, 10.0.26100 | Browser ZIP had ZoneId=3; shell extraction propagated it to both unsigned executables. No SmartScreen warning or running editor was confirmed. This hosted Server had no configured SmartScreen policy and Defender real-time protection was already off. | **Consumer SmartScreen unverified.** Not a representative fresh Windows 11 security configuration. |
| Existing Windows 11 Home, 10.0.26300 | Read-only policy audit found SmartScreen already Off, policy EnableSmartScreen=0 and Smart App Control state=0. An isolated headless browser download also retained ZoneId=3. | **No consumer security pass claimed.** Settings were not changed; no desktop UI automation was used. |
| Apple Silicon, macOS 15.8.2 (24H232) | Genuine browser quarantine propagated to the app. Ad hoc signature verification passed; enabled Gatekeeper assessment rejected it. Actual alert: "Stencil Studio Not Opened" / Apple could not verify it is free of malware. Two app-specific Open Anyway buttons were exercised; the next screen requested an administrator username/password. No credentials were entered, editor listener was absent, and launch/reopen were not completed. | **Authentication and subsequent launch/reopen remain unverified.** The warning/approval UI is measured; end-to-end approval is not a pass. |
| Intel, macOS 15.7.9 (24G830) | Genuine quarantine propagated; signature verification passed and enabled Gatekeeper assessment rejected the app. Its blocked first-open warning was collected. Automated navigation did not complete the app-specific approval; no editor listener was confirmed. | **App-specific approval and reopen remain unverified.** This is an incomplete UI qualification, not evidence that the accepted viewer repair failed. |

Both Macs retained quarantine and enabled Gatekeeper at the end. The observed
Apple Silicon authentication is an app-specific OS approval, not an administrator
installer. Developer ID signing and notarization are **not requirements** for
this product. The blocker is incomplete qualification of the supported approval
path, not absence of those paid signing arrangements.

Evidence: [security summary](m8/evidence/security-summary.json),
[Windows](m8/evidence/windows-security.json),
[local policy audit](m8/evidence/local-environment.json),
[Apple Silicon](m8/evidence/macos-arm64-security.json),
[Intel](m8/evidence/macos-x64-security.json).
Windows collector: [41167542168](https://github.com/thomastt-cryoo/stenciii/actions/runs/41167542168).
Final Mac collectors: [41168127844](https://github.com/thomastt-cryoo/stenciii/actions/runs/41168127844).
Actual [ARM authentication screen](https://github.com/thomastt-cryoo/stenciii/blob/codex/m7-artifacts/b1b8d50267b266ca3d4d3a51c0941a33122d0d36/m8-security-macos-arm64/security/after-approval.png)
and [Intel final screen](https://github.com/thomastt-cryoo/stenciii/blob/codex/m7-artifacts/b1b8d50267b266ca3d4d3a51c0941a33122d0d36/m8-security-macos-x64/security/after-approval.png)
are retained with the original warnings and download metadata on the artifact
branch. Preliminary harness failures are retained there and are not counted as
application failures or passes.

The customer instructions follow the app-specific procedure documented by
[Apple](https://support.apple.com/en-us/102445). Windows instructions disclose
unknown-publisher/reputation warnings and policy/Smart App Control restrictions
documented by [Microsoft](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).
Neither guide asks customers to disable protection or override malware/damage alerts.

## Functional and integrity checks

- **4 new packaged Windows customer spot checks passed**, installed Chrome
  151.0.7922.72 on Windows 11 Home 10.0.26300. Beginner: upload SVG, Make Stencil,
  set width to 160 mm, inspect 3D, export STL, Save Project, reload and reopen.
  Manufacturing: colour plates, tiled assembly and mounted/hardware outputs.
  Actual STL/ZIP disk exports were independently validated; the three advanced
  outputs matched accepted M6 surfaces by exact methods A/B. Save/reopen was
  lossless. Browser requests were restricted to localhost, with zero attempted
  external requests and zero page errors. Explicit shutdown ended the document
  and workers. This isolated headless-profile check is separate from OS approval.
  [Result](m8/evidence/windows-customer-smoke.json),
  [output hashes](m8/evidence/windows-output-hashes.json),
  [beginner project/mesh/screenshot](m8/evidence/customer-workflow).
- **Accepted tests carried forward, not rerun:** 173 Rust and 250 browser tests;
  complete M7 platform/manufacturing, offline, export, persistence and lifecycle
  evidence; genuine Intel Safari 26.6 four-project software 3D qualification,
  native orbit/camera/wireframe/cutaway checks and zero-deviation export parity.
  M6 core/WASM files and application runtime source remain unchanged.
  [Preservation record](m8/evidence/preserved-qualification.json),
  [Intel repair](m7/SAFARI_INTEL_FIX.md), [M7](M7_REPORT.md).
- All three ZIP CRCs and every prior runtime/notice member hash passed. Their
  entire archive SHA-256 values are unchanged. All five delivery files were
  hashed and are under the conservative 20,000,000-byte limit. The PDF has six
  pages, readable text and functioning source links; all final page appearances
  were inspected. [PDF review](m8/evidence/pdf-review.json).

## Readiness and remaining release gates

| Download | Runtime/product status | Commercial readiness |
|---|---|---|
| Windows x64 | Accepted packaged Chrome/Edge workflows; M8 customer spot checks pass | **HOLD:** perform a real fresh consumer Windows SmartScreen approval, launch, reopen and quit check with protection enabled. |
| Mac Apple Silicon | Accepted packaged runtime and browser workflows | **HOLD:** finish app-specific administrator authentication on a representative Mac, then verify editor use, saved-project reopen and quit. |
| Mac Intel | Accepted packaged workflows and verified Intel Safari software 3D repair | **HOLD:** complete app-specific first-download approval, editor use, reopen and quit on Intel. |

**Overall recommendation: retain the five files for review; do not yet offer a
general commercial release.** Complete only the missing first-download checklist
on suitable authenticated/customer machines. This does not require rebuilding
the unchanged executables or rerunning completed regression milestones.

Exclude Windows 10, older macOS and physical-retail-Mac certification from
compatibility claims. The measured full runtime Mac systems remain ARM
macOS 26.6.2 and Intel macOS 15.7.9; ARM macOS 15.8.2 above is a security-UI
observation, not an additional full runtime qualification. Windows Firefox 3D
remains unqualified; Chrome is recommended and Edge is supported on tested
Windows. These restricted claims are not additional release blockers when
clearly excluded. Physical strength, hardware fit and printing tolerances still
require printer/material calibration.

## Exact five review files

Local delivery: `distribution/m8/customer/`. Exact sizes and SHA-256 follow.
The TXT hashes the other four files; its own hash is recorded here and in the
[manifest](../distribution/m8/delivery-manifest.json), avoiding a circular hash.

| Filename | Exact bytes | SHA-256 |
|---|---:|---|
| StencilStudio-Windows-x64.zip | 8,242,951 | `60acdaf946f14b2f6ac525772b7cc645240a53aa1a2831e698c7949998f850d6` |
| StencilStudio-macOS-Apple-Silicon.zip | 7,832,862 | `d45b2086de195710e8ed3b471b22ac52a337bf3d8931651f5dbd98173defc63d` |
| StencilStudio-macOS-Intel.zip | 8,229,294 | `1d9ff761a82dee967f16a9bd76a7165b5b1ac74459ee844e610099b47db87d7f` |
| StencilStudio-Quick-Start.pdf | 15,856 | `a010ad5a762aed7576587a3b0e6b6b284b9816816f4f753a84a09b092beacdaf` |
| Read Me and Checksums.txt | 3,048 | `a331bdff45d4a6fbcefcef90a2a3d9f9e2c12785a63e9a5a906e429440f8d9fa` |


Canonical assembly [41169308213](https://github.com/thomastt-cryoo/stenciii/actions/runs/41169308213) passed on source `875a5f0cd4a102a1fc2c2c285e1536947686acbd`. All five exact files and review evidence are committed on `codex/m7-artifacts` at `e598b35ea0b2e1c5ef33fe858628a9f0f5e37dbd`, under `m8-current/customer/` and the producer-specific snapshot. The local files match those retained Git blob identities and the independently rechecked SHA-256 values. [Assembly evidence](m8/evidence/delivery-assembly.json).
