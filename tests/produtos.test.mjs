// 3D de cada produto (src/produtos/): nada baixado antes de a seção chegar perto, monta ao rolar e não
// fica em branco, gira, para fora da tela e libera tudo longe dela, fica parado com movimento reduzido,
// cai na ilustração em SVG sem WebGL ou sem condição (sem salto de layout), no máximo 1 contexto WebGL
// além do da história, sem vazamento ao rolar para dentro e para fora, contexto perdido e restaurado, e
// os 3 botões de orçamento seguem funcionando.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, scrollToProgress, startServer } from '../scripts/lib.mjs';
import { baseContent } from './dados.mjs';

const number = String(baseContent.empresa.whatsapp).replace(/\D/g, '');
const CHUNK = /\/assets\/(montar|produtos-worker)-[\w-]+\.js$/;
const MOBILE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
};

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

const open = (server, context = {}, options = {}) =>
  openPage(
    browser,
    `${server.url}?tour=0`,
    { reducedMotion: 'no-preference', ...context },
    { waitFor: 'settled', ...options },
  );

/** Rola até os cartões e espera `count` áreas prontas (3D ou ilustração). */
async function showProducts(page, count = 3) {
  await page.evaluate(() => document.querySelector('.models').scrollIntoView({ block: 'center' }));
  await page.waitForFunction(
    (count) => document.querySelectorAll('.model-3d.pronto').length >= count,
    count,
    { timeout: 60_000 },
  );
}

/** Pixels do canvas do cartão `i`: quantos fogem do Papel e uma assinatura do quadro. */
const pixels = (page, i) =>
  page.evaluate((i) => {
    const source = document.querySelectorAll('.model-3d canvas')[i];
    const copy = new OffscreenCanvas(source.width, source.height);
    const g = copy.getContext('2d');
    g.drawImage(source, 0, 0);
    const { data } = g.getImageData(0, 0, source.width, source.height);
    let ink = 0;
    let signature = 0;
    for (let p = 0; p < data.length; p += 4) {
      const off =
        Math.abs(data[p] - 251) + Math.abs(data[p + 1] - 248) + Math.abs(data[p + 2] - 242);
      if (off > 60) ink += 1;
      signature = (signature * 31 + data[p] + data[p + 1] * 3 + data[p + 2] * 7) % 1_000_000_007;
    }
    return { ink: ink / (data.length / 4), signature, width: source.width };
  }, i);

const frameCount = (page) => page.evaluate(() => window.__audit.produtos.frames);

/**
 * Espera os quadros pararem de chegar (três leituras iguais, com 1,2 s entre elas): um quadro já a
 * caminho quando o desenho para ainda chega, e num computador lento ele demora.
 */
async function framesStop(page) {
  let last = -1;
  let equal = 0;
  for (let i = 0; i < 12; i++) {
    const now = await frameCount(page);
    equal = now === last ? equal + 1 : 0;
    if (equal === 2) return now;
    last = now;
    await page.waitForTimeout(1200);
  }
  return assert.fail('os quadros não pararam de chegar');
}

/**
 * Espera a página largar os cartões depois de rolar para longe (nenhum a 300 px da tela). O
 * observador do teste usa a mesma margem do da página e é criado depois dele, então é avisado no
 * mesmo quadro de renderização, depois dele: quando este avisa, o da página já largou os cartões e
 * encerrou o worker, e quadro nenhum conta mais. Não depende de quanto a máquina está ocupada.
 */
const awayFromProducts = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const areas = [...document.querySelectorAll('.model-3d')];
        const near = new Map();
        const observer = new IntersectionObserver(
          (entries) => {
            for (const { target, isIntersecting } of entries) near.set(target, isIntersecting);
            if (near.size < areas.length || [...near.values()].some(Boolean)) return;
            observer.disconnect();
            resolve();
          },
          { rootMargin: '300px 0px' },
        );
        for (const area of areas) observer.observe(area);
      }),
  );

