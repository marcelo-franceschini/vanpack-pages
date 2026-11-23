// A marca genérica "SUA MARCA" (a do cliente demo da cena principal: anel e palavra, numa tinta só,
// Floresta) como textura transparente 4:1, para o plano da marca nos modelos dos produtos. As letras são as
// de src/scene/textures.js, que é travado por hash e não as exporta; ali a marca cobre a face inteira da
// caixa, aqui ela é uma etiqueta pequena sobre o Kraft liso. Seguro para Web Worker: não acessa DOM.
import { CanvasTexture, SRGBColorSpace } from 'three';
import { PALETTE } from '../scene/constants.js';

// Letras geométricas simples, em linhas num quadrado de 1 × 1 (como em src/scene/textures.js).
const GLYPHS = {
  S: [
    [
      [1, 0],
      [0, 0],
      [0, 0.5],
      [1, 0.5],
      [1, 1],
      [0, 1],
    ],
  ],
  U: [
    [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0],
    ],
  ],
  A: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 1],
    ],
    [
      [0, 0.5],
      [1, 0.5],
    ],
  ],
  M: [
    [
      [0, 1],
      [0, 0],
      [0.5, 0.55],
      [1, 0],
      [1, 1],
    ],
  ],
  R: [
    [
      [0, 1],
      [0, 0],
      [1, 0],
      [1, 0.5],
      [0, 0.5],
    ],
    [
      [0.45, 0.5],
      [1, 1],
    ],
  ],
  C: [
    [
      [1, 0],
      [0, 0],
      [0, 1],
      [1, 1],
    ],
  ],
};

const WIDTH = 1600; // o mesmo 4:1 e a mesma resolução da marca que estava aqui antes
const HEIGHT = 400;
const SCALE = 0.5; // metade da resolução de projeto: a marca ocupa poucos pixels na tela

/** Anel e palavra lado a lado, em coordenadas de projeto de 1600 × 400, centrados. */
function draw(g) {
  g.fillStyle = PALETTE.forest;
  g.strokeStyle = PALETTE.forest;
  const glyphH = 64;
  const glyphW = 50;
  const stroke = 14;
  const gap = 22;
  const space = 50;
  const ring = 152; // diâmetro do anel, com o traço
  const word = 'SUA MARCA';
  let total = -gap;
  for (const ch of word) total += ch === ' ' ? space : glyphW + gap;
  const unit = 1440 / (ring + 40 + total); // o conjunto ocupa 1440 de 1600, como o logo do baú
  g.scale(unit, unit);
  const x0 = (WIDTH / unit - (ring + 40 + total)) / 2;
  const cy = HEIGHT / unit / 2;
  g.lineWidth = 24;
  g.beginPath();
  g.arc(x0 + ring / 2, cy, 64, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(x0 + ring / 2, cy, 24, 0, Math.PI * 2);
  g.fill();
  let x = x0 + ring + 40;
  const y = cy - glyphH / 2;
  g.lineWidth = stroke;
  g.lineJoin = 'miter';
  g.lineCap = 'square';
  for (const ch of word) {
    if (ch === ' ') {
      x += space;
      continue;
    }
    for (const line of GLYPHS[ch]) {
      g.beginPath();
      line.forEach(([u, v], i) => {
        const px = x + stroke / 2 + u * (glyphW - stroke);
        const py = y + stroke / 2 + v * (glyphH - stroke);
        if (i) g.lineTo(px, py);
        else g.moveTo(px, py);
      });
      g.stroke();
    }
    x += glyphW + gap;
  }
}

/** @returns {CanvasTexture | null} `null` quando o ambiente não tem OffscreenCanvas (a peça fica sem marca) */
export function suaMarcaTexture() {
  if (typeof OffscreenCanvas !== 'function') return null;
  try {
    const canvas = new OffscreenCanvas(WIDTH * SCALE, HEIGHT * SCALE);
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.scale(SCALE, SCALE);
    draw(g);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  } catch {
    return null;
  }
}
