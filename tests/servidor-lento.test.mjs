// O servidor de laboratório de audit:carga (scripts/audit/servidor-lento.mjs): latência por resposta,
// banda dividida entre as respostas em andamento, gzip nos textos e 404 de verdade. É ele que faz a medição
// de "cena pronta" valer a pena comparar entre duas versões do site; se mentisse, os números mentiriam.
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { iniciarServidorLento } from '../scripts/audit/servidor-lento.mjs';

let dir;
before(() => {
  dir = mkdtempSync(join(tmpdir(), 'vanpack-lento-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><p>oi</p>');
  writeFileSync(join(dir, 'texto.js'), 'const x = 1;\n'.repeat(5000));
  // 100 KB que não comprimem (e a extensão .bin nunca é comprimida)
  writeFileSync(join(dir, 'a.bin'), Buffer.alloc(100 * 1024, 7));
  writeFileSync(join(dir, 'b.bin'), Buffer.alloc(50 * 1024, 8));
  writeFileSync(join(dir, 'c.bin'), Buffer.alloc(50 * 1024, 9));
});
after(() => rmSync(dir, { recursive: true, force: true }));

/** Quanto tempo (ms) leva para baixar tudo isto ao mesmo tempo. */
async function elapsed(server, paths) {
  const start = performance.now();
  await Promise.all(paths.map(async (path) => (await fetch(`${server.url}${path}`)).arrayBuffer()));
  return performance.now() - start;
}

describe('servidor lento', () => {
  test('cada resposta espera a latência, e o registro diz quando chegou, começou e terminou', async () => {
    const server = await iniciarServidorLento({ dir, rttMs: 150 });
    try {
      const ms = await elapsed(server, ['index.html']);
      assert.ok(ms >= 140, `${ms} ms`);
      const [entry] = server.log;
      assert.equal(entry.url, '/index.html');
      assert.equal(entry.status, 200);
      assert.ok(entry.inicio - entry.chegou >= 140, 'a resposta só começa depois da latência');
      assert.ok(entry.fim >= entry.inicio);
    } finally {
      await server.close();
    }
  });

  test('a banda limita o download: 100 KB a 800 kbps (100 KB/s) levam cerca de 1 s', async () => {
    const server = await iniciarServidorLento({ dir, kbps: 800 });
    try {
      const ms = await elapsed(server, ['a.bin']);
      assert.ok(ms >= 800 && ms <= 2500, `${ms} ms`);
    } finally {
      await server.close();
    }
  });

  test('a banda é uma só: dois arquivos de 50 KB juntos levam o mesmo que um de 100 KB, não metade', async () => {
    const server = await iniciarServidorLento({ dir, kbps: 800 });
    try {
      const ms = await elapsed(server, ['b.bin', 'c.bin']);
      assert.ok(ms >= 800 && ms <= 2500, `${ms} ms`);
    } finally {
      await server.close();
    }
  });

  test('texto vai em gzip, o que não é texto vai como está, e o que não existe (ou foge da pasta) é 404', async () => {
    const server = await iniciarServidorLento({ dir });
    try {
      const text = await fetch(`${server.url}texto.js`);
      assert.equal(text.headers.get('content-encoding'), 'gzip');
      assert.equal(text.headers.get('cache-control'), 'max-age=600');
      assert.equal(
        (await text.text()).length,
        'const x = 1;\n'.length * 5000,
        'o conteúdo é o mesmo',
      );
      assert.ok(Number(text.headers.get('content-length')) < 500, 'comprimido');
      const bin = await fetch(`${server.url}a.bin`);
      assert.equal(bin.headers.get('content-encoding'), null);
      assert.equal(bin.headers.get('content-length'), String(100 * 1024));
      await bin.arrayBuffer();
      assert.equal((await fetch(`${server.url}nao-existe.js`)).status, 404);
      assert.equal((await fetch(`${server.url}%2e%2e/package.json`)).status, 404);
    } finally {
      await server.close();
    }
  });

  test('reset zera o registro e o relógio', async () => {
    const server = await iniciarServidorLento({ dir });
    try {
      await elapsed(server, ['index.html']);
      assert.equal(server.log.length, 1);
      server.reset();
      assert.equal(server.log.length, 0);
    } finally {
      await server.close();
    }
  });
});
