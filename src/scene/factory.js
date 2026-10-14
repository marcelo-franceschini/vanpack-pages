// Linha de produção: piso, alimentador, impressoras flexo, corte e vinco, esteira,
// estação formadora, painel elétrico e paletes.
import * as THREE from 'three';
import {
  BELT_X0,
  BELT_X1,
  DX,
  FEED_X,
  FT,
  FX,
  FZ,
  GH,
  HEAD_REST,
  P1X,
  P2X,
  PY,
  SL,
  STACK_H,
  STACK_Y,
  SW,
  T,
  BW,
  BD,
  BH,
} from './constants.js';
import { mergeByMaterial } from './merge.js';

/** Monta a fábrica em `b.root`/`b.moving` e devolve as peças animadas. */
export function buildFactory(b, mat) {
  const { add, B, bb, zr, cyl, tube, flat, plate, label, blob, foot, roll, unitFrame, topCover } =
    b;

  // ---------- Piso (Laje de Diorama) ----------
  // Laje industrial elevada com corte limpo e rodapé escuro
  bb(-8.6, 13.2, -0.36, 0.0, -3.4, 3.4, mat.floor);
  // Bordas e chanfro da laje
  bb(-8.65, 13.25, -0.36, -0.01, 3.35, 3.42, mat.frameDark);
  bb(-8.65, 13.25, -0.36, -0.01, -3.42, -3.35, mat.frameDark);
  bb(-8.65, -8.58, -0.36, -0.01, -3.42, 3.42, mat.frameDark);
  bb(13.18, 13.25, -0.36, -0.01, -3.42, 3.42, mat.frameDark);

  // Sombra e chão base abaixo do diorama
  const ground = add(new THREE.PlaneGeometry(80, 40), mat.floor, 4, -0.36, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;

  // Demarcações de segurança da linha de produção
  for (const s of [-1, 1]) flat(bb(-7.7, 1.55, 0.001, 0.003, ...zr(s, 1.32, 1.38), mat.line));
  for (const x of [-7.7, 1.55]) flat(bb(x - 0.03, x + 0.03, 0.001, 0.003, -1.38, 1.38, mat.line));

  // Faixa de rodagem e rota de expedição do caminhão
  for (let px = 1.8; px <= 12.6; px += 0.85) {
    flat(bb(px, px + 0.45, 0.001, 0.003, -0.035, 0.035, mat.line));
  }
  flat(bb(1.8, 12.8, 0.001, 0.003, 1.25, 1.3, mat.line));
  flat(bb(1.8, 12.8, 0.001, 0.003, -1.3, -1.25, mat.line));
  flat(bb(2.8, 5.6, 0.001, 0.003, 1.35, 1.42, mat.line));
  flat(bb(2.8, 5.6, 0.001, 0.003, -1.42, -1.35, mat.line));

  // Postes de segurança (bollards) na baia de expedição
  for (const s of [-1, 1]) {
    const bz = s * 1.55;
    cyl(0.06, 0.72, mat.line, 2.05, 0.36, bz, 'y', b.root, 16);
    cyl(0.062, 0.08, mat.dark, 2.05, 0.52, bz, 'y', b.root, 16);
    cyl(0.062, 0.08, mat.dark, 2.05, 0.32, bz, 'y', b.root, 16);
    cyl(0.085, 0.03, mat.steel, 2.05, 0.015, bz, 'y', b.root, 16);
  }

  // Props industriais: Rack com bobinas de papel kraft junto ao alimentador
  {
    const rx = -7.7;
    const rz = -2.25;
    // Estrutura do rack
    for (const dx of [-0.45, 0.45]) {
      for (const dz of [-0.35, 0.35]) {
        bb(rx + dx - 0.025, rx + dx + 0.025, 0, 1.45, rz + dz - 0.025, rz + dz + 0.025, mat.frame);
      }
      bb(rx + dx - 0.02, rx + dx + 0.02, 0.65, 0.69, rz - 0.35, rz + 0.35, mat.steel);
      bb(rx + dx - 0.02, rx + dx + 0.02, 1.35, 1.39, rz - 0.35, rz + 0.35, mat.steel);
    }
    // Bobinas horizontais
    cyl(0.28, 0.76, mat.kraft, rx, 0.32, rz, 'x', b.root, 24);
    cyl(0.07, 0.78, mat.dark, rx, 0.32, rz, 'x', b.root, 16);
    cyl(0.25, 0.76, mat.kraft, rx, 0.98, rz, 'x', b.root, 24);
    cyl(0.07, 0.78, mat.dark, rx, 0.98, rz, 'x', b.root, 16);
    // Bobina em pé ao lado
    cyl(0.27, 0.95, mat.kraft, rx + 0.8, 0.475, rz, 'y', b.root, 24);
    cyl(0.07, 0.97, mat.dark, rx + 0.8, 0.485, rz, 'y', b.root, 16);
    blob(rx, rz, 1.8, 1.4);
  }

  // Paleteira manual hidráulica (pallet jack)
  {
    const jx = -6.4;
    const jz = 2.15;
    // Garfos duplos
    bb(jx - 0.55, jx + 0.45, 0.02, 0.07, jz - 0.16, jz - 0.06, mat.steel);
    bb(jx - 0.55, jx + 0.45, 0.02, 0.07, jz + 0.06, jz + 0.16, mat.steel);
    // Rodízios frontais
    cyl(0.035, 0.06, mat.rubber, jx - 0.5, 0.035, jz - 0.11, 'z', b.root, 12);
    cyl(0.035, 0.06, mat.rubber, jx - 0.5, 0.035, jz + 0.11, 'z', b.root, 12);
    // Chassi e torre
    bb(jx + 0.42, jx + 0.62, 0.04, 0.32, jz - 0.2, jz + 0.2, mat.line);
    cyl(0.05, 0.28, mat.steel, jx + 0.52, 0.2, jz, 'y', b.root, 16);
    // Timão inclinado
    cyl(0.02, 0.65, mat.dark, jx + 0.65, 0.55, jz, 'x', b.root, 12);
    bb(jx + 0.95, jx + 0.99, 0.65, 0.75, jz - 0.12, jz + 0.12, mat.dark);
    blob(jx, jz, 1.4, 0.8);
  }

  // ---------- Alimentador (pilha de chapas) ----------
  {
    const x0 = -6.8;
    const x1 = -4.85;
    unitFrame(x0, x1, PY + 0.12);
    bb(x0 + 0.04, x1 - 0.04, PY - 0.035, PY - 0.001, -FZ + FT / 2, FZ - FT / 2, mat.dark);
    for (const z of [-FZ, FZ])
      bb(-5.2, -5.1, PY + 0.12, PY + 0.86, z - 0.035, z + 0.035, mat.frame);
    bb(-5.22, -5.08, PY + 0.78, PY + 0.88, -FZ - 0.035, FZ + 0.035, mat.frame);
    for (const z of [-0.42, 0, 0.42]) {
      bb(-5.2, -5.18, PY + T + 0.006, PY + 0.78, z - 0.08, z + 0.08, mat.steel);
    }
    for (const z of [-FZ, FZ])
      bb(-6.74, -6.66, PY + 0.12, PY + 0.6, z - 0.035, z + 0.035, mat.frame);
    cyl(0.02, 2 * FZ, mat.steel, -6.7, PY + 0.52, 0, 'z');
    for (const z of [-0.3, 0.3])
      bb(-6.64, -6.61, PY + 0.01, PY + 0.56, z - 0.1, z + 0.1, mat.steel);
    for (const s of [-1, 1]) {
      for (const x of [-6.25, -5.55]) {
        bb(x - 0.015, x + 0.015, PY + 0.01, PY + 0.5, ...zr(s, 0.652, 0.664), mat.steel);
        bb(x - 0.015, x + 0.015, PY + 0.44, PY + 0.47, ...zr(s, 0.664, FZ), mat.steel);
      }
    }
    roll(-4.98, PY - 0.055, 0.055, mat.rubber, -1, 0.061);
    roll(-4.98, PY + T + 0.055, 0.055, mat.rubber, 1, 0.061);
    cyl(0.012, 0.26, mat.steel, -5.15, PY + 1.0, FZ, 'y', b.root, 10);
    for (const [m, y] of [
      [mat.towerR, 1.31],
      [mat.towerA, 1.24],
      [mat.towerG, 1.17],
    ]) {
      cyl(0.035, 0.065, m, -5.15, PY + y, FZ, 'y', b.root, 20);
    }
    cyl(0.037, 0.012, mat.frameDark, -5.15, PY + 1.35, FZ, 'y', b.root, 20);
    label(3, 0.12, -6.45, 0.42, FZ + FT / 2 + 0.003);
    label(0, 0.1, -5.4, 0.42, FZ + FT / 2 + 0.003);
    blob(-5.85, 0, 2.6, 2.4);
  }
  const stackSides = [
    mat.stackSide,
    mat.stackSide,
    mat.kraft,
    mat.kraft,
    mat.stackSide,
    mat.stackSide,
  ];
  const stack = merged((g) => {
    const m = new THREE.Mesh(B(SL, STACK_H, SW), stackSides);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  });
  stack.position.set(FEED_X, STACK_Y, 0);
  b.moving.add(stack);

  // Painel de comando (IHM) em braço articulado
  {
    const hx = -6.95;
    const hz = 1.0;
    bb(hx - 0.1, hx + 0.1, 0, 0.02, hz - 0.1, hz + 0.1, mat.steel);
    cyl(0.035, 1.82, mat.steel, hx, 0.92, hz);
    cyl(0.03, 0.44, mat.steel, hx, 1.8, hz + 0.2, 'z');
    cyl(0.02, 0.14, mat.steel, hx, 1.73, hz + 0.42);
    const pn = new THREE.Group();
    pn.position.set(hx, 1.5, hz + 0.44);
    pn.rotation.y = -0.35;
    b.root.add(pn);
    add(B(0.46, 0.34, 0.09), mat.cabinet, 0, 0, 0, pn);
    flat(add(new THREE.PlaneGeometry(0.3, 0.19), mat.screen, -0.05, 0.03, 0.046, pn));
    [mat.btnG, mat.towerA, mat.btnB].forEach((m, i) =>
      cyl(0.016, 0.02, m, 0.17, 0.1 - i * 0.055, 0.05, 'z', pn, 14),
    );
    cyl(0.032, 0.02, mat.yellow, 0.17, -0.11, 0.05, 'z', pn, 20);
    cyl(0.024, 0.03, mat.red, 0.17, -0.11, 0.065, 'z', pn, 20);
  }

  // ---------- Unidades impressoras (flexo, 2 cores) ----------
  function printUnit(cx, inkM) {
    const x0 = cx - 0.5;
    const x1 = cx + 0.5;
    const top = 1.28;
    unitFrame(x0, x1, top, [
      [x0 + 0.09, PY - 0.12, cx - 0.17, PY + 0.47],
      [cx + 0.17, PY - 0.12, x1 - 0.09, PY + 0.47],
    ]);
    topCover(x0, x1, top);
    const rI = 0.085;
    const rP = 0.125;
    const rA = 0.07;
    const yI = PY - rI;
    const yP = PY + T + rP + 0.006;
    roll(cx, yI, rI, mat.steel, -1, 0.095);
    const pc = roll(cx, yP, rP, mat.steel, 1, 0.133);
    const sleeve = add(
      new THREE.CylinderGeometry(rP + 0.006, rP + 0.006, 1.28, 48, 1, false, 0, 3.6),
      mat.plate,
      0,
      0,
      0,
      pc,
    );
    sleeve.rotation.x = Math.PI / 2;
    const a = 2.45;
    const d = rP + 0.006 + rA;
    const ax = cx + Math.cos(a) * d;
    const ay = yP + Math.sin(a) * d;
    roll(ax, ay, rA, mat.chrome, -1, 0.068);
    const chx = ax + Math.cos(a) * (rA + 0.045);
    const chy = ay + Math.sin(a) * (rA + 0.045);
    add(B(0.08, 0.12, 1.48), mat.frameDark, chx, chy, 0).rotation.z = a;
    add(
      B(0.012, 0.1, 1.44),
      inkM,
      ax + Math.cos(a) * (rA + 0.006),
      ay + Math.sin(a) * (rA + 0.006),
      0,
    ).rotation.z = a;
    const bx = cx - 0.3;
    tube(
      [
        [chx, chy, 0.72],
        [cx - 0.27, 0.86, 0.9],
        [bx, 0.66, 1.08],
        [bx, 0.44, 1.2],
        [bx, 0.36, 1.2],
      ],
      0.013,
      inkM,
    );
    tube(
      [
        [chx, chy - 0.05, 0.72],
        [cx - 0.24, 0.8, 0.92],
        [bx + 0.06, 0.6, 1.1],
        [bx + 0.06, 0.4, 1.18],
        [bx + 0.06, 0.34, 1.18],
      ],
      0.012,
      mat.cable,
    );
    cyl(0.13, 0.34, mat.bucket, bx, 0.17, 1.2, 'y', b.root, 28);
    cyl(0.118, 0.01, inkM, bx, 0.336, 1.2, 'y', b.root, 28);
    bb(bx + 0.17, bx + 0.33, 0, 0.12, 1.1, 1.26, mat.frameDark);
    cyl(0.045, 0.14, mat.btnB, bx + 0.25, 0.17, 1.18, 'x', b.root, 16);
    cyl(0.016, 0.8, mat.steel, cx, 1.12, FZ + 0.1, 'x', b.root, 12);
    for (const x of [x0 + 0.12, x1 - 0.12])
      cyl(0.012, 0.07, mat.steel, x, 1.12, FZ + 0.065, 'z', b.root, 10);
    label(0, 0.1, x0 + 0.2, top - 0.1, FZ + FT / 2 + 0.003);
    blob(cx, 0.1, 1.5, 2.2);
  }
  printUnit(P1X, mat.inkA);
  printUnit(P2X, mat.inkB);

  // Mesa de transferência + inspeção por câmera
  {
    const x0 = -2.7;
    const x1 = -2.2;
    plate(x0, x1, 0.06, PY - 0.03, -FZ);
    plate(x0, x1, 0.06, PY - 0.03, FZ);
    for (const x of [x0 + 0.07, x1 - 0.07]) for (const z of [-FZ, FZ]) foot(x, z);
    bb(x0, x1, PY - 0.03, PY - 0.002, -0.72, 0.72, mat.dark);
    for (const z of [-FZ, FZ]) bb(-2.47, -2.41, PY - 0.03, 1.46, z - 0.03, z + 0.03, mat.frame);
    bb(-2.48, -2.4, 1.4, 1.48, -FZ - 0.03, FZ + 0.03, mat.frame);
    flat(bb(-2.47, -2.41, 1.36, 1.4, -0.66, 0.66, mat.led));
    bb(-2.5, -2.38, 1.28, 1.4, -0.07, 0.07, mat.frameDark);
    cyl(0.025, 0.04, mat.glass, -2.44, 1.26, 0, 'y', b.root, 16);
  }

  // ---------- Corte e vinco rotativo ----------
  {
    const x0 = -2.2;
    const x1 = -1.1;
    const top = 1.36;
    unitFrame(x0, x1, top, [
      [x0 + 0.09, PY - 0.1, DX - 0.25, PY + 0.52],
      [DX + 0.25, PY - 0.1, x1 - 0.09, PY + 0.52],
    ]);
    topCover(x0, x1, top);
    const rAv = 0.16;
    const rD = 0.2;
    const yAv = PY - rAv;
    const yD = PY + T + rD + 0.016;
    roll(DX, yAv, rAv, mat.anvil, -1, 0.172);
    const dc = roll(DX, yD, rD, mat.steel, 1, 0.216);
    add(
      new THREE.CylinderGeometry(rD + 0.016, rD + 0.016, 1.34, 56, 1, false, 0, 4.2),
      mat.wood,
      0,
      0,
      0,
      dc,
    ).rotation.x = Math.PI / 2;
    bb(DX + 0.18, x1 - 0.03, PY - 0.32, PY - 0.3, -FZ + 0.04, FZ - 0.04, mat.dark);
    bb(DX + 0.17, x1, PY - 0.014, PY - 0.001, -0.2, 0.2, mat.steel);
    cyl(0.016, 0.9, mat.steel, DX, 1.2, FZ + 0.1, 'x', b.root, 12);
    for (const x of [x0 + 0.12, x1 - 0.12])
      cyl(0.012, 0.07, mat.steel, x, 1.2, FZ + 0.065, 'z', b.root, 10);
    label(0, 0.1, x0 + 0.2, top - 0.1, FZ + FT / 2 + 0.003);
    label(2, 0.1, x1 - 0.2, top - 0.1, FZ + FT / 2 + 0.003);
    blob(DX, 0, 1.6, 2.2);
  }

  // ---------- Esteira de saída + estação formadora ----------
  {
    bb(BELT_X0, BELT_X1, PY - 0.03, PY, -0.35, 0.35, mat.belt);
    for (const s of [-1, 1])
      bb(BELT_X0, BELT_X1, PY - 0.1, PY - 0.006, ...zr(s, 0.35, 0.39), mat.steel);
    for (const x of [BELT_X0, BELT_X1]) cyl(0.032, 0.72, mat.steel, x, PY - 0.032, 0, 'z');
    for (let x = BELT_X0 + 0.25; x < BELT_X1; x += 1.0) {
      for (const s of [-1, 1]) {
        bb(x - 0.025, x + 0.025, 0.06, PY - 0.1, ...zr(s, 0.35, 0.39), mat.steel);
        foot(x, s * 0.37);
      }
      bb(x - 0.02, x + 0.02, 0.2, 0.24, -0.35, 0.35, mat.steel);
    }
    blob((BELT_X0 + BELT_X1) / 2, 0, BELT_X1 - BELT_X0 + 0.4, 1.2);
    const xa = FX - 0.62;
    const xb = FX + 0.62;
    const zc = 0.98;
    for (const x of [xa, xb]) {
      for (const z of [-zc, zc]) {
        bb(x - 0.04, x + 0.04, 0.02, GH, z - 0.04, z + 0.04, mat.yellow);
        bb(x - 0.043, x + 0.043, 0.02, 0.32, z - 0.043, z + 0.043, mat.hazard);
        bb(x - 0.08, x + 0.08, 0, 0.02, z - 0.08, z + 0.08, mat.steel);
      }
    }
    for (const z of [-zc, zc])
      bb(xa - 0.04, xb + 0.04, GH, GH + 0.08, z - 0.04, z + 0.04, mat.yellow);
    for (const x of [xa, xb]) bb(x - 0.04, x + 0.04, GH, GH + 0.08, -zc, zc, mat.yellow);
    bb(FX - 0.08, FX + 0.08, GH - 0.1, GH + 0.08, -zc, zc, mat.frame);
    cyl(0.075, 0.44, mat.alu, FX, GH - 0.36, 0, 'y', b.root, 32);
    bb(FX - 0.09, FX + 0.09, GH - 0.6, GH - 0.56, -0.09, 0.09, mat.frameDark);
    bb(FX - 0.09, FX + 0.09, GH - 0.14, GH - 0.1, -0.09, 0.09, mat.frameDark);
    bb(FX - 0.2, FX + 0.2, GH - 0.66, GH - 0.62, -0.06, 0.06, mat.frameDark);
    bb(FX + 0.1, FX + 0.28, GH + 0.08, GH + 0.16, -0.08, 0.08, mat.steel);
    tube(
      [
        [FX + 0.19, GH + 0.12, 0.08],
        [FX + 0.14, GH - 0.05, 0.14],
        [FX + 0.08, GH - 0.3, 0.1],
      ],
      0.008,
      mat.btnB,
    );
    for (const z of [-zc - 0.1, zc + 0.1]) {
      bb(xa - 0.13, xa - 0.08, 0.25, 1.6, z - 0.025, z + 0.025, mat.dark);
      flat(bb(xa - 0.08, xa - 0.074, 0.3, 1.55, z - 0.01, z + 0.01, mat.redLed));
    }
    label(0, 0.09, xa, 1.1, zc + 0.041);
    blob(FX, 0, 1.8, 2.4);
  }

  // Cabeçote com ventosas: as 26 peças viram uma malha por material.
  const head = merged((g) => {
    add(B(0.48, 0.04, 0.38), mat.alu, 0, 0.065, 0, g);
    add(B(0.2, 0.05, 0.12), mat.frameDark, 0, 0.11, 0, g);
    for (const x of [-0.16, 0, 0.16]) {
      for (const z of [-0.11, 0.11]) {
        cyl(0.012, 0.02, mat.steel, x, 0.035, z, 'y', g, 10);
        add(new THREE.CylinderGeometry(0.032, 0.022, 0.025, 16), mat.rubber, x, 0.0125, z, g);
      }
    }
  });
  head.position.set(FX, HEAD_REST, 0);
  b.moving.add(head);
  const rod = cyl(0.025, 1, mat.chrome, FX, 1, 0, 'y', b.moving, 16);
  const guides = merged((g) => {
    for (const dx of [-0.15, 0.15]) cyl(0.014, 1, mat.chrome, dx, 0, 0, 'y', g, 12);
  });
  guides.position.set(FX, 1, 0);
  b.moving.add(guides);

  // ---------- Painel elétrico, eletrocalha e paletes ----------
  {
    const x0 = -5.5;
    const x1 = -4.1;
    const z0 = -1.82;
    const z1 = -1.38;
    const mx = (x0 + x1) / 2;
    bb(x0, x1, 0, 0.1, z0 + 0.02, z1 - 0.02, mat.frameDark);
    bb(x0, x1, 0.1, 2.1, z0, z1, mat.cabinet);
    flat(bb(mx - 0.004, mx + 0.004, 0.14, 2.06, z1, z1 + 0.004, mat.dark));
    for (const x of [mx - 0.08, mx + 0.08])
      bb(x - 0.015, x + 0.015, 1.0, 1.2, z1, z1 + 0.025, mat.dark);
    for (const [a, c] of [
      [x0 + 0.15, x0 + 0.5],
      [x1 - 0.5, x1 - 0.15],
    ]) {
      for (let i = 0; i < 6; i++) {
        flat(bb(a, c, 0.3 + i * 0.04, 0.315 + i * 0.04, z1, z1 + 0.003, mat.dark));
      }
    }
    label(1, 0.13, x0 + 0.33, 1.72, z1 + 0.004);
    label(3, 0.13, x1 - 0.33, 1.72, z1 + 0.004);
    cyl(0.025, 0.03, mat.towerG, x1 - 0.2, 1.92, z1 + 0.015, 'z', b.root, 16);
    cyl(0.025, 0.03, mat.towerR, x1 - 0.3, 1.92, z1 + 0.015, 'z', b.root, 16);
    blob(mx, -1.6, 1.9, 0.9);
    const ty = 1.72;
    const tz0 = -1.12;
    const tz1 = -0.92;
    bb(-5.3, 0.15, ty - 0.012, ty, tz0, tz1, mat.galv);
    for (const z of [tz0, tz1]) bb(-5.3, 0.15, ty, ty + 0.06, z - 0.004, z + 0.004, mat.galv);
    for (const x of [-4.6, -3.7, -2.9, -1.9, -1.2, -0.3]) {
      bb(x - 0.02, x + 0.02, 0.95, ty - 0.012, -0.935, -0.9, mat.galv);
    }
    for (const x of [-4.75, -4.6, -4.45]) {
      tube(
        [
          [x, 2.1, -1.6],
          [x, 2.24, -1.5],
          [x, 2.05, -1.08],
          [x, ty + 0.02, -1.02],
        ],
        0.012,
        mat.cable,
      );
    }
    for (const x of [P1X + 0.3, P2X + 0.3, DX + 0.35]) {
      tube(
        [
          [x, ty + 0.02, -1.02],
          [x + 0.04, 1.55, -0.98],
          [x + 0.06, 1.38, -0.92],
          [x + 0.06, 1.3, -0.9],
        ],
        0.012,
        mat.cable,
      );
    }
    tube(
      [
        [0.1, ty + 0.03, -1.02],
        [0.0, 1.95, -1.0],
        [FX - 0.62, GH + 0.04, -0.98],
      ],
      0.012,
      mat.cable,
    );
  }

  function pallet(x, z) {
    for (const dz of [-0.42, 0, 0.42]) {
      bb(x - 0.6, x + 0.6, 0, 0.022, z + dz - 0.05, z + dz + 0.05, mat.pallet);
    }
    for (const dx of [-0.52, 0, 0.52]) {
      for (const dz of [-0.42, 0, 0.42]) {
        bb(x + dx - 0.05, x + dx + 0.05, 0.022, 0.12, z + dz - 0.05, z + dz + 0.05, mat.pallet);
      }
    }
    for (let i = 0; i < 7; i++) {
      const zc = z - 0.5 + i * 0.1667;
      bb(x - 0.6, x + 0.6, 0.12, 0.142, zc - 0.045, zc + 0.045, mat.pallet);
    }
    blob(x, z, 1.6, 1.4);
  }
  // Palete com chapas cintadas, ao lado das impressoras
  pallet(-3.7, -2.15);
  {
    const m = new THREE.Mesh(B(SL, 0.5, SW), stackSides);
    m.position.set(-3.7, 0.142 + 0.25, -2.15);
    m.castShadow = m.receiveShadow = true;
    b.root.add(m);
    for (const dx of [-0.35, 0.35]) {
      bb(
        -3.7 + dx - 0.015,
        -3.7 + dx + 0.015,
        0.14,
        0.648,
        -2.15 - SW / 2 - 0.004,
        -2.15 + SW / 2 + 0.004,
        mat.dark,
      );
    }
  }
  // Palete com caixas prontas, depois da formadora
  pallet(2.1, -1.85);
  for (let i = 0; i < 8; i++) {
    const lx = i & 1 ? 0.3 : -0.3;
    const lz = i & 2 ? 0.25 : -0.25;
    const ly = i & 4 ? 1 : 0;
    bb(
      2.1 + lx - BW / 2 + 0.01,
      2.1 + lx + BW / 2 - 0.01,
      0.142 + ly * BH,
      0.142 + (ly + 1) * BH - 0.004,
      -1.85 + lz - BD / 2 + 0.01,
      -1.85 + lz + BD / 2 - 0.01,
      mat.printed,
    );
  }

  return { stack, head, rod, guides };
}

function merged(build) {
  const g = new THREE.Group();
  build(g);
  return mergeByMaterial(g);
}
