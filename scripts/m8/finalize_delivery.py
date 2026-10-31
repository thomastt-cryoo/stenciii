"""Five M8 customer files; preserve the three accepted/security-tested ZIP bytes."""
from pathlib import Path
import argparse,hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[2]
def digest(data):return hashlib.sha256(data).hexdigest()
def finalize(source,out):
 source=Path(source).resolve();out=Path(out).resolve();out.mkdir(parents=True,exist_ok=True)
 assert source!=out
 previous=json.loads((ROOT/'distribution/m7/delivery-manifest.json').read_text())
 security=json.loads((ROOT/'docs/m8/evidence/security-summary.json').read_text())
 records=[]
 for f in previous['files']:
  if not f['file'].endswith('.zip'):continue
  p=source/f['file'];b=p.read_bytes()
  assert len(b)==f['bytes'] and digest(b)==f['sha256'],p
  with zipfile.ZipFile(p)as z:
   assert z.testzip()is None
   assert len(z.namelist())==len(set(z.namelist()))
   assert all(not n.startswith(('/','\\'))and '..'not in Path(n).parts for n in z.namelist())
   for member in f['unchanged_runtime_and_notice_files']:
    data=z.read(member['path']);assert len(data)==member['bytes']and digest(data)==member['sha256']
   member_count=len(z.namelist())
  shutil.copyfile(p,out/p.name)
  records.append({k:f[k]for k in('file','bytes','sha256','runtime_source_commit')}|{'archive_unchanged_from_M7':True,'zip_CRC_passed':True,'members':member_count,'runtime_and_notice_members_rehashed':len(f['unchanged_runtime_and_notice_files'])})
 pdf=ROOT/'output/pdf/StencilStudio-Quick-Start.pdf';shutil.copyfile(pdf,out/pdf.name)
 records.append({'file':pdf.name,'bytes':pdf.stat().st_size,'sha256':digest(pdf.read_bytes())})
 note='STENCIL STUDIO - OFFLINE BROWSER EDITION\nM8 customer review - 31 October 2026\n\n'
 note+='Start with StencilStudio-Quick-Start.pdf. It contains installation, security-\nwarning guidance, saving, manufacturing, troubleshooting and product facts.\nSelect the ZIP for your computer, extract it completely, then double-click\nthe graphical launcher. The editor runs in your installed browser.\n\n'
 note+='Chrome is recommended. Edge is supported on tested Windows. Intel Safari\nuses the verified software 3D repair when WebGL is unusable. Large meshes\ncan respond more slowly. Windows Firefox 3D remains unqualified.\n\n'
 note+='Measured runtime systems: Windows 11 Home 10.0.26300; Apple Silicon macOS\n26.6.2; Intel macOS 15.7.9. Mac first-download checks use the exact runner\nversions recorded in the M8 report. Windows 10, older macOS and physical\nMacs beyond CI are unverified. A build target is not an OS support claim.\n\n'
 note+='SECURITY AND FIRST DOWNLOAD\n'+security['customer_guide_summary']+'\n\n'
 note+='Windows is unsigned. Macs are ad hoc signed without Developer ID/notarization.\nFollow only the app-specific OS approval described in the PDF if you trust\nthe source. Stop for malware, damage or policy blocks. Do not disable\nSmartScreen, Smart App Control, Gatekeeper, antivirus or global protections.\n\n'
 note+='The three ZIPs are identical to the accepted M7 customer packages. Their\ndated Platform Test Record describes that qualification; the M8 PDF and\nreport add the final customer/security review. No executable was rebuilt.\n\n'
 note+='Download/browser installation and OS approval checks may need internet.\nArtwork processing and exports run locally afterward. No cloud processing,\naccount, subscription or recurring licence-server check is used.\n\n'
 note+='Use Save Project for portable backups; the automatic draft belongs to one\nbrowser/profile/address and is shared by its tabs. Save projects outside\nthe application folder. Finish and download batch work before quitting.\nThis software generates files; slicer, printer, material, fit/strength and\nphysical calibration are separate. No physical items are included.\n\n'
 note+='SHA-256 (detects changed bytes; does not authenticate the publisher):\n\n'
 for f in records:note+=f"{f['file']}\n{f['bytes']} bytes\n{f['sha256']}\n\n"
 p=out/'Read Me and Checksums.txt';p.write_text(note,encoding='utf-8',newline='\n')
 records.append({'file':p.name,'bytes':p.stat().st_size,'sha256':digest(p.read_bytes())})
 assert sorted(p.name for p in out.iterdir())==sorted(f['file']for f in records)
 assert len(records)==5 and all(f['bytes']<20_000_000 for f in records)
 manifest={'edition':'offline-browser','milestone':'M8','review_date':'2026-10-31','security_release_decision':security['commercial_recommendation'],'accepted_M7_manifest_canonical_json_sha256':digest(json.dumps(previous,sort_keys=True,separators=(',',':')).encode()),'files':records,'checksum_note':'TXT hashes the other four files; its own SHA-256 appears here to avoid a circular hash.'}
 (out.parent/'delivery-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8',newline='\n')
 print(json.dumps(manifest))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True);a=p.parse_args();finalize(a.source,a.out)
