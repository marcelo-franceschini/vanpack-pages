// Os 3 modelos dos produtos, só geometria própria, no material do 3D principal: Kraft por fora (as
// texturas do corpo e da aba da cena), face interna mais clara, borda com a onda do miolo e a marca
// Vanpack impressa onde cabe. Unidades em metros, a peça apoiada em y = 0 e a frente virada para +z
// (a câmera de três quartos vê a frente e o lado -x). Cada modelo devolve o grupo, a pegada da sombra
// falsa, o raio em torno do eixo vertical e a altura (para o enquadramento) e as texturas (para
// restaurar o contexto). Formas e decisões: docs/produtos-3d.md.
import { DoubleSide, Group, Matrix4, MeshLambertMaterial, PlaneGeometry, Vector3 } from 'three';
import { KRAFT, KRAFT_INNER } from '../scene/constants.js';
import { bodyTexture, edgeTexture, flapTexture, truckLogoTexture } from '../scene/textures.js';
import { Pieces, rect } from './papelao.js';

const BRAND_ASPECT = 4; // o logo horizontal ocupa 1600 × 400 na textura do baú
const PRINT_GAP = 0.0015; // a impressão fica rente à face, sem brigar com ela no depth buffer

/** Matriz: translada para (x, y, z) e gira `ry` em torno de y e depois `rx` em torno de x. */
const at = (x, y, z, rx = 0, ry = 0) =>
  new Matrix4()
    .makeTranslation(x, y, z)
    .multiply(new Matrix4().makeRotationY(ry))
    .multiply(new Matrix4().makeRotationX(rx));
const FLAT = -Math.PI / 2; // rx que deita uma placa: o contorno (x, y) vira (x, -z) e a face a olha +y

/**
 * Materiais e texturas de um modelo (cada modelo tem os seus: liberar um não afeta os outros). A aba e
 * a marca só existem nos modelos que as usam.
 */
