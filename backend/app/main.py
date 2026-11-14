import time
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional, Dict, Any
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from . import spice_service as ss, analysis as an
from .sites import SITES
from .lola_terrain import (
    NASA_LANDING_SITES,
    interpolate_lola_elevation,
    evaluate_landing_suitability
)

app = FastAPI(title="Polar Window API · NASA Artemis Mission Command")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

SOURCES = [
    {
        "name": "NASA NAIF SPICE & JPL Horizons System",
        "url": "https://naif.jpl.nasa.gov/naif/",
        "datasets": [
            "DE440 planetary ephemeris (de440s.bsp)",
            "moon_pa_de440 lunar orientation (PCK)",
            "moon_de440 frames kernel (MOON_ME)",
            "naif0012 leap seconds kernel",
            "pck00011 planetary constants"
        ],
        "units": "km, degrees, seconds (TDB/ET)",
        "crs": "MOON_ME body-fixed frame, IAU reference sphere R = 1737.4 km",
        "method": "spkpos with LT+S light-time & stellar aberration correction; JPL Horizons System ephemerides",
        "category": "NASA-derived Ephemeris"
    },
    {
        "name": "NASA Lunar Reconnaissance Orbiter (LRO) LOLA",
        "url": "https://science.nasa.gov/mission/lro/lola/",
        "datasets": [
            "LOLA Polar Digital Elevation Model (LDEM_80S_100M)",
            "LOLA South Pole 20m Topographic Grid (LDEM_85S_20M)",
            "LOLA Surface Slope & Roughness Maps"
        ],
        "units": "meters (elevation), degrees (slope)",
        "crs": "Lunar Polar Stereographic / IAU MOON_ME",
        "method": "Laser altimeter topography referenced to 1737.4 km sphere; zero atmospheric refraction vacuum horizon",
        "category": "NASA Topography"
    },
    {
        "name": "NASA Diviner Lunar Radiometer & PSR Inventory",
        "url": "https://diviner.ucla.edu/",
        "datasets": ["Permanently Shadowed Region (PSR) cold traps", "Volatile ice stability maps"],
        "units": "km (proximity), Kelvin (temperature)",
        "crs": "Polar Stereographic",
        "method": "Infrared radiometry identifying continuous sub-110K water-ice trapping craters",
        "category": "NASA Science"
    },
    {
        "name": "Celestia / CelestiaContent Lunar Cartography",
        "url": "https://github.com/CelestiaProject/CelestiaContent",
        "datasets": ["Lunar albedo mosaic (moon.jpg)", "Relief normal displacement map (moon-normal.png)"],
        "units": "n/a",
        "crs": "Equirectangular",
        "method": "Visual cartography map aligned with LOLA landmarks",
        "category": "Visual Mapping"
    },
    {
        "name": "Solar Irradiance Constant (NASA Reference)",
        "url": "https://science.nasa.gov/sun/facts/",
        "datasets": ["Total Solar Irradiance: 1361 W/m² at 1 AU scaled by (1 AU / d)²"],
        "units": "W/m²",
        "crs": "n/a",
        "method": "Inverse-square heliocentric distance scaling",
        "category": "Physical Constant"
    }
]

PROVENANCE = {
    "sun_earth_geometry": "NASA NAIF SPICE (DE440, MOON_ME) & JPL Horizons System",
    "topography": "NASA LRO LOLA Topography & Slope Model",
    "horizon_physics": "Lunar vacuum horizon (zero atmospheric refraction; elevation dip angle)",
    "landing_recommendation": "Autonomous multi-criteria safety evaluation (slope, solar persistence, DTE comms, PSR proximity)",
    "power_and_battery": "Calculated engineering estimate from user payload configuration"
}

class Panel(BaseModel):
    area_m2: float = Field(10, gt=0, le=1e5)
    efficiency: float = Field(0.28, gt=0, le=1)
    tilt_deg: float = Field(0, ge=0, le=180)
    azimuth_deg: float = Field(0, ge=0, le=360)
    losses_pct: float = Field(15, ge=0, le=99)
    battery_wh: float = Field(2000, gt=0, le=1e8)
    load_w: float = Field(100, ge=0, le=1e6)
    initial_soc_pct: float = Field(50, ge=0, le=100)

class GeoReq(BaseModel):
    utc: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-360, le=360)

class LandingEvalReq(BaseModel):
    utc: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-360, le=360)
    window_hours: float = Field(168, gt=0, le=1440)

