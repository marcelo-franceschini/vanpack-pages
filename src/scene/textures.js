// Texturas procedurais da cena. Sem imagens: tudo é desenhado em OffscreenCanvas (impressão, abas,
// logo do baú; sem ele, as peças ficam sem impressão) ou gerado como DataTexture.
import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
} from 'three';
import { drawHorizontalBrand } from '../brand/marks.js';
import { KRAFT, PALETTE } from './constants.js';

const HAS_OFFSCREEN_CANVAS = typeof OffscreenCanvas === 'function';

// Tamanho das texturas em relação ao desenho de projeto: a impressão ocupa ~150 px na tela, então
// metade da resolução já é 2x maior que o necessário (e 4x menos GPU e tempo de partida).
const SCALE = { body: 0.5, print: 0.75, flap: 0.5, logo: 0.5 };

/**
 * @param {number} width largura de projeto (o desenho usa estas coordenadas)
 * @param {number} height altura de projeto
 * @param {number} scale fração do tamanho de projeto que a textura realmente tem
 * @param {(g: OffscreenCanvasRenderingContext2D, w: number, h: number) => void} draw
 * @returns {CanvasTexture | null} `null` quando o ambiente não tem OffscreenCanvas
 */
function canvasTexture(width, height, scale, draw) {
  if (!HAS_OFFSCREEN_CANVAS) return null;
  try {
    const canvas = new OffscreenCanvas(Math.round(width * scale), Math.round(height * scale));
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.scale(scale, scale);
    draw(g, width, height);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  } catch {
    return null;
  }
}

/** @param {(x: number, y: number) => readonly [number, number, number, number]} pixel */
function dataTexture(width, height, pixel, { repeat = false } = {}) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data.set(pixel(x, y), (y * width + x) * 4);
    }
  }
  const texture = new DataTexture(data, width, height, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

// Letras geométricas simples para a marca genérica do cliente ("SUA MARCA").
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

/** Marca do cliente demo: glifo (anel + ponto) e a palavra, numa tinta só (Floresta). */
function drawPrint(g, w, h) {
  g.fillStyle = PALETTE.forest;
  g.strokeStyle = PALETTE.forest;
  const cx = w / 2;
  const cy = h * 0.4;
  g.lineWidth = 24;
  g.beginPath();
  g.arc(cx, cy, 64, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(cx, cy, 24, 0, Math.PI * 2);
  g.fill();

  const glyphH = 64;
  const glyphW = 50;
  const stroke = 14;
  const gap = 22;
  const space = 50;
  const word = 'SUA MARCA';
  let total = -gap;
  for (const ch of word) total += ch === ' ' ? space : glyphW + gap;
  let x = (w - total) / 2;
  const y = h * 0.62;
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

/** Painel do papelão (face externa), com ou sem a impressão do cliente. */
export const bodyTexture = (printed) =>
  canvasTexture(768, 592, printed ? SCALE.print : SCALE.body, (g, w, h) => {
    g.fillStyle = KRAFT;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,44,18,0.30)';
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, h - 5, w, 5);
    g.fillStyle = 'rgba(70,44,18,0.12)';
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);
    if (printed) drawPrint(g, w, h);
  });

export const flapTexture = () =>
  canvasTexture(512, 256, SCALE.flap, (g, w, h) => {
    g.fillStyle = KRAFT;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(70,44,18,0.30)';
    g.fillRect(0, h - 5, w, 5);
    g.fillStyle = 'rgba(70,44,18,0.12)';
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);
  });

/** Logo horizontal da Vanpack na lateral do baú, desenhado com Path2D (curvas oficiais). */
export const truckLogoTexture = () =>
  canvasTexture(1600, 400, SCALE.logo, (g) => {
    g.clearRect(0, 0, 1600, 400);
    drawHorizontalBrand(g, 80, 20, 1440, PALETTE.forest);
  });

/** Borda de uma pilha de papelão: duas capas e a onda do miolo (só aparece nas bordas). */
export const edgeTexture = () =>
  dataTexture(
    16,
    16,
    (x, y) => {
      if (y < 2) return [143, 107, 67, 255];
      const wave = 8.5 + 3 * Math.sin((x / 8) * Math.PI * 2);
      return Math.abs(y - wave) < 1.1 ? [176, 127, 78, 255] : [203, 164, 114, 255];
    },
    { repeat: true },
  );
