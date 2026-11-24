import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import type { CardboardPalette } from '../../engine/materials';
import { LAYOUT } from './constants';
import { createChamferedBox, createPlinthShadow, type FactoryMaterials } from './geometry';

export interface ProductionLineRig {
  group: Group;
  rollerHubsA: Group[];
  rollerHubsB: Group[];
  scraps: Mesh[];
  lamp: Mesh;
  glueBead: Mesh;
}

/** Builds a spinning cylinder hub with crisp `+` cross spokes (matching `public/og.jpg`). */
function createCylinderHub(
  radius: number,
  length: number,
  isForest: boolean,
  mats: FactoryMaterials,
): Group {
  const g = new Group();
  const drum = new Mesh(
    new CylinderGeometry(radius, radius, length, 22),
    isForest ? mats.forest : mats.steel,
  );
  drum.rotation.x = Math.PI * 0.5;
  g.add(drum);

  // Subtle metallic axle endcap ring
  const cap = new Mesh(
    new CylinderGeometry(radius * 0.96, radius * 0.96, 0.016, 22),
    isForest ? mats.forest : mats.creamSide,
  );
  cap.rotation.x = Math.PI * 0.5;
  cap.position.z = length * 0.5 + 0.004;
  g.add(cap);

  // Crisp `+` cross spokes on the front (+Z) inspection window face
  const bar1 = new Mesh(new BoxGeometry(radius * 1.48, 0.034, 0.018), mats.charcoal);
  bar1.position.z = length * 0.5 + 0.015;
  g.add(bar1);

  const bar2 = new Mesh(new BoxGeometry(0.034, radius * 1.48, 0.018), mats.charcoal);
  bar2.position.z = length * 0.5 + 0.015;
  g.add(bar2);

  return g;
}

/** Builds the sleek thin-rail wire conveyor bridge seen in `public/og.jpg`. */
function createWireConveyor(
  xStart: number,
  xEnd: number,
  y: number,
  mats: FactoryMaterials,
): Group {
  const g = new Group();
  const len = xEnd - xStart;
  const cx = (xStart + xEnd) * 0.5;

  // 4 slim parallel charcoal wire guide rails
  const railGeo = new BoxGeometry(len, 0.026, 0.034);
  for (const z of [-0.62, -0.21, 0.21, 0.62]) {
    const rail = new Mesh(railGeo, mats.charcoal);
    rail.position.set(cx, y, z);
    g.add(rail);
  }

  // Sleek cross tie bars underneath rails
  const tieGeo = new BoxGeometry(0.036, 0.028, 1.38);
  const ties = len > 2.2 ? [xStart + 0.25, cx, xEnd - 0.25] : [xStart + 0.22, xEnd - 0.22];
  for (const tx of ties) {
    const tie = new Mesh(tieGeo, mats.charcoal);
    tie.position.set(tx, y - 0.02, 0);
    g.add(tie);
  }

  return g;
}

/**
 * Faithfully recreates the original Vanpack v4 architectural miniature production line from
 * `public/og.jpg` & `docs/notas-de-integracao-v4.md` while applying the tactile Kraft grain
 * and crisp sinusoidal corrugated flute edge texture to all cardboard sheets and scraps:
 * - Chamfered feeder plinth with grounded contact shadow, 4 slim guide pins & corrugated stack
 * - Twin dark rubber infeed rollers + ultra-slim wire guide rails
 * - Machine A: chamfered charcoal skirt, stepped ivory-cream cornice moldings, Forest-green
 *   lower trim bar, dual recessed inspection windows with rotating `+` cross cylinders (Forest
 *   print sleeve + steel die-cutters), upper display bezel + lower louvered vent, roof signal
 *   beacon (amber -> emerald), and charcoal scrap collection bin
 * - Machine B: sleek chamfered ivory folder-gluer tower with beveled charcoal cap, recessed
 *   Forest-green side panel, internal rollers, and glue applicator bead
 */
