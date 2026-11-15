import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSim } from "./store";

function HeroMoonMesh() {
  const groupRef = useRef<THREE.Group>(null);
  const [colorTex, setColorTex] = useState<THREE.Texture | null>(null);
  const [normalTex, setNormalTex] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    loader.load("/assets/moon.jpg", (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
      setColorTex(t);
    });
    loader.load("/assets/moon-normal.png", (t) => {
      t.anisotropy = 8;
      setNormalTex(t);
    });
  }, []);

  useFrame((_, dt) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.085;
    }
  });

  // Orbital trajectory rings around the Moon
  const polarOrbitPts = Array.from({ length: 121 }, (_, i) => {
    const a = (i / 120) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 0.25, Math.sin(a) * 1.32, Math.cos(a) * 1.28);
  });

  const eqOrbitPts = Array.from({ length: 121 }, (_, i) => {
    const a = (i / 120) * Math.PI * 2;
    return new THREE.Vector3(Math.cos(a) * 1.48, Math.sin(a) * 0.18, Math.sin(a) * 1.48);
  });

  return (
    <group ref={groupRef} rotation={[0.22, -0.5, -0.08]}>
      <mesh>
        <sphereGeometry args={[1, 96, 64]} />
        <meshStandardMaterial
          map={colorTex}
          color={colorTex ? "#ffffff" : "#94a3b8"}
          normalMap={normalTex}
          normalScale={new THREE.Vector2(1.8, 1.8)}
          roughness={0.95}
          metalness={0.04}
        />
      </mesh>
      <Line points={polarOrbitPts} color="#00f0ff" lineWidth={1.1} transparent opacity={0.42} />
      <Line points={eqOrbitPts} color="#fbbf24" lineWidth={0.9} transparent opacity={0.28} />
      {/* South Pole Beacon */}
      <mesh position={[0, -1.015, 0]}>
        <sphereGeometry args={[0.028, 16, 16]} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
    </group>
  );
}

interface LandingPageProps {
  onEnterApp: (initialMode?: "dashboard" | "rover", siteId?: string) => void;
}

const FEATURE_CARDS = [
  {
    code: "01 // SPICE EPHEMERIS",
    badge: "NASA NAIF DE440",
    title: "Real-Time Solar & Earth Vectors",
    desc: "Computes exact topocentric elevation, azimuth, range, and one-way light time in the MOON_ME reference frame using JPL DE440 planetary ephemerides with LT+S aberration.",
    metrics: ["Sub-ms SPICE Solver", "IAU R = 1737.4 km", "Vacuum Horizon Dip"],
  },
  {
    code: "02 // LRO LOLA TOPOGRAPHY",
    badge: "17 CALIBRATED SITES",
    title: "Artemis III Craters & Polar Ridges",
    desc: "Explore 17 calibrated lunar locations including Shackleton Connecting Ridge, Cabeus LCROSS Basin, Nobile VIPER, Malapert Mountain, Tycho, Copernicus, and Taurus-Littrow.",
    metrics: ["Slope & Roughness", "PSR Proximity (km)", "Autonomous Grade A+ to D"],
  },
  {
    code: "03 // POWER & DTE COMMS",
    badge: "SUBSYSTEM MODELING",
    title: "Solar Array, Battery SOC & Link Windows",
    desc: "Simulate multi-day illumination timelines, eclipse intervals, solar wing generation (W), battery state-of-charge (Wh), and Direct-to-Earth (DTE) AOS/LOS visibility windows.",
    metrics: ["24h / 7d / 30d Windows", "Custom PV Array Config", "Multi-Site Matrix Compare"],
  },
  {
    code: "04 // 1/6-G SURFACE ROVER",
    badge: "INTERACTIVE 3D LRV",
    title: "Apollo Lunar Roving Vehicle & Crater Physics",
    desc: "Drive an interactive Apollo LRV across 8 realistic sculpted lunar craters and fractured breccia boulders with 4-wheel double-wishbone suspension, tire tracks, and 360° cursor look.",
    metrics: ["g = 1.622 m/s² Physics", "8 Sculpted Craters", "120m Live LIDAR Radar"],
  },
];

