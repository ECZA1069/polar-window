import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSim } from "./store";
import { latLonToMe, meToThree } from "./coords";
import LunarRoverExperience, { RoverHUD } from "./LunarRover";

const R = 1; // Moon radius = 1 scene unit = 1737.4 km

export interface LolaCraterEntry {
  id: string;
  name: string;
  lat: number;
  lon: number;
  diameterKm: number;
  radiusDeg: number;
  rimElevM: number;
  floorDepthM: number;
  slopeDeg: number;
  psr: boolean;
  iceStatus: string;
}

export const LOLA_CRATER_DATA: LolaCraterEntry[] = [
  {
    id: "shackleton-connecting-ridge",
    name: "Shackleton Crater & Ridge",
    lat: -89.44,
    lon: 222.5,
    diameterKm: 21.0,
    radiusDeg: 1.35,
    rimElevM: 2140,
    floorDepthM: -4200,
    slopeDeg: 4.2,
    psr: true,
    iceStatus: "PSR Cold Trap (Water Ice Confirmed)",
  },
  {
    id: "peak-near-shackleton",
    name: "Peak Near Shackleton",
    lat: -89.68,
    lon: 166.0,
    diameterKm: 14.5,
    radiusDeg: 1.1,
    rimElevM: 2480,
    floorDepthM: -1850,
    slopeDeg: 5.8,
    psr: false,
    iceStatus: "89% Persistent Solar Peak",
  },
  {
    id: "cabeus-crater",
    name: "Cabeus Crater (LCROSS Impact)",
    lat: -84.9,
    lon: 324.5,
    diameterKm: 98.0,
    radiusDeg: 3.4,
    rimElevM: 1200,
    floorDepthM: -3850,
    slopeDeg: 9.4,
    psr: true,
    iceStatus: "5.6 wt% H2O Ice Plume (LCROSS)",
  },
  {
    id: "shoemaker-rim",
    name: "Shoemaker Crater PSR",
    lat: -88.1,
    lon: 45.0,
    diameterKm: 51.8,
    radiusDeg: 2.1,
    rimElevM: 1420,
    floorDepthM: -3950,
    slopeDeg: 7.2,
    psr: true,
    iceStatus: "Hydrogen-Rich PSR Cold Trap",
  },
  {
    id: "haworth-rim",
    name: "Haworth Crater Rim",
    lat: -87.87,
    lon: 354.5,
    diameterKm: 51.4,
    radiusDeg: 2.05,
    rimElevM: 2100,
    floorDepthM: -3700,
    slopeDeg: 6.5,
    psr: true,
    iceStatus: "Cryogenic 40K PSR Floor",
  },
  {
    id: "faustini-rim-a",
    name: "Faustini Crater Rim A",
    lat: -87.15,
    lon: 77.2,
    diameterKm: 42.5,
    radiusDeg: 1.85,
    rimElevM: 1650,
    floorDepthM: -3450,
    slopeDeg: 6.1,
    psr: true,
    iceStatus: "Deep Polar Cold Trap Basin",
  },
  {
    id: "de-gerlache-rim-1",
    name: "de Gerlache Crater Rim",
    lat: -88.71,
    lon: 291.0,
    diameterKm: 32.7,
    radiusDeg: 1.6,
    rimElevM: 1850,
    floorDepthM: -3600,
    slopeDeg: 5.4,
    psr: true,
    iceStatus: "Artemis III Candidate Ridge + PSR",
  },
  {
    id: "nobile-rim-1-viper",
    name: "Nobile Crater (VIPER Site)",
    lat: -85.39,
    lon: 37.8,
    diameterKm: 79.3,
    radiusDeg: 2.85,
    rimElevM: 1680,
    floorDepthM: -3200,
    slopeDeg: 3.8,
    psr: true,
    iceStatus: "NASA VIPER Ice Drill Target",
  },
  {
    id: "amundsen-rim-plateau",
    name: "Amundsen Crater Central Peak",
    lat: -84.5,
    lon: 85.6,
    diameterKm: 103.4,
    radiusDeg: 3.6,
    rimElevM: 2300,
    floorDepthM: -4100,
    slopeDeg: 4.5,
    psr: true,
    iceStatus: "Terraced Rim + Floor Cold Trap",
  },
  {
    id: "malapert-mountain",
    name: "Malapert Massif & Crater",
    lat: -86.04,
    lon: 2.7,
    diameterKm: 69.0,
    radiusDeg: 2.4,
    rimElevM: 5050,
    floorDepthM: -1900,
    slopeDeg: 8.2,
    psr: false,
    iceStatus: "Continuous Direct Earth LOS Peak",
  },
  {
    id: "leibnitz-beta-plateau",
    name: "Leibnitz Beta Plateau",
    lat: -85.8,
    lon: 331.4,
    diameterKm: 48.0,
    radiusDeg: 1.9,
    rimElevM: 3600,
    floorDepthM: -1200,
    slopeDeg: 3.4,
    psr: false,
    iceStatus: "High-Altitude Artemis III Mesa",
  },
  {
    id: "tycho-central-peak",
    name: "Tycho Crater Central Peak",
    lat: -43.31,
    lon: 348.64,
    diameterKm: 85.0,
    radiusDeg: 3.8,
    rimElevM: 2250,
    floorDepthM: -4800,
    slopeDeg: 14.8,
    psr: false,
    iceStatus: "Young Rayed Impact Basin (108 Myr)",
  },
  {
    id: "copernicus-crater-floor",
    name: "Copernicus Terraced Crater",
    lat: 9.62,
    lon: 339.92,
    diameterKm: 93.0,
    radiusDeg: 4.1,
    rimElevM: 1260,
    floorDepthM: -3760,
    slopeDeg: 11.2,
    psr: false,
    iceStatus: "Olivine Central Peak Complex",
  },
  {
    id: "apollo-17-taurus-littrow",
    name: "Taurus-Littrow (Shorty & Camelot)",
    lat: 20.19,
    lon: 30.77,
    diameterKm: 26.0,
    radiusDeg: 2.2,
    rimElevM: -2550,
    floorDepthM: -2850,
    slopeDeg: 2.1,
    psr: false,
    iceStatus: "Apollo 17 LRV Orange Glass Soil",
  },
  {
    id: "chandrayaan-3-shiv-shakti",
    name: "Shiv Shakti Point (Manzinus Rim)",
    lat: -69.37,
    lon: 32.32,
    diameterKm: 38.0,
    radiusDeg: 2.1,
    rimElevM: 615,
    floorDepthM: -1450,
    slopeDeg: 4.1,
    psr: false,
    iceStatus: "Chandrayaan-3 Southern Highland",
  },
  {
    id: "clavius-basin-lola",
    name: "Clavius Basin (SOFIA H2O Site)",
    lat: -58.4,
    lon: 345.6,
    diameterKm: 231.0,
    radiusDeg: 6.4,
    rimElevM: 1850,
    floorDepthM: -3500,
    slopeDeg: 6.8,
    psr: false,
    iceStatus: "Molecular H2O in Sunlit Regolith",
  },
  {
    id: "schrodinger-basin-lola",
    name: "Schrödinger Impact Basin",
    lat: -75.0,
    lon: 132.4,
    diameterKm: 316.0,
    radiusDeg: 7.5,
    rimElevM: 1500,
    floorDepthM: -4500,
    slopeDeg: 5.1,
    psr: true,
    iceStatus: "Pyroclastic Vent + Polar PSR",
  },
];

