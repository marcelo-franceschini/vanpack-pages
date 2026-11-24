import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const DIST = join(process.cwd(), 'dist');

test('production dist contains all rendered HTML pages, SEO files, inlined CSS, and CSP hashes', () => {
  if (!existsSync(DIST)) {
    throw new Error(
      'dist/ not found — run `npm run build` before running build verification tests.',
    );
  }

  for (const file of [
    'index.html',
    'politica-de-privacidade.html',
    '404.html',
    'robots.txt',
    'sitemap.xml',
    'clientes/biscoite.svg',
  ]) {
    assert.ok(existsSync(join(DIST, file)), `Expected dist/${file} to exist`);
  }

  for (const page of ['index.html', 'politica-de-privacidade.html', '404.html']) {
    const html = readFileSync(join(DIST, page), 'utf8');
    assert.doesNotMatch(html, /\{\{[^}]+\}\}/, `${page} must have no unresolved {{tokens}}`);
    assert.doesNotMatch(
      html,
      /<!--render:[^>]+-->/,
      `${page} must have no unresolved render slots`,
    );
    assert.doesNotMatch(html, /%VITE_SITE_URL%/, `${page} must not leak raw %VITE_SITE_URL%`);
    assert.match(html, /<style>[\s\S]+<\/style>/, `${page} must inline compiled CSS`);
    const styleBlock = html.match(/<style>([\s\S]+?)<\/style>/)?.[1] ?? '';
    assert.doesNotMatch(
      styleBlock,
      /url\(\s*['"]?\.\.\//,
      `${page} inlined CSS must not contain broken ../ asset paths`,
    );
    assert.match(
      html,
      /Content-Security-Policy" content="[^"]*sha256-[A-Za-z0-9+/=]+/,
      `${page} must embed a valid CSP with SHA-256 style hash`,
    );
  }

  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.match(indexHtml, /class="card on"/, 'index.html includes story cards');
  assert.match(indexHtml, /data-quick-quote/, 'index.html includes optional quick-quote builder');
  assert.match(indexHtml, /class="model-specs"/, 'index.html includes B2B product specs');
  assert.doesNotMatch(indexHtml, /wiz-step/, 'legacy dead wizard markup is removed');
  assert.doesNotMatch(indexHtml, /—/, 'rendered index.html must not contain em-dashes');

  if (process.env.VITE_DATA_MODE !== 'production') {
    assert.match(
      indexHtml,
      /<meta\s+name="robots"\s+content="noindex,nofollow"\s*\/?>/i,
      'non-production build must emit noindex meta tag',
    );
    const robots = readFileSync(join(DIST, 'robots.txt'), 'utf8');
    assert.match(robots, /Disallow:\s*\//, 'non-production robots.txt must disallow indexing');
  }
});

test('Three.js is deduplicated into a single shared chunk preloaded by index.html', () => {
  const assetsDir = join(DIST, 'assets');
  const assets = readdirSync(assetsDir);
  const threeChunks = assets.filter((f) => /^three-[A-Za-z0-9_-]+\.js$/.test(f));
  assert.equal(threeChunks.length, 1, `Expected 1 shared three chunk, found: ${threeChunks}`);

  const sharedName = threeChunks[0];
  const sharedCode = readFileSync(join(assetsDir, sharedName), 'utf8');
  assert.match(sharedCode, /WEBGL_lose_context/, 'shared chunk contains Three.js core');

  const indexHtml = readFileSync(join(DIST, 'index.html'), 'utf8');
  assert.ok(
    indexHtml.includes(`<link rel="modulepreload" href="./assets/${sharedName}"`),
    'index.html preloads shared Three.js chunk',
  );

  for (const prefix of ['worker-', 'produtos-worker-', 'controller-']) {
    const file = assets.find((f) => f.startsWith(prefix) && f.endsWith('.js'));
    assert.ok(file, `Expected ${prefix}*.js chunk in dist/assets`);
    const code = readFileSync(join(assetsDir, file), 'utf8');
    assert.ok(
      code.includes(`./${sharedName}`),
      `${file} must import shared ./${sharedName} instead of duplicating Three.js`,
    );
    assert.doesNotMatch(
      code,
      /WEBGL_lose_context/,
      `${file} must not bundle a duplicate copy of Three.js`,
    );
  }
});
