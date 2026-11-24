import {
  CanvasTexture,
  ClampToEdgeWrapping,
  DoubleSide,
  ExtrudeGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshLambertMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry,
  type Shape,
  type Texture,
} from 'three';
import { createSurface } from './environment';

/** Canonical Vanpack cardboard brand colors (matching brand manual & products-svg.mjs). */
export const KRAFT = '#b78c5c';
export const KRAFT_INNER = '#cfa978';
export const KRAFT_DARK = '#9a7447';
export const FLORESTA = '#14513a';

/**
 * Subtle organic Kraft paper fiber & gentle flute-rib surface texture (`256×256`),
 * preserving exact brand hex tones (`#b78c5c` outer / `#cfa978` lighter inner)
 * while giving every cardboard sheet genuine tactile paper warmth.
 */
function createKraftSurfaceTexture(
  baseHex: string,
  darkHex: string,
  maxAnisotropy: number,
): Texture {
  const size = 256;
  const { canvas, ctx } = createSurface(size, size);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle parallel corrugation shadow hints beneath liner
  ctx.fillStyle = darkHex;
  ctx.globalAlpha = 0.055;
  for (let y = 0; y < size; y += 16) {
    ctx.fillRect(0, y, size, 3);
  }

  // Deterministic organic kraft fibers & warm flecks
  let seed = baseHex === KRAFT ? 1337 : 4219;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let i = 0; i < 420; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const len = 4 + rand() * 14;
    ctx.globalAlpha = 0.04 + rand() * 0.06;
    ctx.fillStyle = rand() > 0.45 ? darkHex : '#e5c99f';
    ctx.fillRect(x, y, len, 1.2);
  }

  ctx.globalAlpha = 1;

  const tex = new CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Crisp corrugated flute edge texture (`128×64`) using the exact Vanpack Kraft palette
 * (`#b78c5c` liners, `#9a7447` wave shadow, `#cfa978` wave crest) so flute ribs read cleanly
 * in both the factory diorama and the interactive product vitrines.
 */
export function createCorrugatedEdgeTexture(repeatX = 5, repeatY = 1, maxAnisotropy = 4): Texture {
  const w = 128;
  const h = 64;
  const { canvas, ctx } = createSurface(w, h);

  // Shaded flute hollow
  ctx.fillStyle = '#7c5c36';
  ctx.fillRect(0, 0, w, h);

  // Sinusoidal hollow shading inside each arch
  for (let x = 0; x < w; x++) {
    const s = Math.sin((x / w) * Math.PI * 8) * 0.5 + 0.5;
    ctx.fillStyle = s > 0.5 ? 'rgba(207, 169, 120, 0.28)' : 'rgba(92, 66, 36, 0.28)';
    ctx.fillRect(x, 8, 1, h - 16);
  }

  // Crisp sinusoidal corrugated medium wave
  ctx.beginPath();
  const amp = (h - 22) * 0.46;
  const mid = h * 0.5;
  for (let x = 0; x <= w; x++) {
    const y = mid + Math.sin((x / w) * Math.PI * 8) * amp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = KRAFT_INNER;
  ctx.lineWidth = 5.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Top and bottom kraft liner layers
  ctx.fillStyle = KRAFT;
  ctx.fillRect(0, 0, w, 9);
  ctx.fillRect(0, h - 9, w, 9);
  ctx.fillStyle = KRAFT_DARK;
  ctx.fillRect(0, 8, w, 2);
  ctx.fillRect(0, h - 10, w, 2);

  const tex = new CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Clean minimal "SUA MARCA" flexographic print in Vanpack Forest green (`#14513a`)
 * directly on tactile Kraft (`#b78c5c`), matching the original austere industrial aesthetic.
 */
function createBrandPrintTexture(maxAnisotropy: number, wide = false): Texture {
  const w = 512;
  const h = wide ? 192 : 340;
  const { canvas, ctx } = createSurface(w, h);

  // Tactile Kraft base matching outer cardboard
  ctx.fillStyle = KRAFT;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(154, 116, 71, 0.08)';
  for (let y = 6; y < h; y += 12) {
    ctx.fillRect(0, y, w, 1.5);
  }

  let seed = wide ? 881 : 314;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 240; i++) {
    ctx.fillStyle = rand() > 0.5 ? 'rgba(154, 116, 71, 0.09)' : 'rgba(229, 201, 159, 0.08)';
    ctx.fillRect(rand() * w, rand() * h, 5 + rand() * 14, 1.2);
  }

  // Crisp Forest-green flexo frame & "SUA MARCA" mark
  ctx.strokeStyle = FLORESTA;
  ctx.fillStyle = FLORESTA;
  ctx.globalAlpha = 0.92;

  if (wide) {
    ctx.lineWidth = 4;
    ctx.strokeRect(32, 24, w - 64, h - 48);
    ctx.font = '900 48px Archivo, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUA MARCA', w / 2, h / 2 + 2);
  } else {
    ctx.lineWidth = 5;
    ctx.strokeRect(36, 36, w - 72, h - 72);

    // Minimalist open-box emblem
    ctx.save();
    ctx.translate(w / 2, h * 0.34);
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(34, -16);
    ctx.lineTo(34, 22);
    ctx.lineTo(0, 40);
    ctx.lineTo(-34, 22);
    ctx.lineTo(-34, -16);
    ctx.closePath();
    ctx.moveTo(-34, -16);
    ctx.lineTo(0, 2);
    ctx.lineTo(34, -16);
    ctx.moveTo(0, 2);
    ctx.lineTo(0, 40);
    ctx.stroke();
    ctx.restore();

    ctx.font = '900 54px Archivo, system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SUA MARCA', w / 2, h * 0.68);
  }

  ctx.globalAlpha = 1;

  const tex = new CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = ClampToEdgeWrapping;
  tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/**
 * Extrudes a 2D cardboard contour (`Shape`) into a centered thick plate (`z ∈ [-thickness/2, +thickness/2]`)
 * with properly scaled corrugated-flute UVs on all cut side walls (group 1) and clean Kraft UVs on
 * both flat faces (group 0). Used for die-cut notches, chamfered ears, and slotted dividers.
 */
