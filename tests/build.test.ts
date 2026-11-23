import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
    assert.match(html, /<style>[\s\S]+<\/style>/, `${page} must inline compiled CSS`);
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
});
