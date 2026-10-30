"""Join the original inventory with executable M6 evidence; never count aliases twice."""
from pathlib import Path
import json,re
root=Path('docs/m6')
catalogue=json.loads(Path('docs/audit/runtime-catalogue.json').read_text(encoding='utf-8'))
original={row['key']:row for row in json.loads(Path('docs/audit/parameter-mapping.json').read_text(encoding='utf-8'))}
controls={row['key']:row for path in (root/'controls').glob('*.json') for row in json.loads(path.read_text(encoding='utf-8'))['cases']}
assert len(catalogue)==24 and len(original)==len(controls)==217 and all(row['verified'] for row in controls.values())
parity=json.loads((root/'all-control-parity.json').read_text(encoding='utf-8'));assert parity['all_outputs_valid'] and parity['all_comparisons_classified'] and parity['qualified_slots']==217
rows=[]
for kind in catalogue:
    for parameter in kind['params']:
        key=kind['id']+'.'+parameter['name'];old=original[key];tested=controls[key];assert tested['schema']==parameter
        assert tested['reset'] and tested['undo'] and tested['redo'] and tested['reopened']
        if parameter.get('choices'):assert tested['choices']==parameter['choices']
        rows.append({'key':key,'original_ui':old['original_ui'],'original_definition':old['definition'],'runtime_schema':parameter,
                     'new_location':f'All Settings → search {key} → the named operation instance','discoverable':True,'executable':True,
                     'dependencies':old['dependency'],'fixture_source':'web/e2e/m6-controls.spec.ts and the committed artwork/geometry/manufacturing fixture builders',
                     'fixture':f"docs/m6/fixtures/control-projects/{kind['id']}/{parameter['name']}-0.json",
                     'control_evidence':f"docs/m6/controls/{kind['id']}.json",'value_and_choice_count':len(tested['outputs']),
                     'scope':tested['scope'],'reset':True,'undo_redo':True,'saved_file_reopened':True,
                     'real_engine_outputs_or_constraints':tested['outputs'],'three_engine_evidence':'docs/m6/all-control-modes.json',
                     'outcome':'Passed','limitation':'The listed dependencies and resource limits apply; not every Cartesian combination is claimed tested.'})
