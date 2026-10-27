// Os 4 modelos dos produtos, só geometria própria, no material do 3D principal: Kraft por fora (as
// texturas do corpo e da aba da cena), face interna mais clara, borda com a onda do miolo e a marca
// genérica "SUA MARCA" (src/produtos/marca.js) impressa onde cabe. Unidades em metros, a peça apoiada em y = 0 e a frente virada para +z
// (a câmera de três quartos vê a frente e o lado -x). Cada modelo devolve o grupo, a pegada da sombra
// falsa, o raio em torno do eixo vertical e a altura (para o enquadramento) e as texturas (para
// restaurar o contexto). Formas e decisões: docs/produtos-3d.md.
import { DoubleSide, Group, Matrix4, MeshLambertMaterial, PlaneGeometry, Vector3 } from 'three';
import { KRAFT, KRAFT_INNER } from '../scene/constants.js';
import { bodyTexture, edgeTexture, flapTexture } from '../scene/textures.js';
import { suaMarcaTexture } from './marca.js';
import { papelTexture } from './papel.js';
import { Pieces, rect } from './papelao.js';

const BRAND_ASPECT = 4; // a marca ocupa 1600 × 400 na textura (src/produtos/marca.js)
const PAPELAO_T = 0.006; // espessura do papelão (exagerada, para a onda da borda aparecer na tela)
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
function kit(track, { aba = false, marca = false, papel = true } = {}) {
  const lambert = (options) => track(new MeshLambertMaterial(options));
  const kraft = (map) => (map ? { map } : { color: KRAFT });
  const edge = track(edgeTexture());
  const textures = [edge];
  const materials = { borda: lambert({ map: edge }) };
  if (papel) {
    // faces com granulado e fibras de papel, no lugar do corpo da cena (que tem faixas de vinco nas pontas)
    const outer = track(papelTexture(KRAFT));
    const inner = track(papelTexture(KRAFT_INNER));
    textures.push(outer, inner);
    materials.externa = lambert(kraft(outer));
    materials.interna = lambert(inner ? { map: inner } : { color: KRAFT_INNER });
    if (aba) materials.aba = materials.externa; // a aba é a mesma folha: mesma face de fora
  } else {
    const body = track(bodyTexture(false));
    textures.push(body);
    materials.externa = lambert(kraft(body));
    materials.interna = lambert({ color: KRAFT_INNER });
    if (aba) {
      const flap = track(flapTexture());
      textures.push(flap);
      materials.aba = lambert(kraft(flap));
    }
  }
  const brand = marca ? track(suaMarcaTexture()) : null;
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

/** "SUA MARCA" de largura `w`, no plano xy de `matrix` (virada para +z, em pé). */
function brandMark(pieces, materials, w, matrix) {
  if (materials.marca) pieces.add('marca', new PlaneGeometry(w, w / BRAND_ASPECT), matrix);
}

function finish(track, pieces, materials, model) {
  const group = new Group();
  pieces.build(materials, group, track);
  return { group, ...model };
}

/** Matriz de uma folha: origem, direção do trecho (+y local) e a normal da face externa (+z local). */
const frame = (origin, heading, normal) =>
  new Matrix4()
    .makeBasis(new Vector3().crossVectors(heading, normal), heading, normal)
    .setPosition(origin);
const V = (x, y, z) => new Vector3(x, y, z);
const BEND = 0.55; // raio da dobra, em espessuras: a face de dentro quase não tem folga

/**
 * Corte e vinco: caixa tipo maleta, baixa, com a tampa articulada aberta. Fundo, frente, lados e tampa
 * são a mesma folha de papelão dobrada: as paredes da frente e dos lados sobem do fundo e voltam para dentro
 * numa dobra por cima (paredes duplas, a dobra mostra o vinco), a tampa sai da parede de trás, e a
 * aba frontal (com duas linguetas) e as orelhas laterais (chanfradas) saem da tampa, cada uma por uma dobra.
 * Rasgos de trava no fundo. Marca na frente e na tampa.
 */
function corteEVinco(track) {
  const { textures, materials } = kit(track, { aba: true, marca: true });
  const pieces = new Pieces();
  const L = 0.42; // largura (x)
  const W = 0.3; // profundidade (z)
  const H = 0.1; // altura
  const T = PAPELAO_T;
  const R = BEND * T;
  const OPEN = (100 * Math.PI) / 180; // tampa aberta, um pouco além do vertical
  const Lf = L - 2 * R - T; // o fundo termina onde as dobras começam
  const Wf = W - 2 * R - T;
  const floorY = T / 2;
  const doubled = 2 * R + T; // a parede dupla, de fora até a face de dentro
  const oi = { a: 'interna', b: 'externa' };
  const up = H - T - 2 * R; // trecho reto da parede até a dobra de cima
  const down = up - 0.8 * T; // a camada de dentro volta quase até o fundo

  // fundo, com os dois rasgos de trava da parede da frente
  const slots = [-L / 4, L / 4].map((x) =>
    rect(x - 0.03, -W / 2 + 2.2 * T, x + 0.03, -W / 2 + 3.2 * T),
  );
  pieces.plate(rect(-Lf / 2, -Wf / 2, Lf / 2, Wf / 2), T, at(0, floorY, 0, FLAT), {
    ...oi,
    holes: slots,
  });

  // frente: sobe, dobra para dentro e desce
  pieces.sheet(frame(V(0, floorY, Wf / 2), V(0, 0, 1), V(0, -1, 0)), [-L / 2, L / 2], T, R, [
    { bend: Math.PI / 2 },
    up,
    { bend: Math.PI },
    down,
  ]);
  brandMark(pieces, materials, 0.17, at(0, 0.04, W / 2 + PRINT_GAP));

  // lados: a camada de dentro vem dobrada por cima; terminam rente às paredes da frente e de trás
  const reachSide = W / 2 - doubled - 0.0005;
  for (const side of [-1, 1]) {
    pieces.sheet(
      frame(V(side * (Lf / 2), floorY, 0), V(side, 0, 0), V(0, -1, 0)),
      [-reachSide, reachSide],
      T,
      R,
      [{ bend: Math.PI / 2 }, up, { bend: Math.PI }, down],
    );
  }

  // fundo da caixa (parede de trás) e a tampa, na mesma folha: sobe, dobra para trás na tampa aberta
  const lidWidth = L / 2 - doubled - T - R - 0.0005; // meia largura: as orelhas descem por dentro dos lados
  const wall = pieces.sheet(
    frame(V(0, floorY, -Wf / 2), V(0, 0, -1), V(0, -1, 0)),
    [-L / 2, L / 2],
    T,
    R,
    [{ bend: Math.PI / 2 }, H - floorY - 2 * R - T / 2],
  );
  const lidLength = W - T;
  const lid = pieces.sheet(wall[2], [-lidWidth, lidWidth], T, R, [
    { bend: Math.PI / 2 - OPEN }, // fechada seriam 90° para dentro; aberta a 100° volta 10° para fora
    lidLength,
    { bend: Math.PI / 2 },
    {
      flat: H - 3 * T,
      outline: tuckOutline(lidWidth, H - 3 * T, L / 4),
    },
  ]);
  const lidFrame = lid[1];
  // orelhas laterais chanfradas, por dentro das paredes duplas
  const ear = H - 2.5 * T;
  const reach = W / 2 - 3 * T;
  for (const side of [-1, 1]) {
    const earFrame = lidFrame
      .clone()
      .multiply(new Matrix4().makeTranslation(side * lidWidth, lidLength / 2, 0))
      .multiply(frame(V(0, 0, 0), V(side, 0, 0), V(0, 0, 1)));
    pieces.sheet(
      earFrame,
      [-reach, reach],
      T,
      R,
      [
        { bend: Math.PI / 2 },
        {
          flat: ear,
          outline: [
            [-reach, 0],
            [reach, 0],
            [reach - 0.035, ear],
            [-reach + 0.035, ear],
          ],
        },
      ],
      { a: 'aba', b: 'interna' },
    );
  }
  // marca na face de fora da tampa, para ler com a tampa aberta (de pé, olhando para trás)
  brandMark(
    pieces,
    materials,
    0.24,
    lidFrame.clone().multiply(at(0, lidLength / 2, T / 2 + PRINT_GAP)),
  );

  const back = -W / 2 + W * Math.cos(OPEN);
  return finish(track, pieces, materials, {
    textures,
    footprint: [-L / 2, L / 2, back, W / 2],
    radius: Math.hypot(L / 2, Math.max(W / 2, -back)),
    top: H + W * Math.sin(OPEN),
  });
}

/** Contorno da aba frontal: duas linguetas de trava (em ±`tabX`) na ponta, de 0 a `length` (y). */
function tuckOutline(half, length, tabX) {
  const tab = (c) => [
    [c + 0.03, length],
    [c + 0.025, length + 0.014],
    [c - 0.025, length + 0.014],
    [c - 0.03, length],
  ];
  return [
    [-half, 0],
    [half, 0],
    [half, length - 0.01],
    [half - 0.01, length],
    ...tab(-tabX),
    ...tab(tabX),
    [-half + 0.01, length],
    [-half, length - 0.01],
  ];
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
  const T = PAPELAO_T;
  const HD = 0.15; // altura das divisórias
  const LD = S - 2 * T - 0.006;
  const CELL = LD / 3;
  const GAP = T + 0.002; // largura do rasgo
  const LIFT = 0.55 * HD;
  const both = { a: 'externa', b: 'externa' };
  const oi = { a: 'interna', b: 'externa' };

  // tabuleiro: o fundo e as 4 paredes baixas são a mesma folha, dobrada nas bordas
  const R = BEND * T;
  const Sf = S - 2 * R - T;
  pieces.plate(rect(-Sf / 2, -Sf / 2, Sf / 2, Sf / 2), T, at(0, T / 2, 0, FLAT), oi);
  const wallRise = HT - T / 2 - R;
  const reachSide = S / 2 - T - 0.0005; // os lados terminam rente à frente e ao fundo
  for (const [origin, heading, range] of /** @type {[Vector3, Vector3, [number, number]][]} */ ([
    [V(0, T / 2, Sf / 2), V(0, 0, 1), [-S / 2, S / 2]],
    [V(0, T / 2, -Sf / 2), V(0, 0, -1), [-S / 2, S / 2]],
    [V(Sf / 2, T / 2, 0), V(1, 0, 0), [-reachSide, reachSide]],
    [V(-Sf / 2, T / 2, 0), V(-1, 0, 0), [-reachSide, reachSide]],
  ])) {
    pieces.sheet(frame(origin, heading, V(0, -1, 0)), range, T, R, [
      { bend: Math.PI / 2 },
      wallRise,
    ]);
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
  const { textures, materials } = kit(track, { papel: false });
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

/**
 * Caixa normal (RSC): a caixa de peça única, fechada, com as abas de cima dobradas para dentro e se
 * encontrando no meio. As abas das faces longas ficam por cima e deixam uma fresta fina entre elas, por
 * onde se vê as das faces curtas, que ficam por baixo. Proporções da caixa do 3D principal (BOX em
 * src/scene/constants.js): 0,44 × 0,30 × 0,34 m. Marca nas duas faces longas. Sem fundo (a câmera, de cima,
 * nunca o vê).
 */
function caixaNormal(track) {
  const { textures, materials } = kit(track, { marca: true });
  const pieces = new Pieces();
  const L = 0.44; // largura (x), as faces longas
  const W = 0.3; // profundidade (z), as faces curtas
  const H = 0.34; // altura
  const T = PAPELAO_T;
  const R = BEND * T;
  const GAP = 0.006; // fresta entre as duas abas de cima das faces longas
  const STACK = 0.0005; // as abas longas ficam por cima das curtas, sem se tocar

  // cada face sobe, dobra para dentro e a aba segue na mesma folha. As curtas dobram um pouco mais
  // baixo, para as abas longas passarem por cima delas.
  const face = (origin, heading, normal, range, rise, flap) =>
    pieces.sheet(frame(origin, heading, normal), range, T, R, [rise, { bend: Math.PI / 2 }, flap]);
  const longRise = H + T / 2 - R + STACK;
  const longFlap = W / 2 - T / 2 - R - GAP / 2;
  const shortRise = H - T / 2 - R;
  const shortFlap = W / 2 - T;
  const edge = W / 2 - T / 2;
  face(V(0, 0, edge), V(0, 1, 0), V(0, 0, 1), [-L / 2, L / 2], longRise, longFlap);
  face(V(0, 0, -edge), V(0, 1, 0), V(0, 0, -1), [-L / 2, L / 2], longRise, longFlap);
  for (const side of [-1, 1]) {
    face(
      V(side * (L / 2 - T / 2), 0, 0),
      V(0, 1, 0),
      V(side, 0, 0),
      [-(W / 2 - T), W / 2 - T],
      shortRise,
      shortFlap,
    );
  }
  // a marca nas duas faces longas
  brandMark(pieces, materials, 0.24, at(0, H / 2, W / 2 + PRINT_GAP));
  brandMark(pieces, materials, 0.24, at(0, H / 2, -W / 2 - PRINT_GAP, 0, Math.PI));

  return finish(track, pieces, materials, {
    textures,
    footprint: [-L / 2, L / 2, -W / 2, W / 2],
    radius: Math.hypot(L / 2, W / 2),
    top: H + T + STACK,
  });
}

export const MODELOS = {
  'corte-e-vinco': corteEVinco,
  'caixa-normal': caixaNormal,
  divisorias,
  chapas,
};
