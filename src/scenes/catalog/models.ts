import { BoxGeometry, Group, Mesh } from 'three';
import type { CardboardPalette } from '../../engine/materials';

export type ProductModelId = 'caixa-normal' | 'corte-e-vinco' | 'divisorias' | 'chapas';

/**
 * 1. Caixa Normal (RSC 0201) — exact proportions from `docs/produtos-3d.md` (`0.44 × 0.30 × 0.34`):
 * Closed carton with bottom panel, 4 top flaps lying flat (short flaps underneath, long flaps on top
 * meeting with a crisp 6 mm center gap), and clean Forest "SUA MARCA" print on both long faces.
 */
function buildCaixaNormal(cb: CardboardPalette): Group {
  const group = new Group();
  const L = 0.44;
  const W = 0.3;
  const H = 0.34;
  const T = 0.012;
  const GAP = 0.006;

  const flatMats = [cb.edge, cb.edge, cb.outer, cb.inner, cb.edge, cb.edge];

  // Closed bottom panel
  const bottom = new Mesh(new BoxGeometry(L, T, W), [
    cb.edge,
    cb.edge,
    cb.inner,
    cb.outer,
    cb.edge,
    cb.edge,
  ]);
  bottom.position.y = T * 0.5;
  group.add(bottom);

  // Main walls: front & back carry Forest "SUA MARCA" print
  const longGeo = new BoxGeometry(L, H, T);
  const front = new Mesh(longGeo, [cb.edge, cb.edge, cb.edge, cb.edge, cb.printed, cb.inner]);
  front.position.set(0, H * 0.5, W * 0.5 - T * 0.5);
  group.add(front);

  const back = new Mesh(longGeo, [cb.edge, cb.edge, cb.edge, cb.edge, cb.inner, cb.printed]);
  back.position.set(0, H * 0.5, -W * 0.5 + T * 0.5);
  group.add(back);

  const sideGeo = new BoxGeometry(T, H, W - T * 2);
  const left = new Mesh(sideGeo, [cb.inner, cb.outer, cb.edge, cb.edge, cb.edge, cb.edge]);
  left.position.set(-L * 0.5 + T * 0.5, H * 0.5, 0);
  group.add(left);

  const right = new Mesh(sideGeo, [cb.outer, cb.inner, cb.edge, cb.edge, cb.edge, cb.edge]);
  right.position.set(L * 0.5 - T * 0.5, H * 0.5, 0);
  group.add(right);

  // Inner short dust flaps lying flat beneath major flaps
  const dustLen = W * 0.44;
  const dustGeo = new BoxGeometry(dustLen, T * 0.7, W - T * 2.1);
  const dustL = new Mesh(dustGeo, flatMats);
  dustL.position.set(-L * 0.5 + dustLen * 0.5 + T * 0.4, H - T * 0.35, 0);
  group.add(dustL);

  const dustR = new Mesh(dustGeo, flatMats);
  dustR.position.set(L * 0.5 - dustLen * 0.5 - T * 0.4, H - T * 0.35, 0);
  group.add(dustR);

  // Top major flaps lying flat with crisp 6 mm center gap (`docs/produtos-3d.md`)
  const flapDepth = (W - GAP) * 0.5;
  const flapGeo = new BoxGeometry(L, T, flapDepth);

  const flapFront = new Mesh(flapGeo, flatMats);
  flapFront.position.set(0, H + T * 0.5, GAP * 0.5 + flapDepth * 0.5);
  group.add(flapFront);

  const flapBack = new Mesh(flapGeo, flatMats);
  flapBack.position.set(0, H + T * 0.5, -(GAP * 0.5 + flapDepth * 0.5));
  group.add(flapBack);

  return group;
}

/**
 * 2. Corte e Vinco — exact e-commerce mailer from `docs/produtos-3d.md` & `products-svg.mjs`
 * (`0.42 × 0.30 × 0.10`, lid open at 100°):
 * Double-thickness front & side walls, front finger half-moon notch, two base lock slots,
 * chamfered lid side ears, front tuck flap with two locking tabs, and "SUA MARCA" print.
 */
