// Trava do 3D principal: a cena (src/scene), o render (src/render) e os testes da cena não mudam.
// O sha256 de cada arquivo fica em tests/fixtures/3d-lock.json; arquivo listado que mudou ou sumiu
// derruba o teste. Arquivo novo nessas pastas (o 3D de cada produto, por exemplo) não entra na trava.
// Sem o fixture, a primeira execução local o cria a partir dos arquivos como estão; no CI, falha.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { test } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const FIXTURE = `${ROOT}tests/fixtures/3d-lock.json`;
const MESSAGE = 'O 3D principal é intocável';

function files() {
  const found = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else found.push(relative(ROOT, path));
    }
  };
  walk(`${ROOT}src/scene`);
  walk(`${ROOT}src/render`);
  return [...found, 'tests/scene.test.mjs'].sort();
}

const sha256 = (file) =>
  createHash('sha256')
    .update(readFileSync(`${ROOT}${file}`))
    .digest('hex');

test('a cena 3D principal, o render e os testes da cena estão iguais aos da trava', (t) => {
  if (!existsSync(FIXTURE)) {
    assert.ok(!process.env.CI, `${MESSAGE}: tests/fixtures/3d-lock.json sumiu`);
    const arquivos = Object.fromEntries(files().map((file) => [file, sha256(file)]));
    mkdirSync(dirname(FIXTURE), { recursive: true });
    writeFileSync(FIXTURE, `${JSON.stringify({ arquivos }, null, 2)}\n`);
    t.diagnostic(`trava criada com ${Object.keys(arquivos).length} arquivos`);
    return;
  }
  const { arquivos } = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  assert.ok(Object.keys(arquivos).length > 10, 'a trava lista os arquivos do 3D');
  for (const [file, hash] of Object.entries(arquivos)) {
    assert.ok(existsSync(`${ROOT}${file}`), `${MESSAGE}: ${file} sumiu`);
    assert.equal(sha256(file), hash, `${MESSAGE}: ${file} mudou`);
  }
});
