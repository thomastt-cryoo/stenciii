"""Independent cross-platform mesh comparison of all published package cases."""
from pathlib import Path
import argparse,json,subprocess,tempfile
from prove_export import prove

def compare(source,ref,out):
    def read(platform,name):return subprocess.check_output(['git','show',f'{ref}:{source}/{platform}/chromium/{name}'])
    reports={p:json.loads(read(p,'package-qa.json'))for p in ['windows-x64','macos-arm64','macos-x64']}
    assert all(d['passed']and len(d['cases'])==15 for d in reports.values())
    result={'source':source,'reference':'Windows x64 Chromium output, not a new M6 reference','method':'unchanged M6 independent checks and exact oriented-surface A/B comparison','comparisons':[]}
    with tempfile.TemporaryDirectory(prefix='stencil-m7-compare-')as tmp:
        root=Path(tmp)
        for case in reports['windows-x64']['cases']:
            name=case['name']+('.zip'if case['proof']['independent']['format']=='ZIP'else'.stl')
            baseline=root/name;baseline.write_bytes(read('windows-x64',name))
            for platform in ['macos-arm64','macos-x64']:
                target=root/platform/name;target.parent.mkdir(exist_ok=True);target.write_bytes(read(platform,name));proof=prove(target,baseline)
                equivalence=proof['m6_equivalence'];assert equivalence and all(v['exact_surface_equal']and v['category']in('A','B')for v in equivalence.values())
                result['comparisons'].append({'case':case['name'],'platform':platform,'independent_checks_completed':True,'mesh_count':len(equivalence),'categories':sorted(set(v['category']for v in equivalence.values())),'maximum_surface_deviation_mm':max(v['maximum_surface_deviation_mm']for v in equivalence.values())})
    result['passed']=True;assert len(result['comparisons'])==30
    path=Path(out);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps({'passed':True,'comparisons':len(result['comparisons'])}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--ref',default='origin/codex/m7-artifacts');p.add_argument('--out',required=True);a=p.parse_args();compare(a.source,a.ref,a.out)
