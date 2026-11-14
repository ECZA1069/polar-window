import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSim } from "./store";
import { latLonToMe, meToThree } from "./coords";
import LunarRoverExperience, { RoverHUD } from "./LunarRover";

const R = 1; // Moon radius = 1 scene unit = 1737.4 km

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
      camera.position.set(0, -3.2, 0.8);
    } else if (view === "north") {
      camera.position.set(0, 3.2, 0.8);
    } else {
      const targetDir = meToThree(latLonToMe(lat, lon)).normalize().multiplyScalar(3.2);
      camera.position.copy(targetDir);
    }
    camera.lookAt(0, 0, 0);
    controls?.target.set(0, 0, 0);
    controls?.update();
  }, [view, nonce, camera, controls]); // eslint-disable-line
  return null;
}

const P = (lat: number, lon: number, k = 1.003) =>
  meToThree(latLonToMe(lat, lon)).multiplyScalar(R * k);

function Graticule() {
  const lines = useMemo(() => {
    const out: THREE.Vector3[][] = [];
    for (let lat = -80; lat <= 80; lat += 20) {
      const a: THREE.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 6) a.push(P(lat, lon));
      out.push(a);
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const a: THREE.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 6) a.push(P(lat, lon));
      out.push(a);
    }
    return out;
  }, []);
  return (
    <>
      {lines.map((pts, i) => (
        <Line key={i} points={pts} color="#0284c7" lineWidth={0.8} transparent opacity={0.35} />
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
        .multiplyScalar(R * 1.003);
    });
  }, [sun]);
  return <Line points={pts} color="#f59e0b" lineWidth={1.5} transparent opacity={0.8} />;
}

function Sites() {
  const lat = useSim((s) => s.lat),
    lon = useSim((s) => s.lon);
  return (
    <>
      <mesh position={P(lat, lon, 1.005)}>
        <sphereGeometry args={[0.02, 16, 16]} />
        <meshBasicMaterial color="#00f0ff" />
      </mesh>
      <CraterRing lat={lat} lon={lon} radiusDeg={1.4} color="#00f0ff" />
    </>
  );
}

const LOLA_CRATER_DATA = [
  { id: "shackleton-connecting-ridge", lat: -89.44, lon: 222.5, radiusDeg: 0.8, psr: true },
  { id: "malapert-mountain", lat: -86.04, lon: 2.7, radiusDeg: 1.5, psr: false },
  { id: "nobile-rim-1-viper", lat: -85.39, lon: 37.8, radiusDeg: 2.4, psr: false },
  { id: "haworth-rim", lat: -87.87, lon: 354.5, radiusDeg: 1.3, psr: true },
  { id: "de-gerlache-rim", lat: -88.5, lon: 271.0, radiusDeg: 1.1, psr: true },
  { id: "amundsen-rim", lat: -84.5, lon: 82.8, radiusDeg: 3.2, psr: false },
  { id: "faustini-rim", lat: -87.3, lon: 77.0, radiusDeg: 1.4, psr: true },
  { id: "cabeus-crater", lat: -84.9, lon: 324.5, radiusDeg: 3.1, psr: true },
  { id: "shoemaker-rim", lat: -88.1, lon: 45.0, radiusDeg: 1.6, psr: true },
  { id: "leibnitz-beta-plateau", lat: -85.8, lon: 330.0, radiusDeg: 1.5, psr: false },
  { id: "peak-near-shackleton", lat: -89.68, lon: 166.0, radiusDeg: 0.7, psr: false },
];

function CraterRing({ lat, lon, radiusDeg, color = "#00f0ff" }: { lat: number; lon: number; radiusDeg: number; color?: string }) {
  const pts = useMemo(() => {
    const centerVec = meToThree(latLonToMe(lat, lon)).normalize();
    const up = Math.abs(centerVec.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(centerVec, up).normalize();
    const v = new THREE.Vector3().crossVectors(centerVec, u).normalize();

    const rad = (radiusDeg * Math.PI) / 180;
    const ringPts: THREE.Vector3[] = [];
    const segments = 36;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const x = Math.cos(angle) * Math.sin(rad);
      const y = Math.sin(angle) * Math.sin(rad);
      const z = Math.cos(rad);
      const pt = u
        .clone()
        .multiplyScalar(x)
        .add(v.clone().multiplyScalar(y))
        .add(centerVec.clone().multiplyScalar(z))
        .normalize()
        .multiplyScalar(R * 1.004);
      ringPts.push(pt);
    }
    return ringPts;
  }, [lat, lon, radiusDeg]);

  return <Line points={pts} color={color} lineWidth={1.3} transparent opacity={0.7} />;
}

function LolaCraters() {
  return (
    <>
      {LOLA_CRATER_DATA.map((c) => (
        <CraterRing
          key={c.id}
          lat={c.lat}
          lon={c.lon}
          radiusDeg={c.radiusDeg}
          color={c.psr ? "rgba(0, 240, 255, 0.75)" : "rgba(251, 191, 36, 0.75)"}
        />
      ))}
    </>
  );
}

function Scene({ onFail }: { onFail: (colorMissing: boolean) => void }) {
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

      {/* Lighting comes only from the SPICE Sun direction */}
      <ambientLight intensity={sun ? 0.025 : 0.25} />
      {sun && <directionalLight position={sun.clone().multiplyScalar(25)} intensity={4.2} color="#fffaf0" />}

      <mesh>
        <sphereGeometry args={[R, 128, 64]} />
        <meshStandardMaterial
          map={useColor ? color.tex : null}
          color={useColor ? "#ffffff" : "#475569"}
          normalMap={layers.relief && normal.tex ? normal.tex : null}
          normalScale={new THREE.Vector2(2.0, 2.0)}
          roughness={0.98}
          metalness={0.02}
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
      {layers.craters && <LolaCraters />}
      <CameraRig />
      <Clock />
      <OrbitControls makeDefault enablePan minDistance={1.12} maxDistance={14} enableDamping dampingFactor={0.06} />
    </>
  );
}

export default function MoonView() {
  const [missing, setMissing] = useState(false);
  const hasGeo = useSim((s) => !!s.geometry),
    health = useSim((s) => s.health),
    view = useSim((s) => s.view);

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
        camera={{ fov: 40, near: 0.01, far: 250, position: [0, -3.2, 0.8] }}
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
      >
        <Scene onFail={setMissing} />
      </Canvas>
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
