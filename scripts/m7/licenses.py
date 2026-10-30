"""Collect full locked dependency notices without fetching at packaging time.

Includes a conservative superset of Cargo target/build dependencies and npm
production packages. Missing notice material fails the package gate.
"""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess
ROOT=Path(__file__).resolve().parents[2]
def license_files(folder):
    return [p for p in folder.rglob('*') if p.is_file() and len(p.relative_to(folder).parts)<=3 and (p.name.upper().startswith(('LICENSE','LICENCE','COPYING','COPYRIGHT','NOTICE','UNLICENSE','AUTHORS')) or any(s.lower() in ('licenses','licences') for s in p.relative_to(folder).parts[:-1]))]
def collect(out):
    out=Path(out);out.mkdir(parents=True,exist_ok=True);rows=[];missing=[]
    metadata=json.loads(subprocess.check_output(['cargo','metadata','--locked','--format-version','1','--features','studio'],cwd=ROOT))
    packages=metadata['packages'];winapi=next(Path(p['manifest_path']).parent for p in packages if p['name']=='winapi')
    def add(kind,name,version,license,repository,folder,files):
        ident=f'{kind}/{name.replace("/","__")}-{version}';dest=out/ident;dest.mkdir(parents=True,exist_ok=True);paths=[]
        for p in files:
            relative=p.relative_to(folder);target=dest/relative;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);paths.append({'path':f'{ident}/{relative.as_posix()}','sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
        rows.append({'kind':kind,'name':name,'version':version,'license':license,'repository':repository,'notices':paths})
        if not paths:missing.append(f'{kind}:{name}@{version}')
    for p in packages:
        if not p['source']:continue
        folder=Path(p['manifest_path']).parent;files=license_files(folder)
        supplement=ROOT/'docs/m7/license-supplements'/f'{p["name"]}-{p["version"]}'
        if not files and supplement.is_dir():folder=supplement;files=license_files(folder)
        if not files and p['name'].startswith('winapi-'):folder=winapi;files=license_files(folder)
        add('rust',p['name'],p['version'],p['license'],p['repository'],folder,files)
    lock=json.loads((ROOT/'web/package-lock.json').read_text())
    for location,p in lock['packages'].items():
        if not location or p.get('dev') or p.get('link'):continue
        folder=ROOT/'web'/location;name=location.split('node_modules/')[-1]
        add('javascript',name,p['version'],p.get('license'),p.get('resolved'),folder,license_files(folder))
    add('project','stencil-studio','2.9.4','Unlicense','https://github.com/thomastt-cryoo/stenciii',ROOT,[ROOT/'LICENSE'])
    folder=ROOT/'crates/stencil-core/fonts';add('font','DejaVu','bundled','Bitstream Vera and public domain additions','https://dejavu-fonts.github.io/',folder,[folder/'LICENSE-DejaVu.txt'])
    for toolchain in (os.environ.get('M7_STABLE','stable'),os.environ.get('M7_NIGHTLY','nightly')):
        try:sysroot=Path(subprocess.check_output(['rustup','run',toolchain,'rustc','--print','sysroot'],text=True).strip())
        except subprocess.CalledProcessError:continue
        folder=sysroot/'share/doc/rust';files=license_files(folder/'licenses')+[folder/'COPYRIGHT-library.html']
        add('runtime','rust-standard-library',toolchain,'MIT OR Apache-2.0 plus notices','https://github.com/rust-lang/rust',folder,files)
    review={'scope':'Conservative superset of locked Cargo resolution and npm production packages, bundled fonts and Rust standard libraries. winapi GNU support crates share the winapi crate license texts.','packages':rows,'missing':missing}
    (out/'license-review.json').write_text(json.dumps(review,indent=2)+'\n',encoding='utf-8',newline='\n')
    lines=['STENCIL STUDIO — THIRD-PARTY NOTICES','',review['scope'],'','Full license and copyright texts accompany this index.','']
    for r in rows:lines.extend([f'{r["kind"]}: {r["name"]} {r["version"]}',f'License expression: {r["license"]}',f'Source: {r["repository"]}',*['  '+n['path'] for n in r['notices']],''])
    (out/'THIRD_PARTY_NOTICES.txt').write_text('\n'.join(lines),encoding='utf-8',newline='\n')
    assert not missing,f'Missing notice material: {missing}'
    print(json.dumps({'packages':len(rows),'missing':missing,'files':sum(len(r['notices'])for r in rows)}))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--out',required=True);collect(p.parse_args().out)
