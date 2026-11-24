/** Pure scalar math and easing helpers for 3D choreography and motion damping. */

export const clamp = (value: number, min = 0, max = 1): number =>
  Math.max(min, Math.min(max, value));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smooth = (t: number): number => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};

export const within = (p: number, start: number, end: number): number =>
  clamp((p - start) / (end - start));

export const ramp = (p: number, start: number, end: number): number =>
  smooth(within(p, start, end));

export const lin = (p: number, start: number, end: number, a: number, b: number): number =>
  lerp(a, b, within(p, start, end));

/** Frame-rate independent exponential smoothing factor. */
export const damp = (current: number, target: number, lambda: number, dt: number): number =>
  lerp(current, target, 1 - Math.exp(-lambda * dt));
