import { BoxGeometry, Group, Mesh } from 'three';
import type { CardboardPalette } from '../../engine/materials';
import { BOX, LAYOUT } from './constants';

export interface HeroCartonRig {
  /** Flat plain corrugated kraft sheet gliding from feeder stack into Machine A. */
  plainSheet: Mesh;
  /** Printed & die-cut flat/folding blank emerging from Machine A through Machine B (chapters 2 & 3). */
  dieCutBlank: Group;
  blankWingFront: Group;
  blankWingBack: Group;
  /** Articulated custom-printed RSC carton (chapters 4 & 5: turntable -> pallet -> truck). */
  carton: Group;
  setFlapClosure: (closed: number) => void;
}

/**
 * Builds the 3 lifecycle stages of the corrugated box:
 * 1. Plain kraft sheet on feeder stack (Chapter 1)
 * 2. Printed & creased die-cut blank that folds 90° in Machine B (Chapters 2–3)
 * 3. Erected custom-printed RSC carton on turntable & pallet (Chapters 4–5)
 */
export function createHeroCarton(cardboard: CardboardPalette): HeroCartonRig {
  const { length: L, width: W, height: H, wall: T } = BOX;

  // 1. Plain kraft corrugated sheet feeding into Machine A
  const plainSheet = new Mesh(new BoxGeometry(1.56, 0.045, 1.08), [
    cardboard.edge,
    cardboard.edge,
    cardboard.outer,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
  ]);
  plainSheet.position.set(LAYOUT.feederX, 1.18, 0);

  // 2. Printed & creased blank emerging from Machine A and folding 90° in Machine B
  const dieCutBlank = new Group();
  const centerPanel = new Mesh(new BoxGeometry(L, T, W * 0.72), [
    cardboard.edge,
    cardboard.edge,
    cardboard.printed,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
  ]);
  centerPanel.position.y = T * 0.5;
  dieCutBlank.add(centerPanel);

  const wingGeo = new BoxGeometry(L * 0.96, T, W * 0.42);
  const wingMats = [
    cardboard.edge,
    cardboard.edge,
    cardboard.outer,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
  ];

  const blankWingFront = new Group();
  blankWingFront.position.set(0, T * 0.5, W * 0.36);
  const wfMesh = new Mesh(wingGeo, wingMats);
  wfMesh.position.set(0, 0, W * 0.21);
  blankWingFront.add(wfMesh);
  dieCutBlank.add(blankWingFront);

  const blankWingBack = new Group();
  blankWingBack.position.set(0, T * 0.5, -W * 0.36);
  const wbMesh = new Mesh(wingGeo, wingMats);
  wbMesh.position.set(0, 0, -W * 0.21);
  blankWingBack.add(wbMesh);
  dieCutBlank.add(blankWingBack);
  dieCutBlank.visible = false;

  // 3. Articulated Hero RSC Box (origin at center of base)
  const carton = new Group();

  const bottom = new Mesh(new BoxGeometry(L, T, W), [
    cardboard.edge,
    cardboard.edge,
    cardboard.inner,
    cardboard.outer,
    cardboard.edge,
    cardboard.edge,
  ]);
  bottom.position.y = T * 0.5;
  carton.add(bottom);

  // Front & back long walls with crisp Forest "SUA MARCA" print
  const longWallGeo = new BoxGeometry(L, H, T);
  const frontWall = new Mesh(longWallGeo, [
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
    cardboard.printed,
    cardboard.inner,
  ]);
  frontWall.position.set(0, H * 0.5, W * 0.5 - T * 0.5);
  carton.add(frontWall);

  const backWall = new Mesh(longWallGeo, [
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
    cardboard.inner,
    cardboard.printed,
  ]);
  backWall.position.set(0, H * 0.5, -W * 0.5 + T * 0.5);
  carton.add(backWall);

  // Left & right side walls
  const sideWallGeo = new BoxGeometry(T, H, W - T * 2);
  const leftWall = new Mesh(sideWallGeo, [
    cardboard.inner,
    cardboard.outer,
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
  ]);
  leftWall.position.set(-L * 0.5 + T * 0.5, H * 0.5, 0);
  carton.add(leftWall);

  const rightWall = new Mesh(sideWallGeo, [
    cardboard.outer,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
    cardboard.edge,
  ]);
  rightWall.position.set(L * 0.5 - T * 0.5, H * 0.5, 0);
  carton.add(rightWall);

  // Hinged inner dust flaps (short sides)
  const dustLen = W * 0.44;
  const flapMats = [
    cardboard.edge,
    cardboard.edge,
    cardboard.outer,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
  ];
  const topLeft = new Group();
  topLeft.position.set(-L * 0.5 + T * 0.5, H, 0);
  const leftFlapMesh = new Mesh(new BoxGeometry(dustLen, T, W - T * 2.2), flapMats);
  leftFlapMesh.position.set(dustLen * 0.5, T * 0.5, 0);
  topLeft.add(leftFlapMesh);
  carton.add(topLeft);

  const topRight = new Group();
  topRight.position.set(L * 0.5 - T * 0.5, H, 0);
  const rightFlapMesh = new Mesh(new BoxGeometry(dustLen, T, W - T * 2.2), flapMats);
  rightFlapMesh.position.set(-dustLen * 0.5, T * 0.5, 0);
  topRight.add(rightFlapMesh);
  carton.add(topRight);

  // Hinged major flaps (long sides, meet cleanly with subtle center gap when closed)
  const majorDepth = W * 0.485;
  const majorGeo = new BoxGeometry(L - 0.01, T, majorDepth);

  const topFront = new Group();
  topFront.position.set(0, H + T * 0.65, W * 0.5 - T * 0.5);
  const frontFlapMesh = new Mesh(majorGeo, flapMats);
  frontFlapMesh.position.set(0, T * 0.5, -majorDepth * 0.5);
  topFront.add(frontFlapMesh);
  carton.add(topFront);

  const topBack = new Group();
  topBack.position.set(0, H + T * 0.65, -W * 0.5 + T * 0.5);
  const backFlapMesh = new Mesh(majorGeo, flapMats);
  backFlapMesh.position.set(0, T * 0.5, majorDepth * 0.5);
  topBack.add(backFlapMesh);
  carton.add(topBack);

  const setFlapClosure = (closed: number) => {
    const innerT = Math.min(1, closed * 1.35);
    const outerT = Math.max(0, Math.min(1, (closed - 0.22) / 0.78));
    topLeft.rotation.z = (1 - innerT) * 1.85;
    topRight.rotation.z = -(1 - innerT) * 1.85;
    topFront.rotation.x = (1 - outerT) * 2.05;
    topBack.rotation.x = -(1 - outerT) * 2.05;
  };

  setFlapClosure(0.25);
  carton.visible = false;

  return { plainSheet, dieCutBlank, blankWingFront, blankWingBack, carton, setFlapClosure };
}
