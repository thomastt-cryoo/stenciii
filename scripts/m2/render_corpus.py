"""Independent orthographic union of actual STL facets for visual quality review."""
import json
import math
from pathlib import Path
import struct
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
data = json.loads((ROOT / 'docs/m2/corpus-results.json').read_text())
out = ROOT / 'docs/m2/projections'; out.mkdir(parents=True, exist_ok=True)
rows = {}
for case in data['cases']:
    rows.setdefault(case['input'], []).append(case)
    if 'mesh' not in case:
        continue
    file = ROOT / case['output']; blob = file.read_bytes()
    lo, hi = case['mesh']['bounds_mm']
    scale = 248 / max(hi[0] - lo[0], hi[1] - lo[1])
    w, h = hi[0] - lo[0], hi[1] - lo[1]
    image = Image.new('RGB', (280, 280), '#f7f7f5'); draw = ImageDraw.Draw(image)
    px = lambda x, y: (140 + (x - lo[0] - w / 2) * scale, 140 - (y - lo[1] - h / 2) * scale)
    for i in range(case['mesh']['triangles']):
        p = struct.unpack_from('<9f', blob, 96 + 50 * i)
        cross = (p[3]-p[0])*(p[7]-p[1])-(p[4]-p[1])*(p[6]-p[0])
        if abs(cross) > 1e-12:
            draw.polygon([px(p[j], p[j+1]) for j in [0, 3, 6]], fill='#444441')
    target = out / (file.stem + '.png'); image.save(target)
    case['projection'] = target
entries = list(rows.items())
for page in range(math.ceil(len(entries)/4)):
    html = '<!doctype html><meta charset="utf-8"><style>body{margin:24px;font:14px Arial;color:#222;background:white}h1{font-size:20px}section{display:grid;grid-template-columns:repeat(4,280px);gap:12px;margin:20px 0 28px}img{width:280px;height:280px;object-fit:contain;background:#f7f7f5}p{height:30px;font-size:12px;line-height:1.5;margin:5px 0}.error{height:280px;display:grid;place-items:center;background:#f7f7f5}</style>'
    html += f'<h1>M2 quality review {page+1} — source / Standard / Smooth Vector / Crisp Raster</h1>'
    for name, cases in entries[page*4:page*4+4]:
        html += f'<section><div><img src="{(ROOT / "web/e2e/corpus" / name).as_uri()}"><p>{name} · Original</p></div>'
        for case in cases:
            html += '<div>'
            if case.get('projection'):
                html += f'<img src="{case["projection"].as_uri()}"><p>{case["style"]} · {case["mesh"]["triangles"]:,} triangles · {case["milliseconds"]} ms</p>'
            else:
                html += f'<div class="error">No visible outlines · Engine refused</div><p>{case["style"]} · No STL exported</p>'
            html += '</div>'
        html += '</section>'
    target = ROOT / f'sandbox/m2/quality-{page+1}.html'; target.write_text(html, encoding='utf-8')
print(f'Rendered {len([c for c in data["cases"] if "mesh" in c])} exact STL projections and 4 review pages')