function useTex(urls: string[], srgb: boolean) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const loader = new THREE.TextureLoader();
    const go = (list: string[]) => {
      if (!list.length) {
        setFailed(true);
        return;
      }
      loader.load(
        list[0],
        (t) => {
          if (srgb) t.colorSpace = THREE.SRGBColorSpace;
          t.anisotropy = 8;
          setTex(t);
        },
        undefined,
        () => go(list.slice(1))
      );
    };
    go(urls);
  }, []); // eslint-disable-line
  return { tex, failed };
}

function Clock() {
  const acc = useRef(0);
  useFrame((_, dt) => {
    const s = useSim.getState();
    if (!s.playing) return;
    acc.current += dt;
    if (acc.current < 0.1) return;
    s.set({ utcMs: s.utcMs + acc.current * s.speed * 1000 });
    acc.current = 0;
  });
  return null;
}

function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as any;
  const view = useSim((s) => s.view),
    nonce = useSim((s) => s.viewNonce),
    lat = useSim((s) => s.lat),
    lon = useSim((s) => s.lon);
  useEffect(() => {
    if (view === "south") {
      camera.position.set(0, -2.55, 0.55);
    } else if (view === "north") {
      camera.position.set(0, 2.65, 0.65);
    } else {
      const targetDir = meToThree(latLonToMe(lat, lon)).normalize().multiplyScalar(2.65);
      camera.position.copy(targetDir);
    }
    camera.lookAt(0, 0, 0);
    controls?.target.set(0, 0, 0);
    controls?.update();
  }, [view, nonce, camera, controls]); // eslint-disable-line
  return null;
}

