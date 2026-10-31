param([Parameter(Mandatory=$true)][string]$Archive,[Parameter(Mandatory=$true)][string]$Out)
$ErrorActionPreference='Stop'
$Archive=(Resolve-Path -LiteralPath $Archive).Path
$Out=[IO.Path]::GetFullPath($Out)
New-Item -ItemType Directory -Path $Out -Force | Out-Null
$record=[ordered]@{global_security_changes=$false; origin_removed=$false; app_specific_approval_verified=$false}
function Zone($p) { try { Get-Content -LiteralPath $p -Stream Zone.Identifier -Raw -ErrorAction Stop } catch { $null } }
function Capture($label) {
 Add-Type -AssemblyName System.Drawing
 Add-Type -AssemblyName System.Windows.Forms
 $bounds=[Windows.Forms.SystemInformation]::VirtualScreen
 $bitmap=New-Object Drawing.Bitmap $bounds.Width,$bounds.Height
 $g=[Drawing.Graphics]::FromImage($bitmap)
 $g.CopyFromScreen($bounds.Left,$bounds.Top,0,0,$bounds.Size)
 $bitmap.Save((Join-Path $Out "$label.png"))
 $g.Dispose();$bitmap.Dispose()
}
function Windows {
 $root=[Windows.Automation.AutomationElement]::RootElement
 $all=$root.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition)
 @($all | ForEach-Object {
  $names=$_.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition)
  [ordered]@{name=$_.Current.Name;process=$_.Current.ProcessId;children=@($names|ForEach-Object {$_.Current.Name}|Where-Object {$_}|Select-Object -First 120)}
 })
}
try {
 Add-Type -AssemblyName UIAutomationClient
 Add-Type -AssemblyName UIAutomationTypes
 $record.os=Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber
 $record.smart_screen=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer' -ErrorAction SilentlyContinue | Select-Object SmartScreenEnabled
 $record.policy=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -ErrorAction SilentlyContinue | Select-Object EnableSmartScreen,ShellSmartScreenLevel
 $record.defender=Get-MpComputerStatus -ErrorAction SilentlyContinue | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,AMProductVersion,AntivirusSignatureVersion
 $record.archive_zone=Zone $Archive
 $extract=Join-Path (Split-Path $Archive) 'Extracted customer package'
 New-Item -ItemType Directory -Path $extract -Force | Out-Null
 # Windows shell compressed-folder extraction, not Python ZIP extraction.
 $shell=New-Object -ComObject Shell.Application
 $source=$shell.NameSpace($Archive);$target=$shell.NameSpace($extract)
 $target.CopyHere($source.Items(),1044)
 $launcher=Join-Path $extract 'Stencil Studio.exe'
 $backend=Join-Path $extract 'Studio Support\stencil.exe'
 for($i=0;$i -lt 60 -and !(Test-Path -LiteralPath $backend);$i++){Start-Sleep -Seconds 1}
 $record.launcher_zone=Zone $launcher;$record.backend_zone=Zone $backend
 $record.launcher_signature=Get-AuthenticodeSignature -LiteralPath $launcher | Select-Object Status,StatusMessage
 $record.backend_signature=Get-AuthenticodeSignature -LiteralPath $backend | Select-Object Status,StatusMessage
 # ShellExecute matches normal user launch. Never synthesize/remove MOTW.
 Start-Process -FilePath $launcher -ArgumentList @('--profile-dir',('"'+(Join-Path $extract 'security-profile')+'"')) -WindowStyle Normal
 Start-Sleep -Seconds 10
 Capture 'first-open';$record.initial_ui=Windows
 $record.initial_processes=@(Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $launcher -or $_.ExecutablePath -eq $backend}|Select-Object ProcessId,ExecutablePath)
 # UI observations only: do not invoke broad security setting controls.
 $record.warning_observed=(@($record.initial_ui|Where-Object { $_.name -match 'Windows protected|SmartScreen' -or ($_.children -join ' ') -match 'Windows protected your PC' }).Count -gt 0)
 $record.app_specific_approval_verified=$false
 $record.consumer_first_download_pass=$false
 $record.limitation='Automated hosted Windows Server is not a fresh consumer Windows 11 installation. No consumer SmartScreen approval is inferred from an allowed launch.'
} catch { $record.error=$_.Exception.ToString() }
finally {
 if($launcher) {
  Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -eq $launcher} | ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
  Start-Sleep -Seconds 3
  $record.remaining_backend=@(Get-CimInstance Win32_Process|Where-Object {$_.ExecutablePath -eq $backend}|Select-Object ProcessId,ExecutablePath)
 }
 $record | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $Out 'security.json') -Encoding utf8
 $record | ConvertTo-Json -Depth 12
}
