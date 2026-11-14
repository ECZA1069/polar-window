import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSim } from "./store";

/* =========================================================================
   1. REAL LUNAR CRATERS, FRACTURED BOULDERS & PHOTOREALISTIC REGOLITH
   ========================================================================= */

export interface LunarCraterDef {
  id: string;
  siteId?: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  depth: number;
  rimHeight: number;
  centralPeak?: number;
  psr?: boolean;
  orangeSoil?: boolean;
}

// 8 Real-Morphology Sculpted Lunar Craters across the 320m x 320m Surface Sector
export const SURFACE_CRATERS: LunarCraterDef[] = [
  {
    id: "camelot",
    siteId: "lrv-expedition-taurus-littrow",
    name: "Camelot Crater (Station 5)",
    x: 24,
    z: 8,
    radius: 16,
    depth: 3.4,
    rimHeight: 1.15,
  },
  {
    id: "shorty",
    siteId: "lrv-expedition-taurus-littrow",
    name: "Shorty Crater (Orange Soil)",
    x: -24,
    z: 18,
    radius: 13,
    depth: 2.9,
    rimHeight: 0.95,
    orangeSoil: true,
  },
  {
    id: "shackleton",
    siteId: "shackleton-connecting-ridge",
    name: "Shackleton Cold-Trap Crater",
    x: 2,
    z: -36,
    radius: 21,
    depth: 4.8,
    rimHeight: 1.45,
    psr: true,
  },
  {
    id: "cabeus",
    siteId: "cabeus-crater",
    name: "Cabeus LCROSS Impact Basin",
    x: 42,
    z: -34,
    radius: 22,
    depth: 4.6,
    rimHeight: 1.35,
    psr: true,
    centralPeak: 1.4,
  },
  {
    id: "nobile",
    siteId: "nobile-rim-1-viper",
    name: "Nobile VIPER Ice Crater",
    x: -38,
    z: -28,
    radius: 15,
    depth: 3.2,
    rimHeight: 1.05,
    psr: true,
  },
  {
    id: "tycho-ray",
    siteId: "tycho-central-peak",
    name: "Tycho Terraced Peak Crater",
    x: 44,
    z: 36,
    radius: 18,
    depth: 3.8,
    rimHeight: 1.25,
    centralPeak: 1.9,
  },
  {
    id: "haworth",
    siteId: "haworth-rim",
    name: "Haworth Polar Pit",
    x: -46,
    z: -2,
    radius: 16,
    depth: 3.7,
    rimHeight: 1.1,
    psr: true,
  },
  {
    id: "lara",
    siteId: "amundsen-rim-plateau",
    name: "Amundsen-Lara Rim Crater",
    x: -4,
    z: 42,
    radius: 14,
    depth: 2.8,
    rimHeight: 0.9,
  },
];

// Deterministic secondary micro-craters (1.8m - 4.5m diameter) for authentic pockmarked lunar surface
const MICRO_CRATERS = Array.from({ length: 28 }, (_, i) => {
  const angle = i * 2.39996 + 0.5;
  const dist = 12 + ((i * 17) % 68);
  return {
    x: Math.cos(angle) * dist,
    z: Math.sin(angle) * dist,
    radius: 1.8 + (i % 5) * 0.65,
    depth: 0.38 + (i % 4) * 0.16,
    rim: 0.14 + (i % 3) * 0.06,
  };
});

export interface LunarRockDef {
  x: number;
  z: number;
  scale: [number, number, number];
  radius: number;
  rot: [number, number, number];
  variant: number;
  driveable: boolean; // rocks with radius < 0.52m can be driven over by individual wheels!
}

// 56 Realistic Fractured Lunar Boulders & Ejecta Cobbles clustered around crater rims
export const SURFACE_BOULDERS: LunarRockDef[] = (() => {
  const list: LunarRockDef[] = [
    // Hand-placed prominent boulders near spawn & Camelot / Shorty rims
    { x: 7.5, z: 5.5, scale: [0.85, 0.62, 0.75], radius: 0.75, rot: [0.2, 0.8, 0.1], variant: 0, driveable: false },
    { x: -4.5, z: 9.2, scale: [0.46, 0.3, 0.44], radius: 0.42, rot: [0.1, 1.4, -0.2], variant: 1, driveable: true },
    { x: 11.2, z: -5.4, scale: [1.15, 0.85, 0.98], radius: 1.0, rot: [-0.2, 2.1, 0.15], variant: 2, driveable: false },
    { x: -13.5, z: 3.2, scale: [0.92, 0.7, 0.84], radius: 0.82, rot: [0.3, 0.4, -0.1], variant: 3, driveable: false },
    { x: 3.8, z: 9.8, scale: [0.38, 0.24, 0.36], radius: 0.36, rot: [0.4, 1.1, 0.2], variant: 1, driveable: true },
    { x: -2.2, z: 6.4, scale: [0.34, 0.2, 0.32], radius: 0.32, rot: [0.1, 0.5, 0.3], variant: 2, driveable: true },
    { x: 5.2, z: -9.5, scale: [0.68, 0.5, 0.62], radius: 0.6, rot: [0.2, 1.9, -0.2], variant: 0, driveable: false },
  ];

  // Add ejecta boulder rings around each major crater rim
  SURFACE_CRATERS.forEach((c, ci) => {
    const count = 6;
    for (let j = 0; j < count; j++) {
      const ang = (j / count) * Math.PI * 2 + ci * 0.7;
      const rDist = c.radius * (0.92 + ((j * 3 + ci) % 5) * 0.08);
      const bx = c.x + Math.cos(ang) * rDist;
      const bz = c.z + Math.sin(ang) * rDist;
      const baseSize = 0.32 + ((ci + j * 2) % 6) * 0.16;
      const isSmall = baseSize < 0.52;
      list.push({
        x: bx,
        z: bz,
        scale: [baseSize * 1.18, baseSize * 0.76, baseSize * 0.96],
        radius: baseSize,
        rot: [(j * 0.3) % 1, ang, ((ci + j) * 0.2) % 1],
        variant: (ci + j) % 4,
        driveable: isSmall,
      });
    }
  });

  return list;
})();

// Evaluate realistic crater profile height contribution at (x, z)
function evalCraterDisplacement(dx: number, dz: number, radius: number, depth: number, rimHeight: number, centralPeak = 0): number {
  const r = Math.sqrt(dx * dx + dz * dz);
  const u = r / radius;
  if (u > 2.3) return 0;

  let h = 0;
  if (u < 1.0) {
    // Realistic flat-bottom / parabolic bowl interior with steep inner wall near u = 1
    const bowl = Math.pow(u, 2.4);
    h -= depth * (1.0 - bowl);
    // Raised rim transition at u -> 1
    h += rimHeight * Math.pow(u, 3.5);
    // Optional central rebound peak for complex lunar craters
    if (centralPeak > 0 && u < 0.32) {
      const pu = u / 0.32;
      h += centralPeak * Math.cos(pu * Math.PI * 0.5) * Math.cos(pu * Math.PI * 0.5);
    }
  } else {
    // Raised ejecta rim decaying outward as exp(-(u-1))
    const out = u - 1.0;
    h += rimHeight * Math.exp(-out * 2.8) * Math.cos(out * 1.1);
  }
  return h;
}

// Continuous terrain height function (excluding small rocks)
export function getLunarHeight(x: number, z: number): number {
  // Large-scale lunar valley & highland undulations
  const roll1 = Math.sin(x * 0.028) * Math.cos(z * 0.032) * 1.35;
  const roll2 = Math.sin(x * 0.011 + 1.4) * Math.cos(z * 0.014) * 2.2;
  // Regolith micro-dunes & ripples
  const ripples =
    Math.sin(x * 0.24 + z * 0.17) * Math.cos(z * 0.29 - x * 0.14) * 0.14 +
    Math.sin(x * 0.65 - z * 0.52) * 0.035;

  // Surrounding South & North Massifs at sector perimeter
  const massifWest = x < -62 ? Math.pow((-x - 62) * 0.045, 1.8) * 4.5 : 0;
  const massifNorth = z < -68 ? Math.pow((-z - 68) * 0.038, 2.0) * 5.2 : 0;

  let craterH = 0;
  for (let i = 0; i < SURFACE_CRATERS.length; i++) {
    const c = SURFACE_CRATERS[i];
    craterH += evalCraterDisplacement(x - c.x, z - c.z, c.radius, c.depth, c.rimHeight, c.centralPeak);
  }

  for (let i = 0; i < MICRO_CRATERS.length; i++) {
    const mc = MICRO_CRATERS[i];
    const dx = x - mc.x;
    const dz = z - mc.z;
    if (Math.abs(dx) < mc.radius * 2 && Math.abs(dz) < mc.radius * 2) {
      craterH += evalCraterDisplacement(dx, dz, mc.radius, mc.depth, mc.rim, 0);
    }
  }

  return roll1 + roll2 + ripples + massifWest + massifNorth + craterH;
}

