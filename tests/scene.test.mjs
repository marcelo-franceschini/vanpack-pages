// Testes da cena que não precisam de navegador: linha do tempo, câmera, geometria e piso.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { Color, Group, MeshLambertMaterial, Vector3 } from 'three';
import {
  CAMERA,
  MACHINE_A,
  PALETTE,
  PHASE,
  SCRAPS,
  SHEET_LENGTH,
  SHEET_X,
} from '../src/scene/constants.js';
import { buildFactory } from '../src/scene/factory.js';
import { chamferBox, fadedFloor, pathAt } from '../src/scene/geometry.js';
import { lampMix, spinTravel } from '../src/scene/machine.js';
import { lin, ramp, smooth, within } from '../src/scene/math.js';

test('a chapa avança sempre para a frente e as faixas de fase ficam em 0…1 e em ordem', () => {
  for (let i = 1; i < SHEET_X.length; i++) {
    assert.ok(SHEET_X[i][0] > SHEET_X[i - 1][0], 'p crescente');
    assert.ok(SHEET_X[i][1] >= SHEET_X[i - 1][1], 'x não recua');
  }
  for (const [name, value] of Object.entries(PHASE)) {
    const ranges = Array.isArray(value) ? [value] : [];
    for (const [a, b] of ranges) {
      assert.ok(a >= 0 && b <= 1 && a < b, `${name}: ${a}…${b}`);
    }
  }
  assert.ok(PHASE.open[1] <= PHASE.close[0], 'abre antes de fechar');
  assert.ok(PHASE.hop[0] >= PHASE.close[0], 'salta depois de começar a fechar');
  assert.ok(PHASE.slide[0] >= PHASE.hop[1] && PHASE.slide[1] <= PHASE.door[0] + 1e-9);
  assert.ok(PHASE.door[1] <= PHASE.drive[0] + 1e-9);
  assert.equal(PHASE.drive[1], 1, 'o caminhão chega ao fim da história em p = 1');
  for (const scrap of SCRAPS) assert.ok(scrap.t0 > PHASE.scrapsFrom && scrap.t0 < 0.3);
});

test('interpolação: extremos, monotonia e suavização', () => {
  assert.equal(lin(-1, SHEET_X), SHEET_X[0][1]);
  assert.equal(lin(2, SHEET_X), SHEET_X.at(-1)[1]);
  assert.equal(smooth(0), 0);
  assert.equal(smooth(1), 1);
  assert.equal(within(0.5, 0, 1), 0.5);
  assert.equal(ramp(0.75, [0.5, 1]), smooth(0.5));
  let previous = -Infinity;
  for (let p = 0; p <= 1; p += 0.01) {
    const x = lin(p, SHEET_X);
    assert.ok(x >= previous - 1e-12);
    previous = x;
  }
});

test('câmera: uma chave por capítulo, de p = 0 a 1, em paisagem e em retrato', () => {
  for (const keys of [CAMERA.landscape, CAMERA.portrait]) {
    assert.deepEqual(
      keys.map((k) => k.p),
      [0, 0.25, 0.5, 0.75, 1],
    );
    for (const k of keys) assert.ok(k.w > 0 && k.h > 0);
  }
  // em retrato o último quadro usa outro enquadramento (o caminhão ao longe, mais fechado)
  assert.notEqual(CAMERA.portrait.at(-1).x, CAMERA.landscape.at(-1).x);
});

test('estrada: contínua e sempre avançando', () => {
  const a = {};
  const b = {};
  let previous = -Infinity;
  for (let s = 0; s < 40; s += 0.05) {
    pathAt(s, a);
    pathAt(s + 0.05, b);
    assert.ok(Math.hypot(b.x - a.x, b.z - a.z) < 0.06, 'sem saltos');
    assert.ok(a.x >= previous);
    previous = a.x;
  }
});

