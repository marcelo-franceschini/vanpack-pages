// Geometria procedural: caixas chanfradas, malhas mescladas por material, sombras falsas, pilhas de
// papelão, painéis dobráveis e a estrada.
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Matrix4,
  Mesh,
  Shape,
} from 'three';
import { ROAD, TRUCK_X0 } from './constants.js';

/** Caixa com as arestas chanfradas (cai para BoxGeometry quando é fina demais para chanfrar). */
function chamferBox(w, h, d, c) {
  if (Math.min(w, h, d) < c * 3.2) return new BoxGeometry(w, h, d);
  const hw = w / 2 - c;
  const hh = h / 2 - c;
  const k = c * 0.9;
  const shape = new Shape();
  shape.moveTo(-hw + k, -hh);
  shape.lineTo(hw - k, -hh);
  shape.lineTo(hw, -hh + k);
  shape.lineTo(hw, hh - k);
  shape.lineTo(hw - k, hh);
  shape.lineTo(-hw + k, hh);
  shape.lineTo(-hw, hh - k);
  shape.lineTo(-hw, -hh + k);
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: d - 2 * c,
    bevelEnabled: true,
    bevelThickness: c,
    bevelSize: c,
    bevelSegments: 1,
    curveSegments: 1,
    steps: 1,
  });
  geometry.translate(0, 0, -(d - 2 * c) / 2);
  return geometry;
}

/** Junta geometrias (só posição e normal, sem índice) numa só e descarta as originais. */
export function mergeGeometries(source) {
  const list = source.map((g) => {
    if (!g.index) return g;
    const flat = g.toNonIndexed();
    g.dispose();
    return flat;
  });
  let vertices = 0;
  for (const g of list) vertices += g.attributes.position.count;
  const position = new Float32Array(vertices * 3);
  const normal = new Float32Array(vertices * 3);
  let offset = 0;
  for (const g of list) {
    position.set(g.attributes.position.array, offset * 3);
    normal.set(g.attributes.normal.array, offset * 3);
    offset += g.attributes.position.count;
    g.dispose();
  }
  const merged = new BufferGeometry();
  merged.setAttribute('position', new BufferAttribute(position, 3));
  merged.setAttribute('normal', new BufferAttribute(normal, 3));
  return merged;
}

const scratch = new Matrix4();

/** Acumula caixas e cilindros e gera uma malha por material (um draw call cada). */
export class Batch {
  constructor() {
    /** @type {Map<import('three').Material, BufferGeometry[]>} */
    this.byMaterial = new Map();
  }

  add(geometry, material, matrix) {
    const flat = geometry.index ? geometry.toNonIndexed() : geometry;
    flat.applyMatrix4(matrix);
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(flat);
  }

  box(material, x0, x1, y0, y1, z0, z1, chamfer = 0.02) {
    this.add(
      chamferBox(x1 - x0, y1 - y0, z1 - z0, chamfer),
      material,
      scratch.makeTranslation((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
    );
  }

  cyl(material, x, y, z, radius, length, axis = 'z', segments = 20) {
    const geometry = new CylinderGeometry(radius, radius, length, segments);
    if (axis === 'z') geometry.rotateX(Math.PI / 2);
    else if (axis === 'x') geometry.rotateZ(Math.PI / 2);
    this.add(geometry, material, scratch.makeTranslation(x, y, z));
  }

  /** @returns {Mesh[]} */
  build(parent, castShadow = true) {
    const meshes = [];
    for (const [material, list] of this.byMaterial) {
      const mesh = new Mesh(mergeGeometries(list), material);
      mesh.castShadow = castShadow;
      parent.add(mesh);
      meshes.push(mesh);
    }
    this.byMaterial.clear();
    return meshes;
  }
}

/**
 * Sombras falsas: retângulos com borda que esmaece (cor de vértice, alfa 0 nas bordas).
 * @param {Array<[x0: number, x1: number, z0: number, z1: number, margin: number, alpha: number]>} rects
 */
export function softRects(rects) {
  const position = [];
  const color = [];
  const index = [];
  let offset = 0;
  for (const [x0, x1, z0, z1, margin, alpha] of rects) {
    const xs = [x0 - margin, x0, x1, x1 + margin];
    const zs = [z0 - margin, z0, z1, z1 + margin];
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 4; i++) {
        position.push(xs[i], 0, zs[j]);
        const edge = i === 0 || i === 3 || j === 0 || j === 3;
        color.push(0.2, 0.15, 0.09, edge ? 0 : alpha);
      }
    }
    for (let j = 0; j < 3; j++) {
      for (let i = 0; i < 3; i++) {
        const a = offset + j * 4 + i;
        const c = a + 4;
        index.push(a, c, a + 1, a + 1, c, c + 1);
      }
    }
    offset += 16;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(color, 4));
  geometry.setIndex(index);
  return geometry;
}

