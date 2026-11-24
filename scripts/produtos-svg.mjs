// Ilustrações em SVG dos 4 produtos (public/produtos/<id>.svg): o que aparece no lugar do 3D quando o
// aparelho não tem condição (sem WebGL, economia de dados, rede 2g/3g, até 2 GB de memória). Projeta
// formas simples das mesmas peças de src/produtos/modelos.js com a câmera de três quartos do 3D
// (projeção ortográfica), pinta cada face com um tom do material da cena conforme a luz (a face interna
// mais clara, o Kraft e o Kraft escuro) e desenha do fundo para a frente. Sem texto, sem imagem e sem
// marca (o logotipo não pode ser inclinado num desenho chapado). Roda à mão: node scripts/produtos-svg.mjs
import { writeFileSync } from 'node:fs';
import { CAMERA_DIRECTION, KRAFT, KRAFT_INNER, PALETTE } from '../src/scene/constants.js';

const OUT = new URL('../public/produtos/', import.meta.url).pathname;
const SIZE = { w: 400, h: 300 }; // 4:3, o espaço reservado no cartão
const MARGIN = 0.12;
// o fundo é o tom do cartão do produto (--tint em index.html), o mesmo do 3D (src/produtos/cena.js)
const BACKDROP = '#ece9e3';
const TONES = { light: KRAFT_INNER, mid: KRAFT, dark: PALETTE.kraftDark };

