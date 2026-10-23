// Carrossel de clientes (src/carrossel.js): esteira automática da direita para a esquerda em qualquer
// largura e SEM nenhum controle (nem pausa, nem setas); pausa sozinha (mouse, foco de teclado, toque,
// aba oculta e fora da tela), movimento reduzido (parada), poucos itens (a esteira anda do mesmo jeito),
// cópias fora da leitura e do foco, e layout sem sobreposição nem rolagem horizontal.
// A lista de clientes de content/ pode ter qualquer tamanho: cada teste põe no HTML servido a
// quantidade de cartões de que precisa (`items`), com nomes "Cliente 1", "Cliente 2"...
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer } from '../scripts/lib.mjs';

const SCREENS = {
  '1440×900': { viewport: { width: 1440, height: 900 } },
  '390×844': {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
};
const MANY = 8; // anda em qualquer largura (a esteira anda a partir de 6 em 1440 e de 3 em 390)

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
 * Abre a página com o carrossel no meio da tela, com `items` clientes no HTML servido. Sem `expected`,
 * espera o estado de quem anda (ou de quem está pausado, com movimento reduzido).
 */
async function open(screen, { reducedMotion = 'no-preference', items = MANY, expected } = {}) {
  const opened = await openPage(
    browser,
    `${server.url}?tour=0`,
    { reducedMotion, ...SCREENS[screen] },
    {
      waitFor: 'settled',
      setup: ({ page }) =>
        page.route(
          (url) => url.pathname === '/',
          async (route) => {
            const response = await route.fetch();
            const list = Array.from(
              { length: items },
              (_, i) => `<li class="cliente"><span class="logo-name">Cliente ${i + 1}</span></li>`,
            ).join('');
            const body = (await response.text()).replace(
              /(<ul class="carrossel-trilho">)[\s\S]*?(<\/ul>)/,
              (_, open, close) => open + list + close,
            );
            await route.fulfill({ response, body });
          },
        ),
    },
  );
  const { page } = opened;
  await page.evaluate(() =>
    document.querySelector('#clientes').scrollIntoView({ block: 'center' }),
  );
  // o IntersectionObserver vê o carrossel na tela e solta a pausa de "fora da tela"
  const state = expected ?? (reducedMotion === 'reduce' ? 'pausado' : 'rodando');
  await page.waitForFunction(
    (state) => document.querySelector('.carrossel')?.dataset.estado === state,
    state,
    { timeout: 10_000 },
  );
  return opened;
}

/** Deslocamento do trilho (px) e a largura de um conjunto de itens (a volta). */
const position = (page) =>
  page.evaluate(() => {
    const track = document.querySelector('.carrossel-trilho');
    const items = track.querySelectorAll('.cliente:not([aria-hidden])');
    const step = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : 0;
    return {
      x: new DOMMatrix(getComputedStyle(track).transform).m41,
      t: performance.now(), // quando a leitura foi feita: a velocidade usa o tempo real entre duas
      step,
      loop: items.length * step,
    };
  });

/** Quanto o trilho andou para a esquerda entre duas leituras, na volta da esteira. */
const leftward = (a, b) => (((a.x - b.x) % a.loop) + a.loop) % a.loop;
const estado = (page) => page.evaluate(() => document.querySelector('.carrossel').dataset.estado);

async function still(page, ms = 700) {
  const a = await position(page);
  await page.waitForTimeout(ms);
  const b = await position(page);
  return Math.abs(a.x - b.x) < 0.5;
}

async function moving(page, ms = 1000) {
  const a = await position(page);
  await page.waitForTimeout(ms);
  const moved = leftward(a, await position(page));
  return moved > 5 && moved < a.loop / 2;
}

for (const screen of Object.keys(SCREENS)) {
  describe(`carrossel em ${screen}`, () => {
    test('anda sozinho, da direita para a esquerda, devagar', async () => {
      const { page, context, problems } = await open(screen);
      assert.equal(await estado(page), 'rodando');
      // a esteira só parte no 1º quadro da animação, que atrasa se a máquina estiver ocupada: espera
      // ela andar e mede a velocidade (px/s) pelo tempo real entre as duas leituras, não por 1 s fixo
      const start = await position(page);
      await page.waitForFunction(
        (x) =>
          new DOMMatrix(getComputedStyle(document.querySelector('.carrossel-trilho')).transform)
            .m41 !== x,
        start.x,
        { timeout: 10_000 },
      );
      const a = await position(page);
      await page.waitForTimeout(1000);
      const b = await position(page);
      const speed = (leftward(a, b) / (b.t - a.t)) * 1000;
      assert.ok(speed > 15 && speed < 60, `andou a ${speed.toFixed(1)} px/s`);
      assert.deepEqual(problems, []);
      await context.close();
    });

    test(`cópias do loop ficam fora da leitura e do foco; só os ${MANY} originais são lidos`, async () => {
      const { page, context } = await open(screen);
      const info = await page.evaluate(() => {
        const items = [...document.querySelectorAll('.carrossel-trilho .cliente')];
        const copies = items.filter((li) => li.getAttribute('aria-hidden') === 'true');
        return {
          total: items.length,
          copies: copies.length,
          inert: copies.every((li) => li.inert),
          originals: items.filter((li) => !li.hasAttribute('aria-hidden') && !li.inert).length,
        };
      });
      assert.equal(info.originals, MANY);
      assert.ok(info.copies >= MANY && info.copies % MANY === 0, `${info.copies} cópias`);
      assert.ok(info.inert, 'toda cópia é inert');
      const snapshot = await page.locator('.carrossel-trilho').ariaSnapshot();
      assert.equal((snapshot.match(/- listitem/g) ?? []).length, MANY, snapshot);
      assert.equal((snapshot.match(/Cliente 1\b/g) ?? []).length, 1, 'sem leitura duplicada');
      await context.close();
    });

    test('não tem nenhum controle: nem botão de pausa, nem setas', async () => {
      const { page, context } = await open(screen);
      const controls = await page.evaluate(() => {
        const area = document.querySelector('#clientes');
        return {
          buttons: area.querySelectorAll('button, [role="button"], input').length,
          links: area.querySelectorAll('a[href]').length,
          legacy: area.querySelectorAll('[data-acao], .carrossel-controles, .carrossel-btn').length,
        };
      });
      assert.deepEqual(controls, { buttons: 0, links: 0, legacy: 0 });
      await context.close();
    });
  });
}

describe('carrossel: pausas automáticas (mouse, teclado e toque)', () => {
  test('mouse em cima pausa e, ao sair, volta a andar', async () => {
    const { page, context } = await open('1440×900');
    await page.locator('.carrossel-janela').hover();
    await page.waitForTimeout(200);
    assert.equal(await estado(page), 'pausado');
    assert.ok(await still(page), 'parado com o mouse em cima');
    await page.mouse.move(5, 5);
    assert.ok(await moving(page), 'voltou a andar');
    await context.close();
  });

  test('foco de teclado pausa e, ao sair, volta a andar', async () => {
    const { page, context } = await open('1440×900');
    await page.locator('.carrossel-janela').focus();
    assert.equal(
      await page.evaluate(() => document.activeElement.matches('.carrossel-janela:focus-visible')),
      true,
    );
    assert.equal(await estado(page), 'pausado');
    assert.ok(await still(page), 'parado com foco');
    const a = await position(page);
    await page.keyboard.press('ArrowRight');
    assert.ok(await still(page, 400), 'as setas do teclado não movem a esteira');
    assert.ok(Math.abs((await position(page)).x - a.x) < 0.5);
    await page.locator('.carrossel-janela').blur(); // o foco sai da região (o Tab levaria a rolagem à próxima seção e a esteira pararia por estar fora da tela)
    assert.ok(await moving(page), 'voltou a andar sem o foco');
    await context.close();
  });

  test('clicar na faixa com o mouse não deixa a esteira parada depois que o mouse sai', async () => {
    const { page, context } = await open('1440×900');
    await page.locator('.carrossel-janela').click();
    await page.mouse.move(5, 5);
    assert.ok(await moving(page), 'o clique dá foco, mas não é foco de teclado');
    await context.close();
  });

  test('tocar com o dedo pausa e a esteira retoma sozinha depois de soltar', async () => {
    const { page, context } = await open('390×844');
    const cdp = await context.newCDPSession(page);
    const box = await page.locator('.carrossel-janela').boundingBox();
    const y = box.y + box.height / 2;
    const touch = (type, x) =>
      cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: type === 'touchEnd' ? [] : [{ x, y }],
      });
    await touch('touchStart', box.x + 300);
    await page.waitForTimeout(100);
    assert.equal(await estado(page), 'pausado', 'parado ao tocar');
    await touch('touchEnd');
    assert.equal(await estado(page), 'pausado', 'ainda parado logo depois de soltar');
    await page.waitForFunction(
      () => document.querySelector('.carrossel').dataset.estado === 'rodando',
      null,
      { timeout: 4000 },
    );
    await context.close();
  });
});

