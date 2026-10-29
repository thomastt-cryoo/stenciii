"""Regenerate the M0 catalogue matrix; no third-party Python packages required.

First capture: cargo run --release -p stencil-core --example catalogue
Save stdout to docs/audit/runtime-catalogue.json, then run python scripts/m0/audit.py.
Use --check to verify the committed matrix without changing it.
"""
import hashlib
import io
import json
import re
import subprocess
import sys
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = "5d8df15b798b859faf72248a35d156d6e9aaffc7"
CAT = "crates/stencil-core/src/graph/catalogue.rs"
core_test = "crates/stencil-core/src/graph/tests.rs"

# tier, destination, runtime dependency, existing integration test
WORKFLOWS = {
    "source": (1, "Artwork / Image", "An embedded image must be loaded; original bytes are kept separately from working resolution.", "svg_pictures_run_through_the_graph"),
    "text": (2, "Artwork / Text", "Independent source; no image overlay operation exists; text must be nonempty and fit 25 million pixels.", "text_node_makes_a_mask_that_becomes_an_island_free_stencil"),
    "transform": (2, "Artwork / Crop and rotate", "Image input; crop then flip then quarter-turn then fine rotation; combined crops must leave pixels.", "transform_node_crops_and_rotates_before_tracing"),
    "threshold": (1, "Quick adjustments / Paint selection", "Image input; dark pixels mean paint openings; invert swaps paint and material.", "runs_caches_and_reruns_only_what_changed"),
    "reduce": (2, "Colours / Reduce colours", "Image input; Lab k-means reduction precedes colour splitting or tone patterns.", "reduce_gives_n_flat_colours_and_split_orders_them"),
    "split_colours": (2, "Colours / Separate passes", "Image input; up to ten masks, darkest first unless inverted; unused passes stay available in the project.", "colour_set_drills_matching_holes_and_adds_pins"),
    "tone_patterns": (3, "Colours / Tone patterns", "Image input with at most ten flat tones; physical pattern width must match the intended plate width.", "tones_make_darkest_solid_and_lightest_empty"),
    "smooth": (2, "Artwork / Cleanup / Smooth mask", "Mask input; supersampling multiplies both dimensions and can erase thin strokes.", "smooth_node_scales_the_mask_and_feeds_the_stencil"),
    "morphology": (3, "Artwork / Reshape paint", "Mask input; operation selects which kernel or pattern settings have an effect.", "morphology_node_runs_each_operation_and_reports_bad_input"),
    "trace": (2, "Artwork / Trace outlines", "Mask input; produces outlines before 3D bridge correction; retains pixel-space units.", "vector_polygon_path_builds_island_free_plate_and_detail_adds_triangles"),
    "round_corners": (2, "Artwork / Cleanup / Round corners", "Traced shapes input; preview also exposes removed corner tips.", "shape_cleanup_nodes_feed_a_vector_stencil"),
    "remove_islands": (2, "Artwork / Cleanup / Specks and holes", "Traced shapes input; filling unpainted holes changes artwork and can remove the need for bridges.", "shape_cleanup_nodes_feed_a_vector_stencil"),
    "shapes_to_mask": (3, "Artwork / Processing steps / Rasterise outlines", "Traced shapes input; use when a later raster-only operation is required.", "rasterising_at_higher_resolution_scales_the_area"),
    "stencil": (1, "Quick adjustments / Stencil; All Settings / Bridges and print", "Mask OR matching raster tile layout; layout controls width and margin and changes the available output from solid to parts.", "stencil_node_applies_first_layer_width_and_taper"),
    "vector_stencil": (1, "Quick adjustments / Stencil; All Settings / Bridges and print", "Shapes OR matching vector tile layout; layout overrides width and margin; bridge repair may fall back and report it.", "vector_polygon_path_builds_island_free_plate_and_detail_adds_triangles"),
    "tile_layout": (3, "Tiles / Layout before building", "Exactly one mask or shapes source; matching stencil type; min tile width = connector depth / 0.4; edits are offsets in mm.", "tiling_before_bridging_gives_island_free_tiles_that_pads_and_screws_accept"),
    "remesh": (3, "Mesh / Optimize", "Solid input only, before splitting; input layer metadata required; vertical-walled slices; skipped/retry results must be disclosed.", "remesh_cuts_vertices_and_keeps_the_plate"),
    "export": (4, "Compatibility / Combined tiling and mounting", "Legacy solid input; preserve unchanged for imported projects; defaults differ from separate manufacturing operations.", "tiles_a_real_stencil_into_watertight_parts_and_zip"),
    "tiles": (3, "Tiles / Split finished volume", "Solid input; creates parts; connector thickness, minimum tile size, bridge repair and seam checks apply.", "tiles_node_cuts_a_stencil_and_describes_the_plate"),
    "pads": (4, "Mounting / Pads and holes", "Parts with plate metadata; margin must fit hardware; pads/holes move to avoid seams and connector blocks.", "pads_node_fits_pads_and_holes_clear_of_seams"),
    "ring": (4, "Mounting / Expanded border", "Parts after mounting holes; positive margin and mounting screw; each slab must retain a screw hole.", "margin_expansion_surrounds_the_plate_with_watertight_slabs"),
    "fragments": (3, "Tiles / Remove loose fragments", "Parts, normally after split and before mounting; ranks connected components by volume; preserve non-tile files and disclose removed volume.", "keeps_only_the_biggest_solid_of_a_tile"),
    "colour_set": (3, "Colours / Registration and alignment", "One to six solids with matching XY size (0.05 mm tolerance); first colour required; registration must fit the margin.", "colour_set_drills_matching_holes_and_adds_pins"),
    "hardware": (4, "Hardware / Screws, nuts and plates", "Optional parts input supplies mounting metadata; standalone mode works; output contains hardware only, so export must also collect plate outputs.", "hardware_node_makes_joiner_plates_to_the_size_asked"),
}

