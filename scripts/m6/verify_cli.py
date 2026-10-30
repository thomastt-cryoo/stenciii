"""Real native CLI batch/sweep, strict report, schema and output checks."""
from pathlib import Path
import base64,csv,hashlib,json,shutil,subprocess,sys,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import inspect
root=Path(__file__).resolve().parents[2];exe=root/'target/release'/('stencil.exe' if sys.platform=='win32' else 'stencil');work=root/'sandbox/m6/cli';work.mkdir(parents=True,exist_ok=True)
def run(args):
    start=time.monotonic();p=subprocess.run([str(exe),*map(str,args)],capture_output=True,text=True,encoding='utf-8',timeout=240)
    return p,{'arguments':list(map(str,args)),'exit_code':p.returncode,'seconds':time.monotonic()-start,'stdout':p.stdout,'stderr':p.stderr}
project=json.loads((root/'docs/m6/workflows/vector.json').read_text(encoding='utf-8'));graph=project['graph'];build=next(n for n in graph['nodes'] if n['type']=='vector_stencil');source=next(n for n in graph['nodes'] if n['type']=='source');source['params']['resolution']=160
build['params'].update(width_mm=100,thickness_mm=3,margin_mm=12,raised_bridges=False,extra_top_layers=0)
path=work/'recipe.json';path.write_text(json.dumps(project),encoding='utf-8');pics=work/'images';pics.mkdir(exist_ok=True)
for target,original in [('one,logo.svg','simple-logo.svg'),('=local.png','transparent.png'),('pixel.bmp','small-pixel.bmp')]:shutil.copyfile(root/'web/e2e/corpus'/original,pics/target)
(pics/'broken.svg').write_text('intentionally damaged artwork',encoding='utf-8');output=work/'batch';result,record=run(['--project',path,'--batch',pics,'--sweep',f"{build['id']}.width_mm=100,120",'--sweep',f"{build['id']}.bridge_spacing=closest,spread",'-o',output])
assert result.returncode!=0
rows=list(csv.DictReader((output/'summary.csv').open(encoding='utf-8',newline='')));assert len(rows)==16 and all(len(r)==7 and None not in r for r in rows)
assert sum(r['status']=='ok' for r in rows)==12 and sum(r['status']=='failed' for r in rows)==4
assert sum(r['run'].startswith("'=local_") for r in rows)==4
meshes={p.relative_to(work).as_posix():inspect(p) for p in output.rglob('*.stl')};assert len(meshes)==12 and all(m['closed_oriented_mesh'] for m in meshes.values())
# An unused empty cleanup output must not cause strict mode to reject real artwork.
trace=next(n for n in graph['nodes'] if n['type']=='trace');clean={'id':'clean','type':'remove_islands','params':{'delete_specks':False,'fill_holes':False}}
graph['nodes'].insert(-1,clean);edge=next(e for e in graph['edges'] if e['to'][0]==build['id']);edge['from']=['clean','shapes'];graph['edges'].append({'from':[trace['id'],'shapes'],'to':['clean','shapes']})
simple='<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="white"/><rect x="20" y="20" width="40" height="40"/></svg>'
project['images'][source['params']['image_id']]={'name':'Strict.svg','base64':base64.b64encode(simple.encode()).decode()};path.write_text(json.dumps(project),encoding='utf-8')
strict,strict_record=run(['--project',path,'--strict','--report-file',work/'strict-report.json','-o',work/'strict.stl']);assert strict.returncode==0,strict.stderr
strict_report=json.loads((work/'strict-report.json').read_text());assert strict_report['verdict']=='ready',strict_report
for override in ['missing.value=1',f"{build['id']}.width_mm=-10",f"{build['id']}.bridge_spacing=unsupported"]:
    rejected,rejection=run(['--project',path,'--set',override,'-o',work/'must-not-exist.stl']);assert rejected.returncode!=0
    assert not (work/'must-not-exist.stl').exists()
listing,listed=run(['--list-params','--params-format','markdown']);assert listing.returncode==0
summary={'batch_and_cartesian_sweep':record,'summary_rows':rows,'valid_stls':meshes,'strict_unused_cleanup':strict_record,'strict_report':strict_report,'schema_listing_characters':len(listing.stdout),'unknown_range_and_choice_rejections':3,'all_checks_passed':True}
(root/'docs/m6/cli-validation.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8');print('CLI: 16 jobs, 12 independently valid STLs, 4 isolated damaged-input refusals, strict ready report, safe CSV and override rejection verified.')
