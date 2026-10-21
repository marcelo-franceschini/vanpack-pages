// HTML válido: html-validate (local, nada vai para fora) sobre as páginas publicadas, com as regras de
// .htmlvalidate.json. Desligadas de propósito: void-style e doctype-style (o estilo que o Prettier escreve)
// e tel-non-breaking (trocar o espaço e o hífen do telefone por versões que não quebram mudaria onde a
// linha quebra e o texto copiado).
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { describe, test } from 'node:test';
import { FileSystemConfigLoader, HtmlValidate } from 'html-validate/node';
import { ROOT } from './dados.mjs';

const PAGES = ['index.html', 'politica-de-privacidade.html', '404.html'];
const built = existsSync(`${ROOT}dist/index.html`);

describe('HTML publicado', { skip: !built && 'sem dist/: rode `npm run build`' }, () => {
  const validator = new HtmlValidate(new FileSystemConfigLoader());

  for (const page of PAGES) {
    test(`${page} não tem erro de HTML nem de acessibilidade do html-validate`, async () => {
      const report = await validator.validateFile(`${ROOT}dist/${page}`);
      const problems = report.results.flatMap((result) =>
        result.messages.map(
          (message) => `${message.line}:${message.column} ${message.ruleId}: ${message.message}`,
        ),
      );
      assert.deepEqual(problems, []);
    });
  }

  test('o validador enxerga um erro (se não, ele não prova nada)', async () => {
    const report = await validator.validateString(
      '<!doctype html><html lang="pt-BR"><head><title>x</title></head><body><img src="a.png"><button></button></body></html>',
      `${ROOT}amostra.html`, // o caminho escolhe a config (.htmlvalidate.json)
    );
    assert.equal(report.valid, false);
  });
});