def detail(ty, p):
    name = p["name"]
    tier, dest, dep, test = WORKFLOWS[ty]
    if ty == "source" and name == "resolution":
        tier, dest = 1, "Quick adjustments / Detail (raster); Artwork / Working resolution"
    if ty in {"stencil", "vector_stencil"}:
        if name in {"width_mm", "thickness_mm", "bridge_mm"}:
            dest = "Quick adjustments / Size and strength"
        elif name == "detail":
            dest = "Quick adjustments / Detail (vector); Mesh / Curve detail"
        else:
            tier = 2 if name in {"margin_mm", "flip", "bridges_per_island", "raised_bridges", "min_island_mm2"} else 4
            dest = "Bridges / " + (p.get("group") or "Geometry")
        if name in {"width_mm", "margin_mm"}:
            dep += " With a tile layout, edit the layout's value; retain the inactive stencil value. Width must exceed twice the margin."
        if name in {"bridge_min_angle_deg", "bridge_max_length", "bridge_passes"}:
            dep += " Active only with bridge_spacing=spread; bridge count above one makes angular spacing useful."
        if name == "z_bridging":
            dep += " Active only with raised_bridges=true."
        if name == "layer_height_mm":
            dep += " Geometry rounds to whole layers; use the slicer's actual layer height."
        if name == "extra_top_layers":
            dep += " Adds layers above the requested base thickness; actual output height can exceed Thickness."
        if name == "max_overhang_deg":
            dep += " 0 means a 45 degree check; the stencil catalogue's maximum is 89, unlike remesh's 90."
        if name == "min_island_mm2":
            dep += " 0 keeps all islands; positive values remove material islands by physical area, not paint specks."
        if name in {"min_contact_mm", "min_first_layer_width_mm"}:
            dep += " 0 disables this reinforcement; added material can narrow paint openings."
        if name == "first_layer_taper_mm":
            dep += " Active when first-layer width > 0; must be > 0 and <= base thickness; rounded to layers."
        if name == "tile_method":
            tier, dest = 3, "Tiles / Bridge method"
            dep += " Only with vector tile layout: per_tile or cut_whole; cut_whole may drop small loose pieces and costs more time."
    if ty == "threshold" and name == "threshold":
        dep += " 256 = automatic Otsu; manual 0..255 is inclusive via a +1 cut."
    if ty == "tone_patterns":
        if name == "spacing_mm": dep += " 0 makes the default pattern solid."
        if re.match(r"(kind|spacing|cover)_\d+$", name):
            dest += " / Tone " + name.rsplit("_", 1)[1]
            dep += " Only affects that intermediate tone when present; darkest stays solid and lightest empty; inactive tone values remain stored."
            if name.startswith("kind_"): dep += " auto derives a pattern from brightness."
            if name.startswith("spacing_"): dep += " 0 inherits default spacing."
            if name.startswith("cover_"): dep += " 0 derives coverage from the tone."
    if ty == "morphology":
        if name in {"kernel", "radius", "angle"}: dep += " Kernel applies to erode/dilate/open/close/gradient/hats; angle only for line kernel."
        if name in {"pattern", "custom", "rotate"}: dep += " Only hit_or_miss; custom and rotate affect custom pattern generation."
        if name == "iterations": dep += " 0 repeats thinning to convergence; other kernel operations use at least one pass; skeleton ignores this setting."
    if ty == "remove_islands" and name == "keep_largest": dep += " 0 keeps all separate shapes."
    if ty == "remesh":
        if name == "layer_to": dep += " 0 means top layer; show its actual current layer number without rewriting the sentinel."
        if name in {"layer_from", "layer_to"}: dep += " First <= last after resolving against input layers."
        if name == "decimate_mm": dep += " Only active with decimate=true."
        if name == "keep_material": dep += " Implementation permits inward movement up to one quarter of tolerance; do not promise zero material loss."
        if name == "max_overhang_deg": dep += " 90 disables this limit."
    if ty == "tile_layout" and name == "edits":
        dest += " / Seam and connector editor (with numerical keyboard alternative)"
        dep += " JSON string with seams and pockets maps; blank resets; invalidated offsets are retained and warned about, not silently deleted."
    if ty in {"tile_layout", "tiles", "export"}:
        if name in {"max_x", "max_y"}: dep += " 0 disables that cut axis where the catalogue permits 0; post-solid tiles starts at 20."
        if name in {"connector", "connector_d", "depth", "clearance"}: dep += " Real pockets need sufficient plate height (>4 mm plus shape wall rule); connector clearance is diametral."
        if name == "seam_angle_deg": tier = 4; dep += " Post-solid split only; bevel clearance measured across seam face."
        if name == "seam_gap": dep += " Total gap split between both faces; rods span the gap while retaining pocket depth."
    if ty == "pads":
        if name in {"pad_height", "thread_clearance", "long_edge"}: dep += " Pad-specific behavior requires a pad thread other than none; pad height also sizes mounting bosses/plates."
        if name == "pad_thread": dep += " none disables pads without disabling mounting holes."
        if name.startswith("mount_") or name in {"hole_spacing", "joiner_offset", "extend"}: dep += " Mounting requires mount_screw != none; threaded clearance remains explicitly diametral in this workflow."
        if name == "long_edge": dep += " 0 means corner pads only."
        if name == "hole_spacing": dep += " 0 means corner holes only."
        if name == "joiner_offset": dep += " 0 disables joiner holes."
    if ty == "ring":
        if name in {"screw_length", "nut_clearance", "tip_taper", "tip_pitches"}: dep += " Used when hardware=true; screw_length=0 chooses the joint's required bolt length."
        if name in {"number_size", "pocket_depth"}: dep += " Used with number_parts=true; pocket_depth=0 uses one plate layer."
        if name == "hole_spacing": dep += " Used with wall_holes=true on the outermost ring."
    if ty == "hardware":
        if name.startswith("plate_"): dep += " Used when plate=true; threaded holes consume half the diametral plate clearance."
        if name in {"connector", "connector_d"}: dep += " Used when fit_test=true; calibration strip clearances are fixed 0..0.5 mm in 0.1 mm steps."
        if name in {"extend", "joiner_thickness"}: dep += " Connected mounting metadata controls generated matching plates; extend also sets manual four-hole plate row spacing."
    if name in {"nut_clearance", "tip_taper", "tip_pitches"} and ty in {"ring", "hardware"}:
        dep += " Shared project setting for new edits; imported unequal values must be preserved until the user chooses synchronization."
    if ty == "colour_set":
        if name in {"hole_d", "inset", "pins", "pin_clearance", "pin_length"}: dep += " Registration requires holes>0; inset=0 centers holes in the margin; margin >= hole_d+1."
        if name in {"pin_clearance", "pin_length"}: dep += " Pins also require pins=true."
    if ty == "transform" and name.startswith("crop_"): dep += " Opposing percentages must leave at least one pixel."
    return {"tier": tier, "destination": dest, "dependency": dep, "integration_test": test}

