// "O WhatsApp não abriu?" (src/handoff.js): se a página continua à vista 2,5 s depois do toque num
// botão do WhatsApp, sobe a folha com o número para copiar e o telefone; se a página sai de vista (o
// app abriu), nada acontece. Navegador embutido de rede social: código [site-…-ig] e a instrução de
// como sair dele. Relógio falso do Playwright; o wa.me nunca é acessado de verdade.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { loadEnv } from 'vite';
import { ROOT, launch, openPage, startServer } from '../scripts/lib.mjs';
import { inAppBrowser } from '../src/handoff.js';

// O mesmo número que o build usou (as variáveis do processo vencem o arquivo).
const number = loadEnv('production', ROOT, 'VITE_').VITE_WHATSAPP.replace(/\D/g, '');

const UA = {
  instagram:
    'Mozilla/5.0 (Linux; Android 14; SM-A145M Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36 Instagram 352.0.0.36.97 Android (34/14; 450dpi; 1080x2208; samsung; SM-A145M; a14; mt6769; pt_BR; 645012543)',
  facebook:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.37.104;FBBV/612345678;FBDV/iPhone14,7;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBCR/;FBID/phone;FBLC/pt_BR;FBOP/5]',
  messenger:
    'Mozilla/5.0 (Linux; Android 13; moto g(60)) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 [FB_IAB/MESSENGER;FBAV/475.0.0.43.109;]',
  tiktok:
    'Mozilla/5.0 (Linux; Android 12; M2101K6G Build/SKQ1.210908.001; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.6099.193 Mobile Safari/537.36 trill_350102 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/35.1.2 ByteLocale/pt-BR Region/BR BytedanceWebview/d8a21c6',
  chrome:
    'Mozilla/5.0 (Linux; Android 14; SM-A145M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  safari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
};
const MOBILE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};
const WAIT = 2600; // um pouco além dos 2,5 s da página

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

/**
 * Abre a página sem tour e com o relógio parado; o wa.me é barrado. A aba que o clique abre fica aberta
 * até o context.close() do teste: fechá-la na hora disputava com o relógio falso, que avança todas as
 * abas do contexto ("clock.runFor: Target page, context or browser has been closed", ~3 de 10 rodadas).
 */
const open = (contextOptions = {}) =>
  openPage(
    browser,
    `${server.url}?tour=0`,
    { reducedMotion: 'reduce', ...contextOptions },
    {
      setup: async ({ context }) => {
        await context.clock.install({ time: 0 });
        await context.clock.pauseAt(1000);
        await context.route(/^https:\/\/(wa\.me|api\.whatsapp\.com)\//, (route) => route.abort());
      },
    },
  );

const sheetOpen = (page) => page.evaluate(() => !document.querySelector('#zap-ajuda').hidden);
const layer = (page, event) =>
  page.evaluate((event) => window.dataLayer.filter((item) => item.event === event), event);
/** A aba sai de vista, como quando o app do WhatsApp abre por cima. */
const hide = (page) =>
  page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });

describe('o WhatsApp não abriu', () => {
  test('a página continua à vista: a folha sobe em 2,5 s, com o número, o telefone e o evento', async () => {
    const { page, context, problems } = await open(MOBILE);
    await page.click('[data-cta="hero"]');
    await page.clock.runFor(2000);
    assert.equal(await sheetOpen(page), false, 'ainda dentro do prazo');
    await page.clock.runFor(WAIT - 2000);
    assert.equal(await sheetOpen(page), true);
    const sheet = await page.evaluate(() => {
      const el = document.querySelector('#zap-ajuda');
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.replace(/\s+/g, ' '),
        copy: el.querySelector('[data-copy]').dataset.copy,
        tel: el.querySelector('a[href^="tel:"]')?.getAttribute('href') ?? '',
        focus: document.activeElement?.id,
        inapp: getComputedStyle(el.querySelector('.sheet-inapp')).display,
        targets: [...el.querySelectorAll('a, button')].map((t) => t.getBoundingClientRect().height),
        inside: r.top >= 0 && r.bottom <= innerHeight + 0.5 && r.left >= 0 && r.right <= innerWidth,
        scroll: document.documentElement.scrollWidth <= innerWidth,
      };
    });
    assert.match(sheet.text, /O WhatsApp não abriu\?/);
    assert.equal(sheet.copy, `+${number}`, 'copia o número do .env, com o +55');
    assert.ok(sheet.tel.startsWith('tel:'), 'botão de ligar');
    assert.equal(sheet.focus, 'zap-ajuda-t', 'o foco vai para a folha');
    assert.equal(sheet.inapp, 'none', 'fora de navegador embutido, sem a instrução');
    for (const height of sheet.targets) assert.ok(height >= 44 - 0.5, `alvo de ${height} px`);
    assert.ok(sheet.inside, 'inteira na tela');
    assert.ok(sheet.scroll, 'sem rolagem horizontal');
    const fails = await layer(page, 'handoff_fail');
    assert.deepEqual(
      fails.map((f) => f.cta),
      ['hero'],
    );
    assert.deepEqual(problems, []);
    await context.close();
  });

  test('o app abriu (a página saiu de vista): sem folha e sem evento', async () => {
    const { page, context } = await open(MOBILE);
    await page.click('[data-cta="hero"]');
    await page.clock.runFor(500);
    await hide(page);
    await page.clock.runFor(WAIT);
    assert.equal(await sheetOpen(page), false);
    assert.deepEqual(await layer(page, 'handoff_fail'), []);
    await context.close();
  });

  test('o app demorou a abrir: a folha que já tinha subido fecha sozinha', async () => {
    const { page, context } = await open(MOBILE);
    await page.click('[data-cta="hero"]');
    await page.clock.runFor(WAIT);
    assert.equal(await sheetOpen(page), true);
    await hide(page);
    assert.equal(await sheetOpen(page), false);
    await context.close();
  });

  test('Ctrl+clique (aba de fundo de propósito) não abre a folha', async () => {
    const { page, context } = await open();
    await page.click('[data-cta="hero"]', { modifiers: ['Control'] });
    await page.clock.runFor(WAIT);
    assert.equal(await sheetOpen(page), false);
    await context.close();
  });

  test('Esc e "Fechar" fecham a folha, e o foco volta ao botão tocado', async () => {
    const { page, context } = await open();
    await page.click('[data-cta="hero"]');
    await page.clock.runFor(WAIT);
    assert.equal(await sheetOpen(page), true);
    await page.keyboard.press('Escape');
    assert.equal(await sheetOpen(page), false, 'Esc fecha');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.cta), 'hero');
    await page.click('[data-cta="hero"]');
    await page.clock.runFor(WAIT);
    await page.click('#zap-ajuda .sheet-x');
    assert.equal(await sheetOpen(page), false, '"Fechar" fecha');
    await context.close();
  });

  test('"Copiar número" põe o número no clipboard e avisa', async () => {
    const { page, context } = await open({
      ...MOBILE,
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await page.click('[data-cta="hero"]');
    await page.clock.runFor(WAIT);
    await page.click('#zap-ajuda [data-copy]');
    await page.waitForFunction(
      () => document.querySelector('.sheet-status').textContent === 'Número copiado.',
      null,
      { timeout: 5000 },
    );
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `+${number}`);
    assert.deepEqual(
      (await layer(page, 'whatsapp_copy')).map((e) => e.ok),
      [true],
    );
    await context.close();
  });
});

describe('navegador embutido', () => {
  test('reconhece Instagram, Facebook, Messenger e TikTok pelo user agent', () => {
    assert.deepEqual(
      Object.fromEntries(Object.entries(UA).map(([name, ua]) => [name, inAppBrowser(ua)])),
      { instagram: 'ig', facebook: 'fb', messenger: 'fb', tiktok: 'tt', chrome: '', safari: '' },
    );
  });

  test('no Instagram: código [site-hero-ig], o evento com inapp e a instrução na folha', async () => {
    const { page, context } = await open({ ...MOBILE, userAgent: UA.instagram });
    await page.click('[data-cta="hero"]');
    const href = await page.getAttribute('[data-cta="hero"]', 'href');
    const text = new URL(href).searchParams.get('text');
    assert.ok(text.endsWith('[site-hero-ig]'), text);
    const clicks = await layer(page, 'whatsapp_click');
    assert.deepEqual(
      clicks.map((c) => [c.cta, c.inapp]),
      [['hero', 'ig']],
    );
    await page.clock.runFor(WAIT);
    assert.equal(await sheetOpen(page), true);
    const instruction = await page.evaluate(
      () => getComputedStyle(document.querySelector('#zap-ajuda .sheet-inapp')).display,
    );
    assert.notEqual(instruction, 'none', 'explica como abrir no navegador');
    // tocar de novo não repete o sufixo
    await page.click('#zap-ajuda .sheet-x');
    await page.click('[data-cta="hero"]');
    const again = new URL(await page.getAttribute('[data-cta="hero"]', 'href')).searchParams.get(
      'text',
    );
    assert.equal(again.split('-ig]').length, 2, again);
    await context.close();
  });
});