const norm = ([x, y, z]) => {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const back = norm(CAMERA_DIRECTION);
const right = norm(cross([0, 1, 0], back));
const up = cross(back, right);
const sun = norm([-4.5, 9, 6]); // a mesma luz principal do 3D

/** Faces de uma caixa entre dois cantos, depois de `transform` (ponto → ponto). */
function box([x0, y0, z0], [x1, y1, z1], transform = (p) => p) {
  const c = (i) => transform([i & 1 ? x1 : x0, i & 2 ? y1 : y0, i & 4 ? z1 : z0]);
  const quads = [
    [0, 2, 6, 4], // -x
    [1, 5, 7, 3], // +x
    [0, 4, 5, 1], // -y
    [2, 3, 7, 6], // +y
    [0, 1, 3, 2], // -z
    [4, 6, 7, 5], // +z
  ];
  const center = c(0).map((v, k) => (v + c(7)[k]) / 2);
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(c);
  const owner = {
    min: [0, 1, 2].map((k) => Math.min(...corners.map((p) => p[k]))),
    max: [0, 1, 2].map((k) => Math.max(...corners.map((p) => p[k]))),
    depth: dot(center, back),
  };
  return quads.map((q) => {
    const points = q.map(c);
    let n = norm(cross(sub(points[1], points[0]), sub(points[2], points[0])));
    const mid = points.reduce((a, p) => a.map((v, k) => v + p[k] / 4), [0, 0, 0]);
    if (dot(n, sub(mid, center)) < 0) n = n.map((v) => -v); // normal para fora
    return { points, n, owner };
  });
}

/** Giro em torno do eixo y (`yaw`) e depois translação. */
const yawMove =
  (yaw, [tx, ty, tz] = [0, 0, 0]) =>
  ([x, y, z]) => [
    x * Math.cos(yaw) + z * Math.sin(yaw) + tx,
    y + ty,
    -x * Math.sin(yaw) + z * Math.cos(yaw) + tz,
  ];

/** Giro em torno de uma reta paralela a x em (y0, z0), de `angle`. */
const hinge =
  (y0, z0, angle) =>
  ([x, y, z]) => {
    const dy = y - y0;
    const dz = z - z0;
    return [
      x,
      y0 + dy * Math.cos(angle) - dz * Math.sin(angle),
      z0 + dy * Math.sin(angle) + dz * Math.cos(angle),
    ];
  };

/**
 * Ordem de pintura por peça: se duas peças estão separadas em x, y ou z e se sobrepõem na tela, a do
 * lado da câmera vem depois. As faces de uma mesma caixa (convexa, sem as de trás) nunca se cobrem.
 * Ciclos (raros) caem na ordem pela profundidade do centro.
 */
function paintOrder(faces, flat) {
  const owners = [...new Set(faces.map((f) => f.owner))];
  const rect = new Map(
    owners.map((o) => {
      const pts = faces.filter((f) => f.owner === o).flatMap((f) => f.points.map(flat));
      const xs = pts.map((p) => p[0]);
      const ys = pts.map((p) => p[1]);
      return [o, [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]];
    }),
  );
  const overlap = (a, b) => {
    const [ax0, ax1, ay0, ay1] = rect.get(a);
    const [bx0, bx1, by0, by1] = rect.get(b);
    return ax0 < bx1 && bx0 < ax1 && ay0 < by1 && by0 < ay1;
  };
  // a na frente de b? (true, false ou null quando não estão separadas)
  const front = (a, b) => {
    for (const k of [0, 2, 1]) {
      if (a.min[k] >= b.max[k] - 1e-9) return back[k] > 0;
      if (a.max[k] <= b.min[k] + 1e-9) return back[k] < 0;
    }
    return null;
  };
  const after = new Map(owners.map((o) => [o, new Set()])); // o que precisa vir antes de cada peça
  for (const a of owners) {
    for (const b of owners) {
      if (a !== b && overlap(a, b) && front(a, b) === true) after.get(a).add(b);
    }
  }
  const order = [];
  const done = new Set();
  let pending = [...owners].sort((a, b) => a.depth - b.depth);
  while (pending.length) {
    const ready = pending.find((o) => [...after.get(o)].every((b) => done.has(b))) ?? pending[0];
    order.push(ready);
    done.add(ready);
    pending = pending.filter((o) => o !== ready);
  }
  return order.flatMap((o) => faces.filter((f) => f.owner === o));
}

function tone(n) {
  const light = Math.max(0, dot(n, sun));
  if (n[1] > 0.7 || light > 0.75) return TONES.light;
  return light > 0.35 ? TONES.mid : TONES.dark;
}

/**
 * Desenha as faces visíveis (do fundo para a frente) e, nas faces de borda listadas em `flutes`, a
 * onda do miolo.
 */
function render(faces, { flutes = [] } = {}) {
  const flat = (p) => [dot(p, right), -dot(p, up)];
  const visible = paintOrder(
    faces.filter((f) => dot(f.n, back) > 1e-3),
    flat,
  );
  const all = visible.flatMap((f) => f.points.map(flat));
  const xs = all.map((p) => p[0]);
  const ys = all.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(
    (SIZE.w * (1 - 2 * MARGIN)) / (x1 - x0),
    (SIZE.h * (1 - 2 * MARGIN)) / (y1 - y0),
  );
  const ox = SIZE.w / 2 - ((x0 + x1) / 2) * scale;
  const oy = SIZE.h / 2 - ((y0 + y1) / 2) * scale;
  const px = (p) => {
    const [x, y] = flat(p);
    return [ox + x * scale, oy + y * scale];
  };
  const fmt = (v) => Math.round(v * 10) / 10;
  const path = (points) => `M${points.map((p) => px(p).map(fmt).join(' ')).join('L')}Z`;
  const shapes = visible.map(
    (f) =>
      `<path d="${path(f.points)}" fill="${tone(f.n)}" stroke="${TONES.dark}" stroke-width="0.6" stroke-linejoin="round"/>`,
  );
  // onda do miolo: senoide no meio da face de borda, de um canto ao outro
  for (const face of visible.filter((f) => flutes.includes(f))) {
    const [a, b, , d] = face.points.map(px);
    // o lado longo da face (a→b ou a→d) e o curto, que dá a espessura
    const long = Math.hypot(b[0] - a[0], b[1] - a[1]) > Math.hypot(d[0] - a[0], d[1] - a[1]);
    const [p0, p1, q0] = long ? [a, b, d] : [a, d, b];
    const across = [(q0[0] - p0[0]) / 2, (q0[1] - p0[1]) / 2];
    const length = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    const height = Math.hypot(across[0], across[1]) * 2;
    if (height < 3) continue;
    const waves = Math.max(2, Math.round(length / (height * 1.8)));
    const steps = waves * 8;
    const line = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const wave = 0.32 * Math.sin(t * waves * 2 * Math.PI);
      line.push([
        p0[0] + (p1[0] - p0[0]) * t + across[0] * (1 + wave),
        p0[1] + (p1[1] - p0[1]) * t + across[1] * (1 + wave),
      ]);
    }
    shapes.push(
      `<path d="M${line.map((p) => p.map(fmt).join(' ')).join('L')}" fill="none" stroke="${TONES.dark}" stroke-width="0.9"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE.w} ${SIZE.h}" width="${SIZE.w}" height="${SIZE.h}"><rect width="${SIZE.w}" height="${SIZE.h}" fill="${BACKDROP}"/>${shapes.join('')}</svg>\n`;
}

/** Corte e vinco: caixa tipo maleta com a tampa aberta, orelhas e aba frontal. */
function corteEVinco() {
  const [L, W, H, T] = [0.42, 0.3, 0.1, 0.012];
  const open = (100 * Math.PI) / 180;
  const lid = hinge(H, -W / 2, -open);
  return [
    ...box([-L / 2, 0, -W / 2], [L / 2, T, W / 2]),
    ...box([-L / 2, 0, -W / 2], [L / 2, H, -W / 2 + T]),
    ...box([-L / 2, 0, W / 2 - 2 * T], [L / 2, H, W / 2]),
    ...box([-L / 2, 0, -W / 2 + T], [-L / 2 + 2 * T, H, W / 2 - 2 * T]),
    ...box([L / 2 - 2 * T, 0, -W / 2 + T], [L / 2, H, W / 2 - 2 * T]),
    ...box([-L / 2, H, -W / 2], [L / 2, H + T, W / 2], lid),
    ...box([-L / 2 + 3 * T, H - (H - 2 * T), W / 2 - 2 * T], [L / 2 - 3 * T, H, W / 2 - T], lid),
  ];
}

/** Caixa normal (RSC): fechada, com as abas de cima se encontrando no meio (as das faces longas por cima). */
function caixaNormal() {
  const [L, W, H, T, GAP] = [0.44, 0.3, 0.34, 0.012, 0.006];
  return [
    ...box([-L / 2, 0, -W / 2], [L / 2, H, W / 2]),
    ...box([-L / 2, H, -W / 2], [L / 2, H + T, -GAP / 2]),
    ...box([-L / 2, H, GAP / 2], [L / 2, H + T, W / 2]),
  ];
}

/** Divisórias: tabuleiro baixo e grade 3 × 3, com uma divisória levantada. */
function divisorias() {
  const [S, HT, T, HD] = [0.4, 0.06, 0.01, 0.15];
  const LD = S - 2 * T - 0.006;
  const C = LD / 3;
  const lift = 0.55 * HD;
  const faces = [
    ...box([-S / 2, 0, -S / 2], [S / 2, T, S / 2]),
    ...box([-S / 2, 0, -S / 2], [S / 2, HT, -S / 2 + T]),
    ...box([-S / 2, 0, S / 2 - T], [S / 2, HT, S / 2]),
    ...box([-S / 2, 0, -S / 2 + T], [-S / 2 + T, HT, S / 2 - T]),
    ...box([S / 2 - T, 0, -S / 2 + T], [S / 2, HT, S / 2 - T]),
  ];
  // divisórias em trechos entre os cruzamentos (a pintura do fundo para a frente erra com peças
  // longas que se cruzam); as de x deixam o vão por onde passam as de z
  const spans = [
    [-LD / 2, -C / 2 - T / 2],
    [-C / 2 + T / 2, C / 2 - T / 2],
    [C / 2 + T / 2, LD / 2],
  ];
  for (const z of [-C / 2, C / 2]) {
    for (const [a, b] of spans) faces.push(...box([a, T, z - T / 2], [b, T + HD, z + T / 2]));
  }
  for (const x of [-C / 2, C / 2]) {
    const y = T + (x < 0 ? lift : 0);
    for (const [a, b] of spans) faces.push(...box([x - T / 2, y, a], [x + T / 2, y + HD, b]));
  }
  return faces;
}

/** Chapas: pilha com a chapa de cima deslocada; a onda aparece nas bordas. */
function chapas() {
  const [W, D, T] = [0.5, 0.36, 0.02];
  const sheets = [
    [0, 0, 0],
    [0.006, -0.004, 0.006],
    [-0.005, 0.003, -0.004],
    [0.004, 0.006, 0.008],
    [-0.006, -0.002, -0.006],
    [0.003, -0.006, 0.004],
    [-0.002, 0.005, -0.008],
    [0.005, 0.002, 0.005],
    [-0.004, -0.004, -0.003],
    [0.06, 0.04, 0.1],
  ];
  const faces = [];
  const flutes = [];
  sheets.forEach(([dx, dz, yaw], i) => {
    const sheet = box([-W / 2, 0, -D / 2], [W / 2, T, D / 2], yawMove(yaw, [dx, i * T, dz]));
    faces.push(...sheet);
    flutes.push(sheet[0], sheet[5]); // bordas -x e +z, as que a câmera vê
  });
  return { faces, flutes };
}

const write = (id, svg) => {
  writeFileSync(`${OUT}${id}.svg`, svg);
  console.log(`public/produtos/${id}.svg  ${(svg.length / 1024).toFixed(1)} KB`);
};
write('corte-e-vinco', render(corteEVinco()));
write('caixa-normal', render(caixaNormal()));
write('divisorias', render(divisorias()));
const pile = chapas();
write('chapas', render(pile.faces, { flutes: pile.flutes }));
