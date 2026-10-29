# Stencil Studio — M0 audit

This repository preserves Graffiti Stencil Maker v2.9.4 at source commit `5d8df15b798b859faf72248a35d156d6e9aaffc7` while planning a simpler interface. M0 covers the audit, baseline testing and architecture; the UI redesign has not started.

- [Feature inventory](docs/FEATURE_INVENTORY.md)
- [Complete feature and parameter mapping](docs/FEATURE_UI_MAPPING.md)
- [Proposed workflow and UI architecture](docs/UX_ARCHITECTURE.md)
- [Actual baseline results, defects and M1 readiness](docs/BASELINE_TESTS.md)

The original build and usage instructions follow.

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

Drop an image onto the canvas, connect trace and stencil nodes, and export an STL or tiled ZIP. See [USAGE.md](USAGE.md)
for the CLI flags and studio workflow.

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
