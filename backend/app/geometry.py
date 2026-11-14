"""Pure-math geometry helpers (no SPICE). Conventions:
- Frame: MOON_ME (mean-Earth/polar-axis body-fixed). +X toward lat 0/lon 0, +Z toward north pole, +Y toward lon +90E.
- Longitude is east-positive; latitude is planetocentric on the reference sphere.
- Site radius uses the IAU lunar reference sphere (1737.4 km). Terrain height is NOT included yet.
- Azimuth: degrees clockwise from local north. Elevation: degrees above the geometric (spherical) horizon.
"""
import numpy as np

MOON_RADIUS_KM = 1737.4

def enu_basis(lat_deg: float, lon_deg: float):
    lat, lon = np.radians(lat_deg), np.radians(lon_deg)
    east = np.array([-np.sin(lon), np.cos(lon), 0.0])
    north = np.array([-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)])
    up = np.array([np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)])
    return east, north, up

def site_vector(lat_deg: float, lon_deg: float, radius_km: float = MOON_RADIUS_KM) -> np.ndarray:
    return radius_km * enu_basis(lat_deg, lon_deg)[2]

def elevation_azimuth(target_bf_km, lat_deg, lon_deg, radius_km: float = MOON_RADIUS_KM):
    """Elevation/azimuth of a body whose Moon-centre body-fixed position is target_bf_km."""
    e, n, u = enu_basis(lat_deg, lon_deg)
    d = np.asarray(target_bf_km, dtype=float) - site_vector(lat_deg, lon_deg, radius_km)
    rng = float(np.linalg.norm(d))
    d = d / rng
    elev = float(np.degrees(np.arcsin(np.clip(d @ u, -1, 1))))
    az = float(np.degrees(np.arctan2(d @ e, d @ n)) % 360.0)
    return {"elevation_deg": elev, "azimuth_deg": az, "range_km": rng}

def axis_direction(lat_deg, lon_deg):
    """Elevation/azimuth of the lunar spin-axis ends as seen at a site (directions, so parallax-free)."""
    e, n, u = enu_basis(lat_deg, lon_deg)
    out = {}
    for name, v in (("north", np.array([0, 0, 1.0])), ("south", np.array([0, 0, -1.0]))):
        out[name] = {"elevation_deg": float(np.degrees(np.arcsin(np.clip(v @ u, -1, 1)))),
                     "azimuth_deg": float(np.degrees(np.arctan2(v @ e, v @ n)) % 360.0)}
    return out
