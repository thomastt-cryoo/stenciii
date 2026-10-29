from pathlib import Path
import json,subprocess,hashlib,sys
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'scripts/m0'))
from validate_artifacts import inspect
out=root/'docs/m5';results={'direct_angles':{},'additional_guarded_ring_probe':{}}
svg=root/'docs/m5/fixtures/cli-seam-simple.svg'
svg.write_text('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="white"/><rect x="20" y="30" width="55" height="40" fill="black"/></svg>',encoding='utf8')
for angle in [0,20]:
    directory=root/f'sandbox/m5/cli-angle-{angle}'
    cli=subprocess.run([str(root/'target/release/stencil.exe'),str(svg),'--resolution','200','--width','160','--margin','20','--thickness','8','--tile-width','90','--tile-height','90','--seam-angle',str(angle),'--segments','24','-o',str(directory)],capture_output=True,text=True)
    assert cli.returncode==0,cli.stderr
    models={p.name:inspect(p) for p in sorted(directory.glob('*.stl'))}
    assert models and all(v['closed_oriented_mesh'] for v in models.values())
    results['direct_angles'][str(angle)]={'command':['--seam-angle',str(angle)],'stdout':cli.stdout,'independent_files':models,'sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(directory.glob('*.stl'))}}
    target=out/'examples'/f'cli-angle-{angle}.zip';target.parent.mkdir(exist_ok=True);target.write_bytes(directory.with_suffix('.zip').read_bytes())
assert results['direct_angles']['0']['sha256']!=results['direct_angles']['20']['sha256']
for angle in [0,20]:
    directory=root/f'sandbox/m5/seam-probe/{angle}'
    if directory.exists():results['additional_guarded_ring_probe'][str(angle)]={p.name:inspect(p) for p in sorted(directory.glob('*.stl'))}
(out/'cli-seam-angle.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf8')
print('Direct 0 and 20 degree seam files differ and every stored output STL passes independent geometry checks.')
for angle,files in results['additional_guarded_ring_probe'].items():
    print('Additional ring',angle,[(name,v['degenerate_faces'],v['edges_not_shared_twice'],v['inconsistent_edge_winding']) for name,v in files.items() if not v['closed_oriented_mesh']])
