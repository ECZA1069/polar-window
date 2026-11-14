import React, { useRef, useState, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useSim } from "./store";

/* =========================================================================
   1. PROCEDURAL REGOLITH TEXTURE & TAURUS-LITTROW TERRAIN
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
  for (let c = 0; c < 120; c++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 1024;
    const r = 2 + Math.random() * 20;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(45,47,52,0.65)");
    grad.addColorStop(0.7, "rgba(85,88,94,0.35)");
    grad.addColorStop(0.9, "rgba(165,168,175,0.4)");
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

// Continuous terrain height function for Taurus-Littrow valley floor
export function getLunarHeight(x: number, z: number): number {
  const roll1 = Math.sin(x * 0.03) * Math.cos(z * 0.035) * 1.6;
  const roll2 = Math.sin(x * 0.012 + 1.4) * Math.cos(z * 0.015) * 2.8;
  const massifSlope = x < -25 ? Math.pow((-x - 25) * 0.045, 1.8) * 4.5 : 0;
  const northMassif = z < -40 ? Math.pow((-z - 40) * 0.038, 2) * 5.2 : 0;
  const cdx = x - 16;
  const cdz = z - 8;
  const distSq = cdx * cdx + cdz * cdz;
  const crater = distSq < 196 ? (Math.cos((Math.sqrt(distSq) / 14) * Math.PI) - 1.0) * 1.4 : 0;
  return roll1 + roll2 + massifSlope + northMassif + crater;
}

/* =========================================================================
   2. TRACY'S ROCK (Apollo 17 Station 6) & Harrison Schmitt Figure
   ========================================================================= */

function ApolloAstronaut({ position = [0, 0, 0], rotation = [0, 0, 0] }: { position?: [number, number, number]; rotation?: [number, number, number] }) {
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
   3. DETAILED NASA APOLLO LUNAR ROVING VEHICLE (LRV)
   ========================================================================= */

interface LRVModelProps {
  steeringAngle: number;
  wheelRotation: number;
  headlightsOn: boolean;
}

export const ApolloLRV = React.forwardRef<THREE.Group, LRVModelProps>(
  ({ steeringAngle, wheelRotation, headlightsOn }, ref) => {
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

    const WireWheel = ({ isFront, isLeft }: { isFront: boolean; isLeft: boolean }) => {
      const x = isLeft ? -0.88 : 0.88;
      const z = isFront ? 1.15 : -1.15;

      return (
        <group position={[x, 0.42, z]}>
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

          <group rotation={[0, isFront ? steeringAngle : 0, 0]}>
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

        {/* Center Console */}
        <group position={[0, 0.8, 0.32]}>
          <mesh rotation={[0.4, 0, 0]}>
            <boxGeometry args={[0.22, 0.38, 0.12]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.08, 0.08]} rotation={[0.4, 0, 0]}>
            <planeGeometry args={[0.18, 0.2]} />
            <meshBasicMaterial color="#00f0ff" opacity={0.7} transparent />
          </mesh>
          <group position={[0, 0.22, 0.04]} rotation={[0.3, 0, 0]}>
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

        {/* Antenna Dish */}
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

        {/* Camera Mast */}
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
              intensity={5.5}
              distance={45}
              angle={Math.PI / 4.5}
              penumbra={0.35}
              castShadow
            />
          )}
        </group>

        {/* Science Pallet */}
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

        {/* Wheels */}
        <WireWheel isFront={true} isLeft={true} />
        <WireWheel isFront={true} isLeft={false} />
        <WireWheel isFront={false} isLeft={true} />
        <WireWheel isFront={false} isLeft={false} />
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
        color: "#52575f",
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

  return (
    <instancedMesh ref={meshRef} args={[quadGeo, trackMat, 600]} />
  );
}

/* =========================================================================
   5. LUNAR DUST PARTICLE ROOSTER TAILS
   ========================================================================= */

function LunarDustEmitter({ active, position, velocity }: { active: boolean; position: THREE.Vector3; velocity: number }) {
  const count = 30;
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
      maxLife: 0.6 + Math.random() * 0.4,
    }));
  }, [count]);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const isMoving = Math.abs(velocity) > 0.4 && active;

    for (let i = 0; i < count; i++) {
      const p = particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        if (isMoving) {
          p.life = 0;
          p.x = position.x + (Math.random() - 0.5) * 1.4;
          p.y = position.y + 0.15;
          p.z = position.z + (Math.random() - 0.5) * 1.4;
          p.vx = (Math.random() - 0.5) * 0.8;
          p.vy = 0.8 + Math.random() * 1.2;
          p.vz = -Math.sign(velocity) * (1.2 + Math.random() * 1.8);
        } else {
          p.y = -100;
        }
      } else {
        p.vy -= 1.62 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
      }

      const scale = Math.max(0.01, 0.08 * (1 - p.life / p.maxLife));
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color="#9ca3af" transparent opacity={0.5} />
    </instancedMesh>
  );
}

