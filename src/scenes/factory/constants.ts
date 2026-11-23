/**
 * Canonical Vanpack architectural miniature diorama constants matching `public/og.jpg`,
 * `docs/notas-de-integracao-v4.md`, and `tools/assets/products-svg.mjs`.
 */

export const PAPER_BG = 0xf2ede3;

/** Canonical isometric 3/4 viewing vector shared across factory and product vitrines. */
export const CAMERA_DIRECTION: readonly [number, number, number] = [-0.6, 0.58, 0.85];

export const COLORS = {
  paper: 0xf2ede3,
  cream: 0xfaf5ea,
  creamSide: 0xe7e1d4,
  charcoal: 0x262522,
  charcoalSoft: 0x3e3c38,
  forest: 0x14513a,
  forestDark: 0x0d3c2a,
  steel: 0xbcb8af,
  steelDark: 0x5c5952,
  wood: 0xc9aa7f,
  woodDark: 0xa6855a,
  road: 0x4b4944,
  amber: 0xe8a825,
  emerald: 0x28b85c,
  glass: 0x35494e,
  glue: 0xfaf7ef,
} as const;

export const LAYOUT = {
  beltY: 0.72,
  feederX: -6.7,
  machineAX: -2.5,
  machineBX: 3.1,
  stageX: 7.4,
  palletX: 11.2,
  truckStartX: 15.8,
} as const;

/** Hero carton proportions matching `docs/produtos-3d.md` (scaled cleanly to the diorama). */
export const BOX = {
  length: 1.32,
  width: 0.9,
  height: 1.02,
  wall: 0.032,
} as const;

/** Normalized scroll stops corresponding to chapters 01..05 (0, 0.25, 0.5, 0.75, 1.0). */
export const CHAPTER_STOPS = [0.0, 0.25, 0.5, 0.75, 1.0] as const;
