import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSim } from "./store";

/* =========================================================================
   1. PROCEDURAL REGOLITH TEXTURE & TAURUS-LITTROW TERRAIN PHYSICS FIELD
   ========================================================================= */

function createPhotorealisticRegolithCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#86898f";
  ctx.fillRect(0, 0, 1024, 1024);

  const imgData = ctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 36;
    const base = 138 + noise;
    data[i] = Math.min(255, Math.max(0, base));
    data[i + 1] = Math.min(255, Math.max(0, base - 2));
    data[i + 2] = Math.min(255, Math.max(0, base - 4));
  }
  ctx.putImageData(imgData, 0, 0);

  // Surface craterlets
  for (let c = 0; c < 140; c++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 1024;
    const r = 2 + Math.random() * 22;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(42,44,49,0.7)");
    grad.addColorStop(0.7, "rgba(85,88,94,0.38)");
    grad.addColorStop(0.9, "rgba(170,174,182,0.45)");
    grad.addColorStop(1, "rgba(138,141,147,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return canvas;
}

function useRegolithTexture() {
  return useMemo(() => {
    const canvas = createPhotorealisticRegolithCanvas();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(24, 24);
    tex.anisotropy = 8;
    return tex;
  }, []);
}

// Continuous terrain height function for Taurus-Littrow valley floor + craters & ridges
export function getLunarHeight(x: number, z: number): number {
  const roll1 = Math.sin(x * 0.032) * Math.cos(z * 0.035) * 1.65;
  const roll2 = Math.sin(x * 0.012 + 1.4) * Math.cos(z * 0.015) * 2.8;
  // Micro-undulations for realistic suspension articulation
  const ripples = Math.sin(x * 0.22 + z * 0.15) * Math.cos(z * 0.27 - x * 0.12) * 0.18;
  const massifSlope = x < -25 ? Math.pow((-x - 25) * 0.045, 1.8) * 4.5 : 0;
  const northMassif = z < -40 ? Math.pow((-z - 40) * 0.038, 2) * 5.2 : 0;

  // Primary Camelot Crater (with raised rim for 1/6-G jumps)
  const cdx = x - 16;
  const cdz = z - 8;
  const dist1 = Math.sqrt(cdx * cdx + cdz * cdz);
  const crater1 =
    dist1 < 14
      ? (Math.cos((dist1 / 14) * Math.PI) - 1.0) * 1.45 + Math.exp(-Math.pow(dist1 - 12.5, 2) / 3.5) * 0.65
      : 0;

  // Secondary Shorty Crater
  const sdx = x + 18;
  const sdz = z - 22;
  const dist2 = Math.sqrt(sdx * sdx + sdz * sdz);
  const crater2 =
    dist2 < 10
      ? (Math.cos((dist2 / 10) * Math.PI) - 1.0) * 1.1 + Math.exp(-Math.pow(dist2 - 8.8, 2) / 2.5) * 0.55
      : 0;

  return roll1 + roll2 + ripples + massifSlope + northMassif + crater1 + crater2;
}

// Surface boulders with collision radii
const SURFACE_BOULDERS: { pos: [number, number, number]; scale: number }[] = [
  { pos: [7, 0, 5], scale: 0.65 },
  { pos: [-4, 0, 9], scale: 0.48 },
  { pos: [12, 0, -6], scale: 0.9 },
  { pos: [-14, 0, 3], scale: 0.75 },
  { pos: [4, 0, -11], scale: 0.52 },
  { pos: [18, 0, 12], scale: 1.15 },
  { pos: [-8, 0, 19], scale: 0.6 },
  { pos: [-2, 0, -4], scale: 0.38 },
  { pos: [9, 0, 18], scale: 0.72 },
  { pos: [-15, 0, -8], scale: 0.85 },
];

/* =========================================================================
   2. TRACY'S ROCK (Apollo 17 Station 6) & Harrison Schmitt Figure
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

function TracysRock({ position = [-9, 0, -14] }: { position?: [number, number, number] }) {
  const rockMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#555b63",
        roughness: 0.95,
        metalness: 0.05,
      }),
    []
  );

  return (
    <group position={position}>
      <mesh position={[-1.8, 2.2, 0]} rotation={[0.18, 0.35, -0.09]} castShadow receiveShadow material={rockMat}>
        <dodecahedronGeometry args={[3.4, 2]} />
      </mesh>
      <mesh position={[2.4, 1.9, -0.4]} rotation={[-0.12, -0.42, 0.14]} castShadow receiveShadow material={rockMat}>
        <dodecahedronGeometry args={[2.9, 2]} />
      </mesh>
      <mesh position={[-3.8, 0.7, 1.8]} rotation={[0.4, 0.7, 0.2]} castShadow receiveShadow material={rockMat}>
        <dodecahedronGeometry args={[1.3, 1]} />
      </mesh>
      <mesh position={[0.4, 0.5, 2.4]} rotation={[0.2, 0.1, 0.6]} castShadow receiveShadow material={rockMat}>
        <dodecahedronGeometry args={[0.95, 1]} />
      </mesh>
      <mesh position={[4.1, 0.6, 1.4]} rotation={[-0.3, 0.5, -0.2]} castShadow receiveShadow material={rockMat}>
        <dodecahedronGeometry args={[1.2, 1]} />
      </mesh>
      <ApolloAstronaut position={[-4.8, 0, 2.8]} rotation={[0, 1.25, 0]} />
    </group>
  );
}

/* =========================================================================
   3. DETAILED NASA APOLLO LUNAR ROVING VEHICLE (With Active Suspension)
   ========================================================================= */

interface LRVModelProps {
  steeringAngle: number;
  wheelRotation: number;
  headlightsOn: boolean;
  wheelOffsets: [number, number, number, number]; // FL, FR, RL, RR vertical travel (m)
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
      // Apollo LRV featured 4-wheel double-Ackermann steering (rear wheels counter-steer)
      const steer = isFront ? steeringAngle : -steeringAngle * 0.55;

      return (
        <group position={[x, 0.42 + suspOffset, z]}>
          {/* Double-wishbone suspension A-arm linking chassis to wheel hub */}
          <mesh
            position={[isLeft ? 0.24 : -0.24, -suspOffset * 0.5, 0]}
            rotation={[0, 0, (isLeft ? -1 : 1) * Math.atan2(suspOffset, 0.42)]}
            material={strutMat}
          >
            <boxGeometry args={[0.46, 0.045, 0.12]} />
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
              distance={50}
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
        color: "#4a4f57",
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
      dummy.position.set(t.x, t.y + 0.012, t.z);
      dummy.rotation.set(0, t.heading, 0);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.count = len;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={meshRef} args={[quadGeo, trackMat, 700]} frustumCulled={false} />;
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
  const count = 48;
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
        // Real 1/6-G lunar ballistic gravity (no air drag!)
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
   6. 3D LUNAR ROVER CANVAS EXPERIENCE (1/6-G Physics, Suspension & Collisions)
   ========================================================================= */

export default function LunarRoverExperience() {
  const sim = useSim();
  const roverState = sim.rover;
  const setRover = sim.setRover;
  const regolithTex = useRegolithTexture();

  const roverRef = useRef<THREE.Group>(null);
  const keys = useRef<{ [k: string]: boolean }>({});

  // 360° Mouse Look Orbit State
  const mouseOrbit = useRef({
    yaw: 0,
    pitch: 0.28,
    distance: 6.8,
    isDragging: false,
    prevX: 0,
    prevY: 0,
    userControlled: false,
  });

  // Track prints history
  const [tracks, setTracks] = useState<TrackPoint[]>([]);
  const lastTrackPos = useRef(new THREE.Vector2(0, 14));
  const [wheelOffsets, setWheelOffsets] = useState<[number, number, number, number]>([0, 0, 0, 0]);

  // Full 1/6-G Rigid-Body + 4-Wheel Spring-Damper Physics State
  const physics = useRef({
    x: roverState.x,
    z: roverState.z,
    y: getLunarHeight(roverState.x, roverState.z) + 0.42,
    vy: 0,               // vertical velocity (m/s) under 1.622 m/s² lunar gravity
    vx: 0,               // world X velocity (for regolith lateral drift)
    vz: 0,               // world Z velocity
    heading: roverState.heading,
    forwardSpeed: 0,     // wheel drive speed
    steering: 0,
    wheelAngle: 0,
    pitch: 0,
    roll: 0,
    pitchVel: 0,
    rollVel: 0,
    airborne: false,
    gForce: 0.16,
    slipDeg: 0,
    distanceTraversed: roverState.distanceM,
    batteryPct: 98.4,
  });

  const threeCamera = useThree((s) => s.camera);

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
        20.0
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

  // Safe Keyboard Event Handling
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
        // 1/6-G Suspension Jump / Hop test
        if (!physics.current.airborne) {
          physics.current.vy = 2.6;
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
        p.y = getLunarHeight(0, 14) + 0.42;
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

  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(280, 280, 180, 180);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i);
      const pz = pos.getZ(i);
      pos.setY(i, getLunarHeight(px, pz));
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Main 1/6-G Physics & Suspension Loop
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

    // Speed & Torque profiles per Drive Mode (Apollo LRV nominal max ~14 km/h, record 18 km/h, Overdrive 26 km/h)
    const modeMaxSpeed =
      boost || curMode === "overdrive" ? 7.2 : curMode === "eco" ? 2.8 : 4.2;
    const accel = boost || curMode === "overdrive" ? 4.4 : curMode === "eco" ? 2.0 : 3.0;
    const rollingResistance = 0.85;

    // Slope gravity effect along rover pitch
    const slopeGravity = -Math.sin(p.pitch) * 1.622 * 2.1;

    if (brake) {
      p.forwardSpeed = THREE.MathUtils.damp(p.forwardSpeed, 0, 9.5, dt);
    } else if (forward) {
      p.forwardSpeed = Math.min(modeMaxSpeed, p.forwardSpeed + (accel + slopeGravity) * dt);
    } else if (reverse) {
      p.forwardSpeed = Math.max(-modeMaxSpeed * 0.65, p.forwardSpeed - (accel * 0.9 - slopeGravity) * dt);
    } else {
      p.forwardSpeed = THREE.MathUtils.damp(
        p.forwardSpeed + (Math.abs(slopeGravity) > 0.22 ? slopeGravity * dt : 0),
        0,
        rollingResistance,
        dt
      );
    }

    // Speed-sensitive Ackermann steering
    const speedFactor = 1.0 / (1.0 + Math.abs(p.forwardSpeed) * 0.12);
    const maxSteer = 0.48 * speedFactor + 0.12;
    const steerRate = 2.8;
    if (left) {
      p.steering = Math.min(maxSteer, p.steering + steerRate * dt);
    } else if (right) {
      p.steering = Math.max(-maxSteer, p.steering - steerRate * dt);
    } else {
      p.steering = THREE.MathUtils.damp(p.steering, 0, 5.5, dt);
    }

    // 4-wheel steering angular velocity (tighter turning radius due to counter-steering rear wheels)
    const wheelbase = 2.3;
    const turnGain = p.airborne ? 0.25 : 1.35;
    const headingDelta = (p.forwardSpeed / wheelbase) * Math.sin(p.steering) * turnGain * dt;
    p.heading += headingDelta;

    const sinH = Math.sin(p.heading);
    const cosH = Math.cos(p.heading);

    // Lateral Regolith Traction & Drift Physics
    const targetVx = sinH * p.forwardSpeed;
    const targetVz = cosH * p.forwardSpeed;
    const traction = p.airborne ? 0.5 : brake ? 3.5 : 5.2;
    p.vx = THREE.MathUtils.damp(p.vx, targetVx, traction, dt);
    p.vz = THREE.MathUtils.damp(p.vz, targetVz, traction, dt);

    p.x += p.vx * dt;
    p.z += p.vz * dt;

    // Boulder & Tracy's Rock Collision Detection
    const colliders = [
      { x: -9, z: -14, r: 4.8 }, // Tracy's Rock
      ...SURFACE_BOULDERS.map((b) => ({ x: b.pos[0], z: b.pos[2], r: b.scale * 0.95 + 0.85 })),
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
          p.vx -= 1.45 * vn * nx;
          p.vz -= 1.45 * vn * nz;
          p.forwardSpeed *= -0.35;
          impactG = Math.min(2.8, Math.abs(vn) * 0.65);
        }
      }
    }

    const groundSpeedMs = Math.sqrt(p.vx * p.vx + p.vz * p.vz);
    p.distanceTraversed += groundSpeedMs * dt;
    p.wheelAngle += (p.forwardSpeed / 0.4) * dt;

    // Compute Slip Angle (degrees between heading vector and actual velocity vector)
    if (groundSpeedMs > 0.45) {
      const velAngle = Math.atan2(p.vx, p.vz);
      let diff = ((velAngle - p.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      p.slipDeg = Math.min(45, Math.abs((diff * 180) / Math.PI));
    } else {
      p.slipDeg = THREE.MathUtils.damp(p.slipDeg, 0, 6, dt);
    }

    // 4-Wheel Ground Heights & Independent Spring-Damper Suspension
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

    const y_fl = getLunarHeight(fl_x, fl_z);
    const y_fr = getLunarHeight(fr_x, fr_z);
    const y_rl = getLunarHeight(rl_x, rl_z);
    const y_rr = getLunarHeight(rr_x, rr_z);

    const avgGroundY = (y_fl + y_fr + y_rl + y_rr) / 4;
    const restChassisHeight = 0.42;
    const targetChassisY = avgGroundY + restChassisHeight;

    // Vertical 1/6-G Lunar Gravity & Suspension Spring-Damper Physics
    const LUNAR_G = 1.622; // m/s²
    const prevVy = p.vy;

    if (p.y > targetChassisY + 0.09) {
      // Rover is airborne under 1/6th lunar gravity!
      p.airborne = true;
      p.vy -= LUNAR_G * 2.1 * dt;
      p.y += p.vy * dt;
      if (p.y <= targetChassisY) {
        p.y = targetChassisY;
        p.airborne = false;
        // Compress springs on touchdown
        p.vy = -p.vy * 0.22;
      }
    } else {
      p.airborne = false;
      // Spring-damper tracking terrain height changes (allows launching off sharp crests!)
      const terrainVy = (targetChassisY - p.y) / dt;
      if (terrainVy < -2.2 && groundSpeedMs > 3.2) {
        // Launch airborne off crest!
        p.airborne = true;
        p.vy = Math.max(0.6, p.vy);
      } else {
        const springK = 38.0;
        const damperC = 9.5;
        const disp = targetChassisY - p.y;
        const springAccel = disp * springK - p.vy * damperC;
        p.vy += springAccel * dt;
        p.y += p.vy * dt;
      }
    }

    // Calculate G-Force (0.16G nominal lunar gravity + vertical acceleration + impact)
    const vertAccelG = Math.abs((p.vy - prevVy) / dt) / 9.81;
    p.gForce = THREE.MathUtils.lerp(p.gForce, Math.min(3.5, 0.16 + vertAccelG * 0.45 + impactG), 0.25);

    // Pitch & Roll Spring-Damper Dynamics (including acceleration squat & brake dive!)
    const accelPitchOffset = (forward ? -0.035 : brake && groundSpeedMs > 0.5 ? 0.055 : 0);
    const steerRollOffset = p.steering * groundSpeedMs * 0.018;

    const targetPitch =
      Math.atan2((y_fl + y_fr) / 2 - (y_rl + y_rr) / 2, wheelbase) + accelPitchOffset;
    const targetRoll =
      Math.atan2((y_fr + y_rr) / 2 - (y_fl + y_rl) / 2, halfTrack * 2) + steerRollOffset;

    const pitchSpring = (targetPitch - p.pitch) * 42 - p.pitchVel * 8.5;
    const rollSpring = (targetRoll - p.roll) * 42 - p.rollVel * 8.5;
    p.pitchVel += pitchSpring * dt;
    p.rollVel += rollSpring * dt;
    p.pitch += p.pitchVel * dt;
    p.roll += p.rollVel * dt;

    if (roverRef.current) {
      roverRef.current.position.set(p.x, p.y, p.z);
      roverRef.current.rotation.set(-p.pitch, p.heading, p.roll);
    }

    // Individual 4-wheel vertical travel offsets & compression %
    const computeWheelOffset = (wy: number, wxLocal: number, wzLocal: number) => {
      if (p.airborne) return -0.11; // wheels droop in mid-air
      const chassisWheelY = p.y + wzLocal * Math.sin(p.pitch) + wxLocal * Math.sin(p.roll);
      return THREE.MathUtils.clamp(wy + 0.42 - chassisWheelY, -0.14, 0.16);
    };

    const offFL = computeWheelOffset(y_fl, -halfTrack, halfBase);
    const offFR = computeWheelOffset(y_fr, halfTrack, halfBase);
    const offRL = computeWheelOffset(y_rl, -halfTrack, -halfBase);
    const offRR = computeWheelOffset(y_rr, halfTrack, -halfBase);

    // Add Tire Prints when wheels are in contact with regolith
    const currentPos = new THREE.Vector2(p.x, p.z);
    if (!p.airborne && currentPos.distanceTo(lastTrackPos.current) > 0.34) {
      lastTrackPos.current.copy(currentPos);
      const newPrints: TrackPoint[] = [
        { x: fl_x, y: y_fl, z: fl_z, heading: p.heading + p.steering },
        { x: fr_x, y: y_fr, z: fr_z, heading: p.heading + p.steering },
        { x: rl_x, y: y_rl, z: rl_z, heading: p.heading - p.steering * 0.55 },
        { x: rr_x, y: y_rr, z: rr_z, heading: p.heading - p.steering * 0.55 },
      ];
      setTracks((prev) => (prev.length > 640 ? [...prev.slice(4), ...newPrints] : [...prev, ...newPrints]));
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
      // Chase 360° Orbit Camera
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

    // Update HUD telemetry at ~12 Hz
    if (Math.floor(state.clock.elapsedTime * 12) !== Math.floor((state.clock.elapsedTime - dt) * 12)) {
      setWheelOffsets([offFL, offFR, offRL, offRR]);
      const toLoadPct = (off: number) =>
        p.airborne ? 0 : Math.round(THREE.MathUtils.clamp(((off + 0.14) / 0.3) * 100, 5, 100));
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
        wheelLoads: [toLoadPct(offFL), toLoadPct(offFR), toLoadPct(offRL), toLoadPct(offRR)],
        motorKw,
        batteryPct: Math.round(p.batteryPct * 10) / 10,
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />

      <directionalLight
        position={[90, 26, 55]}
        intensity={4.6}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0005}
      />
      <ambientLight intensity={0.07} color="#cbd5e1" />

      {/* Taurus-Littrow Lunar Regolith Terrain */}
      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial
          map={regolithTex}
          bumpMap={regolithTex}
          bumpScale={0.09}
          color="#9a9ea6"
          roughness={0.96}
          metalness={0.03}
        />
      </mesh>

      {/* Distant Sculptured Hills & South Massif */}
      <mesh position={[68, -2, -95]} receiveShadow>
        <coneGeometry args={[62, 28, 32]} />
        <meshStandardMaterial map={regolithTex} color="#8b8f97" roughness={0.98} />
      </mesh>
      <mesh position={[-75, -2, -88]} receiveShadow>
        <coneGeometry args={[58, 24, 32]} />
        <meshStandardMaterial map={regolithTex} color="#7c8088" roughness={0.98} />
      </mesh>
      <mesh position={[0, -4, -125]} receiveShadow>
        <coneGeometry args={[75, 22, 32]} />
        <meshStandardMaterial map={regolithTex} color="#70747c" roughness={0.98} />
      </mesh>

      {/* Station 6 Split Boulder (Tracy's Rock) & Astronaut */}
      <TracysRock position={[-9, getLunarHeight(-9, -14) - 0.3, -14]} />

      {/* Collidable Lunar Boulders */}
      {SURFACE_BOULDERS.map((b, i) => (
        <mesh
          key={i}
          position={[b.pos[0], getLunarHeight(b.pos[0], b.pos[2]) + b.scale * 0.45, b.pos[2]]}
          rotation={[i * 0.45, i * 1.1, i * 0.35]}
          castShadow
          receiveShadow
        >
          <dodecahedronGeometry args={[b.scale, 1]} />
          <meshStandardMaterial color="#555a62" roughness={0.95} />
        </mesh>
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
   7. NEXT-GEN SCI-FI ROVER COCKPIT & PHYSICS TELEMETRY HUD
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

      {/* TOP LEFT: Navigation & Camera Mode Strip */}
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
          className="btn-header"
          onClick={() => setRover({ showReseau: !rover.showReseau })}
        >
          RETICLE: {rover.showReseau ? "ON" : "OFF"}
        </button>
        <button
          className={`btn-header ${sim.fullscreen ? "active" : ""}`}
          onClick={() => sim.toggleFullscreen()}
        >
          {sim.fullscreen ? "↙ EXIT FULL" : "⛶ FULLSCREEN [F]"}
        </button>
      </div>

      {/* TOP CENTER: 360° Holographic Compass Tape */}
      <div className="rover-compass-hud">
        <div className="compass-tape-window">
          {COMPASS_TICKS.map((t) => {
            let diff = ((t.deg - rover.heading + 540) % 360) - 180;
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
          <span>POS ({rover.x.toFixed(0)}m, {rover.z.toFixed(0)}m)</span>
          <span className="sep">·</span>
          <span className={rover.airborne ? "airborne-alert" : "surface-ok"}>
            {rover.airborne ? "▲ 1/6G AIRBORNE" : "● SURFACE LOCK"}
          </span>
        </div>
      </div>

      {/* BOTTOM LEFT: 4-Wheel Suspension & Inertial Physics Pod */}
      <div className="rover-physics-pod rover-hud-interactive">
        <div className="pod-header">
          <span className="pod-title">CHASSIS & 4-WHEEL SUSPENSION DYNAMICS</span>
          <span className="pod-tag">g = 1.62 m/s²</span>
        </div>

        <div className="physics-pod-grid">
          {/* 4-Wheel Suspension Load Bars */}
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

          {/* Pitch / Roll / G-Force / Slip */}
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

        {/* Keybinds Legend Strip */}
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

        {/* Drive Gear Selector + 1/6G Hop Button */}
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
