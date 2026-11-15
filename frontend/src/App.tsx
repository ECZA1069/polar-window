import { useState, useMemo } from "react";
import MoonView from "./Moon";
import HorizonDome from "./HorizonDome";
import LandingPage from "./LandingPage";
import { TimelinePanel, PowerPanel, CommsPanel, ComparePanel, LandingPanel } from "./Panels";
import { useSim, Tab, Layers, PanelParams } from "./store";
import { useAnalysis, useBackendHealth, useGeometry, useLandingRecommendations } from "./api";

const fmt = (n?: number, d = 2) => (n === undefined ? "–" : n.toFixed(d));
const toInput = (ms: number) => new Date(ms).toISOString().slice(0, 19);

/* Lunar Lander / Solar Payload Blueprint Schematic (Mirroring the reference screenshot's spacecraft diagram) */
function LanderSchematic() {
  const panel = useSim((s) => s.panel);
  return (
    <div style={{ position: "relative", width: "100%", padding: "10px 0 6px", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <svg viewBox="0 0 260 160" style={{ width: "100%", maxHeight: "150px" }} fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="blueprintPanel" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0, 240, 255, 0.25)" />
            <stop offset="50%" stopColor="rgba(56, 189, 248, 0.45)" />
            <stop offset="100%" stopColor="rgba(0, 240, 255, 0.25)" />
          </linearGradient>
          <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(30, 41, 59, 0.9)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0.95)" />
          </linearGradient>
        </defs>

        {/* Technical Grid Accent Lines */}
        <line x1="10" y1="80" x2="250" y2="80" stroke="rgba(56, 189, 248, 0.15)" strokeDasharray="3 3" />
        <line x1="130" y1="10" x2="130" y2="150" stroke="rgba(56, 189, 248, 0.15)" strokeDasharray="3 3" />

        {/* High-Gain Antenna on Top */}
        <path d="M130 36 L130 18" stroke="var(--cyan)" strokeWidth="1.5" />
        <path d="M120 18 Q130 10 140 18" stroke="var(--cyan)" strokeWidth="1.8" fill="none" />
        <circle cx="130" cy="14" r="2.5" fill="var(--cyan)" />

        {/* Central Ascent Stage / Cabin */}
        <polygon points="112 36, 148 36, 154 58, 106 58" fill="url(#bodyGrad)" stroke="var(--cyan)" strokeWidth="1.4" />
        {/* Cabin Viewport Window */}
        <rect x="122" y="42" width="16" height="7" rx="1.5" fill="rgba(0, 240, 255, 0.3)" stroke="var(--cyan)" strokeWidth="0.8" />

        {/* Descent Stage Octagonal Chassis */}
        <polygon points="102 58, 158 58, 166 94, 94 94" fill="url(#bodyGrad)" stroke="var(--blue)" strokeWidth="1.5" />
        {/* Core Avionics Detail */}
        <rect x="115" y="66" width="30" height="20" rx="2" fill="rgba(6, 14, 28, 0.8)" stroke="rgba(56, 189, 248, 0.4)" strokeWidth="1" />
        <circle cx="130" cy="76" r="4" fill="rgba(251, 191, 36, 0.8)" />

        {/* Left Deployable Solar Wing */}
        <g>
          <line x1="102" y1="68" x2="40" y2="68" stroke="var(--cyan)" strokeWidth="1.5" />
          <line x1="102" y1="84" x2="40" y2="84" stroke="var(--cyan)" strokeWidth="1.5" />
          <rect x="36" y="56" width="56" height="40" rx="2" fill="url(#blueprintPanel)" stroke="var(--cyan)" strokeWidth="1.4" />
          {/* Solar cell divisions */}
          <line x1="50" y1="56" x2="50" y2="96" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
          <line x1="64" y1="56" x2="64" y2="96" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
          <line x1="78" y1="56" x2="78" y2="96" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
          <line x1="36" y1="76" x2="92" y2="76" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
        </g>

        {/* Right Deployable Solar Wing */}
        <g>
          <line x1="158" y1="68" x2="220" y2="68" stroke="var(--cyan)" strokeWidth="1.5" />
          <line x1="158" y1="84" x2="220" y2="84" stroke="var(--cyan)" strokeWidth="1.5" />
          <rect x="168" y="56" width="56" height="40" rx="2" fill="url(#blueprintPanel)" stroke="var(--cyan)" strokeWidth="1.4" />
          {/* Solar cell divisions */}
          <line x1="182" y1="56" x2="182" y2="96" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
          <line x1="196" y1="56" x2="196" y2="96" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
          <line x1="210" y1="56" x2="210" y2="96" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
          <line x1="168" y1="76" x2="224" y2="76" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="0.8" />
        </g>

        {/* Descent Engine Bell */}
        <polygon points="120 94, 140 94, 146 114, 114 114" fill="rgba(15, 23, 42, 0.9)" stroke="var(--cyan)" strokeWidth="1.2" />

        {/* 4 Articulated Landing Struts & Footpads */}
        {/* Left Struts */}
        <line x1="96" y1="88" x2="55" y2="136" stroke="var(--cyan)" strokeWidth="1.6" />
        <line x1="108" y1="94" x2="68" y2="136" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1.2" />
        <line x1="48" y1="136" x2="72" y2="136" stroke="var(--cyan)" strokeWidth="2.5" />

        {/* Right Struts */}
        <line x1="164" y1="88" x2="205" y2="136" stroke="var(--cyan)" strokeWidth="1.6" />
        <line x1="152" y1="94" x2="192" y2="136" stroke="rgba(56, 189, 248, 0.7)" strokeWidth="1.2" />
        <line x1="188" y1="136" x2="212" y2="136" stroke="var(--cyan)" strokeWidth="2.5" />

        {/* Schematic Callouts (Monospace) */}
        <text x="36" y="50" fill="var(--cyan)" fontSize="7.5" fontFamily="var(--font-mono)" letterSpacing="0.08em">
          PV WING {panel.area_m2} M²
        </text>
        <text x="174" y="50" fill="var(--cyan)" fontSize="7.5" fontFamily="var(--font-mono)" letterSpacing="0.08em">
          EFF {((panel.efficiency ?? 0.28) * 100).toFixed(0)}%
        </text>
        <text x="130" y="148" textAnchor="middle" fill="var(--text-dim)" fontSize="7.5" fontFamily="var(--font-mono)" letterSpacing="0.1em">
          POLAR DESCENT VEHICLE · {panel.battery_wh} WH BATTERY
        </text>
      </svg>
    </div>
  );
}

