"""Summarize accepted evidence without conflating topology validity and parity."""
from pathlib import Path
import json, re, shutil
root=Path(__file__).resolve().parents[2]
docs=root/'docs/m5'
def read(name): return json.loads((docs/name).read_text(encoding='utf-8'))
mode=read('manufacturing-modes.json')
assert mode['completed_cases']==256 and mode['all_structural_checks_passed']
production=(root/'sandbox/m5-production-browser-final.log').read_text(encoding='utf-8-sig')
assert re.search(r'\b91 passed\b',production) and not re.search(r'\b[1-9]\d* failed\b',production)
compared=[r for r in mode['cases'] if r.get('comparison')]
rows=[]
for r in compared:
 c=r['comparison']
 if c['st_mt_geometry_identical'] and c['native_leaf_geometry_identical']: continue
 rows.append({'fixture':r['stem'],'st_mt_identical':c['st_mt_geometry_identical'],'native_leaf_identical':c['native_leaf_geometry_identical'],
              'st_mt_differences':c['st_mt_differences'],'st_native_differences':c['st_native_differences']})
summary={'accepted_source_commit':'001f3d6d79167d83d366c16bf9a187da4e140fd4',
 'qualified_parameter_slots':217,'m5_new_slots':128,'processing_types':24,'pinned_original_files':107,
 'rust_tests':167,'linux_ci_browser_tests':176,'windows_full_first_run':{'passed':173,'failed':2},
 'windows_corrected_targeted_passed':15,'windows_unique_tests_covered':176,'customer_production_browser_tests':91,
 'native_corpus':{'cases':48,'valid':46,'expected_blank_refusals':2},
 'manufacturing_modes':{'field_fixtures':256,'bitmap_st_mt_cases':sum(r['out']!='parts' for r in mode['cases']),
 'valid_parts_native_st_mt_cases':len(compared),'expected_constraint_refusals':sum(r['expectedError'] for r in mode['cases']),
 'all_structural_checks_passed':mode['all_structural_checks_passed'],
 'st_mt_exact_triangle_mismatches':sum(not r['comparison']['st_mt_geometry_identical'] for r in compared),
 'native_leaf_exact_triangle_mismatches':sum(not r['comparison']['native_leaf_geometry_identical'] for r in compared),
 'mismatch_details':rows},
 'production_build':read('production-manifest.json'),'embedded_windows_package':read('packaging.json'),
 'source_worktree_note':'Production assets were built from accepted source with verification-only documentation/scripts pending; the embedded build label accurately records +dirty. No unpublished engine or app source changes.',
 'github_ci':read('github-ci.json'),'github_pages_deployment':'failed: HTTP 404, Pages not enabled',
 'remaining_manufacturing_release_limit':'Certain complex/narrow raster tiles remain invalid and blocked; the additional ring probe retains four degenerate faces in stencil_r1c2.stl.',
 'm6_started':False}
(docs/'final-results.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
table=['# Measured engine comparison differences','',
 'All 191 successful Parts fixtures pass independent topology checks in native, ST and MT. All 64 bitmap fixtures match in ST/MT; one Parts fixture has its expected no-room refusal. Exact oriented triangles are compared at 0.0001 mm. A mismatch remains a mismatch even when volume and bounds match. The exact M4 Spread fixture is separately repaired and equal.','',
 f"ST/MT differs in {summary['manufacturing_modes']['st_mt_exact_triangle_mismatches']} Parts fixtures; native leaf geometry differs in {summary['manufacturing_modes']['native_leaf_exact_triangle_mismatches']}. This does not establish universal equivalence.",'',
 '| Fixture | ST/MT equal | Native/ST leaf equal | Different files (ST/MT; native/ST) |','|---|---|---|---|']
for r in rows:
 table.append(f"| {r['fixture']} | {r['st_mt_identical']} | {r['native_leaf_identical']} | {', '.join(r['st_mt_differences']) or '—'}; {', '.join(r['st_native_differences']) or '—'} |")
table+=['','Full per-file triangle counts, volume deltas, bounds and component comparisons are in [final-results.json](final-results.json); complete audits and geometry hashes are in [manufacturing-modes.json](manufacturing-modes.json). The mismatches are explicitly retained for M6 investigation.']
(docs/'ENGINE_PARITY.md').write_text('\n'.join(table)+'\n',encoding='utf-8')
for source,name in [('m5-production-browser-final.log','production-browser.log'),('m5-production-build.log','production-build.log'),('m5-native-embedded-build.log','native-embedded-build.log'),('m5-final-modes.log','mode-comparison-final.log')]:
 text=(root/'sandbox'/source).read_text(encoding='utf-8-sig',errors='replace').replace(str(root),'<workspace>')
 text=re.sub(r'\x1b\[[0-?]*[ -/]*[@-~]','',text)
 (docs/'logs'/name).write_text('\n'.join(line.rstrip() for line in text.splitlines()).rstrip()+'\n',encoding='utf-8')
# Compact the large machine artifact without removing any validation data.
(docs/'manufacturing-modes.json').write_text(json.dumps(mode,separators=(',',':'))+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in summary['manufacturing_modes'].items() if k!='mismatch_details'},indent=2))