/** Quatro laterais de uma pilha de chapas (a borda mostra as camadas, repetidas a cada `layer`). */
export function stackSides(x0, x1, y0, y1, z0, z1, layer) {
  const position = [];
  const normal = [];
  const uv = [];
  const index = [];
  let offset = 0;
  const repeatsY = (y1 - y0) / layer;
  const quad = (points, n, repeatsU) => {
    points.forEach((point, i) => {
      position.push(...point);
      normal.push(...n);
      uv.push(i === 0 || i === 3 ? 0 : repeatsU, i < 2 ? 0 : repeatsY);
    });
    index.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    offset += 4;
  };
  const repeatsX = (x1 - x0) / 0.16;
  const repeatsZ = (z1 - z0) / 0.16;
  quad(
    [
      [x0, y0, z1],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z1],
    ],
    [0, 0, 1],
    repeatsX,
  );
  quad(
    [
      [x1, y0, z0],
      [x0, y0, z0],
      [x0, y1, z0],
      [x1, y1, z0],
    ],
    [0, 0, -1],
    repeatsX,
  );
  quad(
    [
      [x1, y0, z1],
      [x1, y0, z0],
      [x1, y1, z0],
      [x1, y1, z1],
    ],
    [1, 0, 0],
    repeatsZ,
  );
  quad(
    [
      [x0, y0, z0],
      [x0, y0, z1],
      [x0, y1, z1],
      [x0, y1, z0],
    ],
    [-1, 0, 0],
    repeatsZ,
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setIndex(index);
  return geometry;
}

/** Painel plano de largura `w` (em z) entre x0 e x1; `v(x)` dá a coordenada v da textura. */
export function panelGeometry(x0, x1, w, v) {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([x0, 0, 0, x1, 0, 0, x1, 0, w, x0, 0, w], 3),
  );
  geometry.setAttribute(
    'normal',
    new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3),
  );
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute([0, v(x0), 0, v(x1), 1, v(x1), 1, v(x0)], 2),
  );
  geometry.setIndex([0, 3, 2, 0, 2, 1]);
  return geometry;
}

/**
 * Ponto da estrada a `s` metros do início: reta, curva leve e reta inclinada.
 * @param {number} s
 * @param {{ x: number, z: number, a: number }} [out] reaproveitado para não alocar por quadro
 */
export function pathAt(s, out = { x: 0, z: 0, a: 0 }) {
  const { straight, radius, angle } = ROAD;
  const arc = radius * angle;
  if (s <= straight) {
    out.x = TRUCK_X0 + s;
    out.z = 0;
    out.a = 0;
  } else if (s <= straight + arc) {
    const a = (s - straight) / radius;
    out.x = TRUCK_X0 + straight + radius * Math.sin(a);
    out.z = -radius * (1 - Math.cos(a));
    out.a = a;
  } else {
    const d = s - straight - arc;
    const x0 = TRUCK_X0 + straight + radius * Math.sin(angle);
    const z0 = -radius * (1 - Math.cos(angle));
    out.x = x0 + d * Math.cos(angle);
    out.z = z0 - d * Math.sin(angle);
    out.a = angle;
  }
  return out;
}

/** Faixa de estrada (ou do tracejado) entre `s0` e `s1`, de largura `w`, na altura `y`. */
export function ribbon(s0, s1, step, w, y) {
  const position = [];
  const index = [];
  const point = { x: 0, z: 0, a: 0 };
  let n = 0;
  for (let s = s0; s <= s1 + 1e-6; s += step) {
    pathAt(s, point);
    const nx = Math.sin(point.a);
    const nz = Math.cos(point.a);
    position.push(
      point.x - (nx * w) / 2,
      y,
      point.z - (nz * w) / 2,
      point.x + (nx * w) / 2,
      y,
      point.z + (nz * w) / 2,
    );
    if (n) {
      const a = (n - 1) * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    n++;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  const normal = new Float32Array(position.length);
  for (let i = 1; i < normal.length; i += 3) normal[i] = 1;
  geometry.setAttribute('normal', new BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
}
