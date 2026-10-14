// Medidas da cena, em metros. Origem no piso; x segue a linha de produção, z é a largura.

export const BG = 0xf1ece3;

export const PY = 0.55; // altura da linha de passagem da chapa
export const T = 0.012; // espessura da chapa
export const FEED_X = -5.9; // centro da pilha no alimentador
export const P1X = -4.25; // impressora 1
export const P2X = -3.2; // impressora 2
export const DX = -1.65; // corte e vinco
export const FX = 0.35; // estação formadora
export const FZ = 0.86; // z das laterais das máquinas
export const FT = 0.07; // espessura das laterais

// Caixa: fundo BW × BD e abas de altura BH; aberta, a chapa mede SL × SW.
export const BW = 0.55;
export const BD = 0.45;
export const BH = 0.42;
export const SL = BW + 2 * BH;
export const SW = BD + 2 * BH;
export const STACK_H = 0.36;
export const STACK_Y = PY + T + STACK_H / 2;

export const BELT_X0 = -1.1;
export const BELT_X1 = 3.25;
export const GH = 2.06; // altura do pórtico da formadora
export const HEAD_REST = 1.24; // altura de repouso do cabeçote com as ventosas

// Baú do caminhão
export const CX0 = 3.3;
export const CX1 = 5.2;
export const CY0 = PY;
export const CY1 = 1.95;
export const CZ = 0.82;
export const TW = 0.04; // espessura das paredes
export const WR = 0.32; // raio das rodas
export const DH = CY1 - 0.1 - CY0; // altura da porta de enrolar

export const LIFT = BH - T / 2; // quanto a ventosa ergue o fundo da caixa
export const BOX_END = 4.3; // x final da caixa, já dentro do baú
