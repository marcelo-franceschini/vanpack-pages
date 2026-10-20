// Carrossel de clientes (src/carrossel.js): esteira automática da direita para a esquerda em qualquer
// largura, pausa (mouse, foco de teclado, toque, botão), setas, teclado e arrasto, movimento reduzido,
// poucos itens parados, cópias fora da leitura e do foco, layout sem sobreposição e alvos de 44 px.
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
 * Abre a página com o carrossel no meio da tela. `keep` deixa só os N primeiros clientes no HTML
 * servido (o .env do build tem 6), para testar poucos itens.
 */
async function open(screen, { reducedMotion = 'no-preference', keep } = {}) {
  const opened = await openPage(
    browser,
    `${server.url}?tour=0`,
    { reducedMotion, ...SCREENS[screen] },
    {
      waitFor: 'settled',
      setup: ({ page }) =>
        keep &&
        page.route(
          (url) => url.pathname === '/',
          async (route) => {
            const response = await route.fetch();
            let n = 0;
            const body = (await response.text()).replace(
              /<li class="cliente">[\s\S]*?<\/li>/g,
              (item) => (++n <= keep ? item : ''),
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
  const expected = keep ? 'estatico' : reducedMotion === 'reduce' ? 'pausado' : 'rodando';
  await page.waitForFunction(
    (expected) => document.querySelector('.carrossel')?.dataset.estado === expected,
    expected,
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
      step,
      loop: items.length * step,
    };
  });

/** Quanto o trilho andou para a esquerda entre duas leituras, na volta da esteira. */
const leftward = (a, b) => (((a.x - b.x) % a.loop) + a.loop) % a.loop;
const estado = (page) => page.evaluate(() => document.querySelector('.carrossel').dataset.estado);

/** Espera o deslize das setas ou do teclado terminar. */
async function settled(page) {
  await page.waitForFunction(
    () => !document.querySelector('.carrossel').hasAttribute('data-deslizando'),
    null,
    { timeout: 10_000 },
  );
  return position(page);
}

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
    test('anda sozinho em demo, da direita para a esquerda, devagar', async () => {
      const { page, context, problems } = await open(screen);
      assert.equal(await estado(page), 'rodando');
      const a = await position(page);
      await page.waitForTimeout(1000);
      const moved = leftward(a, await position(page));
      assert.ok(moved > 15 && moved < 60, `andou ${moved.toFixed(1)} px em 1 s`);
      assert.deepEqual(problems, []);
      await context.close();
    });

    test('cópias do loop ficam fora da leitura e do foco; só os 6 originais são lidos', async () => {
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
      assert.equal(info.originals, 6);
      assert.ok(info.copies >= 6 && info.copies % 6 === 0, `${info.copies} cópias`);
      assert.ok(info.inert, 'toda cópia é inert');
      const snapshot = await page.locator('.carrossel-trilho').ariaSnapshot();
      assert.equal((snapshot.match(/- listitem/g) ?? []).length, 6, snapshot);
      assert.equal((snapshot.match(/Cliente 1\b/g) ?? []).length, 1, 'sem leitura duplicada');
      await context.close();
    });

    test('pausa no botão (aria-pressed, "Retomar") e só volta pelo botão', async () => {
      const { page, context } = await open(screen);
      const pause = page.locator('.carrossel-btn[data-acao="pausa"]');
      await pause.click();
      assert.equal(await pause.getAttribute('aria-pressed'), 'true');
      assert.equal((await pause.textContent()).trim(), 'Retomar');
      await page.mouse.move(5, 5);
      assert.ok(await still(page, 1200), 'parado com o mouse longe');
      assert.equal(await estado(page), 'pausado');
      await pause.click();
      assert.equal(await pause.getAttribute('aria-pressed'), 'false');
      assert.equal((await pause.textContent()).trim(), 'Pausar');
      await page.mouse.move(5, 5);
      assert.ok(await moving(page), 'voltou a andar');
      await context.close();
    });

    test('setas movem 1 ou 2 itens, alinhadas, e voltam', async () => {
      const { page, context } = await open(screen);
      await page.locator('.carrossel-btn[data-acao="pausa"]').click();
      const a = await position(page);
      await page.locator('.carrossel-btn[data-acao="proximo"]').click();
      const b = await settled(page);
      const moved = leftward(a, b);
      assert.ok(moved > 0.5 * a.step && moved <= 2 * a.step + 0.5, `próximo andou ${moved}`);
      const aligned = ((-b.x % a.step) + a.step) % a.step;
      assert.ok(aligned < 1 || aligned > a.step - 1, `alinhado ao item (${aligned})`);
      await page.locator('.carrossel-btn[data-acao="anterior"]').click();
      const c = await settled(page);
      assert.ok(leftward(c, b) > 0.5 * a.step, 'anterior volta para a direita');
      await context.close();
    });
  });
}

describe('carrossel: mouse, teclado e toque', () => {
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

  test('foco de teclado pausa, as setas do teclado movem e, ao sair, volta a andar', async () => {
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
    const b = await settled(page);
    assert.ok(leftward(a, b) > 0.5 * a.step, '→ avança');
    await page.keyboard.press('ArrowLeft');
    assert.ok(leftward(await settled(page), b) > 0.5 * a.step, '← volta');
    await page.keyboard.press('Tab');
    assert.ok(await moving(page), 'voltou a andar sem o foco');
    await context.close();
  });

  test('arrastar com o mouse move a esteira', async () => {
    const { page, context } = await open('1440×900');
    await page.locator('.carrossel-btn[data-acao="pausa"]').click();
    const box = await page.locator('.carrossel-janela').boundingBox();
    const a = await position(page);
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + 700, y);
    await page.mouse.down();
    for (let dx = 0; dx <= 160; dx += 20) await page.mouse.move(box.x + 700 - dx, y);
    await page.mouse.up();
    const moved = leftward(a, await position(page));
    assert.ok(Math.abs(moved - 160) < 25, `arrastou ${moved.toFixed(1)} px`);
    await context.close();
  });

  test('tocar e arrastar com o dedo pausa, move e retoma sozinho depois', async () => {
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
    const a = await position(page);
    for (let dx = 20; dx <= 120; dx += 20) await touch('touchMove', box.x + 300 - dx);
    await page.waitForTimeout(100);
    const moved = leftward(a, await position(page));
    assert.ok(moved > 60 && moved < 160, `arrastou ${moved.toFixed(1)} px`);
    await touch('touchEnd');
    assert.equal(await estado(page), 'pausado', 'ainda parado logo depois de soltar');
    await page.waitForFunction(
      () => document.querySelector('.carrossel').dataset.estado === 'rodando',
      null,
      {
        timeout: 4000,
      },
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
    test(`${screen}: não anda sozinho, sem botão de pausa, e as setas movem`, async () => {
      const { page, context } = await open(screen, { reducedMotion: 'reduce' });
      assert.equal(await estado(page), 'pausado');
      assert.ok(await still(page, 1200), 'parado');
      assert.equal(await page.locator('.carrossel-btn[data-acao="pausa"]').isVisible(), false);
      const a = await position(page);
      await page.locator('.carrossel-btn[data-acao="proximo"]').click();
      await page.waitForTimeout(100);
      assert.ok(leftward(a, await position(page)) > 0.5 * a.step, 'próximo move');
      await context.close();
    });
  }
});

describe('poucos clientes: cabem na largura', () => {
  const cases = [
    ['1440×900', 3],
    ['1440×900', 2],
    ['390×844', 2],
  ];
  for (const [screen, keep] of cases) {
    test(`${screen} com ${keep}: parado, centralizado, sem cópias nem controles`, async () => {
      const { page, context } = await open(screen, { keep });
      assert.equal(await estado(page), 'estatico');
      const info = await page.evaluate(() => {
        const view = document.querySelector('.carrossel-janela').getBoundingClientRect();
        const items = [...document.querySelectorAll('.carrossel-trilho .cliente')];
        const first = items[0].getBoundingClientRect();
        const last = items.at(-1).getBoundingClientRect();
        return {
          items: items.length,
          copies: document.querySelectorAll('.cliente[aria-hidden]').length,
          controls: document.querySelector('.carrossel-controles').hidden,
          transform: getComputedStyle(document.querySelector('.carrossel-trilho')).transform,
          left: first.left - view.left,
          right: view.right - last.right,
        };
      });
      assert.equal(info.items, keep);
      assert.equal(info.copies, 0);
      assert.equal(info.controls, true, 'sem setas nem pausa');
      assert.equal(info.transform, 'none');
      assert.ok(
        Math.abs(info.left - info.right) < 2,
        `centralizado (${info.left} × ${info.right})`,
      );
      assert.ok(await still(page), 'parado');
      await context.close();
    });
  }
});

describe('layout do carrossel', () => {
  for (const screen of Object.keys(SCREENS)) {
    test(`${screen}: sem sobreposição, sem rolagem horizontal e alvos de 44 px`, async () => {
      const { page, context } = await open(screen);
      const info = await page.evaluate(() => {
        const rect = (el) => el.getBoundingClientRect();
        const view = rect(document.querySelector('.carrossel-janela'));
        const buttons = [...document.querySelectorAll('.carrossel-btn')]
          .filter((b) => !b.hidden)
          .map(rect);
        return {
          view,
          buttons: buttons.map((b) => ({
            top: b.top,
            left: b.left,
            right: b.right,
            w: b.width,
            h: b.height,
          })),
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth,
        };
      });
      assert.ok(info.scrollWidth <= info.innerWidth, 'sem rolagem horizontal da página');
      assert.equal(info.buttons.length, 3);
      for (const b of info.buttons) {
        assert.ok(b.w >= 44 - 0.5 && b.h >= 44 - 0.5, `alvo de ${b.w}×${b.h}`);
        assert.ok(
          b.top >= info.view.bottom - 0.5,
          'controles abaixo da faixa, sem cobrir os logos',
        );
        assert.ok(b.left >= -0.5 && b.right <= info.innerWidth + 0.5, 'dentro da tela');
      }
      for (let i = 1; i < info.buttons.length; i++) {
        assert.ok(info.buttons[i].left >= info.buttons[i - 1].right - 0.5, 'botões lado a lado');
      }
      await context.close();
    });
  }
});
