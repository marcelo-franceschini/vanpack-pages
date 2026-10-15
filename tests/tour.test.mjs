// Tour automático: começa sozinho, rola a página até o fim da história e para; qualquer interação
// interrompe e ele nunca retoma sozinho. O relógio é falso (Playwright), então os ~32 s do tour
// passam em instantes; a cena continua renderizando no worker em tempo real.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer, tourState, yAtProgress } from '../scripts/lib.mjs';

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

// Relógio falso e parado: o tempo só anda quando o teste manda (advance), então nada acontece
// "entre" um gesto do teste e a reação da página.
const freezeClock = async ({ context }) => {
  await context.clock.install({ time: 0 });
  await context.clock.pauseAt(1000);
};
const withClock = { setup: freezeClock };
const open = (query = '', contextOptions = {}) =>
  openPage(browser, server.url + query, contextOptions, withClock);
const scrollY = (page) => page.evaluate(() => scrollY);
const activeCard = (page) =>
  page.evaluate(
    () => [...document.querySelectorAll('.card')].findIndex((c) => c.classList.contains('on')) + 1,
  );
const dockPulses = (page) =>
  page.evaluate(() => document.querySelector('#hdr .btn').classList.contains('pulse'));

/** Avança o relógio em passos de 1 s (dá tempo ao navegador de processar o scroll entre eles). */
async function advance(page, ms) {
  for (let left = ms; left > 0; left -= 1000) await page.clock.runFor(Math.min(1000, left));
}

/** Põe o tour em andamento (começa sozinho 0,8 s depois da cena pronta) e passa `ms`. */
async function playFor(page, ms) {
  await advance(page, 900);
  assert.equal(await tourState(page), 'playing');
  await advance(page, ms);
}

describe('autoplay', () => {
  test('começa sozinho 0,8 s depois de a cena ficar pronta, no topo da página', async () => {
    const { page, context, problems } = await open();
    assert.equal(await tourState(page), 'idle');
    assert.equal(await scrollY(page), 0);
    await page.clock.runFor(700);
    assert.equal(await tourState(page), 'idle', 'ainda dentro dos 0,8 s');
    await page.clock.runFor(200);
    assert.equal(await tourState(page), 'playing');
    await advance(page, 6000);
    assert.ok(
      (await scrollY(page)) > 100,
      'a página começa a rolar depois da pausa do 1º capítulo',
    );
    assert.deepEqual(problems, []);
    await context.close();
  });

  test('passa pelos 5 capítulos, termina em p = 1 e não rola para as seções seguintes', async () => {
    const { page, context } = await open();
    await advance(page, 900);
    const end = await yAtProgress(page, 1);
    const seen = new Set();
    let maxY = 0;
    for (let t = 0; t < 40; t++) {
      await advance(page, 1000);
      seen.add(await activeCard(page));
      maxY = Math.max(maxY, await scrollY(page));
      if ((await tourState(page)) === 'done') break;
    }
    await advance(page, 100); // o quadro que atualiza o cartão depois do último scroll
    seen.add(await activeCard(page));
    assert.equal(await tourState(page), 'done');
    assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5], 'todos os cartões apareceram');
    assert.ok(Math.abs((await scrollY(page)) - end) <= 3, `parou no fim da história (${end})`);
    assert.ok(maxY <= end + 3, 'nunca passou do fim da história');
    await advance(page, 15_000);
    assert.ok(
      Math.abs((await scrollY(page)) - end) <= 3,
      'continua parado no fim, com o scroll já abaixado',
    );
    assert.equal(await tourState(page), 'done');
    assert.equal(await activeCard(page), 5);
    await context.close();
  });

  test('a duração total do tour fica perto de 32 s (4,5 s de pausa inicial + 5 s por capítulo)', async () => {
    const { page, context } = await open();
    await advance(page, 900);
    let elapsed = 0;
    while ((await tourState(page)) !== 'done' && elapsed < 60_000) {
      await advance(page, 500);
      elapsed += 500;
    }
    assert.ok(elapsed > 28_000 && elapsed < 36_000, `durou ${elapsed} ms`);
    await context.close();
  });

  test('o botão "Pedir orçamento" do cabeçalho pulsa quando o tour termina', async () => {
    const { page, context } = await open();
    await playFor(page, 20_000);
    assert.equal(await dockPulses(page), false, 'não pulsa durante o tour');
    await advance(page, 20_000);
    assert.equal(await tourState(page), 'done');
    assert.equal(await dockPulses(page), true);
    await context.close();
  });

  test('em tempo real a página começa a rolar sozinha', async () => {
    const { page, context } = await openPage(browser, server.url);
    await page.waitForFunction(
      () => document.querySelector('.story').dataset.tour === 'playing',
      null,
      {
        timeout: 10_000,
      },
    );
    await page.waitForFunction(() => scrollY > 80, null, { timeout: 15_000 });
    await context.close();
  });
});

