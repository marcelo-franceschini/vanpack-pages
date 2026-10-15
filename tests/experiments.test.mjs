// Experimentos A/B (src/experiments.js): sorteio por pesos, persistência só no sessionStorage,
// data de término, variante forçada pela URL e o contexto que cada evento leva. O módulo roda em Node
// com o navegador simulado, e cada caso importa uma instância nova (estado limpo).
import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';

const A_B = { enabled: true, variants: ['A', 'B'], split: [50, 50], endsAt: '' };
const realRandom = Math.random;
let instance = 0;

/** Monta o "navegador" do caso e devolve o módulo novo, o armazenamento e o <html>. */
async function load({ config, search = '', store = new Map(), broken = false } = {}) {
  globalThis.__SITE__ = { experiments: config };
  globalThis.location = { search };
  globalThis.document = { documentElement: { dataset: {} } };
  globalThis.sessionStorage = {
    getItem: (key) => {
      if (broken) throw new Error('storage bloqueado');
      return store.get(key) ?? null;
    },
    setItem: (key, value) => {
      if (broken) throw new Error('storage bloqueado');
      store.set(key, value);
    },
  };
  const module = await import(`../src/experiments.js?caso=${++instance}`);
  return { ...module, store, dataset: document.documentElement.dataset };
}

afterEach(() => {
  Math.random = realRandom;
});

describe('experimentos A/B', () => {
  test('desligado: variante A, sem marca no <html> e sem contexto nos eventos', async () => {
    const { variant, startExperiments, experimentContext, dataset } = await load({
      config: { quote_wizard: { ...A_B, enabled: false } },
    });
    startExperiments();
    assert.equal(variant('quote_wizard'), 'A');
    assert.deepEqual(experimentContext(), {});
    assert.deepEqual(dataset, {});
    assert.equal(variant('nao_existe'), 'A');
  });

  test('ligado: sorteia pelos pesos, marca o <html> e o contexto leva a variante', async () => {
    Math.random = () => 0.9;
    const { variant, experimentContext, dataset } = await load({
      config: { quote_wizard: A_B },
    });
    assert.equal(variant('quote_wizard'), 'B');
    assert.equal(dataset.exp_quote_wizard, 'B');
    assert.deepEqual(experimentContext(), { exp_quote_wizard: 'B' });
    Math.random = () => 0.1;
    assert.equal((await load({ config: { quote_wizard: A_B } })).variant('quote_wizard'), 'A');
  });

  test('os pesos mandam: 90/10 dá B só nos 10% finais', async () => {
    const config = { quote_wizard: { ...A_B, split: [90, 10] } };
    Math.random = () => 0.89;
    assert.equal((await load({ config })).variant('quote_wizard'), 'A');
    Math.random = () => 0.91;
    assert.equal((await load({ config })).variant('quote_wizard'), 'B');
  });

  test('a variante fica no sessionStorage e a mesma visita não sorteia de novo', async () => {
    const store = new Map();
    Math.random = () => 0.9;
    assert.equal(
      (await load({ config: { quote_wizard: A_B }, store })).variant('quote_wizard'),
      'B',
    );
    assert.equal(store.get('vanpack:exp:quote_wizard'), 'B');
    Math.random = () => {
      throw new Error('não podia sortear de novo');
    };
    assert.equal(
      (await load({ config: { quote_wizard: A_B }, store })).variant('quote_wizard'),
      'B',
    );
  });

  test('storage bloqueado não quebra a página: vale o sorteio desta página', async () => {
    Math.random = () => 0.9;
    const { variant } = await load({ config: { quote_wizard: A_B }, broken: true });
    assert.equal(variant('quote_wizard'), 'B');
  });

  test('depois da data de término só vale a variante A', async () => {
    Math.random = () => 0.9;
    const past = { quote_wizard: { ...A_B, endsAt: '2020-01-01' } };
    const { variant, experimentContext } = await load({ config: past });
    assert.equal(variant('quote_wizard'), 'A');
    assert.deepEqual(experimentContext(), {});
    const future = { quote_wizard: { ...A_B, endsAt: '2999-01-01' } };
    assert.equal((await load({ config: future })).variant('quote_wizard'), 'B');
  });

  test('?exp_<nome>=B força a variante mesmo desligado; valor inválido é ignorado', async () => {
    const off = { quote_wizard: { ...A_B, enabled: false } };
    const forced = await load({ config: off, search: '?exp_quote_wizard=B' });
    assert.equal(forced.variant('quote_wizard'), 'B');
    assert.deepEqual(forced.experimentContext(), { exp_quote_wizard: 'B' });
    assert.equal(
      (await load({ config: off, search: '?exp_quote_wizard=Z' })).variant('quote_wizard'),
      'A',
    );
    assert.equal(forced.store.size, 0, 'forçar não grava nada no storage');
  });
});
