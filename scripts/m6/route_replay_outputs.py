"""Route historical browser-test outputs to M6; preserve every assertion/input."""
from pathlib import Path
import re
root=Path(__file__).resolve().parents[2]
changed=[]
for path in (root/'web/e2e').glob('*.ts'):
    if path.name.startswith('m6-'):continue
    text=path.read_text(encoding='utf-8');original=text
    # These are immutable committed input fixtures, not outputs from this run.
    inputs=['../docs/m5/fixtures/fit-test-before-m5.stl','../docs/m5/examples/ten-colour-project.json']
    for i,p in enumerate(inputs):text=text.replace(p,f'__M6_IMMUTABLE_INPUT_{i}__')
    text=text.replace('docs/m5/','docs/m6/replay/m5/').replace("'../docs/m5'","'../docs/m6/replay/m5'")
    text=re.sub(r'sandbox/m([1-5])(?=/|[\'"`])',r'sandbox/m6/replay/m\1',text)
    for i,p in enumerate(inputs):text=text.replace(f'__M6_IMMUTABLE_INPUT_{i}__',p)
    if text!=original:path.write_text(text,encoding='utf-8',newline='\n');changed.append(path.name)
print('Historical output-only routing:',', '.join(changed))
