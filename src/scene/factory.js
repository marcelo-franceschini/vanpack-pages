// A linha de produção estática: alimentador, máquina de impressão e corte (A), vão com rolos e
// recolhimento das aparas, máquina de dobra e cola (B), esteira de trilhos e mesa giratória. Tudo
// é mesclado por material (um draw call por material); só os marcadores giratórios da máquina A
// ficam em malhas à parte (machine.js).
import { RAIL_Y, TURNTABLE_X } from './constants.js';
import { Batch } from './geometry.js';
import { buildMachineA } from './machine.js';

const RAIL = RAIL_Y;
const XT = TURNTABLE_X;

/** Mesa de rolos (eixo em z) entre duas guias, de `x0` a `x1`: o topo dos rolos fica em RAIL_Y. */
function rollerBed(st, M, xs, x0, x1) {
  for (const x of xs) st.cyl(M.dark2, x, RAIL - 0.025, 0, 0.025, 1.7, 'z', 10);
  st.box(M.dark, x0, x1, RAIL - 0.04, RAIL - 0.02, -0.92, -0.88, 0.004);
  st.box(M.dark, x0, x1, RAIL - 0.04, RAIL - 0.02, 0.88, 0.92, 0.004);
}

/**
 * @param {import('three').Object3D} parent
 * @param {Record<string, import('three').Material>} M materiais por cor
 * @returns {{ spin: (p: number) => void }} gira os cilindros da máquina A conforme o progresso
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
  // entrada da máquina A: rolos, como na saída (primeiro rolo a 0,2 m do rolo grosso)
  rollerBed(st, M, [-5.4, -5.65, -5.9], -6.05, -5.25);
  // máquina A — impressão e corte numa passada, com janelas e cilindros giratórios
  const machine = buildMachineA(st, parent, M);
  // vão com rolos e recolhimento
  rollerBed(st, M, [-2.3, -2.05, -1.8, -1.55, -1.3], -2.45, -1.0);
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
  return machine;
}
