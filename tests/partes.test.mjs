// A repartição da suíte em partes paralelas (scripts/test-parte.mjs): cada arquivo de teste roda uma vez só,
// em alguma parte (nada fica de fora nem roda em dobro), arquivo novo entra sozinho, e as partes ficam
// equilibradas (a mais lenta não passa de 1,25 vez a média, pelos pesos medidos).
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import { PESOS, PESO_PADRAO, repartir } from '../scripts/test-parte.mjs';

const files = readdirSync(new URL('.', import.meta.url).pathname).filter((name) =>
  name.endsWith('.test.mjs'),
);
const weight = (file) => PESOS[file] ?? PESO_PADRAO;

describe('partes da suíte', () => {
  test('todo arquivo de teste roda em exatamente uma parte, para 1 a 5 partes', () => {
    for (const partes of [1, 2, 3, 4, 5]) {
      const grupos = repartir(files, partes);
      assert.equal(grupos.length, partes);
      assert.deepEqual(grupos.flat().sort(), [...files].sort(), `${partes} partes`);
    }
  });

  test('as 3 partes têm peso parecido: a mais pesada passa da média em no máximo 25%', () => {
    const totals = repartir(files, 3).map((group) => group.reduce((sum, f) => sum + weight(f), 0));
    const mean = totals.reduce((a, b) => a + b, 0) / 3;
    assert.ok(Math.max(...totals) <= mean * 1.25, `pesos das partes: ${totals}`);
  });

  test('arquivo novo (sem peso) entra com o peso padrão e é rodado', () => {
    const grupos = repartir([...files, 'novo.test.mjs'], 3);
    assert.equal(grupos.flat().filter((f) => f === 'novo.test.mjs').length, 1);
  });

  test('é determinístico, e os pesos só citam arquivos que existem', () => {
    assert.deepEqual(repartir(files, 3), repartir([...files].reverse(), 3));
    for (const name of Object.keys(PESOS)) assert.ok(files.includes(name), `${name} não existe`);
  });
});
