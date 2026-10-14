// Texturas procedurais desenhadas em canvas uma única vez (sem downloads de imagem).
import * as THREE from 'three';

import { drawHorizontalBrand, BRAND_COLORS } from '../brand/marks.js';

/** PRNG com semente (mulberry32): as mesmas texturas a cada carregamento. */
function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// OffscreenCanvas funciona tanto no worker quanto na thread principal.
const makeCanvas = (w, h) =>
  typeof OffscreenCanvas === 'function'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });

export function createTextures() {
  const rand = seededRandom(20240611);

  const tex = (w, h, draw, rep, srgb = true) => {
    const c = makeCanvas(w, h);
    draw(c.getContext('2d', { willReadFrequently: true }), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    if (rep) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rep[0], rep[1]);
    }
    return t;
  };

  // Pintas de 1–3 px misturadas direto nos pixels: ~50× mais rápido que milhares de fillRect.
  const speckle = (g, w, h, n, a, cols) => {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < n; i++) {
      const [r, gr, b] = cols[i % cols.length];
      const alpha = rand() * a;
      const x0 = Math.floor(rand() * w);
      const y0 = Math.floor(rand() * h);
      const x1 = Math.min(w, x0 + 1 + Math.floor(rand() * 3));
      const y1 = Math.min(h, y0 + 1 + Math.floor(rand() * 3));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const k = (y * w + x) * 4;
          d[k] += (r - d[k]) * alpha;
          d[k + 1] += (gr - d[k + 1]) * alpha;
          d[k + 2] += (b - d[k + 2]) * alpha;
        }
      }
    }
    g.putImageData(img, 0, 0);
  };
  const BLACK = [0, 0, 0];
  const WHITE = [255, 255, 255];
  const kraftFill = (g, w, h) => {
    g.fillStyle = '#b78c5c';
    g.fillRect(0, 0, w, h);
    speckle(g, w, h, (w * h) / 22, 0.07, [
      [75, 50, 25],
      [215, 180, 130],
    ]);
  };

  const kraft = tex(256, 256, kraftFill, [1, 1]);

  const stack = tex(512, 512, (g, w, h) => {
    const L = 30;
    const lh = h / L;
    for (let i = 0; i < L; i++) {
      const y0 = i * lh;
      g.fillStyle = i % 2 ? '#b18454' : '#b98c5a';
      g.fillRect(0, y0, w, lh);
      g.fillStyle = 'rgba(60,35,15,.35)';
      g.fillRect(0, y0, w, 1.4);
      g.strokeStyle = 'rgba(105,68,34,.6)';
      g.lineWidth = 1.3;
      g.beginPath();
      const ph = rand() * 6;
      for (let x = 0; x <= w; x += 2) {
        const y = y0 + lh / 2 + Math.sin((x / w) * Math.PI * 2 * 48 + ph) * (lh / 2 - 3);
        if (x) g.lineTo(x, y);
        else g.moveTo(x, y);
      }
      g.stroke();
    }
  });

  const INK = [512, 420];
  const inkA = tex(...INK, (g, w, h) => {
    g.fillStyle = '#1B1A17';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '800 58px Helvetica, Arial, sans-serif';
    g.fillText('SUA MARCA', w / 2, h / 2 - 20);
    g.font = '700 42px Helvetica, Arial, sans-serif';
    g.fillText('AQUI', w / 2, h / 2 + 36);
  });
  const inkB = tex(...INK, (g, w, h) => {
    g.strokeStyle = '#14513A';
    g.lineWidth = 10;
    g.setLineDash([26, 16]);
    g.beginPath();
    g.roundRect(34, 44, w - 68, h - 88, 16);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = '#14513A';
    g.beginPath();
    g.arc(w / 2, h / 2 - 92, 18, 0, Math.PI * 2);
    g.fill();
    g.fillRect(w / 2 - 50, h / 2 + 82, 100, 8);
  });
  const printed = tex(...INK, (g, w, h) => {
    kraftFill(g, w, h);
    g.drawImage(inkB.image, 0, 0);
    g.drawImage(inkA.image, 0, 0);
  });

  const die = tex(512, 256, (g, w, h) => {
    g.fillStyle = '#d6b07d';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 50; i++) {
      g.strokeStyle = `rgba(150,100,55,${(rand() * 0.22).toFixed(3)})`;
      g.lineWidth = 1 + rand() * 2;
      g.beginPath();
      const y = rand() * h;
      for (let x = 0; x <= w; x += 16) {
        const yy = y + Math.sin(x * 0.02 + i) * 3;
        if (x) g.lineTo(x, yy);
        else g.moveTo(x, yy);
      }
      g.stroke();
    }
    g.fillStyle = '#e0607a';
    for (const r of [
      [40, 30, 432, 10],
      [40, 216, 432, 10],
      [30, 40, 10, 176],
      [472, 40, 10, 176],
      [150, 40, 8, 176],
      [354, 40, 8, 176],
    ]) {
      g.fillRect(...r);
    }
    g.strokeStyle = '#2d2d2d';
    g.lineWidth = 3;
    g.strokeRect(46, 44, 420, 168);
    g.beginPath();
    g.moveTo(160, 44);
    g.lineTo(160, 212);
    g.moveTo(352, 44);
    g.lineTo(352, 212);
    g.stroke();
  });

  const hazard = tex(
    128,
    128,
    (g, w, h) => {
      g.fillStyle = '#e3b23c';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#1d1d1d';
      for (let k = -1; k < 5; k++) {
        const x = k * 64;
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x + 32, 0);
        g.lineTo(x + 32 - h, h);
        g.lineTo(x - h, h);
        g.closePath();
        g.fill();
      }
    },
    [1, 1],
  );

  // Atlas 4×1 de etiquetas: atenção, alta tensão, esmagamento e placa de identificação.
  const label = tex(512, 128, (g) => {
    const tri = (cx, symbol) => {
      g.fillStyle = '#e3b23c';
      g.strokeStyle = '#1d1d1d';
      g.lineWidth = 8;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(cx, 14);
      g.lineTo(cx + 54, 112);
      g.lineTo(cx - 54, 112);
      g.closePath();
      g.fill();
      g.stroke();
      g.fillStyle = '#1d1d1d';
      g.strokeStyle = '#1d1d1d';
      symbol(cx);
    };
    tri(64, (cx) => {
      g.font = '900 58px Arial, sans-serif';
      g.textAlign = 'center';
      g.fillText('!', cx, 102);
    });
    tri(192, (cx) => {
      g.beginPath();
      g.moveTo(cx + 8, 40);
      g.lineTo(cx - 14, 80);
      g.lineTo(cx + 2, 80);
      g.lineTo(cx - 8, 106);
      g.lineTo(cx + 18, 66);
      g.lineTo(cx + 2, 66);
      g.closePath();
      g.fill();
    });
    tri(320, (cx) => {
      g.lineWidth = 6;
      g.beginPath();
      g.arc(cx - 11, 84, 14, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.arc(cx + 15, 84, 10, 0, Math.PI * 2);
      g.stroke();
    });
    g.fillStyle = '#c9ced2';
    g.fillRect(392, 24, 112, 80);
    g.fillStyle = '#3a3f44';
    g.fillRect(402, 34, 60, 10);
    for (let i = 0; i < 4; i++) g.fillRect(402, 54 + i * 12, 92 - i * 14, 5);
  });

  const screen = tex(256, 160, (g, w, h) => {
    g.fillStyle = '#0f2a33';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#14513A';
    g.fillRect(0, 0, w, 22);
    g.fillStyle = '#9fd8c3';
    [44, 70, 58, 90, 76, 100].forEach((bh, i) => g.fillRect(18 + i * 26, 140 - bh, 16, bh));
    g.fillStyle = '#e3b23c';
    g.fillRect(186, 40, 52, 30);
    g.fillStyle = '#cfe9df';
    for (let i = 0; i < 4; i++) g.fillRect(186, 82 + i * 14, 52 - i * 8, 6);
  });

  const slat = tex(
    64,
    64,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#eceeef');
      gr.addColorStop(0.84, '#d3d7da');
      gr.addColorStop(0.86, '#8d9296');
      gr.addColorStop(1, '#bcc0c4');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    },
    [1, 12],
  );

  const belt = tex(
    128,
    64,
    (g, w, h) => {
      g.fillStyle = '#2c2d2f';
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, 700, 0.14, [WHITE, BLACK]);
      g.fillStyle = 'rgba(255,255,255,.12)';
      g.fillRect(0, 0, 6, h);
    },
    [1, 1],
  );

  const grime = tex(
    64,
    256,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, h, 0, 0);
      gr.addColorStop(0, '#9a958e');
      gr.addColorStop(0.22, '#e8e6e2');
      gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      speckle(g, w, h, 900, 0.08, [BLACK, WHITE]);
    },
    [1, 0.7],
  );

  const blob = tex(
    128,
    128,
    (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,.5)');
      gr.addColorStop(0.55, 'rgba(0,0,0,.25)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    },
    null,
    false,
  );

  const brand = tex(1024, 320, (g, w, h) => {
    // Marca oficial horizontal em Floresta sobre baú claro com área de respiro preservada
    drawHorizontalBrand(g, (w - 840) / 2, (h - 210) / 2, 840, BRAND_COLORS.floresta);
  });

  return {
    kraft,
    stack,
    inkA,
    inkB,
    printed,
    die,
    hazard,
    label,
    screen,
    slat,
    belt,
    grime,
    blob,
    brand,
  };
}
