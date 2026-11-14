# NASA Artemis Candidate Landing Regions & Real Planetary Landing Sites
# Derived from NASA LRO LOLA, Diviner, and LROC PDS datasets
from .lola_terrain import NASA_LANDING_SITES

SITES = []
for s in NASA_LANDING_SITES:
    entry = {**s}
    entry["elevation_status"] = f"LOLA DEM: {s['elevation_m']:+.0f} m, slope: {s['slope_deg']:.1f}°"
    SITES.append(entry)
