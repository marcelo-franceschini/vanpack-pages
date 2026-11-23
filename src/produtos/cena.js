// Vitrine dos produtos: um renderer só (no worker, em OffscreenCanvas) para os cartões. Cada modelo
// gira em torno do eixo vertical, como a caixa na mesa giratória do 3D principal, com a mesma câmera de
// três quartos, a mesma luz, o piso que esmaece no Papel e uma sombra falsa (sem sombra em tempo real).
// Seguro para Web Worker: não acessa DOM.
import {
  DirectionalLight,
  HemisphereLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { CAMERA_DIRECTION } from '../scene/constants.js';

// O fundo e o piso do 3D têm o tom do cartão do produto (--tint em index.html): a peça fica solta no cartão, sem moldura; só a sombra falsa marca o chão.
const BACKDROP = '#ece9e3';
import { fadedFloor, softRects } from '../scene/geometry.js';
import { MODELOS } from './modelos.js';

const FOV = 22; // o mesmo do 3D principal em paisagem (src/scene/camera.js)
// Luz: os mesmos valores do 3D principal (src/scene/index.js, que não os exporta).
const SKY = 0xffffff;
const GROUND = 0xd9d2c4;
const SUN = 0xfff6ec;
const SUN_OFFSET = new Vector3(-4.5, 9, 6);
const FILL = 0.86; // fração da tela que o modelo pode ocupar em qualquer ângulo da volta
const SAMPLES = 24; // pontos do cilindro que envolve o modelo, para o enquadramento

/**
 * @param {OffscreenCanvas | HTMLCanvasElement} canvas
 */
export function createVitrine(canvas) {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'low-power', // não acorda a placa de vídeo dedicada para uma peça girando
  });
  renderer.setPixelRatio(1); // os tamanhos já chegam em pixels do aparelho
  renderer.setClearColor(BACKDROP);
  renderer.debug.checkShaderErrors = import.meta.env.MODE !== 'production';

  const scene = new Scene();
  scene.add(new HemisphereLight(SKY, GROUND, 2.0));
  const sun = new DirectionalLight(SUN, 2.1);
  sun.position.copy(SUN_OFFSET);
  scene.add(sun, sun.target);

  const floorGeometry = fadedFloor(3.2, 3.2, 1.2, BACKDROP, BACKDROP);
  const floorMaterial = new MeshBasicMaterial({ vertexColors: true });
  scene.add(new Mesh(floorGeometry, floorMaterial));
  const blobMaterial = new MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });
  const spin = new Group();
  scene.add(spin);

  const camera = new PerspectiveCamera(FOV, 1, 0.1, 20);
  const back = new Vector3(...CAMERA_DIRECTION).normalize();
  const right = new Vector3(0, 1, 0).cross(back).normalize();
  const up = new Vector3().crossVectors(back, right);
  const point = new Vector3();

  /** @type {Map<number, ReturnType<typeof build>>} */
  const shown = new Map();

  function build(name) {
    const disposables = [];
    const track = (resource) => {
      if (resource) disposables.push(resource);
      return resource;
    };
    const model = MODELOS[name](track);
    const [x0, x1, z0, z1] = model.footprint;
    const blob = new Mesh(track(softRects([[x0, x1, z0, z1, 0.06, 0.3]])), blobMaterial);
    blob.position.y = 0.003;
    model.group.add(blob);
    return { ...model, disposables, framing: null };
  }

  // Distância e alvo para o cilindro que envolve o modelo caber na tela em qualquer ângulo da volta.
  function fit(model, aspect) {
    const tanV = Math.tan((FOV * Math.PI) / 360) * FILL;
    const tanH = tanV * aspect;
    const target = new Vector3(0, model.top / 2, 0);
    const points = [];
    for (let i = 0; i < SAMPLES; i++) {
      const a = (2 * Math.PI * i) / SAMPLES;
      for (const y of [0, model.top]) {
        points.push([model.radius * Math.cos(a), y, model.radius * Math.sin(a)]);
      }
    }
    const distance = () => {
      let d = 0;
      for (const [x, y, z] of points) {
        point.set(x, y, z).sub(target);
        const depth = point.dot(back);
        d = Math.max(
          d,
          depth + Math.abs(point.dot(right)) / tanH,
          depth + Math.abs(point.dot(up)) / tanV,
        );
      }
      return d;
    };
    // duas passadas: a segunda centraliza na vertical o que a perspectiva deslocou
    let d = distance();
    let low = Infinity;
    let high = -Infinity;
    for (const [x, y, z] of points) {
      point.set(x, y, z).sub(target);
      const slope = point.dot(up) / (d - point.dot(back));
      low = Math.min(low, slope);
      high = Math.max(high, slope);
    }
    target.addScaledVector(up, ((low + high) / 2) * d);
    d = distance();
    return { aspect, target, distance: d };
  }

  function place(model, aspect) {
    if (model.framing?.aspect !== aspect) model.framing = fit(model, aspect);
    const { target, distance } = model.framing;
    camera.aspect = aspect;
    camera.near = Math.max(0.05, distance - 2 * model.radius - 1);
    camera.far = distance + 4;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(back, distance);
    camera.lookAt(target);
  }

  return {
    /** Monta o modelo `name` (caixa-normal, corte-e-vinco, divisorias ou chapas) para o cartão `id`. */
    add(id, name) {
      if (!shown.has(id)) shown.set(id, build(name));
    },

    /** Libera geometria, materiais e texturas do modelo do cartão `id`. */
    remove(id) {
      const model = shown.get(id);
      if (!model) return;
      model.group.removeFromParent();
      for (const resource of model.disposables) resource.dispose();
      shown.delete(id);
    },

    /** Desenha o modelo do cartão `id` em `width` × `height` pixels, girado em `yaw`. */
    render(id, width, height, yaw) {
      const model = shown.get(id);
      if (!model || !width || !height) return false;
      if (canvas.width !== width || canvas.height !== height)
        renderer.setSize(width, height, false);
      spin.clear();
      spin.add(model.group);
      spin.rotation.y = yaw;
      place(model, width / height);
      renderer.render(scene, camera);
      return true;
    },

    /** Contexto restaurado: reenvia as texturas desenhadas à GPU. */
    restore() {
      for (const model of shown.values()) {
        for (const texture of model.textures) texture.needsUpdate = true;
      }
    },

    /** Contadores do último `render` e o que está na GPU. */
    stats() {
      const { render, memory, programs } = renderer.info;
      return {
        calls: render.calls,
        triangles: render.triangles,
        geometries: memory.geometries,
        textures: memory.textures,
        programs: programs?.length ?? 0,
        models: shown.size,
      };
    },

    /** Libera tudo e devolve o contexto WebGL ao navegador. */
    dispose() {
      for (const id of [...shown.keys()]) this.remove(id);
      floorGeometry.dispose();
      floorMaterial.dispose();
      blobMaterial.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
