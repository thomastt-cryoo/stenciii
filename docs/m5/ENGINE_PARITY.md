# Measured engine comparison differences

All 191 successful Parts fixtures pass independent topology checks in native, ST and MT. All 64 bitmap fixtures match in ST/MT; one Parts fixture has its expected no-room refusal. Exact oriented triangles are compared at 0.0001 mm. A mismatch remains a mismatch even when volume and bounds match. The exact M4 Spread fixture is separately repaired and equal.

ST/MT differs in 43 Parts fixtures; native leaf geometry differs in 83. This does not establish universal equivalence.

| Fixture | ST/MT equal | Native/ST leaf equal | Different files (ST/MT; native/ST) |
|---|---|---|---|
| tile_layout-width_mm-after | True | False | —; stencil_r2c1.stl |
| tile_layout-segments-after | True | False | —; stencil_r1c1.stl |
| tiles-reinforce-before | False | False | stencil_r1c1.stl; stencil_r1c1.stl |
| pads-pad_thread-before | True | False | —; stencil_r2c2.stl |
| pads-pad_height-before | True | False | —; stencil_r2c2.stl |
| pads-pad_height-after | True | False | —; stencil_r2c2.stl |
| pads-thread_clearance-before | True | False | —; stencil_r2c2.stl |
| pads-long_edge-before | True | False | —; stencil_r2c2.stl |
| pads-long_edge-after | True | False | —; stencil_r2c2.stl |
| pads-mount_screw-before | True | False | —; stencil_r2c2.stl |
| pads-mount_screw-after | True | False | —; stencil_r2c2.stl |
| pads-mount_threaded-before | True | False | —; stencil_r2c2.stl |
| pads-mount_threaded-after | True | False | —; stencil_r2c2.stl |
| pads-mount_clearance-before | True | False | —; stencil_r2c2.stl |
| pads-mount_clearance-after | True | False | —; stencil_r2c2.stl |
| pads-hole_spacing-before | True | False | —; stencil_r2c2.stl |
| pads-hole_spacing-after | True | False | —; stencil_r2c2.stl |
| pads-joiner_offset-before | True | False | —; stencil_r2c2.stl |
| pads-joiner_offset-after | True | False | —; stencil_r2c2.stl |
| pads-extend-before | True | False | —; stencil_r2c2.stl |
| pads-extend-after | True | False | —; stencil_r2c2.stl |
| pads-segments-before | True | False | —; stencil_r2c2.stl |
| pads-segments-after | True | False | —; stencil_r2c2.stl |
| ring-width-after | False | False | ring_1_top_2.stl, ring_1_bottom_2.stl; ring_1_top_2.stl, stencil_r2c2.stl |
| ring-rings-before | True | False | —; ring_1_bottom_2.stl |
| ring-rings-after | False | False | ring_1_corner_bl.stl, ring_2_left_2.stl, ring_2_right_3.stl, ring_2_corner_tl.stl, ring_2_left_1.stl, ring_2_top_1.stl, ring_2_right_2.stl, ring_2_left_3.stl; ring_1_corner_bl.stl, ring_2_left_2.stl, ring_2_top_3.stl, ring_2_corner_tl.stl, ring_2_right_2.stl, ring_2_left_3.stl |
| ring-slab_length-before | True | False | —; stencil_r2c2.stl |
| ring-slab_length-after | False | False | ring_1_bottom_1.stl; ring_1_top_1.stl, ring_1_bottom_1.stl |
| ring-gap-before | True | False | —; stencil_r2c2.stl, ring_1_bottom_2.stl |
| ring-gap-after | False | False | ring_1_bottom_2.stl; ring_1_bottom_2.stl, ring_1_corner_br.stl |
| ring-joiner_thickness-before | True | False | —; stencil_r2c2.stl |
| ring-joiner_thickness-after | False | True | ring_1_bottom_1.stl; — |
| ring-hardware-after | False | True | ring_1_bottom_1.stl; — |
| ring-screw_length-before | True | False | —; stencil_r2c2.stl, ring_1_bottom_2.stl |
| ring-screw_length-after | True | False | —; stencil_r2c2.stl, ring_1_bottom_1.stl |
| ring-nut_clearance-before | True | False | —; ring_1_bottom_2.stl |
| ring-nut_clearance-after | True | False | —; ring_1_bottom_2.stl |
| ring-tip_taper-before | True | False | —; stencil_r2c2.stl |
| ring-tip_taper-after | True | False | —; ring_1_bottom_2.stl, ring_1_bottom_1.stl |
| ring-tip_pitches-after | True | False | —; stencil_r2c2.stl, ring_1_bottom_2.stl |
| ring-number_parts-before | True | False | —; stencil_r2c2.stl, ring_1_bottom_2.stl |
| ring-number_parts-after | True | False | —; stencil_r2c2.stl |
| ring-number_size-before | True | False | —; ring_1_bottom_2.stl |
| ring-number_size-after | False | False | ring_1_bottom_2.stl, ring_1_top_2.stl; stencil_r2c2.stl, ring_1_top_2.stl |
| ring-pocket_depth-before | True | False | —; stencil_r2c2.stl |
| ring-pocket_depth-after | True | False | —; stencil_r2c2.stl |
| ring-wall_holes-after | True | False | —; ring_1_bottom_1.stl, stencil_r2c2.stl |
| ring-hole_spacing-before | True | False | —; stencil_r2c2.stl |
| ring-hole_spacing-after | True | False | —; ring_1_bottom_2.stl |
| ring-segments-before | True | False | —; stencil_r2c2.stl |
| ring-segments-after | False | False | ring_1_corner_tl.stl; ring_1_bottom_1.stl, ring_1_corner_tl.stl, ring_nut_M4.stl, stencil_r2c2.stl |
| hardware-length-after | True | False | —; bolt_M4x25.stl |
| hardware-segments-after | False | False | nut_M4.stl, bolt_M4x20.stl; nut_M4.stl |
| export-max_x-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl |
| export-max_x-after | False | False | stencil_r1c2.stl, stencil_r1c3.stl, stencil_r2c3.stl, stencil_r1c1.stl; stencil_r1c3.stl |
| export-max_y-before | False | False | stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl; stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl |
| export-max_y-after | False | False | stencil_r1c2.stl, stencil_r2c2.stl; stencil_r1c2.stl, stencil_r2c2.stl |
| export-seam_gap-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl |
| export-seam_gap-after | False | False | stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl; stencil_r2c2.stl, stencil_r1c2.stl |
| export-connector-before | False | False | stencil_r2c2.stl, stencil_r1c1.stl, stencil_r1c2.stl; stencil_r1c2.stl, stencil_r2c2.stl |
| export-connector-after | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r2c1.stl, stencil_r1c2.stl |
| export-connector_d-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl |
| export-connector_d-after | False | False | stencil_r2c2.stl, stencil_r1c2.stl; stencil_r2c2.stl, stencil_r1c1.stl, stencil_r1c2.stl |
| export-depth-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c2.stl, stencil_r2c2.stl |
| export-depth-after | False | False | stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl; stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl |
| export-clearance-before | False | False | stencil_r2c2.stl, stencil_r1c1.stl, stencil_r1c2.stl; stencil_r2c2.stl, stencil_r1c2.stl |
| export-clearance-after | False | False | stencil_r2c2.stl, stencil_r1c1.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r1c2.stl |
| export-segments-before | False | True | stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl; — |
| export-segments-after | False | True | stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c2.stl; — |
| export-pad_count-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r1c2.stl |
| export-pad_count-after | True | False | —; stencil_r1c1.stl |
| export-pad_thread-before | False | False | stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl; stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl |
| export-pad_thread-after | False | False | stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl; stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c1.stl |
| export-pad_height-before | False | False | stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c2.stl; stencil_r1c2.stl, stencil_r2c2.stl |
| export-pad_height-after | False | False | stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c2.stl; stencil_r1c2.stl, stencil_r2c2.stl |
| export-thread_clearance-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl |
| export-thread_clearance-after | False | False | stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c2.stl; stencil_r1c2.stl, stencil_r2c2.stl |
| export-mount_screw-before | False | False | stencil_r1c1.stl, stencil_r1c2.stl, stencil_r2c2.stl; stencil_r1c1.stl, stencil_r1c2.stl |
| export-mount_screw-after | False | False | stencil_r1c1.stl, stencil_r2c2.stl; stencil_r1c2.stl, stencil_r1c1.stl |
| export-mount_clearance-before | False | False | stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c2.stl; stencil_r1c2.stl, stencil_r1c1.stl, stencil_r2c2.stl |
| export-mount_clearance-after | False | False | stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl |
| export-mount_threaded-before | False | False | stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl; stencil_r1c1.stl, stencil_r1c2.stl |
| export-mount_threaded-after | False | False | stencil_r1c1.stl, stencil_r1c2.stl, stencil_r2c2.stl; stencil_r1c1.stl, stencil_r1c2.stl |
| export-mount_offset-before | False | False | stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl; stencil_r1c1.stl, stencil_r2c2.stl, stencil_r1c2.stl |
| export-mount_offset-after | False | False | stencil_r1c2.stl; stencil_r1c2.stl, stencil_r2c1.stl, stencil_r1c1.stl |
| export-mount_extend-before | False | False | stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl; stencil_r2c2.stl, stencil_r1c2.stl, stencil_r1c1.stl |
| export-mount_extend-after | False | False | stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl; stencil_r1c2.stl, stencil_r2c2.stl, stencil_r1c1.stl |

Full per-file triangle counts, volume deltas, bounds and component comparisons are in [final-results.json](final-results.json); complete audits and geometry hashes are in [manufacturing-modes.json](manufacturing-modes.json). The mismatches are explicitly retained for M6 investigation.
