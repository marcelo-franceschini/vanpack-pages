// Medição no Umami Cloud: os eventos de negócio e o resumo da visita saem pelo nosso JS, sem cookies,
// sem storage e sem script de terceiro, e só na página publicada (o host da VITE_SITE_URL). O build do
// teste liga o Umami (em production, o único modo que mede) e põe o host do site igual ao do servidor de teste; a URL real do Umami é
// interceptada pelo Playwright, então nenhum tráfego real sai.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { build } from 'vite';
import { ROOT, launch, openPage, scrollToProgress, startServer } from '../scripts/lib.mjs';
import { baseContent, contentCopy, realEmpresa } from './dados.mjs';

const SITE_ID = '12345678-1234-4234-8234-123456789abc';
const UMAMI = 'https://gateway.umami.is';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
};

let server;
let published; // servidor do build padrão (host diferente do site: não deve enviar nada)
let browser;
before(async () => {
  // A medição só liga em production (o site de demonstração não soma visitas): o build usa dados reais de
  // teste e uma lista de clientes vazia.
  const { dir, remove } = contentCopy({
    'empresa.yaml': realEmpresa,
    'clientes.yaml': { ...baseContent.clientes, clientes: [] },
  });
  const saved = { ...process.env };
  Object.assign(process.env, {
    VITE_DATA_MODE: 'production',
    VITE_ANALYTICS_PROVIDER: 'umami',
    VITE_ANALYTICS_SITE: SITE_ID,
    VITE_SITE_URL: 'https://127.0.0.1/',
    VANPACK_CONTENT: dir,
  });
  try {
    await build({ root: ROOT, logLevel: 'silent', build: { outDir: 'dist-analytics' } });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    remove();
  }
  server = await startServer('dist-analytics');
  published = await startServer('dist');
  browser = await launch();
});
after(async () => {
  await browser.close();
  await server.close();
  await published.close();
});

/**
 * Abre a página com o Umami interceptado; `calls` guarda cada evento enviado e `order` a ordem em que
 * o evento "load" da página e cada envio aconteceram ('load', 'pageview' ou o nome do evento).
 * `init` roda na página antes de qualquer script dela.
 */
async function open({
  url = server.url,
  query = '?tour=0',
  reply = {},
  init,
  automated = false,
  ...options
} = {}) {
  const calls = [];
  const order = [];
  const opened = await openPage(
    browser,
    url + query,
    { reducedMotion: 'reduce', ...options },
    {
      setup: async ({ context, page }) => {
        page.on('load', () => order.push('load'));
        // O Chrome do Playwright se declara automatizado (navigator.webdriver = true) e a medição ignora
        // navegador automatizado: o teste faz o Chrome se passar por um visitante, salvo o que testa a guarda.
        if (!automated) {
          await page.addInitScript(() =>
            Object.defineProperty(navigator, 'webdriver', { get: () => false }),
          );
        }
        if (init) await page.addInitScript(init);
        await context.route(`${UMAMI}/**`, (route) => {
          const request = route.request();
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
          const call = { ...JSON.parse(request.postData()), headers: request.headers() };
          calls.push(call);
          order.push(call.payload.name ?? 'pageview');
          return route.fulfill({
            status: 200,
            headers: { ...CORS, 'content-type': 'application/json' },
            body: JSON.stringify({ cache: 'abc', sessionId: 's', visitId: 'v', ...reply }),
          });
        });
      },
    },
  );
  // links externos (tel:, wa.me) não podem tirar a página do lugar durante o teste
  await opened.page.evaluate(() =>
    document.addEventListener('click', (e) => e.preventDefault(), true),
  );
  return { ...opened, calls, order };
}

