# Morgul installer: checks Python, creates the shortcuts, starts Morgul. Nothing is installed in the background.
$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
Write-Host ""
Write-Host "  Morgul setup"
Write-Host "  ------------"
Write-Host "  Folder: $root"
if ($root -like "*\AppData\Local\Temp\*") {
  Write-Host ""
  Write-Host "  It looks like Morgul is being run from inside the zip file."
  Write-Host "  Please unzip it first (right-click the zip > Extract All...), then run Install.cmd from the unzipped folder."
  Read-Host "  Press Enter to close"
  exit 1
}
function Find-Py {
  $c = @("$env:LOCALAPPDATA\Python\bin\pythonw.exe", "$env:SystemRoot\pyw.exe", "$env:LOCALAPPDATA\Programs\Python\Launcher\pyw.exe") +
       (Get-ChildItem "$env:LOCALAPPDATA\Python\pythoncore-3.*\pythonw.exe", "$env:LOCALAPPDATA\Programs\Python\Python3*\pythonw.exe", "$env:ProgramFiles\Python3*\pythonw.exe" -ErrorAction SilentlyContinue | ForEach-Object FullName)
  $p = $c | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
  if (-not $p) { $p = (Get-Command pythonw -ErrorAction SilentlyContinue).Source }
  return $p
}
$py = Find-Py
if (-not $py) {
  Write-Host ""
  Write-Host "  Morgul needs Python 3, and it wasn't found on this computer."
  $a = Read-Host "  Install it now? This downloads Python from the internet. [Y/n]"
  if ($a -eq "" -or $a -match "^[yY]") {
    winget install -e --id Python.Python.3.13 --scope user --accept-package-agreements --accept-source-agreements
    $py = Find-Py
  }
  if (-not $py) {
    Write-Host ""
    Write-Host "  Please install Python 3 from https://www.python.org/downloads/ (tick 'Add python.exe to PATH'),"
    Write-Host "  then double-click Install.cmd again."
    Read-Host "  Press Enter to close"
    exit 1
  }
}
Write-Host "  Python: $py"
$wsh = New-Object -ComObject WScript.Shell
foreach ($dir in @([Environment]::GetFolderPath("Desktop"), (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"))) {
  $lnk = $wsh.CreateShortcut((Join-Path $dir "Morgul.lnk"))
  $lnk.TargetPath = "$env:SystemRoot\System32\wscript.exe"
  $lnk.Arguments = "`"$root\Morgul.vbs`""
  $lnk.WorkingDirectory = $root
  $lnk.IconLocation = "$root\app\web\morgul.ico,0"
  $lnk.Description = "Morgul - worldbuilding compendium"
  $lnk.Save()
  Write-Host "  Shortcut: $dir\Morgul.lnk"
}
Write-Host ""
Write-Host "  Done. Starting Morgul..."
Start-Process "$env:SystemRoot\System32\wscript.exe" -ArgumentList "`"$root\Morgul.vbs`""
Start-Sleep -Seconds 3