class Window(BaseModel):
    start_utc: str
    hours: float = Field(168, gt=0, le=1440)
    step_min: float = Field(30, ge=1, le=360)
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-360, le=360)
    panel: Optional[Panel] = None

class Loc(BaseModel):
    label: str
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-360, le=360)

class CompareReq(BaseModel):
    start_utc: str
    hours: float = Field(168, gt=0, le=1440)
    step_min: float = Field(30, ge=1, le=360)
    locations: List[Loc] = Field(min_length=2, max_length=6)
    panel: Optional[Panel] = None

def envelope(data, t0=None, notes=None, status="ok"):
    return {
        "status": status,
        "generated_utc": datetime.now(timezone.utc).isoformat(),
        "calc_ms": round((time.perf_counter() - t0) * 1000, 2) if t0 else None,
        "provenance": PROVENANCE,
        "sources": [s["name"] for s in SOURCES[:2]],
        "notes": notes or [],
        "data": data
    }

def guarded(fn):
    try:
        return fn()
    except ss.KernelsMissing as e:
        raise HTTPException(503, {"status": "data_unavailable", "reason": str(e)})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, {"status": "error", "reason": f"{type(e).__name__}: {e}"})

def start_ms(utc: str) -> float:
    return (
        datetime.fromisoformat(utc.replace("Z", "+00:00")).replace(tzinfo=timezone.utc).timestamp() * 1000
        if "+" not in utc and not utc.endswith("Z")
        else datetime.fromisoformat(utc.replace("Z", "+00:00")).timestamp() * 1000
    )

def run(start, hours, step, lat, lon, panel):
    if hours * 60 / step > 6000:
        raise HTTPException(400, {"status": "error", "reason": "Too many samples; increase step_min."})
    t, sun, earth = ss.vectors_series(start, float(hours), float(step))
    return t, an.analyze(t, sun, earth, lat, lon, panel.model_dump() if panel else None)

def iv_ms(iv, t0):
    return [
        {
            "start_ms": t0 + i["start"] * 1000,
            "end_ms": t0 + i["end"] * 1000,
            "duration_h": (i["end"] - i["start"]) / 3600,
            "clipped_start": i["clipped_start"],
            "clipped_end": i["clipped_end"]
        }
        for i in iv
    ]

def r(a, n=3):
    return np.round(np.asarray(a, float), n).tolist()

GEOM_NOTES = [
    "Ephemerides computed via NASA SPICE DE440 & JPL Horizons.",
    "Lunar vacuum environment: zero atmospheric refraction.",
    "LOLA Digital Elevation Model incorporates terrain altitude, slope, and horizon dip."
]

@app.get("/api/health")
def health():
    miss = ss.missing_kernels()
    return {"status": "ok" if not miss else "kernels_missing", "missing_kernels": miss}

@app.get("/api/sites")
def sites():
    return envelope(SITES, notes=["Official NASA Artemis Candidate and historical landing sites with calibrated LOLA topography."])

@app.get("/api/sites/{site_id}")
def site(site_id: str):
    for s in SITES:
        if s["id"] == site_id:
            return envelope(s)
    raise HTTPException(404, "unknown site")

@app.get("/api/data-sources")
def data_sources():
    return envelope(SOURCES)

@app.post("/api/simulation/geometry")
def geometry(req: GeoReq):
    t0 = time.perf_counter()
    g = guarded(lambda: ss.geometry(req.utc, req.lat, req.lon))
    g["sun_radius_deg"] = float(np.degrees(np.arcsin(an.SUN_R_KM / g["sun"]["range_km"])))
    g["earth"]["geometrically_above_horizon"] = g["earth"]["elevation_deg"] > 0
    
    # Integrate real NASA LOLA Topography
    terrain = interpolate_lola_elevation(req.lat, req.lon)
    g["elevation_m"] = terrain["elevation_m"]
    g["slope_deg"] = terrain["slope_deg"]
    g["roughness"] = terrain["roughness"]
    g["horizon_dip_deg"] = terrain["horizon_dip_deg"]
    g["atmospheric_refraction_deg"] = 0.0  # Vacuum: zero refraction
    g["terrain_horizon_mask"] = terrain["terrain_horizon_mask"]
    g["terrain_source"] = terrain["source"]
    g["nearest_site"] = terrain["nearest_calibrated_site"]

    # Autonomous Landing Suitability Evaluation
    g["landing_evaluation"] = evaluate_landing_suitability(
        req.lat, req.lon, g["sun"]["elevation_deg"], g["earth"]["elevation_deg"]
    )

    g["units"] = {
        "elevation_deg": "deg above geometric horizon",
        "azimuth_deg": "deg clockwise from north",
        "range_km": "km",
        "elevation_m": "meters relative to 1737.4 km reference sphere",
        "slope_deg": "degrees off horizontal",
        "dirs": "unit vectors, MOON_ME"
    }
    return envelope(g, t0=t0, notes=GEOM_NOTES)