describe('carregamento preguiçoso', () => {
  test('nada do 3D dos produtos é baixado na história; o chunk vem quando a seção chega perto', async () => {
    const { page, context, requests, problems } = await open(prod);
    for (const p of [0.25, 0.5, 0.75, 1]) await scrollToProgress(page, p);
    await page.waitForTimeout(1000);
    assert.deepEqual(
      requests.filter((url) => CHUNK.test(url)),
      [],
      'nenhum chunk dos produtos durante a história',
    );
    // a 200 px da tela (dentro da margem de 300 px)
    await page.evaluate(() => {
      const top = document.querySelector('.models').getBoundingClientRect().top + scrollY;
      scrollTo(0, top - innerHeight - 200);
    });
    await page.waitForFunction(() => document.querySelector('.model-3d canvas'), null, {
      timeout: 30_000,
    });
    const loaded = requests.filter((url) => CHUNK.test(url)).map((url) => url.match(CHUNK)[1]);
    assert.deepEqual([...new Set(loaded)].sort(), ['montar', 'produtos-worker']);
    assert.deepEqual(problems, []);
    await context.close();
  });
});

describe('3D nos cartões', () => {
  for (const [name, device] of [
    ['1440×900', {}],
    ['390×844', MOBILE],
  ]) {
    test(`${name}: monta, não fica em branco, gira e tem descrição`, async () => {
      const { page, context, problems } = await open(prod, device);
      const cards = name === '390×844' ? [0, 1, 2] : [0];
      for (const i of cards) {
        await page.evaluate(
          (i) => document.querySelectorAll('.model-3d')[i].scrollIntoView({ block: 'center' }),
          i,
        );
        await page.waitForFunction(
          (i) => document.querySelectorAll('.model-3d')[i].classList.contains('pronto'),
          i,
          { timeout: 60_000 },
        );
        await page.waitForTimeout(500);
        const a = await pixels(page, i);
        assert.ok(a.ink > 0.05, `cartão ${i + 1}: o modelo aparece (${(a.ink * 100).toFixed(1)}%)`);
        await page.waitForTimeout(1500);
        const b = await pixels(page, i);
        assert.notEqual(a.signature, b.signature, `cartão ${i + 1}: o quadro muda (gira)`);
      }
      const labels = await page.evaluate(() =>
        [...document.querySelectorAll('.model-3d canvas')].map((c) => ({
          role: c.getAttribute('role'),
          label: c.getAttribute('aria-label'),
          tabIndex: c.tabIndex,
        })),
      );
      for (const { role, label, tabIndex } of labels) {
        assert.equal(role, 'img');
        assert.match(label, /^Modelo 3D de .+ girando$/);
        assert.equal(tabIndex, -1, 'o canvas não recebe foco');
      }
      assert.deepEqual(problems, []);
      await context.close();
    });
  }

  test('com movimento reduzido fica parado numa pose, e o rótulo não diz "girando"', async () => {
    const { page, context } = await open(prod, { reducedMotion: 'reduce' });
    await showProducts(page);
    await page.waitForTimeout(500);
    const a = await pixels(page, 0);
    assert.ok(a.ink > 0.05);
    await page.waitForTimeout(1500);
    assert.equal((await pixels(page, 0)).signature, a.signature, 'parado');
    const label = await page.getAttribute('.model-3d canvas', 'aria-label');
    assert.equal(label, 'Modelo 3D de caixa com corte e vinco');
    await context.close();
  });

  test('fora da tela para de desenhar; longe da seção, o worker libera tudo e sai', async () => {
    const { page, context } = await open(audit);
    await showProducts(page);
    const frames = () => page.evaluate(() => window.__audit.produtos.frames);
    const start = await frames();
    await page.waitForTimeout(1000);
    assert.ok((await frames()) > start, 'à vista: desenha');
    // longe: nada perto, o worker é encerrado e os quadros param
    await page.evaluate(() => scrollTo(0, 0));
    await awayFromProducts(page);
    const stopped = await frames();
    await page.waitForTimeout(1200);
    assert.equal(await frames(), stopped, 'longe: não desenha');
    // de volta: um worker novo
    await showProducts(page);
    await page.waitForFunction((n) => window.__audit.produtos.frames > n, stopped);
    assert.equal(await page.evaluate(() => window.__audit.produtos.workers), 2);
    await context.close();
  });

  test('com a aba oculta não desenha e, de volta, o giro continua', async () => {
    const { page, context } = await open(audit);
    await showProducts(page);
    const frames = () => page.evaluate(() => window.__audit.produtos.frames);
    const setHidden = (hidden) =>
      page.evaluate((hidden) => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event('visibilitychange'));
      }, hidden);
    await setHidden(true);
    const paused = await framesStop(page);
    await page.waitForTimeout(1200);
    assert.equal(await frames(), paused, 'oculta: não desenha');
    await setHidden(false);
    await page.waitForFunction((n) => window.__audit.produtos.frames > n + 5, paused);
    await context.close();
  });

  test('no celular, o cartão perto mas fora da tela fica montado e não é desenhado', async () => {
    const { page, context } = await open(audit, MOBILE);
    // a área do 2º cartão 150 px abaixo da tela: perto (margem de 300 px), mas fora dela
    const place = () =>
      page.evaluate(() => {
        const area = document.querySelectorAll('.model-3d')[1];
        scrollTo(0, area.getBoundingClientRect().top + scrollY - innerHeight - 150);
      });
    await place();
    await page.waitForFunction(() => window.__audit?.produtos?.stats?.[0], null, {
      timeout: 60_000,
    });
    await place(); // a fonte e o 3D já assentaram: confirma a posição
    await page.evaluate(() => {
      window.__audit.produtos.stats = {};
      window.__audit.produtos.memory = null;
      window.__audit.produtos.askMemory();
    });
    await page.waitForTimeout(1500);
    const drawn = await page.evaluate(() => Object.keys(window.__audit.produtos.stats));
    assert.ok(drawn.includes('0') && !drawn.includes('1'), `desenhados: ${drawn}`);
    const memory = await page.evaluate(() => window.__audit.produtos.memory);
    assert.equal(memory.models, 2, 'o 2º já está montado, pronto para entrar');
    await context.close();
  });
});

