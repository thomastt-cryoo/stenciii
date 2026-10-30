# Stencil Studio — local stencil creation

M7 now targets the **offline browser edition for Windows and Mac**, following the user's scope change. The graphical launchers open the complete local editor in an installed browser. Native editor windows are outside this milestone. Packaging qualification is in progress on `codex/m7-distribution`; no commercial release is published. See [packaging architecture](docs/m7/PACKAGING_ARCHITECTURE.md) and [shipping notices](docs/m7/LICENSE_REVIEW.md).

Drop an image or **Create from Text**, **Make Stencil**, customize and export. Standard, Smooth Vector and Crisp Raster retain live draft/full previews. Advanced sections provide colour layers and registration, tone patterns, both tiling strategies, editable seams and connectors, mounting, expanded borders and real threaded hardware. All 217 original qualified settings have per-instance editors. Original artwork and imported project data stay in the saved project. Processing stays local in both themes.

**Export options** collects selected assemblies with upstream plates and hardware, measured dimensions, independent file checks and a complete manufacturing manifest. **All Settings → Batch processing and diagnostics** runs multiple images, browser-selected folders or saved artwork with numeric ranges and explicit choices. It previews the Cartesian job count, runs sequentially, isolates failures, supports cancellation and exports individual results, a combined ZIP and CSV/JSON summaries. Keep the workspace open while jobs run.

Use Settings search to find original workflow templates, presets, edit history, copied processing groups, project screw-fit settings and diagnostic reports. Read [usage](USAGE.md), [the M6 report](docs/M6_REPORT.md) and [supported limits](docs/m6/KNOWN_LIMITS.md). File validation does not certify physical printing or printer-specific fit.

The engine remains based on upstream v2.9.4 (`5d8df15b798b859faf72248a35d156d6e9aaffc7`). Approved reports remain available for [M4](docs/M4_REPORT.md), [M3](docs/M3_REPORT.md), [M2](docs/M2_REPORT.md) and [M1](docs/M1_REPORT.md). `npm run build` produces the customer-only app; `npm run e2e` builds a separate harness for preserved original UI tests. Build instructions are in INSTALL.md. The original node-editor instructions below apply to that reference harness.

- [Feature inventory](docs/FEATURE_INVENTORY.md)
- [Complete feature and parameter mapping](docs/FEATURE_UI_MAPPING.md)
- [Proposed workflow and UI architecture](docs/UX_ARCHITECTURE.md)
- [Actual baseline results, defects and M1 readiness](docs/BASELINE_TESTS.md)

The approved M0 documents above remain the historical audit. The original build and usage instructions follow.

# Graffiti Stencil Maker

Create island-free, watertight stencil STLs from PNG, JPG, BMP, or SVG images. The Rust engine powers both a
command-line tool and a browser-based node-graph studio. The studio runs locally or on a static host; image
processing happens in WebAssembly in your browser.

## Quick start

### CLI

Install the [Rust toolchain](https://www.rust-lang.org/tools/install), then run:

```sh
cargo build --release -p stencil-cli
./target/release/stencil picture.svg --width 120 --thickness 3 -o plate.stl
```

On Windows, use `.\target\release\stencil.exe`. Run `./target/release/stencil --help` for all options.

### Studio as a single binary

Build the studio into the CLI (see [INSTALL.md](INSTALL.md)), then run:

```sh
./target/release/stencil studio
```

Release downloads also include `stencil-studio`, a launcher you can double-click to start the studio and open the
browser (see [INSTALL.md](INSTALL.md)).

It serves the studio on `http://127.0.0.1:5173/` and opens your browser. Options: `--port N`, `--no-open`.

### Web studio

See [INSTALL.md](INSTALL.md) for prerequisites and the initial build. Once the WASM package is built, start the
studio for local development with:

```sh
cd web
npm run dev
```

Drop an image, choose a style and press Make Stencil. Adjustments update automatically after the first generation. See [USAGE.md](USAGE.md) for the customer workflow and CLI flags.

## Features

- Raster and direct polygon-vector stencil generation, with automatic island bridges and watertightness checks.
- Image thresholding, colour reduction and splitting, tone patterns, and editable traced curves.
- Optional raised bridges that preserve islands on the first layer.
- Tiling, connector rods, threaded pads and mounting holes, joiner/extender plates, and ZIP export.
- Real M3, M4, M5, M6, M8 and M10 thread geometry.
- SVG input and saved graph projects in the CLI.

## Workspace

| Path | Purpose |
|---|---|
| `crates/stencil-core/` | Rust geometry engine, graph, raster/vector stencils, tiling, and hardware |
| `crates/stencil-cli/` | `stencil` command-line application |
| `crates/stencil-wasm/` | WebAssembly bindings |
| `web/` | React node-graph studio and Web Worker |
| `.github/workflows/ci.yml` | Tests and builds; manual opt-in GitHub Pages deployment |

The Python implementation remains available in the historical [`v1.0.0` release](https://github.com/filipealmeida/graffiti-stencil-maker/tree/v1.0.0).

## License

[The Unlicense](LICENSE).
