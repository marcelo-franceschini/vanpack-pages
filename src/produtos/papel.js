// Textura do papel kraft dos produtos: fundo com ondulação da canelura sob o liner,
// granulado e fibras de papel táteis vanpack.
// Seguro para Web Worker: não acessa DOM.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { KRAFT } from '../scene/constants.js';

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
  let canvas = null;
  let g = null;
  if (typeof OffscreenCanvas === 'function') {
    try {
      canvas = new OffscreenCanvas(SIZE, SIZE);
      g = canvas.getContext('2d');
    } catch {
      // continua para fallback
    }
  }
  if (!g && typeof document !== 'undefined') {
    canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    g = canvas.getContext('2d');
  }
  if (!canvas || !g) return null;

  try {
    const next = random(color === KRAFT ? 1337 : 4219);
    g.fillStyle = color;
    g.fillRect(0, 0, SIZE, SIZE);

    // Ondulação sutil: sombra do miolo ondulado sob o liner
    const darkHex = color === KRAFT ? '#9a7447' : '#7c5c36';
    g.fillStyle = darkHex;
    g.globalAlpha = 0.055;
    for (let y = 0; y < SIZE; y += 16) {
      g.fillRect(0, y, SIZE, 3);
    }

    g.globalAlpha = 1;
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
    const texture = new CanvasTexture(/** @type {any} */ (canvas));
    texture.colorSpace = SRGBColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
  } catch {
    return null;
  }
}
