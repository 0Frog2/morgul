"""Morgul — a worldbuilding compendium.

A tiny local server (Python standard library only) + an Edge app window.
Nothing runs in the background: when the window closes, Morgul exits.
All world data lives as plain Markdown files in  <Morgul>/World.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
import zipfile
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse, parse_qs

APP_DIR = Path(__file__).resolve().parent
ROOT = APP_DIR.parent
WEB = APP_DIR / "web"
LOCAL = ROOT / ".local"             # machine-level (edge profile, logs, which world is open) — not part of any world
LOCAL.mkdir(parents=True, exist_ok=True)
CONFIG = LOCAL / "config.json"      # {"current": "<world folder>", "worlds": [{"name", "path"}]}
DEFAULT_WORLD_DIR = ROOT / "World"


def load_config():
    try:
        c = json.loads(CONFIG.read_text(encoding="utf-8"))
        return c if isinstance(c, dict) else {}
    except (OSError, json.JSONDecodeError):
        return {}


def save_config(c):
    tmp = CONFIG.with_suffix(".tmp")
    tmp.write_text(json.dumps(c, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, CONFIG)


_cfg = load_config()
WORLD_MISSING = ""                  # the chosen world folder couldn't be found (unplugged drive, moved folder)
if _cfg.get("current") and Path(_cfg["current"]).is_dir():
    WORLD = Path(_cfg["current"])
else:
    WORLD_MISSING = _cfg.get("current") or ""
    WORLD = DEFAULT_WORLD_DIR
ASSETS = WORLD / "assets"
META = WORLD / "_morgul"            # world-level state (contradictions, sessions, settings)
HISTORY = WORLD / "_history"
TRASH = WORLD / "_trash"
EXPORTS = ROOT / "Exports"
PORT = 47731
OLLAMA = "http://127.0.0.1:11434"

for d in (WORLD, ASSETS, META, HISTORY, TRASH, LOCAL, EXPORTS):
    d.mkdir(parents=True, exist_ok=True)

LOG = LOCAL / "morgul.log"


def log(*a):
    try:
        with open(LOG, "a", encoding="utf-8") as f:
            f.write(datetime.now().strftime("%Y-%m-%d %H:%M:%S ") + " ".join(str(x) for x in a) + "\n")
    except OSError:
        pass


# ---------------------------------------------------------------- files
SKIP_DIRS = {"assets", "_morgul", "_history", "_trash"}
FOLDERS = {}            # id -> Path (index of entry files)
LOCK = threading.RLock()


def slug(s):
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]+', "", str(s))
    s = re.sub(r"\s+", " ", s).strip(" .")
    return (s or "Untitled")[:80]


def read_entry(path: Path):
    text = path.read_text(encoding="utf-8")
    meta, body = {}, text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            head = text[3:end].strip()
            try:
                meta = json.loads(head)
            except json.JSONDecodeError:
                meta = {}
            body = text[end + 4:].lstrip("\n")
    meta["body"] = body
    meta.setdefault("id", path.stem)
    meta.setdefault("title", path.stem)
    meta.setdefault("type", path.parent.name.lower() if path.parent != WORLD else "note")
    return meta


def write_entry(path: Path, entry: dict):
    meta = {k: v for k, v in entry.items() if k != "body" and v not in (None, "", [], {})}
    meta["id"] = entry["id"]
    meta["title"] = entry.get("title") or "Untitled"
    meta["type"] = entry.get("type") or "note"
    text = "---\n" + json.dumps(meta, ensure_ascii=False, indent=2) + "\n---\n" + (entry.get("body") or "").rstrip() + "\n"
    tmp = path.with_suffix(".tmp")
    tmp.write_text(text, encoding="utf-8")
    os.replace(tmp, path)


def scan():
    FOLDERS.clear()
    out = []
    for p in WORLD.rglob("*.md"):
        rel = p.relative_to(WORLD).parts
        if rel and rel[0] in SKIP_DIRS:
            continue
        try:
            e = read_entry(p)
        except Exception as ex:          # a broken file must never stop the app
            log("unreadable", p, ex)
            continue
        if e["id"] in FOLDERS:           # duplicate id (copied file) -> give it a new one
            e["id"] = uuid.uuid4().hex[:10]
            write_entry(p, e)
        FOLDERS[e["id"]] = p
        out.append(e)
    return out


def type_folder(t):
    return WORLD / slug(t).capitalize()


def entry_path(entry):
    folder = type_folder(entry.get("type") or "note")
    folder.mkdir(parents=True, exist_ok=True)
    base = slug(entry.get("title"))
    p = folder / f"{base}.md"
    n = 2
    while p.exists() and FOLDERS.get(entry["id"]) != p:
        p = folder / f"{base} ({n}).md"
        n += 1
    return p


def snapshot(eid, path: Path, force=False):
    """Keep a version of the file before overwriting it (at most one per 10 min unless forced)."""
    if not path.exists():
        return
    d = HISTORY / eid
    d.mkdir(parents=True, exist_ok=True)
    versions = sorted(d.glob("*.md"))
    if versions and not force and time.time() - versions[-1].stat().st_mtime < 600:
        return
    shutil.copy2(path, d / (datetime.now().strftime("%Y%m%d-%H%M%S") + ".md"))
    for old in versions[:-59]:
        old.unlink(missing_ok=True)


LINK_RX = r"\[\[\s*{}\s*(\||#|\]\])"


def rename_links(old, new, skip_id):
    """[[Old]] / [[Old|text]] / [[Old#part]] -> New everywhere. Returns ids of changed entries."""
    changed = []
    rx = re.compile(LINK_RX.format(re.escape(old)), re.IGNORECASE)
    for eid, p in list(FOLDERS.items()):
        if eid == skip_id:
            continue
        try:
            e = read_entry(p)
        except Exception:
            continue
        body = e.get("body") or ""
        nb = rx.sub(lambda m: f"[[{new}{m.group(1)}", body)
        if nb != body:
            snapshot(eid, p, force=True)
            e["body"] = nb
            write_entry(p, e)
            changed.append(read_entry(p))
    return changed


def save_entry(entry, prev_title=None, snap=True):
    """snap: True = keep a version (at most one per 10 min), "force" = always keep one, False = none."""
    with LOCK:
        entry = dict(entry)
        entry.setdefault("id", uuid.uuid4().hex[:10])
        now = datetime.now().isoformat(timespec="seconds")
        entry.setdefault("created", now)
        entry["updated"] = now
        old = FOLDERS.get(entry["id"])
        if old and snap:
            snapshot(entry["id"], old, force=(snap == "force"))
        new_path = entry_path(entry)
        if old and old != new_path and old.exists():
            old.unlink()
        write_entry(new_path, entry)
        FOLDERS[entry["id"]] = new_path
        changed = []
        if prev_title and prev_title.strip().lower() != (entry.get("title") or "").strip().lower():
            changed = rename_links(prev_title.strip(), entry["title"].strip(), entry["id"])
        return read_entry(new_path), changed


def delete_entry(eid):
    with LOCK:
        p = FOLDERS.pop(eid, None)
        if p and p.exists():
            dest = TRASH / f"{p.stem} [{eid}].md"
            shutil.move(str(p), dest)
            return True
    return False


# ---------------------------------------------------------------- json state
def jload(name, default):
    p = META / name
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default


def jsave(name, data):
    p = META / name
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, p)


# ---------------------------------------------------------------- ollama (on demand)
OLLAMA_PROC = None


def ollama_up(timeout=1.5):
    try:
        with urllib.request.urlopen(OLLAMA + "/api/tags", timeout=timeout) as r:
            return json.loads(r.read())
    except Exception:
        return None


def find_ollama():
    cands = [Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "Ollama" / "ollama.exe",
             Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Ollama" / "ollama.exe"]
    w = shutil.which("ollama")
    if w:
        cands.insert(0, Path(w))
    return next((c for c in cands if c and c.exists()), None)


def ensure_ollama():
    """Start `ollama serve` only when the AI is used. Morgul stops it again on exit."""
    global OLLAMA_PROC
    if ollama_up():
        return True
    exe = find_ollama()
    if not exe:
        return False
    env = dict(os.environ)
    env.update({"OLLAMA_VULKAN": "1", "OLLAMA_NUM_PARALLEL": "1", "OLLAMA_MAX_LOADED_MODELS": "1",
                "LLAMA_ARG_CACHE_RAM": "0", "LLAMA_ARG_CTX_CHECKPOINTS": "1"})
    flags = 0x08000000 | 0x00004000 if os.name == "nt" else 0     # no window, below-normal priority
    logf = open(LOCAL / "ollama.log", "a", encoding="utf-8")
    OLLAMA_PROC = subprocess.Popen([str(exe), "serve"], env=env, stdout=logf, stderr=logf, creationflags=flags)
    for _ in range(40):
        time.sleep(0.5)
        if ollama_up():
            return True
    return False


def stop_ollama():
    """Stop the Ollama that Morgul started, together with its model runner (whatever the runner is called)."""
    global OLLAMA_PROC
    if OLLAMA_PROC and OLLAMA_PROC.poll() is None:
        if os.name == "nt":       # /T ends the whole process tree: `ollama serve` and its runner child
            subprocess.run(["taskkill", "/F", "/T", "/PID", str(OLLAMA_PROC.pid)], capture_output=True, creationflags=0x08000000)
        try:
            OLLAMA_PROC.terminate()
            OLLAMA_PROC.wait(5)
        except Exception:
            try:
                OLLAMA_PROC.kill()
            except Exception:
                pass
        log("ollama stopped")
    OLLAMA_PROC = None


def warm_model():
    """Load the model in the background as soon as the AI panel opens, so the first answer comes faster."""
    def run():
        try:
            if not ensure_ollama():
                return
            s = settings()
            req = urllib.request.Request(OLLAMA + "/api/generate", method="POST", headers={"Content-Type": "application/json"},
                                         data=json.dumps({"model": s["ai_model"], "keep_alive": s.get("ai_keep_alive", "60s")}).encode())
            urllib.request.urlopen(req, timeout=180).read()
        except Exception as e:
            log("warm-up", e)
    threading.Thread(target=run, daemon=True).start()


# ---------------------------------------------------------------- backups
def default_backup_dir():
    old = Path("E:/Morgul Backups")          # the original author's backup place; everyone else gets <Morgul>/Backups
    return str(old) if old.exists() else str(ROOT / "Backups")


def settings():
    s = {"language": "en", "ai_enabled": True, "ai_model": "gemma4:e4b", "ai_keep_alive": "60s",
         "backup_dir": default_backup_dir(), "backup_dir2": "",
         "backup_keep": 14, "backup_every_hours": 20, "theme": {}, "update_check": True}
    s.update(jload("app-settings.json", {}))
    return s


def backup(force=False):
    s = settings()
    d = Path(s["backup_dir"])
    try:
        d.mkdir(parents=True, exist_ok=True)
    except OSError as e:
        log("backup dir", e)
        return None
    prefix = "Morgul World" if WORLD.name == "World" else f"Morgul {slug(WORLD.name)}"
    zips = sorted(d.glob(f"{prefix} *.zip"))
    if zips and not force and time.time() - zips[-1].stat().st_mtime < s["backup_every_hours"] * 3600:
        return None
    target = d / f"{prefix} {datetime.now():%Y-%m-%d %H%M}.zip"
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for p in WORLD.rglob("*"):
            if p.is_file() and "_trash" not in p.parts:
                z.write(p, p.relative_to(WORLD))
    for old in sorted(d.glob(f"{prefix} *.zip"))[:-int(s["backup_keep"])]:
        old.unlink(missing_ok=True)
    log("backup", target)
    d2 = str(s.get("backup_dir2") or "").strip()     # optional second copy (USB stick, another drive, a synced folder)
    if d2:
        try:
            d2 = Path(d2)
            d2.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, d2 / target.name)
            for old in sorted(d2.glob(f"{prefix} *.zip"))[:-int(s["backup_keep"])]:
                old.unlink(missing_ok=True)
            log("backup copy", d2 / target.name)
        except OSError as e:
            log("backup copy failed", e)
    return str(target)


# ---------------------------------------------------------------- version & updates (like Oracle 2)
# The code is published at github.com/<repo>. Morgul only goes online to read the tiny version file there,
# and to download a new version when the author presses "Update now". It works fully offline otherwise.
# An update replaces only the app code (the files below). Worlds, settings, backups and exports are never touched.
MANAGED_ROOT_FILES = ["Morgul.vbs", "README.txt", "Install.cmd", "Uninstall.cmd", "setup/install.ps1"]
PREVIOUS = APP_DIR / "_previous"
UPDATE_CACHE = {}


def app_version():
    try:
        v = json.loads((APP_DIR / "version.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        v = {}
    return {"version": v.get("version", "0.0.0"), "date": v.get("date", ""), "repo": v.get("repo", "0Frog2/morgul")}


def vtuple(v):
    try:
        return tuple(int(x) for x in str(v).strip().lstrip("v").split(".")[:3])
    except ValueError:
        return (0, 0, 0)


def http_get(url, timeout=8):
    req = urllib.request.Request(url, headers={"User-Agent": "Morgul-updater", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def check_update(force=False):
    """{"current", "latest", "available", "notes"} or {"error"} when offline. Cached for 30 minutes."""
    cur = app_version()
    if not force and UPDATE_CACHE.get("t", 0) > time.time() - 1800:
        return UPDATE_CACHE["r"]
    try:
        remote = json.loads(http_get(f"https://raw.githubusercontent.com/{cur['repo']}/main/app/version.json?t={int(time.time())}", 6))
        latest = remote.get("version", "0.0.0")
        r = {"current": cur["version"], "latest": latest, "available": vtuple(latest) > vtuple(cur["version"]),
             "date": remote.get("date", ""), "notes": remote.get("notes", [])}
    except Exception as e:
        r = {"current": cur["version"], "error": "offline", "detail": str(e)[:200]}
    UPDATE_CACHE.update(t=time.time(), r=r)
    return r


def copy_app_tree(src_root: Path, dst_root: Path):
    """Copy the managed code (app/ + launcher/installer files) from one Morgul folder layout to another."""
    for p in (src_root / "app").rglob("*"):
        rel = p.relative_to(src_root / "app")
        if not p.is_file() or rel.parts[0] == "_previous" or "__pycache__" in rel.parts:
            continue
        t = dst_root / "app" / rel
        t.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(p, t)
    for f in MANAGED_ROOT_FILES:
        if (src_root / f).is_file():
            (dst_root / f).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_root / f, dst_root / f)


def snapshot_app(label):
    """Keep the current code in app/_previous/<date> v<version> so any update can be undone."""
    d = PREVIOUS / f"{datetime.now():%Y-%m-%d %H%M%S} v{app_version()['version']}{(' ' + label) if label else ''}"
    copy_app_tree(ROOT, d)
    snaps = sorted(x for x in PREVIOUS.iterdir() if x.is_dir() and " v" in x.name)
    for old in snaps[:-5]:                      # keep the last five versions
        shutil.rmtree(old, ignore_errors=True)
    return d


def install_code(src_root: Path):
    """Replace the running code with the code in src_root (same layout as the Morgul folder)."""
    keep = {p.relative_to(src_root / "app") for p in (src_root / "app").rglob("*") if p.is_file()}
    for p in list(APP_DIR.rglob("*")):           # files the new version no longer has
        rel = p.relative_to(APP_DIR)
        if p.is_file() and rel.parts[0] != "_previous" and "__pycache__" not in rel.parts and rel not in keep:
            p.unlink(missing_ok=True)
    copy_app_tree(src_root, ROOT)


def valid_tree(root: Path):
    return (root / "app" / "morgul.py").is_file() and (root / "app" / "web" / "index.html").is_file() and (root / "app" / "version.json").is_file()


def apply_update():
    """Download the newest version, back up the world, keep the old code, install, restart."""
    info = check_update(force=True)
    if info.get("error"):
        return {"error": "Morgul couldn't reach GitHub. Check the internet connection and try again."}
    if not info.get("available"):
        return {"error": f"You already have the newest version ({info['current']})."}
    work = LOCAL / "update"
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    repo = app_version()["repo"]
    try:
        data = http_get(f"https://github.com/{repo}/archive/refs/tags/v{info['latest']}.zip", 60)
        (work / "new.zip").write_bytes(data)
        with zipfile.ZipFile(work / "new.zip") as z:
            z.extractall(work / "x")
        tops = [p for p in (work / "x").iterdir() if p.is_dir()]
        src = tops[0] if len(tops) == 1 else work / "x"
        if not valid_tree(src):
            return {"error": "The downloaded update looks incomplete, so nothing was changed."}
        got = json.loads((src / "app" / "version.json").read_text(encoding="utf-8")).get("version")
        if vtuple(got) <= vtuple(app_version()["version"]):
            return {"error": "The download isn't newer than what you have, so nothing was changed."}
    except Exception as e:
        log("update download failed", e)
        return {"error": "The download failed, so nothing was changed. Try again later."}
    backup(force=True)                          # the world is never touched, but a fresh backup costs nothing
    was = app_version()["version"]
    snap = snapshot_app("")
    try:
        install_code(src)
    except Exception as e:                      # put the old code back exactly as it was
        log("update install failed, restoring", e)
        install_code(snap)
        return {"error": f"The update couldn't be installed ({e}). Your previous version was restored."}
    log("updated", was, "->", got)
    shutil.rmtree(work, ignore_errors=True)
    return {"ok": True, "version": got}


def previous_versions():
    if not PREVIOUS.exists():
        return []
    out = []
    for d in sorted(PREVIOUS.iterdir(), reverse=True):
        if d.is_dir() and valid_tree(d):
            v = json.loads((d / "app" / "version.json").read_text(encoding="utf-8")).get("version", "?")
            m = re.match(r"(\d{4}-\d\d-\d\d) (\d\d)(\d\d)", d.name)
            out.append({"dir": d.name, "version": v, "saved": f"{m.group(1)} {m.group(2)}:{m.group(3)}" if m else d.name[:16],
                        "note": "before going back" if "before going back" in d.name else ""})
    return out


def rollback(name):
    d = PREVIOUS / name
    if not name or "/" in name or "\\" in name or not valid_tree(d):
        return {"error": "That version isn't available."}
    snapshot_app("before going back")
    install_code(d)
    log("rolled back to", name)
    return {"ok": True}


# ---------------------------------------------------------------- shareable copy (the tool without any world)
def build_share():
    """Zip the code, launcher and installer. Never a world, settings, backups or the old versions."""
    EXPORTS.mkdir(parents=True, exist_ok=True)
    target = EXPORTS / "Morgul-Setup.zip"
    tmp = target.with_suffix(".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for p in APP_DIR.rglob("*"):
            rel = p.relative_to(APP_DIR)
            if not p.is_file() or rel.parts[0] == "_previous" or "__pycache__" in rel.parts:
                continue
            z.write(p, Path("Morgul") / "app" / rel)
        for f in MANAGED_ROOT_FILES:
            if (ROOT / f).is_file():
                z.write(ROOT / f, Path("Morgul") / f)
    tmp.replace(target)
    log("share package", target)
    return str(target)


# ---------------------------------------------------------------- trash
def trash_list():
    out = []
    for p in sorted(TRASH.glob("*.md"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            e = read_entry(p)
        except Exception:
            continue
        out.append({"file": p.name, "id": e.get("id"), "title": e.get("title"), "type": e.get("type"),
                    "deleted": datetime.fromtimestamp(p.stat().st_mtime).isoformat(timespec="seconds"),
                    "words": len((e.get("body") or "").split())})
    return out


def trash_restore(name):
    p = TRASH / Path(name).name
    if not p.is_file():
        return None
    e = read_entry(p)
    if e["id"] in FOLDERS:                    # an entry with that id came back meanwhile
        e["id"] = uuid.uuid4().hex[:10]
    restored, _ = save_entry(e, snap=False)
    p.unlink(missing_ok=True)
    return restored


# ---------------------------------------------------------------- importing existing notes
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def docx_to_markdown(data: bytes):
    """Word → Markdown, offline: headings, lists, bold/italic, tables. Enough to split into entries."""
    import xml.etree.ElementTree as ET
    with zipfile.ZipFile(__import__("io").BytesIO(data)) as z:
        root = ET.fromstring(z.read("word/document.xml"))
        styles = {}
        try:                                  # style id -> name ("Heading1" may be called "heading 1" or localized)
            for st in ET.fromstring(z.read("word/styles.xml")).iter(W + "style"):
                nm = st.find(W + "name")
                styles[st.get(W + "styleId")] = (nm.get(W + "val") if nm is not None else "").lower()
        except KeyError:
            pass
    body = root.find(W + "body")
    out = []

    def runs(p):
        txt = ""
        for r in p.iter(W + "r"):
            t = "".join((x.text or "") if x.tag == W + "t" else ("\t" if x.tag == W + "tab" else "\n" if x.tag in (W + "br", W + "cr") else "") for x in r)
            if not t:
                continue
            rp = r.find(W + "rPr")
            b = rp is not None and rp.find(W + "b") is not None and rp.find(W + "b").get(W + "val") not in ("0", "false")
            i = rp is not None and rp.find(W + "i") is not None and rp.find(W + "i").get(W + "val") not in ("0", "false")
            if t.strip() and (b or i):
                lead, core, trail = re.match(r"^(\s*)(.*?)(\s*)$", t, re.S).groups()
                mark = "**" if b and not i else "*" if i and not b else "***"
                t = f"{lead}{mark}{core}{mark}{trail}"
            txt += t
        return txt.replace("****", "")

    for el in body:
        if el.tag == W + "p":
            ppr = el.find(W + "pPr")
            sid = ppr.find(W + "pStyle").get(W + "val") if ppr is not None and ppr.find(W + "pStyle") is not None else ""
            name = styles.get(sid, sid.lower())
            text = runs(el)
            m = re.search(r"(?:heading|заглавие)\s*(\d)", name) or re.match(r"heading(\d)", sid.lower())
            if name in ("title", "заглавие") or sid.lower() == "title":
                out.append("# " + text.strip().strip("*"))
            elif m:
                out.append("#" * min(6, int(m.group(1))) + " " + text.strip().strip("*"))
            elif ppr is not None and ppr.find(W + "numPr") is not None:
                out.append("- " + text.strip())
            else:
                out.append(text)
        elif el.tag == W + "tbl":
            rows = []
            for tr in el.iter(W + "tr"):
                rows.append("| " + " | ".join(" ".join(runs(p) for p in tc.iter(W + "p")).strip() for tc in tr.iter(W + "tc")) + " |")
            if rows:
                out += [rows[0], "|" + " --- |" * rows[0].count(" | ") + " --- |"] + rows[1:]
    md = "\n".join(out)
    return re.sub(r"\n{3,}", "\n\n", md).strip()


def decode_text(data: bytes):
    for enc in ("utf-8-sig", "cp1251", "latin-1"):     # cp1251: older Bulgarian/Cyrillic text files
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", "replace")


def import_parse(files):
    import base64
    out = []
    for f in files[:500]:
        name = str(f.get("name") or "note")
        try:
            raw = base64.b64decode(f.get("data") or "")
            ext = Path(name).suffix.lower()
            if ext == ".docx":
                text = docx_to_markdown(raw)
            elif ext in (".md", ".txt", ".markdown", ".text"):
                text = decode_text(raw)
            else:
                out.append({"name": name, "error": "Only .md, .txt and .docx files can be imported."})
                continue
            tags = []
            fm = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.S)       # Obsidian / YAML front matter
            if fm:
                tm = re.search(r"^tags:\s*\[?([^\]\n]*)\]?", fm.group(1), re.M)
                if tm:
                    tags = [x.strip(" '\"#") for x in tm.group(1).split(",") if x.strip(" '\"#")]
                text = text[fm.end():]
            out.append({"name": name, "text": text.replace("\r\n", "\n").strip(), "tags": tags})
        except Exception as e:
            log("import", name, e)
            out.append({"name": name, "error": f"Couldn't read this file ({type(e).__name__})."})
    return out


# ---------------------------------------------------------------- worlds (where they live; several of them)
def worlds_info():
    c = load_config()
    lst = c.get("worlds") or []
    paths = {str(Path(w["path"])) for w in lst}
    if str(DEFAULT_WORLD_DIR) not in paths and DEFAULT_WORLD_DIR.exists():
        lst = [{"name": "World", "path": str(DEFAULT_WORLD_DIR)}] + lst
    if str(WORLD) not in {str(Path(w["path"])) for w in lst}:
        lst.append({"name": WORLD.name, "path": str(WORLD)})
    return {"current": str(WORLD), "missing": WORLD_MISSING, "default": str(DEFAULT_WORLD_DIR),
            "worlds": [{**w, "exists": Path(w["path"]).is_dir()} for w in lst]}


def remember_world(path: Path, name=None, make_current=True):
    c = load_config()
    lst = [w for w in (c.get("worlds") or []) if str(Path(w["path"])) != str(path)]
    lst.append({"name": name or path.name, "path": str(path)})
    c["worlds"] = lst
    if make_current:
        c["current"] = str(path)
    save_config(c)


def pick_folder(title="Choose a folder"):
    """The Windows folder picker (tkinter ships with Python). Returns "" when cancelled or unavailable."""
    try:
        import tkinter
        from tkinter import filedialog
        r = tkinter.Tk()
        r.withdraw()
        r.attributes("-topmost", True)
        path = filedialog.askdirectory(title=title, mustexist=False)
        r.destroy()
        return str(Path(path)) if path else ""
    except Exception as e:
        log("folder picker", e)
        return None


def world_open(path, create=False, name=None):
    p = Path(path).expanduser()
    if not p.is_absolute():
        return {"error": "Please give a full folder path, like D:\\Worlds\\My world."}
    if p.resolve() in (ROOT.resolve(), APP_DIR.resolve()) or APP_DIR.resolve() in p.resolve().parents:
        return {"error": "Pick a folder outside Morgul's app folder."}
    if not p.exists():
        if not create:
            return {"error": "That folder doesn't exist."}
        p.mkdir(parents=True)
    elif create and any(p.iterdir()) and not (p / "_morgul").exists():
        return {"error": "That folder isn't empty. Pick an empty folder for a new world, or use “Open a world folder”."}
    remember_world(p, name)
    log("world switched to", p)
    return {"ok": True}


def world_move(path):
    dest = Path(path).expanduser()
    if not dest.is_absolute():
        return {"error": "Please give a full folder path."}
    if dest.exists() and any(dest.iterdir()):
        return {"error": "Pick an empty (or new) folder to move the world into."}
    if WORLD.resolve() in dest.resolve().parents or dest.resolve() == WORLD.resolve():
        return {"error": "The new place can't be inside the current world folder."}
    backup(force=True)
    with LOCK:
        shutil.copytree(WORLD, dest, dirs_exist_ok=True)
        n_old = sum(1 for p in WORLD.rglob("*") if p.is_file())
        n_new = sum(1 for p in dest.rglob("*") if p.is_file())
        if n_new < n_old:
            return {"error": f"Only {n_new} of {n_old} files were copied, so Morgul keeps using the old place."}
    c = load_config()
    c["worlds"] = [w for w in (c.get("worlds") or []) if str(Path(w["path"])) != str(WORLD)]
    save_config(c)
    remember_world(dest, dest.name)
    log("world copied to", dest, "(old folder left in place)", WORLD)
    return {"ok": True, "old": str(WORLD)}


def world_forget(path):
    c = load_config()
    c["worlds"] = [w for w in (c.get("worlds") or []) if str(Path(w["path"])) != str(Path(path))]
    save_config(c)
    return {"ok": True}


# ---------------------------------------------------------------- problem report (no world content)
def problem_report():
    import platform
    home = str(Path.home())
    hide = lambda x: str(x).replace(home, "~")
    try:
        lines = LOG.read_text(encoding="utf-8", errors="replace").splitlines()[-60:]
    except OSError:
        lines = []
    s = settings()
    n = len(FOLDERS) or sum(1 for _ in WORLD.rglob("*.md"))
    return "\n".join([
        "Morgul problem report",
        f"Version: {app_version()['version']} ({app_version()['date']})",
        f"Windows: {platform.platform()}",
        f"Python: {sys.version.split()[0]} at {hide(sys.executable)}",
        f"Morgul folder: {hide(ROOT)}",
        f"World folder: {hide(WORLD)}{'  (configured world missing: ' + hide(WORLD_MISSING) + ')' if WORLD_MISSING else ''}",
        f"Entries: {n}",
        f"AI: {'on' if s.get('ai_enabled', True) else 'off'}, model {s.get('ai_model')}, Ollama {'found' if find_ollama() else 'not found'}",
        f"Language: {s.get('language')}",
        "",
        "Last log lines:",
        *[hide(l) for l in lines],
    ])


# ---------------------------------------------------------------- http
LAST_PING = time.time()
STARTED = time.time()
MIME = {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
        ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
        ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2"}


class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, *a):
        pass

    # helpers
    def send_json(self, data, code=200):
        raw = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(n) if n else b""

    def jbody(self):
        try:
            return json.loads(self.body() or b"{}")
        except json.JSONDecodeError:
            return {}

    def send_file(self, p: Path):
        if not p.exists() or not p.is_file():
            self.send_error(404)
            return
        data = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(p.suffix.lower(), "application/octet-stream"))
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache" if p.suffix in (".html", ".js", ".css") else "max-age=3600")
        self.end_headers()
        self.wfile.write(data)

    def safe(self, base: Path, rel: str):
        p = (base / unquote(rel)).resolve()
        return p if str(p).startswith(str(base.resolve())) else None

    # routes
    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        if path == "/" or path == "/index.html":
            return self.send_file(WEB / "index.html")
        if path.startswith("/assets/"):
            p = self.safe(ASSETS, path[len("/assets/"):])
            return self.send_file(p) if p else self.send_error(403)
        if path.startswith("/api/"):
            return self.api_get(path[5:], parse_qs(u.query))
        p = self.safe(WEB, path.lstrip("/"))
        return self.send_file(p) if p else self.send_error(403)

    def api_get(self, route, q):
        global LAST_PING
        LAST_PING = time.time()
        if route == "bootstrap":
            with LOCK:
                entries = scan()
            world = jload("world.json", None)
            return self.send_json({"entries": entries, "world": world, "settings": settings(),
                                   "state": jload("state.json", {}), "root": str(ROOT), "worldPath": str(WORLD),
                                   "worldMissing": WORLD_MISSING, "version": app_version()})
        if route.startswith("history/"):
            parts = route.split("/")
            d = HISTORY / parts[1]
            if len(parts) == 2:
                vs = sorted(d.glob("*.md"), reverse=True) if d.exists() else []
                return self.send_json([{"v": v.stem, "size": v.stat().st_size} for v in vs])
            p = self.safe(d, parts[2] + ".md")
            if not p or not p.exists():
                return self.send_json({"error": "not found"}, 404)
            return self.send_json(read_entry(p))
        if route == "ai/status":
            if not settings().get("ai_enabled", True):
                return self.send_json({"enabled": False})
            tags = ollama_up(0.8)
            return self.send_json({"enabled": True, "running": bool(tags), "installed": bool(tags) or bool(find_ollama()),
                                   "models": [m["name"] for m in (tags or {}).get("models", [])]})
        if route == "assets":
            files = sorted((p.name for p in ASSETS.iterdir() if p.is_file()), key=str.lower)
            return self.send_json(files)
        if route == "update/check":
            if not settings().get("update_check", True) and "force" not in q:
                return self.send_json({"current": app_version()["version"], "disabled": True})
            return self.send_json(check_update(force="force" in q))
        if route == "update/previous":
            return self.send_json(previous_versions())
        if route == "trash":
            return self.send_json(trash_list())
        if route == "worlds":
            return self.send_json(worlds_info())
        if route == "report":
            return self.send_json({"text": problem_report()})
        return self.send_json({"error": "unknown"}, 404)

    def do_POST(self):
        global LAST_PING
        LAST_PING = time.time()
        u = urlparse(self.path)
        route = u.path[5:] if u.path.startswith("/api/") else ""
        q = parse_qs(u.query)
        if route == "ping":
            return self.send_json({"ok": True})
        if route == "entry":
            b = self.jbody()
            snap = "force" if b.get("snapshot") == "force" else bool(b.get("snapshot", True))
            e, changed = save_entry(b["entry"], b.get("prevTitle"), snap)
            return self.send_json({"entry": e, "changed": changed})
        if route == "entry/delete":
            return self.send_json({"ok": delete_entry(self.jbody().get("id"))})
        if route == "upload":
            name = slug(Path(unquote(q.get("name", ["image.png"])[0])).stem)
            ext = Path(unquote(q.get("name", ["x.png"])[0])).suffix.lower() or ".png"
            if ext not in (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"):
                return self.send_json({"error": "Only images can be added"}, 400)
            p = ASSETS / f"{name}{ext}"
            n = 2
            while p.exists():
                p = ASSETS / f"{name} {n}{ext}"
                n += 1
            p.write_bytes(self.body())
            return self.send_json({"file": p.name})
        if route == "world":
            jsave("world.json", self.jbody())
            return self.send_json({"ok": True})
        if route == "state":
            jsave("state.json", self.jbody())
            return self.send_json({"ok": True})
        if route == "settings":
            s = settings()
            s.update(self.jbody())
            jsave("app-settings.json", s)
            return self.send_json(s)
        if route == "ai/chat":
            return self.ai_chat(self.jbody())
        if route == "ai/unload":
            try:
                req = urllib.request.Request(OLLAMA + "/api/generate", method="POST",
                                             data=json.dumps({"model": settings()["ai_model"], "keep_alive": 0}).encode())
                urllib.request.urlopen(req, timeout=5).read()
            except Exception:
                pass
            return self.send_json({"ok": True})
        if route == "export":
            return self.export(self.jbody())
        if route == "open":
            p = Path(self.jbody().get("path", ""))
            if os.name == "nt" and p.exists():
                os.startfile(str(p))
            return self.send_json({"ok": True})
        if route == "backup":
            return self.send_json({"file": backup(force=True)})
        if route == "ai/warm":
            if settings().get("ai_enabled", True):
                warm_model()
            return self.send_json({"ok": True})
        if route == "share/build":
            try:
                return self.send_json({"file": build_share()})
            except Exception as e:
                log("share package failed", e)
                return self.send_json({"error": str(e)}, 500)
        if route == "update/apply":
            r = apply_update()
            self.send_json(r, 200 if r.get("ok") else 400)
            if r.get("ok"):
                threading.Thread(target=restart, daemon=True).start()
            return
        if route == "update/rollback":
            r = rollback(self.jbody().get("dir", ""))
            self.send_json(r, 200 if r.get("ok") else 400)
            if r.get("ok"):
                threading.Thread(target=restart, daemon=True).start()
            return
        if route == "trash/restore":
            e = trash_restore(self.jbody().get("file", ""))
            return self.send_json({"entry": e} if e else {"error": "Not found in the trash"}, 200 if e else 404)
        if route == "trash/purge":
            b = self.jbody()
            files = [p.name for p in TRASH.glob("*.md")] if b.get("all") else [b.get("file", "")]
            for f in files:
                (TRASH / Path(f).name).unlink(missing_ok=True)
            return self.send_json({"ok": True})
        if route == "import/parse":
            return self.send_json(import_parse(self.jbody().get("files") or []))
        if route == "worlds/pick":
            path = pick_folder(self.jbody().get("title") or "Choose a folder")
            return self.send_json({"path": path, "unavailable": path is None})
        if route in ("worlds/open", "worlds/new", "worlds/move"):
            b = self.jbody()
            r = world_move(b.get("path", "")) if route == "worlds/move" else world_open(b.get("path", ""), route == "worlds/new", b.get("name"))
            self.send_json(r, 200 if r.get("ok") else 400)
            if r.get("ok"):
                threading.Thread(target=restart, daemon=True).start()
            return
        if route == "worlds/forget":
            return self.send_json(world_forget(self.jbody().get("path", "")))
        if route == "restart":
            self.send_json({"ok": True})
            threading.Thread(target=restart, daemon=True).start()
            return
        if route == "quit":
            self.send_json({"ok": True})
            threading.Thread(target=shutdown, daemon=True).start()
            return
        return self.send_json({"error": "unknown"}, 404)

    def ai_chat(self, b):
        s = settings()
        if not s.get("ai_enabled", True):
            return self.send_json({"error": "The AI helper is turned off in Settings."}, 400)
        if not ensure_ollama():
            return self.send_json({"error": "Ollama isn't installed or didn't start, so the AI helper can't run."}, 503)
        payload = {"model": s["ai_model"], "messages": b.get("messages", []), "stream": True, "think": False,
                   "keep_alive": s.get("ai_keep_alive", "60s"),
                   "options": {"num_ctx": int(b.get("num_ctx", 8192)), "temperature": b.get("temperature", 0.7)}}
        if b.get("format"):
            payload["format"] = b["format"]
            payload["stream"] = False
        req = urllib.request.Request(OLLAMA + "/api/chat", data=json.dumps(payload).encode(), method="POST",
                                     headers={"Content-Type": "application/json"})
        try:
            r = urllib.request.urlopen(req, timeout=600)
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:300]
            if "not found" in msg.lower():
                msg = f"The model {s['ai_model']} isn't downloaded. In a terminal run: ollama pull {s['ai_model']}"
            return self.send_json({"error": msg}, 502)
        except Exception as e:
            return self.send_json({"error": f"AI request failed: {e}"}, 502)
        if not payload["stream"]:
            data = json.loads(r.read())
            return self.send_json({"content": data.get("message", {}).get("content", "")})
        # stream plain text chunks
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        try:
            for line in r:
                if not line.strip():
                    continue
                try:
                    part = json.loads(line).get("message", {}).get("content", "")
                except json.JSONDecodeError:
                    continue
                if part:
                    raw = part.encode("utf-8")
                    self.wfile.write(f"{len(raw):X}\r\n".encode() + raw + b"\r\n")
                    self.wfile.flush()
            self.wfile.write(b"0\r\n\r\n")
        except (BrokenPipeError, ConnectionResetError):
            pass

    def export(self, b):
        """The page renders the HTML; we only write it (and copy the images it uses)."""
        name = slug(b.get("name") or "Export")
        target = EXPORTS / f"{name} {datetime.now():%Y-%m-%d %H%M}"
        target.mkdir(parents=True, exist_ok=True)
        for rel, content in (b.get("files") or {}).items():
            p = (target / rel).resolve()
            if not str(p).startswith(str(target.resolve())):
                continue
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(content, encoding="utf-8")
        for img in b.get("images") or []:
            src = ASSETS / img
            if src.exists():
                (target / "assets").mkdir(exist_ok=True)
                shutil.copy2(src, target / "assets" / img)
        return self.send_json({"path": str(target)})


SERVER = None


def shutdown():
    log("shutting down")
    try:
        backup()
    except Exception as e:
        log("backup failed", e)
    stop_ollama()
    if SERVER:
        SERVER.shutdown()


RESTARTING = False


def restart():
    """Reload Morgul's server code without closing the window: start a fresh server, then let this one exit.
    The page notices and reloads itself. No backup and no AI shutdown, since Morgul isn't closing."""
    global RESTARTING
    RESTARTING = True
    log("restarting")
    time.sleep(0.3)
    stop_ollama()                     # the new server can't see this one's Ollama, so don't leave it orphaned
    exe = sys.executable
    if os.name == "nt" and exe.lower().endswith("python.exe"):
        exe = exe[:-len("python.exe")] + "pythonw.exe"
    flags = 0x00000008 | 0x00000200 if os.name == "nt" else 0       # detached, own process group
    # start the new server first (it waits for the port); this process ends as soon as its server stops
    subprocess.Popen([exe, str(Path(__file__).resolve()), "--restart"], cwd=str(ROOT), creationflags=flags, close_fds=True)
    if SERVER:
        SERVER.shutdown()
        SERVER.server_close()


def prepare_profile():
    """Spellcheck in English and Bulgarian. Only touched while Morgul's Edge window is closed."""
    prefs = LOCAL / "window" / "Default" / "Preferences"
    if not prefs.exists():
        return
    try:
        data = json.loads(prefs.read_text(encoding="utf-8"))
        sc = data.setdefault("spellcheck", {})
        intl = data.setdefault("intl", {})
        want = ["en-US", "bg"]
        if sc.get("dictionaries") == want and sc.get("use_spelling_service") is False and "bg" in intl.get("accept_languages", ""):
            return
        sc["dictionaries"] = want
        sc["use_spelling_service"] = False            # stays offline: no sending text to an online spellchecker
        data.setdefault("browser", {})["enable_spellchecking"] = True
        intl["accept_languages"] = "en-US,en,bg"
        prefs.write_text(json.dumps(data), encoding="utf-8")
        log("spellcheck set to en-US + bg")
    except Exception as e:
        log("spellcheck prefs", e)


def window_open():
    """True/False while Morgul's own Edge window is (not) running, None if we can't tell.
    Edge keeps a locked 'lockfile' in its profile folder for as long as it runs."""
    lock = LOCAL / "window" / "lockfile"
    if not lock.exists():
        return False if WINDOW_SEEN else None
    try:
        with open(lock, "a"):
            pass
    except OSError:
        return True               # locked -> Edge is running
    return None                   # not locked: can't tell -> use the heartbeat instead


WINDOW_SEEN = False


def watchdog():
    """Exit (with a backup) once the window has been closed. Nothing keeps running in the background."""
    global WINDOW_SEEN
    closed_checks = 0
    while True:
        time.sleep(4)
        state = window_open()
        if RESTARTING:
            return
        if state is True:
            WINDOW_SEEN = True
            closed_checks = 0
            continue
        if state is False:
            closed_checks += 1
            if closed_checks >= 2:
                shutdown()
                return
            continue
        # no Edge window to watch (e.g. opened in a normal browser): fall back to the page's heartbeat
        idle = time.time() - LAST_PING
        if (time.time() - STARTED > 120 and idle > 90) or idle > 900:
            shutdown()
            return


def find_browser():
    cands = [Path(os.environ.get("ProgramFiles(x86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
             Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Microsoft/Edge/Application/msedge.exe",
             Path(os.environ.get("ProgramFiles", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe"]
    return next((c for c in cands if c.exists()), None)


def open_window():
    url = f"http://127.0.0.1:{PORT}/"
    exe = find_browser()
    if not exe:
        import webbrowser
        webbrowser.open(url)
        return
    profile = LOCAL / "window"
    edge_closed = True
    try:
        (profile / "lockfile").unlink()      # stale lock from an earlier crash (fails harmlessly if Edge holds it)
    except FileNotFoundError:
        pass
    except OSError:
        edge_closed = False                  # Morgul's Edge window is already open
    if edge_closed:
        prepare_profile()
    args = [str(exe), f"--app={url}", f"--user-data-dir={profile}", "--window-size=1440,900",
            "--force-dark-mode",     # Edge's own title bar and menus stay dark
            "--no-first-run", "--no-default-browser-check", "--disable-features=Translate,msEdgeSidebarV2",
            "--disable-background-networking", "--disable-sync", "--disable-extensions",
            "--disk-cache-size=33554432", "--renderer-process-limit=2",
            "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"]
    subprocess.Popen(args, creationflags=0x08000000 if os.name == "nt" else 0)


def already_running():
    try:
        with socket.create_connection(("127.0.0.1", PORT), timeout=0.5):
            return True
    except OSError:
        return False


def main():
    global SERVER
    if "--restart" in sys.argv:              # started by restart(): wait for the old server to let go of the port
        for _ in range(40):
            if not already_running():
                break
            time.sleep(0.25)
        sys.argv.append("--no-window")
    elif already_running():
        open_window()          # second launch: just open another window on the running Morgul
        return
    SERVER = ThreadingHTTPServer(("127.0.0.1", PORT), H)
    SERVER.daemon_threads = True
    log("started", ROOT, "v" + app_version()["version"], "world:", WORLD)
    threading.Thread(target=watchdog, daemon=True).start()
    if "--no-window" not in sys.argv:
        open_window()
    SERVER.serve_forever()
    log("stopped")


if __name__ == "__main__":
    main()
