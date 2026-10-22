// O critério da paridade visual, separado do script para ser testável sem navegador (tests/paridade.test.mjs).
// Recebe o resultado de `pixelDiff` (paridade.mjs) de duas capturas da mesma tela e diz se a diferença é
// real. Acima da tolerância, é real quando se repete nos mesmos pixels (o erro do renderizador do runner
// cai em pontos diferentes). Abaixo dela, só as capturas de página (seções, produtos, política) contam
// uma diferença ampla: os quadros 3D (`-pNNN.png`) saem do runner do CI com 1/255 em ~22 mil pixels de
// forma estável (medido no CI, mesmo número em runs diferentes), então nesses a tolerância basta.

export const TOLERANCE = 2; // diferença máxima por canal (0 a 255) que ainda conta como o mesmo pixel
export const AMPLA = 0.001; // fração da imagem que, diferindo (mesmo por pouco), exige confirmação
export const REPETE = 0.5; // fração dos pixels da 1ª captura que também diferem na 2ª

/**
 * @typedef {{ size?: string, pixels?: number, over?: number, max?: number, at?: number[], any?: number[], total?: number }} Diff
 */

/** Diferença só de baixa amplitude (tudo dentro da tolerância) que atinge muitos pixels. */
export const ehAmpla = (/** @type {Diff} */ diff) =>
  !diff.size && !diff.over && (diff.pixels ?? 0) >= (diff.total ?? Infinity) * AMPLA;

/** Quadro 3D da história (`1440x900-p075.png`): é onde o runner do CI erra 1/255 de forma estável. */
export const ehQuadro3D = (/** @type {string} */ nome) => /-p\d{3}\.png$/.test(nome);

/** Diferença pequena demais para merecer uma 2ª captura: ruído de rasterização. */
export const ehRuido = (/** @type {Diff} */ diff, /** @type {string} */ nome = '') =>
  !diff.size && !diff.over && !(ehAmpla(diff) && !ehQuadro3D(nome));

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