(root/'parameter-coverage-217.json').write_text(json.dumps({'runtime_processing_types':24,'qualified_slots':217,'unique_exercised_slots':len(rows),'executed_values_and_choices':sum(r['value_and_choice_count'] for r in rows),'cases':rows},indent=2)+'\n',encoding='utf-8')
destinations='''F01\tUpload/drop/replace; named image controls\tm2-editor.spec.ts; reliability.spec.ts; m6-batch-editor.spec.ts
F02\tArtwork → Image properties and analysis\tm6-visuals.spec.ts; core imageinfo tests
F03\tCreate from Text; Artwork → Text\tm2-editor.spec.ts; m6-batch-editor.spec.ts
F04\tHeader; Presets and history → Project name; embedded originals and raw project envelope\tm6-projects.spec.ts; m6-preferences.spec.ts; foundation.spec.ts
F05\tAutomatic storage; bounded session fallback; recovery downloads\tm6-reliability.spec.ts; m6-visuals.spec.ts
F06\tUndo/Redo; Presets and history → Edit history\tm6-reliability.spec.ts; m6-parity-model.spec.ts
F07\tPresets and history → Original workflow templates\tm6-original-workflows.spec.ts
F08\tPresets and history → Operation presets and workflow templates\tm3-editor.spec.ts; m6-parity-model.spec.ts
F09\tProcessing Steps; named compatible passes and inputs\tm3-editor.spec.ts; m3-model.spec.ts
F10\tProcessing Steps → Copy processing steps\tm6-reliability.spec.ts; m6-parity-model.spec.ts
F11\tProcessing Steps → Add before this step\tm3-editor.spec.ts; m6-preferences.spec.ts
F12\tCtrl+K / All Settings search and action destinations\teditor.spec.ts; m6-visuals.spec.ts
F13\tQuick controls and searchable per-instance setting forms\tm6-controls.spec.ts; m3-model.spec.ts; m4-model.spec.ts; m5 model/coverage tests
F14\tHardware / Mounting → Project screw-fit settings\tm6-original-workflows.spec.ts; m6-parity-model.spec.ts
F15\tInspect artwork; preparation previews; output selector\tm3-editor.spec.ts; m4-editor.spec.ts; m5b-editor.spec.ts
F16\tPreview zoom/pan/Compare; mask over image input and opacity\tm2-editor.spec.ts; m6-visuals.spec.ts
F17\t3D → View Options; orbit, wireframe, normals and display detail\tm4-editor.spec.ts; m4-visuals.spec.ts
F18\tParts preview → Assembly and inspection spacing\tm5c-editor.spec.ts; m5d-manufacturing.spec.ts
F19\t3D → Height inspection and print-layer interval\tm4-editor.spec.ts; m4-visuals.spec.ts
F20\tMeasured preview dimensions; export verification table\tm4-coverage.spec.ts; m5d-export.spec.ts; output-validation.json
F21\tAssembly previews and layout legends\tm5b-editor.spec.ts; m5c-editor.spec.ts; m5d-manufacturing.spec.ts
F22\tTiles → Visual layout and numeric seam/connector positions\tm5b-editor.spec.ts; m6-projects.spec.ts
F23\tTiles → Quality metrics; batch result comparison\tm5b-coverage.spec.ts; m6-batch-editor.spec.ts; cli-validation.json
F24\tReadiness; export guard; diagnostics → Review failed operation\tm6-reliability.spec.ts; m6_reports.rs; m5d-export.spec.ts
F25\tLive progress; Engine diagnostics and reports\tm6-reliability.spec.ts; m6-batch-editor.spec.ts
F26\tAutomatic cache; cancellation and worker recovery\treliability.spec.ts; m6-reliability.spec.ts; m6-batch-editor.spec.ts
F27\tAutomatic draft/full previews with generation checks\tm2-editor.spec.ts; foundation.spec.ts
F28\tEngine diagnostics; thread reason; startup fallback\tm6-reliability.spec.ts; all-control-modes.json; performance/batch-128.json
F29\tEngine diagnostics and native --version\tm6-reliability.spec.ts; cli-validation.json; packaging.json
F30\tExport STL; individual printable parts; verification guard\tm5d-export.spec.ts; output-validation.json; normal-repair-validation.json
F31\tManufacturing ZIP and batch collections\tm5d-branches.spec.ts; m6-batch-editor.spec.ts; output-validation.json
F32\tSave traced outlines / preparation SVG before bridges\tm3-editor.spec.ts; m5d-branches.spec.ts; output-validation.json
F33\tArtwork → Save original image\tm6-visuals.spec.ts; m6-projects.spec.ts
F34\tSave artwork preview PNG; optional layout PNG\tm3-editor.spec.ts; m6-batch-editor.spec.ts; output-validation.json
F35\tRetained native CLI image workflow and aliases\t15 native CLI integration tests; cli-validation.json; native-tile-validation.json
F36\tHeader → Open Project; original native CLI --project/--source\tm6-projects.spec.ts; native CLI integration tests
F37\tCLI --set, --list-params, reports and --strict; UI diagnostics\tnative CLI integration tests; cli-validation.json; m6-reliability.spec.ts
F38\tBatch Processing workspace; ranges/choices; native --batch/--sweep\tm6-batch-editor.spec.ts; m6-batch-limits.spec.ts; cli-validation.json
F39\tLocal embedded Studio server; customer-only assets\tpackaging.json; production-browser results; no-network customer tests
F40\tPreserved release workflow; existing Windows embedded-server preflight\t.github/workflows/release.yml unchanged; packaging.json
F41\tKeyboard controls, dialogs, announcements, responsive themes and resize\tm6-visuals.spec.ts; m6-reliability.spec.ts; m5b-editor.spec.ts
F42\tLocal theme/preferences and compatible insertion usage ordering\tm6-preferences.spec.ts; m6-reliability.spec.ts
F43\tCompatibility and named imported processing instances\tm6-projects.spec.ts; m5d-coverage.spec.ts; m6-controls.spec.ts
F44\tExplicit original product boundaries\truntime-catalogue.json; original source inventory; M6 known limits'''
lookup={line.split('\t')[0]:line.split('\t')[1:] for line in destinations.splitlines()};assert len(lookup)==44
features=[]
for line in Path('docs/FEATURE_UI_MAPPING.md').read_text(encoding='utf-8').splitlines():
    match=re.match(r'\| (F\d+) (.*?) \|',line)
    if not match:continue
    identity=match[1];cells=[c.strip() for c in line.split('|')[1:-1]];location,proof=lookup[identity]
    limitation=('Fresh-machine installers and Windows/macOS/Linux distribution testing remain M7 scope; no installer or physical-print certification is claimed.' if identity=='F40' else
                'Usage ordering applies to compatible insertion choices; specialist manufacturing guides retain task-based ordering.' if identity=='F42' else
                'These tools were absent upstream: arbitrary vector-point editing, dedicated contrast, image/text composition, bridge-corrected SVG, G-code and a generic bridge-off switch.' if identity=='F44' else
                'Browser quotas, supported dependencies and the documented platform/printing limits apply.')
    features.append({'id':identity,'capability':match[2],'original_implementation':cells[1],'original_behavior_and_dependencies':cells[3],
                     'new_location':location,'discoverable':identity!='F44','executable':identity not in ['F40','F44'],
                     'test_fixture_and_evidence':proof,'outcome':'Preserved, platform execution deferred to M7' if identity=='F40' else 'Accounted for as absent upstream' if identity=='F44' else 'Verified',
                     'limitation':limitation})
assert len(features)==44
(root/'feature-parity-44.json').write_text(json.dumps({'original_application_rows':44,'all_original_rows_accounted_for':True,'features':features},indent=2)+'\n',encoding='utf-8')
text=['# M6 feature and parameter verification','', 'The original mapping contains 44 application rows. The processing count remains 24 types and 217 qualified fields; aliases and execution-only flags are not additional fields.','', '| Capability | New location | Executable evidence | Outcome / limit |','|---|---|---|---|']
for row in features:text.append(f"| {row['id']} {row['capability']} | {row['new_location']} | {row['test_fixture_and_evidence']} | {row['outcome']}. {row['limitation']} |")
text+=['','## Every qualified field','','Each row is edited through its actual UI, reset, undone/redone, saved to a file, reopened and exercised in the engine with its dependencies. All allowed choices are selected. Numeric control bounds/increments match the runtime schema. Before/after behavior evidence is preserved separately; a constraint may correctly affect a report rather than material geometry.','', '| Qualified field | Original UI | New editor | Values/choices executed | Result |','|---|---|---|---:|---|']
for row in rows:text.append(f"| `{row['key']}` | {row['original_ui']} | {row['new_location']} | {row['value_and_choice_count']} | Passed; dependency: {row['dependencies']} |")
(root/'FEATURE_PARITY.md').write_text('\n'.join(text)+'\n',encoding='utf-8');print(f'Accounted for 44 application rows; verified {len(rows)} qualified fields across 24 processing types.')
