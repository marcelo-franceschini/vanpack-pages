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
      res.writeHead(404).end('404');
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

    test('o servidor de teste é rigoroso: um caminho absoluto dá 404', async () => {
      // sem isto o teste acima passaria mesmo que o dist/ usasse "/fonts/..." (o vite preview serve na raiz)
      const origin = new URL(server.url).origin;
      assert.equal((await fetch(`${origin}/fonts/archivo-latin.woff2`)).status, 404);
      assert.equal((await fetch(`${server.url}fonts/archivo-latin.woff2`)).status, 200);
      assert.equal((await fetch(`${server.url}nao-existe.js`)).status, 404);
    });
  },
);