def md(s):
    return str(s).replace("|", "\\|").replace("\n", " ")

def main():
    types = json.loads((ROOT / "docs/audit/runtime-catalogue.json").read_text(encoding="utf-8-sig"))
    assert set(WORKFLOWS) == {t["id"] for t in types}, "Unmapped processing type"
    src = (ROOT / CAT).read_text(encoding="utf-8")
    docs = (ROOT / "PARAMETERS.md").read_text(encoding="utf-8")
    documented = re.findall(r"^\| `([^`]+)` \|", docs, re.M)
    count = sum(len(t["params"]) for t in types)
    assert len(types) == 24 and count == 217, (len(types), count)
    assert count == len(documented), "Documentation count drift"
    rows = []
    text = ["<!-- BEGIN GENERATED PARAMETER MATRIX -->", "## Complete parameter matrix", "",
            f"Generated from the executed Rust catalogue at `{BASE}`. **{len(types)} processing types; {count} type-qualified parameter slots.** Repeated names on different operations count separately. This is preservation planning coverage, not completed redesigned UI or exhaustive per-value test coverage.", "",
            "PC-1: compare runtime type, default, range, step and choices with this snapshot and PARAMETERS.md. UI-1 (planned for implementation): locate each setting by search, edit/reset it, observe its stored engine parameter, save/reopen, and verify affected output or the documented inactive dependency. The named integration test covers the workflow; it does not assert every slider value. Exercise numeric endpoints, each choice, both boolean states, special sentinels, and dependency changes during parity implementation.", ""]
    # Check names per operation, rather than merely matching the grand total.
    sections = re.split(r"^### .*?\(`([^`]+)`\)\s*$", docs, flags=re.M)
    doc_names = {sections[i]: re.findall(r"^\| `([^`]+)` \|", sections[i+1], re.M) for i in range(1, len(sections), 2)}
    for t in types:
        assert doc_names[t["id"]] == [p["name"] for p in t["params"]], t["id"]
        node_start = src.index(f'id: "{t["id"]}"')
        node_line = src[:node_start].count("\n") + 1
        test_file = {"fragments": "crates/stencil-core/src/graph/fragments.rs", "reduce": "crates/stencil-core/src/colour.rs", "tone_patterns": "crates/stencil-core/src/colour.rs", "shapes_to_mask": "crates/stencil-core/src/trace.rs"}.get(t["id"], core_test)
        test = WORKFLOWS[t["id"]][3]
        assert f"fn {test}(" in (ROOT / test_file).read_text(encoding="utf-8"), test
        text += [f"### {t['label']} (`{t['id']}`) — {len(t['params'])} parameters", "",
                 f"Original UI: Inspector and Workbench → {md(t['label'])}. Definition: [{CAT}:{node_line}](../{CAT}#L{node_line}); shared helpers supply stencil and tone fields. Execution: `graph/nodes.rs`, `graph/colour_set.rs` or `graph/fragments.rs`. Existing workflow verification: `{test_file}::{test}`; plus PC-1 and planned UI-1.", "",
                 "| Parameter / label | Type | Default | Allowed values; step | Tier / destination | Dependencies and verification focus |", "|---|---|---|---|---|---|"]
        for p in t["params"]:
            extra = detail(t["id"], p)
            row = {"key": t["id"] + "." + p["name"], "type": t["id"], **p, **extra,
                   "original_ui": "Inspector / Workbench / " + t["label"],
                   "definition": f"{CAT}:{node_line}", "test_file": test_file,
                   "verification": "PC-1; existing integration test; UI-1 planned"}
            rows.append(row)
            allowed = " / ".join(p["choices"]) if "choices" in p else ("true / false" if p["kind"] == "bool" else (f"{p['min']:g}…{p['max']:g}; step {p['step']:g}" if "min" in p else "text; see dependency"))
            text.append(f"| `{row['key']}` — {md(p['label'])} | {p['kind']} | `{md(json.dumps(p['default'], ensure_ascii=False))}` | {md(allowed)} | T{extra['tier']}: {md(extra['destination'])} | {md(extra['dependency'])} |")
        text.append("")
    text.append("<!-- END GENERATED PARAMETER MATRIX -->")
    assert len({r["key"] for r in rows}) == count
    outputs = {ROOT / "docs/audit/parameter-mapping.json": json.dumps(rows, indent=2, ensure_ascii=False) + "\n"}
    inventory = ROOT / "docs/FEATURE_INVENTORY.md"
    inv = inventory.read_text(encoding="utf-8")
    summary = ["<!-- BEGIN GENERATED TYPE TABLE -->", "| Processing type | Parameters | Inputs (`!` required) | Outputs | Priority / destination |", "|---|---:|---|---|---|"]
    for t in types:
        tier, dest, _, _ = WORKFLOWS[t["id"]]
        ins = ", ".join(f"{p['name']}:{p['type']}{'!' if p['required'] else ''}" for p in t["inputs"]) or "none"
        outs = ", ".join(f"{p['name']}:{p['type']}" for p in t["outputs"])
        summary.append(f"| {md(t['label'])} (`{t['id']}`) | {len(t['params'])} | {md(ins)} | {md(outs)} | T{tier}: {md(dest)} |")
    summary.append("<!-- END GENERATED TYPE TABLE -->")
    if "<!-- BEGIN GENERATED TYPE TABLE -->" in inv:
        inv = re.sub(r"<!-- BEGIN GENERATED TYPE TABLE -->.*?<!-- END GENERATED TYPE TABLE -->", "\n".join(summary), inv, flags=re.S)
    else:
        inv = inv.replace("<!-- PROCESSING TYPES -->", "\n".join(summary))
    outputs[inventory] = inv
    target = ROOT / "docs/FEATURE_UI_MAPPING.md"
    current = target.read_text(encoding="utf-8")
    before = current.split("<!-- BEGIN GENERATED PARAMETER MATRIX -->")[0].rstrip()
    outputs[target] = before + "\n\n" + "\n".join(text) + "\n"
    # Record every pinned source file, including license/font binaries; do not include generated build assets.
    archive = tarfile.open(fileobj=io.BytesIO(subprocess.check_output(["git", "archive", BASE], cwd=ROOT)))
    files = sorted(m.name for m in archive.getmembers() if m.isfile())
    manifest = []
    for f in files:
        data = archive.extractfile(f).read()
        manifest.append({"path": f, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "lines": data.count(b"\n") if not f.endswith(".ttf") else None})
    outputs[ROOT / "docs/audit/source-manifest.json"] = json.dumps(manifest, indent=2) + "\n"
    for path, value in outputs.items():
        if "--check" in sys.argv:
            assert path.read_text(encoding="utf-8") == value, f"Regenerate {path.relative_to(ROOT)}"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(value, encoding="utf-8", newline="\n")
    print(f"PC-1 PASS: {len(types)} types, {count} unique qualified parameters, all documented names match, all mapped; {len(files)} pinned source files hashed.")

if __name__ == "__main__":
    main()
