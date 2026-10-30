# M6 correctness and reliability work

Accepted base: `cb07659c1f650a76b220fb273e09e4e349e02b8b` (M5 evidence), source `001f3d6d79167d83d366c16bf9a187da4e140fd4`.

The M0 inventory/mapping, M1–M5 reports, 24-type runtime catalogue, 217-field M5 matrix, manufacturing fixtures, final results, parity records and CI evidence were reviewed before source changes. M5's five corrupted degree/squared-unit labels in copied schema metadata do not change the parameter count or numeric constraints; M6 will use the original UTF-8 catalogue directly.

Priority: reproduce/repair remaining invalid tiles; geometrically classify every recorded engine discrepancy; complete local batch/sweeps; audit all parameters and non-catalogue features; run preserved and extended tests, production/offline/output/project checks; publish an evidence-based readiness decision. M7 is outside this milestone.

Implementation and all local/output/project/engine/production gates are complete. The final Linux CI run passes all 248 browser tests and 173 Rust tests, production/single-binary builds pass, and optional deployment is skipped. The decision is Functional QA Passed With Documented Limits; the full report and machine evidence specify the limits. The application source is unchanged after a71c2e8; subsequent commits repair test synchronization/origin handling and document the workflows. M7 has not started.
