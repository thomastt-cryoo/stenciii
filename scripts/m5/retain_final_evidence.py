"""Keep small, reviewable accepted examples and logs alongside their JSON reports."""
from pathlib import Path
import json, re, shutil
root=Path(__file__).resolve().parents[2]
docs=root/'docs/m5'
for source,name in {
 'm5-rust-final.log':'rust-final.log','m5-full-browser.log':'browser-full-windows.log',
 'm5-final-targeted.log':'browser-corrections-and-branches.log','m5-preservation.log':'preservation.log',
 'm5-st-final-build.log':'wasm-st-build.log','m5-mt-final-build.log':'wasm-mt-build.log',
 'm5-corpus.log':'corpus.log','m5-coverage-merge.log':'coverage-merge.log',
 'm5-performance.log':'performance.log','m5-npm-audit.json':'npm-audit.json',
}.items():
 p=root/'sandbox'/source
 text=p.read_text(encoding='utf-8-sig',errors='replace')
 text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text).replace(str(root),'<workspace>').replace(str(root).replace('\\','/'),'<workspace>')
 (docs/'logs'/name).write_text('\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n',encoding='utf-8')
for strategy in ['before','after']:
 for width in [640,900]:
  name=f'{strategy}-{width}'
  for ext in ['json','zip']:
   shutil.copyfile(root/f'sandbox/m5/performance/{name}.{ext}',docs/f'examples/{name}.{ext}')
for mode in ['native','st','mt']:
 shutil.copyfile(root/f'sandbox/m5/spread/{mode}.stl',docs/f'fixtures/spread-repaired-{mode}.stl')
for stem in ['tone_patterns-kind-after','tone_patterns-angle-after','tone_patterns-spacing_mm-after']:
 shutil.copyfile(root/f'sandbox/m5/a/{stem}.png',docs/f'examples/{stem}.png')
p=root/'M5_HANDOFF.md'
if p.exists():
 (docs/'checkpoints').mkdir(exist_ok=True)
 (docs/'checkpoints/PAUSED_CHECKPOINT.md').write_text('Historical checkpoint, superseded by the resumed verification and final M5 report.\n\n'+p.read_text(encoding='utf-8'),encoding='utf-8')
 p.unlink()
print('Retained accepted logs, four large tiled examples, tone masks and all three repaired Spread meshes.')
