"""Collect observed M1 results; raw artifacts remain under ignored sandbox/."""
import json
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/m1'
OUT.mkdir(parents=True, exist_ok=True)


def portable(text):
    for old, new in [(str(ROOT), '<workspace>'), (str(Path.home()), '<user>')]:
        text = text.replace(old.replace('\\', '\\\\'), new).replace(old, new).replace(old.replace('\\', '/'), new)
    text = re.sub(r'\x1b\[[0-9;]*[A-Za-z]', '', text)
    return '\n'.join(line.rstrip() for line in text.splitlines()).rstrip() + '\n'


def browser(path):
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    results = []
    def walk(suite):
        for spec in suite.get('specs', []):
            for t in spec['tests']:
                results.append({'title': spec['title'], 'file': spec['file'], 'outcome': t['status'],
                                'runs': [{'status': r['status'], 'duration_ms': r['duration'],
                                          'errors': [portable(e.get('message', '')) for e in r.get('errors', [])]}
                                         for r in t['results']]})
        for child in suite.get('suites', []):
            walk(child)
    for s in data['suites']:
        walk(s)
    return {'stats': data['stats'], 'tests': results}


test_files = {
    'combined_regression': ROOT / 'sandbox/m1-all-tests.json',
    'customer_after_visual_refinement': ROOT / 'sandbox/m1/final-customer-tests.json',
    'single_thread_customer': ROOT / 'sandbox/m1/single-thread-test.json',
    'final_production_and_model_checks': ROOT / 'sandbox/m1/production-tests.json',
}
rust = (ROOT / 'sandbox/m1/rust-tests.log').read_text(encoding='utf-8-sig')
counts = [tuple(map(int, c)) for c in re.findall(r'test result: ok\. (\d+) passed; (\d+) failed; (\d+) ignored', rust)]
results = {
    'date_dubai': '2026-10-29', 'base_commit': 'dd268e884d1722f9606c8f8d984662d8de03bed1',
    'rust': {'passed': sum(c[0] for c in counts), 'failed': sum(c[1] for c in counts), 'ignored': sum(c[2] for c in counts)},
    'browser_runs': {name: browser(path) for name, path in test_files.items()},
    'development_corrections': [
        {'check': 'First 15-test run', 'passed': 12, 'failed': 3, 'cause': 'Missing dialog focus return and disabled export link losing its link role in two checks', 'resolution': 'Fixed; all 15 passed on rerun, and retained in final production checks'},
        {'check': 'Node 26 test module import', 'cause': 'JSON import required type attribute', 'resolution': 'Added JSON import attribute; Vite still bundles catalogue routing locally'},
    ],
    'not_run': ['macOS', 'Firefox/Safari', 'Tauri/WebView2/WKWebView', 'Fresh-machine offline installation', 'Remote CI status', 'Future specialist editors'],
}
(OUT / 'test-results.json').write_text(json.dumps(results, indent=2) + '\n', encoding='utf-8', newline='\n')
logs = {
    'rust-tests.log': ROOT / 'sandbox/m1/rust-tests.log',
    'combined-browser.log': ROOT / 'sandbox/m1-all-tests.log',
    'final-customer.log': ROOT / 'sandbox/m1/final-customer-tests.log',
    'single-thread.log': ROOT / 'sandbox/m1/single-thread-test.log',
    'production-tests.log': ROOT / 'sandbox/m1/production-tests.log',
    'production-build.log': ROOT / 'sandbox/m1/build-production.log',
    'regression-build.log': ROOT / 'sandbox/m1/build-final-regression.log',
}
(OUT / 'logs').mkdir(exist_ok=True)
for name, path in logs.items():
    (OUT / 'logs' / name).write_text(portable(path.read_text(encoding='utf-8-sig')), encoding='utf-8', newline='\n')
for name in ['artifact-validation.json', 'engine-equivalence.json', 'production-manifest.json', 'npm-audit.json']:
    value = json.loads((ROOT / 'sandbox/m1' / name).read_text(encoding='utf-8-sig'))
    (OUT / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8', newline='\n')
(OUT / 'fixtures').mkdir(exist_ok=True)
shutil.copyfile(ROOT / 'sandbox/m1/browser-saved-project.json', OUT / 'fixtures/browser-saved-project.json')
print('Collected M1 Rust, browser, production, native-equivalence and geometry evidence.')
