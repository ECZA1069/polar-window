"""Download NASA SPICE kernels and the Celestia Moon texture. Run on a machine with internet access.
Usage (from backend/): python scripts/fetch_assets.py
"""
import json, re, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KDIR = ROOT / "data" / "kernels"
ADIR = ROOT.parent / "frontend" / "public" / "assets"
G = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"

def get(url, dest=None):
    req = urllib.request.Request(url, headers={"User-Agent": "polar-window-fetch"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = r.read()
    if dest:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    return data

def latest(dir_url, pattern):
    html = get(dir_url).decode("utf8", "ignore")
    names = sorted(set(re.findall(pattern, html)))
    if not names:
        sys.exit(f"No match for {pattern} at {dir_url}")
    return names[-1]

def kernels():
    items = [(G + "lsk/", r"naif\d{4}\.tls"), (G + "pck/", r"pck\d{5}\.tpc"),
             (G + "pck/", r"moon_pa_de440_\d+\.bpc"), (G + "fk/satellites/", r"moon_de440_\d+\.tf")]
    for d, pat in items:
        n = latest(d, pat)
        if not (KDIR / n).exists():
            print("kernel", n)
            get(d + n, KDIR / n)
    if not (KDIR / "de440s.bsp").exists():
        print("kernel de440s.bsp (~32 MB, covers 1849-2150)")
        get(G + "spk/planets/de440s.bsp", KDIR / "de440s.bsp")

def celestia():
    api = "https://api.github.com/repos/CelestiaProject/CelestiaContent/git/trees/master?recursive=1"
    tree = json.loads(get(api))["tree"]
    cands = [t["path"] for t in tree
             if re.search(r"/moon(-normal)?\.(jpg|jpeg|png)$", t["path"], re.I)]
    print("Celestia Moon candidates:")
    for c in cands:
        print("  ", c)
    color_cands = [c for c in cands if "normal" not in c.lower()]
    norm_cands = [c for c in cands if "normal" in c.lower()]
    if not color_cands:
        sys.exit("No Moon colour texture found; pick one manually from the repo.")
    pick = next((c for c in color_cands if "medres" in c.lower()), color_cands[0])
    ext = pick.rsplit(".", 1)[1].lower()
    if (ADIR / "moon.png").exists() and ext != "png":
        (ADIR / "moon.png").unlink()
    get("https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/" + pick, ADIR / f"moon.{ext}")
    print("Saved", ADIR / f"moon.{ext}")
    norm_pick = next((c for c in norm_cands if "medres" in c.lower()), norm_cands[0] if norm_cands else None)
    if norm_pick:
        get("https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/" + norm_pick, ADIR / "moon-normal.png")
        print("Saved", ADIR / "moon-normal.png")
    (ADIR / "ATTRIBUTION.md").write_text(
        f"# Moon texture\nSource: https://github.com/CelestiaProject/CelestiaContent/blob/master/{pick}\n"
        + (f"Normal map: https://github.com/CelestiaProject/CelestiaContent/blob/master/{norm_pick}\n\n" if norm_pick else "\n")
        + "**License: NOT VERIFIED.** Check the repo's per-asset license/credits for this file and record the exact "
        "terms and original data credit here before distributing.\n")
    print("Verify license in ATTRIBUTION.md")

if __name__ == "__main__":
    kernels()
    celestia()
