"""Collect portable M2 evidence without rewriting approved M0/M1 evidence."""
import json
import re
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/m2'
OUT.mkdir(parents=True, exist_ok=True)


def portable(text):
    text = text.replace(str(ROOT).replace('\\', '\\\\'), '<workspace>').replace(str(ROOT), '<workspace>').replace(ROOT.as_posix(), '<workspace>')
    return re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', text).replace('\r\n', '\n').rstrip() + '\n'


def browser(path):
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    tests = []
    def visit(suite):
        for spec in suite.get('specs', []):
            for test in spec['tests']:
                tests.append({'title': spec['title'], 'file': spec['file'], 'outcome': test['status'], 'runs': [{'status': run['status'], 'duration_ms': run['duration'], 'errors': [portable(e.get('message', '')) for e in run.get('errors', [])]} for run in test['results']]})
        for child in suite.get('suites', []):
            visit(child)
    for suite in data['suites']:
        visit(suite)
    return {'stats': data['stats'], 'tests': tests}


rust = (ROOT / 'sandbox/m2-rust-tests.log').read_text(encoding='utf-8-sig')
counts = [tuple(map(int, count)) for count in re.findall(r'test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored', rust)]
results = {'date_dubai': '2026-10-29', 'base_commit': '61a98108b2cab1d248585ef9c465abcde9fd54e6',
           'rust': {'passed': sum(c[0] for c in counts), 'failed': sum(c[1] for c in counts), 'ignored': sum(c[2] for c in counts)},
           'browser_runs': {},
           'development_corrections': [
               {'check': 'Initial new browser flows', 'cause': 'Browser timer functions invoked with an incompatible receiver', 'resolution': 'Wrapped timer calls; live styles/drafts passed real browser tests'},
               {'check': 'First complete 121-test run', 'passed': 120, 'failed': 1, 'cause': 'Concurrent quality runner cleared the browser download output folder', 'resolution': 'Separate quality-test output directory; reran complete suite'},
               {'check': 'Quality visual review', 'cause': 'Engine morphology iterations=0 still performs one opening pass', 'resolution': 'Bypass raster cleanup operation by default; explicit reversible opt-in, tested restoration and improved fine-line preservation'}],
           'not_run': ['macOS/Linux desktop launch', 'Firefox/Safari', 'Physical 3D prints', 'Fresh-machine installation without a prepared local build', 'M3–M5 specialist editors']}
for name, filename in [('complete_regression', 'm2-e2e-final.json'), ('production_customer', 'm2-production-tests.json')]:
    path = ROOT / 'sandbox' / filename
    if path.exists():
        results['browser_runs'][name] = browser(path)
(OUT / 'test-results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8')
audit = ROOT / 'sandbox/m2-npm-audit.json'
if audit.exists():
    (OUT / 'npm-audit.json').write_text(json.dumps(json.loads(audit.read_text(encoding='utf-8-sig')), indent=2) + '\n', encoding='utf-8')
(OUT / 'logs').mkdir(exist_ok=True)
for filename in ['m2-rust-tests.log', 'm2-native-build.log', 'm2-wasm-st.log', 'm2-wasm-mt.log', 'm2-regression-build.log', 'm2-e2e-final.log', 'm2-production-build.log', 'm2-production-tests.log', 'm2-quality-final.log', 'm2-embedded-build.log']:
    source = ROOT / 'sandbox' / filename
    if source.exists():
        (OUT / 'logs' / filename.removeprefix('m2-')).write_text(portable(source.read_text(encoding='utf-8-sig')), encoding='utf-8')
sys.path.insert(0, str(ROOT / 'scripts/m0'))
from validate_artifacts import inspect
old = json.loads((ROOT / 'docs/audit/artifact-validation.json').read_text())['sandbox/m0/native-raster.stl']
fixed = inspect(ROOT / 'sandbox/m2/raster-ring-100.stl')
(OUT / 'raster-fix.json').write_text(json.dumps({'fixture': 'M0 ring.svg; --width 60 --thickness 2 --resolution 100; same defaults', 'before_M0': old, 'after_M2': fixed, 'signed_volume_unchanged': old['signed_volume_mm3'] == fixed['signed_volume_mm3'], 'bounds_unchanged': old['bounds_mm'] == fixed['bounds_mm']}, indent=2) + '\n', encoding='utf-8')
corpus = json.loads((OUT / 'corpus-results.json').read_text())
for row in corpus['cases']:
    row['log'] = portable(row['log']).strip()
(OUT / 'corpus-results.json').write_text(json.dumps(corpus, indent=2) + '\n', encoding='utf-8')
print(f'Collected Rust {results["rust"]}, browser reports, corpus and exact M0 raster regression.')
