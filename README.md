# Stencil Studio — M3 artwork editor

Drop an image or **Create from Text**, **Make Stencil**, customize and export. Standard, Smooth Vector and Crisp Raster remain available, with live draft/full previews. M3 adds direct crop handles, 41 verified artwork settings, real intermediate results, a Processing Steps list with named passes, operation presets and workflow templates. Original bytes and imported project data remain intact. Processing stays local in both themes.

See the [M3 completion report and evidence](docs/M3_REPORT.md), approved [M2 report](docs/M2_REPORT.md), and [M1 report](docs/M1_REPORT.md). The engine remains based on upstream v2.9.4 (`5d8df15b798b859faf72248a35d156d6e9aaffc7`), with the tested M2 raster-wall fix. Specialist geometry/manufacturing editors remain assigned to M4–M5. `npm run build` produces the customer-only app; `npm run e2e` explicitly builds a separate harness for preserved original UI tests. Build instructions are in INSTALL.md. The original node-editor instructions below apply to the reference harness.

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
| `.github/workflows/ci.yml` | Tests, builds, and GitHub Pages deployment |

The Python implementation remains available in the historical [`v1.0.0` release](https://github.com/filipealmeida/graffiti-stencil-maker/tree/v1.0.0).

## License

[The Unlicense](LICENSE).