const FEATURED_SITES = [
  {
    id: "shackleton-connecting-ridge",
    name: "Shackleton Connecting Ridge",
    coords: "89.44°S, 222.5°E",
    elev: "+2,140 m",
    slope: "4.2°",
    tag: "ARTEMIS III PRIMARY",
    color: "#00f0ff",
  },
  {
    id: "peak-near-shackleton",
    name: "Peak Near Shackleton",
    coords: "89.68°S, 166.0°E",
    elev: "+2,480 m",
    slope: "5.8°",
    tag: "89% ILLUMINATED PEAK",
    color: "#34d399",
  },
  {
    id: "cabeus-crater",
    name: "Cabeus Crater (LCROSS Site)",
    coords: "84.90°S, 324.5°E",
    elev: "-3,850 m",
    slope: "9.4°",
    tag: "CONFIRMED WATER ICE",
    color: "#38bdf8",
  },
  {
    id: "nobile-rim-1-viper",
    name: "Nobile Rim 1 (VIPER Site)",
    coords: "85.39°S, 37.8°E",
    elev: "+1,680 m",
    slope: "3.8°",
    tag: "ICE RECONNAISSANCE",
    color: "#fbbf24",
  },
  {
    id: "tycho-central-peak",
    name: "Tycho Crater Central Peak",
    coords: "43.31°S, 348.64°E",
    elev: "+2,250 m",
    slope: "14.8°",
    tag: "TERRACED IMPACT PEAK",
    color: "#a855f7",
  },
  {
    id: "apollo-17-taurus-littrow",
    name: "LRV Expedition (Taurus-Littrow)",
    coords: "20.19°N, 30.77°E",
    elev: "-2,550 m",
    slope: "2.1°",
    tag: "APOLLO 17 STATION 6",
    color: "#f59e0b",
  },
];

