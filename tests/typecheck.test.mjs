// O filtro de scripts/typecheck.mjs: só os erros de tipo de src/scene/ e src/render/ (travados por hash)
// ficam de fora; qualquer outro erro, inclusive em src/main.js e src/produtos/, continua reprovando.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { errosDoTsc, separarTravados } from '../scripts/typecheck.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SAIDA = [
  "src/main.js(22,31): error TS2339: Property 'dataset' does not exist on type 'Element'.",
  "src/scene/geometry.js(76,22): error TS2345: Argument of type 'any[]' is not assignable to parameter of type '[any, any]'.",
  '  Target requires 2 element(s) but source may have fewer.',
  "src/render/stage.js(80,5): error TS2322: Type '(msg: any) => void' is not assignable to type '() => void'.",
  "src/produtos/papelao.js(50,27): error TS2488: Type 'x' must have a '[Symbol.iterator]()' method.",
  '',
].join('\n');

describe('typecheck', () => {
  test('agrupa a mensagem com as linhas recuadas que a continuam', () => {
    const errors = errosDoTsc(SAIDA);
    assert.deepEqual(
      errors.map((e) => [e.file, e.lines.length]),
      [
        ['src/main.js', 1],
        ['src/scene/geometry.js', 2],
        ['src/render/stage.js', 1],
        ['src/produtos/papelao.js', 1],
      ],
    );
  });

  test('só os erros de src/scene/ e src/render/ ficam de fora; main.js e produtos continuam contando', () => {
    const { contam, ignorados } = separarTravados(errosDoTsc(SAIDA));
    assert.deepEqual(
      contam.map((e) => e.file),
      ['src/main.js', 'src/produtos/papelao.js'],
    );
    assert.deepEqual(
      ignorados.map((e) => e.file),
      ['src/scene/geometry.js', 'src/render/stage.js'],
    );
  });

  test('o projeto de verdade passa (src/main.js e src/produtos/ entram na checagem)', () => {
    const run = spawnSync(process.execPath, [`${ROOT}scripts/typecheck.mjs`], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.equal(run.status, 0, `${run.stdout}${run.stderr}`);
    assert.match(
      run.stdout,
      /\d+ erro\(s\) de tipo em src\/scene\/ e src\/render\/ \(travados por hash\) não contam/,
    );
  });
});
