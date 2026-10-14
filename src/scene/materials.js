import * as THREE from 'three';
import { DX, P1X, P2X } from './constants.js';

const M = (color, rough = 0.6, metal = 0, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

// Planos de corte: a tinta e o vinco só aparecem depois que a chapa passa pela máquina.
const after = (x) => new THREE.Plane(new THREE.Vector3(1, 0, 0), -x);

export function createMaterials(tex) {
  return {
    frame: M(0x4a5a63, 0.55, 0.25, { map: tex.grime }),
    frameDark: M(0x2e373c, 0.6, 0.2),
    yellow: M(0xe3b23c, 0.45, 0.1),
    hazard: M(0xffffff, 0.5, 0.1, { map: tex.hazard }),
    steel: M(0xb9bec4, 0.32, 0.85),
    gear: M(0x8d949a, 0.38, 0.8),
    chrome: M(0xe2e6ea, 0.1, 1),
    alu: M(0xd2d6da, 0.3, 0.9),
    galv: M(0xa9afb4, 0.45, 0.7),
    rubber: M(0x1c1c1d, 0.85),
    dark: M(0x1d1f21, 0.7, 0.2),
    cable: M(0x232527, 0.55, 0.1),
    kraft: M(0xffffff, 0.92, 0, { map: tex.kraft }),
    stackSide: M(0xffffff, 0.95, 0, { map: tex.stack }),
    printed: M(0xffffff, 0.9, 0, { map: tex.printed }),
    wood: M(0xffffff, 0.75, 0, { map: tex.die }),
    anvil: M(0xd8732f, 0.6),
    plate: M(0x2f6f73, 0.45, 0.05),
    pallet: M(0xb88a55, 0.85),
    inkA: M(0x1b1a17, 0.3),
    inkB: M(0x14513a, 0.3),
    bucket: M(0xdcdcd6, 0.55),
    poly: M(0xd8eef2, 0.08, 0, { transparent: true, opacity: 0.16, depthWrite: false }),
    belt: M(0xffffff, 0.85, 0, { map: tex.belt }),
    cabinet: M(0xcdd1cd, 0.5, 0.15),
    labels: M(0xffffff, 0.5, 0, { map: tex.label, alphaTest: 0.5 }),
    screen: M(0x000000, 0.3, 0, { emissive: 0xffffff, emissiveMap: tex.screen }),
    led: M(0xffffff, 0.3, 0, { emissive: 0xf4f7ff, emissiveIntensity: 1.6 }),
    redLed: M(0x8a1a12, 0.4, 0, { emissive: 0xff3a22, emissiveIntensity: 1.2 }),
    towerG: M(0x1f7a46, 0.35, 0, { emissive: 0x2fd06a }),
    towerA: M(0x9a6a10, 0.35, 0, { emissive: 0xffb020 }),
    towerR: M(0x7a1a14, 0.35, 0, { emissive: 0xff3020, emissiveIntensity: 0.05 }),
    btnG: M(0x3aa36a, 0.4),
    btnB: M(0x2f6fb0, 0.4),
    red: M(0xc8302a, 0.4),
    floor: M(0xf0e8db, 0.95),
    line: M(0xe3b23c, 0.7),
    white: M(0xf4f2ee, 0.42, 0.05),
    green: M(0x14513a, 0.42, 0.15),
    glass: M(0x1e2a33, 0.08, 0.6),
    lamp: M(0xfff4d6, 0.3, 0, { emissive: 0xfff0c0, emissiveIntensity: 0.8 }),
    tail: M(0xc8302a, 0.3, 0, { emissive: 0x801010, emissiveIntensity: 0.5 }),
    door: M(0xffffff, 0.45, 0.3, { map: tex.slat }),
    darkDS: M(0x1d1f21, 0.7, 0.2, { side: THREE.DoubleSide }),
    brand: new THREE.MeshStandardMaterial({ map: tex.brand, transparent: true, roughness: 0.5 }),
    blob: new THREE.MeshBasicMaterial({
      map: tex.blob,
      transparent: true,
      depthWrite: false,
      color: 0x000000,
    }),
    decalA: new THREE.MeshStandardMaterial({
      map: tex.inkA,
      transparent: true,
      depthWrite: false,
      roughness: 0.5,
      clippingPlanes: [after(P1X)],
      polygonOffset: true,
      polygonOffsetFactor: -2,
    }),
    decalB: new THREE.MeshStandardMaterial({
      map: tex.inkB,
      transparent: true,
      depthWrite: false,
      roughness: 0.5,
      clippingPlanes: [after(P2X)],
      polygonOffset: true,
      polygonOffsetFactor: -3,
    }),
    crease: M(0x7d5530, 0.9, 0, {
      clippingPlanes: [after(DX)],
      polygonOffset: true,
      polygonOffsetFactor: -1,
    }),
  };
}
