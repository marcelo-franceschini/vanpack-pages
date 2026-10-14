// Linha do tempo da animação: o progresso p (0…1) do scroll define câmera e peças.
import * as THREE from 'three';
import {
  BH,
  BOX_END,
  DH,
  DX,
  FEED_X,
  FX,
  GH,
  HEAD_REST,
  LIFT,
  PY,
  SL,
  STACK_Y,
  T,
  WR,
} from './constants.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t) => t * t * (3 - 2 * t);
const seg = (p, a, b) => ease(clamp((p - a) / (b - a)));
const lerp = (a, b, t) => a + (b - a) * t;

// [progresso, posição da câmera, alvo]
const CAMERA_KEYS = [
  [0.0, [-8.6, 3.3, 6.4], [-5.5, 0.8, 0]],
  [0.17, [-5.9, 3.0, 5.6], [-3.8, 0.75, 0]],
  [0.34, [-3.3, 2.9, 4.1], [-2.45, 0.62, 0]],
  [0.46, [-2.2, 3.2, 5.0], [-1.2, 0.7, 0]],
  [0.57, [-0.8, 2.6, 4.4], [0.35, 0.9, 0]],
  [0.67, [0.95, 1.7, 3.3], [0.45, 0.8, 0]],
  [0.79, [1.6, 2.4, 5.2], [3.4, 1.05, 0]],
  [0.87, [1.9, 2.3, 5.8], [4.0, 1.05, 0]],
  [1.0, [5.0, 2.8, 9.0], [7.5, 1.0, 0]],
];

const _pos = new THREE.Vector3();
const _target = new THREE.Vector3();

/** Posiciona a câmera em p; `distK` afasta a câmera em telas estreitas. Devolve o alvo. */
export function placeCamera(camera, p, distK) {
  let i = 0;
  while (i < CAMERA_KEYS.length - 2 && p > CAMERA_KEYS[i + 1][0]) i++;
  const [p0, a0, t0] = CAMERA_KEYS[i];
  const [p1, a1, t1] = CAMERA_KEYS[i + 1];
  const t = ease(clamp((p - p0) / (p1 - p0)));
  _pos.set(lerp(a0[0], a1[0], t), lerp(a0[1], a1[1], t), lerp(a0[2], a1[2], t));
  _target.set(lerp(t0[0], t1[0], t), lerp(t0[1], t1[1], t), lerp(t0[2], t1[2], t));
  camera.position.copy(_pos.sub(_target).multiplyScalar(distK).add(_target));
  camera.lookAt(_target);
  return _target;
}

/** Aplica o estado das peças animadas para o progresso p. */
export function animate(p, { factory, blank, truck, spinners, mat, tex }) {
  // Chapa: alimentador → impressoras (0,06–0,33) → corte e vinco → formadora → baú
  let x;
  if (p < 0.4) x = lerp(FEED_X, -2.45, seg(p, 0.06, 0.33));
  else if (p < 0.64) x = lerp(-2.45, FX, seg(p, 0.4, 0.5));
  else x = lerp(FX, BOX_END, seg(p, 0.64, 0.79));
  const drive = clamp((p - 0.88) / 0.12);
  const dx = drive * drive * 10;
  const h = LIFT * seg(p, 0.53, 0.6);
  blank.blank.position.set(x + (p > 0.8 ? dx : 0), PY + h, 0);

  // As abas dobram enquanto a ventosa ergue o fundo.
  const a = Math.asin(clamp(h / LIFT));
  const [px, nx, pz, nz] = blank.pivots;
  px.rotation.z = -a;
  nx.rotation.z = a;
  pz.rotation.x = a;
  nz.rotation.x = -a;

  // Refiles caem depois da faca rotativa.
  for (const { mesh, lx, lz } of blank.corners) {
    const start = DX + BH / 2 - lx;
    const f = clamp((x - start) / 0.3);
    mesh.visible = f < 1;
    mesh.position.set(lx - (f > 0 ? x - start : 0) + 0.1 * f, T / 2 - 0.5 * f * f, lz);
    mesh.rotation.set(0.9 * f * Math.sign(lz), 0, -0.4 * f);
  }

  factory.stack.position.y = STACK_Y - T * clamp((x - (FEED_X + SL)) / 0.08);

  // Cabeçote: desce, ergue o fundo junto com a chapa e volta ao repouso.
  const dn = seg(p, 0.5, 0.53);
  const up = seg(p, 0.6, 0.635);
  const hy =
    p < 0.53
      ? lerp(HEAD_REST, PY + T, dn)
      : p < 0.6
        ? PY + T + h
        : lerp(PY + T + LIFT, HEAD_REST, up);
  factory.head.position.y = hy;
  const rodTop = GH - 0.6;
  const rodBottom = hy + 0.135;
  factory.rod.scale.y = rodTop - rodBottom;
  factory.rod.position.y = (rodTop + rodBottom) / 2;
  const guideTop = GH - 0.64;
  const guideBottom = hy + 0.085;
  factory.guides.scale.y = guideTop - guideBottom;
  factory.guides.position.y = (guideTop + guideBottom) / 2;

  // Rolos e esteira acompanham o avanço da chapa.
  const travel = Math.min(x, BOX_END) - FEED_X;
  for (const [g, r, dir] of spinners) g.rotation.z = (dir * travel) / r;
  tex.belt.offset.x = -travel / 0.25;

  // Torre de sinalização: verde enquanto a linha roda, âmbar parada.
  const run = p > 0.06 && p < 0.64;
  mat.towerG.emissiveIntensity = run ? 2.2 : 0.05;
  mat.towerA.emissiveIntensity = run ? 0.05 : 1.6;

  // Porta fecha (0,79–0,86) e o caminhão parte (0,88–1).
  const close = Math.max(0.02, seg(p, 0.79, 0.86));
  truck.door.scale.y = close;
  tex.slat.repeat.y = (close * DH) / 0.09;
  truck.doorHandle.position.y = -DH * close + 0.05;
  truck.truck.position.x = dx;
  for (const w of truck.wheels) w.rotation.z = -dx / WR;
  truck.body.rotation.z = 0.02 * Math.sin(Math.PI * clamp(drive * 2.5)) * (1 - drive);
}
