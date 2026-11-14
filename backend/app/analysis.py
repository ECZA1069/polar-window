"""Pure-numpy analysis (no SPICE): elevation series, visibility intervals, solar power and battery estimates.
All geometry is relative to the spherical geometric horizon; terrain is NOT modelled.
Constants: total solar irradiance 1361 W/m2 at 1 AU (standard value, an assumption here, not a NASA measurement
taken at the site); solar radius 695,700 km."""
import numpy as np
from .geometry import enu_basis, site_vector

AU_KM = 149597870.7
TSI_1AU = 1361.0
SUN_R_KM = 695700.0

def ea_series(vecs, lat, lon):
    e, n, u = enu_basis(lat, lon)
    d = np.asarray(vecs, float) - site_vector(lat, lon)
    rng = np.maximum(np.linalg.norm(d, axis=1), 1e-3)
    dn = d / rng[:, None]
    enu = np.stack([dn @ e, dn @ n, dn @ u], axis=1)
    el = np.degrees(np.arcsin(np.clip(enu[:, 2], -1, 1)))
    az = np.degrees(np.arctan2(enu[:, 0], enu[:, 1])) % 360.0
    return {"el": np.nan_to_num(el), "az": np.nan_to_num(az), "range": np.nan_to_num(rng, nan=384400.0), "enu": np.nan_to_num(enu)}

def intervals(t, v):
    """Intervals where v > 0, with linear-interpolated crossings. Times in the units of t."""
    t = np.asarray(t, float); v = np.nan_to_num(np.asarray(v, float))
    pos = v > 0
    def cross(a, b):
        denom = float(v[b] - v[a])
        if abs(denom) < 1e-12:
            return float(t[a])
        return float(t[a] + (0 - v[a]) / denom * (t[b] - t[a]))
    out, start, cs = [], None, False
    for k in range(len(t)):
        if pos[k] and start is None:
            start, cs = (float(t[0]), True) if k == 0 else (cross(k - 1, k), False)
        elif (not pos[k]) and start is not None:
            out.append({"start": start, "end": cross(k - 1, k), "clipped_start": cs, "clipped_end": False}); start = None
    if start is not None:
        out.append({"start": start, "end": float(t[-1]), "clipped_start": cs, "clipped_end": True})
    return out

def longest(iv):
    return max((i["end"] - i["start"] for i in iv), default=0.0)

DEFAULT_PANEL = dict(area_m2=10.0, efficiency=0.28, tilt_deg=0.0, azimuth_deg=0.0,
                     losses_pct=15.0, battery_wh=2000.0, load_w=100.0, initial_soc_pct=50.0)

def power_sim(sun, sun_rad_deg, step_s, panel):
    p = {**DEFAULT_PANEL, **(panel or {})}
    irr = TSI_1AU * (AU_KM / sun["range"]) ** 2
    rad = np.maximum(sun_rad_deg, 1e-6)
    frac = np.clip((sun["el"] + rad) / (2 * rad), 0, 1)   # fraction of solar disc above the geometric horizon
    th, ph = np.radians(p["tilt_deg"]), np.radians(p["azimuth_deg"])
    normal = np.array([np.sin(th) * np.sin(ph), np.sin(th) * np.cos(ph), np.cos(th)])  # E, N, U
    cosi = np.clip(sun["enu"] @ normal, 0, None)
    gen = irr * frac * p["area_m2"] * p["efficiency"] * (1 - p["losses_pct"] / 100) * cosi
    dt_h = step_s / 3600.0
    cap = p["battery_wh"]; soc = cap * p["initial_soc_pct"] / 100.0
    socs, unmet = [], 0
    for g in gen:
        soc = min(cap, max(0.0, soc + (g - p["load_w"]) * dt_h))
        if soc <= 0 and g < p["load_w"]:
            unmet += 1
        socs.append(soc)
    socs = np.array(socs)
    return {"gen": gen, "irr": irr * frac, "cosi": cosi, "soc": socs, "panel": p,
            "summary": {"energy_generated_wh": float(gen.sum() * dt_h), "energy_load_wh": float(p["load_w"] * len(gen) * dt_h),
                        "mean_power_w": float(gen.mean()), "peak_power_w": float(gen.max()),
                        "min_battery_pct": float(100 * socs.min() / cap) if cap > 0 else None,
                        "hours_load_unmet": float(unmet * dt_h)}}

def analyze(t_s, sun_v, earth_v, lat, lon, panel=None):
    t_s = np.asarray(t_s, float)
    sun, earth = ea_series(sun_v, lat, lon), ea_series(earth_v, lat, lon)
    rad = np.degrees(np.arcsin(SUN_R_KM / sun["range"]))
    lit_v = sun["el"] + rad                      # >0: some part of the Sun above the geometric horizon
    sunlit = intervals(t_s, lit_v)
    dark = intervals(t_s, -lit_v)
    comm = intervals(t_s, earth["el"])           # Earth centre above geometric horizon
    step = float(t_s[1] - t_s[0]) if len(t_s) > 1 else 3600.0
    pw = power_sim(sun, rad, step, panel)
    span = float(t_s[-1] - t_s[0]) or 1.0
    stats = {
        "sunlit_pct": float(100 * np.mean(lit_v > 0)),
        "longest_sunlit_h": longest(sunlit) / 3600, "longest_dark_h": longest(dark) / 3600,
        "earth_visible_pct": float(100 * np.mean(earth["el"] > 0)),
        "longest_earth_window_h": longest(comm) / 3600, "earth_window_count": len(comm),
        "span_h": span / 3600,
    }
    return {"sun": sun, "earth": earth, "sun_rad": rad, "sunlit": sunlit, "dark": dark, "comm": comm,
            "power": pw, "stats": stats}
