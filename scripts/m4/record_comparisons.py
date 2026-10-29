"""Complete native comparisons after a strict equivalence failure; retain every difference.

Requires the actual ST/MT worker artifacts and metadata from verify_modes.mjs.
All meshes must independently validate. Equality is measured, never assumed.
The strict compare_geometry.py command remains unchanged and fails on a mismatch.
"""
from pathlib import Path
import json
import subprocess
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from compare_geometry import check

ROOT = Path(__file__).resolve().parents[2]
path = ROOT / 'docs/m4/production-modes.json'
report = json.loads(path.read_text(encoding='utf-8'))
assert len(report['cases']) == 96
for row in report['cases']:
    tiled = row['key'].endswith('.tile_method')
    out = ROOT / f"sandbox/m4/modes/native-{row['stem']}"
    if tiled:
        out.mkdir(exist_ok=True)
    else:
        out = out.with_suffix('.stl')
    process = subprocess.run([str(ROOT / 'target/release/stencil.exe'), '--project', row['project'], '-o', str(out)],
                             capture_output=True, encoding='utf-8', timeout=120)
    assert process.returncode == 0, (row['stem'], process.stderr)
    if tiled:
        out = out / (Path(row['project']).stem + '.zip')
    records = [check(p) for p in [out, row['st']['path'], row['mt']['path']]]
    row['comparison'] = records
    row['native'] = {'path': out.relative_to(ROOT).as_posix(), 'stdout': process.stdout.strip()}
    row['native_st_mt_equal'] = all(r['geometry_hashes'] == records[0]['geometry_hashes'] for r in records)
    row['st_mt_equal'] = records[1]['geometry_hashes'] == records[2]['geometry_hashes']
    path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
differences = [r['stem'] for r in report['cases'] if not r['native_st_mt_equal']]
report['summary'] = {'fixtures': len(report['cases']), 'native_st_mt_equal': 96 - len(differences),
                     'native_differences': differences, 'st_mt_equal': sum(r['st_mt_equal'] for r in report['cases']),
                     'independently_validated': 288, 'rounding_mm': .0001}
path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps(report['summary']))
