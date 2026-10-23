// Conteúdo no limite máximo: todo texto de content/ com o número máximo de caracteres que o schema aceita,
// as listas cheias (6 diferenciais, 12 clientes) e os dados da empresa no tamanho máximo. É o pior caso
// que o build deixa passar, e a página tem de aguentar: este teste constrói o site assim (dist-limite/) e
// roda nele o layout.test (nenhum cartão cobre o cabeçalho, o botão fixo ou a dica, tudo cabe na tela, alvos
// de 44 px, sem rolagem horizontal) em todos os tamanhos de tela. Se um limite de content/schemas/ for
// largo demais para o layout, este teste reprova e o limite desce.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { build } from 'vite';
import { readContent } from '../build/content.js';
import { ROOT, contentCopy, readYaml } from './dados.mjs';

// Campos de formato fixo e a cidade: o tamanho da cidade entra na linha pequena da abertura, que tem regra
// própria sobre o texto pronto (RENDERED_LIMITS em build/validate.js) e este teste não pode esticá-la.
const KEEP = new Set([
  'cnpj',
  'telefone',
  'telefone_exibicao',
  'cep',
  'horario_schema',
  'whatsapp',
  'cidade',
]);

/** O texto estendido com palavras dele mesmo até chegar perto de `max` caracteres (sem passar). */
function pad(text, max) {
  const words = text
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return text;
  let out = text;
  for (let i = 0; ; i++) {
    const next = `${out} ${words[i % words.length]}`;
    if (next.length > max) return out;
    out = next;
  }
}

/** O valor com todo texto no tamanho máximo do schema e as listas no número máximo de itens. */
function fill(schema, value, key = '') {
  if (typeof value === 'string') {
    const free = schema.maxLength && !schema.pattern && !schema.enum && !KEEP.has(key);
    return free ? pad(value, schema.maxLength) : value;
  }
  if (Array.isArray(value)) {
    const total = schema.maxItems ?? value.length;
    return Array.from({ length: Math.max(total, value.length) }, (_, i) =>
      fill(schema.items, structuredClone(value[i % value.length]), key),
    );
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, fill(schema.properties?.[k] ?? {}, v, k)]),
    );
  }
  return value;
}

const NAMES = [
  'empresa',
  'site',
  'historia',
  'produtos',
  'diferenciais',
  'clientes',
  'orcamento',
  'whatsapp',
  'rodape',
];
const files = Object.fromEntries(
  NAMES.map((name) => {
    const schema = JSON.parse(readFileSync(`${ROOT}content/schemas/${name}.schema.json`, 'utf8'));
    return [`${name}.yaml`, fill(schema, readYaml(`${name}.yaml`))];
  }),
);

/** Roda um arquivo de teste contra o build do conteúdo no máximo (dist-limite/). */
function rodar(file) {
  // um `node --test` dentro de um teste herda NODE_TEST_CONTEXT e só finge rodar (sai com 0): sem ela
  // ele é um executor de verdade
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', file], {
    cwd: ROOT,
    env: { ...env, TESTE_DIST: 'dist-limite' },
    encoding: 'utf8',
    timeout: 600_000,
  });
}

describe('conteúdo no limite máximo', () => {
  test('o conteúdo no limite passa pelo carregador e as listas estão cheias', () => {
    const { dir, remove } = contentCopy(files);
    try {
      const { content, errors } = readContent(dir);
      assert.deepEqual(errors, []);
      assert.equal(content.diferenciais.itens.length, 6);
      assert.equal(content.clientes.clientes.length, 12);
      assert.ok(
        content.historia.hero.texto.length > 60,
        'o texto foi estendido até perto do limite',
      );
    } finally {
      remove();
    }
  });

  test('o site construído com tudo no limite passa no teste de layout em todos os tamanhos', async () => {
    const { dir, remove } = contentCopy(files);
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { VANPACK_CONTENT: dir });
      await build({ root: ROOT, logLevel: 'silent', build: { outDir: 'dist-limite' } });
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
      remove();
    }
    const run = rodar('tests/layout.test.mjs');
    const failed = run.stdout
      .split('\n')
      .filter((line) => /^\s*✖/.test(line))
      .join('\n');
    assert.equal(
      run.status,
      0,
      `o layout quebra com o conteúdo no limite:\n${failed}\n${run.stdout.slice(-3000)}`,
    );
  });

  test('o site construído com tudo no limite cabe nos tetos de bytes (os mesmos do site normal)', () => {
    // depende do build do teste anterior (dist-limite/)
    const run = rodar('tests/orcamento.test.mjs');
    const failed = run.stdout
      .split('\n')
      .filter((line) => /AssertionError/.test(line))
      .join('\n');
    assert.equal(
      run.status,
      0,
      `o conteúdo no limite dos schemas estoura o orçamento de bytes:\n${failed}\n${run.stdout.slice(-2000)}`,
    );
  });
});
