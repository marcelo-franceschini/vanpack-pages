import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  ShadowMaterial,
} from 'three';
import { createContactShadowTexture } from '../../engine/environment';
import type { CardboardPalette } from '../../engine/materials';
import { BOX, LAYOUT } from './constants';
import { createPlinthShadow, type FactoryMaterials } from './geometry';

export interface StudioFloorAndPalletRig {
  environmentGroup: Group;
  turntable: Group;
  palletGroup: Group;
  straps: Mesh[];
  heroSlotLocal: [number, number, number];
  disposeExtra: () => void;
}

/**
 * Builds the seamless shadow-receiving studio floor (`ShadowMaterial` at 16% opacity matching
 * `docs/notas-de-integracao-v4.md`), chamfered circular staging turntable, oak pallet with stacked
 * branded corrugated cartons, and animated Forest-green PP strapping bands.
 */
export function createStudioAndPallet(
  mats: FactoryMaterials,
  cardboard: CardboardPalette,
): StudioFloorAndPalletRig {
  const environmentGroup = new Group();

  // Seamless shadow-only studio floor (16% soft architectural shadow directly on `#F2EDE3` paper)
  const shadowFloor = new Mesh(new PlaneGeometry(140, 140), new ShadowMaterial({ opacity: 0.16 }));
  shadowFloor.rotation.x = -Math.PI * 0.5;
  shadowFloor.position.y = 0;
  shadowFloor.receiveShadow = true;
  environmentGroup.add(shadowFloor);

  // Soft circular contact shadow beneath staging turntable
  const discShadowTex = createContactShadowTexture();
  const discShadowMat = new MeshBasicMaterial({
    map: discShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.9,
  });
  const ttShadow = new Mesh(new PlaneGeometry(2.85, 2.85), discShadowMat);
  ttShadow.rotation.x = -Math.PI * 0.5;
  ttShadow.position.set(LAYOUT.stageX, 0.003, 0);
  environmentGroup.add(ttShadow);

  // Circular architectural staging turntable (`mesa giratória` for Chapter 4)
  const turntable = new Group();
  turntable.position.set(LAYOUT.stageX, 0, 0);

  const ttSkirt = new Mesh(new CylinderGeometry(1.1, 1.15, 0.14, 36), mats.charcoal);
  ttSkirt.position.y = 0.07;
  turntable.add(ttSkirt);

  const ttBase = new Mesh(new CylinderGeometry(1.03, 1.03, 0.44, 36), mats.creamSide);
  ttBase.position.y = 0.36;
  turntable.add(ttBase);

  const ttGroove = new Mesh(new CylinderGeometry(1.01, 1.01, 0.04, 36), mats.creamRecess);
  ttGroove.position.y = 0.6;
  turntable.add(ttGroove);

  const ttDisc = new Mesh(new CylinderGeometry(1.06, 1.08, 0.09, 36), mats.cream);
  ttDisc.position.y = LAYOUT.beltY - 0.045;
  turntable.add(ttDisc);

  environmentGroup.add(turntable);

  // Wooden Pallet + 7 Pre-Stacked Branded Corrugated Cartons (leaving open slot for Hero Box)
  const palletGroup = new Group();
  palletGroup.position.set(LAYOUT.palletX, 0.02, 0);

  const palletW = BOX.length * 2 + 0.2;
  const palletD = BOX.width * 2 + 0.2;
  const palletH = 0.18;

  const palletShadow = createPlinthShadow(palletW + 0.5, palletD + 0.5, mats);
  palletShadow.position.y = -0.015;
  palletGroup.add(palletShadow);

  const plankGeo = new BoxGeometry(palletW, 0.036, 0.24);
  for (let i = -2; i <= 2; i++) {
    const plank = new Mesh(plankGeo, mats.wood);
    plank.position.set(0, palletH - 0.018, i * 0.42);
    palletGroup.add(plank);
  }
  const runnerGeo = new BoxGeometry(palletW - 0.08, 0.12, 0.14);
  for (const z of [-0.84, 0, 0.84]) {
    const runner = new Mesh(runnerGeo, mats.woodDark);
    runner.position.set(0, 0.07, z);
    palletGroup.add(runner);
  }
  const bottomSlatGeo = new BoxGeometry(palletW, 0.024, 0.2);
  for (const z of [-0.84, 0, 0.84]) {
    const slat = new Mesh(bottomSlatGeo, mats.wood);
    slat.position.set(0, 0.012, z);
    palletGroup.add(slat);
  }

  const stackedGeo = new BoxGeometry(BOX.length * 0.98, BOX.height * 0.98, BOX.width * 0.98);
  const stackedMats = [
    cardboard.outer,
    cardboard.outer,
    cardboard.outer,
    cardboard.inner,
    cardboard.printed,
    cardboard.printed,
  ];
  const seamGeo = new BoxGeometry(BOX.length * 0.982, 0.008, 0.022);

  const colX = [-BOX.length * 0.51, BOX.length * 0.51];
  const rowZ = [-BOX.width * 0.51, BOX.width * 0.51];
  const heroSlotLocal: [number, number, number] = [colX[0], palletH + BOX.height, rowZ[1]];

  for (let layer = 0; layer < 2; layer++) {
    for (let cx = 0; cx < 2; cx++) {
      for (let rz = 0; rz < 2; rz++) {
        if (layer === 1 && cx === 0 && rz === 1) continue;
        const box = new Mesh(stackedGeo, stackedMats);
        const bx = colX[cx];
        const by = palletH + BOX.height * 0.49 + layer * BOX.height;
        const bz = rowZ[rz];
        box.position.set(bx, by, bz);
        palletGroup.add(box);

        // Crisp center top-flap seam line on upper layer boxes
        if (layer === 1) {
          const seam = new Mesh(seamGeo, cardboard.crease);
          seam.position.set(bx, by + BOX.height * 0.49 + 0.002, bz);
          palletGroup.add(seam);
        }
      }
    }
  }

  // Forest-green PP strapping bands tightening cleanly around the finished pallet
  const straps: Mesh[] = [];
  const stackH = BOX.height * 2 + 0.04;
  const strapSideGeo = new BoxGeometry(0.055, stackH, 0.025);
  const strapTopGeo = new BoxGeometry(0.055, 0.025, palletD - 0.14);
  for (const sx of [-BOX.length * 0.52, BOX.length * 0.52]) {
    const strap = new Group();
    const frontBand = new Mesh(strapSideGeo, mats.strap);
    frontBand.position.set(0, 0, (palletD - 0.16) * 0.5);
    const backBand = new Mesh(strapSideGeo, mats.strap);
    backBand.position.set(0, 0, -(palletD - 0.16) * 0.5);
    const topBand = new Mesh(strapTopGeo, mats.strap);
    topBand.position.set(0, stackH * 0.5, 0);
    strap.add(frontBand, backBand, topBand);
    strap.position.set(sx, palletH + stackH * 0.5, 0);
    strap.scale.set(1, 0.01, 1);
    strap.visible = false;
    palletGroup.add(strap);
    straps.push(strap as unknown as Mesh);
  }

  environmentGroup.add(palletGroup);

  return {
    environmentGroup,
    turntable,
    palletGroup,
    straps,
    heroSlotLocal,
    disposeExtra() {
      discShadowMat.dispose();
      discShadowTex.dispose();
    },
  };
}
