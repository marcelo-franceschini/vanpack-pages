// Papelão do 3D dos produtos: placas com espessura a partir de um contorno 2D (abas, recortes, alças e
// rasgos), no mesmo material do 3D principal: face externa Kraft, face interna mais clara e a borda com
// as duas capas e a onda do miolo (a edgeTexture da cena). As placas de um modelo se acumulam e viram
// uma malha por material, então cada modelo fica em poucos draw calls.
import { BufferGeometry, Float32BufferAttribute, Mesh, ShapeUtils, Vector2 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// A edgeTexture tem 2 ondas por ladrilho. Um ladrilho a cada 3,6 espessuras dá uma onda a cada 1,8
// espessura, a proporção da onda C.
const TILE = 3.6;
// v da borda vai além de 1 para a capa (as 2 primeiras linhas da textura) aparecer embaixo e em cima.
const LINER = 18 / 16;

function flat(position, normal, uv) {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  return geometry;
}

/**
 * Placa de espessura `t` no plano xy (z de -t/2 a +t/2), do contorno `points` ([x, y], em qualquer
 * sentido) com os furos `holes` (alças, janelas). A face +z é a `a` e a -z é a `b`; a textura das faces
 * cobre o retângulo que envolve o contorno.
 * @returns {{ a: BufferGeometry, b: BufferGeometry, edge: BufferGeometry }}
 */
export function plate(points, t, holes = []) {
  const ring = (list, clockwise) => {
    const v = list.map(([x, y]) => new Vector2(x, y));
    return ShapeUtils.isClockWise(v) === clockwise ? v : v.reverse();
  };
  const outline = ring(points, false);
  const inner = holes.map((hole) => ring(hole, true));
  const all = [outline, ...inner].flat();
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const u = (p) => (p.x - x0) / (x1 - x0);
  const v = (p) => (p.y - y0) / (y1 - y0);
  const h = t / 2;

  const faces = { a: [[], [], []], b: [[], [], []] };
  for (const [i, j, k] of ShapeUtils.triangulateShape(outline, inner)) {
    for (const [side, z, order] of /** @type {[string, number, number[]][]} */ ([
      ['a', h, [i, j, k]],
      ['b', -h, [i, k, j]],
    ])) {
      const [position, normal, uv] = faces[side];
      for (const index of order) {
        const p = all[index];
        position.push(p.x, p.y, z);
        normal.push(0, 0, Math.sign(z));
        uv.push(u(p), v(p));
      }
    }
  }

  // borda: o contorno anti-horário e os furos no sentido horário deixam o sólido sempre à esquerda,
  // então (dy, -dx) aponta para fora
  const position = [];
  const normal = [];
  const uv = [];
  for (const loop of [outline, ...inner]) {
    let s = 0;
    for (let n = 0; n < loop.length; n++) {
      const p = loop[n];
      const q = loop[(n + 1) % loop.length];
      const length = p.distanceTo(q);
      if (length < 1e-6) continue;
      const nx = (q.y - p.y) / length;
      const ny = -(q.x - p.x) / length;
      const s1 = s + length;
      const corners = [
        [p, -h, s, 0],
        [q, -h, s1, 0],
        [q, h, s1, LINER],
        [p, -h, s, 0],
        [q, h, s1, LINER],
        [p, h, s, LINER],
      ];
      for (const [point, z, along, across] of corners) {
        position.push(point.x, point.y, z);
        normal.push(nx, ny, 0);
        uv.push(along / (TILE * t), across);
      }
      s = s1;
    }
  }
  return { a: flat(...faces.a), b: flat(...faces.b), edge: flat(position, normal, uv) };
}

/** Retângulo [x0, y0] a [x1, y1] como contorno. */
export const rect = (x0, y0, x1, y1) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

/** Furo arredondado (alça) de largura `w` e altura `h`, centrado em (cx, cy). */
export function slot(cx, cy, w, h, segments = 6) {
  const r = h / 2;
  const points = [];
  for (const [x, a0] of [
    [cx + w / 2 - r, -Math.PI / 2],
    [cx - w / 2 + r, Math.PI / 2],
  ]) {
    for (let i = 0; i <= segments; i++) {
      const a = a0 + (Math.PI * i) / segments;
      points.push([x + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return points;
}

/**
 * Junta as placas de um modelo por material. `add` recebe a geometria e a matriz que a põe no lugar;
 * `build` cria uma malha por material e descarta as geometrias originais.
 */
export class Pieces {
  constructor() {
    /** @type {Map<string, BufferGeometry[]>} */
    this.parts = new Map();
  }

  add(key, geometry, matrix) {
    const piece = geometry.index ? geometry.toNonIndexed() : geometry;
    if (piece !== geometry) geometry.dispose();
    if (matrix) piece.applyMatrix4(matrix);
    if (!this.parts.has(key)) this.parts.set(key, []);
    this.parts.get(key).push(piece);
  }

  /**
   * Placa (ver `plate`) posta no lugar por `matrix`; `a` e `b` dizem o material de cada face
   * (por exemplo 'externa' e 'interna').
   * @param {number[][]} points contorno
   * @param {number} t espessura
   * @param {import('three').Matrix4} matrix
   * @param {{ a?: string, b?: string, edge?: string, holes?: number[][][] }} [options]
   */
  plate(points, t, matrix, { a = 'externa', b = 'interna', edge = 'borda', holes } = {}) {
    const pieces = plate(points, t, holes);
    this.add(a, pieces.a, matrix);
    this.add(b, pieces.b, matrix);
    this.add(edge, pieces.edge, matrix);
  }

  /**
   * @param {Record<string, import('three').Material>} materials
   * @param {import('three').Object3D} parent
   * @param {(geometry: BufferGeometry) => void} track registra a geometria para o dispose
   */
  build(materials, parent, track) {
    for (const [key, list] of this.parts) {
      const merged = list.length > 1 ? mergeGeometries(list) : list[0];
      if (list.length > 1) for (const g of list) g.dispose();
      track(merged);
      parent.add(new Mesh(merged, materials[key]));
    }
    this.parts.clear();
  }
}
