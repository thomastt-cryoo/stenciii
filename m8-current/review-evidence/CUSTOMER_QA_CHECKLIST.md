# Completing first-download qualification

This is a bounded handoff for configurations that the available machines cannot
qualify. It does not replace the completed M0-M7 or M8 workflow tests. Do not
rebuild an executable merely to run this checklist.

1. Use the exact platform ZIP in `distribution/m8/delivery-manifest.json`. Verify
   its SHA-256 and size. Download through a normal installed browser on a clean,
   representative customer OS, recording the actual download source. Do not
   remove Windows Internet-zone metadata or macOS quarantine.
2. Keep system protection settings enabled. Record OS/build, CPU architecture,
   browser/version and the security policy. A managed policy or Smart App
   Control block is a restricted configuration, not permission to turn it off.
3. Extract with File Explorer Extract All on Windows or Archive Utility on Mac.
   Double-click the extracted graphical launcher. Capture the actual warning
   without calling an unrelated unquarantined or command-line launch a pass.
4. If the OS offers an app-specific approval for the verified package, follow
   the PDF procedure. Stop for malware/damage alerts or unavailable approval.
   Mac Developer ID/notarization is not an M8 requirement. No `xattr -d`,
   `spctl --master-disable`, antivirus exclusion or global policy change is used.
5. Confirm the browser editor opens. Choose a small image, Make Stencil, adjust
   width, inspect 3D and download STL. Save Project, quit, double-click again,
   reopen the saved project and export once more. Check that the launcher/server
   stops. This final approval check does not require repeating all 15 projects
   or the Rust/browser regression suites.
6. Record exact warning text/screenshots, every app-specific approval (including
   any separate backend approval), reopen result and the unchanged package hash.
   An active process or successful CI job alone is not an approval pass.

Exclude Windows 10, older macOS, physical Mac claims and unqualified Windows
Firefox 3D from listing copy until separately measured. Those exclusions do not
invalidate completed tests on the measured configurations.
