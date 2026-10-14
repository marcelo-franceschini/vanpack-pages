// Cena 3D: chapa → impressão (2 cores) → corte e vinco → formação da caixa → caminhão vanpack.
// Roda igual no worker (OffscreenCanvas) e na thread principal.
import * as THREE from 'three';
import { BELT_X0, BELT_X1, BG } from './constants.js';
import { createTextures } from './textures.js';
import { createMaterials } from './materials.js';
import { createBuilder } from './builder.js';
import { mergeByMaterial } from './merge.js';
import { buildFactory } from './factory.js';
import { buildBlank } from './blank.js';
import { buildTruck } from './truck.js';
import { animate, placeCamera } from './timeline.js';

/** Galpão procedural com claraboias, só para os reflexos dos metais. */
function createEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.47, 0.43), side: THREE.BackSide }),
  );
  room.scale.set(30, 12, 30);
  room.position.y = 5;
  env.add(room);
  const panel = (w, h, x, y, z, k, rx = 0, ry = 0) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k, k), side: THREE.DoubleSide }),
    );
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, 0);
    env.add(m);
  };
  panel(14, 3, 0, 10.8, 0, 7, Math.PI / 2);
  panel(10, 4, -14.8, 5, 0, 3, 0, Math.PI / 2);
  panel(10, 3, 0, 5, 14.8, 2.4);
  panel(6, 2, 10, 4, -14.8, 1.6);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(env, 0.04);
  pmrem.dispose();
  env.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return target;
}

/** Luz do sol cuja sombra acompanha a câmera, travada no texel (sem tremulação). */
function createSun(scene, mobile) {
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0xb8a990, 0.65));
  const sun = new THREE.DirectionalLight(0xffffff, 2.3);
  const size = mobile ? 1024 : 2048;
  const half = 6.5;
  const offset = new THREE.Vector3(3, 8, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(size, size);
  sun.shadow.radius = 3;
  Object.assign(sun.shadow.camera, {
    left: -half,
    right: half,
    top: half,
    bottom: -half,
    near: 0.5,
    far: 30,
  });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.015;
  scene.add(sun, sun.target);

  const dir = offset.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();
  const texel = (2 * half) / size;
  const snapped = new THREE.Vector3();
  const follow = (t) => {
    const a = Math.round(t.dot(right) / texel) * texel;
    const b = Math.round(t.dot(up) / texel) * texel;
    snapped.copy(right).multiplyScalar(a).addScaledVector(up, b).addScaledVector(dir, t.dot(dir));
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).add(offset);
  };
  return { sun, follow };
}

/**
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {{ dpr: number, mobile: boolean }} options
 */
export function createScene(canvas, { dpr, mobile }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: dpr < 2,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.localClippingEnabled = true;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 13, 30);
  scene.environmentIntensity = 0.6;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  let envTarget = createEnvironment(renderer);
  scene.environment = envTarget.texture;
  const { sun, follow } = createSun(scene, mobile);

  const tex = createTextures();
  const mat = createMaterials(tex);
  const b = createBuilder(mat);
  const factory = buildFactory(b, mat);
  const blank = buildBlank(mat);
  const truck = buildTruck(b, mat);
  scene.add(mergeByMaterial(b.root), b.moving, blank.blank, truck.truck);
  tex.belt.repeat.set((BELT_X1 - BELT_X0) / 0.25, 1);
  const parts = { factory, blank, truck, spinners: b.spinners, mat, tex };

  // Âncoras 3D das 5 etapas da linha de produção
  const ANCHORS_3D = [
    new THREE.Vector3(-5.9, 0.95, 0.2), // 0: Chapa de papelão (alimentador)
    new THREE.Vector3(-3.7, 1.45, 0.4), // 1: Impressão flexo (impressoras)
    new THREE.Vector3(-1.65, 1.35, 0.35), // 2: Corte e vinco
    new THREE.Vector3(1.2, 1.15, 0.2), // 3: Montagem da caixa (esteira de saída)
    new THREE.Vector3(2.8, 1.45, 0.6), // 4: Entrega (caminhão baú)
  ];
  const _proj = new THREE.Vector3();

  let distK = 1;

  return {
    /** Compila os shaders sem travar (KHR_parallel_shader_compile) antes do 1º frame. */
    compile: () => renderer.compileAsync(scene, camera),

    render(p, swayX = 0, swayY = 0) {
      animate(p, parts);
      follow(placeCamera(camera, p, distK, swayX, swayY));
      renderer.render(scene, camera);

      // Acompanha a posição do caminhão na etapa 5
      ANCHORS_3D[4].x = 2.8 + (p > 0.88 ? parts.truck.truck.position.x : 0);

      // Projeção das âncoras para coordenadas de tela (%)
      const anchors = [];
      for (let i = 0; i < ANCHORS_3D.length; i++) {
        _proj.copy(ANCHORS_3D[i]).project(camera);
        const visible =
          _proj.z > -1 &&
          _proj.z < 1 &&
          _proj.x >= -0.92 &&
          _proj.x <= 0.92 &&
          _proj.y >= -0.92 &&
          _proj.y <= 0.92;
        anchors.push({
          index: i,
          x: (_proj.x * 0.5 + 0.5) * 100,
          y: (-_proj.y * 0.5 + 0.5) * 100,
          visible,
        });
      }
      return anchors;
    },

    resize(w, h) {
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      const aspect = w / h;
      const portrait = aspect < 1;
      camera.aspect = aspect;
      camera.fov = portrait ? 42 : 35;
      distK = portrait ? Math.min(2.1, Math.max(1.2, 1.25 / aspect)) : aspect < 1.4 ? 1.15 : 1;
      // Desloca o enquadramento para o lado oposto aos cartões de texto.
      if (portrait) camera.setViewOffset(w, h, 0, h * 0.14, w, h);
      else camera.setViewOffset(w, h, -w * (aspect > 1.5 ? 0.2 : 0.13), 0, w, h);
      camera.updateProjectionMatrix();
    },

    setPixelRatio: (value) => renderer.setPixelRatio(value),

    /** Liga/desliga sombras em tempo real (os shaders precisam ser recompilados). */
    setShadows(on) {
      renderer.shadowMap.enabled = on;
      sun.castShadow = on;
      scene.traverse((o) => {
        if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true;
      });
    },

    /** Depois de perder o contexto WebGL, o mapa de ambiente (render target) precisa ser refeito. */
    restore() {
      envTarget.dispose();
      envTarget = createEnvironment(renderer);
      scene.environment = envTarget.texture;
    },
  };
}