test('caixa chanfrada: dimensões exatas, faces para fora e sólido fechado', () => {
  const [w, h, d, c] = [0.44, 0.3, 0.34, 0.02];
  const geometry = chamferBox(w, h, d, c);
  geometry.computeBoundingBox();
  const size = geometry.boundingBox.getSize(new Vector3());
  assert.ok(
    Math.abs(size.x - w) < 1e-6 && Math.abs(size.y - h) < 1e-6 && Math.abs(size.z - d) < 1e-6,
  );
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  let volume = 0;
  let area = 0;
  const [p0, p1, p2, n] = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
  for (let i = 0; i < position.count; i += 3) {
    p0.fromBufferAttribute(position, i);
    p1.fromBufferAttribute(position, i + 1);
    p2.fromBufferAttribute(position, i + 2);
    n.fromBufferAttribute(normal, i);
    const geometric = new Vector3().subVectors(p1, p0).cross(new Vector3().subVectors(p2, p0));
    assert.ok(geometric.dot(n) > 0, 'a normal gravada concorda com o enrolamento');
    assert.ok(n.dot(p0) > 0, 'a face aponta para fora do centro');
    area += geometric.length() / 2;
    volume += p0.dot(new Vector3().crossVectors(p1, p2)) / 6;
  }
  assert.ok(volume > 0 && volume < w * h * d, 'o chanfro tira volume do paralelepípedo');
  assert.ok(volume > 0.9 * w * h * d, 'mas pouco');
  assert.ok(area > 0);
});

test('piso opaco: Papel nas bordas, cor do piso no miolo', () => {
  const geometry = fadedFloor(70, 56, 14, '#efe9dc', '#fbf8f2');
  const position = geometry.attributes.position;
  const color = geometry.attributes.color;
  const at = (x, z) => {
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(position.getX(i) - x) < 1e-6 && Math.abs(position.getZ(i) - z) < 1e-6) {
        return new Color(color.getX(i), color.getY(i), color.getZ(i));
      }
    }
    throw new Error(`sem vértice em ${x},${z}`);
  };
  const paper = new Color('#fbf8f2');
  const floor = new Color('#efe9dc');
  const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-5;
  assert.ok(near(at(-35, -28), paper), 'canto = Papel');
  assert.ok(near(at(-21, -14), floor), 'a 14 m da borda já é o piso inteiro');
  assert.equal(geometry.index.count % 3, 0);
});

test('a troca da chapa lisa pela peça herói acontece dentro do trecho fechado da máquina', () => {
  const { printWindow, closed, cutWindow, x0, x1 } = MACHINE_A;
  const half = SHEET_LENGTH / 2;
  assert.ok(
    PHASE.heroFromX - half >= closed[0],
    'a cauda da chapa ainda está dentro do trecho fechado',
  );
  assert.ok(
    PHASE.heroFromX + half <= closed[1],
    'a ponta da chapa ainda está dentro do trecho fechado',
  );
  assert.equal(
    printWindow[1],
    closed[0],
    'o trecho fechado começa onde a janela de impressão acaba',
  );
  assert.equal(cutWindow[0], closed[1], 'e termina onde a janela de corte começa');
  assert.ok(printWindow[0] > x0 && cutWindow[1] < x1, 'as janelas ficam entre a entrada e a saída');
});

test('os cilindros da máquina só andam enquanto a chapa está nela', () => {
  const half = SHEET_LENGTH / 2;
  assert.equal(spinTravel(SHEET_X[0][1]), 0, 'chapa no alimentador: parado');
  assert.equal(spinTravel(MACHINE_A.x0 - half), 0, 'a ponta chega ao primeiro aperto');
  let last = 0;
  for (let x = MACHINE_A.x0 - half; x <= MACHINE_A.x1 + half; x += 0.05) {
    const travel = spinTravel(x);
    assert.ok(travel >= last, 'nunca volta');
    last = travel;
  }
  assert.ok(Math.abs(last - (MACHINE_A.x1 - MACHINE_A.x0 + SHEET_LENGTH)) < 0.06);
  assert.equal(
    spinTravel(MACHINE_A.x1 + half + 3),
    spinTravel(MACHINE_A.x1 + half),
    'depois, parado',
  );
});

