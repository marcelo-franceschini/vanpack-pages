// Robustez do render: sem WebGL a página continua legível e navegável; se o worker falhar, o render
// cai para a thread principal; se o contexto WebGL for perdido, volta sozinho quando restaurado.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, scrollToProgress, startServer, tourState } from '../scripts/lib.mjs';

let prod;
let audit;
let browser;
before(async () => {
  prod = await startServer('dist');
  audit = await startServer('dist-audit');
  browser = await launch();
});
after(async () => {
  await browser.close();
  await prod.close();
  await audit.close();
});

// O Chrome sem --disable-3d-apis só desliga o WebGL da página; o worker (OffscreenCanvas) ainda criaria
// contexto. Esta interceptação tira o WebGL do worker também: getContext() devolve null.
const withoutWorkerGl = ({ page }) =>
  page.route('**/assets/worker-*.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({
      response,
      body: `OffscreenCanvas.prototype.getContext = () => null;\n${body}`,
    });
  });
const settled = { waitFor: 'settled', setup: withoutWorkerGl };
const stats = (page) => page.evaluate(() => window.__audit?.stats ?? null);

describe('sem WebGL', () => {
  let noGl;
  before(async () => {
    noGl = await launch(['--disable-3d-apis', '--disable-webgl', '--disable-webgl2']);
  });
  after(async () => noGl.close());

  test('o navegador de teste realmente não tem WebGL', async () => {
    const page = await (await noGl.newContext()).newPage();
    await page.goto(prod.url);
    const has = await page.evaluate(() =>
      Boolean(
        document.createElement('canvas').getContext('webgl2') ||
        document.createElement('canvas').getContext('webgl'),
      ),
    );
    assert.equal(has, false);
    await page.close();
  });

  test('fundo Papel, símbolo e cartões legíveis; sem erro de script e sem tour', async () => {
    const { page, context, problems } = await openPage(
      noGl,
      prod.url,
      { reducedMotion: 'no-preference' },
      settled,
    );
    assert.equal(await page.locator('.stage.no-gl').count(), 1);
    assert.equal(await page.locator('.stage.ready').count(), 0);
    // o símbolo da marca continua à vista e o cartão do capítulo 1 está inteiro e legível
    const symbol = await page.locator('.loader img').boundingBox();
    assert.ok(symbol.width >= 64 && symbol.height >= 64);
    assert.equal(
      await page.evaluate(() => getComputedStyle(document.querySelector('.loader')).visibility),
      'visible',
    );
    const card = await page.locator('.card.on').boundingBox();
    assert.ok(card.width > 200 && card.height > 100);
    const background = await page.evaluate(
      () => getComputedStyle(document.querySelector('.stage')).backgroundColor,
    );
    assert.equal(background, 'rgb(251, 248, 242)', 'fundo Papel');
    // sem 3D não há tour: a página não rola sozinha
    await page.waitForTimeout(2500);
    assert.equal(await tourState(page), 'idle');
    assert.equal(await page.evaluate(() => scrollY), 0);
    assert.deepEqual(
      problems.filter((p) => p.startsWith('pageerror')),
      [],
    );
    await context.close();
  });

  test('a navegação funciona: rolar troca os cartões e o "Ver como fazemos" leva ao capítulo 2', async () => {
    const { page, context } = await openPage(noGl, prod.url, { reducedMotion: 'reduce' }, settled);
    await page.click('#tour-start');
    await page.waitForFunction(
      () => document.querySelectorAll('.card')[1].classList.contains('on'),
      null,
      {
        timeout: 10_000,
      },
    );
    for (const p of [0.5, 0.75, 1, 0]) await scrollToProgress(page, p);
    // o botão do WhatsApp do cabeçalho continua com link
    const href = await page.getAttribute('#hdr .btn', 'href');
    assert.match(href, /^https:\/\/wa\.me\//);
    await context.close();
  });
});

describe('fallback na thread principal', () => {
  test('sem transferControlToOffscreen o render roda na página', async () => {
    const { page, context, problems } = await openPage(
      browser,
      audit.url,
      {},
      {
        waitFor: 'ready',
        setup: ({ page }) =>
          page.addInitScript(() => {
            delete HTMLCanvasElement.prototype.transferControlToOffscreen;
          }),
      },
    );
    await page.waitForFunction(() => window.__audit?.stats?.frames >= 1, null, { timeout: 30_000 });
    assert.deepEqual(problems, []);
    await context.close();
  });

  test('se o worker não carregar, cai para a thread principal e a cena aparece', async () => {
    const { page, context, problems } = await openPage(
      browser,
      audit.url,
      {},
      {
        waitFor: 'ready',
        setup: ({ page }) => page.route('**/assets/worker-*.js', (route) => route.abort()),
      },
    );
    assert.equal(await page.locator('.stage.ready').count(), 1);
    await page.waitForFunction(() => window.__audit?.stats?.frames >= 1, null, { timeout: 30_000 });
    assert.ok(
      problems.some((p) => p.includes('Render em worker indisponível')),
      'avisa no console que usou a thread principal',
    );
    assert.deepEqual(
      problems.filter((p) => p.startsWith('pageerror')),
      [],
    );
    await context.close();
  });
});

describe('contexto WebGL perdido', () => {
  test('o canvas some enquanto o contexto está perdido e a cena volta quando ele é restaurado', async () => {
    const { page, context, problems } = await openPage(browser, audit.url + '?tour=0', {
      reducedMotion: 'reduce',
    });
    await scrollToProgress(page, 0.5);
    await page.waitForFunction(
      () => window.__audit?.stats?.p === 0.5 || Math.abs(window.__audit.stats.p - 0.5) < 0.01,
    );
    const before = (await stats(page)).frames;
    await page.evaluate(() => window.__audit.loseContext());
    await page.waitForFunction(
      () => !document.querySelector('.stage').classList.contains('ready'),
      null,
      {
        timeout: 10_000,
      },
    );
    await page.waitForFunction(
      () => document.querySelector('.stage').classList.contains('ready'),
      null,
      {
        timeout: 20_000,
      },
    );
    // depois de restaurar, a cena responde ao scroll de novo
    await scrollToProgress(page, 0.75);
    await page.waitForFunction(
      (n) => window.__audit.stats.frames > n && Math.abs(window.__audit.stats.p - 0.75) < 0.01,
      before,
      {
        timeout: 30_000,
      },
    );
    assert.deepEqual(
      problems.filter((p) => p.startsWith('pageerror')),
      [],
    );
    await context.close();
  });
});
