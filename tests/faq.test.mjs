// FAQ (<details>/<summary>): abre e fecha por teclado, o foco é visível e só a abertura vira o evento
// faq_open (o evento `toggle` não borbulha, então a página o escuta em fase de captura).
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer } from '../scripts/lib.mjs';

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

describe('FAQ', () => {
  test('abre e fecha por teclado, com foco visível, e só abrir gera faq_open', async () => {
    const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
      reducedMotion: 'reduce',
    });
    const questions = await page.locator('#faq summary').count();
    assert.ok(questions >= 3, `${questions} perguntas`);
    await page.locator('#faq summary').first().focus();
    await page.keyboard.press('Enter');
    const first = page.locator('#faq details').first();
    assert.equal(await first.evaluate((el) => el.open), true, 'Enter abre');
    const focus = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement);
      return {
        tag: document.activeElement.tagName,
        outline: parseFloat(style.outlineWidth),
        height: document.activeElement.getBoundingClientRect().height,
      };
    });
    assert.equal(focus.tag, 'SUMMARY');
    assert.ok(focus.outline >= 3, 'contorno de foco de 3 px');
    assert.ok(focus.height >= 44, `a pergunta tem ${focus.height}px de altura`);
    // o `toggle` chega depois (tarefa assíncrona): abrir e fechar no mesmo instante o fundiria
    await page.waitForFunction(
      () => window.dataLayer.some((item) => item.event === 'faq_open'),
      null,
      {
        timeout: 5000,
      },
    );
    await page.keyboard.press('Space');
    assert.equal(await first.evaluate((el) => el.open), false, 'Espaço fecha');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    // o `toggle` do <details> chega de forma assíncrona: espera a 2ª abertura
    await page.waitForFunction(
      () => window.dataLayer.filter((item) => item.event === 'faq_open').length >= 2,
      null,
      { timeout: 5000 },
    );
    const events = await page.evaluate(() =>
      window.dataLayer.filter((item) => item.event === 'faq_open').map((item) => item.question_id),
    );
    assert.equal(events.length, 2, 'duas aberturas e nenhum evento ao fechar');
    assert.notEqual(events[0], events[1]);
    await context.close();
  });

  test('o link FAQ do cabeçalho leva à seção', async () => {
    const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
      reducedMotion: 'reduce',
    });
    await page.click('.nav a[href="#faq"]');
    await page.waitForFunction(() => location.hash === '#faq');
    await page.waitForFunction(
      () => document.querySelector('#faq').getBoundingClientRect().top < 200,
    );
    await context.close();
  });
});
