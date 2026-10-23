// Medidas, paleta, linha do tempo e câmera da cena. Unidades em metros; x segue a linha de produção
// (da esquerda para a direita), y é a altura e z a largura. Tudo que depende do progresso `p`
// (0…1, o scroll da história) está nas tabelas deste arquivo.

/**
 * Só Carvão/Papel derivados + Floresta + Kraft (manual da marca §2); sem cor de acento. Única exceção:
 * o amarelo e o verde da lâmpada de sinalização da máquina (o manual reserva amarelo à ilustração da linha).
 */
export const KRAFT = '#b78c5c';
export const KRAFT_INNER = '#cfa978'; // face interna do papelão
export const PALETTE = {
  paper: '#fbf8f2', // fundo da página: o piso some nele nas bordas
  floor: '#efe9dc',
  dark: '#2f2d29',
  dark2: '#4b4842',
  mid: '#a9a294',
  light2: '#d8d2c4',
  light: '#ece6da',
  white: '#f7f3ea',
  forest: '#14513a',
  kraft: KRAFT,
  kraftDark: '#9a7447',
  road: '#5a574f',
  glass: '#9c9788',
  amber: '#e3b23c', // lâmpada de sinalização da máquina A: aguardando a peça sair
  signalGreen: '#2fbf6a', // a mesma lâmpada: peça cortada e impressa pronta
};

/** Caixa: painéis longos, painéis curtos, altura e abas. */
export const BOX = { L: 0.44, D: 0.3, H: 0.34, F: 0.15 };
export const SHEET_LENGTH = BOX.H + 2 * BOX.F; // comprimento da chapa no sentido da linha
export const LAYER = 0.013; // espessura de uma camada dobrada
export const SHEET_Y = 0.85; // plano da chapa
export const RAIL_Y = SHEET_Y - LAYER; // topo dos trilhos e piso do baú
export const TURNTABLE_X = 2.65; // mesa giratória
export const PALLET_X = 3.75; // palete
export const PALLET_H = 0.12;
const FLATS = 14; // caixas dobradas empilhadas no palete
export const FLAT_T = 2 * LAYER;
export const STACK_TOP = PALLET_H + FLATS * FLAT_T; // em coordenadas do palete
export const TRUCK_X0 = 6.85; // centro do caminhão no início da estrada
export const ROAD = { straight: 2.0, radius: 9, angle: 0.32 };

/** x do centro da chapa em cada p: sai do alimentador, atravessa as máquinas e chega à mesa. */
export const SHEET_X = [
  [0, -6.7],
  [0.03, -6.7],
  [0.1, -5.75],
  [0.13, -5.05],
  [0.16, -4.55],
  [0.2, -3.5],
  [0.22, -2.9],
  [0.235, -2.16],
  [0.25, -1.85],
  [0.32, -1.55],
  [0.38, -1.2],
  [0.42, -0.95],
  [0.46, -0.55],
  [0.5, -0.12],
  [0.54, 0.45],
  [0.58, 1.2],
  [0.61, 2.0],
  [0.63, TURNTABLE_X],
];

/**
 * Máquina A (impressão e corte): entrada e saída em x e os trechos da frente. As janelas mostram os
 * cilindros; o miolo fechado esconde a troca da chapa lisa pela peça "herói" (PHASE.heroFromX).
 */
export const MACHINE_A = {
  x0: -5.2,
  x1: -2.5,
  printWindow: [-4.9, -4.3],
  closed: [-4.3, -3.3],
  cutWindow: [-3.3, -2.8],
};

/** Faixas de `p` de cada fase (o miolo de cada capítulo é uma pausa da câmera). */
export const PHASE = {
  heroFromX: -3.8, // a chapa sai da máquina de impressão e corte: entra a peça "herói"
  fold: { fromX: -0.55, toX: 0.3 }, // dobra enquanto passa pela máquina de cola (em x)
  lift: [0.61, 0.63], // sobe 15 mm ao chegar à mesa giratória
  open: [0.64, 0.73],
  close: [0.765, 0.81],
  turn: [0.665, 0.745], // uma volta na mesa
  wobble: [0.66, 0.745], // balanço de 0,3 rad durante a volta
  turnBack: [0.77, 0.81],
  hop: [0.805, 0.835], // salta da mesa para o palete
  strap: [0.822, 0.84],
  slide: [0.85, 0.9], // o palete entra no baú
  heroEnd: 0.905, // a peça "herói" passa a ser parte do palete
  door: [0.9, 0.925],
  drive: [0.925, 1], // o caminhão parte pela estrada
  glueEnd: 0.7,
  scrapsFrom: 0.18,
};
export const PALLET_END_X = 5.95; // x do palete dentro do baú
export const SCRAP_FALL = 0.045; // duração da queda de uma apara, em p

/** Aparas que caem no recolhimento (largura, profundidade, z, p de início, deriva e giro). */
export const SCRAPS = [
  { w: 0.15, d: 0.3, z: -0.22, t0: 0.235, vx: 0.05, rot: 1.4 },
  { w: 0.15, d: 0.3, z: 0.52, t0: 0.238, vx: 0.08, rot: -1.7 },
  { w: 0.15, d: 0.035, z: -0.37, t0: 0.241, vx: 0.04, rot: 2.2 },
  { w: 0.12, d: 0.03, z: -0.07, t0: 0.244, vx: 0.07, rot: -2.6 },
  { w: 0.1, d: 0.03, z: 0.37, t0: 0.247, vx: 0.05, rot: 3.1 },
];

/**
 * Câmera: ângulo de três quartos constante e alvo (x, y, z) com largura e altura úteis (m) por
 * capítulo. Em retrato o último quadro usa outro enquadramento e a largura útil é 70%.
 */
export const CAMERA_DIRECTION = [-0.62, 0.55, 0.82];
const PORTRAIT_WIDTH = 0.7;
const CAMERA_KEYS = [
  {
    p: 0,
    at: [-6.0, 0.72, 0],
    w: 7.4,
    h: 4.0,
    portrait: { at: [-6.0, 0.72, 0], w: 3.5, h: 2.8 },
  },
  { p: 0.25, at: [-2.7, 0.78, 0], w: 4.6, h: 2.5 },
  { p: 0.5, at: [-0.1, 0.84, 0], w: 3.6, h: 2.0 },
  { p: 0.75, at: [2.9, 0.98, 0], w: 3.2, h: 1.9 },
  {
    p: 1,
    at: [9.7, 0.8, -1.0],
    w: 12.8,
    h: 5.0,
    portrait: { at: [12.4, 0.8, -1.5], w: 9.2, h: 4.4 },
  },
];
const flatKey = ({ p, at, w, h }) => ({ p, x: at[0], y: at[1], z: at[2], w, h });
export const CAMERA = {
  landscape: CAMERA_KEYS.map(flatKey),
  portrait: CAMERA_KEYS.map((k) =>
    k.portrait ? flatKey({ p: k.p, ...k.portrait }) : flatKey({ ...k, w: k.w * PORTRAIT_WIDTH }),
  ),
};
export const CAMERA_PAUSE = 0.12; // fração de cada trecho em que a câmera fica parada nos centros