function SourcesModal({ onClose }: { onClose: () => void }) {
  const [src, setSrc] = useState<any[] | null>(null);
  useState(() => {
    fetch("/api/data-sources")
      .then((r) => r.json())
      .then((j) => setSrc(j.data))
      .catch(() => setSrc([]));
  });
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2>MISSION DATA SOURCES & PROVENANCE</h2>
          <button className="btn-header" onClick={onClose}>ESC / CLOSE</button>
        </div>
        {src === null && <p style={{ fontFamily: "var(--font-mono)", color: "var(--cyan)" }}>FETCHING CATALOG...</p>}
        {src?.length === 0 && <p style={{ color: "var(--rose)" }}>UNAVAILABLE: Backend did not return sources.</p>}
        {src?.map((s) => (
          <article key={s.name}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <h4>{s.name}</h4>
              <span className="card-badge" style={{ textTransform: "uppercase" }}>{s.category}</span>
            </div>
            <p><a href={s.url} target="_blank" rel="noreferrer">{s.url}</a></p>
            <p style={{ color: "#fff", fontSize: "11.5px", fontFamily: "var(--font-mono)" }}>
              DATASETS: {s.datasets.join("; ")}
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-dim)" }}>
              UNITS: {s.units} · REFERENCE: {s.crs} · METHOD: {s.method}
            </p>
          </article>
        ))}
        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button className="btn-header" onClick={onClose}>DISMISS</button>
        </div>
      </div>
    </div>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <h2>ABOUT POLAR WINDOW · MISSION OVERVIEW</h2>
          <button className="btn-header" onClick={onClose}>ESC / CLOSE</button>
        </div>
        <p>
          <b>POLAR WINDOW</b> is an aerospace mission overview command center engineered for lunar south pole exploration, solar illumination mapping, and Earth direct-to-Earth (DTE) communication geometry.
        </p>
        <p>
          <b>Ephemeris Engine:</b> Sun and Earth positions are calculated with NASA NAIF SPICE kernels (DE440 planetary ephemeris, MOON_ME reference frame) incorporating one-way light-time and stellar aberration corrections (<code>LT+S</code>).
        </p>
        <p>
          <b>Geometric Reference & Constraints:</b> All elevation and azimuth values are computed relative to the IAU lunar reference sphere (radius <em>R = 1737.4 km</em>). Micro-topography, crater rims, local terrain slope, and permanently shadowed regions (PSRs) require NASA LRO/LOLA DEM data products and are tagged as unavailable.
        </p>
        <p>
          <b>Visual Assets:</b> 3D lunar surface maps and normal relief textures are provided through the Celestia Project (see <code>assets/ATTRIBUTION.md</code> for licensing records).
        </p>
        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button className="btn-header" onClick={onClose}>ACKNOWLEDGE</button>
        </div>
      </div>
    </div>
  );
}

