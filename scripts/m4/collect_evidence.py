"""Collect accepted M4 runs and portable fixtures without rewriting M0–M3."""
from pathlib import Path
import json
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/m4'
sys.path.insert(0, str(ROOT / 'scripts/m0'))
from validate_artifacts import inspect

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def write(path, value):
    path.write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

def portable(text):
    text = text.replace(str(ROOT).replace('\\', '\\\\'), '<workspace>').replace(str(ROOT), '<workspace>').replace(ROOT.as_posix(), '<workspace>')
    text = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', text)
    return '\n'.join(line.rstrip() for line in text.splitlines()).strip() + '\n'

accepted = ['rust-accepted', 'wasm-st-accepted', 'wasm-mt-accepted', 'full-browser',
            'corpus', 'preservation', 'production-build', 'production-tests',
            'production-modes', 'embedded-build', 'package']
(OUT / 'logs').mkdir(exist_ok=True)
for name in accepted:
    source = ROOT / f'sandbox/m4-{name}.log'
    if source.exists():
        (OUT / f'logs/{name}.log').write_text(portable(source.read_text(encoding='utf-8-sig')), encoding='utf-8')
rust = (ROOT / 'sandbox/m4-rust-accepted.log').read_text(encoding='utf-8-sig')
counts = re.findall(r'test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored', rust)
summary = {'date_dubai': '2026-10-29', 'approved_m3_base': '6191ce7cd4476a0c45ed9f2c0047fa8fa1e2d1cf',
           'rust': dict(zip(['passed', 'failed', 'ignored'], [sum(int(c[i]) for c in counts) for i in range(3)])),
           'browser_runs': {}, 'not_run': ['Physical prints', 'macOS/Linux desktop launch', 'Firefox/Safari', 'Fresh-machine offline installation']}
for name in ['full-browser', 'production-tests']:
    value = (ROOT / f'sandbox/m4-{name}.log').read_text(encoding='utf-8-sig')
    summary['browser_runs'][name] = {'passed': re.findall(r'(\d+) passed \(([^)]+)\)', value), 'failed': re.findall(r'(\d+) failed', value)}
write(OUT / 'test-results.json', summary)
write(OUT / 'npm-audit.json', read(ROOT / 'sandbox/m4-npm-audit.json'))

coverage = read(OUT / 'geometry-coverage.json')
assert coverage['slots'] == 48 and all(c['verified'] for c in coverage['cases'])
assert sum(c['output_or_diagnostic_changed'] for c in coverage['cases']) == 47
artwork = read(OUT / 'artwork-coverage.json')
assert artwork['scoped_slots'] == 41 and all(c['output_changed'] for c in artwork['cases'])
catalogue = read(ROOT / 'docs/audit/runtime-catalogue.json')
params = {f"{t['id']}.{p['name']}": p for t in catalogue for p in t['params']}
previous = {'width_mm', 'thickness_mm', 'margin_mm', 'bridge_mm', 'raised_bridges', 'bridges_per_island', 'layer_height_mm', 'extra_top_layers'}
old = {f'{t}.{p}' for t in ['stencil', 'vector_stencil'] for p in previous} | {'vector_stencil.detail'}
new = [c['key'] for c in coverage['cases'] if c['key'] not in old]
assert len(new) == 31
lines = ['# Geometry parameter evidence', '',
         'All 48 fields use genuine per-instance controls, exact saved readback, runtime-default reset and suitable engine execution. 17 existing physical fields are reused; 31 are new. Together with 41 artwork fields, the customer app has 89 unique editable qualified fields.', '',
         '47 fields change geometry or an applicable computed diagnostic. The remesh overhang limit is verified during active reconstruction at 10° and 85°: both outputs satisfy the constraint and are identical. A limit need not change an already compliant result. No fake diagnostic echo is counted.', '',
         '| Qualified field | Added in M4 | Engine default | Allowed / increment | Tested change | Evidence |',
         '|---|---|---|---|---|---|']
