import os, re, struct, threading
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
import numpy as np
try:
    import spiceypy as sp
except Exception:
    sp = None
from .geometry import elevation_azimuth, axis_direction

KERNEL_DIR = Path(os.environ.get("KERNEL_DIR", Path(__file__).resolve().parents[1] / "data" / "kernels"))
_lock = threading.Lock()
_loaded = False
_fallback = None
# Required kernels (prefix match). Downloaded by scripts/fetch_assets.py from naif.jpl.nasa.gov.
REQUIRED = ["naif0012.tls", "pck00011.tpc", "de440", "moon_pa_de440", "moon_de440"]
C_LIGHT_KM_S = 299792.458

class KernelsMissing(RuntimeError):
    pass

def kernel_files():
    return sorted(p for p in KERNEL_DIR.glob("*") if p.is_file())

def missing_kernels():
    names = [p.name for p in kernel_files()]
    return [r for r in REQUIRED if not any(n.startswith(r) for n in names)]


class _Type2Seg:
    """Pure-NumPy reader for NAIF DAF Type 2 Chebyshev segments (SPK .bsp and binary PCK .bpc)."""
    def __init__(self, arr: np.ndarray, start_idx: int, end_idx: int):
        sub = arr[start_idx - 1 : end_idx]
        self.init, self.intlen, rsize, nrec = sub[-4:]
        self.rsize = int(rsize)
        self.nrec = int(nrec)
        self.deg = (self.rsize - 2) // 3 - 1
        self.recs = sub[: self.nrec * self.rsize].reshape(self.nrec, self.rsize)

    def eval(self, et: float, want_vel: bool = False):
        idx = int(np.clip(np.floor((et - self.init) / self.intlen), 0, self.nrec - 1))
        rec = self.recs[idx]
        mid, rad = rec[0], rec[1]
        s = (et - mid) / rad
        c = rec[2:].reshape(3, self.deg + 1)
        T = np.empty(self.deg + 1)
        T[0] = 1.0
        if self.deg >= 1:
            T[1] = s
        for k in range(2, self.deg + 1):
            T[k] = 2.0 * s * T[k - 1] - T[k - 2]
        pos = c @ T
        if not want_vel:
            return pos
        dT = np.zeros(self.deg + 1)
        if self.deg >= 1:
            dT[1] = 1.0
        for k in range(2, self.deg + 1):
            dT[k] = 2.0 * T[k - 1] + 2.0 * s * dT[k - 1] - dT[k - 2]
        return pos, (c @ dT) / rad


def _read_daf_segments(path: Path):
    raw = path.read_bytes()
    nd, ni = struct.unpack("<ii", raw[8:16])
    fward = struct.unpack("<i", raw[76:80])[0]
    arr = np.frombuffer(raw, dtype="<f8")
    ss = nd + (ni + 1) // 2
    segs = []
    rec_num = fward
    while rec_num > 0:
        rec = raw[(rec_num - 1) * 1024 : rec_num * 1024]
        nxt, _, nsum = struct.unpack("<ddd", rec[:24])
        for i in range(int(nsum)):
            s = rec[24 + i * ss * 8 : 24 + (i + 1) * ss * 8]
            dc = struct.unpack(f"<{nd}d", s[: nd * 8])
            ic = struct.unpack(f"<{ni}i", s[nd * 8 : nd * 8 + ni * 4])
            segs.append((dc, ic, _Type2Seg(arr, ic[-2], ic[-1])))
        rec_num = int(nxt)
    return segs


def _r1(a: float):
    c, s = np.cos(a), np.sin(a)
    return np.array([[1.0, 0.0, 0.0], [0.0, c, s], [0.0, -s, c]])

def _r2(a: float):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0.0, -s], [0.0, 1.0, 0.0], [s, 0.0, c]])

def _r3(a: float):
    c, s = np.cos(a), np.sin(a)
    return np.array([[c, s, 0.0], [-s, c, 0.0], [0.0, 0.0, 1.0]])


