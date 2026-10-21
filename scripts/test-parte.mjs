// Uma das N partes da suíte, para o CI rodar as partes em paralelo (cada uma num runner): `PARTE=2 npm run
// test:parte` roda a 2ª de 3 (PARTES muda o 3). Dentro de cada parte os arquivos rodam em sequência, como
// no `npm test`, porque o WebGL por software e os relógios falsos dos testes não se dão bem com
// concorrência. O `--test-shard` do Node reparte por posição e deixou uma parte com 270 s e outra com 95 s;
// aqui a repartição é pelo tempo: os arquivos mais lentos primeiro, cada um na parte mais leve até agora.
// Arquivo novo entra com o peso padrão e é sempre rodado (tests/partes.test.mjs confere que cada arquivo
// roda uma vez só, em alguma parte). Os pesos são segundos medidos em 21/10/2026; se um arquivo ficar
// muito mais lento, acerte o peso dele aqui (só afeta o equilíbrio, nunca o que roda).
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PESO_PADRAO = 2;
export const PESOS = {
  'produtos.test.mjs': 91,
  'tour.test.mjs': 84,
  'limites.test.mjs': 54,
  'carrossel.test.mjs': 51,
  'layout.test.mjs': 31,
  'foco.test.mjs': 30,
  'analytics.test.mjs': 29,
  'a11y.test.mjs': 23,
  'wizard.test.mjs': 18,
  'handoff.test.mjs': 15,
  'robustness.test.mjs': 14,
  'axe.test.mjs': 10,
  'brand.test.mjs': 10,
  'conversion.test.mjs': 10,
};

/**
 * Reparte os arquivos em `partes` grupos de peso parecido (os mais pesados primeiro, sempre no grupo mais
 * leve). Determinístico: a mesma lista dá as mesmas partes.
 * @param {string[]} files nomes dos arquivos de teste
 * @param {number} partes
 * @param {Record<string, number>} [pesos]
 * @returns {string[][]} uma lista de arquivos por parte (cada arquivo em exatamente uma)
 */
export function repartir(files, partes, pesos = PESOS) {
  const weight = (file) => pesos[file] ?? PESO_PADRAO;
  const groups = Array.from({ length: partes }, () => ({ total: 0, files: [] }));
  const order = [...files].sort((a, b) => weight(b) - weight(a) || a.localeCompare(b));
  for (const file of order) {
    const lightest = groups.reduce((min, group) => (group.total < min.total ? group : min));
    lightest.total += weight(file);
    lightest.files.push(file);
  }
  return groups.map((group) => group.files.sort());
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const partes = Number(process.env.PARTES ?? 3);
  const parte = Number(process.env.PARTE ?? 1);
  if (!Number.isInteger(partes) || !Number.isInteger(parte) || parte < 1 || parte > partes) {
    console.error(
      `PARTE=${process.env.PARTE} e PARTES=${process.env.PARTES} inválidos: use 1 a PARTES.`,
    );
    process.exit(2);
  }
  const dir = new URL('../tests/', import.meta.url).pathname;
  const files = readdirSync(dir).filter((name) => name.endsWith('.test.mjs'));
  const mine = repartir(files, partes)[parte - 1].map((name) => `${dir}${name}`);
  console.log(`Parte ${parte} de ${partes}: ${mine.length} arquivos de teste`);
  const run = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...mine], {
    stdio: 'inherit',
  });
  process.exit(run.status ?? 1);
}
