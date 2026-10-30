"""Check stored normals, full PNG streams and SVG XML in nested batch ZIPs."""
from pathlib import Path
import csv,io,json,sys,zipfile
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'scripts/m6'))
from output_formats import normals,png,svg
def verify(path):
    rows=[]
    def visit(data,prefix=''):
        with zipfile.ZipFile(io.BytesIO(data))as z:
            assert z.testzip()is None
            for name in z.namelist():
                body=z.read(name);key=prefix+name
                if name.endswith('.zip'):visit(body,key+'/')
                elif name.endswith('.stl'):rows.append({'file':key,'format':'stl','checks':normals(body)})
                elif name.endswith('.png'):
                    checked=png(body);rows.append({'file':key,'format':'png','checks':checked})
                elif name.endswith('.svg'):rows.append({'file':key,'format':'svg','checks':svg(body)})
                elif name.endswith('.json'):json.loads(body);rows.append({'file':key,'format':'json','valid':True})
                elif name.endswith('.csv'):
                    parsed=list(csv.DictReader(io.StringIO(body.decode('utf-8-sig'))));rows.append({'file':key,'format':'csv','rows':len(parsed),'valid':True})
    visit(Path(path).read_bytes());counts={kind:sum(r['format']==kind for r in rows)for kind in ['stl','png','svg','json','csv']};assert all(counts.values()),counts
    return {'passed':True,'counts':counts,'files':rows}
if __name__=='__main__':print(json.dumps(verify(sys.argv[1])))
