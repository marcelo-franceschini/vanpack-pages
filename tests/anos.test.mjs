// Textos que dependem da data: os anos de mercado (cartão 2 da história) e o © (rodapé) são calculados do
// ano de fundação de content/empresa.yaml e recalculados no navegador, então viram o ano sozinhos.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer } from '../scripts/lib.mjs';
import { baseContent } from './dados.mjs';

const founded = Number(baseContent.empresa.ano_fundacao);

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

describe('anos de mercado e ©', () => {
  test('o build escreve os anos de mercado e o ano do ©', async () => {
    const { page, context } = await open();
    const years = new Date().getFullYear() - founded;
    assert.equal(await page.textContent('[data-since]'), String(years));
    assert.equal(await page.textContent('[data-year]'), String(new Date().getFullYear()));
    assert.ok((await page.textContent('.card h2')).includes('anos de mercado'));
    await context.close();
  });

  test('anos de mercado e © são recalculados no navegador (relógio em 2031)', async () => {
    const { page, context } = await open({}, ({ context }) =>
      context.clock.install({ time: new Date('2031-06-01T12:00:00Z') }),
    );
    assert.equal(await page.textContent('[data-since]'), String(2031 - founded));
    assert.equal(await page.textContent('[data-year]'), '2031');
    await context.close();
  });
});
