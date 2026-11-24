// Domínio próprio: canonical, Open Graph, JSON-LD, robots.txt, sitemap.xml e a medição derivam todos da
// VITE_SITE_URL. O teste faz um build em modo production com dados "reais" (uma cópia de content/) e outra URL e confere que
// nada da URL antiga sobra e que o site fica indexável.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, test } from 'node:test';
import { build } from 'vite';
import { ROOT } from '../scripts/lib.mjs';
import { contentCopy, readYaml, realEmpresa } from './dados.mjs';

const FINAL = 'https://vanpack.com.br/';
const OLD_HOST = 'marcelo-franceschini.github.io';
const OUT = `${ROOT}dist-site/`;
const read = (file) => readFileSync(`${OUT}${file}`, 'utf8');

before(async () => {
  const saved = { ...process.env };
  // production: dados reais de teste e sem os clientes de exemplo, numa cópia de content/
  const copy = contentCopy({
    'empresa.yaml': realEmpresa,
    'clientes.yaml': { ...readYaml('clientes.yaml'), clientes: [] },
  });
  Object.assign(process.env, {
    VITE_DATA_MODE: 'production',
    VANPACK_CONTENT: copy.dir,
    VITE_SITE_URL: FINAL,
    VITE_ANALYTICS_PROVIDER: 'umami',
    VITE_ANALYTICS_SITE: '12345678-1234-4234-8234-123456789abc',
  });
  try {
    await build({ root: ROOT, logLevel: 'silent', build: { outDir: 'dist-site' } });
  } finally {
    copy.remove();
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

describe('VITE_SITE_URL com domínio próprio, em production', () => {
  test('canonical, Open Graph e JSON-LD usam a URL nova', () => {
    const page = read('index.html');
    assert.ok(page.includes(`<link rel="canonical" href="${FINAL}"`));
    assert.ok(page.includes(`property="og:url" content="${FINAL}"`));
    assert.ok(page.includes(`property="og:image" content="${FINAL}og.jpg"`));
    const ld = JSON.parse(
      page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.deepEqual(
      [ld.url, ld.image, ld.logo],
      [FINAL, `${FINAL}og.jpg`, `${FINAL}icon-512.png`],
    );
    assert.ok(
      read('politica-de-privacidade.html').includes(`href="${FINAL}politica-de-privacidade.html"`),
    );
  });

  test('robots.txt libera e anuncia o sitemap; o sitemap tem a URL nova; sem noindex', () => {
    assert.ok(read('robots.txt').includes(`Allow: /\n\nSitemap: ${FINAL}sitemap.xml`));
    assert.ok(read('sitemap.xml').includes(`<loc>${FINAL}</loc>`));
    assert.ok(!read('index.html').includes('noindex'));
    assert.ok(!read('politica-de-privacidade.html').includes('noindex'));
  });

  test('a medição passa a valer só no domínio novo e nada da URL antiga sobra no build', () => {
    const files = [];
    const walk = (dir) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(html|js|txt|xml|json)$/.test(name)) files.push(path);
      }
    };
    walk(OUT);
    const bundle = files.filter((file) => file.includes('/assets/index-'));
    assert.ok(bundle.some((file) => /host:\W?vanpack\.com\.br\W/.test(readFileSync(file, 'utf8'))));
    for (const file of files) {
      assert.ok(!readFileSync(file, 'utf8').includes(OLD_HOST), `${file} ainda cita ${OLD_HOST}`);
    }
  });
});
