"""Validate and geometrically compare all 217-field native/ST/MT replay bytes."""
from pathlib import Path
from collections import Counter
import json,hashlib,zipfile,io,sys,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'m0'))
from validate_artifacts import stl
from exact_surface import compare
from surface_deviation import certify
from output_formats import normals,png,svg
from retain_discrepancies import retain
start=time.monotonic();data=json.loads(Path('docs/m6/all-control-modes.json').read_text(encoding='utf-8'));assert data['completed_values']==data['executed_values'];checks={};proofs={};rows=[];retained={};formats=Counter()
for case in data['cases']:
    if case['expectedDiagnostic']:
        assert case['native'].get('error') and case['st'].get('refusal') and case['mt'].get('refusal');continue
    bodies={mode:Path(case[mode]['path']).read_bytes() for mode in ['native','st','mt']};extension=Path(case['st']['path']).suffix
    for mode in ['st','mt']:assert hashlib.sha256(bodies[mode]).hexdigest()==case[mode]['sha256']
    if extension=='.zip':
        files={}
        for mode,body in bodies.items():
            with zipfile.ZipFile(io.BytesIO(body)) as archive:
                assert archive.testzip() is None;names=archive.namelist();assert len(names)==len(set(n.casefold() for n in names));files[mode]={name:archive.read(name) for name in names}
        assert set(files['native'])==set(files['st'])==set(files['mt'])
    else:files={mode:{'artifact'+extension:body} for mode,body in bodies.items()}
    for name in sorted(files['st']):
        suffix=Path(name).suffix;formats[suffix]+=1
        for mode,artifacts in files.items():
            body=artifacts[name];sha=hashlib.sha256(body).hexdigest()
            if sha not in checks:
                if suffix=='.stl':
                    measured=stl(body);assert measured['closed_oriented_mesh'] and measured['signed_volume_mm3']>0,(case['case'],name,mode);measured.update(normals(body));checks[sha]=measured
                elif suffix=='.png':checks[sha]=png(body)
                elif suffix=='.svg':checks[sha]=svg(body)
                else:raise AssertionError('Unexpected output '+name)
            if suffix=='.stl':
                meta=case['native']['info'].get('meta',{});components=checks[sha]['components']
                allowed=meta.get('registration',{}).get('holes',1) if 'pins' in name else meta.get('fragments',{}).get('keep',1) if 'stencil' in name else 1
                assert (components==allowed if 'pins' in name else 1<=components<=allowed),(case['case'],name,components,allowed)
        for left,right in [('native','st'),('st','mt')]:
            a,b=files[left][name],files[right][name];hashes=tuple(hashlib.sha256(body).hexdigest() for body in [a,b])
            if suffix=='.stl':
                if hashes not in proofs:
                    proof=compare(a,b)
                    if not proof['exact_surface_equal']:
                        proof['spatial_proof']=certify(a,b)
                        if proof['spatial_proof']['certified']:proof['category']='C'
                    proofs[hashes]=proof
                proof=proofs[hashes];assert proof['category'] in ['A','B','C'],(case['case'],name,proof)
                row={'case':case['case'],'key':case['key'],'file':name,'engines':[left,right],**proof}
                if proof['category']!='A':
                    row['retained_stl_entries']=[sha+'.stl' for sha in hashes]
                    for sha,body in zip(hashes,[a,b]):retained[sha]=body
                rows.append(row)
            else:assert a==b,(case['case'],name,left,right,'Image/vector bytes differ; investigate before claiming equivalence')
entries=retain(retained,Path('docs/m6/fixtures/control-discrepancies')) if retained else {}
for row in rows:
    if 'retained_stl_entries' in row:row['retained_archives']=[entries[n] for n in row['retained_stl_entries']]
result={'qualified_slots':217,'executed_values':data['completed_values'],'three_engine_diagnostics':sum(c['expectedDiagnostic'] for c in data['cases']),'output_counts_by_case':dict(formats),'independently_valid_unique_artifacts':len(checks),'compared_stl_file_pairs':len(rows),'categories':dict(Counter(r['category'] for r in rows)),'all_outputs_valid':True,'all_comparisons_classified':True,'image_and_vector_bytes_identical':True,'elapsed_seconds':time.monotonic()-start,'cases':rows}
Path('docs/m6/all-control-parity.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8');print(json.dumps({k:v for k,v in result.items() if k!='cases'}))