class _NativeSpiceFallback:
    """Fallback evaluator reading the exact NAIF SPK/BPC/LSK/FK kernels when cspice.dll is blocked by OS policy."""
    def __init__(self, files):
        by_suf = {p.suffix: p for p in files}
        tls_txt = by_suf[".tls"].read_text("utf8", "ignore")
        tf_txt = by_suf[".tf"].read_text("utf8", "ignore")
        # Parse leapseconds table from naif0012.tls
        self.delta_t_a = float(re.search(r"DELTET/DELTA_T_A\s*=\s*([0-9.+-DdEe]+)", tls_txt).group(1).replace("D", "E"))
        self.k = float(re.search(r"DELTET/K\s*=\s*([0-9.+-DdEe]+)", tls_txt).group(1).replace("D", "E"))
        self.eb = float(re.search(r"DELTET/EB\s*=\s*([0-9.+-DdEe]+)", tls_txt).group(1).replace("D", "E"))
        m_match = re.search(r"DELTET/M\s*=\s*\(\s*([0-9.+-DdEe]+)\s+([0-9.+-DdEe]+)\s*\)", tls_txt)
        self.m0 = float(m_match.group(1).replace("D", "E"))
        self.m1 = float(m_match.group(2).replace("D", "E"))
        at_block = re.search(r"DELTET/DELTA_AT\s*=\s*\((.*?)\)", tls_txt, re.S).group(1)
        months = {"JAN": 1, "FEB": 2, "MAR": 3, "APR": 4, "MAY": 5, "JUN": 6,
                  "JUL": 7, "AUG": 8, "SEP": 9, "OCT": 10, "NOV": 11, "DEC": 12}
        self.leaps = []
        for val_s, y_s, mon_s, d_s in re.findall(r"(\d+)\s*,\s*@(\d{4})-([A-Z]{3})-(\d+)", at_block):
            ts = datetime(int(y_s), months[mon_s], int(d_s), tzinfo=timezone.utc).timestamp()
            self.leaps.append((ts, float(val_s)))
        # Parse MOON_PA_DE440 -> MOON_ME_DE440_ME421 rotation from moon_de440_*.tf
        ang_m = re.search(r"TKFRAME_31009_ANGLES\s*=\s*\(\s*([0-9.+-]+)\s+([0-9.+-]+)\s+([0-9.+-]+)\s*\)", tf_txt)
        a3, a2, a1 = [np.radians(float(ang_m.group(i)) / 3600.0) for i in (1, 2, 3)]
        self.m_pa2me = (_r3(a3) @ _r2(a2) @ _r1(a1)).T
        # Load SPK and BPC segments
        spk_segs = {(ic[0], ic[1]): seg for _, ic, seg in _read_daf_segments(by_suf[".bsp"])}
        self.s_emb = spk_segs[(3, 0)]
        self.s_sun = spk_segs[(10, 0)]
        self.s_moon = spk_segs[(301, 3)]
        self.s_earth = spk_segs[(399, 3)]
        self.bpc_segs = [(dc[0], dc[1], seg) for dc, ic, seg in _read_daf_segments(by_suf[".bpc"]) if ic[0] == 31008]

    def utc_to_et(self, utc_iso: str) -> float:
        s = utc_iso.strip().replace(" UTC", "Z")
        if not s.endswith("Z") and "+" not in s:
            s += "Z"
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        ts = dt.timestamp()
        j2000_ts = datetime(2000, 1, 1, 12, 0, 0, tzinfo=timezone.utc).timestamp()
        utc_sec = ts - j2000_ts
        delta_at = 10.0
        for l_ts, val in self.leaps:
            if ts >= l_ts:
                delta_at = val
        tai = utc_sec + delta_at
        et_approx = tai + self.delta_t_a
        m = self.m0 + self.m1 * et_approx
        e_anom = m + self.eb * np.sin(m)
        return float(tai + self.delta_t_a + self.k * np.sin(e_anom))

    def _j2000_to_me(self, et: float) -> np.ndarray:
        seg = next((s for t0, t1, s in self.bpc_segs if t0 <= et <= t1), self.bpc_segs[0][2])
        phi, th, psi = seg.eval(et)
        return self.m_pa2me @ (_r3(psi) @ _r1(th) @ _r3(phi))

    def _ssb_pos_vel(self, body: str, et: float):
        if body == "MOON":
            p_e, v_e = self.s_emb.eval(et, want_vel=True)
            p_m, v_m = self.s_moon.eval(et, want_vel=True)
            return p_e + p_m, v_e + v_m
        if body == "EARTH":
            return self.s_emb.eval(et) + self.s_earth.eval(et), None
        if body == "SUN":
            return self.s_sun.eval(et), None
        raise ValueError(body)

    def spkpos_lt_s_moon_me(self, target: str, et: float) -> np.ndarray:
        r_obs, v_obs = self._ssb_pos_vel("MOON", et)
        lt = 0.0
        for _ in range(3):
            r_tgt, _ = self._ssb_pos_vel(target, et - lt)
            d = r_tgt - r_obs
            lt = float(np.linalg.norm(d)) / C_LIGHT_KM_S
        dist = float(np.linalg.norm(d))
        # Stellar aberration correction (LT+S)
        u = d / dist + v_obs / C_LIGHT_KM_S
        d_corr = (u / np.linalg.norm(u)) * dist
        return self._j2000_to_me(et) @ d_corr


