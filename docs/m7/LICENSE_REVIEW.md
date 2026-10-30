# Shipping license review

The package is a larger work containing separately licensed components. The repository's Unlicense does not replace those licenses. No dependency licenses are removed for package size.

`scripts/m7/licenses.py` generates a conservative notice inventory from the locked Cargo resolution (including build dependencies and other targets) and the npm production closure. It includes full available LICENSE, COPYING, COPYRIGHT, NOTICE and AUTHORS files, exact versions, sources and content hashes. Missing notice material fails packaging. Some indexed libraries are not linked into a particular platform; this conservative list is not a binary link map.

Two dependencies use MPL-2.0: **boolmesh 0.2.0** and **option-ext 0.2.0**. Each customer package includes its complete unchanged published crate archive as `MPL-corresponding-source.tar.gz`, alongside its license. The notices identify the source and preserve the recipient's MPL rights. No files in either dependency were modified. Including the actual source avoids depending on a third-party download remaining available. See the [MPL text and distribution guidance](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

Other declared licenses in the resolution are MIT, Apache-2.0 (including LLVM exception alternatives), BSD-2/3-Clause, ISC, Zlib, 0BSD, Unlicense and Unicode-3.0, or permissive alternatives. For r-efi's MIT/Apache/LGPL choice, the MIT alternative is selected and its full AUTHORS notice is retained. No GPL-only component was identified in this locked resolution. This is an engineering inventory and compliance implementation, not legal certification of future product terms.

Some crates omit their repository-root license texts from the published crate. `license-supplements/sources.json` identifies each retained text by the exact crate VCS revision and official upstream URL. The winapi architecture support crates use the license files supplied by their parent winapi crate. The collector records that choice rather than silently inventing a copyright holder.

DejaVu Sans Bold and DejaVu Serif Bold remain embedded in the engine without modification. Their full Bitstream Vera/DejaVu notice is included. They are not Liberation fonts. The application loads no external font service.

Pinned Rust standard-library copyright and third-party license material is retained from official rust-docs installations, with upstream MIT/Apache license texts at the exact stable and nightly compiler commits. Compressed review inputs are expanded into the customer notices so minimal CI toolchain installations cannot accidentally omit them. Compiler versions and source revisions appear in `runtime-notices/sources.json`.

Windows links the Microsoft CRT statically using MSVC Build Tools; producer use and runtime redistribution remain governed by the applicable Build Tools license and [Microsoft's redistribution terms](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files). The import audit finds only Windows system DLLs, with no separate Visual C++ runtime DLL requirement. The package does not redistribute the compiler, SDK, WebView2 installer or a development environment. macOS system frameworks are provided by the OS, not copied into the package. No browser is redistributed. Browser, OS and vendor components retain their own terms.

The production frontend contains neither the legacy node editor entry point nor development regression pages. Its JavaScript libraries receive full notices even when a production dependency is removed by tree shaking. Test artwork, NASA/corpus fixtures, screenshots of customer data, test-only drivers and the retired Tauri prototype do not ship inside the application ZIPs. The customer Quick Start uses an actual test-launcher screenshot and standard PDF fonts.

Every package contains `THIRD_PARTY_NOTICES.txt`, `license-review.json`, full license/copyright material and the required MPL source archives. The package integrity manifest covers these files. Final archive sizes and SHA-256 values are recorded separately; checksums detect corruption and do not constitute publisher signing.