const LAYERS: { k: keyof Layers; label: string }[] = [
  { k: "texture", label: "Surface Albedo Texture" },
  { k: "relief", label: "Relief Normal Shading" },
  { k: "craters", label: "LOLA Craters & Rim Circles" },
  { k: "markers", label: "Selected Site Target Marker" },
  { k: "terminator", label: "Day/Night Terminator" },
  { k: "graticule", label: "Coordinate Graticule" },
  { k: "indicators", label: "Sun & Earth Vectors" },
  { k: "axis", label: "Lunar Spin Axis" },
];

function NumInput({
  label,
  k,
  step = 1,
  min = 0,
  max,
  pct,
  unit,
}: {
  label: string;
  k: keyof PanelParams;
  step?: number;
  min?: number;
  max?: number;
  pct?: boolean;
  unit?: string;
}) {
  const v = useSim((s) => s.panel[k]);
  const setPanel = useSim((s) => s.setPanel);
  return (
    <div className="input-group">
      <div className="input-label">
        <span>{label}</span>
        {unit && <span className="sub-unit">{unit}</span>}
      </div>
      <input
        type="number"
        className="aero-input"
        step={step}
        min={min}
        max={max}
        value={pct ? Math.round(v * 1000) / 10 : v}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!isNaN(n)) setPanel({ [k]: pct ? n / 100 : n } as any);
        }}
      />
    </div>
  );
}

