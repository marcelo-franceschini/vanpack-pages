import { Color } from 'three';
import { clamp, lerp, lin, ramp, smooth, within } from '../../engine/math';
import { COLORS, LAYOUT } from './constants';
import type { StudioFloorAndPalletRig } from './factory';
import type { FactoryMaterials } from './geometry';
import type { HeroCartonRig } from './hero';
import type { ProductionLineRig } from './machine';
import type { DeliveryTruckRig } from './truck';

export interface FactoryTimelineRig {
  line: ProductionLineRig;
  hero: HeroCartonRig;
  studio: StudioFloorAndPalletRig;
  truck: DeliveryTruckRig;
  mats: FactoryMaterials;
}

const AMBER = new Color(COLORS.amber);
const EMERALD = new Color(COLORS.emerald);
const LAMP_COLOR = new Color();

/**
 * Pure 5-chapter factory choreography matching `docs/notas-de-integracao-v4.md` §4:
 * 1. [0.00..0.14] Top kraft sheet glides from 4-pin feeder stack into Machine A twin infeed rollers
 * 2. [0.14..0.38] Cylinders spin, lamp shifts amber->emerald, printed blank exits & scraps drop into bin
 * 3. [0.38..0.60] Blank enters Machine B, white glue bead applies, panels fold cleanly to 90° at p=0.50
 * 4. [0.60..0.82] Box opens & spins on circular turntable ("SUA MARCA" facing viewer at p=0.75), closes & hops to pallet + straps
 * 5. [0.82..1.00] Strapped pallet loads into Vanpack truck, rear door rolls shut, truck departs along road
 */
