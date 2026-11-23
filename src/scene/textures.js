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
import { KRAFT, KRAFT_INNER, PALETTE } from './constants.js';

const HAS_OFFSCREEN_CANVAS = typeof OffscreenCanvas === 'function';

// Tamanho das texturas em relação ao desenho de projeto: a impressão ocupa ~150 px na tela, então
// metade da resolução já é 2x maior que o necessário (e 4x menos GPU e tempo de partida).
const SCALE = { body: 0.5, print: 0.75, flap: 0.5, logo: 0.5 };

function createSurface(width, height) {
  if (HAS_OFFSCREEN_CANVAS) {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext('2d');
      if (ctx) return { canvas, ctx };
    } catch {
      // continua para fallback
    }
  }
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
  }
  return { canvas: null, ctx: null };
}

/**
 * @param {number} width largura de projeto (o desenho usa estas coordenadas)
 * @param {number} height altura de projeto
 * @param {number} scale fração do tamanho de projeto que a textura realmente tem
 * @param {(g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, w: number, h: number) => void} draw
 * @returns {CanvasTexture | null} `null` quando o ambiente não tem suporte a Canvas
 */
function canvasTexture(width, height, scale, draw) {
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  const { canvas, ctx: g } = createSurface(w, h);
  if (!canvas || !g) return null;
  try {
    g.scale(scale, scale);
    draw(g, width, height);
    const texture = new CanvasTexture(/** @type {any} */ (canvas));
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

/** Painel do papelão (face externa), com textura orgânica de Kraft e ondulação sutil. */
export const bodyTexture = (printed) =>
  canvasTexture(768, 592, printed ? SCALE.print : SCALE.body, (g, w, h) => {
    // Tom base Kraft
    g.fillStyle = KRAFT;
    g.fillRect(0, 0, w, h);

    // Ondulação sutil da canelura do papelão sob o liner
    const darkHex = PALETTE.kraftDark || '#9a7447';
    g.fillStyle = darkHex;
    g.globalAlpha = 0.055;
    for (let y = 0; y < h; y += 16) {
      g.fillRect(0, y, w, 3);
    }

    // Fibras e granulações orgânicas táteis
    let seed = 1337;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 420; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 4 + rand() * 14;
      g.globalAlpha = 0.04 + rand() * 0.06;
      g.fillStyle = rand() > 0.45 ? darkHex : '#e5c99f';
      g.fillRect(x, y, len, 1.2);
    }
    g.globalAlpha = 1;

    // Vincos de sombra de borda
    g.fillStyle = 'rgba(70,44,18,0.25)';
    g.fillRect(0, 0, w, 5);
    g.fillRect(0, h - 5, w, 5);
    g.fillStyle = 'rgba(70,44,18,0.12)';
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);

    if (printed) drawPrint(g, w, h);
  });

/** Face interna do papelão (liner interno), com tom Kraft e textura de fibras e ranhuras táteis. */
export const innerBodyTexture = () =>
  canvasTexture(768, 592, SCALE.body, (g, w, h) => {
    // Tom base Kraft interno
    g.fillStyle = KRAFT_INNER;
    g.fillRect(0, 0, w, h);

    // Ondulação sutil da canelura interna sob o liner
    const darkHex = '#b78c5c';
    g.fillStyle = darkHex;
    g.globalAlpha = 0.05;
    for (let y = 0; y < h; y += 16) {
      g.fillRect(0, y, w, 3);
    }

    // Fibras orgânicas e textura tátil de celulose
    let seed = 4096;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 350; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 4 + rand() * 14;
      g.globalAlpha = 0.04 + rand() * 0.06;
      g.fillStyle = rand() > 0.45 ? darkHex : '#f2dfc4';
      g.fillRect(x, y, len, 1.2);
    }
    g.globalAlpha = 1;

    // Leve vinco de sombra de borda
    g.fillStyle = 'rgba(70,44,18,0.18)';
    g.fillRect(0, 0, w, 4);
    g.fillRect(0, h - 4, w, 4);
    g.fillStyle = 'rgba(70,44,18,0.08)';
    g.fillRect(0, 0, 2, h);
    g.fillRect(w - 2, 0, 2, h);
  });

export const flapTexture = () =>
  canvasTexture(512, 256, SCALE.flap, (g, w, h) => {
    g.fillStyle = KRAFT;
    g.fillRect(0, 0, w, h);

    // Ondulação sutil sob o liner
    const darkHex = PALETTE.kraftDark || '#9a7447';
    g.fillStyle = darkHex;
    g.globalAlpha = 0.055;
    for (let y = 0; y < h; y += 16) {
      g.fillRect(0, y, w, 3);
    }

    let seed = 2048;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 240; i++) {
      const x = rand() * w;
      const y = rand() * h;
      const len = 4 + rand() * 14;
      g.globalAlpha = 0.04 + rand() * 0.06;
      g.fillStyle = rand() > 0.45 ? darkHex : '#e5c99f';
      g.fillRect(x, y, len, 1.2);
    }
    g.globalAlpha = 1;

    g.fillStyle = 'rgba(70,44,18,0.25)';
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

/** Borda de uma pilha/folha de papelão: duas capas e a onda senoidal nítida do miolo (2 ondas por tile). */
export const edgeTexture = () => {
  const w = 128;
  const h = 64;
  const { canvas, ctx } = createSurface(w, h);
  if (!canvas || !ctx) {
    return dataTexture(
      16,
      16,
      (x, y) => {
        if (y < 2) return [143, 107, 67, 255];
        const wave = 8.5 + 3 * Math.sin((x / 8) * Math.PI * 2);
        return Math.abs(y - wave) < 1.1 ? [176, 127, 78, 255] : [203, 164, 114, 255];
      },
      { repeat: true },
    );
  }

  // Oco sombreado da onda
  ctx.fillStyle = '#7c5c36';
  ctx.fillRect(0, 0, w, h);

  // Sombreamento senoidal nos vãos dos arcos (2 ondas completas no ladrilho)
  for (let x = 0; x < w; x++) {
    const s = Math.sin((x / w) * Math.PI * 4) * 0.5 + 0.5;
    ctx.fillStyle = s > 0.5 ? 'rgba(207, 169, 120, 0.28)' : 'rgba(92, 66, 36, 0.28)';
    ctx.fillRect(x, 8, 1, h - 16);
  }

  // Onda senoidal de papelão ondulado do miolo
  ctx.beginPath();
  const amp = (h - 22) * 0.46;
  const mid = h * 0.5;
  for (let x = 0; x <= w; x++) {
    const y = mid + Math.sin((x / w) * Math.PI * 4) * amp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = KRAFT_INNER;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Camadas superior e inferior de liner kraft
  ctx.fillStyle = KRAFT;
  ctx.fillRect(0, 0, w, 9);
  ctx.fillRect(0, h - 9, w, 9);
  ctx.fillStyle = PALETTE.kraftDark || '#9a7447';
  ctx.fillRect(0, 8, w, 2);
  ctx.fillRect(0, h - 10, w, 2);

  const tex = new CanvasTexture(/** @type {any} */ (canvas));
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

