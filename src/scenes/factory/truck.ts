import { BoxGeometry, CylinderGeometry, Group, Mesh } from 'three';
import { LAYOUT } from './constants';
import { createChamferedBox, createPlinthShadow, type FactoryMaterials } from './geometry';

export interface DeliveryTruckRig {
  roadGroup: Group;
  truckGroup: Group;
  wheels: Mesh[];
  doorPanel: Mesh;
}

/**
 * Chamfered architectural miniature Vanpack delivery box truck & clean road ribbon (Chapter 5).
 * Matches the luminous ivory / charcoal / Forest-green diorama aesthetic of `public/og.jpg`.
 */
export function createDeliveryTruck(mats: FactoryMaterials): DeliveryTruckRig {
  const roadGroup = new Group();

  // Clean architectural road ribbon with subtle edge curbs & crisp dashed center lane markings
  const road = new Mesh(new BoxGeometry(44, 0.04, 4.4), mats.road);
  road.position.set(LAYOUT.truckStartX + 18.8, 0.02, 0);
  road.receiveShadow = true;
  roadGroup.add(road);

  const dashGeo = new BoxGeometry(1.25, 0.012, 0.12);
  for (let i = 0; i < 16; i++) {
    const dash = new Mesh(dashGeo, mats.roadLine);
    dash.position.set(LAYOUT.truckStartX - 1.5 + i * 2.6, 0.044, 0);
    roadGroup.add(dash);
  }

  const truckGroup = new Group();
  truckGroup.position.set(LAYOUT.truckStartX, 0.04, 0);

  const truckShadow = createPlinthShadow(7.4, 3.05, mats);
  truckShadow.position.set(0.3, 0.008, 0);
  truckGroup.add(truckShadow);

  // Chamfered steel chassis frame
  const chassis = new Mesh(createChamferedBox(6.3, 0.22, 2.02, 0.08, 0.018), mats.charcoal);
  chassis.position.set(0.25, 0.62, 0);
  truckGroup.add(chassis);

  // Ivory Box Cargo Van Body (open rear facing -X so strapped pallet glides cleanly inside)
  const boxL = 4.35;
  const boxH = 2.48;
  const boxW = 2.38;
  const wallT = 0.1;
  const cargoX = -0.65;
  const cargoBaseY = 0.76;

  const floor = new Mesh(new BoxGeometry(boxL, wallT, boxW), mats.charcoalSoft);
  floor.position.set(cargoX, cargoBaseY, 0);
  truckGroup.add(floor);

  const roof = new Mesh(createChamferedBox(boxL + 0.04, 0.12, boxW + 0.04, 0.08, 0.018), mats.cream);
  roof.position.set(cargoX, cargoBaseY + boxH, 0);
  truckGroup.add(roof);

  const frontWall = new Mesh(new BoxGeometry(wallT, boxH, boxW), mats.creamSide);
  frontWall.position.set(cargoX + boxL * 0.5 - wallT * 0.5, cargoBaseY + boxH * 0.5, 0);
  truckGroup.add(frontWall);

  const sideGeo = new BoxGeometry(boxL, boxH, wallT);
  const frontSide = new Mesh(sideGeo, [
    mats.cream,
    mats.cream,
    mats.cream,
    mats.cream,
    mats.truckSide,
    mats.cream,
  ]);
  frontSide.position.set(cargoX, cargoBaseY + boxH * 0.5, boxW * 0.5 - wallT * 0.5);
  truckGroup.add(frontSide);

  const backSide = new Mesh(sideGeo, [
    mats.cream,
    mats.cream,
    mats.cream,
    mats.cream,
    mats.cream,
    mats.truckSide,
  ]);
  backSide.position.set(cargoX, cargoBaseY + boxH * 0.5, -boxW * 0.5 + wallT * 0.5);
  truckGroup.add(backSide);

  // Roll-up rear cargo door with subtle horizontal slat detail
  const doorPanel = new Mesh(new BoxGeometry(0.08, boxH - 0.12, boxW - 0.18), mats.creamSide);
  doorPanel.position.set(cargoX - boxL * 0.5 + 0.05, cargoBaseY + boxH * 0.5, 0);
  truckGroup.add(doorPanel);

  // Chamfered architectural COE cab
  const cab = new Group();
  cab.position.set(2.48, 0.76, 0);

  const cabLower = new Mesh(createChamferedBox(1.78, 1.12, 2.18, 0.12, 0.02), mats.forest);
  cabLower.position.set(0, 0.56, 0);
  cab.add(cabLower);

  const cabUpper = new Mesh(createChamferedBox(1.68, 0.96, 2.12, 0.12, 0.022), mats.cream);
  cabUpper.position.set(-0.04, 1.58, 0);
  cab.add(cabUpper);

  const windshield = new Mesh(new BoxGeometry(0.08, 0.66, 1.84), mats.glass);
  windshield.position.set(0.81, 1.6, 0);
  cab.add(windshield);

  const sideWinGeo = new BoxGeometry(0.98, 0.6, 0.08);
  for (const side of [-1, 1]) {
    const win = new Mesh(sideWinGeo, mats.glass);
    win.position.set(0.16, 1.6, side * 1.04);
    cab.add(win);
  }

  // Front grille slats + bumper + headlamps
  const grille = new Mesh(new BoxGeometry(0.06, 0.36, 1.38), mats.charcoal);
  grille.position.set(0.89, 0.62, 0);
  cab.add(grille);

  const bumper = new Mesh(createChamferedBox(0.24, 0.24, 2.24, 0.06, 0.015), mats.charcoal);
  bumper.position.set(0.9, 0.15, 0);
  cab.add(bumper);

  const lampGeo = new BoxGeometry(0.06, 0.14, 0.26);
  for (const side of [-1, 1]) {
    const headlight = new Mesh(lampGeo, mats.cream);
    headlight.position.set(0.9, 0.38, side * 0.78);
    cab.add(headlight);
  }

  truckGroup.add(cab);

  // Wheels with charcoal tires and brushed steel hubs
  const wheels: Mesh[] = [];
  const tireGeo = new CylinderGeometry(0.45, 0.45, 0.34, 22);
  tireGeo.rotateX(Math.PI * 0.5);
  const hubGeo = new CylinderGeometry(0.22, 0.22, 0.37, 16);
  hubGeo.rotateX(Math.PI * 0.5);

  for (const ax of [-1.72, 2.58]) {
    for (const side of [-1, 1]) {
      const wheel = new Mesh(tireGeo, mats.charcoal);
      wheel.position.set(ax, 0.45, side * 1.03);
      wheel.add(new Mesh(hubGeo, mats.steel));
      truckGroup.add(wheel);
      wheels.push(wheel);
    }
  }

  return { roadGroup, truckGroup, wheels, doorPanel };
}