/* =========================================================================
   6. 3D LUNAR ROVER CANVAS EXPERIENCE (With 360° Mouse Look & Tire Prints)
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
    yaw: 0,           // 360° horizontal rotation
    pitch: 0.28,      // vertical inclination
    distance: 6.8,    // camera distance
    isDragging: false,
    prevX: 0,
    prevY: 0,
    userControlled: false,
  });

  // Track prints history
  const [tracks, setTracks] = useState<TrackPoint[]>([]);
  const lastTrackPos = useRef(new THREE.Vector2(0, 14));

  // 4-Wheel Physics state
  const physics = useRef({
    x: roverState.x,
    z: roverState.z,
    y: getLunarHeight(roverState.x, roverState.z) + 0.42,
    heading: roverState.heading,
    velocity: 0,
    steering: 0,
    wheelAngle: 0,
    pitch: 0,
    roll: 0,
    distanceTraversed: roverState.distanceM,
  });

  const threeCamera = useThree((s) => s.camera);

  // Mouse & Pointer listeners for 360° Cursor Look Around
  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
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

      // Smooth 360° orbit rotation
      mouseOrbit.current.yaw -= dx * 0.006;
      mouseOrbit.current.pitch = THREE.MathUtils.clamp(
        mouseOrbit.current.pitch + dy * 0.005,
        -0.2,
        1.15
      );
    };

    const onPointerUp = () => {
      mouseOrbit.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
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

  // Safe Keyboard Event Handling (Prevent scroll, prevent stuck keys)
  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
        e.preventDefault();
      }
      keys.current[e.code] = true;

      if (e.code === "KeyH") {
        setRover({ headlights: !sim.rover.headlights });
      }
      if (e.code === "KeyC") {
        const modes: ("chase" | "cockpit" | "drone")[] = ["chase", "cockpit", "drone"];
        const next = modes[(modes.indexOf(sim.rover.cameraMode) + 1) % modes.length];
        setRover({ cameraMode: next });
        mouseOrbit.current.userControlled = false;
      }
      if (e.code === "KeyF") {
        sim.toggleFullscreen();
      }
      if (e.code === "KeyR") {
        physics.current.x = 0;
        physics.current.z = 14;
        physics.current.heading = 0;
        physics.current.velocity = 0;
        physics.current.steering = 0;
        setTracks([]);
        lastTrackPos.current.set(0, 14);
      }
      if (e.code === "Escape") {
        if (sim.fullscreen) sim.toggleFullscreen();
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
    const geo = new THREE.PlaneGeometry(280, 280, 160, 160);
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

  // Main Driving & Physics Loop
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.08);
    const k = keys.current;

    const forward = k["KeyW"] || k["ArrowUp"];
    const reverse = k["KeyS"] || k["ArrowDown"];
    const left = k["KeyA"] || k["ArrowLeft"];
    const right = k["KeyD"] || k["ArrowRight"];
    const brake = k["Space"];

    const p = physics.current;

    const maxSpeed = 3.8;
    const accel = 2.6;
    const friction = 1.1;

    if (brake) {
      p.velocity = THREE.MathUtils.damp(p.velocity, 0, 8.5, dt);
    } else if (forward) {
      p.velocity = Math.min(maxSpeed, p.velocity + accel * dt);
    } else if (reverse) {
      p.velocity = Math.max(-maxSpeed * 0.65, p.velocity - accel * 0.9 * dt);
    } else {
      p.velocity = THREE.MathUtils.damp(p.velocity, 0, friction, dt);
    }

    const maxSteer = 0.46;
    const steerSpeed = 2.6;
    if (left) {
      p.steering = Math.min(maxSteer, p.steering + steerSpeed * dt);
    } else if (right) {
      p.steering = Math.max(-maxSteer, p.steering - steerSpeed * dt);
    } else {
      p.steering = THREE.MathUtils.damp(p.steering, 0, 5.0, dt);
    }

    const wheelbase = 2.3;
    const headingDelta = (p.velocity / wheelbase) * Math.sin(p.steering) * dt;
    p.heading += headingDelta;

    p.x += Math.sin(p.heading) * p.velocity * dt;
    p.z += Math.cos(p.heading) * p.velocity * dt;

    p.distanceTraversed += Math.abs(p.velocity * dt);
    p.wheelAngle += (p.velocity / 0.4) * dt;

    // 4-Wheel Contact Ground Heights
    const halfTrack = 0.88;
    const halfBase = 1.15;
    const cosH = Math.cos(p.heading);
    const sinH = Math.sin(p.heading);

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

    const targetY = (y_fl + y_fr + y_rl + y_rr) / 4 + 0.42;
    p.y = THREE.MathUtils.lerp(p.y, targetY, 0.2);

    const targetPitch = Math.atan2((y_fl + y_fr) / 2 - (y_rl + y_rr) / 2, wheelbase);
    const targetRoll = Math.atan2((y_fr + y_rr) / 2 - (y_fl + y_rl) / 2, halfTrack * 2);

    p.pitch = THREE.MathUtils.lerp(p.pitch, targetPitch, 0.15);
    p.roll = THREE.MathUtils.lerp(p.roll, targetRoll, 0.15);

    if (roverRef.current) {
      roverRef.current.position.set(p.x, p.y, p.z);
      roverRef.current.rotation.set(p.pitch, p.heading, -p.roll);
    }

    // Add Tire Prints as rover moves across the regolith
    const currentPos = new THREE.Vector2(p.x, p.z);
    if (currentPos.distanceTo(lastTrackPos.current) > 0.35) {
      lastTrackPos.current.copy(currentPos);
      const newPrints: TrackPoint[] = [
        { x: rl_x, y: y_rl, z: rl_z, heading: p.heading },
        { x: rr_x, y: y_rr, z: rr_z, heading: p.heading },
      ];
      setTracks((prev) => (prev.length > 550 ? [...prev.slice(2), ...newPrints] : [...prev, ...newPrints]));
    }

    // 360° Mouse Cursor Orbit Camera System
    const orbit = mouseOrbit.current;
    if (!orbit.userControlled) {
      // Naturally align orbit yaw with vehicle heading when not mouse-dragging
      orbit.yaw = THREE.MathUtils.lerp(orbit.yaw, p.heading, 0.05);
    }

    if (sim.rover.cameraMode === "cockpit") {
      const eyeX = p.x - cosH * 0.32;
      const eyeZ = p.z + sinH * 0.32;
      const eyeY = p.y + 0.92;
      threeCamera.position.set(eyeX, eyeY, eyeZ);

      // In cockpit mode, allow 360° driver head turn!
      const lookDist = 14;
      const lookYaw = p.heading + (orbit.userControlled ? (orbit.yaw - p.heading) : 0);
      const lookX = eyeX + Math.sin(lookYaw) * lookDist;
      const lookZ = eyeZ + Math.cos(lookYaw) * lookDist;
      threeCamera.lookAt(lookX, eyeY + Math.tan(p.pitch + orbit.pitch - 0.28) * lookDist, lookZ);
    } else {
      // Full 360° Orbit Chase / Free Camera
      const target = new THREE.Vector3(p.x, p.y + 0.9, p.z);
      const camX = p.x - Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance;
      const camY = p.y + Math.max(0.4, Math.sin(orbit.pitch) * orbit.distance);
      const camZ = p.z - Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance;

      threeCamera.position.lerp(new THREE.Vector3(camX, camY, camZ), 0.14);
      threeCamera.lookAt(target);
    }

    // Update Zustand Store Telemetry
    if (Math.random() < 0.25) {
      const speedKmh = Math.abs(p.velocity) * 3.6;
      let headingDeg = (p.heading * (180 / Math.PI)) % 360;
      if (headingDeg < 0) headingDeg += 360;

      setRover({
        speedKmh: Math.round(speedKmh * 10) / 10,
        heading: Math.round(headingDeg),
        distanceM: Math.round(p.distanceTraversed),
        pitchDeg: Math.round(p.pitch * (180 / Math.PI)),
        rollDeg: Math.round(p.roll * (180 / Math.PI)),
      });
    }
  });

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 75, 260]} />

      <ambientLight intensity={0.06} />
      <directionalLight
        position={[65, 42, 60]}
        intensity={4.8}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-near={0.5}
        shadow-camera-far={180}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />

      <group position={[-80, 65, -95]}>
        <mesh>
          <sphereGeometry args={[5.2, 32, 32]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.3}
            roughness={0.5}
          />
        </mesh>
      </group>

      <mesh geometry={terrainGeo} receiveShadow>
        <meshStandardMaterial
          map={regolithTex}
          color="#a3a8b0"
          roughness={0.96}
          metalness={0.02}
        />
      </mesh>

      <TracysRock position={[-9, 0, -14]} />

      {[
        { pos: [14, 0, 6], scale: 1.5 },
        { pos: [-22, 0, 16], scale: 2.4 },
        { pos: [26, 0, -22], scale: 1.9 },
        { pos: [-6, 0, 36], scale: 1.2 },
        { pos: [10, 0, -18], scale: 1.1 },
        { pos: [-18, 0, -32], scale: 2.8 },
      ].map((b, i) => (
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

      {/* Dynamic Tire Prints left in the lunar dust */}
      <TireTracksMesh tracks={tracks} />

      <ApolloLRV
        ref={roverRef}
        steeringAngle={physics.current.steering}
        wheelRotation={physics.current.wheelAngle}
        headlightsOn={sim.rover.headlights}
      />

      <LunarDustEmitter
        active={Math.abs(physics.current.velocity) > 0.4}
        position={new THREE.Vector3(physics.current.x, physics.current.y, physics.current.z)}
        velocity={physics.current.velocity}
      />
    </>
  );
}