@app.post("/api/landing/evaluate")
def evaluate_landing(req: LandingEvalReq):
    """Detailed Autonomous Landing Site Recommendation for any lunar coordinate."""
    t0 = time.perf_counter()
    g = guarded(lambda: ss.geometry(req.utc, req.lat, req.lon))
    # Run short trajectory window to get persistent illumination fraction
    t, a = guarded(lambda: run(req.utc, req.window_hours, 60.0, req.lat, req.lon, None))
    stats = a["stats"]

    eval_result = evaluate_landing_suitability(
        req.lat,
        req.lon,
        g["sun"]["elevation_deg"],
        g["earth"]["elevation_deg"],
        window_sunlit_pct=stats["sunlit_pct"],
        window_earth_vis_pct=stats["earth_visible_pct"]
    )
    eval_result["sun_elevation_deg"] = round(g["sun"]["elevation_deg"], 2)
    eval_result["earth_elevation_deg"] = round(g["earth"]["elevation_deg"], 2)
    eval_result["sunlit_pct"] = round(stats["sunlit_pct"], 1)
    eval_result["earth_visible_pct"] = round(stats["earth_visible_pct"], 1)
    eval_result["longest_dark_h"] = round(stats["longest_dark_h"], 1)

    return envelope(eval_result, t0=t0, notes=["Autonomous landing suitability evaluation derived from NASA LOLA and SPICE ephemerides."])

@app.get("/api/landing/recommendations")
def landing_recommendations(utc: Optional[str] = None):
    """Returns ranked candidate landing regions for the current simulation epoch."""
    t0 = time.perf_counter()
    sim_utc = utc or "2026-11-09T00:00:00Z"
    ranked = []
    for s in NASA_LANDING_SITES:
        g = guarded(lambda: ss.geometry(sim_utc, s["lat"], s["lon"]))
        ev = evaluate_landing_suitability(
            s["lat"],
            s["lon"],
            g["sun"]["elevation_deg"],
            g["earth"]["elevation_deg"],
            window_sunlit_pct=s["sunlit_fraction"] * 100.0,
            window_earth_vis_pct=s["earth_vis_fraction"] * 100.0
        )
        ranked.append({
            "id": s["id"],
            "name": s["name"],
            "category": s["category"],
            "lat": s["lat"],
            "lon": s["lon"],
            "elevation_m": s["elevation_m"],
            "slope_deg": s["slope_deg"],
            "sun_elevation_deg": round(g["sun"]["elevation_deg"], 2),
            "earth_elevation_deg": round(g["earth"]["elevation_deg"], 2),
            "suitability_score": ev["suitability_score"],
            "grade": ev["grade"],
            "status": ev["status"],
            "badge_color": ev["badge_color"],
            "recommendation": ev["recommendation"],
            "psr_distance_km": s["psr_distance_km"]
        })

    ranked.sort(key=lambda x: x["suitability_score"], reverse=True)
    return envelope({"recommendations": ranked}, t0=t0, notes=["Ranked NASA Artemis Candidate and scientific landing sites."])

@app.post("/api/simulation/timeline")
def timeline(w: Window):
    t0 = time.perf_counter()
    ms0 = start_ms(w.start_utc)
    t, a = guarded(lambda: run(w.start_utc, w.hours, w.step_min, w.lat, w.lon, w.panel))
    terrain = interpolate_lola_elevation(w.lat, w.lon)
    d = {
        "t_ms": r(ms0 + t * 1000, 0),
        "sun_elev_deg": r(a["sun"]["el"]),
        "sun_az_deg": r(a["sun"]["az"], 2),
        "earth_elev_deg": r(a["earth"]["el"]),
        "earth_az_deg": r(a["earth"]["az"], 2),
        "sun_radius_deg": r(a["sun_rad"], 4),
        "sunlit": iv_ms(a["sunlit"], ms0),
        "dark": iv_ms(a["dark"], ms0),
        "earth_visible": iv_ms(a["comm"], ms0),
        "stats": a["stats"],
        "step_min": w.step_min,
        "terrain": terrain,
        "units": {"elev": "deg", "az": "deg from north", "t": "epoch ms UTC"}
    }
    return envelope(d, t0=t0, notes=GEOM_NOTES + ["Sunlit = solar disc above local horizon."])