describe('carrossel: aba oculta e fora da tela', () => {
  test('pausa com a aba oculta e volta ao reaparecer', async () => {
    const { page, context } = await open('390×844');
    const setHidden = (hidden) =>
      page.evaluate((hidden) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    assert.equal(await estado(page), 'pausado');
    assert.ok(await still(page), 'parado com a aba oculta');
    await setHidden(false);
    assert.equal(await estado(page), 'rodando');
    await context.close();
  });

  test('pausa fora da tela e volta ao reaparecer', async () => {
    const { page, context } = await open('1440×900');
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(
      () => document.querySelector('.carrossel').dataset.estado === 'pausado',
    );
    assert.ok(await still(page), 'parado fora da tela');
    await page.evaluate(() =>
      document.querySelector('#clientes').scrollIntoView({ block: 'center' }),
    );
    await page.waitForFunction(
      () => document.querySelector('.carrossel').dataset.estado === 'rodando',
    );
    await context.close();
  });
});

describe('carrossel com movimento reduzido', () => {
  for (const screen of Object.keys(SCREENS)) {
    test(`${screen}: não anda sozinho e não tem controle para pôr em movimento`, async () => {
      const { page, context } = await open(screen, { reducedMotion: 'reduce' });
      assert.equal(await estado(page), 'pausado');
      assert.ok(await still(page, 1200), 'parado');
      assert.equal(await page.locator('#clientes button').count(), 0);
      await context.close();
    });
  }
});

describe('poucos clientes: a esteira anda do mesmo jeito', () => {
  for (const [screen, items] of [
    ['1440×900', 1],
    ['1440×900', 4],
    ['390×844', 1],
    ['390×844', 2],
  ]) {
    test(`${screen} com ${items}: anda, e as cópias enchem a janela`, async () => {
      const { page, context } = await open(screen, { items });
      assert.equal(await estado(page), 'rodando');
      const info = await page.evaluate(() => {
        const view = document.querySelector('.carrossel-janela').getBoundingClientRect();
        const all = [...document.querySelectorAll('.carrossel-trilho .cliente')];
        const last = all.at(-1).getBoundingClientRect();
        return {
          originals: all.filter((li) => !li.hasAttribute('aria-hidden')).length,
          right: last.right - view.right,
        };
      });
      assert.equal(info.originals, items);
      assert.ok(info.right >= 0, 'a janela fica cheia até a borda direita');
      await context.close();
    });
  }

  for (const [screen, items] of [
    ['1440×900', 1],
    ['390×844', 1],
  ]) {
    test(`${screen} com ${items} e movimento reduzido: parado, centralizado, sem cópias`, async () => {
      const { page, context } = await open(screen, {
        items,
        reducedMotion: 'reduce',
        expected: 'estatico',
      });
      assert.equal(await estado(page), 'estatico');
      const info = await page.evaluate(() => {
        const view = document.querySelector('.carrossel-janela').getBoundingClientRect();
        const first = document.querySelector('.carrossel-trilho .cliente').getBoundingClientRect();
        return {
          copies: document.querySelectorAll('.cliente[aria-hidden]').length,
          left: first.left - view.left,
          right: view.right - first.right,
        };
      });
      assert.equal(info.copies, 0);
      assert.ok(
        Math.abs(info.left - info.right) < 2,
        `centralizado (${info.left} × ${info.right})`,
      );
      await context.close();
    });
  }
});

describe('layout do carrossel', () => {
  for (const screen of Object.keys(SCREENS)) {
    test(`${screen}: sem sobreposição e sem rolagem horizontal da página`, async () => {
      const { page, context } = await open(screen);
      const info = await page.evaluate(() => {
        const view = document.querySelector('.carrossel-janela').getBoundingClientRect();
        const section = document.querySelector('#clientes').getBoundingClientRect();
        const cards = [...document.querySelectorAll('.carrossel-trilho .cliente')].map((li) => {
          const r = li.getBoundingClientRect();
          return { w: r.width, h: r.height };
        });
        return {
          view: { top: view.top, bottom: view.bottom },
          section: { top: section.top, bottom: section.bottom },
          cards,
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth,
        };
      });
      assert.ok(info.scrollWidth <= info.innerWidth, 'sem rolagem horizontal da página');
      assert.ok(info.view.top >= info.section.top && info.view.bottom <= info.section.bottom);
      for (const card of info.cards) {
        assert.ok(card.w >= 150 && card.h >= 100, `cartão de ${card.w}×${card.h}`);
      }
      await context.close();
    });
  }
});
