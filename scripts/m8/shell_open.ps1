param([string]$Launcher,[string]$Profile)
$ErrorActionPreference='Stop'
# A separate helper lets the observer collect modal ShellExecute/SmartScreen UI.
Start-Process -FilePath $Launcher -ArgumentList @('--profile-dir',('"'+$Profile+'"')) -WindowStyle Normal
