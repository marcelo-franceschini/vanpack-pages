// A marca genérica "SUA MARCA" (a do cliente demo da cena principal: anel e palavra, numa tinta só,
// Floresta) como textura transparente 4:1, para o plano da marca nos modelos dos produtos. A palavra e a
// textura em canvas são as de src/scene/textures.js (drawWord e canvasTexture); ali a marca cobre a face
// inteira da caixa, aqui ela é uma etiqueta pequena sobre o Kraft liso. Seguro para Web Worker: não
// acessa DOM.
import { PALETTE } from '../scene/constants.js';
import { WORD_HEIGHT, WORD_WIDTH, canvasTexture, drawWord } from '../scene/textures.js';

const WIDTH = 1600; // o mesmo 4:1 e a mesma resolução da marca que estava aqui antes
const HEIGHT = 400;
const SCALE = 0.5; // metade da resolução de projeto: a marca ocupa poucos pixels na tela

/** Anel e palavra lado a lado, em coordenadas de projeto de 1600 × 400, centrados. */
function draw(g) {
  g.fillStyle = PALETTE.forest;
  g.strokeStyle = PALETTE.forest;
  const ring = 152; // diâmetro do anel, com o traço
  const unit = 1440 / (ring + 40 + WORD_WIDTH); // o conjunto ocupa 1440 de 1600, como o logo do baú
  g.scale(unit, unit);
  const x0 = (WIDTH / unit - (ring + 40 + WORD_WIDTH)) / 2;
  const cy = HEIGHT / unit / 2;
  g.lineWidth = 24;
  g.beginPath();
  g.arc(x0 + ring / 2, cy, 64, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(x0 + ring / 2, cy, 24, 0, Math.PI * 2);
  g.fill();
  drawWord(g, x0 + ring + 40, cy - WORD_HEIGHT / 2);
}

/** @returns {import('three').CanvasTexture | null} `null` quando o ambiente não tem OffscreenCanvas (a peça fica sem marca) */
export function suaMarcaTexture() {
  return canvasTexture(WIDTH, HEIGHT, SCALE, draw);
}
