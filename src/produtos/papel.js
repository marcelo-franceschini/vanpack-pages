// Textura do papel kraft dos produtos: fundo liso com granulado e fibras curtas, bem sutis, para a
// face não parecer uma peça de madeira ou plástico de cor chapada. Sem as faixas escuras de borda da
// textura do corpo da cena (aqui cada placa é uma folha dobrada, não um painel com vinco nas pontas).
// Seguro para Web Worker: não acessa DOM.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

const SIZE = 256;
const SPECKS = 2600;
const FIBERS = 150;

/** Pseudo-aleatório fixo (LCG): a textura é a mesma em toda execução. */
function random(seed) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/**
 * @param {string} color cor base do papel
 * @returns {CanvasTexture | null} `null` quando o ambiente não tem OffscreenCanvas (a face fica lisa)
 */
export function papelTexture(color) {
  if (typeof OffscreenCanvas !== 'function') return null;
  try {
    const canvas = new OffscreenCanvas(SIZE, SIZE);
    const g = canvas.getContext('2d');
    if (!g) return null;
    const next = random(1337);
    g.fillStyle = color;
    g.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < SPECKS; i++) {
      g.fillStyle = next() < 0.6 ? 'rgba(70,44,18,0.07)' : 'rgba(255,240,215,0.07)';
      g.fillRect(next() * SIZE, next() * SIZE, 1 + next() * 1.5, 1 + next() * 1.5);
    }
    g.lineWidth = 1;
    for (let i = 0; i < FIBERS; i++) {
      const x = next() * SIZE;
      const y = next() * SIZE;
      g.strokeStyle = next() < 0.5 ? 'rgba(70,44,18,0.08)' : 'rgba(255,240,215,0.1)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 4 + next() * 10, y + (next() - 0.5) * 3);
      g.stroke();
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  } catch {
    return null;
  }
}
