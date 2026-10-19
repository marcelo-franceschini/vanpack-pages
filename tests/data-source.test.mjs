// Fonte única dos dados: o `.env` manda em tudo. Nenhum dado da empresa pode estar escrito à mão no
// código, o que está no `.env` tem de chegar à página publicada (o Vite não o copia para o
// process.env: foi o bug que deixava rodapé e JSON-LD vazios) e todo número visível vem da config.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, test } from 'node:test';
import { loadEnv } from 'vite';
import { parseEnv } from '../build/env.js';
import { createSiteConfig } from '../site.config.js';
import { yearsSince } from '../src/years.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Os mesmos valores que o build usa (as variáveis do processo vencem o arquivo).
const env = loadEnv('production', ROOT, 'VITE_');
const fileEnv = parseEnv(read('.env'));

describe('.env é a fonte única', () => {
  test('.env e .env.example têm as mesmas chaves', () => {
    assert.deepEqual(
      Object.keys(fileEnv).sort(),
      Object.keys(parseEnv(read('.env.example'))).sort(),
    );
  });

  test('nenhum dado da empresa escrito à mão no código, nos scripts nem nos testes', () => {
    const sensitive = [
      'VITE_CNPJ',
      'VITE_PHONE',
      'VITE_PHONE_DISPLAY',
      'VITE_WHATSAPP',
      'VITE_EMAIL',
      'VITE_STREET',
      'VITE_CEP',
      'VITE_LEGAL_NAME',
    ]
      .map((key) => fileEnv[key])
      .filter((value) => value && value.length >= 5);
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
        assert.ok(!source.includes(value), `${relative(ROOT, file)} tem o dado do .env: ${value}`);
      }
    }
  });

  test('o que está no .env chega à página publicada (rodapé, links e JSON-LD)', () => {
    const dist = read('dist/index.html');
    const flat = dist.replace(/\s+/g, ' ');
    for (const key of [
      'VITE_CNPJ',
      'VITE_LEGAL_NAME',
      'VITE_EMAIL',
      'VITE_HOURS',
      'VITE_PHONE_DISPLAY',
      'VITE_STREET',
      'VITE_CEP',
    ]) {
      if (env[key]) assert.ok(flat.includes(escapeHtml(env[key])), `${key} não chegou ao dist`);
    }
    if (env.VITE_PHONE) assert.ok(flat.includes(`href="tel:${env.VITE_PHONE}"`));
    if (env.VITE_WHATSAPP) {
      assert.ok(flat.includes(`https://wa.me/${env.VITE_WHATSAPP.replace(/\D/g, '')}?text=`));
    }
    const ld = JSON.parse(
      dist.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    if (env.VITE_PHONE) assert.equal(ld.telephone, env.VITE_PHONE);
    if (env.VITE_CNPJ) assert.equal(ld.taxID, env.VITE_CNPJ);
    assert.equal(ld.url, env.VITE_SITE_URL);
  });

  test('todo número visível na página vem da config ou é derivado dela', () => {
    const visible = read('dist/index.html')
      .replace(/<(script|style|svg|noscript)[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
      .replace(/&[a-z]+;/g, ' ');
    const allowed = new Set([
      ...(Object.values(env).join(' ').match(/\d+/g) ?? []),
      // o WhatsApp formatado na folha "O WhatsApp não abriu?": (11) 91234-5678
      ...(createSiteConfig(env).whatsappDisplay.match(/\d+/g) ?? []),
      '1', // passos "Como pedir": 1, 2 e 3
      '2',
      '3',
      '02', // numeração dos capítulos da história
      '03',
      '04',
      '05',
      String(new Date().getFullYear()), // © do rodapé
      String(yearsSince(env.VITE_FOUNDED_YEAR)), // anos de mercado
    ]);
    for (const [number] of visible.matchAll(/\d+/g)) {
      assert.ok(allowed.has(number), `número "${number}" na página não vem da config`);
    }
  });

  test('docs/go-live.md explica cada chave do .env.example', () => {
    const doc = read('docs/go-live.md');
    for (const key of Object.keys(parseEnv(read('.env.example')))) {
      assert.ok(doc.includes(key), `${key} falta no docs/go-live.md`);
    }
  });
});
