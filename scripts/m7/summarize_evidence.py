"""Compact published package evidence without copying profile paths or artwork.

Read a fetched immutable artifact branch through git. Full raw reports and
exports remain on that branch; this summary never upgrades a failed check.
"""
from pathlib import Path
import argparse,json,subprocess

def summarize(source,run,ref,out):
    def read(path):
        r=subprocess.run(['git','show',f'{ref}:{source}/{path}'],capture_output=True)
        return r.stdout if r.returncode==0 else None
    report={'qa_source':source,'workflow_run':run,'artifact_ref':ref,'platforms':{}}
    for platform in ['windows-x64','macos-arm64','macos-x64']:
        item={'browsers':{}}
        for name in ['chromium','chrome','firefox','edge','safari']:
            suffix='safari-qa.json'if name=='safari'else'package-qa.json';path=f'{platform}/{name}/{suffix}';raw=read(path)
            if raw is None:continue
            d=json.loads(raw);b={k:d[k]for k in ['passed','qualification','version','capabilities','initial_engine','limitations','error','failure_text','navigation_observer_errors','offline','resource_hosts','shutdown_document','consoleErrors']if k in d}
            b['cases']=[]
            for case in d.get('cases',[]):
                proof=case.get('proof',{});equivalence=proof.get('m6_equivalence',{})
                b['cases'].append({'name':case['name'],'passed':case['passed'],'webgl':case.get('webgl'),'m6_equivalence':{k:{field:v.get(field)for field in ['category','exact_surface_equal','spatial_tolerance_mm','maximum_surface_deviation_mm']}for k,v in equivalence.items()},'independent_checks_completed':bool(proof.get('independent')),'lossless_save_reopen':case.get('lossless_save_reopen',case.get('draft_reopen'))})
            if'single_thread'in d:b['single_thread_passed']=d['single_thread'].get('passed')
            if'batch'in d:b['batch']={k:d['batch'].get(k)for k in ['verified_jobs','csv_rows','independent_stl_count','all_stls_valid']}
            if'batch_formats'in d:b['batch_formats']={k:d['batch_formats'].get(k)for k in ['passed','counts']}
            b['full_raw_report']=f'{source}/{path}';item['browsers'][name]=b
        for name in ['host/host-qa.json','lifecycle/lifecycle-qa.json']:
            raw=read(f'{platform}/{name}')
            if raw:item[name]=json.loads(raw)
        for name in ['os-version.txt','gatekeeper.txt','architectures.txt','after-gui-close.txt']:
            raw=read(f'{platform}/{name}')
            if raw is not None:item[name]=raw.decode()
        raw=read(f'{platform}/StencilStudio-'+{'windows-x64':'Windows-x64','macos-arm64':'macOS-Apple-Silicon','macos-x64':'macOS-Intel'}[platform]+'.json')
        if raw:item['runtime_archive']=json.loads(raw)
        if item['browsers']:report['platforms'][platform]=item
    path=Path(out);path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'source':source,'platforms':{p:{b:{'passed':v.get('passed'),'qualification':v.get('qualification'),'cases':len(v['cases'])}for b,v in d['browsers'].items()}for p,d in report['platforms'].items()}}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--run',type=int,required=True);p.add_argument('--ref',default='origin/codex/m7-artifacts');p.add_argument('--out',required=True);a=p.parse_args();summarize(a.source,a.run,a.ref,a.out)
