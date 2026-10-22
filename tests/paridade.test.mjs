// O critério da paridade visual (scripts/audit/paridade-criterio.mjs), sem navegador: mudança de cor de
// baixa amplitude mas ampla é detectada; ruído do renderizador do runner, que cai em pontos diferentes a
// cada execução, não reprova. Os números vêm de medições reais (troca de #14513a por #14513b: 1/255 em
// 1.008.936 pixels numa seção; ruído do CI: 22.501 pixels a 1/255 numa tela de 844x390 a 2x).
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { TOLERANCE, ehAmpla, ehRuido, repetiu } from '../scripts/audit/paridade-criterio.mjs';

const range = (from, count) => Array.from({ length: count }, (_, i) => from + i);
const secao = 1440 * 900;

describe('critério da paridade visual', () => {
  test('a tolerância por canal continua 2/255', () => {
    assert.equal(TOLERANCE, 2);
  });

  test('troca de cor de 1/255 em muitos pixels é diferença ampla, não ruído', () => {
    const diff = { pixels: 1_008_936, over: 0, max: 1, any: range(0, 5000), total: secao };
    assert.ok(ehAmpla(diff));
    assert.ok(!ehRuido(diff));
  });

  test('um punhado de pixels a 1/255 continua sendo ruído', () => {
    const diff = { pixels: 40, over: 0, max: 1, any: range(0, 40), total: secao };
    assert.ok(ehRuido(diff));
  });

  test('a mudança de cor se repete na 2ª captura e reprova', () => {
    const first = { pixels: 12_839, over: 0, max: 1, any: range(0, 5000), total: secao };
    const again = { pixels: 12_839, over: 0, max: 1, any: range(0, 5000), total: secao };
    assert.ok(repetiu(first, again));
  });

  test('ruído do runner em pontos diferentes não se repete e não reprova', () => {
    const first = { pixels: 22_501, over: 0, max: 1, any: range(0, 5000), total: 1688 * 780 };
    const again = { pixels: 22_000, over: 0, max: 1, any: range(900_000, 5000), total: 1688 * 780 };
    assert.ok(!repetiu(first, again));
  });

  test('acima da tolerância basta um pixel em comum (regra que já existia)', () => {
    const first = { pixels: 2, over: 2, max: 4, at: [10, 20], any: [10, 20], total: secao };
    assert.ok(repetiu(first, { ...first, at: [20, 99] }));
    assert.ok(!repetiu(first, { ...first, at: [98, 99] }));
  });

  test('imagem de tamanho diferente é sempre real', () => {
    assert.ok(repetiu({ pixels: 1, over: 1, at: [1] }, { size: '10x10 contra 20x20' }));
  });
});
