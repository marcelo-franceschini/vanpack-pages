import assert from 'node:assert/strict';
import { join } from 'node:path';
import test from 'node:test';
import { createSiteConfig } from '../site.config.js';
import { isRestrictiveInAppBrowser } from '../src/ui/handoff.ts';
import { buildQuickQuoteMessage, buildQuickQuoteUrl } from '../src/ui/quick-quote.ts';
import { calculateYearsSince } from '../src/ui/years.ts';
import { readContent } from '../tools/build/content.js';
import { robotsTxt } from '../tools/build/files.js';
import { renderPage } from '../tools/build/render.js';
import { whatsappUrl } from '../tools/build/text.js';

test('quick-quote builder composes clean WhatsApp message and valid wa.me URL', () => {
  const msg = buildQuickQuoteMessage({
    model: 'Caixa normal',
    print: 'Com a minha marca',
    dimensions: '40 x 30 x 25',
    quantity: '500',
  });

  assert.match(msg, /Modelo: Caixa normal/);
  assert.match(msg, /Impressão: Com a minha marca/);
  assert.match(msg, /Medidas: 40 x 30 x 25 cm/);
  assert.match(msg, /Quantidade: 500 un/);
  assert.match(msg, /\[site-montador\]$/);
  assert.doesNotMatch(msg, /—/, 'WhatsApp quote message must not contain em-dash');

  const url = buildQuickQuoteUrl('+55 (11) 99999-8888', {
    model: 'Corte e vinco',
    print: 'Caixa lisa (sem impressão)',
    dimensions: '',
    quantity: '200',
  });
  assert.ok(url.startsWith('https://wa.me/5511999998888?text='));
  assert.ok(decodeURIComponent(url).includes('Quantidade: 200 un'));
});

test('whatsappUrl appends source tag once and handles empty numbers gracefully', () => {
  const href = whatsappUrl('5511999990000', 'Olá!', 'hero');
  assert.equal(href, 'https://wa.me/5511999990000?text=Ol%C3%A1!%20%5Bsite-hero%5D');
  assert.equal(whatsappUrl('', 'Olá!', 'hero'), '#orcamento');
});

test('in-app WebView detector and dynamic years helper behave accurately', () => {
  assert.equal(isRestrictiveInAppBrowser('Mozilla/5.0 Instagram 302.0'), true);
  assert.equal(isRestrictiveInAppBrowser('Mozilla/5.0 FBAN/FBIOS'), true);
  assert.equal(isRestrictiveInAppBrowser('Mozilla/5.0 Chrome/125.0 Safari/537.36'), false);

  assert.equal(calculateYearsSince('2000', new Date('2026-05-01')), 26);
  assert.equal(calculateYearsSince('invalid'), null);
});

test('robotsTxt disallows crawling outside production and allows production', () => {
  assert.equal(robotsTxt({ dataMode: 'demo', siteUrl: '' }), 'User-agent: *\nDisallow: /\n');
  assert.equal(
    robotsTxt({ dataMode: 'production', siteUrl: 'https://vanpack.com.br/' }),
    'User-agent: *\nAllow: /\n\nSitemap: https://vanpack.com.br/sitemap.xml\n',
  );
});

test('renderPage rejects non-HTTPS map/rating URLs and breaks address lines cleanly', () => {
  const { content } = readContent(join(process.cwd(), 'content'));
  const site = createSiteConfig({ env: {}, content });
  const tampered = {
    ...site,
    mapUrl: 'javascript:alert(1)',
    proofs: {
      ...site.proofs,
      googleRating: { value: 4.9, count: 42, url: 'javascript:alert(2)' },
    },
  };
  const html = renderPage(
    '<div data-field="endereco" hidden><dt>End</dt><dd></dd></div>' +
      '<div data-field="mapa" hidden><dt>Mapa</dt><dd></dd></div>' +
      '<!--render:clientes-->',
    tampered,
  );
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /<br \/>/);
});
