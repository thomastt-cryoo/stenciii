"""Add reviewed customer instructions without changing any tested runtime file.

Inputs are retained CI ZIPs. Mac signatures, executable permissions, integrity
manifests and bundled notices remain byte-for-byte intact. The outer ZIP changes.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,zipfile

ROOT=Path(__file__).resolve().parents[2]
def sha(data):return hashlib.sha256(data).hexdigest()

def finalize(candidates,out):
    candidates=Path(candidates).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
    records=[]
    for name,guide in [('Windows-x64','WINDOWS.txt'),('macOS-Apple-Silicon','MACOS.txt'),('macOS-Intel','MACOS.txt')]:
        source=candidates/f'StencilStudio-{name}.zip';meta=json.loads(source.with_suffix('.json').read_text())
        assert source.stat().st_size==meta['bytes'] and sha(source.read_bytes())==meta['sha256']
        target=out/source.name;assert target!=source
        with zipfile.ZipFile(source)as original,zipfile.ZipFile(target,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as delivery:
            assert original.testzip()is None
            assert len(original.namelist())==len(set(original.namelist()))
            for info in original.infolist():
                data=(ROOT/'docs/m7/customer'/guide).read_text(encoding='utf-8').encode('utf-8')if info.filename=='Read First.txt'else original.read(info)
                delivery.writestr(info,data,compresslevel=9)
            info=zipfile.ZipInfo('Platform Test Record.txt',(2026,10,31,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.create_system=3;info.external_attr=0o100644<<16
            delivery.writestr(info,(ROOT/'docs/m7/customer/PLATFORM_TEST_RECORD.txt').read_text(encoding='utf-8').encode('utf-8'),compresslevel=9)
        with zipfile.ZipFile(source)as original,zipfile.ZipFile(target)as delivery:
            assert delivery.testzip()is None
            assert set(delivery.namelist())==set(original.namelist())|{'Platform Test Record.txt'}
            unchanged=[]
            for info in original.infolist():
                if info.filename=='Read First.txt':continue
                data=original.read(info);other=delivery.getinfo(info.filename)
                assert delivery.read(other)==data and other.external_attr==info.external_attr
                unchanged.append({'path':info.filename,'bytes':len(data),'sha256':sha(data)})
        assert target.stat().st_size<=20_000_000
        records.append({'file':target.name,'bytes':target.stat().st_size,'sha256':sha(target.read_bytes()),'runtime_source_commit':meta['source_commit'],'tested_archive_sha256':meta['sha256'],'tested_archive_bytes':meta['bytes'],'unchanged_runtime_and_notice_files':unchanged,'changes':['Read First.txt','Platform Test Record.txt']})
    pdf=ROOT/'output/pdf/StencilStudio-Quick-Start.pdf';shutil.copyfile(pdf,out/pdf.name)
    records.append({'file':pdf.name,'bytes':pdf.stat().st_size,'sha256':sha(pdf.read_bytes())})
    note='STENCIL STUDIO - M7 OFFLINE BROWSER EDITION\n\nRead Platform Test Record.txt inside the ZIP for tested systems and limits.\nThis is a technical review package; no commercial listing has been published.\n\nSHA-256 (checks corruption, not publisher identity):\n\n'
    for r in records:note+=f"{r['file']}\n{r['bytes']} bytes\n{r['sha256']}\n\n"
    (out/'Read Me and Checksums.txt').write_text(note,encoding='utf-8',newline='\n')
    check=out/'Read Me and Checksums.txt';records.append({'file':check.name,'bytes':check.stat().st_size,'sha256':sha(check.read_bytes())})
    assert len(list(out.iterdir()))==5 and all(p.is_file()and p.stat().st_size<=20_000_000 for p in out.iterdir())
    manifest=out.parent/'delivery-manifest.json';manifest.write_text(json.dumps({'edition':'offline-browser','review_date':'2026-10-31','files':records},indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'files':[{k:r[k]for k in('file','bytes','sha256')}for r in records],'manifest':str(manifest)}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--candidates',required=True);p.add_argument('--out',required=True);a=p.parse_args();finalize(a.candidates,a.out)
