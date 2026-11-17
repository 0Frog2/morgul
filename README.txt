MORGUL
======
A light, offline worldbuilding compendium for Windows. Keep your characters, places,
events, maps, timelines, magic systems, rituals, relationships and story in one place.
Your world is stored as plain text files on your own computer. Nothing is sent anywhere.


WHAT YOU NEED
-------------
- Windows 10 or 11
- Microsoft Edge (already part of Windows)
- Python 3 (free). The installer checks for it and offers to install it if it's missing.


HOW TO INSTALL
--------------
1. Unzip this folder to wherever you want Morgul to live,
   for example  Documents\Morgul  or  D:\Morgul.
   (Right-click the zip file > Extract All...)
   Don't run it from inside the zip file.

2. Open the unzipped folder and double-click  Install.cmd

3. A small window opens and:
   - checks that Python 3 is installed
     (if it isn't, it asks whether to install it; that one step uses the internet)
   - adds a "Morgul" shortcut to your Desktop and Start menu
   - starts Morgul

4. The first time Morgul opens, a short welcome tour shows you around.
   You can see it again any time from Help.

If Windows shows "Windows protected your PC", click "More info", then "Run anyway".
This appears because the installer is a small script, not a signed program.


HOW TO OPEN IT
--------------
Double-click "Morgul" on your Desktop or in the Start menu.
It opens in its own window. When you close the window, Morgul closes completely.
Nothing keeps running in the background.


WHERE YOUR WORLD IS
-------------------
World\          your entries, one text file each, in a folder per type
World\assets\   images and maps
Backups\        a zip of your world, made when you close Morgul (at most once a day)

You can move your world to another folder or drive, or keep several worlds:
Settings > Worlds.


BRINGING IN WHAT YOU ALREADY HAVE
---------------------------------
Help > Bring in your notes. Morgul can import:
- .md and .txt files, or a whole folder of them (for example from Obsidian)
- Word documents (.docx)
- text you paste in
Long documents can be split into separate entries by their headings.
You can also drag files onto the Morgul window.


UPDATES
-------
When a new version is out, Morgul shows a banner: "A new version of Morgul is ready".
Click "Update now". Only the app is updated: your worlds, settings and backups
are never touched, and a fresh backup is made first. If an update ever misbehaves,
Settings > Morgul > "Go back to the previous version".

Morgul only goes online to check for updates (a tiny version file) and to download
an update when you click the button. Everything else works fully offline.
You can turn the check off in Settings > Morgul.


OPTIONAL: THE AI HELPER
-----------------------
Morgul has an optional AI helper that asks you questions about your world and
points out contradictions. It runs on your own computer, never online.
1. Install Ollama from https://ollama.com
2. Open a terminal (Win+R, type cmd, Enter) and run:   ollama pull gemma4:e4b
3. In Morgul, open the AI helper (Ctrl+J).
Everything else in Morgul works without it.


UNINSTALL
---------
Double-click Uninstall.cmd. It removes the shortcuts.
Your world stays where it is. Delete the Morgul folder yourself when you no longer need it
(copy your World folder and Backups somewhere safe first if you want to keep them).


SOMETHING WENT WRONG?
---------------------
Help > "Copy problem report" copies technical details (no world content) that you can
send to whoever gave you Morgul.
