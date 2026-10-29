"""Independent format and closed-mesh checks for M0 output files (Python stdlib)."""
import argparse
import collections
import json
import math
from pathlib import Path
import struct
import xml.etree.ElementTree as ET
import zipfile


def stl(data):
    assert len(data) >= 84, "truncated STL header"
    count, = struct.unpack_from("<I", data, 80)
    assert count > 0 and len(data) == 84 + 50 * count, "STL triangle count/length mismatch"
    edges = collections.Counter()
    directions = collections.Counter()
    vertices = {}
    parent = []
    def vertex(p):
        if p not in vertices:
            vertices[p] = len(parent)
            parent.append(len(parent))
        return vertices[p]
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    def join(a, b):
        parent[find(a)] = find(b)
    volume = 0.0
    lo = [math.inf] * 3
    hi = [-math.inf] * 3
    degenerate = 0
    for i in range(count):
        face = struct.unpack_from("<12f", data, 84 + 50 * i)
        assert all(math.isfinite(x) for x in face), "non-finite STL coordinate/normal"
        a, b, c = (tuple(face[j:j+3]) for j in (3, 6, 9))
        ids = [vertex(p) for p in (a, b, c)]
        ab, ac = [b[k]-a[k] for k in range(3)], [c[k]-a[k] for k in range(3)]
        cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]]
        if len(set(ids)) < 3 or sum(x*x for x in cross) <= 1e-24:
            degenerate += 1
        for p in (a, b, c):
            for k in range(3):
                lo[k], hi[k] = min(lo[k], p[k]), max(hi[k], p[k])
        for x, y in zip(ids, ids[1:] + ids[:1]):
            edges[tuple(sorted((x, y)))] += 1
            directions[tuple(sorted((x, y)))] += 1 if x < y else -1
            join(x, y)
        volume += (a[0]*(b[1]*c[2]-b[2]*c[1]) - a[1]*(b[0]*c[2]-b[2]*c[0]) + a[2]*(b[0]*c[1]-b[1]*c[0])) / 6
    bad = sum(v != 2 for v in edges.values())
    winding = sum(v != 0 for v in directions.values())
    result = {"format": "binary STL", "bytes": len(data), "triangles": count, "vertices": len(vertices),
              "bounds_mm": [lo, hi], "size_mm": [hi[k]-lo[k] for k in range(3)], "signed_volume_mm3": volume,
              "components": len({find(i) for i in range(len(parent))}), "edges_not_shared_twice": bad,
              "inconsistent_edge_winding": winding, "degenerate_faces": degenerate}
    # Exact exported float32 coordinates; do not weld or repair the file being validated.
    result["closed_oriented_mesh"] = bad == 0 and winding == 0 and degenerate == 0 and abs(volume) > 1e-9
    return result


def inspect(path):
    if path.suffix.lower() == ".stl":
        return stl(path.read_bytes())
    if path.suffix.lower() == ".zip":
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None, "ZIP CRC error"
            names = z.namelist()
            assert len(names) == len(set(names)), "duplicate ZIP filename"
            return {"format": "ZIP", "bytes": path.stat().st_size, "entries": [
                {"name": i.filename, "date_time": i.date_time, "crc": i.CRC,
                 **(stl(z.read(i)) if i.filename.lower().endswith(".stl") else {})} for i in z.infolist()]}
    if path.suffix.lower() == ".svg":
        root = ET.parse(path).getroot()
        assert root.tag == "{http://www.w3.org/2000/svg}svg", "not SVG XML"
        return {"format": "SVG", "paths": len(root.findall(".//{http://www.w3.org/2000/svg}path")), "attributes": root.attrib}
    if path.suffix.lower() == ".png":
        data = path.read_bytes()
        assert data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR", "not PNG"
        return {"format": "PNG", "size_px": struct.unpack_from(">II", data, 16)}
    raise ValueError(f"unsupported artifact {path}")


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("files", nargs="+")
    p.add_argument("--output", type=Path)
    a = p.parse_args()
    result = {str(f): inspect(Path(f)) for f in a.files}
    text = json.dumps(result, indent=2) + "\n"
    if a.output:
        a.output.write_text(text, encoding="utf-8")
    else:
        print(text, end="")
    checks = [m.get("closed_oriented_mesh", True) for v in result.values() for m in ([v] if v["format"] != "ZIP" else v["entries"])]
    assert all(checks), "one or more STL files is not an exact closed oriented mesh; inspect report"
    print(f"Validated {len(result)} artifact(s).")


if __name__ == "__main__":
    main()
