// A máquina A — impressão e corte numa passada. A carcaça tem duas janelas na frente (+z) que mostram
// os cilindros de impressão e de corte; entre elas, um trecho fechado esconde a troca da chapa lisa
// pela peça "herói". O miolo dos cilindros é estático na malha mesclada da fábrica: só giram os
// marcadores (listras, luva, lâminas e cruzes), uma malha por cilindro, no ritmo da chapa.
import { BoxGeometry, CylinderGeometry, Group, Matrix4 } from 'three';
import { MACHINE_A, RAIL_Y, SHEET_LENGTH, SHEET_X } from './constants.js';
import { Batch } from './geometry.js';
import { clamp, lin } from './math.js';

const { x0: A0, x1: A1, printWindow, closed, cutWindow } = MACHINE_A;
const FLAT = 1; // chanfro maior que a peça: vira BoxGeometry (12 triângulos), para o que não aparece
const WINDOW_Y = [0.5, 1.26]; // vão das janelas
const LENGTH = 1.8; // comprimento dos cilindros (z ±0,9)
const UNDER = RAIL_Y; // topo dos cilindros de baixo (a chapa anda poucos mm acima)
const OVER = 0.862; // base dos cilindros de cima (a chapa termina em 0,85; o marcador sobe até 12 mm)
const SEGMENTS = 20;

const SPIN_FROM = A0 - SHEET_LENGTH / 2; // a ponta da chapa chega ao primeiro aperto
const SPIN_TO = A1 + SHEET_LENGTH / 2; // a cauda sai do último aperto

/** Quanto a chapa andou (m) dentro da máquina: 0 antes de entrar e constante depois de sair. */
export const spinTravel = (sheetX) => clamp(sheetX, SPIN_FROM, SPIN_TO) - SPIN_FROM;

const IDENTITY = new Matrix4();
const at = (x, y, z) => new Matrix4().makeTranslation(x, y, z);

/** Arco de cilindro de eixo z (listra, luva): `theta` rad a partir de `from`. */
function arc(marks, material, radius, length, from, theta) {
  const segments = Math.max(4, Math.ceil((24 * theta) / (2 * Math.PI)));
  const geometry = new CylinderGeometry(radius, radius, length, segments, 1, false, from, theta);
  marks.add(geometry.rotateX(Math.PI / 2), material, IDENTITY);
}

/** Cruz na tampa da frente (+z), visível pela janela: deixa o giro legível. */
function cross(marks, material, radius) {
  const arm = 1.6 * radius;
  marks.add(new BoxGeometry(arm, 0.02, 0.012), material, at(0, 0, LENGTH / 2 + 0.006));
  marks.add(new BoxGeometry(0.02, arm, 0.012), material, at(0, 0, LENGTH / 2 + 0.006));
}

/** Lâmina radial da faca rotativa, no ângulo `angle`. */
function blade(marks, material, radius, angle) {
  const reach = radius + 0.001;
  const matrix = new Matrix4()
    .makeRotationZ(angle)
    .setPosition(Math.cos(angle) * reach, Math.sin(angle) * reach, 0);
  marks.add(new BoxGeometry(0.022, 0.02, 1.6), material, matrix);
}

/** Grupo giratório de um cilindro: os marcadores de `draw` numa só malha, sem sombra. */
function spinner(parent, x, y, radius, dir, material, draw) {
  const object = new Group();
  object.position.set(x, y, 0);
  const marks = new Batch();
  draw(marks, material);
  marks.build(object, false);
  parent.add(object);
  return { object, radius, dir };
}

/** Vão aberto na frente: piso, fundo e forros escuros dão profundidade ao que se vê dentro. */
function windowBay(st, M, [w0, w1]) {
  const [y0, y1] = WINDOW_Y;
  const liner = 0.015;
  st.box(M.dark, w0, w1, y0, y0 + 0.008, -0.96, 0.96, FLAT);
  st.box(M.dark, w0, w1, y0, y1, -0.98, -0.9, FLAT);
  st.box(M.dark, w0, w0 + liner, y0, y1, -0.96, 0.96, FLAT);
  st.box(M.dark, w1 - liner, w1, y0, y1, -0.96, 0.96, FLAT);
}

/**
 * @param {import('./geometry.js').Batch} st malha estática da fábrica (a máquina entra nela)
 * @param {import('three').Object3D} parent
 * @param {Record<string, import('three').Material>} M materiais por cor
 * @returns {{ spin: (p: number) => void }} gira os cilindros conforme o progresso `p`; não aloca
 */
