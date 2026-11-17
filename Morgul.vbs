' Starts Morgul without a console window.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
app = here & "\app\morgul.py"

py = ""
cands = Array( _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Python\pythoncore-3.14-64\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Python\pythoncore-3.13-64\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Python\bin\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python314\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python313\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Python315\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Python\pythoncore-3.15-64\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\Python313\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%ProgramFiles%\Python314\pythonw.exe"), _
  sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\Programs\Python\Launcher\pyw.exe"), _
  sh.ExpandEnvironmentStrings("%SystemRoot%\pyw.exe"))
For Each c In cands
  If py = "" And fso.FileExists(c) Then py = c
Next
If py = "" Then py = "pythonw.exe"

sh.Run """" & py & """ """ & app & """", 0, False
