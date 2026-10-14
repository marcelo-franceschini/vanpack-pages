// Primitivas de modelagem. Peças vão para `root` (estático, mesclado por material depois)
// ou para o grupo informado; o que gira com o avanço da chapa é registrado em `spinners`.
import * as THREE from 'three';
import { FT, FZ } from './constants.js';

export function createBuilder(mat) {
  const root = new THREE.Group();
  const moving = new THREE.Group();
  const spinners = []; // [objeto, raio, sentido]

  const add = (geo, m, x = 0, y = 0, z = 0, parent = root) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  /** Caixa pelos limites [x0, x1] × [y0, y1] × [z0, z1]. */
  const bb = (x0, x1, y0, y1, z0, z1, m, parent) =>
    add(B(x1 - x0, y1 - y0, z1 - z0), m, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, parent);
  /** Intervalo [a, b] espelhado para o lado negativo de z quando s < 0. */
  const zr = (s, a, b) => (s > 0 ? [a, b] : [-b, -a]);
  const cyl = (r, len, m, x, y, z, axis = 'y', parent = root, seg = 24) => {
    const o = add(new THREE.CylinderGeometry(r, r, len, seg), m, x, y, z, parent);
    if (axis === 'z') o.rotation.x = Math.PI / 2;
    if (axis === 'x') o.rotation.z = Math.PI / 2;
    return o;
  };
  const tube = (pts, r, m, parent = root) =>
    add(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p))),
        40,
        r,
        8,
      ),
      m,
      0,
      0,
      0,
      parent,
    );
  /** Peças pequenas ou rentes: recebem sombra, mas não projetam. */
  const flat = (o) => {
    o.castShadow = false;
    return o;
  };

  function roundRect(p, x, y, w, h, r) {
    p.moveTo(x + r, y);
    p.lineTo(x + w - r, y);
    p.quadraticCurveTo(x + w, y, x + w, y + r);
    p.lineTo(x + w, y + h - r);
    p.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    p.lineTo(x + r, y + h);
    p.quadraticCurveTo(x, y + h, x, y + h - r);
    p.lineTo(x, y + r);
    p.quadraticCurveTo(x, y, x + r, y);
  }

  /** Chapa lateral da máquina, com cantos arredondados e janelas opcionais. */
  function plate(x0, x1, y0, y1, zc, m = mat.frame, holes = []) {
    const s = new THREE.Shape();
    roundRect(s, x0, y0, x1 - x0, y1 - y0, 0.035);
    for (const [a, b, c, d] of holes) {
      const h = new THREE.Path();
      roundRect(h, a, b, c - a, d - b, 0.04);
      s.holes.push(h);
    }
    const d = FT - 0.012;
    const g = new THREE.ExtrudeGeometry(s, {
      depth: d,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
      curveSegments: 5,
    });
    g.translate(0, 0, zc - d / 2);
    return add(g, m);
  }

  const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.01, 6);
  const bolt = (x, y, z) => {
    const o = add(boltGeo, mat.steel, x, y, z + 0.004);
    o.rotation.x = Math.PI / 2;
    flat(o);
  };

  function foot(x, z) {
    cyl(0.05, 0.02, mat.steel, x, 0.01, z);
    cyl(0.014, 0.05, mat.steel, x, 0.04, z, 'y', root, 10);
    add(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 6), mat.steel, x, 0.05, z);
  }

  /** Etiqueta de segurança: `cell` escolhe uma das 4 do atlas. */
  function label(cell, size, x, y, z, ry = 0) {
    const g = new THREE.PlaneGeometry(size, size);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (cell + uv.getX(i)) / 4);
    const o = flat(add(g, mat.labels, x, y, z));
    o.rotation.y = ry;
    return o;
  }

  /** Sombra de contato falsa sob as máquinas (continua valendo sem sombras em tempo real). */
  function blob(x, z, w, d, parent = root) {
    const o = add(new THREE.PlaneGeometry(w, d), mat.blob, x, 0.004, z, parent);
    o.rotation.x = -Math.PI / 2;
    o.castShadow = o.receiveShadow = false;
    o.renderOrder = -1;
    return o;
  }

  const gearCache = new Map();
  function gearGeo(r) {
    if (gearCache.has(r)) return gearCache.get(r);
    const n = Math.max(10, Math.round(r / 0.0072));
    const ro = r + 0.008;
    const ri = r - 0.008;
    const s = new THREE.Shape();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = (Math.PI * 2) / n;
      [
        [ri, 0],
        [ro, 0.22],
        [ro, 0.5],
        [ri, 0.72],
      ].forEach(([rad, f], k) => {
        const x = Math.cos(a + d * f) * rad;
        const y = Math.sin(a + d * f) * rad;
        if (i || k) s.lineTo(x, y);
        else s.moveTo(x, y);
      });
    }
    if (r > 0.09) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const h = new THREE.Path();
        h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.2, 0, Math.PI * 2, true);
        s.holes.push(h);
      }
    }
    const hub = new THREE.Path();
    hub.absarc(0, 0, 0.022, 0, Math.PI * 2, true);
    s.holes.push(hub);
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 1,
      curveSegments: 10,
    });
    g.translate(0, 0, -0.015);
    gearCache.set(r, g);
    return g;
  }

  /**
   * Rolo entre as laterais. Tambor e eixo são cilindros lisos (girar não muda nada na tela),
   * então ficam estáticos; só a engrenagem e o que for preso ao grupo retornado giram.
   */
  function roll(x, y, r, m, dir, gearR) {
    cyl(r, 2 * FZ - FT, m, x, y, 0, 'z', root, 40);
    cyl(Math.min(0.03, r * 0.4), 2 * FZ + 0.12, mat.steel, x, y, 0, 'z', root, 12);
    const g = new THREE.Group();
    g.position.set(x, y, 0);
    moving.add(g);
    if (gearR) add(gearGeo(gearR), mat.gear, 0, 0, FZ + FT / 2 + 0.035, g);
    cyl(0.05, 0.024, mat.frameDark, x, y, FZ + FT / 2 + 0.012, 'z');
    cyl(0.05, 0.024, mat.frameDark, x, y, -FZ - FT / 2 - 0.012, 'z');
    spinners.push([g, gearR || r, dir]);
    return g;
  }

  /** Laterais, pés, travessa e parafusos de uma unidade da linha. */
  function unitFrame(x0, x1, top, windows = []) {
    plate(x0, x1, 0.06, top, -FZ);
    plate(x0, x1, 0.06, top, FZ, mat.frame, windows);
    for (const x of [x0 + 0.07, x1 - 0.07]) for (const z of [-FZ, FZ]) foot(x, z);
    bb(x0 + 0.06, x1 - 0.06, 0.14, 0.28, -FZ + FT / 2, FZ - FT / 2, mat.frameDark);
    for (let x = x0 + 0.08; x < x1 - 0.04; x += 0.14) {
      bolt(x, 0.12, FZ + FT / 2);
      bolt(x, top - 0.06, FZ + FT / 2);
    }
  }

  /** Moldura amarela com tampa de policarbonato. */
  function topCover(x0, x1, top) {
    for (const x of [x0 + 0.03, x1 - 0.03]) {
      bb(x - 0.03, x + 0.03, top, top + 0.05, -FZ - 0.04, FZ + 0.04, mat.yellow);
    }
    for (const z of [-FZ, FZ]) bb(x0, x1, top, top + 0.05, z - 0.04, z + 0.04, mat.yellow);
    flat(add(B(x1 - x0 - 0.12, 0.008, 2 * FZ - 0.08), mat.poly, (x0 + x1) / 2, top + 0.035, 0));
  }

  return {
    root,
    moving,
    spinners,
    add,
    B,
    bb,
    zr,
    cyl,
    tube,
    flat,
    plate,
    label,
    blob,
    foot,
    roll,
    unitFrame,
    topCover,
  };
}
