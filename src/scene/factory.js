// A linha de produção estática: alimentador, máquina de impressão e corte (A), vão com rolos e
// recolhimento das aparas, máquina de dobra e cola (B), esteira de trilhos e mesa giratória. Tudo
// é mesclado por material (um draw call por material).
import { RAIL_Y, TURNTABLE_X } from './constants.js';
import { Batch } from './geometry.js';

const RAIL = RAIL_Y;
const XT = TURNTABLE_X;

/**
 * @param {import('three').Object3D} parent
 * @param {Record<string, import('three').Material>} M materiais por cor
 */
export function buildFactory(parent, M) {
  const st = new Batch();
  // alimentador
  st.box(M.dark, -7.4, -6.0, 0, 0.1, -1.05, 0.91);
  st.box(M.light2, -7.35, -6.05, 0.1, 0.53, -1.0, 0.86);
  for (const [x, z] of [
    [-7.03, -0.85],
    [-7.03, 0.71],
    [-6.37, -0.85],
    [-6.37, 0.71],
  ])
    st.box(M.dark, x - 0.02, x + 0.02, 0.53, 1.0, z - 0.02, z + 0.02, 0.008);
  st.box(M.dark, -6.05, -5.2, RAIL - 0.014, RAIL, -0.9, 0.9, 0.004);
  // máquina A — impressão e corte numa passada
  const A0 = -5.2,
    A1 = -2.5;
  st.box(M.dark, A0 - 0.05, A1 + 0.05, 0, 0.12, -1.05, 1.05);
  st.box(M.light2, A0, A1, 0.12, 0.77, -1.0, 1.0);
  st.box(M.forest, A0 + 0.25, A1 - 0.25, 0.3, 0.44, 1.0, 1.012);
  st.box(M.dark, A0 + 0.02, A1 - 0.02, 0.77, 0.93, -0.96, 0.96, 0.004);
  st.box(M.light, A0, A1 - 0.6, 0.93, 1.36, -1.0, 1.0);
  st.box(M.light2, A1 - 0.6, A1, 0.93, 0.98, -1.0, 1.0, 0.012);
  st.box(M.light2, A0 + 0.6, A1 - 1.3, 1.36, 1.58, -0.8, 0.8);
  st.box(M.dark, A1 - 1.2, A1 - 0.8, 1.36, 1.72, 0.45, 0.9);
  st.box(M.light, A1 - 1.18, A1 - 0.82, 1.5, 1.66, 0.9, 0.912, 0.004);
  for (const x of [A0 - 0.01, A1 + 0.01]) {
    st.cyl(M.dark2, x, 0.775, 0, 0.065, 1.7);
    st.cyl(M.dark2, x, 0.925, 0, 0.065, 1.7);
  }
  // vão com rolos e recolhimento
  for (const x of [-2.3, -2.05, -1.8, -1.55, -1.3])
    st.cyl(M.dark2, x, RAIL - 0.025, 0, 0.025, 1.7, 'z', 10);
  st.box(M.dark, -2.45, -1.0, RAIL - 0.04, RAIL - 0.02, -0.92, -0.88, 0.004);
  st.box(M.dark, -2.45, -1.0, RAIL - 0.04, RAIL - 0.02, 0.88, 0.92, 0.004);
  st.box(M.dark, -2.3, -1.7, 0, 0.04, -0.7, 0.7, 0.01);
  st.box(M.dark2, -2.3, -2.26, 0.04, 0.46, -0.7, 0.7, 0.01);
  st.box(M.dark2, -1.74, -1.7, 0.04, 0.46, -0.7, 0.7, 0.01);
  st.box(M.dark2, -2.26, -1.74, 0.04, 0.46, -0.7, -0.66, 0.01);
  st.box(M.dark2, -2.26, -1.74, 0.04, 0.46, 0.66, 0.7, 0.01);
  // máquina B — dobra e cola
  const B0 = -1.0,
    B1 = 1.4;
  st.box(M.dark, B0 - 0.05, B1 + 0.05, 0, 0.1, -0.67, 0.67);
  st.box(M.light2, B0, B1, 0.1, 0.34, -0.62, 0.62);
  st.box(M.forest, B0 + 0.2, B1 - 0.2, 0.17, 0.27, 0.62, 0.632);
  st.box(M.light, -0.2, 0.7, 0.34, 1.3, -1.08, -0.72);
  st.box(M.forest, -0.1, 0.6, 0.95, 1.18, -0.72, -0.708);
  st.box(M.dark, -0.15, 0.65, 1.3, 1.38, -1.1, -0.7, 0.01);
  // esteira de trilhos até o baú
  for (const z of [-0.36, 0.36])
    st.box(M.dark2, B0, 4.75, RAIL - 0.04, RAIL, z - 0.08, z + 0.08, 0.008);
  for (const x of [-0.92, 1.34, 1.9, 2.5, 3.1, 3.7, 4.3])
    for (const z of [-0.36, 0.36])
      st.box(M.dark, x - 0.03, x + 0.03, 0.34, RAIL - 0.04, z - 0.03, z + 0.03, 0.006);
  st.box(M.dark, B1 + 0.0, 4.75, 0, 0.1, -0.67, 0.67);
  st.box(M.light2, B1 + 0.05, 4.7, 0.1, 0.34, -0.62, 0.62);
  // cola (bocal) e prensa
  st.box(M.dark, -0.76, -0.7, 0.34, 1.1, 0.9, 0.96, 0.01);
  st.box(M.dark, -0.76, -0.7, 1.04, 1.1, 0.64, 0.96, 0.01);
  st.box(M.forest, -0.76, -0.7, 0.94, 1.04, 0.61, 0.67, 0.008);
  for (const z of [-0.5, 0.5]) st.box(M.dark, 1.08, 1.16, 0.34, 1.06, z - 0.04, z + 0.04, 0.01);
  st.cyl(M.dark2, 1.12, 0.925, 0, 0.07, 1.0);
  st.cyl(M.dark2, 1.12, 0.757, 0, 0.07, 0.6);
  // mesa giratória
  st.cyl(M.dark2, XT, RAIL + 0.008, 0, 0.64, 0.02, 'y', 40);
  st.build(parent);
}
