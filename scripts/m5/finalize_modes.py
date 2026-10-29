"""Recheck retained replay files, separating structural failures from exact parity."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json, subprocess

path=Path('docs/m5/manufacturing-modes.json')
data=json.loads(path.read_text(encoding='utf-8'))
assert data.get('completed_cases')==256, 'Wait for the real engine replay to finish'
data['initial_comparison_failures']=data['failures']
data['failures']=[]

def compare(row):
    if row['out']!='parts' or row['expectedError']: return row
    native=Path('sandbox/m5/modes')/('native-'+row['stem'])/(Path(row['project']).stem+'.zip')
    result=subprocess.run(['python','scripts/m5/compare_geometry.py',str(native),row['st']['path'],row['mt']['path'],'--report-differences'],capture_output=True,text=True)
    row.pop('comparison_error',None)
    if result.returncode: row['comparison_error']=result.stderr
    else:
        row['native']={'path':native.as_posix()}
        row['comparison']=json.loads(result.stdout)
    return row

with ThreadPoolExecutor(max_workers=3) as pool: data['cases']=list(pool.map(compare,data['cases']))
for row in data['cases']:
    if row.get('comparison_error'): data['failures'].append({'case':row['stem'],'error':row['comparison_error']})
    if row['out']!='parts' and not row.get('st_mt_identical'): data['failures'].append({'case':row['stem'],'error':'ST/MT bitmap differs'})
    if row['expectedError'] and not row.get('verified_refusal'): data['failures'].append({'case':row['stem'],'error':'Expected native refusal differs'})
data['all_structural_checks_passed']=not data['failures']
data['geometry_mismatches']=[row['stem'] for row in data['cases'] if row.get('comparison') and (not row['comparison']['st_mt_geometry_identical'] or not row['comparison']['native_leaf_geometry_identical'])]
data['st_mt_mismatches']=[row['stem'] for row in data['cases'] if row.get('comparison') and not row['comparison']['st_mt_geometry_identical']]
data['native_leaf_mismatches']=[row['stem'] for row in data['cases'] if row.get('comparison') and not row['comparison']['native_leaf_geometry_identical']]
path.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:data[k] for k in ['completed_cases','all_structural_checks_passed','failures','st_mt_mismatches','native_leaf_mismatches']},indent=2))
assert data['all_structural_checks_passed'], 'Retained outputs failed the independent validator'
