# Morgul

A light, offline worldbuilding compendium for Windows: characters, places, events, maps, timelines,
magic systems, rituals, relationships and your story, all in one place. Your world is stored as plain
Markdown files on your own computer.

## Download and install
1. Download **[Morgul (zip)](https://github.com/0Frog2/morgul/archive/refs/heads/release.zip)**, the newest released version.
2. Unzip it where you want Morgul to live and double-click **Install.cmd**.

Full instructions are in [README.txt](README.txt).

## Updates
Morgul checks the `release` branch of this repository for a newer version when it opens and offers **Update now**.
Only the app is replaced; worlds, settings and backups are never touched.

## For maintainers: making a release
1. Change the code, add an entry to `app/web/changelog.js`.
2. Bump `version`, `date` and `notes` in `app/version.json`.
3. Commit to `main`, then move the `release` branch to that commit and push it.
   Installed copies read `release/app/version.json` and download the `release` branch's archive.
   `main` can hold work in progress; only `release` reaches people.
