// A chapa que vira caixa: fundo, quatro abas articuladas, tinta, vincos e refiles dos cantos.
import * as THREE from 'three';
import { BD, BH, BW, T } from './constants.js';
import { mergeByMaterial } from './merge.js';

export function buildBlank(mat) {
  const blank = new THREE.Group();
  const piece = (w, d, parent, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, T, d), mat.kraft);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const decal = (w, h, m, parent, x, y, z, flip, order) => {
    const o = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    o.position.set(x, y, z);
    o.rotation.set(-Math.PI / 2, flip ? Math.PI : 0, 0, 'YXZ');
    o.renderOrder = order;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  piece(BW, BD, blank, 0, T / 2, 0);
  decal(BW * 0.9, BD * 0.9, mat.decalA, blank, 0, T + 0.0008, 0, false, 1);
  decal(BW * 0.9, BD * 0.9, mat.decalB, blank, 0, T + 0.0014, 0, false, 2);

  // Abas: dobram em torno das arestas do fundo (+x, −x, +z, −z).
  const pivots = [];
  for (const [axis, s] of [
    ['x', 1],
    ['x', -1],
    ['z', 1],
    ['z', -1],
  ]) {
    const pv = new THREE.Group();
    blank.add(pv);
    pivots.push(pv);
    if (axis === 'x') {
      pv.position.set((s * BW) / 2, T / 2, 0);
      piece(BH, BD, pv, (s * BH) / 2, 0, 0);
    } else {
      pv.position.set(0, T / 2, (s * BD) / 2);
      piece(BW, BH, pv, 0, 0, (s * BH) / 2);
      decal(BW * 0.9, BH * 0.9, mat.decalA, pv, 0, T / 2 + 0.0008, (s * BH) / 2, s < 0, 1);
      decal(BW * 0.9, BH * 0.9, mat.decalB, pv, 0, T / 2 + 0.0014, (s * BH) / 2, s < 0, 2);
    }
  }

  const creases = new THREE.Group();
  for (const [w, d, x, z] of [
    [BW, 0.006, 0, BD / 2],
    [BW, 0.006, 0, -BD / 2],
    [0.006, BD, BW / 2, 0],
    [0.006, BD, -BW / 2, 0],
  ]) {
    const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat.crease);
    c.rotation.x = -Math.PI / 2;
    c.position.set(x, T + 0.0004, z);
    creases.add(c);
  }
  blank.add(mergeByMaterial(creases));

  // Refiles dos cantos: caem depois da faca rotativa.
  const corners = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const mesh = piece(BH, BH, blank, sx * (BW / 2 + BH / 2), T / 2, sz * (BD / 2 + BH / 2));
      corners.push({ mesh, lx: mesh.position.x, lz: mesh.position.z });
    }
  }

  return { blank, pivots, corners };
}