function buildCorteEVinco(cb: CardboardPalette): Group {
  const group = new Group();
  const L = 0.42;
  const W = 0.3;
  const H = 0.1;
  const T = 0.012;
  const open = (100 * Math.PI) / 180;

  const flatMats = [cb.edge, cb.edge, cb.outer, cb.inner, cb.edge, cb.edge];

  // Base floor (inner face lighter `#cfa978` so open interior reads crisply!)
  const base = new Mesh(new BoxGeometry(L, T, W), [
    cb.edge,
    cb.edge,
    cb.inner,
    cb.outer,
    cb.edge,
    cb.edge,
  ]);
  base.position.y = T * 0.5;
  group.add(base);

  // Two recessed locking slots along the front floor edge (`dois rasgos de trava no fundo`)
  const slotGeo = new BoxGeometry(0.055, 0.004, 0.014);
  for (const sx of [-L * 0.24, L * 0.24]) {
    const slot = new Mesh(slotGeo, cb.edge);
    slot.position.set(sx, T + 0.001, W * 0.5 - T * 2.5);
    group.add(slot);
  }

  // Back hinge wall
  const backWall = new Mesh(new BoxGeometry(L, H, T), [
    cb.edge,
    cb.edge,
    cb.edge,
    cb.edge,
    cb.inner,
    cb.outer,
  ]);
  backWall.position.set(0, H * 0.5, -W * 0.5 + T * 0.5);
  group.add(backWall);

  // Double-thickness side walls (`paredes duplas` showing 2-ply top edge)
  const sideOuterGeo = new BoxGeometry(T, H, W - T * 2);
  const sideInnerGeo = new BoxGeometry(T, H - 0.004, W - T * 3);
  for (const dir of [-1, 1]) {
    const outer = new Mesh(sideOuterGeo, [
      dir > 0 ? cb.outer : cb.inner,
      dir > 0 ? cb.inner : cb.outer,
      cb.edge,
      cb.edge,
      cb.edge,
      cb.edge,
    ]);
    outer.position.set(dir * (L * 0.5 - T * 0.5), H * 0.5, 0);
    group.add(outer);

    const inner = new Mesh(sideInnerGeo, [
      dir > 0 ? cb.inner : cb.outer,
      dir > 0 ? cb.outer : cb.inner,
      cb.edge,
      cb.edge,
      cb.edge,
      cb.edge,
    ]);
    inner.position.set(dir * (L * 0.5 - T * 1.55), H * 0.5 - 0.002, 0);
    group.add(inner);
  }

  // Double-thickness front wall split around a clean central thumb notch (`meia-lua de dedo`)
  const notchW = 0.052;
  const frontSegW = (L - notchW) * 0.5;
  const frontSegGeo = new BoxGeometry(frontSegW, H, T * 1.9);
  for (const dir of [-1, 1]) {
    const seg = new Mesh(frontSegGeo, [cb.edge, cb.edge, cb.edge, cb.edge, cb.outer, cb.inner]);
    seg.position.set(dir * (notchW * 0.5 + frontSegW * 0.5), H * 0.5, W * 0.5 - T);
    group.add(seg);
  }
  const frontNotchLower = new Mesh(new BoxGeometry(notchW, H * 0.64, T * 1.9), [
    cb.edge,
    cb.edge,
    cb.edge,
    cb.edge,
    cb.outer,
    cb.inner,
  ]);
  frontNotchLower.position.set(0, H * 0.32, W * 0.5 - T);
  group.add(frontNotchLower);

  // Subtle printed badge strip across lower front face
  const frontPrint = new Mesh(new BoxGeometry(L - 0.03, H * 0.6, 0.002), cb.printedWide);
  frontPrint.position.set(0, H * 0.34, W * 0.5 + 0.001);
  group.add(frontPrint);

  // Hinged Lid open at 100° (`tampa a 100°`)
  const lidPivot = new Group();
  lidPivot.position.set(0, H, -W * 0.5 + T * 0.5);
  lidPivot.rotation.x = -open;

  const lidTop = new Mesh(new BoxGeometry(L, T, W), [
    cb.edge,
    cb.edge,
    cb.printed,
    cb.inner,
    cb.edge,
    cb.edge,
  ]);
  lidTop.position.set(0, T * 0.5, W * 0.5);
  lidPivot.add(lidTop);

  // Side dust ears attached to lid (`orelhas laterais da tampa`)
  const earGeo = new BoxGeometry(T, H - T * 1.6, W - T * 4);
  for (const dir of [-1, 1]) {
    const ear = new Mesh(earGeo, [cb.outer, cb.inner, cb.edge, cb.edge, cb.edge, cb.edge]);
    ear.position.set(dir * (L * 0.5 - T * 2.2), -(H - T * 1.6) * 0.5, W * 0.52);
    lidPivot.add(ear);
  }

  // Front closing flap + two locking tabs (`aba frontal com duas linguetas`)
  const tuckH = H - T * 2;
  const frontFlap = new Mesh(new BoxGeometry(L - T * 6, tuckH, T), flatMats);
  frontFlap.position.set(0, -tuckH * 0.5, W - T * 1.4);
  lidPivot.add(frontFlap);

  const tabGeo = new BoxGeometry(0.052, 0.022, T);
  for (const sx of [-L * 0.24, L * 0.24]) {
    const tab = new Mesh(tabGeo, flatMats);
    tab.position.set(sx, -tuckH - 0.011, W - T * 1.4);
    lidPivot.add(tab);
  }

  group.add(lidPivot);
  return group;
}