export function createCardboardPlateGeometry(
  shape: Shape,
  thickness: number,
  fluteScale = 2.4,
): BufferGeometry {
  const geo = new ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 14,
  });
  geo.translate(0, 0, -thickness * 0.5);

  const pos = geo.attributes.position;
  const norm = geo.attributes.normal;
  const uv = geo.attributes.uv;

  for (let i = 0; i < pos.count; i++) {
    const nz = Math.abs(norm.getZ(i));
    if (nz < 0.5) {
      // Side wall (cut edge): map perimeter distance along U and plate thickness along V (0..1)
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const nx = Math.abs(norm.getX(i));
      const ny = Math.abs(norm.getY(i));
      const along = nx > ny ? y : x;
      const v = (z + thickness * 0.5) / Math.max(0.0001, thickness);
      uv.setXY(i, along * fluteScale, v);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export interface CardboardPalette {
  outer: MeshLambertMaterial;
  outerDouble: MeshLambertMaterial;
  inner: MeshLambertMaterial;
  edge: MeshLambertMaterial;
  edgeDense: MeshLambertMaterial;
  edgePlate: MeshLambertMaterial;
  printed: MeshLambertMaterial;
  printedWide: MeshLambertMaterial;
  crease: MeshLambertMaterial;
  textures: Texture[];
  dispose: () => void;
}

/**
 * Shared tactile matte cardboard material set using the exact Vanpack Kraft tones
 * (`#b78c5c` outer with subtle paper grain, `#cfa978` lighter inner, crisp corrugated flute edges,
 * and Forest `"SUA MARCA"` flexographic print).
 */
export function createCardboardPalette(maxAnisotropy = 4): CardboardPalette {
  const outerTex = createKraftSurfaceTexture(KRAFT, KRAFT_DARK, maxAnisotropy);
  const innerTex = createKraftSurfaceTexture(KRAFT_INNER, KRAFT, maxAnisotropy);
  const edgeTex = createCorrugatedEdgeTexture(5, 1, maxAnisotropy);
  const edgeDenseTex = createCorrugatedEdgeTexture(7, 1, maxAnisotropy);
  const edgePlateTex = createCorrugatedEdgeTexture(1, 1, maxAnisotropy);
  const printTex = createBrandPrintTexture(maxAnisotropy, false);
  const printWideTex = createBrandPrintTexture(maxAnisotropy, true);

  const outer = new MeshLambertMaterial({ map: outerTex });
  const outerDouble = new MeshLambertMaterial({ map: outerTex, side: DoubleSide });
  const inner = new MeshLambertMaterial({ map: innerTex });
  const edge = new MeshLambertMaterial({ map: edgeTex });
  const edgeDense = new MeshLambertMaterial({ map: edgeDenseTex });
  const edgePlate = new MeshLambertMaterial({ map: edgePlateTex });
  const printed = new MeshLambertMaterial({ map: printTex });
  const printedWide = new MeshLambertMaterial({ map: printWideTex });
  const crease = new MeshLambertMaterial({ color: KRAFT_DARK });

  const textures = [
    outerTex,
    innerTex,
    edgeTex,
    edgeDenseTex,
    edgePlateTex,
    printTex,
    printWideTex,
  ];
  const materials = [
    outer,
    outerDouble,
    inner,
    edge,
    edgeDense,
    edgePlate,
    printed,
    printedWide,
    crease,
  ];

  return {
    outer,
    outerDouble,
    inner,
    edge,
    edgeDense,
    edgePlate,
    printed,
    printedWide,
    crease,
    textures,
    dispose() {
      for (const m of materials) m.dispose();
      for (const t of textures) t.dispose();
    },
  };
}