export default function LandingPage({ onEnterApp }: LandingPageProps) {
  const s = useSim();
  const g = s.geometry;

  const statusText =
    s.health === "ok"
      ? "SPICE DE440 ENGINE ONLINE"
      : s.health === "connecting"
      ? "SYNCHRONIZING SPICE KERNELS..."
      : "SPICE TELEMETRY STANDBY";

  return (
    <div className="pw-landing-root">
      {/* Background 3D Interactive Moon Stage */}
      <div className="pw-landing-canvas-wrap">
        <Canvas
          camera={{ fov: 38, near: 0.1, far: 200, position: [1.4, -0.35, 3.1] }}
          dpr={[1, 2]}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        >
          <color attach="background" args={["#02050b"]} />
          <Stars radius={80} depth={45} count={4000} factor={3.2} fade speed={0.4} />
          <ambientLight intensity={0.05} />
          <directionalLight position={[12, 4, 10]} intensity={4.4} color="#fffaf0" />
          <HeroMoonMesh />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.35}
          />
        </Canvas>
        <div className="pw-landing-vignette" />
      </div>

      {/* Scrollable Foreground Content */}
      <div className="pw-landing-scroll">
        {/* Top Navigation Bar */}
        <header className="pw-landing-nav">
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
              <div className="brand-sub">Lunar South Pole Mission Explorer · NASA SPICE DE440</div>
            </div>
          </div>

          <nav className="pw-landing-links">
            <a href="#capabilities">CAPABILITIES</a>
            <a href="#sites">17 LUNAR SITES</a>
            <a href="#rover-preview">3D SURFACE ROVER</a>
          </nav>

          <div className="pw-landing-nav-right">
            <div className="hud-chip">
              <span
                className={`status-indicator-dot ${
                  s.health === "ok" ? "" : s.health === "connecting" ? "connecting" : "bad"
                }`}
              />
              <span className="val" style={{ fontSize: "10px" }}>
                {statusText}
              </span>
            </div>
            <button
              className="pw-try-btn-nav"
              onClick={() => onEnterApp("dashboard")}
            >
              Try Polar Window ➔
            </button>
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="pw-hero-section">
          <div className="pw-hero-content">
            <div className="pw-hero-eyebrow">
              <span className="pw-eyebrow-dot" />
              <span>AEROSPACE MISSION OVERVIEW · NASA NAIF SPICE + LRO LOLA DEM</span>
            </div>

            <h1 className="pw-hero-title">
              Explore the Lunar South Pole Through{" "}
              <span className="pw-gradient-text">Polar Window</span>
            </h1>

            <p className="pw-hero-lead">
              An integrated aerospace command center and 3D lunar surface simulator. Analyze real-time{" "}
              <strong>Sun &amp; Earth ephemeris geometry</strong>, evaluate{" "}
              <strong>17 calibrated NASA LOLA craters and landing sites</strong>, model{" "}
              <strong>solar array &amp; battery reserves</strong>, and pilot the{" "}
              <strong>1/6-G Apollo Lunar Roving Vehicle</strong> across photorealistic craters.
            </p>

            {/* Primary CTA Buttons */}
            <div className="pw-hero-cta-group">
              <button
                id="try-polar-window-btn"
                className="pw-try-btn-primary"
                onClick={() => onEnterApp("dashboard")}
              >
                <span className="pw-btn-pulse" />
                <span>Try Polar Window</span>
                <span className="pw-btn-arrow">➔</span>
              </button>

              <button
                className="pw-try-btn-secondary"
                onClick={() => onEnterApp("rover")}
              >
                <span>Launch 3D Surface Rover (LRV)</span>
                <span style={{ color: "var(--amber)" }}>↗</span>
              </button>
            </div>

            {/* Live Ephemeris Telemetry Ticker */}
            <div className="pw-hero-telemetry-bar">
              <div className="pw-tele-item">
                <span className="lbl">ACTIVE TARGET</span>
                <span className="val cyan">SHACKLETON RIDGE (89.44°S)</span>
              </div>
              <div className="pw-tele-item">
                <span className="lbl">SUN ELEVATION</span>
                <span className="val amber">
                  {g ? `${g.sun.elevation_deg.toFixed(2)}°` : "+1.38°"}
                </span>
              </div>
              <div className="pw-tele-item">
                <span className="lbl">EARTH DTE LINK</span>
                <span className="val">
                  {g ? `${g.earth.elevation_deg.toFixed(2)}°` : "-5.82°"}
                </span>
              </div>
              <div className="pw-tele-item">
                <span className="lbl">CALIBRATED SITES</span>
                <span className="val emerald">{s.sites.length || 17} LOLA TARGETS</span>
              </div>
            </div>
          </div>

          {/* Right Hero Floating Mission Card */}
          <div className="pw-hero-preview-card">
            <div className="pw-preview-header">
              <span className="card-badge">LIVE COMMAND PREVIEW</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--cyan)" }}>
                MOON_ME FRAME
              </span>
            </div>
            <div className="pw-preview-title">What’s Inside Polar Window</div>
            <ul className="pw-preview-list">
              <li>
                <b>Interactive 3D Lunar Globe</b> with real-time SPICE solar terminator, coordinate graticule, and clickable LOLA crater rings.
              </li>
              <li>
                <b>5 Subsystem Telemetry Decks</b>: Sunlight Timeline, Solar Power &amp; Battery SOC, Earth Comms Windows, Multi-Site Matrix Comparison, and Autonomous Landing Evaluator.
              </li>
              <li>
                <b>3D Apollo Lunar Rover Simulation</b> with 8 real-morphology craters (Shackleton, Cabeus, Shorty, Camelot, Tycho, Nobile, Haworth, Amundsen), fractured boulders, and 4-wheel suspension physics.
              </li>
            </ul>
            <button
              className="pw-try-btn-card"
              onClick={() => onEnterApp("dashboard")}
            >
              Try Polar Window Mission Control ➔
            </button>
          </div>
        </section>

        {/* SECTION 1: CORE CAPABILITIES */}
        <section id="capabilities" className="pw-section">
          <div className="pw-section-header">
            <div>
              <div className="pw-section-tag">SYSTEM ARCHITECTURE // STAGES 1–5</div>
              <h2 className="pw-section-title">Engineered for Lunar Mission Planning</h2>
            </div>
            <button className="btn-header" onClick={() => onEnterApp("dashboard")}>
              OPEN FULL TELEMETRY DASHBOARD ➔
            </button>
          </div>

          <div className="pw-features-grid">
            {FEATURE_CARDS.map((f) => (
              <div key={f.code} className="pw-feature-card">
                <div className="pw-feature-top">
                  <span className="pw-feature-code">{f.code}</span>
                  <span className="card-badge">{f.badge}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
                <div className="pw-feature-chips">
                  {f.metrics.map((m) => (
                    <span key={m} className="pw-mini-chip">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: 17 CALIBRATED LUNAR SITES */}
        <section id="sites" className="pw-section">
          <div className="pw-section-header">
            <div>
              <div className="pw-section-tag">NASA LRO / LOLA DIGITAL ELEVATION MODEL</div>
              <h2 className="pw-section-title">Featured Craters &amp; Exploration Targets</h2>
            </div>
            <button className="btn-header" onClick={() => onEnterApp("dashboard")}>
              VIEW ALL 17 SITES IN POLAR WINDOW ➔
            </button>
          </div>

          <div className="pw-sites-grid">
            {FEATURED_SITES.map((site) => (
              <div
                key={site.id}
                className="pw-site-card"
                onClick={() => onEnterApp("dashboard", site.id)}
              >
                <div className="pw-site-card-top">
                  <span
                    className="card-badge"
                    style={{
                      color: site.color,
                      borderColor: `${site.color}55`,
                      background: `${site.color}18`,
                    }}
                  >
                    {site.tag}
                  </span>
                  <span className="pw-site-coords">{site.coords}</span>
                </div>
                <div className="pw-site-name">{site.name}</div>
                <div className="pw-site-metrics">
                  <div>
                    <span className="lbl">LOLA ELEVATION</span>
                    <span className="val">{site.elev}</span>
                  </div>
                  <div>
                    <span className="lbl">MEAN SLOPE</span>
                    <span className="val">{site.slope}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className="lbl">INSPECT</span>
                    <span className="val" style={{ color: "var(--cyan)" }}>
                      LAUNCH ➔
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: ROVER & FINAL CTA BANNER */}
        <section id="rover-preview" className="pw-section pw-bottom-cta-banner">
          <div className="pw-cta-banner-inner">
            <div>
              <div className="pw-section-tag" style={{ color: "var(--amber)" }}>
                READY FOR LUNAR RECONNAISSANCE
              </div>
              <h2 className="pw-section-title" style={{ marginBottom: "8px" }}>
                Launch the Polar Window Command Center
              </h2>
              <p style={{ color: "var(--text-muted)", maxWidth: "620px", margin: 0, fontSize: "13.5px" }}>
                Step directly into the interactive 3D lunar globe, inspect live NASA SPICE DE440 illumination and communication timelines, or deploy the Apollo Lunar Roving Vehicle onto the cratered surface.
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                className="pw-try-btn-primary"
                onClick={() => onEnterApp("dashboard")}
              >
                <span className="pw-btn-pulse" />
                <span>Try Polar Window</span>
                <span className="pw-btn-arrow">➔</span>
              </button>
              <button
                className="pw-try-btn-secondary"
                onClick={() => onEnterApp("rover")}
              >
                <span>Drive Surface Rover</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

