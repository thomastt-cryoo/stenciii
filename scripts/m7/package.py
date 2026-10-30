"""Produce the customer browser edition; no source tree or development runtime."""
from pathlib import Path
import argparse,datetime,hashlib,json,os,plistlib,shutil,subprocess,tempfile,zipfile

ROOT=Path(__file__).resolve().parents[2]
LIMIT=20_000_000

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def build(platform,backend,launcher,notices,out,source):
    backend=Path(backend).resolve();launcher=Path(launcher).resolve();notices=Path(notices).resolve();out=Path(out).resolve()
    assert backend.is_file()and launcher.is_file()and(notices/'THIRD_PARTY_NOTICES.txt').is_file()
    assert not json.loads((notices/'license-review.json').read_text())['missing'], 'Resolve missing licenses before packaging'
    out.mkdir(parents=True,exist_ok=True)
    mac=platform.startswith('macos-');name={'windows-x64':'Windows-x64','macos-arm64':'macOS-Apple-Silicon','macos-x64':'macOS-Intel','macos-universal':'macOS-Universal'}[platform]
    with tempfile.TemporaryDirectory(prefix='.stencil-package-',dir=out)as temporary:
        stage=Path(temporary);bundle=stage/'Stencil Studio.app'if mac else stage
        support=bundle/'Contents/Resources'if mac else stage/'Studio Support';support.mkdir(parents=True)
        executable=bundle/'Contents/MacOS/stencil-studio'if mac else stage/'Stencil Studio.exe';executable.parent.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(launcher,executable);executable.chmod(0o755)
        engine=support/('stencil'if mac else'stencil.exe');shutil.copyfile(backend,engine);engine.chmod(0o755)
        shutil.copytree(notices,support/'licenses')
        guide=ROOT/'docs/m7/customer'/('MACOS.txt'if mac else'WINDOWS.txt');assert guide.is_file();shutil.copyfile(guide,stage/'Read First.txt')
        info={'edition':'offline-browser','version':'2.9.4','milestone':'M7','platform':platform,'source_commit':source,'browser_required':True,'native_editor':False,'webview_runtime_required':False,'rust_node_python_required':False}
        (support/'build-info.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8',newline='\n')
        if mac:
            plist={'CFBundleName':'Stencil Studio','CFBundleDisplayName':'Stencil Studio','CFBundleIdentifier':'com.stencilstudio.browser','CFBundleExecutable':'stencil-studio','CFBundlePackageType':'APPL','CFBundleShortVersionString':'2.9.4','CFBundleVersion':'7','LSMinimumSystemVersion':'13.3','NSHighResolutionCapable':True,'NSHumanReadableCopyright':'Stencil Studio; see included third-party notices.'}
            with(bundle/'Contents/Info.plist').open('wb')as f:plistlib.dump(plist,f)
            # Sign the support executable first. Its digest stays fixed when the
            # enclosing bundle is sealed; the manifest never hashes itself or
            # the bundle's main signature, avoiding a circular signature hash.
            subprocess.run(['codesign','--force','--sign','-',str(engine)],check=True)
        files=[]
        for p in sorted(bundle.rglob('*')):
            if not p.is_file()or p==executable:continue
            if p.name=='Read First.txt':continue
            files.append({'path':p.relative_to(bundle).as_posix(),'bytes':p.stat().st_size,'sha256':digest(p)})
        (support/'package-manifest.json').write_text(json.dumps({'format':1,'edition':'offline-browser','source_commit':source,'files':files},indent=2)+'\n',encoding='utf-8',newline='\n')
        signing={'developer_id_signed':False,'notarized':False,'ad_hoc_signed':False}
        if mac:
            subprocess.run(['codesign','--force','--sign','-',str(bundle)],check=True)
            subprocess.run(['codesign','--verify','--deep','--strict',str(bundle)],check=True);signing['ad_hoc_signed']=True
        archive=out/f'StencilStudio-{name}.zip'
        # Stable ZIP metadata; pinned dependency inputs do not imply a claim of
        # bit-reproducible native linking or Apple signing across machines.
        stamp=(2026,10,30,0,0,0)
        with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
            for p in sorted(stage.rglob('*')):
                if p.is_file():
                    entry=zipfile.ZipInfo(p.relative_to(stage).as_posix(),stamp);entry.compress_type=zipfile.ZIP_DEFLATED;entry.create_system=3;entry.external_attr=(0o100000|(p.stat().st_mode&0o777))<<16;z.writestr(entry,p.read_bytes())
        with zipfile.ZipFile(archive)as z:assert z.testzip()is None
        result={'file':archive.name,'platform':platform,'source_commit':source,'bytes':archive.stat().st_size,'sha256':digest(archive),'etsy_limit_bytes':LIMIT,'fits_etsy_limit':archive.stat().st_size<=LIMIT,'signing':signing,'backend_bytes':engine.stat().st_size,'launcher_bytes':executable.stat().st_size}
        (out/(archive.stem+'.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8',newline='\n')
        assert result['fits_etsy_limit'],f'Package exceeds {LIMIT} bytes: {result}'
        print(json.dumps(result));return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--platform',required=True,choices=['windows-x64','macos-arm64','macos-x64','macos-universal']);p.add_argument('--backend',required=True);p.add_argument('--launcher',required=True);p.add_argument('--notices',required=True);p.add_argument('--out',required=True);p.add_argument('--source',required=True);a=p.parse_args();build(a.platform,a.backend,a.launcher,a.notices,a.out,a.source)
