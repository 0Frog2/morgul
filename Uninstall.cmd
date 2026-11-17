@echo off
title Remove Morgul shortcuts
echo.
echo   This removes the Morgul shortcuts from your Desktop and Start menu.
echo   Your world and this folder are NOT deleted.
echo.
pause
del "%USERPROFILE%\Desktop\Morgul.lnk" 2>nul
for /f "usebackq delims=" %%D in (`powershell -NoProfile -Command "[Environment]::GetFolderPath('Desktop')"`) do del "%%D\Morgul.lnk" 2>nul
del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Morgul.lnk" 2>nul
echo.
echo   Shortcuts removed. Delete this folder yourself when you no longer need it
echo   (copy your World and Backups folders somewhere safe first if you want to keep them).
echo.
pause