/**
 * 3. Divisórias, Tabuleiros e Separadores — exact 3 × 3 interlocking grid inside shallow tray
 * (`docs/produtos-3d.md` & `products-svg.mjs`: `S=0.40, HT=0.06, T=0.01, HD=0.15`),
 * with ONE divider lifted halfway (`lift = 0.55 * HD`) so the half-height slots are clearly visible!
 */
function buildDivisorias(cb: CardboardPalette): Group {
  const group = new Group();
  const S = 0.4;
  const HT = 0.06;
  const T = 0.01;
  const HD = 0.15;
  const LD = S - 2 * T - 0.006;
  const C = LD / 3;
  const lift = 0.55 * HD;

  // Shallow square tray (`tabuleiro baixo` with "SUA MARCA" on front face)
  const floor = new Mesh(new BoxGeometry(S, T, S), [
    cb.edge,
    cb.edge,
    cb.inner,
    cb.outer,
    cb.edge,
    cb.edge,
  ]);
  floor.position.y = T * 0.5;
  group.add(floor);

  const trayFront = new Mesh(new BoxGeometry(S, HT, T), [
    cb.edge,
    cb.edge,
    cb.edge,
    cb.edge,
    cb.printedWide,
    cb.inner,
  ]);
  trayFront.position.set(0, HT * 0.5, S * 0.5 - T * 0.5);
  group.add(trayFront);

  const trayBack = new Mesh(new BoxGeometry(S, HT, T), [
    cb.edge,
    cb.edge,
    cb.edge,
    cb.edge,
    cb.inner,
    cb.outer,
  ]);
  trayBack.position.set(0, HT * 0.5, -S * 0.5 + T * 0.5);
  group.add(trayBack);

  const traySideGeo = new BoxGeometry(T, HT, S - T * 2);
  for (const dir of [-1, 1]) {
    const wall = new Mesh(traySideGeo, [
      dir > 0 ? cb.outer : cb.inner,
      dir > 0 ? cb.inner : cb.outer,
      cb.edge,
      cb.edge,
      cb.edge,
      cb.edge,
    ]);
    wall.position.set(dir * (S * 0.5 - T * 0.5), HT * 0.5, 0);
    group.add(wall);
  }

  // Helper to build a slotted divider (half-height notches at -C/2 and +C/2 so interlocking is real!)
  const makeSlottedDivider = (alongX: boolean, slotsOnBottom: boolean): Group => {
    const dg = new Group();
    const halfH = HD * 0.5;
    const slotW = T * 1.25;
    const solidMats = alongX
      ? [cb.edge, cb.edge, cb.edge, cb.edge, cb.outer, cb.inner]
      : [cb.outer, cb.inner, cb.edge, cb.edge, cb.edge, cb.edge];

    // Continuous half-height spine (top half if slotsOnBottom, bottom half if slotsOnTop)
    const spineY = slotsOnBottom ? halfH + halfH * 0.5 : halfH * 0.5;
    const spineGeo = alongX ? new BoxGeometry(LD, halfH, T) : new BoxGeometry(T, halfH, LD);
    const spine = new Mesh(spineGeo, solidMats);
    spine.position.y = spineY;
    dg.add(spine);

    // Three notched teeth separated by the two half-height slots at -C/2 and +C/2
    const teethY = slotsOnBottom ? halfH * 0.5 : halfH + halfH * 0.5;
    const segments: readonly [number, number][] = [
      [-LD * 0.5, -C * 0.5 - slotW * 0.5],
      [-C * 0.5 + slotW * 0.5, C * 0.5 - slotW * 0.5],
      [C * 0.5 + slotW * 0.5, LD * 0.5],
    ];
    for (const [a, b] of segments) {
      const len = b - a;
      const mid = (a + b) * 0.5;
      const toothGeo = alongX ? new BoxGeometry(len, halfH, T) : new BoxGeometry(T, halfH, len);
      const tooth = new Mesh(toothGeo, solidMats);
      if (alongX) tooth.position.set(mid, teethY, 0);
      else tooth.position.set(0, teethY, mid);
      dg.add(tooth);
    }

    return dg;
  };

  // Two dividers running along X (slots facing up)
  for (const z of [-C * 0.5, C * 0.5]) {
    const divX = makeSlottedDivider(true, false);
    divX.position.set(0, T, z);
    group.add(divX);
  }

  // Two dividers running along Z (slots facing down; left one lifted halfway mid-insertion!)
  for (const x of [-C * 0.5, C * 0.5]) {
    const divZ = makeSlottedDivider(false, true);
    divZ.position.set(x, T + (x < 0 ? lift : 0), 0);
    group.add(divZ);
  }

  return group;
}

