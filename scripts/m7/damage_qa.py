"""Corruption, missing/locked support files and portable update/removal checks."""
from pathlib import Path
import argparse,hashlib,json,os,shutil,subprocess,tempfile,zipfile
def test(archive,out):
    archive=Path(archive).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True);checks=[]
    with tempfile.TemporaryDirectory(prefix='studio-damage-',dir=out)as temp:
        temp=Path(temp);install=temp/'Extracted Unicode é studio';install.mkdir();profile=temp/'preserved profile';profile.mkdir();saved=profile/'customer-project.json';saved.write_text('{"keep":true}')
        with zipfile.ZipFile(archive)as z:
            assert z.testzip()is None;names=z.namelist();assert len(names)==len(set(names));assert all(not n.startswith(('/','\\'))and '\\'not in n and '..'not in Path(n).parts for n in names);z.extractall(install)
        launcher=install/'Stencil Studio.exe';backend=install/'Studio Support/stencil.exe';manifest=install/'Studio Support/package-manifest.json'
        def refusal(text):
            r=subprocess.run([str(launcher),'--automation','--profile-dir',str(profile)],capture_output=True,text=True,timeout=15);assert r.returncode==1 and text in r.stderr,(r.returncode,r.stderr)
        original=backend.read_bytes();backend.write_bytes(original[:-1]);refusal('damaged');backend.write_bytes(original);checks.append('truncated support program rejected')
        data=bytearray(original);data[-100]^=1;backend.write_bytes(data);refusal('integrity');backend.write_bytes(original);checks.append('same-size support corruption rejected')
        original_manifest=manifest.read_bytes();manifest.unlink();refusal('missing');manifest.write_bytes(original_manifest);checks.append('missing complete support folder refused with extraction guidance')
        manifest.write_text('{broken');refusal('damaged');manifest.write_bytes(original_manifest);checks.append('invalid manifest rejected')
        m=json.loads(original_manifest);m['files'][0]['path']='../outside';manifest.write_text(json.dumps(m));refusal('unsafe');manifest.write_bytes(original_manifest);checks.append('unsafe manifest path rejected')
        if os.name=='nt':
            import ctypes
            create=ctypes.windll.kernel32.CreateFileW;create.restype=ctypes.c_void_p;create.argtypes=[ctypes.c_wchar_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_void_p,ctypes.c_ulong,ctypes.c_ulong,ctypes.c_void_p]
            handle=create(str(backend),0x80000000,0,None,3,0,None);assert handle not in(None,ctypes.c_void_p(-1).value)
            try:refusal('Cannot read')
            finally:ctypes.windll.kernel32.CloseHandle.argtypes=[ctypes.c_void_p];ctypes.windll.kernel32.CloseHandle(handle)
            checks.append('locked support file gives readable refusal')
        # Extract a new version into its own folder, then remove just the old
        # application. The user's separate files remain byte-identical.
        before=saved.read_bytes();new=temp/'Updated application';new.mkdir()
        with zipfile.ZipFile(archive)as z:z.extractall(new)
        assert install.resolve().is_relative_to(temp.resolve());shutil.rmtree(install);assert saved.read_bytes()==before
        assert new.resolve().is_relative_to(temp.resolve());shutil.rmtree(new);assert saved.read_bytes()==before;checks.append('portable update and removal preserve separate project files')
    result={'passed':True,'checks':checks,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest()};(out/'damage-qa.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('out');a=p.parse_args();test(a.archive,a.out)
