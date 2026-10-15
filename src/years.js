// Anos de calendário desde um ano (ex.: fundada em 2010, em 2026 são 16). Puro: o build usa para o
// texto inicial e o navegador recalcula ao abrir a página, então o número vira em 1º de janeiro
// sem deploy e sem edição.

/** @returns {number} NaN quando `year` não é um ano de 4 dígitos. */
export function yearsSince(year, now = new Date()) {
  const text = String(year ?? '').trim();
  return /^\d{4}$/.test(text) ? now.getFullYear() - Number(text) : NaN;
}