export default function App() {
  useBackendHealth();
  useGeometry();
  useAnalysis();
  useLandingRecommendations();

  const s = useSim();
  const [showLanding, setShowLanding] = useState(true);
  const [srcModal, setSrcModal] = useState(false);
  const [aboutModal, setAboutModal] = useState(false);
  const [showFloatingCard, setShowFloatingCard] = useState(true);

  const g = s.geometry;
  const wEnd = s.windowStartMs + s.windowHours * 3600e3;

  const currentSite = useMemo(() => {
    return s.sites.find((x) => x.id === s.siteId);
  }, [s.sites, s.siteId]);

  const tabs: [Tab, string][] = [
    ["timeline", "01 SUNLIGHT TIMELINE"],
    ["power", "02 POWER SUBSYSTEM"],
    ["comms", "03 EARTH COMMS LINK"],
    ["compare", "04 SITE COMPARISON"],
    ["landing", "05 LANDING RECOMMENDER"],
  ];

  const statusLabel = {
    connecting: "CONNECTING TO SPICE...",
    ok: "SPICE ENGINE ONLINE",
    kernels_missing: "KERNELS MISSING",
    offline: "BACKEND OFFLINE",
  }[s.health];

  if (showLanding) {
    return (
      <LandingPage
        onEnterApp={(mode = "dashboard", siteId) => {
          if (siteId) {
            s.selectSite(siteId);
          }
          if (mode === "rover") {
            s.setView("rover");
          } else if (s.view === "rover") {
            s.setView("south");
          }
          setShowLanding(false);
        }}
      />
    );
  }

  return (
    <div className="app">
      {/* 1. TOP COMMAND BAR */}
      <header className="cmd-header">
        <div className="brand-section">
          <div className="brand-logo-hex">
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="50 5, 90 25, 90 75, 50 95, 10 75, 10 25" stroke="var(--cyan)" strokeWidth="6" />
              <circle cx="50" cy="50" r="18" fill="var(--cyan)" opacity="0.85" />
              <circle cx="50" cy="50" r="28" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeDasharray="5 5" />
            </svg>
          </div>
          <div className="brand-title">
            <div className="brand-name">
              POLAR <span>WINDOW</span>
            </div>
            <div className="brand-sub">Lunar Mission Overview · Aerospace Command Center</div>
          </div>
        </div>

        {/* Center telemetry status chips */}
        <div className="header-telemetry-strip">
          <div className="hud-chip">
            <span className="label">MISSION STATUS:</span>
            <span className="val cyan">POLAR SURVEY ACTIVE</span>
          </div>
          <div className="hud-chip">
            <span className="label">TARGET BODY:</span>
            <span className="val">MOON (MOON_ME)</span>
          </div>
          <div className="hud-chip">
            <span className="label">UTC CLOCK:</span>
            <span className="val" style={{ color: "#fff" }}>
              {new Date(s.utcMs).toISOString().replace("T", " ").slice(0, 19)} UTC
            </span>
          </div>
          <div className="hud-chip">
            <span
              className={`status-indicator-dot ${
                s.health === "ok" ? "" : s.health === "connecting" ? "connecting" : "bad"
              }`}
            />
            <span className="label">SPICE:</span>
            <span className="val" style={{ fontSize: "10.5px" }}>{statusLabel}</span>
          </div>
        </div>

        {/* Right action navigation */}
        <div className="header-actions">
          <button
            className="btn-header"
            style={{ borderColor: "var(--cyan)", color: "var(--cyan)" }}
            onClick={() => setShowLanding(true)}
            title="Return to Polar Window Front-End Landing Page"
          >
            ◀ HOME
          </button>
          <select
            className="aero-select"
            style={{ width: "230px", padding: "5px 8px", fontSize: "11px", height: "28px" }}
            value={s.view === "rover" ? "__rover__" : s.siteId ?? ""}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__rover__") {
                s.setView("rover");
              } else if (val) {
                if (s.view === "rover") s.setView("south");
                s.selectSite(val);
              }
            }}
            title="Select Lunar Crater, Peak, Landing Site, or LRV Expedition"
          >
            <option value="">— LUNAR SITES & CRATERS MENU —</option>
            <optgroup label="Surface Rover Mode">
              <option value="__rover__">LRV Surface Expedition (3D Interactive Rover)</option>
            </optgroup>
            <optgroup label="Lunar Craters, Peaks & Landing Sites">
              {s.sites.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name} ({x.lat.toFixed(1)}°, {x.lon.toFixed(1)}°E)
                </option>
              ))}
            </optgroup>
          </select>
          <button className="btn-header" onClick={() => setSrcModal(true)}>
            DATA SOURCES
          </button>
          <button className="btn-header" onClick={() => setAboutModal(true)}>
            MISSION SPECS
          </button>
        </div>
      </header>

      {/* 2. LEFT PANEL: LOCATION, TIME & PAYLOAD SCHEMATIC */}
      <aside className="left-panel">
        {/* SECTION 01: LOCATION SELECTOR */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">01</span>
              <span>LUNAR EXPLORATION SITES</span>
            </div>
            <span className="card-badge">IAU SPHERE</span>
          </div>

          <div className="input-group">
            <div className="input-label">
              <span>CRATER / PEAK / SITE MENU</span>
            </div>
            <select
              className="aero-select"
              value={s.view === "rover" ? "__rover__" : s.siteId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val === "__rover__") {
                  s.setView("rover");
                } else if (val) {
                  if (s.view === "rover") s.setView("south");
                  s.selectSite(val);
                }
              }}
            >
              <option value="">Custom Coordinates</option>
              <optgroup label="Surface Expedition">
                <option value="__rover__">LRV Expedition (Drive 3D Rover)</option>
              </optgroup>
              <optgroup label="Polar Craters, Peaks & Artemis Sites">
                {s.sites.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} ({x.lat.toFixed(1)}°, {x.lon.toFixed(1)}°E)
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Precision Coordinates Dual Inputs */}
          <div className="coord-dual-row">
            <div className="input-group">
              <div className="input-label">
                <span>LATITUDE</span>
                <span className="sub-unit">°S NEG</span>
              </div>
              <input
                type="number"
                className="aero-input"
                step="0.05"
                min={-90}
                max={90}
                value={s.lat}
                onChange={(e) =>
                  s.setCoords(Math.max(-90, Math.min(90, Number(e.target.value))), s.lon)
                }
              />
            </div>
            <div className="input-group">
              <div className="input-label">
                <span>LONGITUDE</span>
                <span className="sub-unit">°E</span>
              </div>
              <input
                type="number"
                className="aero-input"
                step="0.05"
                min={-360}
                max={360}
                value={s.lon}
                onChange={(e) => s.setCoords(s.lat, Number(e.target.value))}
              />
            </div>
          </div>

          <div className="status-pill-strip">
            <span className="dot" />
            <span style={{ color: "var(--text-dim)", fontSize: "10px" }}>
              DATUM: R = 1737.4 KM · SMOOTH SPHERE
            </span>
          </div>
        </div>

        {/* SECTION 02: TEMPORAL CONTROLS */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">02</span>
              <span>SIMULATION DATE & EPOCH</span>
            </div>
            <span className="card-badge emerald">TDB ET</span>
          </div>

          <div className="input-group">
            <div className="input-label">
              <span>DATE & TIME (UTC)</span>
            </div>
            <input
              type="datetime-local"
              step={1}
              className="aero-input"
              value={toInput(s.utcMs)}
              onChange={(e) => {
                const t = Date.parse(e.target.value + "Z");
                if (!isNaN(t)) s.set({ utcMs: t });
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px", marginTop: "6px" }}>
            <button
              className="btn-site-chip"
              onClick={() => s.set({ utcMs: Date.UTC(2026, 10, 9, 0, 0, 0) })}
            >
              2026 POLAR WINDOW
            </button>
            <button
              className="btn-site-chip"
              onClick={() => s.set({ utcMs: Date.now() })}
            >
              CURRENT REALTIME
            </button>
            <button
              className="btn-site-chip"
              onClick={() => s.set({ utcMs: s.windowStartMs })}
            >
              WINDOW START
            </button>
            <button
              className="btn-site-chip"
              onClick={() => s.set({ utcMs: s.utcMs + 86400e3 * 7 })}
            >
              +7 DAYS STEP
            </button>
          </div>
        </div>

        {/* SECTION 03: PAYLOAD SCHEMATIC (Matches Orion diagram in reference image) */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">03</span>
              <span>SOLAR ARRAY & PAYLOAD</span>
            </div>
            <span className="card-badge">SCHEMATIC</span>
          </div>
          <LanderSchematic />
          <details className="aero-details" style={{ marginTop: "8px" }}>
            <summary>QUICK PARAMETER TUNING ▾</summary>
            <NumInput label="Array Area" k="area_m2" step={0.5} min={0.1} unit="M²" />
            <NumInput label="Array Efficiency" k="efficiency" step={0.5} min={1} max={100} pct unit="%" />
            <NumInput label="Panel Tilt" k="tilt_deg" min={0} max={180} unit="°" />
            <NumInput label="Facing Azimuth" k="azimuth_deg" min={0} max={360} unit="°" />
            <NumInput label="Battery Capacity" k="battery_wh" step={100} min={1} unit="WH" />
            <NumInput label="Base Load Draw" k="load_w" min={0} unit="W" />
          </details>
        </div>
      </aside>

      {/* 3. CENTER: LARGE 3D MOON & AEROSPACE HUD */}
      <main className={s.fullscreen ? "fullscreen-canvas-mode" : ""}>
        <MoonView />

        {s.view !== "rover" && (
          <>
            {/* FLOATING SITE INSPECTION HUD CARD (Only when opened via menu) */}
            {showFloatingCard && (
              <div className="floating-site-card">
                <div className="floating-site-card-header">
                  <span className="floating-site-tag">
                    {currentSite ? "TARGET SITE" : "COORDINATES FOCUS"}
                  </span>
                  <button
                    style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer", fontSize: "12px", padding: 0 }}
                    onClick={() => setShowFloatingCard(false)}
                    title="Dismiss Card"
                  >
                    ✕
                  </button>
                </div>
                <div className="floating-site-name">
                  {currentSite ? currentSite.name : `Site (${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°E)`}
                </div>
                <div className="floating-site-desc">
                  {currentSite?.description ||
                    (s.lat <= -88
                      ? "Near the lunar South Pole, the low solar elevation produces extreme shadow dynamics and persistent illuminated ridges crucial for long-duration surface presence."
                      : "Exploration site on the lunar surface with periodic day/night thermal cycling and geometric line-of-sight visibility to Earth.")}
                </div>
                <div className="floating-site-grid">
                  <div>
                    <span className="lbl">LATITUDE</span>
                    <span className="val">{s.lat.toFixed(3)}°</span>
                  </div>
                  <div>
                    <span className="lbl">LONGITUDE</span>
                    <span className="val">{s.lon.toFixed(3)}°E</span>
                  </div>
                  <div>
                    <span className="lbl">SUN ELEVATION</span>
                    <span className="val" style={{ color: "var(--amber)" }}>
                      {g ? `${g.sun.elevation_deg.toFixed(2)}°` : "–"}
                    </span>
                  </div>
                  <div>
                    <span className="lbl">EARTH LOS</span>
                    <span className="val" style={{ color: "var(--cyan)" }}>
                      {g ? `${g.earth.elevation_deg.toFixed(2)}°` : "–"}
                    </span>
                  </div>
                  <div>
                    <span className="lbl">LOLA ELEVATION</span>
                    <span className="val" style={{ color: "var(--text-bright)" }}>
                      {g?.elevation_m !== undefined ? `${g.elevation_m > 0 ? "+" : ""}${Math.round(g.elevation_m)} m` : "–"}
                    </span>
                  </div>
                  <div>
                    <span className="lbl">LANDING SAFETY</span>
                    <span className="val" style={{ color: g?.landing_evaluation?.badge_color ?? "var(--amber)" }}>
                      {g?.landing_evaluation ? `${Math.round(g.landing_evaluation.suitability_score)}% (${g.landing_evaluation.grade})` : "–"}
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end", gap: "6px" }}>
                  <button
                    className="btn-site-chip"
                    style={{ borderColor: "var(--amber)", color: "var(--amber)", fontWeight: 700, padding: "5px 10px" }}
                    onClick={() => s.setView("rover")}
                  >
                    SURFACE ROVER EXPEDITION ↗
                  </button>
                </div>
              </div>
            )}

            {/* Top-Right Visual Layers & Inspector Menu */}
            <div className="hud-layers-flyout" style={{ top: "14px", right: "14px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <button
                className="btn-header"
                style={{ background: "rgba(6, 12, 24, 0.88)", backdropFilter: "blur(10px)" }}
                onClick={() => setShowFloatingCard((v) => !v)}
              >
                {showFloatingCard ? "HIDE SITE INFO" : "SITE INFO"}
              </button>
              <details className="layers-details-box">
                <summary>VISUAL LAYERS ▾</summary>
                {LAYERS.map((l) => (
                  <label key={l.k} className="layer-item-chk">
                    <input
                      type="checkbox"
                      checked={s.layers[l.k]}
                      onChange={() => s.toggleLayer(l.k)}
                    />
                    <span>{l.label}</span>
                  </label>
                ))}
              </details>
            </div>
          </>
        )}

        {/* Bottom Orbit & Rover Views Toolbar */}
        <div className="hud-view-controls">
          <button
            className={`btn-hud-view ${s.view === "south" ? "active" : ""}`}
            onClick={() => s.setView("south")}
          >
            SOUTH POLE
          </button>
          <button
            className={`btn-hud-view ${s.view === "north" ? "active" : ""}`}
            onClick={() => s.setView("north")}
          >
            NORTH POLE
          </button>
          <button
            className={`btn-hud-view ${s.view === "free" ? "active" : ""}`}
            onClick={() => s.setView("free")}
          >
            FREE ORBIT
          </button>
          <button
            className={`btn-hud-view rover-hud-btn ${s.view === "rover" ? "active" : ""}`}
            onClick={() => s.setView("rover")}
            title="Deploy and drive the NASA Lunar Roving Vehicle on the Moon surface"
          >
            SURFACE ROVER (LRV)
          </button>
          <button
            className={`btn-hud-view ${s.layers.craters ? "active" : ""}`}
            onClick={() => s.toggleLayer("craters")}
            title="Toggle NASA LOLA Crater Rim Circles & PSR Basins on the 3D Moon"
            style={{
              borderColor: s.layers.craters ? "var(--cyan)" : undefined,
              color: s.layers.craters ? "var(--cyan)" : undefined,
            }}
          >
            {s.layers.craters ? "◎ LOLA CRATERS: ON" : "○ LOLA CRATERS: OFF"}
          </button>
          <button
            className={`btn-hud-view ${s.fullscreen ? "active" : ""}`}
            onClick={() => s.toggleFullscreen()}
            title="Toggle Fullscreen 3D View (F)"
            style={{ borderColor: s.fullscreen ? "var(--cyan)" : undefined }}
          >
            {s.fullscreen ? "↙ EXIT FULLSCREEN" : "⛶ FULLSCREEN"}
          </button>
        </div>
      </main>

      {/* 4. RIGHT PANEL: SUN, EARTH, HORIZON & SURFACE TELEMETRY */}
      <aside className="right-panel">
        {/* SECTION 03: SUN TELEMETRY */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">03</span>
              <span>SUN TELEMETRY</span>
            </div>
            <span className="card-badge amber">SOLAR VECTOR</span>
          </div>

          <div className="telemetry-row">
            <div className="metric-box">
              <span className="metric-title">ELEVATION</span>
              <span className="metric-val amber">
                {fmt(g?.sun.elevation_deg)}
                <span className="unit">°</span>
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-title">AZIMUTH</span>
              <span className="metric-val">
                {fmt(g?.sun.azimuth_deg)}
                <span className="unit">°</span>
              </span>
            </div>
          </div>

          <dl className="tech-dl">
            <dt>Solar Distance</dt>
            <dd>{g ? (g.sun.range_km / 149597870.7).toFixed(4) : "–"} AU</dd>
            <dt>Sub-Solar Radius</dt>
            <dd>{g ? g.sun_radius_deg.toFixed(3) : "–"}°</dd>
            <dt>Horizon State</dt>
            <dd style={{ color: g && g.sun.elevation_deg + g.sun_radius_deg > 0 ? "var(--emerald)" : "var(--rose)" }}>
              {g && g.sun.elevation_deg + g.sun_radius_deg > 0 ? "ILLUMINATED (ABOVE)" : "DARKNESS (BELOW)"}
            </dd>
          </dl>
        </div>

        {/* SECTION 04: EARTH TELEMETRY */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">04</span>
              <span>EARTH TELEMETRY & COMMS</span>
            </div>
            <span className="card-badge">DTE LINK</span>
          </div>

          <div className="telemetry-row">
            <div className="metric-box">
              <span className="metric-title">ELEVATION</span>
              <span className="metric-val cyan">
                {fmt(g?.earth.elevation_deg)}
                <span className="unit">°</span>
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-title">AZIMUTH</span>
              <span className="metric-val">
                {fmt(g?.earth.azimuth_deg)}
                <span className="unit">°</span>
              </span>
            </div>
          </div>

          <dl className="tech-dl">
            <dt>Range (Moon Center)</dt>
            <dd>{g ? Math.round(g.earth.range_km).toLocaleString() : "–"} km</dd>
            <dt>One-Way Light Time</dt>
            <dd>{g ? (g.earth.range_km / 299792.458).toFixed(3) : "1.282"} s</dd>
            <dt>Geometric LOS</dt>
            <dd style={{ color: g && g.earth.elevation_deg > 0 ? "var(--emerald)" : "var(--rose)" }}>
              {g && g.earth.elevation_deg > 0 ? "DIRECT LINE-OF-SIGHT" : "OCCULTED BY HORIZON"}
            </dd>
          </dl>
        </div>

        {/* SECTION 05: LOCAL HORIZON RADAR */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">05</span>
              <span>LOCAL HORIZON DIAGRAM</span>
            </div>
            <span className="card-badge">RADAR</span>
          </div>
          <HorizonDome />
        </div>

        {/* SECTION 06: SURFACE ENVIRONMENT */}
        <div className="aero-card">
          <div className="aero-card-header">
            <div className="card-num-title">
              <span className="card-num">06</span>
              <span>SURFACE & TOPOGRAPHY</span>
            </div>
            <span className="card-badge emerald">NASA LOLA</span>
          </div>
          <dl className="tech-dl">
            <dt>Latitude</dt>
            <dd>{fmt(s.lat, 3)}°</dd>
            <dt>Longitude</dt>
            <dd>{fmt(s.lon, 3)}°E</dd>
            <dt>Datum Radius</dt>
            <dd>1737.4 km (IAU Sphere)</dd>
            <dt>LOLA Elevation</dt>
            <dd style={{ color: g?.elevation_m !== undefined && g.elevation_m > 0 ? "var(--cyan)" : undefined }}>
              {g?.elevation_m !== undefined ? `${g.elevation_m > 0 ? "+" : ""}${Math.round(g.elevation_m)} m` : currentSite?.elevation_m !== undefined ? `${Math.round(currentSite.elevation_m)} m` : "–"}
            </dd>
            <dt>Terrain Slope</dt>
            <dd style={{ color: g?.slope_deg !== undefined && g.slope_deg < 5 ? "var(--emerald)" : g?.slope_deg !== undefined && g.slope_deg < 10 ? "var(--amber)" : "var(--rose)" }}>
              {g?.slope_deg !== undefined ? `${g.slope_deg.toFixed(1)}°` : currentSite?.slope_deg !== undefined ? `${currentSite.slope_deg.toFixed(1)}°` : "–"}
            </dd>
            <dt>Horizon Dip (Vacuum)</dt>
            <dd style={{ color: "var(--cyan)" }}>
              {g?.horizon_dip_deg !== undefined ? `-${g.horizon_dip_deg.toFixed(2)}° (No Refract)` : "0.00° (Smooth)"}
            </dd>
            <dt>Solar Elevation</dt>
            <dd style={{ color: "var(--amber)", fontWeight: 700 }}>
              {g ? `${g.sun.elevation_deg.toFixed(2)}°` : "–"}
            </dd>
            <dt>Landing Suitability</dt>
            <dd style={{ color: g?.landing_evaluation?.badge_color ?? "var(--amber)", fontWeight: 700 }}>
              {g?.landing_evaluation ? `${Math.round(g.landing_evaluation.suitability_score)}% (${g.landing_evaluation.status})` : "–"}
            </dd>
          </dl>
          {s.calcMs !== null && (
            <div style={{ fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: "6px" }}>
              SPICE DE440 + LOLA SOLVED IN {s.calcMs} MS
            </div>
          )}
        </div>
      </aside>

      {/* 5. BOTTOM: SOLAR ILLUMINATION, BATTERY, POWER, COMMS & TIMELINE */}
      <section className="bottom-command-deck">
        {/* Scrubber & Simulation Transport Control Bar */}
        <div className="transport-strip">
          <div className="transport-btn-group">
            <button
              className="btn-transport"
              onClick={() => s.set({ utcMs: s.utcMs - s.speed * 1000 })}
              title="Step Backward"
            >
              ⏮
            </button>
            <button
              className={`btn-transport ${s.playing ? "play-active" : ""}`}
              onClick={() => s.set({ playing: !s.playing })}
              title={s.playing ? "Pause Simulation" : "Run Simulation"}
              style={{ width: "34px", fontWeight: 700 }}
            >
              {s.playing ? "❚❚" : "▶"}
            </button>
            <button
              className="btn-transport"
              onClick={() => s.set({ utcMs: s.utcMs + s.speed * 1000 })}
              title="Step Forward"
            >
              ⏭
            </button>
          </div>

          <select
            className="speed-select"
            value={s.speed}
            onChange={(e) => s.set({ speed: Number(e.target.value) })}
            aria-label="Simulation speed"
          >
            <option value={60}>1 MIN / SEC</option>
            <option value={3600}>1 HR / SEC</option>
            <option value={86400}>1 DAY / SEC</option>
            <option value={604800}>1 WEEK / SEC</option>
          </select>

          {/* Interactive Scrub Slider */}
          <div className="timeline-scrubber">
            <input
              type="range"
              className="timeline-slider-input"
              min={s.windowStartMs}
              max={wEnd}
              step={60000}
              value={Math.min(wEnd, Math.max(s.windowStartMs, s.utcMs))}
              onChange={(e) => s.set({ utcMs: Number(e.target.value) })}
              aria-label="Simulation scrubber"
            />
            <span className="time-readout-pill">
              {new Date(s.utcMs).toISOString().replace("T", " ").slice(0, 16)} UTC
            </span>
          </div>
        </div>

        {/* KPI Telemetry Cards: Solar Illumination, Battery, Power Generation, Earth Visibility */}
        <div className="kpi-summary-grid">
          <div className="kpi-chip">
            <span className="kpi-chip-title">☀️ SOLAR ILLUMINATION</span>
            <span className="kpi-chip-val amber">
              {s.timeline ? `${s.timeline.stats.sunlit_pct.toFixed(1)}%` : "–"}
            </span>
          </div>
          <div className="kpi-chip">
            <span className="kpi-chip-title">🔋 BATTERY STATUS</span>
            <span className="kpi-chip-val emerald">
              {s.power?.summary.min_battery_pct !== null && s.power?.summary.min_battery_pct !== undefined
                ? `${s.power.summary.min_battery_pct.toFixed(0)}%`
                : "–"}
            </span>
          </div>
          <div className="kpi-chip">
            <span className="kpi-chip-title">⚡ POWER GENERATION</span>
            <span className="kpi-chip-val">
              {s.power ? `${s.power.summary.mean_power_w.toFixed(0)} W` : "–"}
            </span>
          </div>
          <div className="kpi-chip">
            <span className="kpi-chip-title">📡 EARTH VISIBILITY</span>
            <span className="kpi-chip-val cyan">
              {s.comms ? `${s.comms.earth_visible_pct.toFixed(1)}%` : "–"}
            </span>
          </div>
        </div>

        {/* Tab Navigation for Subsystem Views */}
        <nav className="deck-tabs-nav">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              className={`deck-tab-btn ${s.tab === k ? "active" : ""}`}
              onClick={() => s.set({ tab: k })}
            >
              {label}
            </button>
          ))}
          {s.analysisLoading && (
            <span style={{ marginLeft: "auto", fontSize: "10px", color: "var(--cyan)", fontFamily: "var(--font-mono)" }}>
              COMPUTING EPHEMERIS...
            </span>
          )}
        </nav>

        {/* Active Subsystem Panel */}
        <div className="tab-panel-container">
          {s.tab === "timeline" && <TimelinePanel />}
          {s.tab === "power" && <PowerPanel />}
          {s.tab === "comms" && <CommsPanel />}
          {s.tab === "compare" && <ComparePanel />}
          {s.tab === "landing" && <LandingPanel />}
        </div>
      </section>

      {/* Modals */}
      {srcModal && <SourcesModal onClose={() => setSrcModal(false)} />}
      {aboutModal && <AboutModal onClose={() => setAboutModal(false)} />}
    </div>
  );
}
