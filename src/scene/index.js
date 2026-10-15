// Diorama 3D da fabricação: chapa de papelão → impressão e corte → dobra e cola → caixa → entrega.
// Seguro para Web Worker: não acessa DOM. O host chama `render(p)` só quando o progresso muda.
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFShadowMap,
  PlaneGeometry,
  Scene,
  ShadowMaterial,
  Vector3,
  WebGLRenderer,
} from 'three';
import { createCameraRig } from './camera.js';
import { FLAT_T, PALETTE, PALLET_H, SCRAPS, SHEET_LENGTH, STACK_TOP } from './constants.js';
import { buildFactory } from './factory.js';
import { Batch, fadedFloor, ribbon, softRects, stackSides } from './geometry.js';
import { createHero } from './hero.js';
import { clamp } from './math.js';
import { edgeTexture, truckLogoTexture } from './textures.js';
import { createTimeline } from './timeline.js';
import { buildTruck } from './truck.js';

const PI = Math.PI;
const SUN_OFFSET = new Vector3(-4.5, 9, 6);
// A sombra só cai no piso e é suave: mapa de 1024 com o recorte ajustado ao enquadramento atual
// (de 3,8 a 9,5 m de meia largura) tem texel menor que o antigo 2048 com recorte fixo de 15 m.
const SHADOW_MAP_SIZE = 1024;
const SHADOW_HALF_MIN = 3.8;
const SHADOW_HALF_MAX = 9.5;
const SHADOW_REACH_FACTOR = 1.5; // meia largura do recorte / alcance da câmera
const SHADOW_BLUR = 2; // em texels (o mapa tem metade da resolução anterior)
const FLOOR = { width: 70, depth: 56, centerX: 8, centerZ: -14, fade: 14 };

/**
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {{ dpr?: number, mobile?: boolean }} [options] `mobile`: sem sombra em tempo real
 */