export function applyFactoryTimeline(rig: FactoryTimelineRig, p: number, idleTime: number): void {
  const { line, hero, studio, truck, mats } = rig;
  const clamped = clamp(p);

  // 1. Cylinder cross-spoke rotation (subtle idle rotation at p=0 + synced feed spin during pass-through)
  const idleSpin = idleTime * 0.65 * clamp(1 - clamped / 0.08);
  const spinA = within(clamped, 0.05, 0.36) * 15 + idleSpin;
  for (let i = 0; i < line.rollerHubsA.length; i++) {
    line.rollerHubsA[i].rotation.z = (i % 2 === 0 ? -1 : 1) * spinA;
  }
  const spinB = within(clamped, 0.36, 0.62) * 12 + idleSpin * 0.5;
  for (const hub of line.rollerHubsB) {
    hub.rotation.z = -spinB;
  }

  // 2. Machine A signal beacon shifts amber -> emerald while printed blank exits
  const lampMix = ramp(clamped, 0.16, 0.24) * (1 - ramp(clamped, 0.36, 0.42));
  LAMP_COLOR.lerpColors(AMBER, EMERALD, lampMix);
  mats.lamp.color.copy(LAMP_COLOR);
  mats.lamp.emissive.copy(LAMP_COLOR);

  // 3. Chapter 1: Top corrugated sheet slides from 4-pin feeder stack into Machine A
  const feedT = smooth(within(clamped, 0.0, 0.18));
  hero.plainSheet.visible = clamped < 0.19;
  hero.plainSheet.position.set(
    lerp(LAYOUT.feederX, LAYOUT.machineAX, feedT),
    lerp(1.2, LAYOUT.beltY + 0.04, smooth(within(clamped, 0.02, 0.11))),
    0,
  );

  // 4. Chapter 2: Die-cut scraps flutter into charcoal bin beside Machine A (mid-air at p=0.25!)
  const scrapT = within(clamped, 0.18, 0.36);
  for (let i = 0; i < line.scraps.length; i++) {
    const s = line.scraps[i];
    const local = clamp((scrapT - i * 0.055) / 0.62);
    s.visible = scrapT > 0.01 && local < 0.99;
    if (s.visible) {
      s.position.set(
        LAYOUT.machineAX + 1.56 + (i - 2.5) * 0.08 + local * 0.34,
        lerp(LAYOUT.beltY + 0.14, 0.26, local * local),
        0.48 + (i % 2 ? 0.1 : -0.06),
      );
      s.rotation.set(local * 2.2, local * 1.6 + i, local * 1.9);
    }
  }

  // 5. Chapters 2–3: Printed & die-cut blank exits Machine A, receives glue, folds 90° in Machine B
  const showBlank = clamped >= 0.18 && clamped < 0.6;
  hero.dieCutBlank.visible = showBlank;
  if (showBlank) {
    const blankX =
      clamped < 0.38
        ? lerp(LAYOUT.machineAX + 0.2, LAYOUT.machineBX - 0.65, smooth(within(clamped, 0.18, 0.38)))
        : lerp(LAYOUT.machineBX - 0.65, LAYOUT.stageX - 0.45, smooth(within(clamped, 0.38, 0.6)));
    hero.dieCutBlank.position.set(blankX, LAYOUT.beltY + 0.03, 0);

    // Panels fold cleanly upward to 90° around p = 0.50 (Chapter 3 pause frame!)
    const foldT = smooth(within(clamped, 0.42, 0.56));
    hero.blankWingFront.rotation.x = -foldT * (Math.PI * 0.5);
    hero.blankWingBack.rotation.x = foldT * (Math.PI * 0.5);
  }

  // Crisp white glue bead visible during Chapter 3 (p ≈ 0.45..0.56)
  const glueT = ramp(clamped, 0.44, 0.49) * (1 - ramp(clamped, 0.53, 0.58));
  line.glueBead.visible = glueT > 0.02;
  line.glueBead.scale.set(Math.max(0.05, glueT), 1, 1);

  // 6. Chapters 4–5: Erected Hero Carton spins on circular turntable ("SUA MARCA" front at p=0.75),
  // closes flaps, hops onto oak pallet, straps cinch, pallet enters truck & truck drives off!
  const loadT = smooth(within(clamped, 0.84, 0.91));
  const driveT = smooth(within(clamped, 0.93, 1.0));
  const truckOffsetX = driveT * 9.8;

  const palletX =
    clamped < 0.93
      ? lerp(LAYOUT.palletX, LAYOUT.truckStartX - 0.72, loadT)
      : LAYOUT.truckStartX - 0.72 + truckOffsetX;
  const palletY = lerp(0.02, 0.84, ramp(clamped, 0.84, 0.88));
  studio.palletGroup.position.set(palletX, palletY, 0);

  const showCarton = clamped >= 0.59;
  hero.carton.visible = showCarton;
  if (showCarton) {
    if (clamped < 0.78) {
      // Turntable showcase: opens cleanly & rotates so "SUA MARCA" faces viewer at p=0.75
      const enterT = smooth(within(clamped, 0.59, 0.67));
      const spinT = within(clamped, 0.64, 0.78);
      hero.carton.position.set(lerp(LAYOUT.stageX - 0.55, LAYOUT.stageX, enterT), LAYOUT.beltY, 0);
      const yaw = lerp(-0.78, 0.4, spinT);
      hero.carton.rotation.set(0, yaw, 0);
      studio.turntable.rotation.y = yaw;
      hero.setFlapClosure(lerp(0.28, 0.95, ramp(clamped, 0.74, 0.78)));
    } else if (clamped < 0.83) {
      // Arcs cleanly onto the open slot of the wooden pallet
      const hopT = smooth(within(clamped, 0.78, 0.83));
      const slotX = LAYOUT.palletX + studio.heroSlotLocal[0];
      const slotY = 0.02 + studio.heroSlotLocal[1];
      const slotZ = studio.heroSlotLocal[2];
      hero.carton.position.set(
        lerp(LAYOUT.stageX, slotX, hopT),
        lerp(LAYOUT.beltY, slotY, hopT) + Math.sin(hopT * Math.PI) * 1.18,
        lerp(0, slotZ, hopT),
      );
      hero.carton.rotation.set(0, lerp(0.4, 0, hopT), 0);
      hero.setFlapClosure(1);
    } else {
      // Locked onto strapped pallet riding into truck
      hero.carton.position.set(
        palletX + studio.heroSlotLocal[0],
        palletY + studio.heroSlotLocal[1],
        studio.heroSlotLocal[2],
      );
      hero.carton.rotation.set(0, 0, 0);
      hero.setFlapClosure(1);
    }
  }

  // 7. PP strapping bands cinch around pallet
  const strapT = ramp(clamped, 0.81, 0.845);
  for (const band of studio.straps) {
    band.visible = strapT > 0.02;
    band.scale.set(1, Math.max(0.01, strapT), 1);
  }

  // 8. Truck cargo door closes & truck departs smoothly along road
  const doorClosed = ramp(clamped, 0.9, 0.935);
  truck.doorPanel.scale.y = Math.max(0.05, doorClosed);
  truck.doorPanel.position.y = lin(doorClosed, 0, 1, 3.16, 2.0);

  truck.truckGroup.position.x = LAYOUT.truckStartX + truckOffsetX;
  const wheelAngle = -truckOffsetX / 0.45;
  for (const w of truck.wheels) {
    w.rotation.z = wheelAngle;
  }
}
