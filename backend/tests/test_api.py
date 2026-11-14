import pytest
from app.main import app

def test_routes_registered():
    routes = [r.path for r in app.routes]
    assert "/api/health" in routes
    assert "/api/sites" in routes
    assert "/api/simulation/geometry" in routes
    assert "/api/simulation/timeline" in routes
    assert "/api/simulation/solar-power" in routes
    assert "/api/simulation/communication-windows" in routes
    assert "/api/sites/compare" in routes
    assert "" in routes or "/" in routes

def test_lola_terrain_and_landing_eval():
    from app.lola_terrain import interpolate_lola_elevation, evaluate_landing_suitability
    t = interpolate_lola_elevation(-89.44, 222.5)
    assert "elevation_m" in t and "slope_deg" in t
    assert t["elevation_m"] > 0 # High polar ridge
    ev = evaluate_landing_suitability(-89.44, 222.5, 2.0, 5.0)
    assert "suitability_score" in ev and ev["suitability_score"] > 70
    assert ev["status"] in ["RECOMMENDED", "ACCEPTABLE"]
