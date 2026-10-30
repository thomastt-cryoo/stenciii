"""Write the customer-facing platform record from collected, actual results."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
matrix=json.loads((ROOT/'docs/m7/evidence/final-browser-matrix.json').read_text(encoding='utf-8'))
assert set(matrix['platforms'])=={'windows-x64','macos-arm64','macos-x64'}
lines=['STENCIL STUDIO - M7 PLATFORM TEST RECORD','Review date: 31 October 2026','',
 'This is the offline browser edition. The small Windows/Mac app is its launcher;',
 'the complete editor opens in an installed browser. Chrome is recommended on',
 'Windows and Mac. Edge is also qualified on Windows. No browser installer,',
 'WebView runtime, developer tools, account or subscription is included/required.',
 '', 'TESTED DOWNLOADS AND BROWSERS','']
for platform,item in matrix['platforms'].items():
    assert item['browsers']['chromium']['passed']and len(item['browsers']['chromium']['cases'])==15
    assert item['browsers']['chrome']['passed']and item['host/host-qa.json']['passed']and item['lifecycle/lifecycle-qa.json']['passed']
    lines.append({'windows-x64':'WINDOWS X64 - hosted Windows Server 2025; additionally Windows 11 Home 10.0.26300','macos-arm64':'APPLE SILICON - macOS 26.6.2 (25G83)','macos-x64':'INTEL MAC - macOS 15.7.9 (24G830)'}[platform])
    for name,browser in item['browsers'].items():
        version=browser.get('version',browser.get('capabilities',{}).get('browserVersion','not recorded'))
        if not browser['passed']:status='PARTIAL / NOT QUALIFIED: actual 3D preview failed; use Chrome'
        elif browser.get('limitations'):status='PARTIAL: generation/save/reload passed; 3D was unavailable on this runner'
        else:status='PASSED processing, exports, saved projects and actual 3D'
        lines.append(f'  {name}: {version} - {len(browser["cases"])} project(s). {status}.')
        engine=browser.get('initial_engine')
        if engine:lines.append(f'    Observed WASM workers: {engine["n"]}; reason: {engine["why"]}.')
    lines+=['  Chromium covers 15 representative projects. Other browser counts are',
            '  separate integration samples, not a claim that every control was clicked.',
            '  Real single-thread fallback and a two-job manufacturing sweep were',
            '  additionally exercised in the Chromium/Chrome/Firefox package collection.','']
lines+=['WHAT THE RESULTS MEAN','',
 'Windows Firefox could not create WebGL2 even on an independent empty canvas',
 'on the hosted test system. Its 3D preview is not qualified there; Chrome/Edge',
 'passed the complete preview path. Browser graphics settings were not forced.',
 'Safari on Intel did not pass its 3D preview check; use Chrome on Intel Mac.',
 'Do not infer full browser support from a successful app launch alone.',
 '',
 'The exact Windows download also passed a Windows 11 package sample containing',
 'mounting/hardware, multiple colour branches and Smooth Vector; actual disk',
 'downloads, lossless reopen, 3D, forced single-thread fallback and a two-job',
 'STL/PNG/SVG/JSON/CSV sweep. All 17 host checks and seven damage/removal checks',
 'passed there. A same-source local Windows build passed all 139 production tests.',
 'Full shared CI for the repaired source passed 173 Rust and 248 browser tests.',
 '',
 'Windows 10, older macOS releases and corporate-managed browser/security policies',
 'were not exercised. The Mac build target is 13.3; that is not a test certificate',
 'for every macOS 13.3+ browser. Edge on Mac was not tested. Safari thread mode',
 'was not recorded; do not infer it from the Chrome diagnostics.',
 '', 'OFFLINE, STORAGE AND CLOSING','',
 'Browser requests to non-loopback hosts were blocked during the Chromium and',
 'Firefox collection. Safari resource hosts were checked. This verifies local',
 'application dependencies, not an OS-wide physical network disconnection or',
 'a capture of browser-vendor/OS background traffic. Initial download/browser',
 'installation and first-run OS approval are setup steps. Normal artwork',
 'processing, projects and exports then run locally without a remote service.',
 '',
 'Use the launcher, not a loose index.html. Keep batch jobs open until downloaded.',
 'Quit Studio ends the local server; its tab then ends processing. Closing all',
 'Studio tabs stops the launcher after a short delay. Other browser windows',
 'belong to your browser and are not forcibly closed.',
 '',
 'Save Project is your portable backup. Browser drafts are browser/profile/local-',
 'address specific, with one shared automatic draft slot. Two open tabs can hold',
 'and save independent projects. Private, blocked or full storage is not durable.',
 'Keep saved projects outside the app folder. Replace the complete app/folder for',
 'updates. App removal leaves separately saved projects and exports intact.',
 '', 'SIGNING AND SECURITY WARNINGS','',
 'Windows is unsigned. Local launches worked, but the first internet-download',
 'SmartScreen/reputation approval UI was not tested. Mac bundles are ad hoc signed',
 'and passed integrity verification, without paid Developer ID/notarization.',
 'Mac Gatekeeper assessment rejected them; normal unquarantined runner launch',
 'worked. A quarantined first-download Open Anyway walkthrough was not tested.',
 'Follow Read First/Apple\'s app-specific procedure if offered. Never disable',
 'Gatekeeper, antivirus or system security globally to run this software.',
 '',
 'Independent file checks passed; printer/material strength and hardware fit',
 'still require physical calibration. Full third-party notices, font licenses',
 'and required MPL source archives are included. Checksums detect damaged files;',
 'they are not publisher signing.',
 '',
 'Runtime implementation and qualification source:',matrix['qa_source'],
 'Full technical report: docs/M7_REPORT.md in the source repository.',
 'No hosted editor, release tag, Etsy listing or M8 work was published.','']
out=ROOT/'docs/m7/customer/PLATFORM_TEST_RECORD.txt';out.write_text('\n'.join(lines),encoding='utf-8',newline='\n');print(out)
