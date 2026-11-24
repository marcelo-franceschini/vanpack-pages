import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import {
  createSiteConfig,
  slug,
  visibleClients,
  visibleProofs,
  yearsSince,
} from '../site.config.js';
import { readContent } from '../tools/build/content.js';
import { assertValidSite } from '../tools/build/validate.js';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content');

test('YAML content loads and passes JSON Schema validation', () => {
  const { content, errors } = readContent(CONTENT_DIR);
  assert.deepEqual(errors, []);

  const site = createSiteConfig({ env: { VITE_DATA_MODE: 'demo' }, content });
  const warnings = assertValidSite({
    site,
    content,
    contentErrors: errors,
    root: ROOT,
    contentDir: CONTENT_DIR,
  });
  assert.ok(Array.isArray(warnings));
  assert.equal(site.name, 'Vanpack');
  assert.equal(site.products.length, 4);

  for (const product of site.products) {
    assert.ok(
      Array.isArray(product.especificacoes) && product.especificacoes.length >= 2,
      `Product "${product.id}" should define technical B2B specs`,
    );
  }
});

test('site helpers calculate years, ASCII slugs, and demo vs production client visibility', () => {
  assert.equal(yearsSince('1998', new Date('2026-06-01')), 28);
  assert.ok(Number.isNaN(yearsSince('')));
  assert.equal(slug('Biscoitê & Cia.'), 'biscoite-cia');

  const sample = [
    { id: 'a', name: 'A', logo: '', alt: '', authorized: false, example: false },
    { id: 'b', name: 'B', logo: '', alt: '', authorized: true, example: false },
  ];
  assert.equal(visibleClients(sample, 'demo').length, 2);
  assert.equal(visibleClients(sample, 'production').length, 1);

  const proofs = visibleProofs({
    testimonials: [{ id: '1', quote: 'Ok', author: 'Ana', authorized: false }],
    googleRating: { value: 4.9, count: 12, url: 'https://example.com', authorized: false },
  });
  assert.equal(proofs.testimonials.length, 0);
  assert.equal(proofs.googleRating, null);
});
