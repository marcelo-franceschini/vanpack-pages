// Servidor estático de laboratório para medir a carga da página (usado por audit:carga). Imita o que
// importa do GitHub Pages: gzip nível 9 nos textos, Cache-Control: max-age=600 e uma resposta por pedido.
// E acrescenta o que o laboratório precisa: latência fixa por resposta (o tempo de ida e volta da rede) e
// uma banda única dividida entre todas as respostas em andamento (um balde de bytes por tick). Registra,
// por pedido, quando chegou e quando a última parte saiu, para ver a fila de pedidos em série.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { gzipSync } from 'node:zlib';

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
const COMPRESSIBLE = /\.(html|js|svg|txt|xml)$/;
const TICK_MS = 10;

/**
 * @param {{ dir: string, rttMs?: number, kbps?: number }} options `dir` é o dist/; `rttMs` a latência de
 *   cada resposta; `kbps` a banda total em kilobits por segundo (0 = sem limite)
 * @returns {Promise<{
 *   url: string,
 *   log: { url: string, chegou: number, inicio?: number, fim: number | null, status: number, tamanho?: number, enc: string }[],
 *   reset(): void,
 *   close(): Promise<void>,
 * }>}
 */
export function iniciarServidorLento({ dir, rttMs = 0, kbps = 0 }) {
  const raw = new Map();
  const gzipped = new Map();
  const active = new Set();
  const log = [];
  let zero = performance.now();
  let timer = null;

  function tick() {
    let budget = kbps ? ((kbps * 1000) / 8) * (TICK_MS / 1000) : Infinity;
    let spent = true;
    while (spent && budget > 0 && active.size) {
      spent = false;
      const share = Math.max(1, Math.floor(budget / active.size));
      for (const stream of active) {
        const n = Math.min(share, stream.body.length - stream.sent, budget);
        if (n <= 0) continue;
        stream.res.write(stream.body.subarray(stream.sent, stream.sent + n));
        stream.sent += n;
        budget -= n;
        spent = true;
      }
    }
    for (const stream of active) {
      if (stream.sent < stream.body.length) continue;
      stream.res.end();
      stream.entry.fim = performance.now() - zero;
      active.delete(stream);
    }
    timer = active.size ? setTimeout(tick, TICK_MS) : null;
  }

  const server = createServer((req, res) => {
    let path = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(dir, path);
    const entry = {
      url: path,
      chegou: performance.now() - zero,
      fim: null,
      status: 200,
      enc: 'identity',
    };
    log.push(entry);
    if (!file.startsWith(dir) || !existsSync(file) || !statSync(file).isFile()) {
      entry.status = 404;
      entry.fim = entry.chegou;
      res.writeHead(404).end('404');
      return;
    }
    if (!raw.has(file)) raw.set(file, readFileSync(file));
    let body = raw.get(file);
    const headers = {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'max-age=600',
    };
    if (COMPRESSIBLE.test(file) && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
      if (!gzipped.has(file)) gzipped.set(file, gzipSync(body, { level: 9 }));
      body = gzipped.get(file);
      headers['Content-Encoding'] = 'gzip';
      entry.enc = 'gzip';
    }
    headers['Content-Length'] = String(body.length);
    entry.tamanho = body.length;
    setTimeout(() => {
      entry.inicio = performance.now() - zero;
      res.writeHead(200, headers);
      active.add({ res, body, sent: 0, entry });
      timer ??= setTimeout(tick, TICK_MS);
    }, rttMs);
  });

  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        url: `http://127.0.0.1:${/** @type {any} */ (server.address()).port}/`,
        log,
        reset() {
          log.length = 0;
          zero = performance.now();
        },
        close: () =>
          new Promise((done) => {
            clearTimeout(timer ?? undefined);
            server.closeAllConnections();
            server.close(() => done());
          }),
      }),
    ),
  );
}
