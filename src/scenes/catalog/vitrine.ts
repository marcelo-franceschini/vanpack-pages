import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import {
  configureRenderer,
  createContactShadowTexture,
  createDioramaLights,
  detectSoftwareGl,
  waitAfterDraw,
} from '../../engine/environment';
import { createCardboardPalette } from '../../engine/materials';
import { CAMERA_DIRECTION } from '../factory/constants';
import { disposeGeometries } from '../factory/geometry';
import { buildAllProductModels, type ProductModelId } from './models';

const STAGE_BG = 0xece9e3;
const CAM_DIR = new Vector3(
  CAMERA_DIRECTION[0],
  CAMERA_DIRECTION[1],
  CAMERA_DIRECTION[2],
).normalize();

export interface VitrineRenderer {
  readonly isSoftware: boolean;
  renderModel: (
    id: ProductModelId,
    yaw: number,
    pitch: number,
    width: number,
    height: number,
    dpr: number,
  ) => HTMLCanvasElement;
  afterDraw: (done: () => void) => void;
  dispose: () => void;
}

/**
 * Single shared WebGL renderer for all 4 interactive product catalog cards using the canonical
 * `FOV 22` isometric 3/4 camera (`CAMERA_DIRECTION`), architectural diorama lighting (`[-4.5, 9, 6]`),
 * exact brand Kraft palette, and soft radial contact shadow disc.
 */
export function createVitrineRenderer(): VitrineRenderer {
  const surface = document.createElement('canvas');
  surface.width = 400;
  surface.height = 300;

  const renderer = new WebGLRenderer({
    canvas: surface,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'default',
  });

  const gl = renderer.getContext();
  const isSoftware = detectSoftwareGl(gl);
  configureRenderer(renderer, { isSoftware, mobile: false, dpr: 1, shadows: false });

  const scene = new Scene();
  scene.background = new Color(STAGE_BG);

  const camera = new PerspectiveCamera(22, 4 / 3, 0.1, 30);
  createDioramaLights(scene, { shadows: false });

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const cardboard = createCardboardPalette(maxAniso);

  const shadowTex = createContactShadowTexture();
  const shadowMat = new MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.85,
  });
  const shadowPlane = new Mesh(new PlaneGeometry(0.76, 0.64), shadowMat);
  shadowPlane.rotation.x = -Math.PI * 0.5;
  shadowPlane.position.y = -0.002;
  scene.add(shadowPlane);

  const pivot = new Group();
  scene.add(pivot);

  const models = buildAllProductModels(cardboard);
  const allIds = Object.keys(models) as ProductModelId[];

  // Compute exact framing distance & vertical center per model so every product fills the 4:3 card crisply
  const framing = {} as Record<
    ProductModelId,
    { centerY: number; dist: number; shadowScale: number }
  >;
  const box = new Box3();
  const size = new Vector3();

  for (const id of allIds) {
    box.setFromObject(models[id]);
    box.getSize(size);
    const radius = Math.max(size.x, size.y, size.z) * 0.68;
    const dist = (radius / Math.sin((11 * Math.PI) / 180)) * 1.14;
    framing[id] = {
      centerY: (box.min.y + box.max.y) * 0.5,
      dist,
      shadowScale: Math.max(size.x, size.z) * 1.9,
    };
    models[id].visible = false;
    pivot.add(models[id]);
  }

  let curW = 0;
  let curH = 0;
  let curDpr = 0;

  return {
    isSoftware,
    renderModel(id, yaw, pitch, width, height, dpr) {
      const targetDpr = isSoftware ? 1 : Math.min(dpr, 1.5);
      const w = Math.max(64, Math.round(width));
      const h = Math.max(64, Math.round(height));
      if (w !== curW || h !== curH || targetDpr !== curDpr) {
        curW = w;
        curH = h;
        curDpr = targetDpr;
        renderer.setPixelRatio(targetDpr);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }

      for (const key of allIds) {
        models[key].visible = key === id;
      }

      const f = framing[id];
      camera.position.set(0, f.centerY, 0).addScaledVector(CAM_DIR, f.dist);
      camera.lookAt(0, f.centerY, 0);

      pivot.rotation.set(pitch, yaw, 0);
      shadowPlane.scale.setScalar(f.shadowScale);
      shadowMat.opacity = 0.85 * (1 - Math.abs(pitch) * 0.65);

      renderer.render(scene, camera);
      return surface;
    },
    afterDraw(done) {
      waitAfterDraw(gl, isSoftware, done);
    },
    dispose() {
      disposeGeometries(scene);
      shadowMat.dispose();
      shadowTex.dispose();
      cardboard.dispose();
      renderer.dispose();
    },
  };
}
