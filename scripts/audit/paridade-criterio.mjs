// O critério da paridade visual, separado do script para ser testável sem navegador (tests/paridade.test.mjs).
// Recebe o resultado de `pixelDiff` (paridade.mjs) de duas capturas da mesma tela e diz se a diferença é
// real. Uma diferença é real quando se repete nos mesmos pixels: mudança de verdade é determinística, o
// erro do renderizador do runner cai em pontos diferentes a cada execução.

export const TOLERANCE = 2; // diferença máxima por canal (0 a 255) que ainda conta como o mesmo pixel
export const AMPLA = 0.001; // fração da imagem que, diferindo (mesmo por pouco), exige confirmação
export const REPETE = 0.5; // fração dos pixels da 1ª captura que também diferem na 2ª

/**
 * @typedef {{ size?: string, pixels?: number, over?: number, max?: number, at?: number[], any?: number[], total?: number }} Diff
 */

/** Diferença só de baixa amplitude (tudo dentro da tolerância) que atinge muitos pixels. */
export const ehAmpla = (/** @type {Diff} */ diff) =>
  !diff.size && !diff.over && (diff.pixels ?? 0) >= (diff.total ?? Infinity) * AMPLA;

/** Diferença pequena demais para merecer uma 2ª captura: ruído de rasterização. */
export const ehRuido = (/** @type {Diff} */ diff) => !diff.size && !diff.over && !ehAmpla(diff);

/**
 * A diferença da 1ª captura reaparece na 2ª?
 * Acima da tolerância basta um pixel em comum; abaixo dela (diferença ampla) pelo menos REPETE dos pixels.
 * @param {Diff} first
 * @param {Diff} again
 */
export function repetiu(first, again) {
  if (again.size) return true;
  if (first.over) {
    const base = new Set(first.at);
    return (again.at ?? []).some((pixel) => base.has(pixel));
  }
  const base = new Set(first.any);
  const common = (again.any ?? []).filter((pixel) => base.has(pixel)).length;
  return common >= REPETE * base.size;
}