export function createProductionLine(
  mats: FactoryMaterials,
  cardboard: CardboardPalette,
): ProductionLineRig {
  const group = new Group();
  const rollerHubsA: Group[] = [];
  const rollerHubsB: Group[] = [];
  const scraps: Mesh[] = [];

  // 1. Feeder Table with Chamfered Plinth, 4 Slim Guide Pins & Tall Corrugated Stack (`public/og.jpg`)
  const feeder = new Group();
  feeder.position.set(LAYOUT.feederX, 0, 0);

  feeder.add(createPlinthShadow(2.75, 2.22, mats));

  const feederSkirt = new Mesh(createChamferedBox(2.26, 0.14, 1.78, 0.12, 0.02), mats.charcoal);
  feederSkirt.position.y = 0.07;
  feeder.add(feederSkirt);

  const feederBase = new Mesh(createChamferedBox(2.12, 0.4, 1.64, 0.1, 0.02), mats.creamSide);
  feederBase.position.y = 0.34;
  feeder.add(feederBase);

  const feederTop = new Mesh(createChamferedBox(2.16, 0.07, 1.68, 0.1, 0.014), mats.cream);
  feederTop.position.y = 0.565;
  feeder.add(feederTop);

  // Stack of 12 corrugated kraft sheets (keeping our tactile Kraft grain + crisp corrugated flute edges!)
  const sheetGeo = new BoxGeometry(1.52, 0.044, 1.02);
  const sheetMats = [
    cardboard.edge,
    cardboard.edge,
    cardboard.outer,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
  ];
  for (let i = 0; i < 12; i++) {
    const s = new Mesh(sheetGeo, sheetMats);
    s.position.set(0, 0.625 + i * 0.046, 0);
    feeder.add(s);
  }

  // 4 signature slim vertical charcoal guide pins hugging the stack corners
  const pinGeo = new CylinderGeometry(0.026, 0.026, 0.78, 12);
  for (const px of [-0.72, 0.72]) {
    for (const pz of [-0.54, 0.54]) {
      const pin = new Mesh(pinGeo, mats.charcoal);
      pin.position.set(px, 0.99, pz);
      feeder.add(pin);
    }
  }
  group.add(feeder);

  // Wire conveyors connecting Feeder -> Machine A -> Machine B -> Turntable
  group.add(createWireConveyor(LAYOUT.feederX + 1.08, LAYOUT.machineAX - 1.56, LAYOUT.beltY, mats));
  group.add(
    createWireConveyor(LAYOUT.machineAX + 1.62, LAYOUT.machineBX - 1.02, LAYOUT.beltY, mats),
  );
  group.add(createWireConveyor(LAYOUT.machineBX + 1.02, LAYOUT.stageX - 1.1, LAYOUT.beltY, mats));

  // 2. Machine A: Chamfered Flexographic Printer & Rotary Die-Cutter (`public/og.jpg`)
  const machineA = new Group();
  machineA.position.set(LAYOUT.machineAX, 0, 0);

  machineA.add(createPlinthShadow(3.85, 3.1, mats));

  // Heavy chamfered charcoal base skirt
  const skirtA = new Mesh(createChamferedBox(3.32, 0.16, 2.6, 0.14, 0.022), mats.charcoal);
  skirtA.position.y = 0.08;
  machineA.add(skirtA);

  // Lower chamfered cream pedestal with recessed Vanpack Forest-green horizontal accent stripe
  const lowerA = new Mesh(createChamferedBox(3.16, 0.42, 2.44, 0.11, 0.02), mats.creamSide);
  lowerA.position.y = 0.37;
  machineA.add(lowerA);

  const forestStripeA = new Mesh(new BoxGeometry(2.58, 0.125, 0.04), mats.forest);
  forestStripeA.position.set(0, 0.33, 1.215);
  machineA.add(forestStripeA);

  // Signature protruding chamfered horizontal waist band below cylinder windows (`public/og.jpg`)
  const waistA = new Mesh(createChamferedBox(3.24, 0.09, 2.52, 0.11, 0.016), mats.cream);
  waistA.position.y = 0.61;
  machineA.add(waistA);

  // Twin dark rubber infeed rollers protruding at the -X entrance throat (`public/og.jpg`)
  const infeedDrumGeo = new CylinderGeometry(0.115, 0.115, 1.98, 18);
  infeedDrumGeo.rotateX(Math.PI * 0.5);
  for (const ry of [0.68, 0.91]) {
    const roller = new Mesh(infeedDrumGeo, mats.charcoalSoft);
    roller.position.set(-1.66, ry, 0);
    machineA.add(roller);
  }
  const infeedGuard = new Mesh(new BoxGeometry(0.18, 0.34, 2.18), mats.charcoal);
  infeedGuard.position.set(-1.58, 0.79, 0);
  machineA.add(infeedGuard);

  // Mid recessed dark charcoal roller bay housing
  const midCoreA = new Mesh(new BoxGeometry(2.96, 0.76, 2.16), mats.charcoal);
  midCoreA.position.y = 1.03;
  machineA.add(midCoreA);

  // Cream central vertical fascia between the 2 inspection windows (hides sheet -> hero blank swap!)
  const midBridgeA = new Mesh(new BoxGeometry(0.98, 0.79, 2.44), mats.cream);
  midBridgeA.position.set(0.02, 1.03, 0);
  machineA.add(midBridgeA);

  // Upper crisp recessed nameplate/display panel on central fascia (`public/og.jpg`)
  const plateFrame = new Mesh(new BoxGeometry(0.8, 0.3, 0.03), mats.creamRecess);
  plateFrame.position.set(0.02, 1.18, 1.215);
  machineA.add(plateFrame);
  const plateFace = new Mesh(new BoxGeometry(0.74, 0.24, 0.025), mats.cream);
  plateFace.position.set(0.02, 1.18, 1.228);
  machineA.add(plateFace);

  // Lower horizontal louvered ventilation panel on central fascia (`public/og.jpg`)
  const louverBg = new Mesh(new BoxGeometry(0.78, 0.28, 0.03), mats.creamRecess);
  louverBg.position.set(0.02, 0.82, 1.215);
  machineA.add(louverBg);
  const louverBarGeo = new BoxGeometry(0.66, 0.018, 0.032);
  for (let i = 0; i < 6; i++) {
    const bar = new Mesh(louverBarGeo, mats.steelDark);
    bar.position.set(0.02, 0.72 + i * 0.038, 1.228);
    machineA.add(bar);
  }

  // Front framing chamfered corner pillars left & right
  const pillarGeo = createChamferedBox(0.24, 0.79, 2.44, 0.06, 0.012);
  for (const px of [-1.46, 1.46]) {
    const pillar = new Mesh(pillarGeo, mats.creamSide);
    pillar.position.set(px, 1.03, 0);
    machineA.add(pillar);
  }

  // Subtle cornice groove + clean overhanging chamfered ivory roof slab (`public/og.jpg`)
  const corniceA = new Mesh(createChamferedBox(3.12, 0.06, 2.42, 0.1, 0.01), mats.creamRecess);
  corniceA.position.y = 1.44;
  machineA.add(corniceA);

  const roofA = new Mesh(createChamferedBox(3.26, 0.22, 2.54, 0.12, 0.022), mats.cream);
  roofA.position.y = 1.56;
  machineA.add(roofA);

  // Exposed rotating cylinders in the 2 front windows (left: Forest print sleeve, right: steel die-cutter)
  const cylPositions: readonly [number, number, boolean][] = [
    [-0.88, 1.19, true],
    [-0.88, 0.82, false],
    [0.92, 1.19, false],
    [0.92, 0.82, false],
  ];
  for (const [cx, cy, isForest] of cylPositions) {
    const hub = createCylinderHub(0.168, 2.38, isForest, mats);
    hub.position.set(cx, cy, 0);
    machineA.add(hub);
    rollerHubsA.push(hub);
  }

  // Signature roof signal beacon (amber -> emerald on blank exit, exact `public/og.jpg` placement)
  const mastBase = new Mesh(new CylinderGeometry(0.055, 0.062, 0.035, 14), mats.charcoal);
  mastBase.position.set(-1.02, 1.685, 0.84);
  machineA.add(mastBase);

  const mast = new Mesh(new CylinderGeometry(0.026, 0.026, 0.36, 12), mats.charcoal);
  mast.position.set(-1.02, 1.86, 0.84);
  machineA.add(mast);

  const lamp = new Mesh(new CylinderGeometry(0.068, 0.068, 0.15, 18), mats.lamp);
  lamp.position.set(-1.02, 2.09, 0.84);
  machineA.add(lamp);

  const lampCap = new Mesh(new CylinderGeometry(0.072, 0.072, 0.032, 18), mats.charcoal);
  lampCap.position.set(-1.02, 2.18, 0.84);
  machineA.add(lampCap);

  // Chamfered charcoal scrap collection bin tucked at Machine A's +X/+Z exit (`public/og.jpg`)
  const bin = new Mesh(createChamferedBox(0.76, 0.44, 0.88, 0.07, 0.015), mats.charcoalSoft);
  bin.position.set(1.88, 0.22, 0.56);
  machineA.add(bin);
  const binRim = new Mesh(createChamferedBox(0.8, 0.05, 0.92, 0.07, 0.01), mats.charcoal);
  binRim.position.set(1.88, 0.45, 0.56);
  machineA.add(binRim);

  // Die-cut corrugated cardboard scraps fluttering into the bin during Chapter 2
  const scrapGeo = new BoxGeometry(0.18, 0.026, 0.14);
  const scrapMats = [
    cardboard.edge,
    cardboard.edge,
    cardboard.outer,
    cardboard.inner,
    cardboard.edge,
    cardboard.edge,
  ];
  for (let i = 0; i < 6; i++) {
    const scrap = new Mesh(scrapGeo, scrapMats);
    scrap.position.set(
      LAYOUT.machineAX + 1.56 + (i - 2.5) * 0.09,
      LAYOUT.beltY,
      0.5 + (i % 2 ? 0.1 : -0.1),
    );
    scrap.visible = false;
    group.add(scrap);
    scraps.push(scrap);
  }

  group.add(machineA);

  // 3. Machine B: Sleek Chamfered Automatic Folder-Gluer (matching top-right of `public/og.jpg`)
  const machineB = new Group();
  machineB.position.set(LAYOUT.machineBX, 0, 0);

  machineB.add(createPlinthShadow(2.55, 2.38, mats));

  const skirtB = new Mesh(createChamferedBox(2.08, 0.14, 1.98, 0.1, 0.02), mats.charcoal);
  skirtB.position.y = 0.07;
  machineB.add(skirtB);

  const lowerB = new Mesh(createChamferedBox(1.96, 0.44, 1.86, 0.09, 0.016), mats.creamSide);
  lowerB.position.y = 0.36;
  machineB.add(lowerB);

  // Twin side walls forming a clear open pass-through tunnel so blank folding is clearly visible
  const sideWallBGeo = createChamferedBox(1.94, 0.96, 0.32, 0.06, 0.014);
  for (const side of [-1, 1]) {
    const w = new Mesh(sideWallBGeo, mats.creamSide);
    w.position.set(0, 1.04, side * 0.77);
    machineB.add(w);
  }

  // Signature recessed Vanpack Forest-green rectangular accent panel on Machine B's front (+Z) wall
  const greenPanelFrameB = new Mesh(new BoxGeometry(1.34, 0.4, 0.03), mats.creamRecess);
  greenPanelFrameB.position.set(0, 0.96, 0.922);
  machineB.add(greenPanelFrameB);

  const greenPanelB = new Mesh(new BoxGeometry(1.26, 0.32, 0.032), mats.forest);
  greenPanelB.position.set(0, 0.96, 0.934);
  machineB.add(greenPanelB);

  // Clean chamfered ivory cornice + signature beveled charcoal top cap (`public/og.jpg` top-right!)
  const roofB = new Mesh(createChamferedBox(2.0, 0.12, 1.9, 0.09, 0.016), mats.cream);
  roofB.position.y = 1.56;
  machineB.add(roofB);

  const capB = new Mesh(createChamferedBox(1.92, 0.14, 1.78, 0.09, 0.02), mats.charcoal);
  capB.position.y = 1.68;
  machineB.add(capB);

  // Internal chrome folding rollers
  for (const dx of [-0.46, 0.46]) {
    const hub = createCylinderHub(0.125, 1.44, false, mats);
    hub.position.set(dx, LAYOUT.beltY + 0.2, 0);
    machineB.add(hub);
    rollerHubsB.push(hub);
  }

  // Overhead glue applicator head + crisp white PVA glue bead visible during Chapter 3 (`p ≈ 0.50`)
  const glueHead = new Mesh(new BoxGeometry(0.18, 0.24, 0.16), mats.charcoal);
  glueHead.position.set(0.32, LAYOUT.beltY + 0.38, 0.42);
  machineB.add(glueHead);

  const glueBead = new Mesh(new BoxGeometry(0.95, 0.034, 0.04), mats.glue);
  glueBead.position.set(LAYOUT.machineBX + 0.72, LAYOUT.beltY + 0.08, 0.42);
  glueBead.visible = false;
  group.add(glueBead);

  group.add(machineB);

  return { group, rollerHubsA, rollerHubsB, scraps, lamp, glueBead };
}
