// Faixa de confiança (#confianca) e textos que dependem da data: os anos de mercado e o © são
// calculados do ano de fundação do .env e recalculados no navegador, então viram o ano sozinhos.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loadEnv } from 'vite';
import { ROOT, launch, openPage, startServer } from '../scripts/lib.mjs';

const env = loadEnv('production', ROOT, 'VITE_');
const founded = Number(env.VITE_FOUNDED_YEAR);

let server;
let browser;
before(async () => {
  server = await startServer('dist');
  browser = await launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

const open = (options = {}, setup) =>
  openPage(browser, `${server.url}?tour=0`, { reducedMotion: 'reduce', ...options }, { setup });

describe('faixa de confiança', () => {
  test('mostra cidade, CNPJ, anos de mercado, mapa e telefone do .env, sem e-mail', async () => {
    const { page, context } = await open();
    const strip = await page.evaluate(() => {
      const el = document.querySelector('#confianca');
      return {
        text: el.innerText.replace(/\s+/g, ' '),
        hrefs: [...el.querySelectorAll('a')].map((a) => a.getAttribute('href')),
      };
    });
    const years = new Date().getFullYear() - founded;
    assert.ok(
      strip.text.includes(`Fábrica própria em ${env.VITE_CITY}-${env.VITE_STATE}`),
      strip.text,
    );
    assert.ok(strip.text.includes(`CNPJ ${env.VITE_CNPJ}`), strip.text);
    assert.ok(strip.text.includes(`${years} anos de mercado`), strip.text);
    assert.ok(strip.text.includes('Nunca pedimos pagamento para conta de pessoa física'));
    if (env.VITE_PAYMENT_METHODS) {
      assert.ok(strip.text.includes(`Pagamento: ${env.VITE_PAYMENT_METHODS}`), strip.text);
    }
    for (const href of [`tel:${env.VITE_PHONE}`, env.VITE_MAP_URL]) {
      assert.ok(strip.hrefs.includes(href), `${href} falta nos links: ${strip.hrefs}`);
    }
    assert.ok(!strip.hrefs.some((href) => href.startsWith('mailto:')), 'sem e-mail');
    await context.close();
  });

  test('anos de mercado e © são recalculados no navegador (relógio em 2031)', async () => {
    const { page, context } = await open({}, ({ context }) =>
      context.clock.install({ time: new Date('2031-06-01T12:00:00Z') }),
    );
    assert.equal(await page.textContent('[data-since]'), String(2031 - founded));
    assert.equal(await page.textContent('[data-year]'), '2031');
    assert.ok((await page.textContent('#confianca')).includes('anos de mercado'));
    await context.close();
  });

  for (const [name, options] of [
    ['1440×900', { viewport: { width: 1440, height: 900 } }],
    [
      '390×844 (celular)',
      {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      },
    ],
  ]) {
    test(`${name}: sem rolagem horizontal e links com 44 px de altura`, async () => {
      const { page, context } = await open(options);
      await page.evaluate(() => document.querySelector('#confianca').scrollIntoView());
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth - innerWidth,
        heights: [...document.querySelectorAll('#confianca a')].map(
          (a) => a.getBoundingClientRect().height,
        ),
      }));
      assert.ok(result.overflow <= 0, `rolagem horizontal de ${result.overflow}px`);
      assert.ok(result.heights.length >= 2);
      for (const h of result.heights) assert.ok(h >= 43.5, `link com ${h}px de altura`);
      await context.close();
    });
  }
});