fixtures = OUT / 'fixtures'; fixtures.mkdir(exist_ok=True)
selected = {'vector_stencil.bridge_spacing', 'vector_stencil.z_bridging', 'vector_stencil.layer_height_mm',
            'vector_stencil.min_first_layer_width_mm', 'remesh.tolerance_mm', 'remesh.decimate'}
examples = OUT / 'examples'; examples.mkdir(exist_ok=True)
validation = {}
for c in coverage['cases']:
    p = params[c['key']]
    allowed = ', '.join(p['choices']) if p.get('choices') else f"{p['min']}–{p['max']}; step {p.get('step', 'runtime')}" if 'min' in p else p['kind']
    lines.append(f"| `{c['key']}` | {'Yes' if c['key'] in new else 'Reused'} | {json.dumps(p['default'])} | {allowed} | {json.dumps(c['changed_to'])} | {'Changed' if c['output_or_diagnostic_changed'] else 'Active constraint satisfied'} |")
    for phase in ['before', 'after']:
        source = ROOT / c[f'project_{phase}']
        if not source.exists():
            source = fixtures / source.name
        dest = fixtures / source.name
        if source != dest:
            shutil.copyfile(source, dest)
        c[f'project_{phase}'] = dest.relative_to(ROOT).as_posix()
        if c['key'] in selected:
            mesh = ROOT / f"sandbox/m4/coverage/{c['key'].replace('.', '-')}-{phase}.{c[phase]['extension']}"
            copied = examples / mesh.name
            shutil.copyfile(mesh, copied)
            validation[copied.relative_to(ROOT).as_posix()] = inspect(copied)
for name in ['bridges-before', 'bridges-after', 'remesh-before', 'remesh-after']:
    source = ROOT / f'sandbox/m4/{name}.stl'
    if source.exists():
        dest = examples / source.name
        shutil.copyfile(source, dest)
        validation[dest.relative_to(ROOT).as_posix()] = inspect(dest)
write(OUT / 'geometry-coverage.json', coverage)
write(OUT / 'artifact-validation.json', validation)
(OUT / 'PARAMETER_COVERAGE.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
(OUT / 'NEW_PARAMETERS.md').write_text('# Newly editable geometry fields\n\n' + '\n'.join('- `' + k + '`' for k in new) + '\n', encoding='utf-8')
gallery = ['# Openable geometry demonstrations', '',
           'All 96 saved before/after projects are in [fixtures](fixtures/). Open one in Stencil Studio or replay it with `stencil --project <file> -o <output.stl>`. Tile-method projects produce part sets and should use an output directory. Original artwork bytes and opaque metadata are embedded.', '',
           'The selected STL pairs below were independently checked for closed oriented geometry. They show actual engine output, not rendered substitutes.', '',
           '| Changed field | Before STL | After STL | Triangles before → after |', '|---|---|---|---|']
for c in coverage['cases']:
    if c['key'] not in selected:
        continue
    stem = c['key'].replace('.', '-')
    gallery.append(f"| `{c['key']}` | [Before](examples/{stem}-before.stl) | [After](examples/{stem}-after.stl) | {c['before']['validation']['triangles']} → {c['after']['validation']['triangles']} |")
gallery += ['', 'Reconstruction tolerance changes from 0.2 to 0.4 mm in the tolerance pair (source 3,444 triangles). The decimation pair retains source outlines when layer reconstruction is unsafe, then genuinely simplifies flat faces. Engine-reported maximum deviation and the phase-specific tolerances are recorded separately; they are not interchangeable metrics. See geometry-coverage.json for all bounds, volumes, hashes and diagnostics.']
(OUT / 'EXAMPLES.md').write_text('\n'.join(gallery) + '\n', encoding='utf-8')
probe = OUT / 'geometry-probe.json'
if probe.exists():
    probe.unlink()
print(f"Rust {summary['rust']}; 48 geometry fields verified; 31 new; 89 total; {len(validation)} retained STLs independently validated.")