export function createScene(canvas, { dpr = 1, mobile = false } = {}) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: dpr < 2,
    alpha: false, // canvas opaco: a página não precisa compor transparência
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(PALETTE.paper);
  // A checagem de erro de shader sincroniza com o driver depois de cada link; só vale em dev/auditoria.
  renderer.debug.checkShaderErrors = import.meta.env.MODE !== 'production';
  renderer.shadowMap.enabled = !mobile;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  const rig = createCameraRig();
  const { camera } = rig;
  const disposables = [];
  const track = (resource) => {
    disposables.push(resource);
    return resource;
  };

  // luz: uma principal quente e suave + ambiente
  scene.add(new HemisphereLight(0xffffff, 0xd9d2c4, 2.0));
  const sun = new DirectionalLight(0xfff6ec, 2.1);
  sun.castShadow = !mobile;
  sun.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  sun.shadow.radius = SHADOW_BLUR;
  Object.assign(sun.shadow.camera, { near: 1, far: 30 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.position.copy(SUN_OFFSET);
  scene.add(sun, sun.target);
  // eixos da luz (a direção é fixa): o recorte da sombra anda em múltiplos de um texel
  const lightDirection = SUN_OFFSET.clone().negate().normalize();
  const lightRight = new Vector3().crossVectors(lightDirection, new Vector3(0, 1, 0)).normalize();
  const lightUp = new Vector3().crossVectors(lightRight, lightDirection);
  const snapped = new Vector3();
  let shadowHalf = 0;

  // materiais: um por cor (Lambert); a linha da estrada e a cinta são separadas de propósito
  const lambert = (color, options) => track(new MeshLambertMaterial({ color, ...options }));
  const M = {
    dark: lambert(PALETTE.dark),
    dark2: lambert(PALETTE.dark2),
    mid: lambert(PALETTE.mid),
    light2: lambert(PALETTE.light2),
    light: lambert(PALETTE.light),
    white: lambert(PALETTE.white),
    forest: lambert(PALETTE.forest),
    kraft: lambert(PALETTE.kraft),
    kraftDark: lambert(PALETTE.kraftDark),
    glass: lambert(PALETTE.glass),
    road: lambert(PALETTE.road),
    strap: lambert(PALETTE.dark2),
  };

  // piso opaco que esmaece para o Papel da página, estrada e sombras
  const floor = new Mesh(
    track(fadedFloor(FLOOR.width, FLOOR.depth, FLOOR.fade, PALETTE.floor, PALETTE.paper)),
    track(new MeshBasicMaterial({ vertexColors: true })),
  );
  floor.position.set(FLOOR.centerX, 0, FLOOR.centerZ);
  scene.add(floor);
  scene.add(
    new Mesh(
      track(ribbon(-3, 46, 0.4, 2.0, 0.004)),
      track(
        new MeshLambertMaterial({
          color: PALETTE.road,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }),
      ),
    ),
  );
  const blobMaterial = track(
    new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }),
  );
  const shadowCatcher = new Mesh(
    track(new PlaneGeometry(60, 40).rotateX(-PI / 2)),
    track(new ShadowMaterial({ opacity: 0.16, depthWrite: false })),
  );
  shadowCatcher.position.set(10, 0.012, -4);
  shadowCatcher.receiveShadow = true;
  scene.add(shadowCatcher);

  // fábrica (estática) e a pilha de chapas do alimentador
  const world = new Group();
  scene.add(world);
  buildFactory(world, M);
  const edgeMap = track(edgeTexture());
  const edgeMaterial = track(new MeshLambertMaterial({ map: edgeMap }));
  // mesmo passo de camada da pilha do palete: com 8 mm o desenho da borda não chega a 2 px na tela
  const feederStack = new Mesh(
    track(stackSides(-7.02, -6.38, 0.53, 0.842, -0.81, 0.67, FLAT_T)),
    edgeMaterial,
  );
  feederStack.castShadow = true;
  const feederTop = new Mesh(track(new PlaneGeometry(0.64, 1.48).rotateX(-PI / 2)), M.kraft);
  feederTop.position.set(-6.7, 0.842, -0.07);
  const plain = new Mesh(track(new BoxGeometry(SHEET_LENGTH, 0.008, 1.48)), M.kraft);
  plain.castShadow = true;
  world.add(feederStack, feederTop, plain);

  // palete carregado (grupo móvel) e a cinta
  const load = new Group();
  {
    const planks = new Batch();
    for (const z of [-0.42, -0.21, 0, 0.21, 0.42]) {
      planks.box(M.kraftDark, -0.6, 0.6, 0.085, PALLET_H, z - 0.08, z + 0.08, 0.008);
    }
    for (const z of [-0.42, 0, 0.42]) {
      planks.box(M.kraftDark, -0.6, 0.6, 0.0, 0.085, z - 0.045, z + 0.045, 0.008);
    }
    planks.build(load);
    const stack = new Mesh(
      track(
        stackSides(-SHEET_LENGTH / 2, SHEET_LENGTH / 2, PALLET_H, STACK_TOP, -0.37, 0.37, FLAT_T),
      ),
      edgeMaterial,
    );
    stack.castShadow = true;
    const top = new Mesh(track(new PlaneGeometry(SHEET_LENGTH, 0.74).rotateX(-PI / 2)), M.kraft);
    top.position.y = STACK_TOP;
    load.add(stack, top);
  }
  const strap = new Group();
  {
    const bands = new Batch();
    const top = STACK_TOP + FLAT_T + 0.008;
    for (const x of [-0.17, 0.17]) {
      bands.box(M.strap, x - 0.016, x + 0.016, top - 0.006, top, -0.378, 0.378, 0.002);
      for (const z of [-0.378, 0.378]) {
        bands.box(M.strap, x - 0.016, x + 0.016, PALLET_H, top, z - 0.003, z + 0.003, 0.002);
      }
    }
    bands.build(strap);
    // a cinta cresce a partir de y = 0,34 (pivô)
    strap.position.y = 0.34;
    for (const band of strap.children) band.position.y = -0.34;
  }
  load.add(strap);
  scene.add(load);

  // caminhão
  const truckLogo = track(truckLogoTexture());
  const { truck, doorPivot } = buildTruck(M, truckLogo, track);
  scene.add(truck);

  // peça "herói": a chapa que vira caixa
  const hero = createHero(track);
  scene.add(hero.spin);

  // aparas que caem no recolhimento
  const scraps = new InstancedMesh(track(new BoxGeometry(1, 0.012, 1)), M.kraft, SCRAPS.length);
  scraps.castShadow = true;
  scraps.frustumCulled = false;
  scene.add(scraps);

  // sombras falsas (valem sempre; com sombra em tempo real ficam mais fracas)
  const blobs = new Mesh(
    track(
      softRects([
        [-7.4, -6.0, -1.05, 0.91, 0.35, 0.34],
        [-5.25, -2.45, -1.05, 1.05, 0.45, 0.34],
        [-1.05, 4.75, -0.67, 0.67, 0.35, 0.3],
        [-2.3, -1.7, -0.7, 0.7, 0.2, 0.0],
      ]),
    ),
    blobMaterial,
  );
  blobs.position.y = 0.006;
  const loadBlob = new Mesh(
    track(softRects([[-0.65, 0.65, -0.55, 0.55, 0.25, 0.35]])),
    blobMaterial,
  );
  loadBlob.position.y = 0.006;
  const truckBlob = new Mesh(track(softRects([[-0.2, 4.4, -1.0, 1.0, 0.45, 0.4]])), blobMaterial);
  truckBlob.position.y = 0.007;
  scene.add(blobs, loadBlob, truckBlob);

  let shadows = !mobile;
  const applyShadowState = () => {
    blobMaterial.opacity = shadows ? 0.55 : 1;
    shadowCatcher.visible = shadows;
  };
  applyShadowState();

  const update = createTimeline({
    plain,
    hero,
    scraps,
    load,
    strap,
    loadBlob,
    doorPivot,
    truck,
    truckBlob,
  });
  // Sombra: recorte proporcional ao que a câmera mostra e centro encaixado na grade de texels, para
  // as bordas não "andarem" durante o scroll.
  const fitShadow = (target, reach) => {
    const half = clamp(reach * SHADOW_REACH_FACTOR, SHADOW_HALF_MIN, SHADOW_HALF_MAX);
    if (half !== shadowHalf) {
      shadowHalf = half;
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
      sun.shadow.camera.updateProjectionMatrix();
    }
    const texel = (2 * half) / SHADOW_MAP_SIZE;
    const right = target.dot(lightRight);
    const up = target.dot(lightUp);
    snapped
      .copy(target)
      .addScaledVector(lightRight, Math.round(right / texel) * texel - right)
      .addScaledVector(lightUp, Math.round(up / texel) * texel - up);
    sun.target.position.copy(snapped);
    sun.position.copy(snapped).add(SUN_OFFSET);
  };
  const place = (p) => {
    update(p);
    rig.place(p);
    if (shadows) fitShadow(rig.target, rig.reach);
  };

  return {
    /**
     * Prepara tudo antes do primeiro quadro visível: compila os shaders em paralelo (sem travar a
     * página) e desenha um quadro com todas as peças à mostra, para subir geometrias e texturas e
     * compilar as variantes da passada de sombra. Sem isso, a primeira vez que cada peça aparece
     * (herói, palete, caminhão) trava o scroll.
     */
    compile() {
      place(0);
      return renderer.compileAsync(scene, camera).then(() => {
        // sem frustum culling, para subir também o que está fora do primeiro enquadramento
        const culled = [];
        scene.traverse((object) => {
          object.visible = true;
          if (object.frustumCulled) {
            object.frustumCulled = false;
            culled.push(object);
          }
        });
        renderer.render(scene, camera);
        for (const object of culled) object.frustumCulled = true;
        applyShadowState();
        place(0);
      });
    },

    /** Desenha o quadro do progresso `p` (0…1). */
    render(p) {
      place(clamp(p));
      renderer.render(scene, camera);
    },

    /** Tamanho em pixels CSS; o enquadramento depende da proporção. Não desenha. */
    resize(width, height) {
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      rig.resize(width, height);
    },

    setPixelRatio(value) {
      renderer.setPixelRatio(value);
    },

    /**
     * Liga/desliga a sombra em tempo real (as sombras falsas continuam). Não recompila shaders: só
     * a passada de sombra e o piso que a recebe saem do quadro, então serve para aliviar um aparelho
     * que já está lento. Cenas criadas com `mobile` nascem sem sombra e ficam assim.
     */
    setShadows(on) {
      if (mobile) return;
      shadows = Boolean(on);
      renderer.shadowMap.autoUpdate = shadows;
      renderer.shadowMap.needsUpdate = shadows;
      applyShadowState();
    },

    /** Contexto restaurado: reenvia as texturas desenhadas à GPU. */
    restore() {
      for (const texture of [...hero.textures, truckLogo, edgeMap]) {
        if (texture) texture.needsUpdate = true;
      }
    },

    /** Contadores do último `render` (draw calls incluem a passada de sombra). */
    stats() {
      const { render, memory } = renderer.info;
      return {
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
      };
    },

    dispose() {
      scene.traverse((object) => object.geometry?.dispose());
      for (const resource of disposables) resource?.dispose?.();
      scraps.dispose();
      sun.shadow.dispose(); // o mapa de sombra é um render target da luz, não do renderer
      renderer.dispose();
    },
  };
}