describe('contextos WebGL e memória', () => {
  // Conta, por fora do código da página, os workers dos produtos vivos e os contextos WebGL criados
  // dentro de cada um (o script do worker é servido com um contador na frente) e na página.
  const instrument = async ({ page }) => {
    await page.addInitScript(() => {
      const Native = window.Worker;
      window.__produtos = [];
      window.Worker = class extends Native {
        constructor(url, options) {
          super(url, options);
          if (String(url).includes('produtos-worker')) {
            window.__produtos.push(this);
            this.vivo = true;
          }
        }

        terminate() {
          this.vivo = false;
          super.terminate();
        }
      };
      const get = HTMLCanvasElement.prototype.getContext;
      window.__glPagina = 0;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = get.call(this, type, ...rest);
        if (ctx && /webgl/.test(type) && !this.__gl) {
          this.__gl = true;
          window.__glPagina += 1;
        }
        return ctx;
      };
    });
    await page.route('**/assets/produtos-worker-*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      const counter = `{
        const get = OffscreenCanvas.prototype.getContext;
        let gl = 0;
        OffscreenCanvas.prototype.getContext = function (type, ...rest) {
          const ctx = get.call(this, type, ...rest);
          if (ctx && /webgl/.test(type) && !this.__gl) { this.__gl = true; gl += 1; }
          return ctx;
        };
        addEventListener('message', (e) => {
          if (e.data?.type === '__contextos') postMessage({ type: '__contextos', n: gl });
        });
      }\n`;
      await route.fulfill({ response, body: counter + body });
    });
  };
  const count = (page) =>
    page.evaluate(async () => {
      const live = window.__produtos.filter((w) => w.vivo);
      const perWorker = await Promise.all(
        live.map(
          (w) =>
            new Promise((resolve) => {
              const on = (e) => {
                if (e.data?.type !== '__contextos') return;
                w.removeEventListener('message', on);
                resolve(e.data.n);
              };
              w.addEventListener('message', on);
              w.postMessage({ type: '__contextos' });
            }),
        ),
      );
      return { workers: live.length, contexts: perWorker, page: window.__glPagina };
    });

  for (const [name, device] of [
    ['1440×900', {}],
    ['390×844', MOBILE],
  ]) {
    test(`${name}: no máximo 1 contexto WebGL dos produtos, além do da história`, async () => {
      const { page, context } = await open(prod, device, { setup: instrument });
      for (const i of [0, 1, 2]) {
        await page.evaluate(
          (i) => document.querySelectorAll('.model-3d')[i].scrollIntoView({ block: 'center' }),
          i,
        );
        await page.waitForFunction(
          (i) => document.querySelectorAll('.model-3d')[i].classList.contains('pronto'),
          i,
          { timeout: 60_000 },
        );
        const c = await count(page);
        assert.equal(c.workers, 1, `cartão ${i + 1}: um worker dos produtos`);
        assert.deepEqual(c.contexts, [1], `cartão ${i + 1}: um contexto WebGL nele`);
        assert.equal(c.page, 0, 'nenhum contexto WebGL na página (os cartões são bitmaprenderer)');
      }
      await page.evaluate(() => scrollTo(0, 0));
      await page.waitForFunction(() => window.__produtos.every((w) => !w.vivo), null, {
        timeout: 10_000,
      });
      await context.close();
    });
  }

  test('rolar para dentro e para fora 3 vezes não aumenta geometrias nem texturas', async () => {
    const { page, context } = await open(audit, MOBILE);
    // O worker publica a memória também a cada add e remove, então a leitura mais recente pode ser
    // de antes: quem espera um fato (menos modelos) lê de novo até ele acontecer.
    const ask = async () => {
      await page.evaluate(() => {
        window.__audit.produtos.memory = null;
        window.__audit.produtos.askMemory();
      });
      await page.waitForFunction(() => window.__audit.produtos.memory, null, { timeout: 30_000 });
      return page.evaluate(() => window.__audit.produtos.memory);
    };
    // espera um quadro do cartão (à vista) e assenta antes de ler
    const memory = async (card) => {
      await page.evaluate(() => (window.__audit.produtos.stats = {}));
      await page.waitForFunction((card) => window.__audit.produtos.stats[card], card, {
        timeout: 60_000,
      });
      await page.waitForTimeout(800);
      return ask();
    };
    const seen = [];
    for (let round = 0; round < 3; round++) {
      await page.evaluate(() =>
        document.querySelectorAll('.model-3d')[1].scrollIntoView({ block: 'center' }),
      );
      await page.waitForFunction(() => window.__audit?.produtos?.askMemory, null, {
        timeout: 60_000,
      });
      seen.push(await memory(1));
      // o 1º cartão se afasta e é liberado; o worker segue vivo pelo 3º
      await page.evaluate(() => document.querySelector('#diferenciais').scrollIntoView());
      // a página larga os cartões distantes no próximo quadro de renderização, quando a máquina deixa
      let away;
      for (let tries = 0; tries < 50; tries++) {
        away = await ask();
        if (away.models < seen.at(-1).models) break;
        await page.waitForTimeout(200);
      }
      assert.ok(
        away.models < seen.at(-1).models,
        `volta ${round + 1}: o modelo longe sai (perto: ${JSON.stringify(seen.at(-1))}, longe: ${JSON.stringify(away)})`,
      );
    }
    for (const m of seen) {
      assert.deepEqual(
        [m.models, m.geometries, m.textures],
        [seen[0].models, seen[0].geometries, seen[0].textures],
        JSON.stringify(seen),
      );
    }
    assert.equal(await page.evaluate(() => window.__audit.produtos.workers), 1);
    await context.close();
  });

  test('contexto perdido e restaurado: o giro volta', async () => {
    const { page, context, problems } = await open(audit);
    await showProducts(page);
    await page.evaluate(() => window.__audit.produtos.loseContext());
    await page.waitForTimeout(1000);
    const n = await page.evaluate(() => window.__audit.produtos.frames);
    await page.waitForFunction((n) => window.__audit.produtos.frames > n + 5, n, {
      timeout: 20_000,
    });
    assert.deepEqual(
      problems.filter((p) => p.startsWith('pageerror')),
      [],
    );
    await context.close();
  });
});

describe('ilustração em SVG no lugar do 3D', () => {
  /** Caixa de cada área e de cada título antes de carregar e depois da ilustração. */
  const boxes = (page) =>
    page.evaluate(() =>
      [...document.querySelectorAll('.model')].map((card) => {
        const area = card.querySelector('.model-3d').getBoundingClientRect();
        const title = card.querySelector('h3').getBoundingClientRect();
        return [area.width, area.height, title.top - area.top];
      }),
    );
  const checkSvg = async (page, problems) => {
    const before = await boxes(page);
    await page.evaluate(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.sources?.some((s) => s.node?.closest?.('#produtos'))) {
            window.__shifts.push(entry.value);
          }
        }
      }).observe({ type: 'layout-shift' });
    });
    await showProducts(page);
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll('.model-3d img')].filter(
          (img) => img.complete && img.naturalWidth,
        ).length === 3,
      null,
      { timeout: 20_000 },
    );
    const info = await page.evaluate(() =>
      [...document.querySelectorAll('.model-3d')].map((area) => ({
        canvas: area.querySelectorAll('canvas').length,
        src: area.querySelector('img').getAttribute('src'),
        alt: area.querySelector('img').alt,
        width: area.querySelector('img').getAttribute('width'),
      })),
    );
    for (const item of info) {
      assert.equal(item.canvas, 0);
      assert.match(item.src, /^\.\/produtos\/(corte-e-vinco|divisorias|chapas)\.svg$/);
      assert.match(item.alt, /^Ilustração de /);
      assert.equal(item.width, '400');
    }
    assert.deepEqual(await boxes(page), before, 'a área e o título não mudam de lugar');
    assert.deepEqual(await page.evaluate(() => window.__shifts), [], 'nenhum salto de layout');
    assert.deepEqual(
      problems.filter((p) => p.startsWith('pageerror')),
      [],
    );
  };

  test('sem WebGL: a ilustração ocupa o mesmo espaço, sem salto de layout', async () => {
    const noGl = await launch(['--disable-3d-apis', '--disable-webgl', '--disable-webgl2']);
    // como em robustness.test.mjs: tira o WebGL do worker também
    const setup = ({ page }) =>
      page.route('**/assets/produtos-worker-*.js', async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        await route.fulfill({
          response,
          body: `OffscreenCanvas.prototype.getContext = () => null;\n${body}`,
        });
      });
    const { page, context, problems } = await openPage(
      noGl,
      `${prod.url}?tour=0`,
      { reducedMotion: 'no-preference' },
      { waitFor: 'settled', setup },
    );
    await checkSvg(page, problems);
    await context.close();
    await noGl.close();
  });

  for (const [name, fake] of [
    [
      'economia de dados',
      () =>
        Object.defineProperty(navigator, 'connection', {
          get: () => ({ saveData: true, effectiveType: '4g' }),
        }),
    ],
    [
      'rede 3g',
      () =>
        Object.defineProperty(navigator, 'connection', {
          get: () => ({ saveData: false, effectiveType: '3g' }),
        }),
    ],
    ['2 GB de memória', () => Object.defineProperty(navigator, 'deviceMemory', { get: () => 2 })],
  ]) {
    test(`${name}: ilustração, sem baixar o worker dos produtos`, async () => {
      const { page, context, problems, requests } = await open(prod, MOBILE, {
        setup: ({ page }) => page.addInitScript(fake),
      });
      await checkSvg(page, problems);
      assert.ok(!requests.some((url) => /produtos-worker-/.test(url)), 'sem o worker');
      await context.close();
    });
  }
});

describe('botões de orçamento dos produtos', () => {
  for (const [name, device] of [
    ['1440×900', {}],
    ['390×844', MOBILE],
  ]) {
    test(`${name}: os 3 continuam à vista, com 44 px, por cima do 3D e com o código de origem`, async () => {
      const { page, context } = await open(prod, device);
      await showProducts(page, name === '1440×900' ? 3 : 1);
      await page.evaluate(() =>
        document.addEventListener(
          'click',
          (e) => e.target.closest('a') && e.preventDefault(),
          true,
        ),
      );
      for (const id of ['corte-e-vinco', 'divisorias', 'chapas']) {
        const button = page.locator(`a[data-cta="produtos-${id}"]`);
        await button.scrollIntoViewIfNeeded();
        const href = await button.getAttribute('href');
        assert.ok(href.startsWith(`https://wa.me/${number}?text=`), href);
        assert.ok(new URL(href).searchParams.get('text').endsWith(`[site-produtos-${id}]`));
        const box = await button.boundingBox();
        assert.ok(box.height >= 44 - 0.5, `${id}: ${box.height} px`);
        const hit = await page.evaluate(
          ([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.dataset.cta,
          [box.x + box.width / 2, box.y + box.height / 2],
        );
        assert.equal(hit, `produtos-${id}`, `${id}: nada cobre o botão`);
        await button.click();
        const clicked = await page.evaluate(() =>
          window.dataLayer.filter((e) => e.event === 'whatsapp_click').map((e) => e.cta),
        );
        assert.ok(clicked.includes(`produtos-${id}`), `${id}: whatsapp_click`);
      }
      await context.close();
    });
  }
});
