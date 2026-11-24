import { clamp, damp } from '../../engine/math';

export interface TurntableState {
  yaw: number;
  pitch: number;
  yawVel: number;
  pitchVel: number;
  dragging: boolean;
  idleHold: number;
}

export const MAX_PITCH = 0.32; // ~18.3 degrees vertical inspection tilt
export const AUTO_SPIN_SPEED = 0.24; // rad/s gentle showcase turn
export const IDLE_RESUME_DELAY = 2.4; // seconds after drag before gentle spin resumes

export function createTurntableState(initialYaw = -0.58): TurntableState {
  return {
    yaw: initialYaw,
    pitch: 0,
    yawVel: 0,
    pitchVel: 0,
    dragging: false,
    idleHold: 0,
  };
}

/** Applies a pointer drag delta (in pixels) to yaw/pitch and records angular velocity for inertia. */
export function applyDragDelta(state: TurntableState, dx: number, dy: number, dt = 1 / 60): void {
  const safeDt = Math.max(0.008, Math.min(0.05, dt));
  const dYaw = dx * 0.0085;
  const dPitch = dy * 0.0055;
  state.yaw += dYaw;
  state.pitch = clamp(state.pitch + dPitch, -MAX_PITCH, MAX_PITCH);
  state.yawVel = clamp(dYaw / safeDt, -9, 9);
  state.pitchVel = clamp(dPitch / safeDt, -5, 5);
  state.idleHold = IDLE_RESUME_DELAY;
}

/** Applies a discrete keyboard rotation step (accessible Arrow keys). */
export function applyKeyStep(state: TurntableState, dYaw: number, dPitch: number): void {
  state.yaw += dYaw;
  state.pitch = clamp(state.pitch + dPitch, -MAX_PITCH, MAX_PITCH);
  state.yawVel = 0;
  state.pitchVel = 0;
  state.idleHold = IDLE_RESUME_DELAY;
}

/**
 * Advances inertial glide, pitch spring-return, and subtle auto-rotation.
 * Returns `true` if the model orientation meaningfully changed (needs a frame).
 */
export function stepTurntable(state: TurntableState, dt: number, reducedMotion: boolean): boolean {
  const delta = Math.max(0.001, Math.min(0.05, dt));
  const prevYaw = state.yaw;
  const prevPitch = state.pitch;

  if (state.dragging) {
    return false;
  }

  // Inertial horizontal glide with exponential damping
  if (Math.abs(state.yawVel) > 0.002) {
    state.yaw += state.yawVel * delta;
    state.yawVel = damp(state.yawVel, 0, 5.2, delta);
    if (Math.abs(state.yawVel) < 0.003) state.yawVel = 0;
  }

  // Smooth spring-return of vertical pitch back to neutral horizon
  if (Math.abs(state.pitch) > 0.001) {
    state.pitch = damp(state.pitch, 0, 6.5, delta);
    if (Math.abs(state.pitch) < 0.001) state.pitch = 0;
  }

  if (state.idleHold > 0) {
    state.idleHold = Math.max(0, state.idleHold - delta);
  } else if (!reducedMotion && state.yawVel === 0) {
    state.yaw += AUTO_SPIN_SPEED * delta;
  }

  return Math.abs(state.yaw - prevYaw) > 0.0002 || Math.abs(state.pitch - prevPitch) > 0.0002;
}
