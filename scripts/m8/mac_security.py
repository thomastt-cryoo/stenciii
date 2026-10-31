"""Quarantine/Gatekeeper test on isolated genuine macOS runners; never remove quarantine.

Use the browser-downloaded, byte-verified M7 ZIP. Preserve failures/limitations.
No global security exception, spctl disable, xattr deletion, or re-signing.
"""
from pathlib import Path
import subprocess,json,sys,time,os
archive=Path(sys.argv[1]).resolve();out=Path(sys.argv[2]).resolve();out.mkdir(parents=True,exist_ok=True)
report={'archive':str(archive),'global_security_changes':False,'quarantine_removed':False,'app_specific_approval_verified':False}
def run(*args,timeout=35):
 try:
  p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
  return {'code':p.returncode,'stdout':p.stdout.strip(),'stderr':p.stderr.strip()}
 except subprocess.TimeoutExpired as e:return {'timeout':True,'stdout':str(e.stdout or ''),'stderr':str(e.stderr or '')}
def apple(code):return run('osascript','-e',code)
def snapshot(label):
 run('screencapture','-x',str(out/(label+'.png')))
 return apple('''tell application "System Events"
set found to {}
repeat with p in (application processes whose visible is true)
 try
  set end of found to (name of p as text)
  repeat with w in windows of p
   set end of found to (name of w as text)
   repeat with e in entire contents of w
    try
     set n to name of e as text
     if n is not "" then set end of found to n
    end try
   end repeat
  end repeat
 end try
end repeat
return found as text
end tell''')
try:
 report['os']=run('sw_vers');report['arch']=run('uname','-m');report['gatekeeper_status']=run('spctl','--status')
 report['archive_quarantine']=run('xattr','-p','com.apple.quarantine',str(archive))
 # Archive Utility is the customer extraction path. Unlike ditto from a git clone,
 # this exercises propagation of the browser's genuine quarantine attribute.
 report['extraction']=run('open','-W','-a','Archive Utility',str(archive),timeout=70)
 apps=list(archive.parent.rglob('Stencil Studio.app'));assert len(apps)==1,[str(x)for x in apps]
 app=apps[0];report['app']=str(app)
 report['app_quarantine']=run('xattr','-p','com.apple.quarantine',str(app))
 report['codesign']=run('codesign','--verify','--deep','--strict',str(app))
 report['assessment']=run('spctl','--assess','--type','execute','--verbose=4',str(app))
 report['initial_launch']=run('open','-n',str(app),'--args','--profile-dir',str(archive.parent/'security-profile'))
 time.sleep(7);report['initial_ui']=snapshot('first-open')
 report['initial_pids']=run('pgrep','-x','stencil-studio')
 # Only attempt the documented app-specific UI; never change the global policy.
 # A blocked app can have a live process while Gatekeeper owns its modal alert.
 # A PID must never be interpreted as successful launch/approval.
 if report['assessment']['code']!=0 and report['app_quarantine']['code']==0:
  report['dismiss_warning']=apple('''tell application "System Events"
if exists process "CoreServicesUIAgent" then
 tell process "CoreServicesUIAgent"
  repeat with w in windows
   if (exists static text "Stencil Studio" of w) or ((name of w as text) contains "Stencil") then
    if exists button "Done" of w then click button "Done" of w
    if exists button "Cancel" of w then click button "Cancel" of w
   end if
  end repeat
 end tell
end if
end tell''')
  report['dismiss_escape']=apple('tell application "System Events" to key code 53')
  report['settings_open']=run('open','x-apple.systempreferences:com.apple.preference.security?Privacy')
  time.sleep(6);report['settings_ui']=snapshot('privacy-security')
  # Require the app's name in the pane before selecting its exception button.
  report['open_anyway']=apple('''tell application "System Events" to tell process "System Settings"
set frontmost to true
set items to entire contents of window 1
set matched to false
repeat with e in items
 try
  if (name of e as text) contains "Stencil Studio" then set matched to true
 end try
end repeat
if not matched then error "No Stencil Studio-specific approval text in pane"
repeat with e in items
 try
  if role of e is "AXButton" and name of e is "Open Anyway" then
   click e
   return "Clicked app-specific Open Anyway"
  end if
 end try
end repeat
error "App-specific Open Anyway not available"
end tell''')
  time.sleep(3);report['confirmation_ui']=snapshot('approval-confirmation')
  # Confirmation/authentication can require a human. Do not enter credentials or
  # claim success merely because an Open Anyway button existed.
  report['confirm_open']=apple('''tell application "System Events"
repeat with pname in {"CoreServicesUIAgent", "System Settings"}
 if exists process pname then
  tell process pname
   repeat with w in windows
    set matched to false
    repeat with e in entire contents of w
     try
      if (name of e as text) contains "Stencil Studio" then set matched to true
     end try
    end repeat
    if matched and (exists button "Open" of w) then click button "Open" of w
   end repeat
  end tell
 end if
end repeat
end tell''')
  time.sleep(7);report['approved_pids']=run('pgrep','-x','stencil-studio');report['after_ui']=snapshot('after-approval')
  report['backend_listeners']=run('lsof','-a','-c','stencil','-iTCP','-sTCP:LISTEN')
  report['app_specific_approval_verified']=report['open_anyway']['code']==0 and report['approved_pids']['code']==0 and report['backend_listeners']['code']==0
 else:
  report['limitation']='No blocked, quarantined assessment available for the approval walkthrough; no launch pass inferred from a process ID'
 report['quarantine_after']=run('xattr','-p','com.apple.quarantine',str(app))
 report['gatekeeper_status_after']=run('spctl','--status')
 report['actual_browser_download_quarantine']=report['archive_quarantine']['code']==0
 report['actual_extraction_quarantine']=report['app_quarantine']['code']==0
 report['consumer_first_download_pass']=all([report['actual_browser_download_quarantine'],report['actual_extraction_quarantine'],report['app_specific_approval_verified'],'enabled' in report['gatekeeper_status']['stdout']])
except Exception as e:report['error']=repr(e)
finally:
 # Isolated CI processes only. This script never runs against the user's desktop.
 report['cleanup']=run('pkill','-TERM','-x','stencil-studio')
 time.sleep(2);report['remaining_launcher']=run('pgrep','-x','stencil-studio')
 (out/'security.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