function kit(track, { aba = false, marca = false } = {}) {
  const lambert = (options) => track(new MeshLambertMaterial(options));
  const kraft = (map) => (map ? { map } : { color: KRAFT });
  const body = track(bodyTexture(false));
  const edge = track(edgeTexture());
  const textures = [body, edge];
  const materials = {
    externa: lambert(kraft(body)),
    interna: lambert({ color: KRAFT_INNER }),
    borda: lambert({ map: edge }),
  };
  if (aba) {
    const flap = track(flapTexture());
    textures.push(flap);
    materials.aba = lambert(kraft(flap));
  }
  const brand = marca ? track(truckLogoTexture()) : null;
  if (brand) {
    textures.push(brand);
    materials.marca = lambert({
      map: brand,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  }
  return { textures: textures.filter(Boolean), materials };
}

/** Logo Vanpack de largura `w`, no plano xy de `matrix` (virado para +z, em pé). */
function brandMark(pieces, materials, w, matrix) {
  if (materials.marca) pieces.add('marca', new PlaneGeometry(w, w / BRAND_ASPECT), matrix);
}

function finish(track, pieces, materials, model) {
  const group = new Group();
  pieces.build(materials, group, track);
  return { group, ...model };
}

/**
 * Corte e vinco: caixa tipo maleta, baixa, com a tampa articulada aberta. Paredes da frente e dos
 * lados duplas (a borda mostra as duas camadas), meia-lua de dedo na frente, rasgos de trava no fundo,
 * tampa com orelhas laterais chanfradas e aba frontal com duas linguetas. Marca na frente e na tampa.
 */
function corteEVinco(track) {
  const { textures, materials } = kit(track, { aba: true, marca: true });
  const pieces = new Pieces();
  const L = 0.42; // largura (x)
  const W = 0.3; // profundidade (z)
  const H = 0.1; // altura
  const T = 0.008;
  const OPEN = (100 * Math.PI) / 180; // tampa aberta, um pouco além do vertical
  const NOTCH = 0.02;
  const io = { a: 'externa', b: 'interna' };
  const oi = { a: 'interna', b: 'externa' };

  // fundo, com os dois rasgos de trava da parede da frente
  const slots = [-L / 4, L / 4].map((x) =>
    rect(x - 0.03, -W / 2 + 2.2 * T, x + 0.03, -W / 2 + 3.2 * T),
  );
  pieces.plate(rect(-L / 2, -W / 2, L / 2, W / 2), T, at(0, T / 2, 0, FLAT), {
    ...oi,
    holes: slots,
  });

  // frente dupla com a meia-lua de dedo
  const front = (h) => {
    const arc = [];
    for (let i = 0; i <= 8; i++) {
      const a = (Math.PI * i) / 8;
      arc.push([NOTCH * Math.cos(a), h - NOTCH * Math.sin(a)]);
    }
    return [[-L / 2 + T, 0], [L / 2 - T, 0], [L / 2 - T, h], ...arc, [-L / 2 + T, h]];
  };
  pieces.plate(front(H), T, at(0, 0, W / 2 - T / 2), io);
  pieces.plate(front(H - T), T, at(0, T, W / 2 - 1.5 * T), io);
  brandMark(pieces, materials, 0.17, at(0, 0.04, W / 2 + PRINT_GAP));

  // fundo e lados: o lado é duplo (a camada de dentro vem dobrada por cima)
  pieces.plate(rect(-L / 2, 0, L / 2, H), T, at(0, 0, -W / 2 + T / 2), oi);
  for (const side of [-1, 1]) {
    const ry = (side * Math.PI) / 2;
    const span = rect(-W / 2 + T, 0, W / 2 - 2 * T, H);
    pieces.plate(span, T, at(side * (L / 2 - T / 2), 0, 0, 0, ry), io);
    pieces.plate(
      rect(-W / 2 + T, T, W / 2 - 2 * T, H),
      T,
      at(side * (L / 2 - 1.5 * T), 0, 0, 0, ry),
      io,
    );
  }

  // tampa articulada na borda de cima do fundo; no referencial dela, fechada ela vai de z = 0 a W
  const lid = (matrix) => at(0, H, -W / 2, -OPEN).multiply(matrix);
  pieces.plate(rect(-L / 2, -W, L / 2, 0), T, lid(at(0, T / 2, 0, FLAT)), io);
  // marca na face de fora da tampa, para ler com a tampa aberta (de pé, olhando para trás)
  const outside = new Matrix4().makeBasis(
    new Vector3(-1, 0, 0),
    new Vector3(0, 0, 1),
    new Vector3(0, 1, 0),
  );
  brandMark(pieces, materials, 0.24, lid(at(0, T + PRINT_GAP, W / 2).multiply(outside)));
  // aba frontal com as duas linguetas de trava
  const tuck = H - 2 * T;
  const tab = (c) => [
    [c + 0.03, -tuck],
    [c + 0.025, -tuck - 0.014],
    [c - 0.025, -tuck - 0.014],
    [c - 0.03, -tuck],
  ];
  const tuckOutline = [
    [-L / 2 + 3 * T, 0],
    [L / 2 - 3 * T, 0],
    [L / 2 - 3 * T, -tuck + 0.01],
    [L / 2 - 3 * T - 0.01, -tuck],
    ...tab(L / 4),
    ...tab(-L / 4),
    [-L / 2 + 3 * T + 0.01, -tuck],
    [-L / 2 + 3 * T, -tuck + 0.01],
  ];
  pieces.plate(tuckOutline, T, lid(at(0, 0, W - 1.5 * T)), { a: 'aba', b: 'interna' });
  // orelhas laterais chanfradas, por dentro das paredes duplas
  const ear = H - 2.5 * T;
  const reach = W / 2 - 3 * T;
  for (const side of [-1, 1]) {
    pieces.plate(
      [
        [-reach, 0],
        [reach, 0],
        [reach - 0.035, -ear],
        [-reach + 0.035, -ear],
      ],
      T,
      lid(at(side * (L / 2 - 3.5 * T), 0, W / 2, 0, (side * Math.PI) / 2)),
      { a: 'aba', b: 'interna' },
    );
  }

  const back = -W / 2 + W * Math.cos(OPEN);
  return finish(track, pieces, materials, {
    textures,
    footprint: [-L / 2, L / 2, back, W / 2],
    radius: Math.hypot(L / 2, Math.max(W / 2, -back)),
    top: H + W * Math.sin(OPEN),
  });
}

/**
 * Divisórias, tabuleiros e separadores: tabuleiro baixo com uma grade 3 × 3 de divisórias cruzadas,
 * encaixadas pelos rasgos de meia altura (um par com os rasgos por cima, outro por baixo). Uma
 * divisória está levantada, descendo para o encaixe: os rasgos ficam à mostra. Marca na frente.
 */
function divisorias(track) {
  const { textures, materials } = kit(track, { marca: true });
  const pieces = new Pieces();
  const S = 0.4; // tabuleiro quadrado
  const HT = 0.06;
  const T = 0.008;
  const HD = 0.15; // altura das divisórias
  const LD = S - 2 * T - 0.006;
  const CELL = LD / 3;
  const GAP = T + 0.002; // largura do rasgo
  const LIFT = 0.55 * HD;
  const both = { a: 'externa', b: 'externa' };
  const oi = { a: 'interna', b: 'externa' };
  const io = { a: 'externa', b: 'interna' };

  // tabuleiro: fundo e 4 paredes baixas
  pieces.plate(rect(-S / 2, -S / 2, S / 2, S / 2), T, at(0, T / 2, 0, FLAT), oi);
  pieces.plate(rect(-S / 2, 0, S / 2, HT), T, at(0, 0, S / 2 - T / 2), io);
  pieces.plate(rect(-S / 2, 0, S / 2, HT), T, at(0, 0, -S / 2 + T / 2), oi);
  for (const side of [-1, 1]) {
    pieces.plate(
      rect(-S / 2 + T, 0, S / 2 - T, HT),
      T,
      at(side * (S / 2 - T / 2), 0, 0, 0, (side * Math.PI) / 2),
      io,
    );
  }
  brandMark(pieces, materials, 0.16, at(0, HT / 2, S / 2 + PRINT_GAP));

  // divisória com dois rasgos de meia altura, por cima (`fromTop`) ou por baixo, e cantos chanfrados
  const divider = (fromTop) => {
    const c = 0.006;
    const points = [];
    const slotEnd = HD / 2;
    const notch = (x) =>
      fromTop
        ? [
            [x + GAP / 2, HD],
            [x + GAP / 2, slotEnd],
            [x - GAP / 2, slotEnd],
            [x - GAP / 2, HD],
          ]
        : [
            [x - GAP / 2, 0],
            [x - GAP / 2, slotEnd],
            [x + GAP / 2, slotEnd],
            [x + GAP / 2, 0],
          ];
    const [x0, x1] = [-LD / 2, LD / 2];
    if (fromTop) {
      points.push([x0, c], [x0 + c, 0], [x1 - c, 0], [x1, c], [x1, HD - c], [x1 - c, HD]);
      points.push(...notch(CELL / 2), ...notch(-CELL / 2));
      points.push([x0 + c, HD], [x0, HD - c]);
    } else {
      points.push([x0, c], [x0 + c, 0]);
      points.push(...notch(-CELL / 2), ...notch(CELL / 2));
      points.push([x1 - c, 0], [x1, c], [x1, HD - c], [x1 - c, HD], [x0 + c, HD], [x0, HD - c]);
    }
    return points;
  };
  // par ao longo de x, com os rasgos por cima
  for (const z of [-CELL / 2, CELL / 2]) pieces.plate(divider(true), T, at(0, T, z), both);
  // par ao longo de z, com os rasgos por baixo; o do lado da câmera está levantado
  for (const x of [-CELL / 2, CELL / 2]) {
    const lift = x < 0 ? LIFT : 0;
    pieces.plate(divider(false), T, at(x, T + lift, 0, 0, Math.PI / 2), both);
  }

  return finish(track, pieces, materials, {
    textures,
    footprint: [-S / 2, S / 2, -S / 2, S / 2],
    radius: Math.hypot(S / 2, S / 2),
    top: T + HD + LIFT,
  });
}

/**
 * Chapas de papelão ondulado: pilha de chapas com a borda ondulada à mostra, um pouco irregular como
 * uma pilha de verdade, e a chapa de cima deslocada e girada. Chapa sai lisa, sem impressão.
 */
function chapas(track) {
  const { textures, materials } = kit(track);
  const pieces = new Pieces();
  const W = 0.5;
  const D = 0.36;
  const T = 0.02; // exagerada, como a da pilha do 3D principal, para a onda aparecer na tela
  // deslocamento (x, z) e giro de cada chapa: pequenos e fixos, sem sorteio
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
    [0.06, 0.04, 0.1], // a de cima, deslocada
  ];
  sheets.forEach(([dx, dz, yaw], i) => {
    pieces.plate(rect(-W / 2, -D / 2, W / 2, D / 2), T, at(dx, T / 2 + i * T, dz, FLAT, yaw), {
      a: 'externa',
      b: 'externa',
    });
  });
  return finish(track, pieces, materials, {
    textures,
    footprint: [-W / 2 - 0.01, W / 2 + 0.07, -D / 2 - 0.01, D / 2 + 0.06],
    radius: Math.hypot(W / 2 + 0.07, D / 2 + 0.06),
    top: sheets.length * T,
  });
}

export const MODELOS = { 'corte-e-vinco': corteEVinco, divisorias, chapas };