def ensure_loaded():
    global _loaded, _fallback
    with _lock:
        if _loaded:
            return
        miss = missing_kernels()
        if miss:
            raise KernelsMissing(f"Missing SPICE kernels: {miss}. Run scripts/fetch_assets.py")
        files = kernel_files()
        if sp is not None:
            order = {".tls": 0, ".tpc": 1, ".tf": 2, ".bpc": 3, ".bsp": 4}
            for p in sorted(files, key=lambda p: order.get(p.suffix, 9)):
                if p.suffix in order:
                    sp.furnsh(str(p))
        else:
            _fallback = _NativeSpiceFallback(files)
        _loaded = True

def utc_to_et(utc_iso: str) -> float:
    ensure_loaded()
    clean = utc_iso.split("+")[0].rstrip("Z")
    if sp is not None:
        with _lock:
            return sp.str2et(clean.replace("T", " ") + " UTC")
    return _fallback.utc_to_et(clean)

@lru_cache(maxsize=4096)
def body_vectors(et: float):
    """Moon-centred positions (km) of Sun and Earth in MOON_ME, light-time + stellar aberration corrected."""
    ensure_loaded()
    if sp is not None:
        with _lock:
            sun, _ = sp.spkpos("SUN", et, "MOON_ME", "LT+S", "MOON")
            earth, _ = sp.spkpos("EARTH", et, "MOON_ME", "LT+S", "MOON")
    else:
        sun = _fallback.spkpos_lt_s_moon_me("SUN", et)
        earth = _fallback.spkpos_lt_s_moon_me("EARTH", et)
    return tuple(sun), tuple(earth)

def geometry(utc_iso: str, lat: float, lon: float):
    et = utc_to_et(utc_iso)
    sun, earth = (np.array(v) for v in body_vectors(et))
    return {
        "et_tdb_s": et,
        "sun_dir_moon_me": (sun / np.linalg.norm(sun)).tolist(),
        "earth_dir_moon_me": (earth / np.linalg.norm(earth)).tolist(),
        "sun": elevation_azimuth(sun, lat, lon),
        "earth": elevation_azimuth(earth, lat, lon),
        "axis": axis_direction(lat, lon),
    }


@lru_cache(maxsize=32)
def vectors_series(start_utc: str, hours: float, step_min: float):
    """Sun/Earth Moon-centred MOON_ME positions (km) at regular steps. Offsets are added to the start ET;
    valid because no leap second is expected inside a window (documented limitation)."""
    ensure_loaded()
    et0 = utc_to_et(start_utc)
    n = int(round(hours * 60 / step_min)) + 1
    t = np.arange(n) * step_min * 60.0
    sun = np.empty((n, 3)); earth = np.empty((n, 3))
    if sp is not None:
        with _lock:
            for i, dt in enumerate(t):
                sun[i], _ = sp.spkpos("SUN", et0 + dt, "MOON_ME", "LT+S", "MOON")
                earth[i], _ = sp.spkpos("EARTH", et0 + dt, "MOON_ME", "LT+S", "MOON")
    else:
        for i, dt in enumerate(t):
            sun[i] = _fallback.spkpos_lt_s_moon_me("SUN", et0 + dt)
            earth[i] = _fallback.spkpos_lt_s_moon_me("EARTH", et0 + dt)
    return t, sun, earth
