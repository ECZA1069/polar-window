# POLAR WINDOW — Lunar Mission Overview & Aerospace Command Center

**POLAR WINDOW** is a full-stack aerospace mission planning dashboard and interactive 3D lunar simulation engineered for lunar South Pole exploration, NASA SPICE ephemeris geometry, LRO LOLA topography analysis, autonomous landing site recommendation, and interactive 3D Lunar Roving Vehicle (LRV) surface operations.

---

## Key Features

### 1. Real NASA Ephemerides & Vacuum Horizon Physics
- **NASA NAIF SPICE DE440 & JPL Horizons**: High-precision Sun and Earth directional vectors, range distances, and sub-solar angles in the `MOON_ME` frame with one-way light-time and stellar aberration corrections (`LT+S`).
- **Atmospheric Vacuum Modeling**: Accounts for the Moon's lack of atmosphere ($0^\circ$ atmospheric refraction) and computes terrain elevation horizon dip:
  $$\theta_{\text{dip}} = \arccos\left(\frac{R}{R + h}\right)$$
- **Solar Elevation & Power Subsystem**: Real-time solar elevation angle, irradiance ($W/m^2$), photovoltaic array power generation, and battery state-of-charge modeling across multi-day mission windows.

### 2. NASA LRO LOLA Topography & Autonomous Landing Recommender
- **LOLA Digital Elevation & Slope Engine**: Calibrated elevation ($h$), terrain slope ($\text{deg}$), surface roughness, and Permanently Shadowed Region (PSR) proximity across NASA Artemis III candidate landing regions and historical touchdown sites.
- **Autonomous Landing Suitability Index**: Ranks candidate landing sites using a weighted multi-criteria engineering model:
  - **Slope Safety (40%)**: Evaluates lander tip-over risk ($<5^\circ$ optimal).
  - **Solar Illumination (30%)**: Persistent sunlight availability for power generation.
  - **Direct-to-Earth (DTE) Comms (20%)**: Line-of-sight Earth elevation for telemetry.
  - **Thermal & PSR Proximity (10%)**: Access to water-ice volatile cold traps.

### 3. Interactive 3D Moon & Apollo Lunar Roving Vehicle (LRV) Simulator
- **3D Lunar Globe**: Three.js / React Three Fiber globe with Celestia albedo and normal relief maps, dynamic SPICE solar terminator, coordinate graticule, Sun/Earth vectors, and clickable LOLA crater rim rings.
- **Apollo 17 Surface Rover Mode**:
  - Detailed 3D NASA Lunar Roving Vehicle (wire-mesh wheels with titanium chevron treads, Kapton gold MLI insulation, high-gain parabolic dish antenna, GCTA color TV camera, and dual headlights).
  - **Taurus-Littrow Valley & Station 6 ("Tracy's Rock")**: Recreates the split boulder formation and astronaut EVA figure.
  - **4-Wheel Ground Raycasting & Dust Physics**: Real-time pitch/roll terrain alignment, dynamic tire prints stamped into the regolith, and $1.62\text{ m/s}^2$ lunar gravity dust rooster tails.
  - **360° Cursor Orbit & Fullscreen Mode**: Drag cursor for a $360^\circ$ view around the rover, drive with `WASD` / Arrow keys or on-screen D-Pad, and press `F` for fullscreen immersion.

---

## Quick Start

### 1. Backend (FastAPI + SPICE + LOLA Engine)
```bash
cd backend
pip install -r requirements.txt
python scripts/fetch_assets.py   # Downloads NAIF SPICE kernels & Celestia textures if missing
pytest                           # Run unit & API test suite
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend (React + TypeScript + Three.js + Zustand)
```bash
cd frontend
npm install
npm run build                    # Builds production bundle into frontend/dist (served by FastAPI on :8000)
# Or run Vite dev server:
npm run dev
```

Open **`http://127.0.0.1:8000`** in your browser.
