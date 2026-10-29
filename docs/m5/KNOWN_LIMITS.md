# M5 limits and remaining work

The app validates actual stored STL coordinates, faces, edge consistency, orientation, components, volume and bounds. A complete package is blocked when a required part fails. It does not certify physical print strength or printer-specific fit.

- Some complex raster tile bridge arrangements still contain collinear zero-area faces. A conservative local cleanup accepts only surface-preserving collapses with verified topology, bounds and volume. Unrepairable files remain visible and blocked. The additional ring fixture in `cli-seam-angle.json` still has four degenerate faces in `stencil_r1c2.stl` at both measured seam angles; two other affected tiles are repaired. This remains a manufacturing release limitation for M6.
- Each browser STL audit is limited to two million triangles. ZIP packaging is limited to 256 MB and uses the existing STL/PNG/SVG/JSON formats. There is no ZIP64 support or arbitrary-size guarantee.
- Browser batches support up to 20 local images and 128 MB combined input, with a 64 MB per-image limit and 256 MB collection. They replace one chosen embedded asset in a frozen recipe. Folder discovery, unattended jobs and parameter-sweep editing remain CLI capabilities; the browser batch is not full CLI parity.
- Colour splitting supports ten masks. Each registration operation supports six solid plates. Seven to ten layers use separate groups, each retaining its own registration settings. Cross-group alignment requires matching dimensions and hole settings.
- Mesh optimization accepts solids before splitting; it does not optimize arbitrary hardware or Parts collections. Lower hardware segment detail when verification exceeds its budget.
- Physical printing, fresh-machine offline installation, macOS/Linux desktop launch and Firefox/Safari testing have not been performed in this Windows session. Linux source and browser checks are delegated to the repository's normal CI.

The exact M4 one-pass Spread discrepancy was reproduced and repaired using deterministic candidate ties. The measured native, single-thread and multithread fixture agrees. Broader replay validates all 191 successful Parts fixtures in all three engines, all 64 ST/MT bitmap fixtures match, and one expected constraint refusal is preserved. Exact oriented triangles still differ in 43 ST/MT and 83 native/ST leaf comparisons (87 distinct fixtures overall). All measured bounds match and the largest absolute volume delta is about 5.1e-11 mm³. These comparisons are retained in [ENGINE_PARITY.md](ENGINE_PARITY.md) and the complete machine evidence; universal triangle equivalence is not claimed.

M6 has not been started.
