import { Color, PerspectiveCamera, Scene, type WebGLRenderer } from 'three';
import { createDioramaLights } from '../../engine/environment';
import { createCardboardPalette } from '../../engine/materials';
import { updateFactoryCamera } from './camera';
import { PAPER_BG } from './constants';
import { createStudioAndPallet } from './factory';
import { createFactoryMaterials, disposeGeometries, setShadows } from './geometry';
import { createHeroCarton } from './hero';
import { createProductionLine } from './machine';
import { applyFactoryTimeline, type FactoryTimelineRig } from './timeline';
import { createDeliveryTruck } from './truck';

export interface FactorySceneOptions {
  renderer: WebGLRenderer;
  shadows: boolean;
}

export interface FactorySceneHandle {
  scene: Scene;
  camera: PerspectiveCamera;
  resize: (width: number, height: number, mobile: boolean) => void;
  update: (progress: number, idleTime: number, mobile: boolean) => void;
  dispose: () => void;
}

/**
 * Assembles the canonical Vanpack architectural miniature diorama 3D factory scene
 * (`FOV 22`, warm paper `#F2EDE3`, crisp 16% shadows, cream & charcoal machines, 5 chapters).
 */
export function createFactoryScene({ renderer, shadows }: FactorySceneOptions): FactorySceneHandle {
  const scene = new Scene();
  scene.background = new Color(PAPER_BG);

  const camera = new PerspectiveCamera(22, 16 / 9, 0.5, 120);
  createDioramaLights(scene, { shadows, shadowExtent: 15 });

  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const cardboard = createCardboardPalette(maxAnisotropy);
  const mats = createFactoryMaterials(maxAnisotropy);

  const line = createProductionLine(mats, cardboard);
  const hero = createHeroCarton(cardboard);
  const studio = createStudioAndPallet(mats, cardboard);
  const truck = createDeliveryTruck(mats);

  scene.add(
    studio.environmentGroup,
    line.group,
    hero.plainSheet,
    hero.dieCutBlank,
    hero.carton,
    truck.roadGroup,
    truck.truckGroup,
  );

  if (shadows) {
    setShadows(line.group, true, true);
    setShadows(hero.plainSheet, true, false);
    setShadows(hero.dieCutBlank, true, true);
    setShadows(hero.carton, true, true);
    setShadows(studio.turntable, true, true);
    setShadows(studio.palletGroup, true, true);
    setShadows(truck.truckGroup, true, true);
  }

  const rig: FactoryTimelineRig = { line, hero, studio, truck, mats };

  return {
    scene,
    camera,
    resize(width: number, height: number, mobile: boolean) {
      camera.aspect = width / Math.max(1, height);
      camera.fov = mobile ? 26 : 22;
      camera.updateProjectionMatrix();
    },
    update(progress: number, idleTime: number, mobile: boolean) {
      applyFactoryTimeline(rig, progress, idleTime);
      updateFactoryCamera(camera, progress, mobile, idleTime);
    },
    dispose() {
      disposeGeometries(scene);
      cardboard.dispose();
      mats.dispose();
    },
  };
}
