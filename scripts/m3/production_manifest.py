"""Record customer-only assets and the two freshly built engine variants."""
from pathlib import Path
import hashlib
import json
ROOT = Path(__file__).resolve().parents[2]
dist = ROOT / 'web/dist'
files = sorted(p for p in dist.rglob('*') if p.is_file())
assert not (dist / 'legacy.html').exists()
assert not (dist / 'regression-api.html').exists()
assert not any('legacy-' in p.name or 'engineRegression' in p.name for p in files)
result = {'production_only': True, 'legacy_harness_emitted': False, 'regression_api_emitted': False,
          'files': [{'path': p.relative_to(dist).as_posix(), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
          'engine_builds': [{'path': str(p.relative_to(ROOT)).replace('\\', '/'), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [ROOT / 'web/pkg/stencil_wasm_bg.wasm', ROOT / 'web/public/pkg-mt/stencil_wasm_bg.wasm']]}
(ROOT / 'docs/m3/production-manifest.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(f'Production-only assets verified: {len(files)} local files, no legacy or regression entry.')
