"""Retain full original bytes in ordinary, independently readable bounded ZIPs."""
from pathlib import Path
import hashlib, json, zipfile, zlib

def retain(retained, root=Path('docs/m6/fixtures/m5-discrepancies')):
    root.mkdir(parents=True, exist_ok=True)
    groups=[[]];size=0
    for sha,body in sorted(retained.items()):
        assert hashlib.sha256(body).hexdigest()==sha
        estimate=len(zlib.compress(body))+256
        if size+estimate>2_000_000 and groups[-1]:groups.append([]);size=0
        groups[-1].append((sha,body));size+=estimate
    entries={};parts=[]
    for index,group in enumerate(groups,1):
        path=root/f'part-{index:02}.zip'
        with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_DEFLATED) as archive:
            for sha,body in group:
                name=sha+'.stl';item=zipfile.ZipInfo(name,(2026,10,29,0,0,0));item.compress_type=zipfile.ZIP_DEFLATED
                archive.writestr(item,body);entries[name]=path.as_posix()
        with zipfile.ZipFile(path) as archive:assert archive.testzip() is None
        parts.append({'path':path.as_posix(),'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'entries':len(group)})
    (root/'manifest.json').write_text(json.dumps({'parts':parts,'entries':entries},indent=2)+'\n',encoding='utf-8')
    return entries

if __name__=='__main__':
    previous=Path('docs/m6/fixtures/m5-discrepant-stls.zip')
    with zipfile.ZipFile(previous) as archive:retained={Path(name).stem:archive.read(name) for name in archive.namelist()}
    entries=retain(retained)
    path=Path('docs/m6/m5-discrepancy-classification.json');data=json.loads(path.read_text(encoding='utf-8'))
    for row in data['cases']:row['retained_archives']=[entries[name] for name in row['retained_stl_entries']]
    path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
    previous.unlink()
    print(json.dumps({'parts':len(set(entries.values())),'original_stls':len(entries)}))
