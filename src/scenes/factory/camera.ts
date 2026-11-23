import { Vector3, type PerspectiveCamera } from 'three';
import { clamp, lerp, smooth } from '../../engine/math';
import { CAMERA_DIRECTION, LAYOUT } from './constants';

interface CameraTargetStop {
  p: number;
  target: [number, number, number];
  dist: number;
}

const DIR = new Vector3(CAMERA_DIRECTION[0], CAMERA_DIRECTION[1], CAMERA_DIRECTION[2]).normalize();

// Desktop targets shift each focal station cleanly to the right 55% of the frame (matching `public/og.jpg`),
// leaving open negative paper space behind the left-side chapter typography across all 5 chapters!
const DESKTOP_STOPS: readonly CameraTargetStop[] = [
  { p: 0.0, target: [LAYOUT.feederX + 0.65, 0.9, 0.0], dist: 16.4 },
  { p: 0.25, target: [LAYOUT.machineAX - 0.65, 0.9, 0.0], dist: 14.4 },
  { p: 0.5, target: [LAYOUT.machineBX - 1.1, 0.88, 0.0], dist: 13.8 },
  { p: 0.75, target: [LAYOUT.stageX - 0.8, 1.02, 0.0], dist: 12.8 },
  { p: 1.0, target: [LAYOUT.truckStartX + 5.2, 1.18, 0.0], dist: 20.2 },
];

// Mobile targets center the active station cleanly in the upper 55% above the bottom text beat.
const MOBILE_STOPS: readonly CameraTargetStop[] = [
  { p: 0.0, target: [LAYOUT.feederX + 2.0, 0.35, 0.0], dist: 18.8 },
  { p: 0.25, target: [LAYOUT.machineAX + 0.5, 0.35, 0.0], dist: 16.5 },
  { p: 0.5, target: [LAYOUT.machineBX + 0.2, 0.35, 0.0], dist: 16.2 },
  { p: 0.75, target: [LAYOUT.stageX + 0.1, 0.5, 0.0], dist: 15.0 },
  { p: 1.0, target: [LAYOUT.truckStartX + 7.2, 0.6, 0.0], dist: 23.0 },
];

const tmpTarget = new Vector3();
const tmpPos = new Vector3();

/**
 * Adds a ~12% visual dwell plateau around each chapter center (`0, 0.25, 0.5, 0.75, 1.0`)
 * matching `docs/notas-de-integracao-v4.md` §4 so each pause frame stays rock-steady.
 */
function dwellBetweenStops(t: number, dwell = 0.12): number {
  if (t <= dwell) return 0;
  if (t >= 1 - dwell) return 1;
  return smooth((t - dwell) / (1 - 2 * dwell));
}

/**
 * Telephoto isometric camera rig (`FOV 22`, constant `CAMERA_DIRECTION`) gliding smoothly along
 * the 5 architectural chapters with crisp dwelling around each chapter center.
 */
export function updateFactoryCamera(
  camera: PerspectiveCamera,
  p: number,
  mobile: boolean,
  idleTime: number,
): void {
  const stops = mobile ? MOBILE_STOPS : DESKTOP_STOPS;
  const clamped = clamp(p);

  let idx = 0;
  while (idx < stops.length - 2 && clamped > stops[idx + 1].p) {
    idx++;
  }
  const a = stops[idx];
  const b = stops[idx + 1];
  const rawT = (clamped - a.p) / Math.max(0.0001, b.p - a.p);
  const localT = dwellBetweenStops(rawT, 0.12);

  tmpTarget.set(
    lerp(a.target[0], b.target[0], localT),
    lerp(a.target[1], b.target[1], localT),
    lerp(a.target[2], b.target[2], localT),
  );
  const dist = lerp(a.dist, b.dist, localT);

  tmpPos.copy(tmpTarget).addScaledVector(DIR, dist);

  // Subtle living parallax breath near p = 0 without ever moving scrollY
  const idleWeight = clamp(1 - clamped / 0.08);
  if (idleWeight > 0 && idleTime > 0) {
    tmpPos.x += Math.sin(idleTime * 0.45) * 0.14 * idleWeight;
    tmpPos.y += Math.cos(idleTime * 0.34) * 0.05 * idleWeight;
  }

  camera.position.copy(tmpPos);
  camera.lookAt(tmpTarget);
}
