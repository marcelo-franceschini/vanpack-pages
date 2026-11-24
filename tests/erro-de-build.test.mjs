// Conteúdo errado derruba o build só com a mensagem (arquivo, linha, campo e o que fazer): sem o rastro de
// pilha do Node e sem o "failed to load config" do Vite, que escondiam a mensagem no meio de 5 linhas de
// código. Quem edita content/ sem programar lê o terminal; o que ele precisa ver é a mensagem.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, test } from 'node:test';
import { ROOT, contentCopy } from './dados.mjs';

const VITE = `${ROOT}node_modules/vite/bin/vite.js`;

/** `vite build` com uma cópia de content/ trocada; devolve o código de saída e o que saiu no terminal. */
function buildWith(files) {
  const copy = contentCopy(files);
  try {
    const run = spawnSync(process.execPath, [VITE, 'build', '--outDir', 'dist-erro'], {
      cwd: ROOT,
      env: { ...process.env, VANPACK_CONTENT: copy.dir },
      encoding: 'utf8',
    });
    return { status: run.status, output: `${run.stdout}${run.stderr}` };
  } finally {
    copy.remove();
  }
}

describe('o build com conteúdo errado', () => {
  test('sai com erro e mostra só a mensagem em português, sem rastro de pilha', () => {
    const { status, output } = buildWith({
      'historia.yaml': 'hero:\n  titulo: Caixas: sob medida\n',
    });
    assert.equal(status, 1);
    assert.match(output, /Configuração do site inválida \(veja docs\/go-live\.md\):/);
    assert.match(
      output,
      /content\/historia\.yaml, linha 2, coluna \d+: erro de formatação do YAML/,
    );
    assert.doesNotMatch(output, /\n\s+at \S+/, 'sem linhas de rastro de pilha ("at função ...")');
    assert.doesNotMatch(output, /failed to load config|error during build/);
  });

  test('um erro de tipo em empresa.yaml não vira também "whatsapp () inválido"', () => {
    const { status, output } = buildWith({
      'empresa.yaml': 'whatsapp: "5511987654321"\ntelefone: +551147001234\n',
    });
    assert.equal(status, 1);
    assert.match(output, /› telefone: precisa ser um texto/);
    assert.doesNotMatch(output, /whatsapp \(\)/);
  });
});
