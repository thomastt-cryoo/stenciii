"""Verify the embedded server serves the production bytes, isolation headers and modes."""
import hashlib
import json
from pathlib import Path
import struct
import urllib.request
ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / 'docs/m3/production-manifest.json').read_text())
base = 'http://127.0.0.1:5210/'
checks = []
for item in manifest['files']:
    with urllib.request.urlopen(base + item['path']) as response:
        data = response.read()
        assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
        checks.append({'path': item['path'], 'matches_production_sha256': True, 'status': response.status})
with urllib.request.urlopen(base) as response:
    headers = dict(response.headers.items())
    assert response.headers.get('Cross-Origin-Opener-Policy') == 'same-origin'
    assert response.headers.get('Cross-Origin-Embedder-Policy') == 'require-corp'
try:
    urllib.request.urlopen(base + 'legacy.html')
    raise AssertionError('Legacy harness unexpectedly served')
except urllib.error.HTTPError as error:
    assert error.code == 404


def canonical(path):
    data = path.read_bytes()
    count, = struct.unpack_from('<I', data, 80)
    return sorted(tuple(sorted(tuple(round(v, 4) for v in struct.unpack_from('<3f', data, 96+50*i+12*j)) for j in range(3))) for i in range(count))


equivalent = []
for style in ['standard', 'smooth', 'crisp', 'text', 'long']:
    native = canonical(ROOT / f'sandbox/m3/modes/native-{style}.stl')
    for mode in ['mt', 'st']:
        assert canonical(ROOT / f'sandbox/m3/modes/{mode}-{style}.stl') == native
    equivalent.append({'style': style, 'native_single_thread_threaded_triangles_match_at_mm': .0001})
binary = ROOT / 'target/release/stencil.exe'
result = {'url': base, 'files': checks, 'coop': headers.get('Cross-Origin-Opener-Policy'), 'coep': headers.get('Cross-Origin-Embedder-Policy'), 'legacy_harness_status': 404, 'native_wasm_equivalence': equivalent, 'binary_bytes': binary.stat().st_size, 'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest()}
(ROOT / 'docs/m3/packaging.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print('Embedded studio: production hashes, COOP/COEP, no legacy harness, and 5-case native/ST/MT equivalence passed.')
