// O hook de pre-push opcional (.githooks/pre-push, ativado por `npm run hooks:instalar`): roda lint e tipos
// e recusa o push se um deles falhar. O teste roda o script de verdade num repositório git descartável,
// com um package.json cujos lint e typecheck passam ou falham, sem depender de ESLint nem do tsc.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const HOOK = `${ROOT}.githooks/pre-push`;

/** Roda o hook num repositório descartável cujo lint e typecheck têm estes comandos. */
function pushWith({ lint, typecheck }) {
  const dir = mkdtempSync(join(tmpdir(), 'vanpack-hook-'));
  try {
    spawnSync('git', ['init', '-q'], { cwd: dir });
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ scripts: { lint: `${lint}`, typecheck: `${typecheck}` } }),
    );
    copyFileSync(HOOK, join(dir, 'pre-push'));
    const run = spawnSync('sh', ['pre-push'], { cwd: dir, encoding: 'utf8' });
    return { status: run.status, output: `${run.stdout}${run.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('hook de pre-push', () => {
  test('o arquivo é executável (o git só roda hook executável) e o script de instalação existe', () => {
    assert.ok(statSync(HOOK).mode & 0o111, '.githooks/pre-push precisa de permissão de execução');
    const scripts = JSON.parse(
      spawnSync('node', ['-p', 'JSON.stringify(require("./package.json").scripts)'], {
        cwd: ROOT,
        encoding: 'utf8',
      }).stdout,
    );
    assert.equal(scripts['hooks:instalar'], 'git config core.hooksPath .githooks');
  });

  test('lint e tipos passando: o push segue', () => {
    const { status, output } = pushWith({ lint: 'echo lint-ok', typecheck: 'echo tipos-ok' });
    assert.equal(status, 0, output);
    assert.match(output, /lint-ok[\s\S]*tipos-ok/);
  });

  test('lint falhando: o push é recusado e os tipos nem rodam', () => {
    const { status, output } = pushWith({
      lint: 'echo lint-falhou; exit 1',
      typecheck: 'echo tipos-ok',
    });
    assert.notEqual(status, 0);
    assert.match(output, /lint-falhou/);
    assert.doesNotMatch(output, /tipos-ok/);
  });

  test('tipos falhando: o push é recusado', () => {
    const { status } = pushWith({ lint: 'echo lint-ok', typecheck: 'exit 1' });
    assert.notEqual(status, 0);
  });
});