// Per-wheel contact height including driveable lunar rocks!
export function getWheelGroundHeight(x: number, z: number): number {
  let h = getLunarHeight(x, z);
  for (let i = 0; i < SURFACE_BOULDERS.length; i++) {
    const b = SURFACE_BOULDERS[i];
    if (!b.driveable) continue;
    const dx = x - b.x;
    const dz = z - b.z;
    const dSq = dx * dx + dz * dz;
    const r = b.radius * 1.15;
    if (dSq < r * r) {
      const dome = Math.sqrt(Math.max(0, 1 - dSq / (r * r))) * b.scale[1] * 0.85;
      h += dome;
    }
  }
  return h;
}

// High-detail photorealistic lunar regolith texture with micro-craters & mineral grain
function createPhotorealisticRegolithCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#888b92";
  ctx.fillRect(0, 0, 1024, 1024);

  const imgData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 42;
    const fine = ((i * 13) % 19) - 9;
    const base = 136 + grain + fine * 0.4;
    data[i] = Math.min(255, Math.max(0, base));
    data[i + 1] = Math.min(255, Math.max(0, base - 1));
    data[i + 2] = Math.min(255, Math.max(0, base - 3));
  }
  ctx.putImageData(imgData, 0, 0);

  // Hundreds of multi-scale impact craterlets with sunlit/shadowed rims
  for (let c = 0; c < 220; c++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 1024;
    const r = 1.5 + Math.pow(Math.random(), 2.2) * 26;
    const grad = ctx.createRadialGradient(cx - r * 0.18, cy - r * 0.18, r * 0.05, cx, cy, r);
    grad.addColorStop(0, "rgba(32,34,39,0.78)");
    grad.addColorStop(0.62, "rgba(75,78,84,0.45)");
    grad.addColorStop(0.86, "rgba(182,186,194,0.52)");
    grad.addColorStop(1, "rgba(136,139,146,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

// Photorealistic pitted Lunar Breccia & Basalt Rock Texture
function createLunarRockTextureCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#686d75";
  ctx.fillRect(0, 0, 512, 512);

  const imgData = ctx.getImageData(0, 0, 512, 512);
  const d = imgData.data;
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      const idx = (y * 512 + x) * 4;
      // Layered rock strata & plagioclase clasts
      const band = Math.sin(x * 0.04 + y * 0.09) * 14 + Math.cos(x * 0.15 - y * 0.11) * 9;
      const speckle = Math.random() > 0.92 ? 38 : Math.random() < 0.08 ? -32 : (Math.random() - 0.5) * 24;
      const val = Math.min(245, Math.max(20, 108 + band + speckle));
      d[idx] = val;
      d[idx + 1] = val - 2;
      d[idx + 2] = val - 5;
      d[idx + 3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);

  // Vesicles, cleavage cracks & micrometeorite zap pits
  for (let i = 0; i < 95; i++) {
    const px = Math.random() * 512;
    const py = Math.random() * 512;
    const pr = 1.5 + Math.random() * 9;
    const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
    g.addColorStop(0, "rgba(18,20,24,0.85)");
    g.addColorStop(0.75, "rgba(155,160,168,0.35)");
    g.addColorStop(1, "rgba(104,109,117,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

// Procedural Fractured Lunar Boulder Geometry Generator (High-Detail Faceted Rock)
function createFracturedRockGeometry(seed: number, detail = 3): THREE.BufferGeometry {
  const baseGeo = new THREE.IcosahedronGeometry(1, detail);
  // Convert to non-indexed so flat/sharp fracture facets and smooth normals blend naturally
  const geo = baseGeo.toNonIndexed();
  const pos = geo.attributes.position;

  // Deterministic pseudo-random fracture planes for this rock variant
  const planes = Array.from({ length: 7 }, (_, i) => {
    const theta = (seed * 1.73 + i * 2.19) % (Math.PI * 2);
    const phi = ((seed * 0.91 + i * 1.37) % Math.PI) - Math.PI * 0.5;
    return new THREE.Vector3(
      Math.cos(phi) * Math.cos(theta),
      Math.sin(phi),
      Math.cos(phi) * Math.sin(theta)
    ).normalize();
  });

  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();

    // Multi-frequency 3D rock noise
    const n1 =
      Math.sin(dir.x * 3.2 + seed * 1.7) *
      Math.cos(dir.y * 2.9 - seed * 0.8) *
      Math.sin(dir.z * 3.5 + seed * 2.3);
    const n2 =
      Math.sin(dir.x * 7.5 - dir.z * 6.2 + seed) *
      Math.cos(dir.y * 8.1 + dir.x * 5.4) *
      0.12;
    const n3 = Math.sin(dir.x * 16.0 + dir.y * 14.0 - dir.z * 15.0) * 0.035;

    // Planar rock cleavage / angular chipping
    let fractureCut = 1.0;
    for (let p = 0; p < planes.length; p++) {
      const dot = dir.dot(planes[p]);
      if (dot > 0.58) {
        fractureCut -= (dot - 0.58) * 0.55;
      }
    }

    let r = (0.88 + n1 * 0.22 + n2 + n3) * fractureCut;
    v.copy(dir).multiplyScalar(r);

    // Flatten bottom slightly so boulder sits naturally embedded in lunar regolith
    if (v.y < -0.45) {
      v.y = -0.45 + (v.y + 0.45) * 0.25;
    }

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  return geo;
}

function useLunarTextures() {
  return useMemo(() => {
    const regCanvas = createPhotorealisticRegolithCanvas();
    const regolithTex = new THREE.CanvasTexture(regCanvas);
    regolithTex.wrapS = THREE.RepeatWrapping;
    regolithTex.wrapT = THREE.RepeatWrapping;
    regolithTex.repeat.set(28, 28);
    regolithTex.anisotropy = 8;

    const rockCanvas = createLunarRockTextureCanvas();
    const rockTex = new THREE.CanvasTexture(rockCanvas);
    rockTex.wrapS = THREE.RepeatWrapping;
    rockTex.wrapT = THREE.RepeatWrapping;
    rockTex.repeat.set(2, 2);
    rockTex.anisotropy = 8;

    return { regolithTex, rockTex };
  }, []);
}

/* =========================================================================
   2. TRACY'S ROCK (Apollo 17 Station 6 Split Boulder) & Harrison Schmitt
   ========================================================================= */

function ApolloAstronaut({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
}) {
  return (
    <group position={position} rotation={rotation} scale={0.96}>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.18, 24, 24]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.35} />
      </mesh>
      <mesh position={[0, 1.62, 0.08]} rotation={[0.12, 0, 0]}>
        <sphereGeometry args={[0.145, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.96} roughness={0.06} />
      </mesh>
      <mesh position={[0, 1.18, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.2, 0.65, 16]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.34, 0.12]}>
        <boxGeometry args={[0.09, 0.07, 0.03]} />
        <meshStandardMaterial color="#dc2626" />
      </mesh>
      <mesh position={[0, 1.25, -0.22]} castShadow>
        <boxGeometry args={[0.34, 0.62, 0.22]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.58, -0.2]}>
        <boxGeometry args={[0.3, 0.14, 0.18]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <group position={[-0.26, 1.35, 0]} rotation={[0.42, 0, 0.55]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.07, 0.45, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <boxGeometry args={[0.1, 0.12, 0.1]} />
          <meshStandardMaterial color="#64748b" roughness={0.9} />
        </mesh>
      </group>
      <group position={[0.26, 1.35, 0]} rotation={[-0.22, 0, -0.28]}>
        <mesh position={[0, -0.22, 0]} castShadow>
          <cylinderGeometry args={[0.08, 0.07, 0.45, 12]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
        </mesh>
        <mesh position={[0, -0.48, 0]}>
          <boxGeometry args={[0.1, 0.12, 0.1]} />
          <meshStandardMaterial color="#64748b" roughness={0.9} />
        </mesh>
      </group>
      <mesh position={[-0.14, 0.48, 0]} rotation={[-0.05, 0, 0.04]} castShadow>
        <cylinderGeometry args={[0.1, 0.09, 0.8, 12]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
      </mesh>
      <mesh position={[-0.14, 0.06, 0.06]} castShadow>
        <boxGeometry args={[0.15, 0.12, 0.28]} />
        <meshStandardMaterial color="#475569" roughness={0.95} />
      </mesh>
      <mesh position={[0.14, 0.48, 0]} rotation={[0.08, 0, -0.04]} castShadow>
        <cylinderGeometry args={[0.1, 0.09, 0.8, 12]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
      </mesh>
      <mesh position={[0.14, 0.06, 0.06]} castShadow>
        <boxGeometry args={[0.15, 0.12, 0.28]} />
        <meshStandardMaterial color="#475569" roughness={0.95} />
      </mesh>
    </group>
  );
}

function TracysRock({
  position = [-10, 0, -14],
  rockMat,
  rockGeos,
}: {
  position?: [number, number, number];
  rockMat: THREE.Material;
  rockGeos: THREE.BufferGeometry[];
}) {
  return (
    <group position={position}>
      {/* Main West Split Block */}
      <mesh
        geometry={rockGeos[0]}
        position={[-1.9, 1.85, 0]}
        scale={[4.2, 3.3, 3.6]}
        rotation={[0.12, 0.42, -0.06]}
        castShadow
        receiveShadow
        material={rockMat}
      />
      {/* East Split Cleavage Block */}
      <mesh
        geometry={rockGeos[1]}
        position={[2.5, 1.65, -0.35]}
        scale={[3.5, 2.9, 3.1]}
        rotation={[-0.08, -0.55, 0.11]}
        castShadow
        receiveShadow
        material={rockMat}
      />
      {/* Talus & Spall Fragments */}
      <mesh
        geometry={rockGeos[2]}
        position={[-4.2, 0.65, 2.0]}
        scale={[1.65, 1.15, 1.4]}
        rotation={[0.2, 0.9, 0.1]}
        castShadow
        receiveShadow
        material={rockMat}
      />
      <mesh
        geometry={rockGeos[3]}
        position={[0.5, 0.45, 2.6]}
        scale={[1.15, 0.8, 1.05]}
        rotation={[0.1, 0.2, 0.3]}
        castShadow
        receiveShadow
        material={rockMat}
      />
      <mesh
        geometry={rockGeos[0]}
        position={[4.3, 0.55, 1.6]}
        scale={[1.4, 0.95, 1.25]}
        rotation={[-0.2, 1.2, -0.1]}
        castShadow
        receiveShadow
        material={rockMat}
      />
      <ApolloAstronaut position={[-5.1, 0.1, 2.9]} rotation={[0, 1.25, 0]} />
    </group>
  );
}

/* =========================================================================
   3. DETAILED NASA APOLLO LUNAR ROVING VEHICLE (With Active 4-Wheel Suspension)
   ========================================================================= */

interface LRVModelProps {
  steeringAngle: number;
  wheelRotation: number;
  headlightsOn: boolean;
  wheelOffsets: [number, number, number, number];
}

export const ApolloLRV = React.forwardRef<THREE.Group, LRVModelProps>(
  ({ steeringAngle, wheelRotation, headlightsOn, wheelOffsets }, ref) => {
    const wheelMeshMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#94a3b8",
          wireframe: true,
          metalness: 0.85,
          roughness: 0.25,
        }),
      []
    );

    const chevronMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#cbd5e1",
          metalness: 0.9,
          roughness: 0.2,
        }),
      []
    );

    const goldMLIMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#d97706",
          metalness: 0.92,
          roughness: 0.18,
        }),
      []
    );

    const whiteFenderMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#f8fafc",
          roughness: 0.35,
          metalness: 0.15,
        }),
      []
    );

    const ductTapeMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#dc2626",
          roughness: 0.7,
        }),
      []
    );

    const strutMat = useMemo(
      () =>
        new THREE.MeshStandardMaterial({
          color: "#64748b",
          metalness: 0.85,
          roughness: 0.3,
        }),
      []
    );

    const WireWheel = ({
      isFront,
      isLeft,
      suspOffset,
    }: {
      isFront: boolean;
      isLeft: boolean;
      suspOffset: number;
    }) => {
      const x = isLeft ? -0.88 : 0.88;
      const z = isFront ? 1.15 : -1.15;
      const steer = isFront ? steeringAngle : -steeringAngle * 0.55;

      return (
        <group position={[x, 0.42 + suspOffset, z]}>
          {/* Articulated Upper & Lower Double-Wishbone Suspension Arms + Coilover Damper */}
          <mesh
            position={[isLeft ? 0.24 : -0.24, -suspOffset * 0.5 + 0.04, 0]}
            rotation={[0, 0, (isLeft ? -1 : 1) * Math.atan2(suspOffset, 0.42)]}
            material={strutMat}
          >
            <boxGeometry args={[0.46, 0.035, 0.09]} />
          </mesh>
          <mesh
            position={[isLeft ? 0.24 : -0.24, -suspOffset * 0.5 - 0.05, 0]}
            rotation={[0, 0, (isLeft ? -1 : 1) * Math.atan2(suspOffset, 0.42)]}
            material={strutMat}
          >
            <boxGeometry args={[0.46, 0.035, 0.09]} />
          </mesh>

          <group position={[isLeft ? 0.05 : -0.05, 0.26, 0]}>
            <mesh material={whiteFenderMat} castShadow>
              <cylinderGeometry args={[0.48, 0.48, 0.32, 16, 1, true, -Math.PI * 0.7, Math.PI * 0.7]} />
            </mesh>
            {!isFront && !isLeft && (
              <mesh position={[0, 0.26, 0]} material={ductTapeMat}>
                <boxGeometry args={[0.34, 0.06, 0.28]} />
              </mesh>
            )}
          </group>

          <group rotation={[0, steer, 0]}>
            <group rotation={[wheelRotation, 0, 0]}>
              <mesh rotation={[0, 0, Math.PI / 2]} material={wheelMeshMat} castShadow>
                <cylinderGeometry args={[0.4, 0.4, 0.24, 24, 4, true]} />
              </mesh>

              {Array.from({ length: 8 }).map((_, idx) => {
                const angle = (idx / 8) * Math.PI * 2;
                return (
                  <mesh
                    key={idx}
                    position={[0, Math.sin(angle) * 0.4, Math.cos(angle) * 0.4]}
                    rotation={[angle, 0, 0]}
                    material={chevronMat}
                  >
                    <boxGeometry args={[0.23, 0.03, 0.05]} />
                  </mesh>
                );
              })}

              <mesh rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.13, 0.13, 0.28, 16]} />
                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>
          </group>
        </group>
      );
    };

    return (
      <group ref={ref}>
        <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.5, 0.08, 2.5]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.35} />
        </mesh>

        <mesh position={[0, 0.38, 0.8]}>
          <boxGeometry args={[1.4, 0.06, 0.9]} />
          <primitive object={goldMLIMat} />
        </mesh>

        <mesh position={[-0.72, 0.65, 0]}>
          <boxGeometry args={[0.04, 0.4, 2.4]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.75} />
        </mesh>
        <mesh position={[0.72, 0.65, 0]}>
          <boxGeometry args={[0.04, 0.4, 2.4]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.75} />
        </mesh>
        <mesh position={[0, 0.65, -1.2]}>
          <boxGeometry args={[1.44, 0.4, 0.04]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.75} />
        </mesh>

        {/* Commander Seat */}
        <group position={[-0.32, 0.55, -0.05]}>
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.48, 0.04, 0.45]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.42, -0.22]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.48, 0.55, 0.04]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.42, -0.24]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.52, 0.6, 0.02]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
          </mesh>
          <mesh position={[0, -0.05, 0.35]}>
            <boxGeometry args={[0.42, 0.03, 0.25]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>

        {/* LMP Seat */}
        <group position={[0.32, 0.55, -0.05]}>
          <mesh position={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.48, 0.04, 0.45]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.42, -0.22]} rotation={[-0.2, 0, 0]} castShadow>
            <boxGeometry args={[0.48, 0.55, 0.04]} />
            <meshStandardMaterial color="#1e293b" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0.42, -0.24]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.52, 0.6, 0.02]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
          </mesh>
          <mesh position={[0, -0.05, 0.35]}>
            <boxGeometry args={[0.42, 0.03, 0.25]} />
            <meshStandardMaterial color="#64748b" />
          </mesh>
        </group>

        {/* Center Console & T-Controller */}
        <group position={[0, 0.8, 0.32]}>
          <mesh rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.22, 0.38, 0.12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.08, 0.08]} rotation={[0.4, 0, 0]}>
            <planeGeometry args={[0.18, 0.2]} />
            <meshBasicMaterial color="#00f0ff" opacity={0.85} transparent />
          </mesh>
          <group position={[0, 0.22, 0.04]} rotation={[0.3, 0, -steeringAngle * 0.7]}>
            <mesh>
              <cylinderGeometry args={[0.015, 0.015, 0.18, 8]} />
              <meshStandardMaterial color="#f1f5f9" metalness={0.9} />
            </mesh>
            <mesh position={[0, 0.09, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.018, 0.018, 0.14, 8]} />
              <meshStandardMaterial color="#dc2626" />
            </mesh>
          </group>
        </group>

        {/* High-Gain Dish Antenna */}
        <group position={[-0.45, 0.55, 1.1]}>
          <mesh position={[0, 0.35, 0]}>
            <cylinderGeometry args={[0.025, 0.03, 0.7, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
          </mesh>
          <mesh position={[0, 0.7, 0]}>
            <sphereGeometry args={[0.06, 12, 12]} />
            <primitive object={goldMLIMat} />
          </mesh>
          <group position={[0, 0.85, 0.15]} rotation={[-0.48, 0.38, 0]}>
            <mesh material={goldMLIMat} castShadow>
              <sphereGeometry args={[0.46, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
            </mesh>
            <mesh position={[0, 0, 0.36]}>
              <cylinderGeometry args={[0.012, 0.012, 0.36, 8]} />
              <meshStandardMaterial color="#f8fafc" />
            </mesh>
            <mesh position={[0, 0, 0.54]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.9} />
            </mesh>
          </group>
        </group>

        {/* TV Camera Mast */}
        <group position={[0.45, 0.55, 1.1]}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.02, 0.025, 0.8, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
          </mesh>
          <group position={[0, 0.82, 0.06]}>
            <mesh castShadow>
              <boxGeometry args={[0.16, 0.14, 0.22]} />
              <primitive object={goldMLIMat} />
            </mesh>
            <mesh position={[0, 0, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.045, 0.08, 12]} />
              <meshStandardMaterial color="#0f172a" roughness={0.1} />
            </mesh>
          </group>
          <mesh position={[0.1, 0.9, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.9, 6]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </group>

        {/* Headlights */}
        <group position={[0, 0.48, 1.28]}>
          <mesh position={[-0.4, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[-0.4, 0, 0.045]}>
            <circleGeometry args={[0.05, 12]} />
            <meshBasicMaterial color={headlightsOn ? "#ffffff" : "#64748b"} />
          </mesh>

          <mesh position={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.08, 12]} />
            <meshStandardMaterial color="#334155" />
          </mesh>
          <mesh position={[0.4, 0, 0.045]}>
            <circleGeometry args={[0.05, 12]} />
            <meshBasicMaterial color={headlightsOn ? "#ffffff" : "#64748b"} />
          </mesh>

          {headlightsOn && (
            <spotLight
              position={[0, 0.25, 0.1]}
              target-position={[0, -0.5, 22]}
              intensity={6.0}
              distance={55}
              angle={Math.PI / 4.2}
              penumbra={0.35}
              castShadow
            />
          )}
        </group>

        {/* Rear Science & RTG/Battery Pallet */}
        <group position={[0, 0.6, -0.95]}>
          <mesh position={[-0.32, 0.12, 0]} castShadow>
            <boxGeometry args={[0.42, 0.32, 0.38]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.7} />
          </mesh>
          <mesh position={[0.32, 0.14, 0]} castShadow>
            <boxGeometry args={[0.38, 0.36, 0.34]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh position={[0.32, 0.35, -0.05]} rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.02, 0.02, 0.45, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
          </mesh>
        </group>

        {/* 4 Independent Suspension Wire-Mesh Wheels */}
        <WireWheel isFront={true} isLeft={true} suspOffset={wheelOffsets[0]} />
        <WireWheel isFront={true} isLeft={false} suspOffset={wheelOffsets[1]} />
        <WireWheel isFront={false} isLeft={true} suspOffset={wheelOffsets[2]} />
        <WireWheel isFront={false} isLeft={false} suspOffset={wheelOffsets[3]} />
      </group>
    );
  }
);

/* =========================================================================
   4. TIRE PRINTS / TRACKS IN LUNAR REGOLITH
   ========================================================================= */

interface TrackPoint {
  x: number;
  y: number;
  z: number;
  heading: number;
}

function TireTracksMesh({ tracks }: { tracks: TrackPoint[] }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const trackMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#434850",
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    []
  );

  const quadGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(0.24, 0.35);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);

  useFrame(() => {
    if (!meshRef.current) return;
    const len = tracks.length;
    for (let i = 0; i < len; i++) {
      const t = tracks[i];
      dummy.position.set(t.x, t.y + 0.014, t.z);
      dummy.rotation.set(0, t.heading, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.count = len;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[quadGeo, trackMat, 750]} frustumCulled={false} />;
}

/* =========================================================================
   5. LUNAR DUST PARTICLE ROOSTER TAILS (1/6-G Ballistic Regolith Plume)
   ========================================================================= */

function LunarDustEmitter({
  active,
  position,
  velocity,
  heading,
}: {
  active: boolean;
  position: THREE.Vector3;
  velocity: number;
  heading: number;
}) {
  const count = 52;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: 0,
      y: -100,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0.65 + Math.random() * 0.55,
    }));
  }, [count]);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const isMoving = Math.abs(velocity) > 0.35 && active;
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        if (isMoving) {
          p.life = 0;
          const side = i % 2 === 0 ? -0.88 : 0.88;
          p.x = position.x - sinH * 1.1 + cosH * side + (Math.random() - 0.5) * 0.35;
          p.y = position.y - 0.25;
          p.z = position.z - cosH * 1.1 - sinH * side + (Math.random() - 0.5) * 0.35;
          const kick = -Math.sign(velocity) * (1.2 + Math.abs(velocity) * 0.5 + Math.random() * 1.4);
          p.vx = sinH * kick + (Math.random() - 0.5) * 0.9;
          p.vy = 0.85 + Math.abs(velocity) * 0.28 + Math.random() * 1.1;
          p.vz = cosH * kick + (Math.random() - 0.5) * 0.9;
        } else {
          p.y = -100;
        }
      } else {
        p.vy -= 1.622 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }

      const scale = Math.max(0.01, 0.095 * (1 - p.life / p.maxLife));
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#9ca3af" transparent opacity={0.55} />
    </instancedMesh>
  );
}