/** Espera (até 5 s) um evento enviado que satisfaça `match`. */
async function waitFor(calls, match) {
  for (let i = 0; i < 100; i++) {
    const found = calls.find(match);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(`evento não enviado; enviados: ${JSON.stringify(calls.map((c) => c.payload.name))}`);
}

const named = (name) => (call) => call.payload.name === name;

describe('Umami Cloud', () => {
  test('navegador automatizado (Lighthouse, testes) não envia nada, mas o dataLayer segue completo', async () => {
    // sem esta guarda, cada execução de teste no site publicado entra na medição e gasta a cota do plano
    const { page, context, calls } = await open({ automated: true });
    assert.equal(
      await page.evaluate(() => navigator.webdriver),
      true,
      'o Chrome do teste é automatizado',
    );
    await page.click('[data-cta="hero"]');
    await scrollToProgress(page, 0.25);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
      dispatchEvent(new Event('pagehide'));
    });
    await page.waitForTimeout(1500);
    assert.deepEqual(calls, [], 'nenhum envio ao Umami');
    const events = await page.evaluate(() => window.dataLayer.map((item) => item.event));
    assert.ok(events.includes('whatsapp_click') && events.includes('chapter_view'), events.join());
    await context.close();
  });

  test('a visualização da página sai no formato do tracker oficial', async () => {
    const { context, calls } = await open();
    const view = await waitFor(calls, (call) => !call.payload.name);
    assert.equal(view.type, 'event');
    assert.equal(view.payload.website, SITE_ID);
    assert.equal(view.payload.hostname, '127.0.0.1');
    assert.equal(view.payload.url, '/?tour=0');
    assert.equal(view.headers['content-type'], 'application/json');
    assert.equal(view.headers['x-umami-website-id'], SITE_ID);
    await context.close();
  });

  test('a visualização só sai depois do carregamento, não na largada', async () => {
    const { context, calls, order } = await open();
    await waitFor(calls, (call) => !call.payload.name);
    assert.equal(order.indexOf('load') < order.indexOf('pageview'), true, `ordem: ${order}`);
    await context.close();
  });

  test('um evento de negócio antes do momento ocioso leva a visualização na frente', async () => {
    // sem requestIdleCallback a visualização fica esperando; o clique a solta, e ela vai primeiro
    const { page, context, calls, order } = await open({
      init: () => {
        window.requestIdleCallback = () => 0;
      },
    });
    await page.waitForTimeout(500);
    assert.deepEqual(calls, [], 'nada enviado antes do clique');
    await page.click('[data-cta="hero"]');
    await waitFor(calls, named('whatsapp_click'));
    assert.deepEqual(
      order.filter((item) => item !== 'load'),
      ['pageview', 'whatsapp_click'],
    );
    await context.close();
  });

  test('ao esconder a aba sem ter chegado ao momento ocioso, a visualização sai antes do resumo', async () => {
    const { page, context, calls, order } = await open({
      init: () => {
        window.requestIdleCallback = () => 0;
      },
    });
    await scrollToProgress(page, 0.25);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await waitFor(calls, named('visit_summary'));
    assert.deepEqual(
      order.filter((item) => item !== 'load'),
      ['pageview', 'visit_summary'],
    );
    await context.close();
  });

  test('os cliques de WhatsApp, telefone e mapa saem com o lugar certo', async () => {
    const { page, context, calls } = await open();
    await page.click('[data-cta="hero"]');
    const whatsapp = await waitFor(calls, named('whatsapp_click'));
    assert.deepEqual(whatsapp.payload.data, { cta: 'hero' });
    for (const kind of ['phone', 'map']) {
      await page.locator(`footer a[data-contact="${kind}"]`).click();
      const click = await waitFor(calls, named(`${kind}_click`));
      assert.deepEqual(click.payload.data, { cta: 'rodape' }, kind);
    }
    await context.close();
  });

  test('o resumo da visita sai ao esconder a aba, com capítulo, rolagem e tour', async () => {
    const { page, context, calls } = await open();
    await scrollToProgress(page, 0.5);
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get: () => 'hidden',
      });
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    const summary = await waitFor(calls, named('visit_summary'));
    assert.equal(summary.payload.data.chapter, 3);
    assert.equal(typeof summary.payload.data.scroll, 'number');
    await context.close();
  });

  test('o que não é de negócio fica no dataLayer, sem ir ao Umami', async () => {
    const { page, context, calls } = await open();
    await scrollToProgress(page, 0.25);
    await page.waitForTimeout(500);
    const layer = await page.evaluate(() => window.dataLayer.map((item) => item.event));
    assert.ok(layer.includes('chapter_view'), 'o dataLayer continua com tudo');
    const sent = calls.map((call) => call.payload.name).filter(Boolean);
    assert.ok(!sent.includes('chapter_view') && !sent.includes('scroll_depth'), `${sent}`);
    await context.close();
  });

  test('sem cookie, sem storage e sem requisição externa além do Umami; CSP sem violações', async () => {
    const { page, context, calls, requests, problems } = await open();
    await page.click('[data-cta="hero"]');
    await waitFor(calls, named('whatsapp_click'));
    assert.deepEqual(await context.cookies(), []);
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    const external = requests.filter(
      (url) => !url.startsWith(server.url) && !/^(data|blob):/.test(url),
    );
    assert.ok(
      external.length > 0 && external.every((url) => url.startsWith(`${UMAMI}/`)),
      `${external}`,
    );
    assert.deepEqual(await page.evaluate(() => window.__csp ?? []), []);
    assert.deepEqual(problems, []);
    await context.close();
  });

  test('se o servidor pedir para parar (disabled), nada mais é enviado', async () => {
    const { page, context, calls } = await open({ reply: { disabled: true } });
    await waitFor(calls, (call) => !call.payload.name);
    const before = calls.length;
    await page.click('[data-cta="hero"]');
    await page.waitForTimeout(600);
    assert.equal(calls.length, before, 'nenhum evento depois do disabled');
    await context.close();
  });

  test('fora do host do site (build padrão em 127.0.0.1) nada é enviado', async () => {
    const { page, context, calls, requests } = await open({ url: published.url });
    await page.click('[data-cta="hero"]');
    await page.waitForTimeout(800);
    assert.deepEqual(calls, []);
    assert.deepEqual(
      requests.filter((url) => url.startsWith(UMAMI)),
      [],
    );
    await context.close();
  });
});
