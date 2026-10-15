// Funções de interpolação usadas pela linha do tempo e pela câmera.

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Passo suave (smoothstep) de 0 a 1. */
export const smooth = (t) => {
  const c = clamp(t);
  return c * c * (3 - 2 * c);
};

/** Onde `p` cai dentro da faixa [a, b], de 0 a 1. */
export const within = (p, a, b) => clamp((p - a) / (b - a));

/** Passo suave de `p` ao longo de uma faixa `[a, b]`. */
export const ramp = (p, [a, b]) => smooth(within(p, a, b));

/**
 * Interpolação linear entre chaves ordenadas `[[p, valor], …]`.
 * @param {number} p
 * @param {ReadonlyArray<readonly [number, number]>} keys
 */
export function lin(p, keys) {
  if (p <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i];
    if (p <= p1) {
      const [p0, v0] = keys[i - 1];
      return lerp(v0, v1, (p - p0) / (p1 - p0));
    }
  }
  return keys[keys.length - 1][1];
}