export function buildMachineA(st, parent, M) {
  const [y0, y1] = WINDOW_Y;
  const exit0 = cutWindow[1];

  // base, corpo baixo e faixa Floresta da frente
  st.box(M.dark, A0 - 0.05, A1 + 0.05, 0, 0.12, -1.05, 1.05);
  st.box(M.light2, A0, A1, 0.12, y0, -1.0, 1.0);
  st.box(M.forest, A0 + 0.25, A1 - 0.25, 0.3, 0.44, 1.0, 1.012);

  // trechos fechados: corpo, faixa escura (recuada) por onde passa a chapa e capô
  const bay = (x0, x1, slot0, slot1) => {
    st.box(M.light2, x0, x1, y0, 0.77, -1.0, 1.0);
    st.box(M.dark, slot0, slot1, 0.77, 0.93, -0.96, 0.96, FLAT);
    st.box(M.light, x0, x1, 0.93, y1, -1.0, 1.0);
  };
  bay(A0, printWindow[0], A0 + 0.02, printWindow[0]);
  bay(closed[0], closed[1], closed[0], closed[1]);
  st.box(M.light2, exit0, A1, y0, 0.77, -1.0, 1.0);
  st.box(M.dark, exit0, A1 - 0.02, 0.77, 0.93, -0.96, 0.96, FLAT);
  st.box(M.light2, exit0, A1, 0.93, 0.98, -1.0, 1.0, 0.012);
  st.box(M.light, A0, exit0, y1, 1.36, -1.0, 1.0); // capô sobre as janelas
  windowBay(st, M, printWindow);
  windowBay(st, M, cutWindow);

  // duto sobre o capô, torre de luz e grelha
  st.cyl(M.dark2, -4.2, 1.53, -0.4, 0.09, 0.34, 'y', 16);
  st.cyl(M.dark, -4.2, 1.71, -0.4, 0.105, 0.03, 'y', 16);
  st.cyl(M.dark2, -5.0, 1.49, 0.88, 0.02, 0.26, 'y', 8);
  st.cyl(M.forest, -5.0, 1.68, 0.88, 0.05, 0.12, 'y', 12);
  st.cyl(M.dark, -5.0, 1.75, 0.88, 0.056, 0.02, 'y', 12);
  for (const y of [0.56, 0.6, 0.64, 0.68, 0.72]) {
    st.box(M.dark, -4.1, -3.5, y, y + 0.012, 1.0, 1.01, FLAT);
  }

  // rolos de aperto da entrada e da saída (estáticos: cilindro liso não mostra o giro)
  for (const x of [A0 - 0.01, A1 + 0.01]) {
    st.cyl(M.dark2, x, 0.775, 0, 0.065, 1.7);
    st.cyl(M.dark2, x, 0.925, 0, 0.065, 1.7);
  }

  // cilindros: miolo estático + marcadores giratórios (embaixo gira para -z, em cima para +z)
  const spinners = [];
  const roll = (core, x, y, radius, dir, mark, draw, segments = SEGMENTS) => {
    st.cyl(core, x, y, 0, radius, LENGTH, 'z', segments);
    spinners.push(spinner(parent, x, y, radius, dir, mark, draw));
  };
  const below = (m, c) => {
    arc(m, c, 0.154, 1.7, 0, 1);
    cross(m, c, 0.15);
  };
  const [print0, print1] = printWindow;
  const px = (print0 + print1) / 2 + 0.05; // sobra espaço à esquerda para o anilox
  roll(M.mid, px, UNDER - 0.15, 0.15, -1, M.dark2, below); // contra-pressão
  roll(M.dark2, px, OVER + 0.17, 0.17, 1, M.forest, (m, c) => {
    arc(m, c, 0.182, 1.4, 1.2, 3.6); // luva do clichê, em Floresta
    cross(m, c, 0.17);
  });
  roll(M.mid, px - 0.225, 1.137, 0.06, -1, M.dark2, (m, c) => arc(m, c, 0.064, 1.7, 0, 1.2), 12); // anilox
  const cx = (cutWindow[0] + cutWindow[1]) / 2;
  roll(M.mid, cx, UNDER - 0.15, 0.15, -1, M.dark2, below); // bigorna
  roll(M.dark2, cx, OVER + 0.17, 0.17, 1, M.mid, (m, c) => {
    blade(m, c, 0.17, 0); // faca rotativa
    blade(m, c, 0.17, Math.PI);
    cross(m, c, 0.17);
  });

  return {
    spin(p) {
      const travel = spinTravel(lin(p, SHEET_X));
      for (const s of spinners) s.object.rotation.z = (s.dir * travel) / s.radius;
    },
  };
}
