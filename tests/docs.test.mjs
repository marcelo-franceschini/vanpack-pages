// A documentação não pode ficar para trás do código: sem travessão longo em nenhum texto do repositório
// (a regra vale além do site publicado), todas as variáveis dos textos e todos os comandos do package.json
// explicados no README, e os arquivos de projeto que um colaborador espera encontrar. Puro, sem navegador.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { VAR_NAMES } from '../site.config.js';
import { ROOT } from './dados.mjs';

const read = (file) => readFileSync(join(ROOT, file), 'utf8');

/** Todos os arquivos de texto (.md, .yml, .yaml) das pastas e arquivos dados. */
function documents(...paths) {
  const found = [];
  const visit = (path) => {
    const full = join(ROOT, path);
    if (!existsSync(full)) return;
    if (statSync(full).isDirectory()) {
      for (const name of readdirSync(full)) visit(join(path, name));
    } else if (/\.(md|ya?ml)$/.test(path) || /^(LICENSE)$/.test(path)) found.push(path);
  };
  paths.forEach(visit);
  return found;
}

describe('documentação', () => {
  test('sem travessão longo (— ou –) no README, nos guias, em docs/, em content/ e nos workflows', () => {
    const files = documents(
      'README.md',
      'CONTRIBUTING.md',
      'LICENSE',
      'docs',
      'content',
      '.github',
    );
    assert.ok(files.length > 20, 'achou os documentos');
    for (const file of files) {
      const lines = read(file).split('\n');
      const at = lines.findIndex((line) => /[–—]/.test(line));
      assert.equal(
        at,
        -1,
        `${file}, linha ${at + 1}: tem travessão; use dois-pontos, vírgula, ponto ou hífen`,
      );
    }
  });

  test('o README explica toda variável dos textos e todo comando de auditoria', () => {
    const readme = read('README.md');
    for (const name of VAR_NAMES) {
      assert.ok(readme.includes(`{{${name}}}`), `o README não explica a variável {{${name}}}`);
    }
    const scripts = Object.keys(JSON.parse(read('package.json')).scripts);
    for (const script of scripts.filter((name) =>
      /^(audit:|typecheck|lint|format|preview)/.test(name),
    )) {
      assert.ok(
        readme.includes(`npm run ${script}`),
        `o README não lista o comando npm run ${script}`,
      );
    }
  });

  test('os arquivos de projeto que o colaborador espera existem', () => {
    for (const file of [
      'LICENSE',
      'CONTRIBUTING.md',
      '.editorconfig',
      '.nvmrc',
      '.github/dependabot.yml',
    ]) {
      assert.ok(existsSync(join(ROOT, file)), `falta ${file}`);
    }
    assert.match(read('LICENSE'), /Todos os direitos reservados/);
    assert.match(read('CONTRIBUTING.md'), /muda-visual/);
    assert.match(read('CONTRIBUTING.md'), /muda-html/);
  });

  test('o Node do .nvmrc está dentro do que o package.json aceita', () => {
    const major = Number(read('.nvmrc').trim().replace(/^v/, '').split('.')[0]);
    const minimum = JSON.parse(read('package.json')).engines.node.match(/(\d+)\.\d+/)[1];
    assert.ok(major >= Number(minimum), `.nvmrc (${major}) abaixo do mínimo ${minimum}`);
  });
});