/** A fábrica montada num Group, com um material Lambert por cor, como em `createScene`. */
function buildTestFactory() {
  const M = Object.fromEntries(
    [
      'dark',
      'dark2',
      'mid',
      'light2',
      'light',
      'white',
      'forest',
      'kraft',
      'kraftDark',
      'glass',
      'lamp',
    ].map((name) => [name, new MeshLambertMaterial()]),
  );
  const parent = new Group();
  return { M, parent, machine: buildFactory(parent, M) };
}

test('máquina A: gira os cilindros no sentido da chapa, só dentro da fábrica, sem NaN', () => {
  const { parent, machine } = buildTestFactory();
  const spinners = parent.children.filter((child) => child.isGroup);
  assert.equal(spinners.length, 5, 'impressão (3) e corte (2)');
  parent.traverse((object) => {
    for (const value of object.geometry?.attributes.position.array ?? []) {
      assert.ok(Number.isFinite(value), 'geometria sem NaN');
    }
  });
  machine.update(0);
  assert.ok(
    spinners.every((s) => s.rotation.z === 0),
    'em p = 0 tudo parado',
  );
  machine.update(0.2);
  const turns = spinners.map((s) => s.rotation.z);
  assert.ok(
    turns.every((angle) => angle !== 0 && Number.isFinite(angle)),
    'em movimento',
  );
  assert.ok(
    turns.some((a) => a > 0) && turns.some((a) => a < 0),
    'em cima e embaixo, sentidos opostos',
  );
  machine.update(0.3);
  const after = spinners.map((s) => s.rotation.z);
  machine.update(1);
  assert.deepEqual(
    spinners.map((s) => s.rotation.z),
    after,
    'depois que a chapa sai, nada mais gira',
  );
});

test('a lâmpada da máquina é amarela até a peça cortada chegar à saída e fica verde depois', () => {
  const half = SHEET_LENGTH / 2;
  assert.equal(lampMix(SHEET_X[0][1]), 0, 'chapa no alimentador: amarela');
  assert.equal(lampMix(MACHINE_A.x1 - half), 0, 'a ponta da peça chega à saída: ainda amarela');
  assert.equal(lampMix(MACHINE_A.x1 + half), 1, 'a peça saiu inteira: verde');
  let last = 0;
  for (let x = MACHINE_A.x1 - half; x <= MACHINE_A.x1 + half; x += 0.02) {
    const mix = lampMix(x);
    assert.ok(mix >= last, 'só avança, sem voltar');
    last = mix;
  }

  const { M, machine } = buildTestFactory();
  const amber = new Color(PALETTE.amber);
  const green = new Color(PALETTE.forest);
  const near = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) < 1e-6;
  machine.update(0);
  assert.ok(near(M.lamp.color, amber), 'em p = 0: amarela');
  machine.update(0.2);
  assert.ok(near(M.lamp.color, amber), 'a chapa ainda está dentro da máquina: amarela');
  machine.update(0.3);
  assert.ok(near(M.lamp.color, green), 'a peça saiu: verde');
  machine.update(1);
  assert.ok(near(M.lamp.color, green), 'e fica verde até o fim');
  machine.update(0);
  assert.ok(near(M.lamp.color, amber), 'rolar para trás: volta a amarela');
});

test('a cena não toca no DOM (roda em Web Worker): sem document, window, navigator nem rAF', () => {
  const dirs = ['../src/scene/', '../src/brand/'].map((d) => new URL(d, import.meta.url));
  const files = dirs.flatMap((dir) => readdirSync(dir).map((name) => new URL(name, dir)));
  assert.ok(files.length >= 10);
  for (const file of files) {
    const code = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.ok(
      !/\b(document|window|navigator|localStorage|HTMLCanvasElement|requestAnimationFrame)\b/.test(
        code,
      ),
      `${file.pathname} usa o DOM`,
    );
  }
});
