// O site publicado mora num subcaminho do GitHub Pages (https://usuario.github.io/vanpack-pages/). O dist/
// usa endereços relativos; um caminho que virasse absoluto ("/fonts/...") funcionaria na raiz do servidor
// de teste e só quebraria depois do deploy. Aqui o dist/ é servido em /vanpack-pages/ por um servidor que
// devolve 404 de verdade (o vite preview devolveria o index.html em vez de 404) e nenhum pedido pode
// falhar: nem os da página, nem os do 3D dos produtos, nem os das outras duas páginas.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { ROOT, launch, openPage } from '../scripts/lib.mjs';

const BASE = '/vanpack-pages/';
const DIST = `${ROOT}dist/`;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
};
const built = existsSync(`${DIST}index.html`);

/** Serve o dist/ só sob BASE; qualquer outro caminho, ou arquivo que não existe, é 404. */
function serveUnder(base) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const relative = path.startsWith(base) ? path.slice(base.length) || 'index.html' : null;
    const file = relative && join(DIST, relative);
    if (!file || !file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) {
      // como o GitHub Pages: dentro do site, o que não existe devolve a 404.html com status 404
      const inside = path.startsWith(base);
      res.writeHead(404, inside ? { 'Content-Type': TYPES['.html'] } : {});
      res.end(inside ? readFileSync(`${DIST}404.html`) : '404');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${server.address().port}${base}`,
        close: () => new Promise((done) => (server.closeAllConnections(), server.close(done))),
      }),
    ),
  );
}

describe(
  'dist/ servido em um subcaminho, como no GitHub Pages',
  { skip: !built && 'sem dist/: rode `npm run build`' },
  () => {
    let server;
    let browser;
    before(async () => {
      server = await serveUnder(BASE);
      browser = await launch();
    });
    after(async () => {
      await browser?.close();
      await server?.close();
    });

    /** Abre uma página e devolve os pedidos que falharam (status 400 ou mais, ou que nem chegaram). */
    async function failures(path, { products = false } = {}) {
      const failed = [];
      const { page, context, problems } = await openPage(
        browser,
        `${server.url}${path}`,
        {},
        {
          waitFor: path.startsWith('?') ? 'settled' : 'none',
          setup: ({ page }) => {
            page.on('response', (response) => {
              if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
            });
            page.on('requestfailed', (request) => failed.push(`falhou ${request.url()}`));
          },
        },
      );
      if (!path.startsWith('?')) await page.goto(`${server.url}${path}`);
      if (products) {
        // o 3D dos produtos (e a ilustração de reserva) só são baixados perto da seção
        await page.evaluate(() => document.getElementById('produtos')?.scrollIntoView());
        await page.waitForFunction(
          () =>
            [...document.querySelectorAll('.model-3d')].some((area) =>
              area.classList.contains('pronto'),
            ),
          null,
          { timeout: 60_000 },
        );
      }
      await page.waitForTimeout(500);
      await context.close();
      return { failed, problems };
    }

    test('a página principal, com a cena e o 3D dos produtos, não tem pedido fora de 200', async () => {
      const { failed, problems } = await failures('?tour=0', { products: true });
      assert.deepEqual(failed, []);
      assert.deepEqual(problems, []);
    });

    test('a política de privacidade e a 404 também não', async () => {
      for (const path of ['politica-de-privacidade.html', '404.html']) {
        const { failed, problems } = await failures(path);
        assert.deepEqual(failed, [], path);
        assert.deepEqual(problems, [], path);
      }
    });

    test('a 404 servida em subpastas inexistentes carrega logo, fonte e não quebra recursos', async () => {
      for (const sub of ['nao-existe/', 'pasta/nao-existe', 'a/b/c']) {
        const url = `${server.url}${sub}`;
        const context = await browser.newContext();
        const page = await context.newPage();
        const failed = [];
        const problems = [];
        page.on('response', (res) => {
          if (res.url() !== url && res.status() >= 400) {
            failed.push(`${res.status()} ${res.url()}`);
          }
        });
        page.on('requestfailed', (req) => {
          failed.push(`falhou ${req.url()}`);
        });
        page.on('pageerror', (err) => problems.push(`pageerror: ${err.message}`));
        page.on('console', (m) => {
          // o Chrome registra no console o 404 do próprio documento, que aqui é o esperado (conferido
          // logo abaixo); qualquer outro recurso que falhe continua contando
          if (m.location().url === url && m.text().startsWith('Failed to load resource')) return;
          if (['error', 'warning'].includes(m.type())) problems.push(`console: ${m.text()}`);
        });
        const res = await page.goto(url);
        assert.equal(res?.status(), 404, `${sub} status 404`);
        await page.waitForLoadState('load');
        const logoOk = await page.evaluate(() => {
          const img = document.querySelector('.logo img');
          return Boolean(img && img.complete && img.naturalWidth > 0);
        });
        assert.ok(logoOk, `${sub}: logo carregou`);
        const fontOk = await page.evaluate(() => {
          return [...document.fonts].some(
            (f) => f.family.includes('Archivo') && f.status === 'loaded',
          );
        });
        assert.ok(fontOk, `${sub}: fonte Archivo carregou`);
        assert.deepEqual(failed, [], `${sub}: nenhum pedido falhou`);
        assert.deepEqual(problems, [], `${sub}: sem erros no console`);
        await context.close();
      }
    });

    test('o servidor de teste é rigoroso: um caminho absoluto dá 404', async () => {
      // sem isto o teste acima passaria mesmo que o dist/ usasse "/fonts/..." (o vite preview serve na raiz)
      const origin = new URL(server.url).origin;
      assert.equal((await fetch(`${origin}/fonts/archivo-latin.woff2`)).status, 404);
      assert.equal((await fetch(`${server.url}fonts/archivo-latin.woff2`)).status, 200);
      assert.equal((await fetch(`${server.url}nao-existe.js`)).status, 404);
    });
  },
);