/* =========================================================================
   6. 3D LUNAR ROVER CANVAS EXPERIENCE (Multi-Crater Terrain & 4-Wheel Physics)
   ========================================================================= */

export default function LunarRoverExperience() {
  const sim = useSim();
  const roverState = sim.rover;
  const setRover = sim.setRover;
  const { regolithTex, rockTex } = useLunarTextures();

  const roverRef = useRef<THREE.Group>(null);
  const keys = useRef<{ [k: string]: boolean }>({});

  const mouseOrbit = useRef({
    yaw: 0,
    pitch: 0.28,
    distance: 6.8,
    isDragging: false,
    prevX: 0,
    prevY: 0,
    userControlled: false,
  });

  const [tracks, setTracks] = useState<TrackPoint[]>([]);
  const lastTrackPos = useRef(new THREE.Vector2(0, 14));
  const [wheelOffsets, setWheelOffsets] = useState<[number, number, number, number]>([0, 0, 0, 0]);

  const physics = useRef({
    x: roverState.x,
    z: roverState.z,
    y: getWheelGroundHeight(roverState.x, roverState.z) + 0.42,
    vy: 0,
    vx: 0,
    vz: 0,
    heading: roverState.heading,
    forwardSpeed: 0,
    steering: 0,
    wheelAngle: 0,
    pitch: 0,
    roll: 0,
    pitchVel: 0,
    rollVel: 0,
    wheelComp: [0, 0, 0, 0],
    wheelVel: [0, 0, 0, 0],
    airborne: false,
    gForce: 0.16,
    slipDeg: 0,
    distanceTraversed: roverState.distanceM,
    batteryPct: 98.4,
  });

  const threeCamera = useThree((s) => s.camera);

  // Listen for Crater Teleport events from RoverHUD
  useEffect(() => {
    const onTeleport = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; z: number; heading: number }>).detail;
      if (!detail) return;
      const p = physics.current;
      p.x = detail.x;
      p.z = detail.z;
      p.y = getWheelGroundHeight(detail.x, detail.z) + 0.45;
      p.vx = 0;
      p.vz = 0;
      p.vy = 0;
      p.forwardSpeed = 0;
      p.heading = detail.heading;
      mouseOrbit.current.yaw = detail.heading;
      setTracks([]);
      lastTrackPos.current.set(detail.x, detail.z);
    };
    window.addEventListener("rover-teleport", onTeleport);
    return () => window.removeEventListener("rover-teleport", onTeleport);
  }, []);

  // Mouse & Pointer listeners for 360° Cursor Look Around
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest(".moon-viewport")) return;
      if (target.closest("button, input, select, .rover-hud-interactive")) return;
      mouseOrbit.current.isDragging = true;
      mouseOrbit.current.prevX = e.clientX;
      mouseOrbit.current.prevY = e.clientY;
      mouseOrbit.current.userControlled = true;
    };

    const onPointerMove = (e: MouseEvent) => {
      if (!mouseOrbit.current.isDragging) return;
      const dx = e.clientX - mouseOrbit.current.prevX;
      const dy = e.clientY - mouseOrbit.current.prevY;
      mouseOrbit.current.prevX = e.clientX;
      mouseOrbit.current.prevY = e.clientY;

      mouseOrbit.current.yaw -= dx * 0.006;
      mouseOrbit.current.pitch = THREE.MathUtils.clamp(
        mouseOrbit.current.pitch + dy * 0.005,
        -0.18,
        1.18
      );
    };

    const onPointerUp = () => {
      mouseOrbit.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || !target.closest(".moon-viewport")) return;
      mouseOrbit.current.distance = THREE.MathUtils.clamp(
        mouseOrbit.current.distance + e.deltaY * 0.005,
        3.0,
        22.0
      );
    };

    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("mousemove", onPointerMove);
    window.addEventListener("mouseup", onPointerUp);
    window.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, []);

  // Keyboard Event Handling
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      keys.current[e.code] = true;

      if (e.code === "KeyH") {
        setRover({ headlights: !useSim.getState().rover.headlights });
      }
      if (e.code === "KeyC") {
        const modes: ("chase" | "cockpit" | "drone")[] = ["chase", "cockpit", "drone"];
        const cur = useSim.getState().rover.cameraMode;
        const next = modes[(modes.indexOf(cur) + 1) % modes.length];
        setRover({ cameraMode: next });
        mouseOrbit.current.userControlled = false;
      }
      if (e.code === "Digit1") setRover({ driveMode: "eco" });
      if (e.code === "Digit2") setRover({ driveMode: "nominal" });
      if (e.code === "Digit3") setRover({ driveMode: "overdrive" });
      if (e.code === "KeyJ") {
        if (!physics.current.airborne) {
          physics.current.vy = 2.85;
          physics.current.airborne = true;
        }
      }
      if (e.code === "KeyF") {
        sim.toggleFullscreen();
      }
      if (e.code === "KeyR") {
        const p = physics.current;
        p.x = 0;
        p.z = 14;
        p.y = getWheelGroundHeight(0, 14) + 0.42;
        p.vy = 0;
        p.vx = 0;
        p.vz = 0;
        p.heading = 0;
        p.forwardSpeed = 0;
        p.steering = 0;
        setTracks([]);
        lastTrackPos.current.set(0, 14);
      }
      if (e.code === "Escape") {
        if (useSim.getState().fullscreen) sim.toggleFullscreen();
      }
    };

    const onUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    const onBlur = () => {
      keys.current = {};
    };

    window.addEventListener("keydown", onDown, { passive: false });
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [setRover, sim]);

  // High-resolution 240x240 vertex-colored lunar terrain mesh with realistic craters & cold traps
  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(320, 320, 240, 240);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      const py = getLunarHeight(px, pz);
      pos.setY(i, py);

      // Base lunar mare/highland albedo
      c.setRGB(0.62, 0.64, 0.68);

      // Shade crater rims (bright ejecta), floors (dark basalt/PSR cold traps), & Shorty orange glass soil
      for (let k = 0; k < SURFACE_CRATERS.length; k++) {
        const cr = SURFACE_CRATERS[k];
        const dx = px - cr.x;
        const dz = pz - cr.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const u = dist / cr.radius;
        if (u < 0.78) {
          if (cr.psr) {
            // Deep cold-trap shadow floor
            c.lerp(new THREE.Color(0.14, 0.16, 0.2), (1 - u / 0.78) * 0.85);
          } else if (cr.orangeSoil) {
            // Apollo 17 Shorty Crater volcanic orange glass soil!
            c.lerp(new THREE.Color(0.68, 0.42, 0.26), (1 - u / 0.78) * 0.65);
          } else {
            c.lerp(new THREE.Color(0.42, 0.44, 0.48), (1 - u / 0.78) * 0.55);
          }
        } else if (u >= 0.78 && u < 1.55) {
          // Bright fresh Copernican ejecta blanket on crater rim
          const rimFactor = Math.sin(((u - 0.78) / 0.77) * Math.PI);
          c.lerp(new THREE.Color(0.84, 0.86, 0.9), rimFactor * 0.48);
        }
      }

      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, []);

  // 4 Distinct Procedural Fractured Lunar Boulder Geometries & Material
  const rockGeos = useMemo(
    () => [
      createFracturedRockGeometry(1.1, 3),
      createFracturedRockGeometry(2.7, 3),
      createFracturedRockGeometry(4.3, 3),
      createFracturedRockGeometry(6.9, 3),
    ],
    []
  );

  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: rockTex,
        bumpMap: rockTex,
        bumpScale: 0.08,
        color: "#888d96",
        roughness: 0.92,
        metalness: 0.06,
      }),
    [rockTex]
  );

  // Main 1/6-G Multi-Body 4-Wheel Physics & Suspension Loop
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const k = keys.current;
    const p = physics.current;
    const curMode = useSim.getState().rover.driveMode;

    const forward = k["KeyW"] || k["ArrowUp"];
    const reverse = k["KeyS"] || k["ArrowDown"];
    const left = k["KeyA"] || k["ArrowLeft"];
    const right = k["KeyD"] || k["ArrowRight"];
    const brake = k["Space"];
    const boost = k["ShiftLeft"] || k["ShiftRight"];

    const modeMaxSpeed =
      boost || curMode === "overdrive" ? 7.4 : curMode === "eco" ? 2.8 : 4.3;
    const accel = boost || curMode === "overdrive" ? 4.8 : curMode === "eco" ? 2.1 : 3.2;
    const rollingResistance = 0.85;

    // Longitudinal & lateral slope gravity components from real crater walls
    const LUNAR_G = 1.622;
    const longSlopeGravity = -Math.sin(p.pitch) * LUNAR_G * 2.35;
    const latSlopeGravity = -Math.sin(p.roll) * LUNAR_G * 1.85;

    if (brake) {
      p.forwardSpeed = THREE.MathUtils.damp(p.forwardSpeed, 0, 9.5, dt);
    } else if (forward) {
      p.forwardSpeed = Math.min(modeMaxSpeed, p.forwardSpeed + (accel + longSlopeGravity) * dt);
    } else if (reverse) {
      p.forwardSpeed = Math.max(-modeMaxSpeed * 0.65, p.forwardSpeed - (accel * 0.9 - longSlopeGravity) * dt);
    } else {
      p.forwardSpeed = THREE.MathUtils.damp(
        p.forwardSpeed + (Math.abs(longSlopeGravity) > 0.16 ? longSlopeGravity * dt : 0),
        0,
        rollingResistance,
        dt
      );
    }

    // Speed-sensitive 4-wheel Ackermann steering
    const speedFactor = 1.0 / (1.0 + Math.abs(p.forwardSpeed) * 0.12);
    const maxSteer = 0.48 * speedFactor + 0.12;
    const steerRate = 2.9;
    if (left) {
      p.steering = Math.min(maxSteer, p.steering + steerRate * dt);
    } else if (right) {
      p.steering = Math.max(-maxSteer, p.steering - steerRate * dt);
    } else {
      p.steering = THREE.MathUtils.damp(p.steering, 0, 5.5, dt);
    }

    const wheelbase = 2.3;
    const turnGain = p.airborne ? 0.22 : 1.38;
    const headingDelta = (p.forwardSpeed / wheelbase) * Math.sin(p.steering) * turnGain * dt;
    p.heading += headingDelta;

    const sinH = Math.sin(p.heading);
    const cosH = Math.cos(p.heading);

    // Lateral Regolith Traction + Crater Wall Side-Slip Physics
    const rightX = -cosH;
    const rightZ = sinH;
    const targetVx = sinH * p.forwardSpeed + rightX * latSlopeGravity * 0.55;
    const targetVz = cosH * p.forwardSpeed + rightZ * latSlopeGravity * 0.55;
    const traction = p.airborne ? 0.45 : brake ? 3.6 : 5.0;
    p.vx = THREE.MathUtils.damp(p.vx, targetVx, traction, dt);
    p.vz = THREE.MathUtils.damp(p.vz, targetVz, traction, dt);

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Rigid-Body Collision Detection for Large Non-Driveable Boulders & Tracy's Rock
    const colliders = [
      { x: -10, z: -14, r: 5.1 }, // Tracy's Rock complex
      ...SURFACE_BOULDERS.filter((b) => !b.driveable).map((b) => ({
        x: b.x,
        z: b.z,
        r: b.radius * 0.95 + 0.85,
      })),
    ];
    let impactG = 0;
    for (const c of colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < c.r && dist > 0.001) {
        const nx = dx / dist;
        const nz = dz / dist;
        const overlap = c.r - dist;
        p.x += nx * overlap;
        p.z += nz * overlap;
        const vn = p.vx * nx + p.vz * nz;
        if (vn < 0) {
          p.vx -= 1.48 * vn * nx;
          p.vz -= 1.48 * vn * nz;
          p.forwardSpeed *= -0.35;
          // Glancing angular deflection torque
          const cross = nx * sinH - nz * cosH;
          p.heading += cross * 0.18;
          impactG = Math.min(3.2, Math.abs(vn) * 0.72);
        }
      }
    }

    const groundSpeedMs = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
    p.distanceTraversed += groundSpeedMs * dt;
    p.wheelAngle += (p.forwardSpeed / 0.4) * dt;

    if (groundSpeedMs > 0.45) {
      const velAngle = Math.atan2(p.vx, p.vz);
      const diff = ((velAngle - p.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      p.slipDeg = Math.min(45, Math.abs((diff * 180) / Math.PI));
    } else {
      p.slipDeg = THREE.MathUtils.damp(p.slipDeg, 0, 6, dt);
    }

    // 4-Wheel Ground Heights (including craters, micro-craters, AND driveable rocks!)
    const halfTrack = 0.88;
    const halfBase = 1.15;

    const fl_x = p.x + sinH * halfBase - cosH * halfTrack;
    const fl_z = p.z + cosH * halfBase + sinH * halfTrack;

    const fr_x = p.x + sinH * halfBase + cosH * halfTrack;
    const fr_z = p.z + cosH * halfBase - sinH * halfTrack;

    const rl_x = p.x - sinH * halfBase - cosH * halfTrack;
    const rl_z = p.z - cosH * halfBase + sinH * halfTrack;

    const rr_x = p.x - sinH * halfBase + cosH * halfTrack;
    const rr_z = p.z - cosH * halfBase - sinH * halfTrack;

    const y_fl = getWheelGroundHeight(fl_x, fl_z);
    const y_fr = getWheelGroundHeight(fr_x, fr_z);
    const y_rl = getWheelGroundHeight(rl_x, rl_z);
    const y_rr = getWheelGroundHeight(rr_x, rr_z);

    const avgGroundY = (y_fl + y_fr + y_rl + y_rr) / 4;
    const restChassisHeight = 0.42;
    const targetChassisY = avgGroundY + restChassisHeight;

    const prevVy = p.vy;

    if (p.y > targetChassisY + 0.085) {
      // Ballistic 1/6-G Lunar Free-Fall
      p.airborne = true;
      p.vy -= LUNAR_G * 2.15 * dt;
      p.y += p.vy * dt;
      if (p.y <= targetChassisY) {
        p.y = targetChassisY;
        p.airborne = false;
        p.vy = -p.vy * 0.24;
      }
    } else {
      p.airborne = false;
      const terrainVy = (targetChassisY - p.y) / dt;
      if (terrainVy < -2.1 && groundSpeedMs > 3.1) {
        // Launch airborne off raised crater rim!
        p.airborne = true;
        p.vy = Math.max(0.75, p.vy);
      } else {
        const springK = 40.0;
        const damperC = 9.2;
        const disp = targetChassisY - p.y;
        const springAccel = disp * springK - p.vy * damperC;
        p.vy += springAccel * dt;
        p.y += p.vy * dt;
      }
    }

    const vertAccelG = Math.abs((p.vy - prevVy) / dt) / 9.81;
    p.gForce = THREE.MathUtils.lerp(p.gForce, Math.min(3.5, 0.16 + vertAccelG * 0.48 + impactG), 0.25);

    const accelPitchOffset = forward ? -0.038 : brake && groundSpeedMs > 0.5 ? 0.058 : 0;
    const steerRollOffset = p.steering * groundSpeedMs * 0.019;

    const targetPitch =
      Math.atan2((y_fl + y_fr) / 2 - (y_rl + y_rr) / 2, wheelbase) + accelPitchOffset;
    const targetRoll =
      Math.atan2((y_fr + y_rr) / 2 - (y_fl + y_rl) / 2, halfTrack * 2) + steerRollOffset;

    const pitchSpring = (targetPitch - p.pitch) * 44 - p.pitchVel * 8.2;
    const rollSpring = (targetRoll - p.roll) * 44 - p.rollVel * 8.2;
    p.pitchVel += pitchSpring * dt;
    p.rollVel += rollSpring * dt;
    p.pitch += p.pitchVel * dt;
    p.roll += p.rollVel * dt;

    if (roverRef.current) {
      roverRef.current.position.set(p.x, p.y, p.z);
      roverRef.current.rotation.set(-p.pitch, p.heading, p.roll);
    }

    // Individual 4-wheel spring-damper articulation
    const wheelTargets = [
      { wy: y_fl, lx: -halfTrack, lz: halfBase },
      { wy: y_fr, lx: halfTrack, lz: halfBase },
      { wy: y_rl, lx: -halfTrack, lz: -halfBase },
      { wy: y_rr, lx: halfTrack, lz: -halfBase },
    ];
    for (let i = 0; i < 4; i++) {
      const wt = wheelTargets[i];
      let targetOff = -0.12;
      if (!p.airborne) {
        const chassisWheelY = p.y + wt.lz * Math.sin(p.pitch) + wt.lx * Math.sin(p.roll);
        targetOff = THREE.MathUtils.clamp(wt.wy + 0.42 - chassisWheelY, -0.15, 0.18);
      }
      const wSpring = (targetOff - p.wheelComp[i]) * 65 - p.wheelVel[i] * 11;
      p.wheelVel[i] += wSpring * dt;
      p.wheelComp[i] = THREE.MathUtils.clamp(p.wheelComp[i] + p.wheelVel[i] * dt, -0.15, 0.18);
    }

    const currentPos = new THREE.Vector2(p.x, p.z);
    if (!p.airborne && currentPos.distanceTo(lastTrackPos.current) > 0.34) {
      lastTrackPos.current.copy(currentPos);
      const newPrints: TrackPoint[] = [
        { x: fl_x, y: y_fl, z: fl_z, heading: p.heading + p.steering },
        { x: fr_x, y: y_fr, z: fr_z, heading: p.heading + p.steering },
        { x: rl_x, y: y_rl, z: rl_z, heading: p.heading - p.steering * 0.55 },
        { x: rr_x, y: y_rr, z: rr_z, heading: p.heading - p.steering * 0.55 },
      ];
      setTracks((prev) => (prev.length > 680 ? [...prev.slice(4), ...newPrints] : [...prev, ...newPrints]));
    }

    // 360° Mouse Cursor Orbit Camera System
    const orbit = mouseOrbit.current;
    if (!orbit.userControlled) {
      orbit.yaw = THREE.MathUtils.lerp(orbit.yaw, p.heading, 0.055);
    }

    const camMode = useSim.getState().rover.cameraMode;
    if (camMode === "cockpit") {
      const lookYaw = orbit.userControlled ? orbit.yaw : p.heading - p.steering * 0.35;
      const lookPitch = orbit.userControlled ? -orbit.pitch + 0.15 : -p.pitch * 0.8 - 0.05;
      const camPos = new THREE.Vector3(p.x - cosH * 0.25, p.y + 1.18, p.z - sinH * 0.25);
      const lookTarget = new THREE.Vector3(
        p.x + Math.sin(lookYaw) * 16,
        p.y + 1.0 + Math.sin(lookPitch) * 10,
        p.z + Math.cos(lookYaw) * 16
      );
      threeCamera.position.lerp(camPos, 0.28);
      threeCamera.lookAt(lookTarget);
    } else if (camMode === "drone") {
      const dist = orbit.distance * 1.9;
      const camPos = new THREE.Vector3(
        p.x - Math.sin(orbit.yaw) * dist,
        p.y + 9.5 + Math.sin(orbit.pitch) * 6,
        p.z - Math.cos(orbit.yaw) * dist
      );
      threeCamera.position.lerp(camPos, 0.1);
      threeCamera.lookAt(p.x, p.y + 0.5, p.z);
    } else {
      const dist = orbit.distance;
      const horizDist = dist * Math.cos(orbit.pitch);
      const vertDist = Math.max(0.75, dist * Math.sin(orbit.pitch) + 1.2);
      const camPos = new THREE.Vector3(
        p.x - Math.sin(orbit.yaw) * horizDist,
        Math.max(getLunarHeight(p.x, p.z) + 0.5, p.y + vertDist),
        p.z - Math.cos(orbit.yaw) * horizDist
      );
      threeCamera.position.lerp(camPos, 0.16);
      threeCamera.lookAt(p.x, p.y + 0.72, p.z);
    }

    // Sync HUD telemetry at ~12 Hz
    if (Math.floor(state.clock.elapsedTime * 12) !== Math.floor((state.clock.elapsedTime - dt) * 12)) {
      const [c0, c1, c2, c3] = p.wheelComp;
      setWheelOffsets([c0, c1, c2, c3]);
      const toLoadPct = (off: number) =>
        p.airborne ? 0 : Math.round(THREE.MathUtils.clamp(((off + 0.15) / 0.33) * 100, 5, 100));
      const speedKmh = Math.round(groundSpeedMs * 3.6 * 10) / 10;
      const motorKw = Math.round((Math.abs(p.forwardSpeed) * 0.22 + (forward || reverse ? 0.35 : 0.04)) * 100) / 100;
      p.batteryPct = Math.max(12, p.batteryPct - motorKw * 0.0004);

      setRover({
        x: Math.round(p.x * 10) / 10,
        z: Math.round(p.z * 10) / 10,
        heading: Math.round((((p.heading * 180) / Math.PI) % 360 + 360) % 360),
        speedKmh,
        distanceM: Math.round(p.distanceTraversed),
        pitchDeg: Math.round((p.pitch * 180) / Math.PI),
        rollDeg: Math.round((p.roll * 180) / Math.PI),
        airborne: p.airborne,
        gForce: Math.round(p.gForce * 100) / 100,
        slipDeg: Math.round(p.slipDeg),
        wheelLoads: [toLoadPct(c0), toLoadPct(c1), toLoadPct(c2), toLoadPct(c3)],
        motorKw,
        batteryPct: Math.round(p.batteryPct * 10) / 10,
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />

      {/* Low-Angle Lunar Sun Casting Sharp Crater Rim & Boulder Shadows */}
      <directionalLight
        position={[110, 24, 65]}
        intensity={4.8}
        color="#fffcf5"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-65}
        shadow-camera-right={65}
        shadow-camera-top={65}
        shadow-camera-bottom={-65}
        shadow-bias={-0.0004}
      />
      <ambientLight intensity={0.08} color="#cbd5e1" />

      {/* High-Resolution Multi-Crater & Vertex-Shaded Lunar Terrain */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial
          map={regolithTex}
          bumpMap={regolithTex}
          bumpScale={0.11}
          vertexColors
          roughness={0.96}
          metalness={0.03}
        />
      </mesh>

      {/* Distant Lunar Massifs on Horizon */}
      <mesh position={[95, -2, -125]} receiveShadow>
        <coneGeometry args={[78, 34, 32]} />
        <meshStandardMaterial map={regolithTex} color="#8b8f97" roughness={0.98} />
      </mesh>
      <mesh position={[-98, -2, -118]} receiveShadow>
        <coneGeometry args={[72, 29, 32]} />
        <meshStandardMaterial map={regolithTex} color="#7c8088" roughness={0.98} />
      </mesh>
      <mesh position={[0, -4, -155]} receiveShadow>
        <coneGeometry args={[92, 28, 32]} />
        <meshStandardMaterial map={regolithTex} color="#70747c" roughness={0.98} />
      </mesh>

      {/* Subtle Lunar Survey Rim Beacons on each of the 8 Real Craters */}
      {SURFACE_CRATERS.map((c) => {
        const rimX = c.x;
        const rimZ = c.z + c.radius;
        const rimY = getLunarHeight(rimX, rimZ);
        return (
          <group key={c.id} position={[rimX, rimY, rimZ]}>
            <mesh position={[0, 0.75, 0]}>
              <cylinderGeometry args={[0.025, 0.025, 1.5, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.85} />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <sphereGeometry args={[0.09, 12, 12]} />
              <meshBasicMaterial color={c.psr ? "#00f0ff" : "#fbbf24"} />
            </mesh>
          </group>
        );
      })}

      {/* Station 6 Split Boulder (Tracy's Rock) & Astronaut */}
      <TracysRock
        position={[-10, getLunarHeight(-10, -14) - 0.25, -14]}
        rockMat={rockMat}
        rockGeos={rockGeos}
      />

      {/* 56 Realistic Fractured Lunar Boulders & Driveable Ejecta Cobbles */}
      {SURFACE_BOULDERS.map((b, i) => (
        <mesh
          key={i}
          geometry={rockGeos[b.variant % rockGeos.length]}
          material={rockMat}
          position={[b.x, getLunarHeight(b.x, b.z) + b.scale[1] * 0.35, b.z]}
          scale={b.scale}
          rotation={b.rot}
          castShadow
          receiveShadow
        />
      ))}

      {/* Dynamic 4-Wheel Tire Prints */}
      <TireTracksMesh tracks={tracks} />

      <ApolloLRV
        ref={roverRef}
        steeringAngle={physics.current.steering}
        wheelRotation={physics.current.wheelAngle}
        headlightsOn={sim.rover.headlights}
        wheelOffsets={wheelOffsets}
      />

      <LunarDustEmitter
        active={!physics.current.airborne && Math.abs(physics.current.forwardSpeed) > 0.35}
        position={new THREE.Vector3(physics.current.x, physics.current.y, physics.current.z)}
        velocity={physics.current.forwardSpeed}
        heading={physics.current.heading}
      />
    </>
  );
}

/* =========================================================================
   7. NEXT-GEN SCI-FI ROVER COCKPIT, CRATER RADAR & PHYSICS TELEMETRY HUD
   ========================================================================= */

const COMPASS_TICKS = [
  { deg: 0, lbl: "N" },
  { deg: 30, lbl: "030" },
  { deg: 45, lbl: "NE" },
  { deg: 60, lbl: "060" },
  { deg: 90, lbl: "E" },
  { deg: 120, lbl: "120" },
  { deg: 135, lbl: "SE" },
  { deg: 150, lbl: "150" },
  { deg: 180, lbl: "S" },
  { deg: 210, lbl: "210" },
  { deg: 225, lbl: "SW" },
  { deg: 240, lbl: "240" },
  { deg: 270, lbl: "W" },
  { deg: 300, lbl: "300" },
  { deg: 315, lbl: "NW" },
  { deg: 330, lbl: "330" },
];

export function RoverHUD() {
  const sim = useSim();
  const rover = sim.rover;
  const setRover = sim.setRover;

  const triggerKey = (code: string, isDown: boolean) => {
    window.dispatchEvent(new KeyboardEvent(isDown ? "keydown" : "keyup", { code, bubbles: true }));
  };

  const teleportToCrater = (targetId: string) => {
    if (targetId === "station6") {
      window.dispatchEvent(
        new CustomEvent("rover-teleport", { detail: { x: 0, z: 14, heading: 0 } })
      );
      return;
    }
    const c = SURFACE_CRATERS.find((x) => x.id === targetId);
    if (!c) return;
    if (c.siteId) {
      const s = sim.sites.find((site) => site.id === c.siteId);
      if (s) sim.set({ siteId: s.id, lat: s.lat, lon: s.lon });
    }
    // Deploy rover on the rim overlooking the crater bowl
    const spawnX = c.x;
    const spawnZ = c.z + c.radius + 3.5;
    window.dispatchEvent(
      new CustomEvent("rover-teleport", {
        detail: { x: spawnX, z: spawnZ, heading: Math.PI },
      })
    );
  };

  // Find nearest crater to rover
  const nearestCrater = useMemo(() => {
    let best = SURFACE_CRATERS[0];
    let bestDist = Infinity;
    for (const c of SURFACE_CRATERS) {
      const d = Math.hypot(rover.x - c.x, rover.z - c.z);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    const insideBowl = bestDist < best.radius;
    return { crater: best, dist: Math.round(bestDist), insideBowl };
  }, [rover.x, rover.z]);

  const maxSpeedRef = rover.driveMode === "overdrive" ? 26 : rover.driveMode === "eco" ? 10 : 15;
  const speedRatio = Math.min(1, rover.speedKmh / 26);
  const wheelLabels = ["FL", "FR", "RL", "RR"];

  return (
    <div className="rover-hud-root">
      {/* Apollo 70mm Hasselblad Reseau Crosshairs (+) */}
      {rover.showReseau && (
        <div className="reseau-overlay">
          {[
            [20, 25], [50, 25], [80, 25],
            [20, 50], [50, 50], [80, 50],
            [20, 75], [50, 75], [80, 75],
          ].map(([x, y], idx) => (
            <span key={idx} className="reseau-cross" style={{ left: `${x}%`, top: `${y}%` }}>
              +
            </span>
          ))}
        </div>
      )}

      {/* TOP LEFT: Navigation, Crater Sector Teleport Menu & Camera Strip */}
      <div className="rover-top-nav rover-hud-interactive">
        <button
          className="btn-header active"
          style={{
            borderColor: "var(--cyan)",
            color: "#03060d",
            background: "var(--cyan)",
            fontWeight: 700,
            boxShadow: "0 0 14px rgba(0, 240, 255, 0.45)",
          }}
          onClick={() => sim.setView("south")}
        >
          ◀ ORBIT COMMAND
        </button>

        <select
          className="aero-select"
          style={{ width: "215px", height: "28px", padding: "3px 8px", fontSize: "10.5px" }}
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) teleportToCrater(e.target.value);
          }}
          title="Deploy Rover Directly to Any Real Lunar Crater Rim"
        >
          <option value="" disabled>
            JUMP TO SURFACE CRATER ▾
          </option>
          <option value="station6">Station 6 · Tracy&apos;s Rock (Spawn)</option>
          {SURFACE_CRATERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (R={c.radius}m, D={c.depth}m)
            </option>
          ))}
        </select>

        <button
          className="btn-header"
          onClick={() => {
            const modes: ("chase" | "cockpit" | "drone")[] = ["chase", "cockpit", "drone"];
            const next = modes[(modes.indexOf(rover.cameraMode) + 1) % modes.length];
            setRover({ cameraMode: next });
          }}
        >
          CAM: {rover.cameraMode.toUpperCase()} [C]
        </button>
        <button
          className="btn-header"
          onClick={() => setRover({ headlights: !rover.headlights })}
        >
          HALOGEN: {rover.headlights ? "ON" : "OFF"} [H]
        </button>
        <button
          className={`btn-header ${sim.fullscreen ? "active" : ""}`}
          onClick={() => sim.toggleFullscreen()}
        >
          {sim.fullscreen ? "↙ EXIT FULL" : "⛶ FULLSCREEN [F]"}
        </button>
      </div>

      {/* TOP CENTER: 360° Holographic Compass Tape & Nearest Crater Readout */}
      <div className="rover-compass-hud">
        <div className="compass-tape-window">
          {COMPASS_TICKS.map((t) => {
            const diff = ((t.deg - rover.heading + 540) % 360) - 180;
            if (Math.abs(diff) > 95) return null;
            const leftPct = 50 + (diff / 90) * 48;
            const isCardinal = ["N", "E", "S", "W"].includes(t.lbl);
            return (
              <div
                key={t.deg}
                className={`compass-tick ${isCardinal ? "cardinal" : ""}`}
                style={{ left: `${leftPct}%` }}
              >
                <span className="tick-lbl">{t.lbl}</span>
                <span className="tick-line" />
              </div>
            );
          })}
          <div className="compass-center-caret">▼</div>
        </div>
        <div className="compass-readout-box">
          <span>HDG {String(rover.heading).padStart(3, "0")}°</span>
          <span className="sep">·</span>
          <span style={{ color: nearestCrater.insideBowl ? "var(--amber)" : "var(--cyan)" }}>
            {nearestCrater.insideBowl
              ? `IN CRATER: ${nearestCrater.crater.name.toUpperCase()}`
              : `${nearestCrater.crater.name}: ${nearestCrater.dist}M`}
          </span>
          <span className="sep">·</span>
          <span className={rover.airborne ? "airborne-alert" : "surface-ok"}>
            {rover.airborne ? "▲ 1/6G AIRBORNE" : "● SURFACE LOCK"}
          </span>
        </div>
      </div>

      {/* TOP RIGHT: Live Surface Crater LIDAR / Radar Minimap */}
      <div
        className="rover-hud-interactive"
        style={{
          position: "absolute",
          top: "14px",
          right: "16px",
          width: "148px",
          background: "linear-gradient(145deg, rgba(6, 13, 28, 0.92), rgba(3, 8, 18, 0.94))",
          border: "1px solid rgba(0, 240, 255, 0.3)",
          borderRadius: "8px",
          padding: "8px",
          backdropFilter: "blur(12px)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
          zIndex: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: "8.5px",
            color: "var(--cyan)",
            marginBottom: "4px",
            letterSpacing: "0.08em",
          }}
        >
          <span>CRATER LIDAR</span>
          <span>120M SCAN</span>
        </div>
        <svg
          viewBox="-70 -70 140 140"
          style={{
            width: "100%",
            height: "120px",
            background: "radial-gradient(circle, rgba(0,240,255,0.08) 0%, rgba(2,6,14,0.9) 100%)",
            borderRadius: "6px",
            border: "1px solid rgba(0,240,255,0.18)",
          }}
        >
          <circle cx="0" cy="0" r="32" fill="none" stroke="rgba(0,240,255,0.12)" strokeDasharray="2 2" />
          <circle cx="0" cy="0" r="58" fill="none" stroke="rgba(0,240,255,0.12)" strokeDasharray="2 2" />
          {/* Render all 8 real craters on the radar minimap (click to teleport!) */}
          {SURFACE_CRATERS.map((c) => (
            <g
              key={c.id}
              style={{ cursor: "pointer" }}
              onClick={() => teleportToCrater(c.id)}
            >
              <circle
                cx={c.x}
                cy={c.z}
                r={c.radius}
                fill={c.psr ? "rgba(0, 240, 255, 0.14)" : "rgba(251, 191, 36, 0.14)"}
                stroke={c.psr ? "#00f0ff" : "#fbbf24"}
                strokeWidth="1.2"
              />
            </g>
          ))}
          {/* Tracy's Rock Marker */}
          <rect x={-12} y={-16} width="4" height="4" fill="#94a3b8" />
          {/* Rover Position & Heading Triangle */}
          <g transform={`translate(${rover.x}, ${rover.z}) rotate(${180 - rover.heading})`}>
            <polygon points="0,-5 4,4 0,2 -4,4" fill="#34d399" stroke="#fff" strokeWidth="0.7" />
          </g>
        </svg>
      </div>

      {/* BOTTOM LEFT: 4-Wheel Suspension & Inertial Physics Pod */}
      <div className="rover-physics-pod rover-hud-interactive">
        <div className="pod-header">
          <span className="pod-title">CHASSIS & 4-WHEEL SUSPENSION DYNAMICS</span>
          <span className="pod-tag">g = 1.62 m/s²</span>
        </div>

        <div className="physics-pod-grid">
          <div className="wheel-susp-schematic">
            <div className="wheel-bars-grid">
              {(rover.wheelLoads ?? [45, 45, 45, 45]).map((load, i) => {
                const barColor =
                  load === 0
                    ? "var(--text-dim)"
                    : load > 80
                    ? "var(--rose)"
                    : load > 60
                    ? "var(--amber)"
                    : "var(--cyan)";
                return (
                  <div key={i} className="wheel-load-cell">
                    <div className="wheel-load-top">
                      <span>{wheelLabels[i]}</span>
                      <span style={{ color: barColor }}>{load}%</span>
                    </div>
                    <div className="wheel-bar-track">
                      <div
                        className="wheel-bar-fill"
                        style={{ width: `${load}%`, background: barColor, boxShadow: `0 0 8px ${barColor}` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="inertial-metrics-grid">
            <div className="inertial-cell">
              <span className="lbl">G-LOAD</span>
              <span className="val cyan">{rover.gForce.toFixed(2)} G</span>
            </div>
            <div className="inertial-cell">
              <span className="lbl">REGOLITH SLIP</span>
              <span className="val amber">{rover.slipDeg}°</span>
            </div>
            <div className="inertial-cell">
              <span className="lbl">PITCH ANGLE</span>
              <span className="val">{rover.pitchDeg > 0 ? `+${rover.pitchDeg}` : rover.pitchDeg}°</span>
            </div>
            <div className="inertial-cell">
              <span className="lbl">ROLL ANGLE</span>
              <span className="val">{rover.rollDeg > 0 ? `+${rover.rollDeg}` : rover.rollDeg}°</span>
            </div>
          </div>
        </div>

        <div className="rover-keybind-strip">
          <span><b>WASD</b> DRIVE</span>
          <span><b>SHIFT</b> OVERDRIVE</span>
          <span><b>SPACE</b> BRAKE</span>
          <span><b>J</b> 1/6G HOP</span>
          <span><b>DRAG</b> 360° LOOK</span>
          <span><b>R</b> RESET</span>
        </div>
      </div>

      {/* BOTTOM CENTER: Digital Arc Speedometer & Drive Mode Console */}
      <div className="rover-speedo-pod rover-hud-interactive">
        <div className="speedo-arc-wrap">
          <svg viewBox="0 0 180 105" className="speedo-svg">
            <path
              d="M 20 90 A 70 70 0 0 1 160 90"
              fill="none"
              stroke="rgba(56, 189, 248, 0.16)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 20 90 A 70 70 0 0 1 160 90"
              fill="none"
              stroke={rover.driveMode === "overdrive" ? "var(--amber)" : "var(--cyan)"}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray="220"
              strokeDashoffset={220 - speedRatio * 220}
              style={{ transition: "stroke-dashoffset 0.1s linear" }}
            />
          </svg>
          <div className="speedo-center-readout">
            <div className="speedo-digits">{rover.speedKmh.toFixed(1)}</div>
            <div className="speedo-unit">KM/H · MAX {maxSpeedRef}</div>
          </div>
        </div>

        <div className="drive-mode-bar">
          {(["eco", "nominal", "overdrive"] as const).map((m, idx) => (
            <button
              key={m}
              className={`drive-mode-btn ${rover.driveMode === m ? "active" : ""} ${m === "overdrive" ? "overdrive" : ""}`}
              onClick={() => setRover({ driveMode: m })}
            >
              [{idx + 1}] {m.toUpperCase()}
            </button>
          ))}
          <button
            className="drive-mode-btn hop-btn"
            onClick={() => triggerKey("KeyJ", true)}
            title="Test 1/6-G Lunar Suspension Jump (J)"
          >
            ▲ 1/6G HOP [J]
          </button>
        </div>

        <div className="speedo-footer-stats">
          <span>ODO: <b>{rover.distanceM} M</b></span>
          <span>PWR: <b>{rover.motorKw.toFixed(2)} KW</b></span>
          <span>BAT: <b style={{ color: "var(--emerald)" }}>{rover.batteryPct.toFixed(1)}%</b></span>
        </div>
      </div>

      {/* BOTTOM RIGHT: Tactical Touch / Mouse D-Pad Controller */}
      <div className="rover-dpad-container rover-hud-interactive">
        <div className="dpad-row">
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyW", true)}
            onMouseUp={() => triggerKey("KeyW", false)}
            onMouseLeave={() => triggerKey("KeyW", false)}
            onTouchStart={() => triggerKey("KeyW", true)}
            onTouchEnd={() => triggerKey("KeyW", false)}
            title="Throttle Forward (W)"
          >
            ▲
          </button>
        </div>
        <div className="dpad-row">
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyA", true)}
            onMouseUp={() => triggerKey("KeyA", false)}
            onMouseLeave={() => triggerKey("KeyA", false)}
            onTouchStart={() => triggerKey("KeyA", true)}
            onTouchEnd={() => triggerKey("KeyA", false)}
            title="Steer Left (A)"
          >
            ◀
          </button>
          <button
            className="dpad-btn brake-btn"
            onMouseDown={() => triggerKey("Space", true)}
            onMouseUp={() => triggerKey("Space", false)}
            onMouseLeave={() => triggerKey("Space", false)}
            onTouchStart={() => triggerKey("Space", true)}
            onTouchEnd={() => triggerKey("Space", false)}
            title="Emergency Brake (Space)"
          >
            BRAKE
          </button>
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyD", true)}
            onMouseUp={() => triggerKey("KeyD", false)}
            onMouseLeave={() => triggerKey("KeyD", false)}
            onTouchStart={() => triggerKey("KeyD", true)}
            onTouchEnd={() => triggerKey("KeyD", false)}
            title="Steer Right (D)"
          >
            ▶
          </button>
        </div>
        <div className="dpad-row">
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyS", true)}
            onMouseUp={() => triggerKey("KeyS", false)}
            onMouseLeave={() => triggerKey("KeyS", false)}
            onTouchStart={() => triggerKey("KeyS", true)}
            onTouchEnd={() => triggerKey("KeyS", false)}
            title="Reverse (S)"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}