const P = (lat: number, lon: number, k = 1.006) =>
  meToThree(latLonToMe(lat, lon)).multiplyScalar(R * k);

function Graticule() {
  const lines = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    for (let lat = -80; lat <= 80; lat += 20) {
      const a: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 6) a.push(P(lat, lon, 1.004));
      out.push(a);
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const a: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 6) a.push(P(lat, lon, 1.004));
      out.push(a);
    }
    return out;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#0284c7" lineWidth={0.9} transparent opacity={0.4} />
      ))}
    </>
  );
}

function Terminator({ sun }: { sun: THREE.Vector3 }) {
  const pts = useMemo(() => {
    const up = Math.abs(sun.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const a = new THREE.Vector3().crossVectors(sun, up).normalize(),
      b = new THREE.Vector3().crossVectors(sun, a).normalize();
    return Array.from({ length: 181 }, (_, i) => {
      const t = (i / 180) * Math.PI * 2;
      return a
        .clone()
        .multiplyScalar(Math.cos(t))
        .add(b.clone().multiplyScalar(Math.sin(t)))
        .multiplyScalar(R * 1.005);
    });
  }, [sun]);
  return <Line points={pts} color="#f59e0b" lineWidth={1.8} transparent opacity={0.85} />;
}

function CraterRing({
  lat,
  lon,
  radiusDeg,
  color = "#00f0ff",
  innerColor = "#0284c7",
  isSelected = false,
  showBowl = true,
  onSelect,
  onHover,
}: {
  lat: number;
  lon: number;
  radiusDeg: number;
  color?: string;
  innerColor?: string;
  isSelected?: boolean;
  showBowl?: boolean;
  onSelect?: () => void;
  onHover?: (hovered: boolean) => void;
}) {
  const { outerPts, innerPts, ticks, centerPos, normalQuat, bowlRadius } = useMemo(() => {
    const centerVec = meToThree(latLonToMe(lat, lon)).normalize();
    const up = Math.abs(centerVec.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(centerVec, up).normalize();
    const v = new THREE.Vector3().crossVectors(centerVec, u).normalize();

    const rad = (radiusDeg * Math.PI) / 180;
    const innerRad = rad * 0.58;
    const segments = 48;
    const outer: THREE.Vector3[] = [];
    const inner: THREE.Vector3[] = [];

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const ca = Math.cos(angle);
      const sa = Math.sin(angle);

      const ox = ca * Math.sin(rad);
      const oy = sa * Math.sin(rad);
      const oz = Math.cos(rad);
      outer.push(
        u
          .clone()
          .multiplyScalar(ox)
          .add(v.clone().multiplyScalar(oy))
          .add(centerVec.clone().multiplyScalar(oz))
          .normalize()
          .multiplyScalar(R * 1.008)
      );

      const ix = ca * Math.sin(innerRad);
      const iy = sa * Math.sin(innerRad);
      const iz = Math.cos(innerRad);
      inner.push(
        u
          .clone()
          .multiplyScalar(ix)
          .add(v.clone().multiplyScalar(iy))
          .add(centerVec.clone().multiplyScalar(iz))
          .normalize()
          .multiplyScalar(R * 1.007)
      );
    }

    // 4 Cardinal Rim Tick Marks (LOLA Altimetry Reticle)
    const tickLines: THREE.Vector3[][] = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((a) => {
      const r1 = rad * 0.85;
      const r2 = rad * 1.22;
      const p1 = u
        .clone()
        .multiplyScalar(Math.cos(a) * Math.sin(r1))
        .add(v.clone().multiplyScalar(Math.sin(a) * Math.sin(r1)))
        .add(centerVec.clone().multiplyScalar(Math.cos(r1)))
        .normalize()
        .multiplyScalar(R * 1.008);
      const p2 = u
        .clone()
        .multiplyScalar(Math.cos(a) * Math.sin(r2))
        .add(v.clone().multiplyScalar(Math.sin(a) * Math.sin(r2)))
        .add(centerVec.clone().multiplyScalar(Math.cos(r2)))
        .normalize()
        .multiplyScalar(R * 1.008);
      return [p1, p2];
    });

    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), centerVec);
    return {
      outerPts: outer,
      innerPts: inner,
      ticks: tickLines,
      centerPos: centerVec.clone().multiplyScalar(R * 1.0065),
      normalQuat: quat,
      bowlRadius: Math.sin(rad) * R * 0.96,
    };
  }, [lat, lon, radiusDeg]);

  return (
    <group>
      {/* Outer LOLA Crater Rim Circle */}
      <Line
        points={outerPts}
        color={isSelected ? "#ffffff" : color}
        lineWidth={isSelected ? 3.2 : 2.2}
        transparent
        opacity={isSelected ? 1.0 : 0.92}
      />

      {/* Inner LOLA Floor / PSR Cold-Trap Contour */}
      <Line
        points={innerPts}
        color={innerColor}
        lineWidth={1.3}
        dashed
        dashSize={0.012}
        gapSize={0.008}
        transparent
        opacity={0.85}
      />

      {/* 4 Cardinal Rim Altimetry Ticks */}
      {ticks.map((t, idx) => (
        <Line key={idx} points={t} color={color} lineWidth={1.6} transparent opacity={0.88} />
      ))}

      {/* Translucent LOLA Crater Basin & Click Target */}
      {showBowl && (
        <mesh
          position={centerPos}
          quaternion={normalQuat}
          onClick={(e) => {
            if (onSelect) {
              e.stopPropagation();
              onSelect();
            }
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            document.body.style.cursor = "pointer";
            onHover?.(true);
          }}
          onPointerOut={() => {
            document.body.style.cursor = "";
            onHover?.(false);
          }}
        >
          <circleGeometry args={[bowlRadius, 36]} />
          <meshBasicMaterial
            color={innerColor}
            transparent
            opacity={isSelected ? 0.36 : 0.2}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}

function Sites() {
  const sites = useSim((s) => s.sites),
    siteId = useSim((s) => s.siteId),
    lat = useSim((s) => s.lat),
    lon = useSim((s) => s.lon),
    select = useSim((s) => s.selectSite);
  return (
    <>
      {sites.map((s) => {
        const isSel = siteId === s.id;
        return (
          <mesh
            key={s.id}
            position={P(s.lat, s.lon, 1.009)}
            onClick={(e) => {
              e.stopPropagation();
              select(s.id);
            }}
            onPointerOver={() => (document.body.style.cursor = "pointer")}
            onPointerOut={() => (document.body.style.cursor = "")}
          >
            <sphereGeometry args={[isSel ? 0.022 : 0.012, 16, 16]} />
            <meshBasicMaterial color={isSel ? "#00f0ff" : "#fbbf24"} />
          </mesh>
        );
      })}
      <CraterRing
        lat={lat}
        lon={lon}
        radiusDeg={1.6}
        color="#00f0ff"
        innerColor="#38bdf8"
        isSelected={true}
        showBowl={false}
      />
    </>
  );
}

function LolaCraters({
  onHoverCrater,
}: {
  onHoverCrater: (c: LolaCraterEntry | null) => void;
}) {
  const siteId = useSim((s) => s.siteId);
  const sites = useSim((s) => s.sites);
  const selectSite = useSim((s) => s.selectSite);
  const setCoords = useSim((s) => s.setCoords);

  const handleSelectCrater = (c: LolaCraterEntry) => {
    const matched = sites.find((s) => s.id === c.id);
    if (matched) {
      selectSite(c.id);
    } else {
      setCoords(c.lat, c.lon);
    }
  };

  return (
    <>
      {LOLA_CRATER_DATA.map((c) => {
        const isSel = siteId === c.id;
        const rimColor = isSel ? "#00f0ff" : c.psr ? "#00f0ff" : "#fbbf24";
        const floorColor = c.psr ? "#0284c7" : "#f59e0b";
        return (
          <CraterRing
            key={c.id}
            lat={c.lat}
            lon={c.lon}
            radiusDeg={c.radiusDeg}
            color={rimColor}
            innerColor={floorColor}
            isSelected={isSel}
            showBowl={true}
            onSelect={() => handleSelectCrater(c)}
            onHover={(h) => onHoverCrater(h ? c : null)}
          />
        );
      })}
    </>
  );
}

function Scene({
  onFail,
  onHoverCrater,
}: {
  onFail: (colorMissing: boolean) => void;
  onHoverCrater: (c: LolaCraterEntry | null) => void;
}) {
  const g = useSim((s) => s.geometry),
    layers = useSim((s) => s.layers);
  const color = useTex(["/assets/moon.jpg", "/assets/moon.png", "/assets/moon.jpeg"], true);
  const normal = useTex(["/assets/moon-normal.png"], false);
  useEffect(() => onFail(color.failed), [color.failed, onFail]);

  const sun = useMemo(() => (g ? meToThree(g.sun_dir_moon_me).normalize() : null), [g]);
  const earth = useMemo(() => (g ? meToThree(g.earth_dir_moon_me).normalize() : null), [g]);
  const useColor = layers.texture && color.tex;

  return (
    <>
      <color attach="background" args={["#03060d"]} />
      <Stars radius={70} depth={40} count={3500} factor={3} fade speed={0.4} />

      {/* Balanced SPICE Sun lighting + Earthshine fill so LOLA craters on both sunlit and polar shadow sides are visible */}
      <ambientLight intensity={sun ? 0.24 : 0.45} />
      <hemisphereLight args={["#94a3b8", "#1e293b", 0.35]} />
      {sun && <directionalLight position={sun.clone().multiplyScalar(25)} intensity={3.8} color="#fffaf0" />}

      <mesh>
        <sphereGeometry args={[R, 128, 64]} />
        <meshStandardMaterial
          map={useColor ? color.tex : null}
          color={useColor ? "#ffffff" : "#64748b"}
          normalMap={layers.relief && normal.tex ? normal.tex : null}
          normalScale={new THREE.Vector2(2.8, 2.8)}
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>

      {layers.graticule && <Graticule />}
      {layers.terminator && sun && <Terminator sun={sun} />}

      {layers.axis && (
        <Line points={[[0, -1.45, 0], [0, 1.45, 0]]} color="#00f0ff" lineWidth={1.2} dashed dashSize={0.05} gapSize={0.04} />
      )}

      {layers.indicators && sun && (
        <>
          <Line points={[[0, 0, 0], sun.clone().multiplyScalar(2.5).toArray()]} color="#fbbf24" lineWidth={1.4} />
          <mesh position={sun.clone().multiplyScalar(2.5)}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#fbbf24" />
          </mesh>
        </>
      )}

      {layers.indicators && earth && (
        <>
          <Line points={[[0, 0, 0], earth.clone().multiplyScalar(2.1).toArray()]} color="#00f0ff" lineWidth={1.4} />
          <mesh position={earth.clone().multiplyScalar(2.1)}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color="#00f0ff" />
          </mesh>
        </>
      )}

      {layers.markers && <Sites />}
      {layers.craters && <LolaCraters onHoverCrater={onHoverCrater} />}
      <CameraRig />
      <Clock />
      <OrbitControls makeDefault enablePan minDistance={1.12} maxDistance={14} enableDamping dampingFactor={0.06} />
    </>
  );
}

export default function MoonView() {
  const [missing, setMissing] = useState(false);
  const [hoveredCrater, setHoveredCrater] = useState<LolaCraterEntry | null>(null);
  const hasGeo = useSim((s) => !!s.geometry),
    health = useSim((s) => s.health),
    view = useSim((s) => s.view),
    siteId = useSim((s) => s.siteId),
    layers = useSim((s) => s.layers);

  const activeCrater = useMemo(() => {
    if (hoveredCrater) return hoveredCrater;
    return LOLA_CRATER_DATA.find((c) => c.id === siteId) ?? LOLA_CRATER_DATA[0];
  }, [hoveredCrater, siteId]);

  if (view === "rover") {
    return (
      <div className="moon-viewport rover-viewport-container">
        <Canvas
          camera={{ fov: 45, near: 0.1, far: 500, position: [0, 2.5, 8] }}
          dpr={[1, 2]}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        >
          <LunarRoverExperience />
        </Canvas>
        {/* Fixed DOM HUD outside Canvas - Never moves/drifts */}
        <RoverHUD />
      </div>
    );
  }

  return (
    <div className="moon-viewport">
      <Canvas
        camera={{ fov: 38, near: 0.01, far: 250, position: [0, -2.55, 0.55] }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.18 }}
      >
        <Scene onFail={setMissing} onHoverCrater={setHoveredCrater} />
      </Canvas>

      {/* Fixed Docked LOLA Crater Altimetry HUD Strip (Top-Center of 3D Moon Viewport) */}
      {layers.craters && activeCrater && (
        <div
          style={{
            position: "absolute",
            top: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(5, 11, 22, 0.88)",
            border: `1px solid ${activeCrater.psr ? "rgba(0, 240, 255, 0.45)" : "rgba(251, 191, 36, 0.45)"}`,
            borderRadius: "6px",
            padding: "6px 14px",
            display: "flex",
            alignItems: "center",
            gap: "14px",
            backdropFilter: "blur(12px)",
            zIndex: 6,
            pointerEvents: "none",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.55)",
            fontFamily: "var(--font-mono)",
            fontSize: "10.5px",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              color: activeCrater.psr ? "var(--cyan)" : "var(--amber)",
              fontWeight: 700,
              letterSpacing: "0.06em",
            }}
          >
            ◉ LOLA CRATER DEM: {activeCrater.name.toUpperCase()}
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            DIA: <b style={{ color: "#fff" }}>{activeCrater.diameterKm} km</b>
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            RIM: <b style={{ color: "var(--emerald)" }}>{activeCrater.rimElevM >= 0 ? `+${activeCrater.rimElevM}` : activeCrater.rimElevM} m</b>
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            FLOOR: <b style={{ color: "var(--cyan)" }}>{activeCrater.floorDepthM} m</b>
          </span>
          <span style={{ color: "var(--text-dim)" }}>
            SLOPE: <b style={{ color: "var(--amber)" }}>{activeCrater.slopeDeg}°</b>
          </span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "3px",
              background: activeCrater.psr ? "rgba(0, 240, 255, 0.14)" : "rgba(251, 191, 36, 0.14)",
              color: activeCrater.psr ? "var(--cyan)" : "var(--amber)",
              fontSize: "9.5px",
            }}
          >
            {activeCrater.iceStatus}
          </span>
        </div>
      )}

      {missing && (
        <div style={{ position: "absolute", top: "70px", left: "20px", background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.4)", borderRadius: "4px", padding: "8px 12px", color: "var(--amber)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
          TEXTURE NOTICE: Celestia Moon texture missing in frontend/public/assets. Showing baseline render.
        </div>
      )}
      {!hasGeo && health !== "offline" && (
        <div style={{ position: "absolute", top: "70px", left: "20px", background: "rgba(56,189,248,0.15)", border: "1px solid rgba(56,189,248,0.4)", borderRadius: "4px", padding: "8px 12px", color: "var(--cyan)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
          SYNCHRONIZING WITH SPICE GEOMETRY KERNELS...
        </div>
      )}
    </div>
  );
}