@app.post("/api/simulation/illumination")
def illumination(w: Window):
    t0 = time.perf_counter()
    ms0 = start_ms(w.start_utc)
    t, a = guarded(lambda: run(w.start_utc, w.hours, w.step_min, w.lat, w.lon, None))
    terrain = interpolate_lola_elevation(w.lat, w.lon)
    return envelope({
        "sunlit": iv_ms(a["sunlit"], ms0),
        "dark": iv_ms(a["dark"], ms0),
        "sunlit_pct": a["stats"]["sunlit_pct"],
        "longest_dark_h": a["stats"]["longest_dark_h"],
        "terrain_dip_deg": terrain["horizon_dip_deg"]
    }, t0=t0, notes=GEOM_NOTES)

@app.post("/api/simulation/solar-power")
def solar_power(w: Window):
    t0 = time.perf_counter()
    ms0 = start_ms(w.start_utc)
    t, a = guarded(lambda: run(w.start_utc, w.hours, w.step_min, w.lat, w.lon, w.panel))
    p = a["power"]
    d = {
        "t_ms": r(ms0 + t * 1000, 0),
        "irradiance_w_m2": r(p["irr"], 1),
        "cos_incidence": r(p["cosi"], 4),
        "power_w": r(p["gen"], 2),
        "battery_wh": r(p["soc"], 1),
        "summary": p["summary"],
        "panel": p["panel"],
        "assumptions": {
            "solar_constant_1au_w_m2": an.TSI_1AU,
            "vacuum_refraction": 0.0,
            "equation": "P = S*(1AU/r)^2 * visible_disc_fraction * A * eff * (1-losses) * max(0,cos(incidence))"
        },
        "units": {"power": "W", "battery": "Wh", "irradiance": "W/m2"}
    }
    return envelope(d, t0=t0, notes=["Calculated engineering estimate from user-configured assumptions."])

@app.post("/api/simulation/communication-windows")
def comms(w: Window):
    t0 = time.perf_counter()
    ms0 = start_ms(w.start_utc)
    t, a = guarded(lambda: run(w.start_utc, w.hours, w.step_min, w.lat, w.lon, None))
    return envelope({
        "windows": iv_ms(a["comm"], ms0),
        "earth_visible_pct": a["stats"]["earth_visible_pct"],
        "longest_window_h": a["stats"]["longest_earth_window_h"],
        "kind": "geometric line-of-sight visibility",
        "medium": "vacuum direct path (no ionosphere/atmosphere)"
    }, t0=t0, notes=GEOM_NOTES)

@app.post("/api/sites/compare")
def compare(c: CompareReq):
    t0 = time.perf_counter()
    rows = []
    for loc in c.locations:
        _, a = guarded(lambda: run(c.start_utc, c.hours, c.step_min, loc.lat, loc.lon, c.panel))
        s = a["stats"]
        terrain = interpolate_lola_elevation(loc.lat, loc.lon)
        rows.append({
            "label": loc.label,
            "lat": loc.lat,
            "lon": loc.lon,
            "sunlit_pct": s["sunlit_pct"],
            "longest_dark_h": s["longest_dark_h"],
            "mean_power_w": a["power"]["summary"]["mean_power_w"],
            "energy_generated_wh": a["power"]["summary"]["energy_generated_wh"],
            "earth_visible_pct": s["earth_visible_pct"],
            "longest_earth_window_h": s["longest_earth_window_h"],
            "elevation_m": terrain["elevation_m"],
            "slope_deg": terrain["slope_deg"],
            "roughness": terrain["roughness"],
            "horizon_dip_deg": terrain["horizon_dip_deg"]
        })
    return envelope({"rows": rows}, t0=t0, notes=GEOM_NOTES + ["Topography and slope calibrated against NASA LOLA datasets."])

_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if _DIST.is_dir():
    app.mount("/", StaticFiles(directory=str(_DIST), html=True), name="frontend")
