"""Verify the embedded M5 server serves exactly the production customer assets."""
import hashlib
import json
from pathlib import Path
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[2]
manifest = json.loads((ROOT / 'docs/m5/production-manifest.json').read_text(encoding='utf-8'))
base = 'http://127.0.0.1:5210/'
checks = []
for item in manifest['files']:
    with urllib.request.urlopen(base + item['path']) as response:
        assert hashlib.sha256(response.read()).hexdigest() == item['sha256'], item['path']
        checks.append({'path': item['path'], 'matches_production_sha256': True, 'status': response.status})
with urllib.request.urlopen(base) as response:
    headers = dict(response.headers.items())
    assert response.headers.get('Cross-Origin-Opener-Policy') == 'same-origin'
    assert response.headers.get('Cross-Origin-Embedder-Policy') == 'require-corp'
for path in ['legacy.html', 'regression-api.html']:
    try:
        urllib.request.urlopen(base + path)
        raise AssertionError(f'{path} unexpectedly served')
    except urllib.error.HTTPError as error:
        assert error.code == 404
binary = ROOT / 'target/release/stencil.exe'
result = {'url': base, 'files': checks, 'coop': headers.get('Cross-Origin-Opener-Policy'),
          'coep': headers.get('Cross-Origin-Embedder-Policy'), 'test_entries_status': 404,
          'binary_bytes': binary.stat().st_size, 'binary_sha256': hashlib.sha256(binary.read_bytes()).hexdigest()}
(ROOT / 'docs/m5/packaging.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'Embedded studio: {len(checks)} production hashes, isolation headers and no test/legacy entries verified.')