describe('interrupção', () => {
  /** Cada gesto da pessoa deve pausar na hora e o tour nunca mais retoma sozinho. */
  const gestures = {
    'roda do mouse': { run: (page) => page.mouse.wheel(0, 60), scrolls: true },
    tecla: { run: (page) => page.keyboard.press('a') },
    clique: { run: (page) => page.mouse.click(900, 300) },
    toque: {
      options: { hasTouch: true, viewport: { width: 390, height: 844 } },
      run: (page) => page.touchscreen.tap(200, 250),
    },
    'scroll fora do tour (barra de rolagem)': {
      run: (page) => page.evaluate(() => scrollBy(0, 70)),
      scrolls: true,
    },
  };

  for (const [name, gesture] of Object.entries(gestures)) {
    test(`${name} pausa o tour e ele não retoma`, async () => {
      const { page, context } = await open('', gesture.options);
      await playFor(page, 6000);
      assert.equal(await tourState(page), 'playing');
      await gesture.run(page);
      await page.waitForFunction(
        () => document.querySelector('.story').dataset.tour === 'paused',
        null,
        {
          timeout: 5000,
        },
      );
      await page.waitForTimeout(600); // o scroll da própria pessoa (suave) termina
      const stopped = await scrollY(page);
      await advance(page, 40_000);
      assert.equal(await tourState(page), 'paused', 'continua pausado');
      assert.equal(await scrollY(page), stopped, 'a página não anda mais sozinha');
      await context.close();
    });
  }

  test('esconder a aba durante o tour também pausa', async () => {
    const { page, context } = await open();
    await playFor(page, 5000);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await tourState(page), 'paused');
    await context.close();
  });

  test('controles do próprio tour ("Ver como fazemos") não o interrompem', async () => {
    const { page, context } = await open('?tour=0');
    await page.click('#tour-start');
    assert.equal(await tourState(page), 'playing');
    await advance(page, 3000);
    assert.equal(await tourState(page), 'playing');
    await context.close();
  });
});

describe('quando não começa sozinho', () => {
  test('?tour=0 desliga o autoplay', async () => {
    const { page, context } = await open('?tour=0');
    await advance(page, 10_000);
    assert.equal(await tourState(page), 'idle');
    assert.equal(await scrollY(page), 0);
    await context.close();
  });

  test('com #hash na URL a página não rola sozinha', async () => {
    const { page, context } = await open('#diferenciais');
    await advance(page, 10_000);
    assert.equal(await tourState(page), 'idle');
    await context.close();
  });

  test('se a pessoa já rolou antes do início, o tour não começa', async () => {
    const { page, context } = await open();
    await page.mouse.wheel(0, 200);
    // o relógio só avança depois de a página ter processado o gesto (o scroll já começou)
    await page.waitForFunction(() => scrollY > 0, null, { timeout: 10_000 });
    await advance(page, 10_000);
    assert.equal(await tourState(page), 'idle');
    await context.close();
  });

  test('aba aberta em segundo plano: espera a pessoa voltar para começar', async () => {
    const { page, context } = await openPage(
      browser,
      server.url,
      {},
      {
        setup: async ({ context, page }) => {
          await freezeClock({ context });
          await page.addInitScript(() => {
            window.__hidden = true;
            Object.defineProperty(document, 'hidden', {
              configurable: true,
              get: () => window.__hidden,
            });
          });
        },
      },
    );
    await advance(page, 5000);
    assert.equal(await tourState(page), 'idle', 'oculta: nada de rolar sozinho');
    await page.evaluate(() => {
      window.__hidden = false;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(page, 1200);
    assert.equal(await tourState(page), 'playing');
    await context.close();
  });

  test('prefers-reduced-motion: sem autoplay; "Ver como fazemos" leva ao capítulo 2', async () => {
    const { page, context } = await open('', { reducedMotion: 'reduce' });
    await advance(page, 10_000);
    assert.equal(await tourState(page), 'idle');
    assert.equal(await scrollY(page), 0);
    assert.equal(await page.evaluate(() => document.querySelector('.scrollcue') !== null), true);
    await page.click('#tour-start');
    // o scroll chega por um evento do navegador (tempo real) e o quadro que troca o cartão é um rAF
    // falso: avança o relógio e espera um pouco de tempo real, até 10 s
    for (let i = 0; i < 100 && (await activeCard(page)) !== 2; i++) {
      await advance(page, 100);
      await page.waitForTimeout(100);
    }
    assert.equal(await activeCard(page), 2);
    assert.equal(await tourState(page), 'idle', 'o tour não é usado com movimento reduzido');
    const target = await yAtProgress(page, 0.25);
    assert.ok(Math.abs((await scrollY(page)) - target) <= 3, 'rolou direto ao capítulo 2');
    await context.close();
  });

  test('se o usuário ligar movimento reduzido no meio do tour, ele pausa', async () => {
    const { page, context } = await open();
    await playFor(page, 4000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(
      () => document.querySelector('.story').dataset.tour === 'paused',
      null,
      {
        timeout: 5000,
      },
    );
    await context.close();
  });
});