/**
 * 4. Chapas de Papelão Ondulado — exact 10-sheet corrugated stack from `products-svg.mjs`
 * (`0.50 × 0.36`, `T = 0.02`, subtle organic offsets, top sheet shifted & rotated, bold flute edges).
 */
function buildChapas(cb: CardboardPalette): Group {
  const group = new Group();
  const W = 0.5;
  const D = 0.36;
  const T = 0.02;

  const sheetGeo = new BoxGeometry(W, T, D);
  const sheetMats = [cb.edge, cb.edge, cb.outer, cb.inner, cb.edge, cb.edge];

  const sheets: readonly [number, number, number][] = [
    [0, 0, 0],
    [0.006, -0.004, 0.006],
    [-0.005, 0.003, -0.004],
    [0.004, 0.006, 0.008],
    [-0.006, -0.002, -0.006],
    [0.003, -0.006, 0.004],
    [-0.002, 0.005, -0.008],
    [0.005, 0.002, 0.005],
    [-0.004, -0.004, -0.003],
    [0.06, 0.04, 0.1],
  ];

  sheets.forEach(([dx, dz, yaw], i) => {
    const sheet = new Mesh(sheetGeo, sheetMats);
    sheet.position.set(dx, T * 0.5 + i * (T + 0.0012), dz);
    sheet.rotation.y = yaw;
    group.add(sheet);
  });

  return group;
}

/** Builds all 4 canonical Vanpack product models sharing one CardboardPalette. */
export function buildAllProductModels(cb: CardboardPalette): Record<ProductModelId, Group> {
  return {
    'caixa-normal': buildCaixaNormal(cb),
    'corte-e-vinco': buildCorteEVinco(cb),
    divisorias: buildDivisorias(cb),
    chapas: buildChapas(cb),
  };
}
