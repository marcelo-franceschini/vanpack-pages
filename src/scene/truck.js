// Caminhão baú da vanpack, com porta de enrolar e rodas.
import * as THREE from 'three';
import { CX0, CX1, CY0, CY1, CZ, DH, TW, WR } from './constants.js';
import { mergeByMaterial } from './merge.js';

export function buildTruck(b, mat) {
  const { add, B, bb, zr, cyl, flat, blob } = b;
  const truck = new THREE.Group();
  // `body` gira em torno do eixo traseiro (balanço na arrancada); `inner` desfaz o deslocamento.
  const body = new THREE.Group();
  body.position.set(3.85, WR, 0);
  truck.add(body);
  const inner = new THREE.Group();
  inner.position.set(-3.85, -WR, 0);
  body.add(inner);

  const TB = new THREE.Group();
  {
    bb(CX0, CX1, CY0 - TW, CY0, -CZ, CZ, mat.white, TB);
    bb(CX0, CX1, CY1 - TW, CY1, -CZ, CZ, mat.white, TB);
    bb(CX1 - TW, CX1, CY0, CY1, -CZ, CZ, mat.white, TB);
    bb(CX0 + 0.06, CX0 + 0.28, CY1 - 0.24, CY1 - TW, -CZ + TW, CZ - TW, mat.white, TB);
    for (const s of [-1, 1]) {
      bb(CX0, CX1, CY0, CY1, ...zr(s, CZ - TW, CZ), mat.white, TB);
      bb(CX0, CX1, CY0 + 0.06, CY0 + 0.15, ...zr(s, CZ, CZ + 0.004), mat.green, TB);
      flat(
        add(
          new THREE.PlaneGeometry(1.55, 0.48),
          mat.brand,
          (CX0 + CX1) / 2,
          1.3,
          s * (CZ + 0.006),
          TB,
        ),
      ).rotation.y = s < 0 ? Math.PI : 0;
      bb(CX0, CX1, CY1 - 0.03, CY1 + 0.01, ...zr(s, CZ - 0.025, CZ + 0.012), mat.alu, TB);
      bb(CX0, CX1, CY0 - 0.07, CY0 - 0.03, ...zr(s, CZ - 0.025, CZ + 0.012), mat.alu, TB);
      bb(CX1 - 0.03, CX1 + 0.012, CY0 - 0.04, CY1, ...zr(s, CZ - 0.025, CZ + 0.012), mat.alu, TB);
      bb(
        CX0 - 0.01,
        CX0 + 0.06,
        CY0 - 0.04,
        CY1 + 0.02,
        ...zr(s, CZ - 0.07, CZ + 0.005),
        mat.green,
        TB,
      );
      bb(CX0 - 0.016, CX0 - 0.004, 0.62, 0.8, ...zr(s, CZ - 0.06, CZ - 0.01), mat.tail, TB);
      bb(3.45, 3.47, 0.08, 0.46, ...zr(s, 0.55, 0.81), mat.rubber, TB);
      const fender = add(
        new THREE.TorusGeometry(0.39, 0.022, 8, 28, 2.443),
        mat.dark,
        5.75,
        WR,
        s * 0.802,
        TB,
      );
      fender.rotation.z = 0.349;
    }
    bb(CX0 - 0.01, CX0 + 0.06, CY1 - 0.1, CY1 + 0.02, -CZ, CZ, mat.green, TB);
    const well = add(
      new THREE.CylinderGeometry(0.38, 0.38, 1.6, 28, 1, true, 1.92, 2.443),
      mat.darkDS,
      5.75,
      WR,
      0,
      TB,
    );
    well.rotation.x = Math.PI / 2;
    bb(3.05, 6.15, 0.31, 0.45, -0.5, 0.5, mat.dark, TB);
    bb(CX0 - 0.09, CX0 + 0.04, 0.33, 0.45, -0.86, 0.86, mat.dark, TB);
    bb(CX0 - 0.1, CX0 - 0.09, 0.345, 0.435, -0.16, 0.16, mat.white, TB);

    // Cabine: perfil lateral extrudado, com o recorte do para-lama.
    const prof = new THREE.Shape();
    prof.moveTo(CX1, 0.45);
    prof.lineTo(5.393, 0.45);
    prof.absarc(5.75, WR, 0.38, Math.PI - 0.349, 0.349, true);
    prof.lineTo(6.3, 0.45);
    prof.lineTo(6.3, 1.0);
    prof.lineTo(5.95, 1.58);
    prof.lineTo(CX1, 1.62);
    prof.closePath();
    const cabGeo = new THREE.ExtrudeGeometry(prof, {
      depth: 1.56,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 3,
    });
    cabGeo.translate(0, 0, -0.78);
    add(cabGeo, mat.green, 0, 0, 0, TB);
    const wsLen = Math.hypot(0.35, 0.58);
    flat(
      add(
        B(wsLen - 0.1, 0.01, 1.4),
        mat.glass,
        (6.3 + 5.95) / 2 + 0.02,
        (1.0 + 1.58) / 2 + 0.012,
        0,
        TB,
      ),
    ).rotation.z = Math.atan2(0.58, -0.35);
    for (const s of [-1, 1]) {
      bb(5.34, 5.86, 1.06, 1.44, ...zr(s, 0.8, 0.81), mat.glass, TB);
      for (const [x, y0] of [
        [5.3, 0.5],
        [5.92, 0.74],
      ]) {
        flat(bb(x - 0.004, x + 0.004, y0, 1.5, ...zr(s, 0.8, 0.804), mat.dark, TB));
      }
      bb(5.38, 5.46, 0.98, 1.0, ...zr(s, 0.8, 0.82), mat.dark, TB);
      bb(5.98, 6.0, 1.18, 1.22, ...zr(s, 0.8, 0.9), mat.dark, TB);
      bb(5.96, 6.0, 1.06, 1.3, ...zr(s, 0.88, 0.94), mat.dark, TB);
      bb(6.3, 6.34, 0.8, 0.9, ...zr(s, 0.44, 0.66), mat.lamp, TB);
    }
    bb(6.28, 6.4, 0.44, 0.6, -0.83, 0.83, mat.dark, TB);
    bb(6.3, 6.32, 0.66, 0.84, -0.36, 0.36, mat.dark, TB);
    blob(4.8, 0, 3.8, 2.3, TB);
  }
  inner.add(mergeByMaterial(TB));

  // Porta de enrolar: escala em y a partir do topo.
  const doorPivot = new THREE.Group();
  doorPivot.position.set(CX0 + 0.02, CY1 - 0.1, 0);
  inner.add(doorPivot);
  const doorGeo = B(0.02, DH, 2 * CZ - 0.14);
  doorGeo.translate(0, -DH / 2, 0);
  const door = add(doorGeo, mat.door, 0, 0, 0, doorPivot);
  const doorHandle = add(B(0.03, 0.03, 0.3), mat.dark, -0.02, 0, 0, doorPivot);

  // Rodas: pneu, aro e cubo são simétricos e ficam estáticos; só os parafusos giram.
  const hubs = new THREE.Group();
  const wheels = [];
  for (const x of [3.85, 5.75]) {
    for (const s of [-1, 1]) {
      const z = s * 0.68;
      cyl(WR, 0.24, mat.rubber, x, WR, z, 'z', hubs, 40);
      cyl(0.2, 0.245, mat.steel, x, WR, z, 'z', hubs, 32);
      cyl(0.075, 0.26, mat.dark, x, WR, z, 'z', hubs, 20);
      const lugs = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const a = k * 1.047;
        cyl(
          0.014,
          0.02,
          mat.chrome,
          Math.cos(a) * 0.12,
          Math.sin(a) * 0.12,
          s * 0.125,
          'z',
          lugs,
          8,
        );
      }
      const wheel = mergeByMaterial(lugs);
      wheel.position.set(x, WR, z);
      truck.add(wheel);
      wheels.push(wheel);
    }
  }
  truck.add(mergeByMaterial(hubs));

  return { truck, body, door, doorHandle, wheels };
}
