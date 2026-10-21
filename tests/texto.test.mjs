// A linguagem dos textos de content/ ({{variavel}}, {{#se}}, {{#senao}}): pura, roda em milissegundos.
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { escapeHtml, renderText, textProblem, textVariables } from '../build/texto.js';

const vars = { cidade: 'Santo André', cnpj: '', telefone: '(11) 4000-5555', anos: '<b>16</b>' };
const rich = new Set(['anos']);

describe('renderText', () => {
  test('troca as variáveis e escapa o HTML, texto e valor', () => {
    assert.equal(renderText('Fábrica em {{cidade}}', vars), 'Fábrica em Santo André');
    assert.equal(renderText('a "b" & <c>', vars), 'a &quot;b&quot; &amp; &lt;c&gt;');
    assert.equal(renderText('{{x}}', { x: 'a&b' }), 'a&amp;b');
  });

  test('variável rica entra como HTML, sem escapar', () => {
    assert.equal(
      renderText('{{anos}} anos de mercado', vars, { rich }),
      '<b>16</b> anos de mercado',
    );
    assert.equal(renderText('{{anos}}', vars), '&lt;b&gt;16&lt;/b&gt;', 'sem "rich" é escapada');
  });

  test('{{#se}} e {{#senao}} mostram o trecho conforme a variável tenha valor', () => {
    const text = 'Título{{#se cidade}} {{cidade}}{{/se}}{{#senao cnpj}} (sem CNPJ){{/senao}}';
    assert.equal(renderText(text, vars), 'Título Santo André (sem CNPJ)');
    assert.equal(renderText(text, { cidade: '', cnpj: '1' }), 'Título');
  });

  test('{{#se a b}} exige todas as variáveis; {{#senao a b}} vale se alguma faltar', () => {
    const text = '{{#se cidade cnpj}}sede{{/se}}{{#senao cidade cnpj}}sem sede{{/senao}}';
    assert.equal(renderText(text, vars), 'sem sede', 'o CNPJ está vazio');
    assert.equal(renderText(text, { ...vars, cnpj: '1' }), 'sede');
    assert.throws(() => renderText('{{cidade cnpj}}', vars), /só uma variável por vez/);
    assert.throws(() => renderText('{{#se cidade cnpj}}x{{/se cidade}}', vars), /não fecha/);
  });

  test('variável vazia fora de {{#se}} e variável desconhecida são erro, com o nome de quem usa', () => {
    assert.throws(
      () => renderText('CNPJ {{cnpj}}', vars, { where: 'historia.yaml › hero.titulo' }),
      /historia\.yaml › hero\.titulo: \{\{cnpj\}\} está vazia.*\{\{#se cnpj\}\}/,
    );
    assert.throws(
      () => renderText('{{cidde}}', vars),
      /a variável \{\{cidde\}\} não existe\. Use: anos, cidade, cnpj, telefone\./,
    );
    assert.throws(() => renderText('{{#se inventada}}x{{/se}}', vars), /não existe/);
  });
});

describe('sintaxe', () => {
  test('textVariables lista os nomes usados, inclusive nos {{#se}}', () => {
    assert.deepEqual(
      [...textVariables('{{a}} {{#se b}}{{c}}{{/se}} {{#senao d}}x{{/senao}}')].sort(),
      ['a', 'b', 'c', 'd'],
    );
    assert.equal(textVariables('texto puro').size, 0);
  });

  test('textProblem acusa chave sem fechar, {{#se}} sem fim, fecho trocado e {{#se}} aninhado', () => {
    assert.equal(textProblem('{{a}} e {{#se b}}c{{/se}}'), '');
    assert.match(textProblem('{{a'), /mal formadas/);
    assert.match(textProblem('a}} b'), /mal formadas/);
    assert.match(textProblem('{{}}'), /vazias/);
    assert.match(textProblem('{{#se b}}c'), /sem fechamento/);
    assert.match(textProblem('c{{/se}}'), /sem o \{\{#se/);
    assert.match(textProblem('{{#se b}}c{{/senao}}'), /sem o \{\{#senao/);
    assert.match(textProblem('{{#se b}}c{{/se x}}'), /não fecha/);
    assert.match(textProblem('{{#se a}}{{#se b}}x{{/se}}{{/se}}'), /dentro de/);
    assert.match(textProblem('{{#se}}x{{/se}}'), /falta o nome/);
  });

  test('escapeHtml', () => {
    assert.equal(escapeHtml('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});