/* =========================================================================
   7. ROCK-SOLID ROVER HUD & CONTROLS (Outside Canvas - 100% Fixed Position)
   ========================================================================= */

export function RoverHUD() {
  const sim = useSim();
  const rover = sim.rover;
  const setRover = sim.setRover;

  const triggerKey = (code: string, isDown: boolean) => {
    window.dispatchEvent(new KeyboardEvent(isDown ? "keydown" : "keyup", { code, bubbles: true }));
  };

  return (
    <div className="rover-hud-root">
      {/* Reseau Crosshairs (+) overlay */}
      {rover.showReseau && (
        <div className="reseau-overlay">
          {[
            [20, 25], [50, 25], [80, 25],
            [20, 50], [50, 50], [80, 50],
            [20, 75], [50, 75], [80, 75],
          ].map(([x, y], idx) => (
            <span
              key={idx}
              className="reseau-cross"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              +
            </span>
          ))}
        </div>
      )}

      {/* Top Header Command Strip */}
      <div className="rover-top-nav">
        <button
          className="btn-header active"
          style={{ borderColor: "var(--cyan)", color: "var(--cyan)", background: "rgba(3,6,13,0.92)", fontWeight: 700 }}
          onClick={() => sim.setView("south")}
        >
          ◀ RETURN TO ORBIT VIEW
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
          LIGHTS: {rover.headlights ? "ON" : "OFF"} [H]
        </button>
        <button
          className="btn-header"
          onClick={() => setRover({ showReseau: !rover.showReseau })}
        >
          RESEAU: {rover.showReseau ? "ON" : "OFF"}
        </button>
        <button
          className={`btn-header ${sim.fullscreen ? "active" : ""}`}
          onClick={() => sim.toggleFullscreen()}
          style={{ borderColor: sim.fullscreen ? "var(--cyan)" : undefined }}
        >
          {sim.fullscreen ? "↙ EXIT FULLSCREEN" : "⛶ FULLSCREEN [F]"}
        </button>
      </div>

      {/* Rock-Solid Fixed Dashboard & Control Guide (Bottom Left) */}
      <div className="rover-dashboard-hud">
        <div className="rover-hud-title">
          <span>NASA LRV EXPEDITION</span>
          <span className="badge">STATION 6 · TAURUS-LITTROW</span>
        </div>
        <div className="rover-gauge-row">
          <div className="gauge-box">
            <span className="lbl">GROUND SPEED</span>
            <span className="val cyan">{rover.speedKmh.toFixed(1)} <small>KM/H</small></span>
          </div>
          <div className="gauge-box">
            <span className="lbl">HEADING</span>
            <span className="val amber">{String(rover.heading).padStart(3, "0")}°</span>
          </div>
          <div className="gauge-box">
            <span className="lbl">ODOMETER</span>
            <span className="val">{rover.distanceM} <small>M</small></span>
          </div>
          <div className="gauge-box">
            <span className="lbl">PITCH / ROLL</span>
            <span className="val">{rover.pitchDeg}° / {rover.rollDeg}°</span>
          </div>
        </div>

        {/* Anchored Control Guide */}
        <div className="rover-control-guide-box">
          <div className="guide-title">MISSION CONTROLS (360° EXPEDITION):</div>
          <div className="guide-keys">
            <span><b>W / S</b> THROTTLE / REVERSE</span>
            <span><b>A / D</b> STEER WHEELS</span>
            <span><b>SPACE</b> HANDBRAKE</span>
            <span><b>DRAG CURSOR</b> 360° ORBIT LOOK</span>
            <span><b>C</b> CAMERA</span>
            <span><b>H</b> LIGHTS</span>
            <span><b>F</b> FULLSCREEN</span>
            <span><b>R</b> RESET</span>
          </div>
        </div>
      </div>

      {/* Interactive Touch / Mouse D-Pad Controller (Bottom Right) */}
      <div className="rover-dpad-container">
        <div className="dpad-row">
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyW", true)}
            onMouseUp={() => triggerKey("KeyW", false)}
            onTouchStart={() => triggerKey("KeyW", true)}
            onTouchEnd={() => triggerKey("KeyW", false)}
            title="Drive Forward (W)"
          >
            ▲
          </button>
        </div>
        <div className="dpad-row">
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyA", true)}
            onMouseUp={() => triggerKey("KeyA", false)}
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
            onTouchStart={() => triggerKey("Space", true)}
            onTouchEnd={() => triggerKey("Space", false)}
            title="Brake (Space)"
          >
            STOP
          </button>
          <button
            className="dpad-btn"
            onMouseDown={() => triggerKey("KeyD", true)}
            onMouseUp={() => triggerKey("KeyD", false)}
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
