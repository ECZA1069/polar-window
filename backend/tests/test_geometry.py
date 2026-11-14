import numpy as np, pytest
from app.geometry import elevation_azimuth, enu_basis, MOON_RADIUS_KM
from app import spice_service as ss

def test_zenith_target():
    t = enu_basis(-89.5, 30)[2] * 384400
    assert elevation_azimuth(t, -89.5, 30)["elevation_deg"] > 89.9

def test_target_below_horizon():
    t = -enu_basis(10, 20)[2] * 1e6
    assert elevation_azimuth(t, 10, 20)["elevation_deg"] < -80

def test_azimuth_east_north():
    e, n, u = enu_basis(0, 0)
    base = u * MOON_RADIUS_KM
    assert abs(elevation_azimuth(base + n * 1000 + u, 0, 0)["azimuth_deg"]) < 1e-6
    assert abs(elevation_azimuth(base + e * 1000 + u, 0, 0)["azimuth_deg"] - 90) < 1e-6

needs_kernels = pytest.mark.skipif(bool(ss.missing_kernels()), reason="SPICE kernels not downloaded")

@needs_kernels
def test_sun_distance_and_low_polar_elevation():
    g = ss.geometry("2026-11-08T12:00:00Z", -89.5, 0)
    assert 0.98 < g["sun"]["range_km"] / 149597870.7 < 1.02
    # Lunar spin axis is ~1.54 deg from the ecliptic normal, so near 89.5S the Sun stays within a few degrees of the horizon
    assert abs(g["sun"]["elevation_deg"]) < 3.0

@needs_kernels
def test_unit_vectors():
    g = ss.geometry("2026-11-08T12:00:00Z", -89.5, 0)
    assert abs(np.linalg.norm(g["sun_dir_moon_me"]) - 1) < 1e-9

# ---- analysis tests (no SPICE needed) ----
from app import analysis as an

def _fake(n=400, days=2.0):
    t = np.linspace(0, days * 86400, n)
    ang = 2 * np.pi * t / (27.32 * 86400) * 5          # fast fake rotation so crossings occur
    sun = 1.496e8 * np.stack([np.cos(ang), np.sin(ang), 0 * ang], axis=1)
    earth = 384400 * np.stack([np.cos(ang + 1), np.sin(ang + 1), 0 * ang], axis=1)
    return t, sun, earth

def test_intervals_crossings():
    t = np.array([0, 10, 20, 30.0]); v = np.array([-1, 1, 1, -1.0])
    iv = an.intervals(t, v)
    assert len(iv) == 1 and abs(iv[0]["start"] - 5) < 1e-9 and abs(iv[0]["end"] - 25) < 1e-9

def test_power_formula_zenith():
    # Sun at zenith of an equatorial site, flat panel: P = S*A*eff*(1-loss)
    sun = {"el": np.array([90.0]), "range": np.array([an.AU_KM]), "enu": np.array([[0, 0, 1.0]])}
    out = an.power_sim(sun, np.array([0.27]), 600, dict(area_m2=2, efficiency=0.3, losses_pct=10, tilt_deg=0))
    assert abs(out["gen"][0] - 1361 * 2 * 0.3 * 0.9) < 1e-6

def test_power_zero_when_sun_below():
    sun = {"el": np.array([-20.0]), "range": np.array([an.AU_KM]), "enu": np.array([[0, 0, -0.34]])}
    assert an.power_sim(sun, np.array([0.27]), 600, None)["gen"][0] == 0

def test_battery_bounds_and_analyze():
    t, s, e = _fake()
    a = an.analyze(t, s, e, 0.0, 0.0, dict(battery_wh=500, load_w=50))
    soc = a["power"]["soc"]
    assert soc.min() >= 0 and soc.max() <= 500
    assert 0 <= a["stats"]["sunlit_pct"] <= 100
