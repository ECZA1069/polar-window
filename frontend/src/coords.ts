import * as THREE from "three";
// MOON_ME (x: lat0/lon0, y: lon90E, z: north) -> three.js (Y up). Right-handed: (x,y,z) -> (x,z,-y).
export const meToThree = (v: number[]) => new THREE.Vector3(v[0], v[2], -v[1]);
export const latLonToMe = (latDeg: number, lonDeg: number): number[] => {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
};
