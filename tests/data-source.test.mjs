// Fonte única dos dados: content/ manda em tudo. Nenhum dado da empresa pode estar escrito à mão no
// código, o que está em content/ tem de chegar à página publicada, todo número visível vem de content/
// ou é derivado dele, e o .env guarda só o que muda por ambiente.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { loadEnv } from 'vite';
import { parseEnv } from '../build/env.js';
import { yearsSince } from '../src/years.js';
import { ROOT, baseContent, siteWith } from './dados.mjs';

const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// Os mesmos valores que o build usa (as variáveis do processo vencem o arquivo).
const env = loadEnv('production', ROOT, 'VITE_');
const fileEnv = parseEnv(read('.env'));
const empresa = baseContent.empresa;

describe('content/ é a fonte única dos dados', () => {
  test('o .env guarda só o que muda por ambiente e tem as mesmas chaves do .env.example', () => {
    assert.deepEqual(
      Object.keys(fileEnv).sort(),
      Object.keys(parseEnv(read('.env.example'))).sort(),
    );
    assert.deepEqual(Object.keys(fileEnv).sort(), [
      'VITE_ANALYTICS_ENDPOINT',
      'VITE_ANALYTICS_PROVIDER',
      'VITE_ANALYTICS_SITE',
      'VITE_DATA_MODE',
      'VITE_SITE_URL',
    ]);
  });

  test('nenhum dado da empresa escrito à mão no código, nos scripts nem nos testes', () => {
    const sensitive = [
      empresa.cnpj,
      empresa.telefone,
      empresa.telefone_exibicao,
      String(empresa.whatsapp),
      empresa.endereco.rua,
      empresa.endereco.cep,
      empresa.razao_social,
    ].filter((value) => value && value.length >= 5);
    assert.ok(sensitive.length > 0, 'há valores para procurar');

    const TEXT = new Set(['.js', '.mjs', '.html', '.json', '.svg', '.txt', '.xml', '.css']);
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (TEXT.has(extname(name)) && name !== 'package-lock.json') files.push(path);
      }
    };
    for (const dir of ['src', 'scripts', 'tests', 'build', 'public']) walk(`${ROOT}${dir}`);
    for (const name of readdirSync(ROOT)) {
      if (TEXT.has(extname(name)) && name !== 'package-lock.json') files.push(`${ROOT}${name}`);
    }
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const value of sensitive) {
        assert.ok(
          !source.includes(value),
          `${relative(ROOT, file)} tem o dado de content/empresa.yaml: ${value}`,
        );
      }
    }
  });

  test('o que está em content/ chega à página publicada (rodapé, links e JSON-LD)', () => {
    const dist = read('dist/index.html');
    const flat = dist.replace(/\s+/g, ' ');
    for (const value of [
      empresa.cnpj,
      empresa.razao_social,
      empresa.horario,
      empresa.telefone_exibicao,
      empresa.endereco.rua,
      empresa.endereco.cep,
      baseContent.diferenciais.itens[0].titulo,
      baseContent.clientes.clientes[0].nome,
    ]) {
      assert.ok(flat.includes(escapeHtml(value)), `${value} não chegou ao dist`);
    }
    assert.ok(flat.includes(`href="tel:${empresa.telefone}"`));
    assert.ok(flat.includes(`https://wa.me/${String(empresa.whatsapp).replace(/\D/g, '')}?text=`));
    const ld = JSON.parse(
      dist.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(ld.telephone, empresa.telefone);
    assert.equal(ld.taxID, empresa.cnpj);
    assert.equal(ld.url, env.VITE_SITE_URL);
  });

  test('todo número visível na página vem de content/ ou é derivado dele', () => {
    const visible = read('dist/index.html')
      .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&[a-z]+;/g, ' ');
    const numbers = (value) => JSON.stringify(value).match(/\d+/g) ?? [];
    const allowed = new Set([
      ...numbers(baseContent),
      // o WhatsApp formatado na folha "O WhatsApp não abriu?": (11) 91234-5678
      ...(siteWith().whatsappDisplay.match(/\d+/g) ?? []),
      '1', // passos "Como pedir": 1, 2 e 3
      '2',
      '3',
      String(new Date().getFullYear()), // © do rodapé
      String(yearsSince(empresa.ano_fundacao)), // anos de mercado
    ]);
    for (const [number] of visible.matchAll(/\d+/g)) {
      assert.ok(allowed.has(number), `número "${number}" na página não vem de content/`);
    }
  });

  test('docs/go-live.md explica cada arquivo de content/ e cada chave do .env.example', () => {
    const doc = read('docs/go-live.md');
    for (const key of Object.keys(parseEnv(read('.env.example')))) {
      assert.ok(doc.includes(key), `${key} falta no docs/go-live.md`);
    }
    for (const field of Object.keys(empresa)) {
      assert.ok(
        doc.includes(field),
        `o campo "${field}" de content/empresa.yaml falta no docs/go-live.md`,
      );
    }
  });
});
