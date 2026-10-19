// Conversão: todo botão do WhatsApp abre o número do .env com a mensagem pronta e o código de origem
// ([site-hero] etc.), nunca um wa.me/? sem número; a origem da campanha (utm_source e utm_campaign)
// entra no texto, sem cookie nem storage.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { loadEnv } from 'vite';
import { ROOT, launch, openPage, startServer } from '../scripts/lib.mjs';

// O mesmo número que o build usou (as variáveis do processo vencem o arquivo).
const number = loadEnv('production', ROOT, 'VITE_').VITE_WHATSAPP.replace(/\D/g, '');

/** Cada botão do WhatsApp do HTML publicado: { cta, href, number, text }. */
function whatsappButtons(html) {
  return [...html.matchAll(/<a\b[^>]*>/g)]
    .map(([tag]) => tag)
    .filter((tag) => /\sdata-cta="/.test(tag))
    .map((tag) => {
      const href = /\shref="([^"]*)"/.exec(tag)?.[1] ?? '';
      const url = new URL(href.replaceAll('&amp;', '&'), 'https://invalido.test/');
      return {
        cta: /\sdata-cta="([^"]*)"/.exec(tag)[1],
        href,
        number: url.pathname.slice(1),
        text: url.searchParams.get('text') ?? '',
      };
    });
}

describe('botões do WhatsApp no HTML publicado', () => {
  const buttons = whatsappButtons(readFileSync(`${ROOT}dist/index.html`, 'utf8'));

  test('há os 4 botões e nenhum abre wa.me sem número', () => {
    assert.ok(buttons.length >= 4, `só ${buttons.length} botões`);
    for (const button of buttons) {
      assert.ok(!button.href.startsWith('https://wa.me/?'), `${button.cta}: wa.me sem número`);
      assert.ok(button.href.startsWith('https://wa.me/'), `${button.cta}: ${button.href}`);
    }
  });

  test('o número tem 12 ou 13 dígitos e é o do .env', () => {
    for (const button of buttons) {
      assert.match(button.number, /^55\d{10,11}$/, `${button.cta}: ${button.number}`);
      assert.equal(button.number, number, `${button.cta}: número diferente do .env`);
    }
  });

  test('a mensagem termina com o código de origem do botão', () => {
    for (const button of buttons) {
      assert.ok(button.text.startsWith('Olá!'), `${button.cta}: mensagem pronta`);
      // campo em branco para editar no teclado do celular é motivo para não enviar
      assert.ok(!button.text.includes('___'), `${button.cta}: mensagem curta, sem lacunas`);
      assert.ok(
        button.text.endsWith(`[site-${button.cta}]`),
        `${button.cta}: "${button.text}" deveria terminar em [site-${button.cta}]`,
      );
    }
    assert.deepEqual(
      ['flutuante', 'header', 'hero', 'orcamento'].filter((c) => !buttons.some((b) => b.cta === c)),
      [],
      'os 4 botões da página têm código',
    );
  });
});

describe('origem da campanha na mensagem', () => {
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

  /** Abre a página com a query, clica no botão (sem navegar) e devolve o texto do link e o contexto. */
  async function clickHero(query) {
    const { page, context } = await openPage(browser, `${server.url}?tour=0${query}`, {
      reducedMotion: 'reduce',
    });
    // o clique não pode sair da página: o link só é lido depois do tratamento da própria página
    await page.evaluate(() => document.addEventListener('click', (e) => e.preventDefault(), true));
    await page.click('[data-cta="hero"]');
    const href = await page.getAttribute('[data-cta="hero"]', 'href');
    return { page, context, text: new URL(href).searchParams.get('text') };
  }

  test('utm_source e utm_campaign entram no texto, sem cookie nem storage', async () => {
    const { page, context, text } = await clickHero('&utm_source=google&utm_campaign=black-friday');
    assert.ok(text.endsWith('[site-hero] [utm: google/black-friday]'), text);
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    await context.close();
  });

  test('clicar duas vezes não repete a origem', async () => {
    const { page, context } = await clickHero('&utm_source=google');
    await page.click('[data-cta="hero"]');
    const href = await page.getAttribute('[data-cta="hero"]', 'href');
    const text = new URL(href).searchParams.get('text');
    assert.equal(text.split('[utm:').length, 2, text);
    await context.close();
  });

  test('sem campanha a mensagem fica como veio do build', async () => {
    const { context, text } = await clickHero('');
    assert.ok(text.endsWith('[site-hero]') && !text.includes('utm'), text);
    await context.close();
  });

  test('valores estranhos ou longos demais são ignorados (nada de texto injetado)', async () => {
    const long = 'a'.repeat(41);
    const { context, text } = await clickHero(
      `&utm_source=${encodeURIComponent('<b>oi</b> ligue 0800')}&utm_campaign=${long}`,
    );
    assert.ok(text.endsWith('[site-hero]') && !text.includes('utm'), text);
    await context.close();
  });
});
