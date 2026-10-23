// O carregador de content/ (build/content.js): o conteúdo de verdade passa sem erros e cada tipo de
// problema (YAML mal formado, campo que falta ou não existe, tipo errado, texto grande demais, lista
// grande demais, valor fora da lista, travessão, variável inexistente) vira uma mensagem em português
// com o arquivo, a linha e o campo. Roda sobre cópias de content/ em pasta temporária.
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { stringify } from 'yaml';
import { readContent } from '../build/content.js';
import { ROOT, contentCopy, readYaml } from './dados.mjs';

/** Os erros de uma cópia de content/ com os arquivos trocados (texto cru ou objeto que vira YAML). */
function errorsWith(files) {
  const { dir, remove } = contentCopy(files);
  try {
    return readContent(dir).errors;
  } finally {
    remove();
  }
}
const joined = (files) => errorsWith(files).join('\n');
const empresa = readYaml('empresa.yaml');

describe('o conteúdo de verdade', () => {
  test('lê todos os arquivos sem erro, e o exemplo também', () => {
    const { content, errors } = readContent(`${ROOT}content`);
    assert.deepEqual(errors, []);
    for (const name of ['empresa', 'produtos', 'diferenciais', 'clientes', 'provas']) {
      assert.ok(content[name], name);
    }
    assert.ok(content.exemplo.empresa.whatsapp, 'dados fictícios de referência');
  });
});

describe('YAML mal formado', () => {
  test('campo repetido e recuo errado dizem a linha, em português', () => {
    assert.match(
      joined({ 'empresa.yaml': 'whatsapp: "5511955554444"\nwhatsapp: "5511955554445"\n' }),
      /content\/empresa\.yaml, linha 2, coluna 1: erro de formatação do YAML: o mesmo campo aparece duas vezes/,
    );
    assert.match(
      joined({ 'empresa.yaml': 'endereco:\n  rua: "x"\n   cidade: "y"\n' }),
      /erro de formatação do YAML/,
    );
  });

  test('texto com ":" no meio e sem aspas: a causa em português, não a frase do YAML em inglês', () => {
    const all = joined({ 'historia.yaml': 'hero:\n  titulo: Caixas: sob medida\n' });
    assert.match(
      all,
      /linha 2, coluna \d+: erro de formatação do YAML: o texto tem ":" no meio e o YAML o leu como outro campo; ponha o texto inteiro entre aspas/,
    );
    assert.doesNotMatch(all, /Nested mappings/);
  });

  test('Tab no recuo: as linhas seguintes com a mesma causa viram uma mensagem só', () => {
    const errors = errorsWith({
      'historia.yaml': 'hero:\n\tetiqueta: "x"\n    titulo: "y"\n    texto: "z"\n    botao: "w"\n',
    });
    // antes eram 1 linha por linha seguinte (5 mensagens para um Tab só)
    assert.ok(errors.length <= 2, errors.join('\n'));
    assert.match(
      errors.join('\n'),
      /linha 2, coluna 1: erro de formatação do YAML: o recuo usa Tab/,
    );
    assert.match(
      errors.join('\n'),
      /linhas 3 a 5, coluna \d+: erro de formatação do YAML: recuo errado/,
    );
  });

  test('arquivo que falta é dito', () => {
    const { dir, remove } = contentCopy();
    try {
      rmSync(join(dir, 'provas.yaml'));
      assert.deepEqual(readContent(dir).errors, ['content/provas.yaml: o arquivo não existe']);
    } finally {
      remove();
    }
  });
});

describe('campos e tipos', () => {
  test('campo que falta, campo desconhecido (com sugestão de digitação) e tipo errado', () => {
    const all = joined({
      'empresa.yaml': stringify({ endereco: { cidde: 'Santo André' }, cor: 'azul', cnpj: 123 }),
    });
    assert.match(all, /empresa\.yaml, linha \d+ › whatsapp: falta o campo "whatsapp"/);
    assert.match(all, /endereco\.cidde: o campo "cidde" não existe \(você quis dizer "cidade"\?\)/);
    assert.match(all, /› cor: o campo "cor" não existe; os campos são: razao_social/);
    assert.match(
      all,
      /› cnpj: precisa ser um texto \(entre aspas\); o valor 123 foi lido como número/,
    );
  });

  test('número sem aspas: a mensagem mostra o que foi digitado e manda pôr entre aspas', () => {
    // sinal e zeros à esquerda somem na leitura: sem o texto digitado, "o valor 100" não bate com o arquivo
    const all = joined({
      'empresa.yaml':
        'whatsapp: "5511955554444"\ntelefone: +551147009999\ncnpj: 00000000000100\nendereco:\n  cep: 123\n',
    });
    assert.match(
      all,
      /› telefone: precisa ser um texto \(entre aspas\); você escreveu \+551147009999, que o YAML leu como o número 551147009999; ponha-o entre aspas/,
    );
    assert.match(
      all,
      /› cnpj: .*você escreveu 00000000000100, que o YAML leu como o número 100; ponha-o entre aspas/,
    );
    // sem diferença entre o digitado e o lido, a frase curta de sempre
    assert.match(
      all,
      /› endereco\.cep: precisa ser um texto \(entre aspas\); o valor 123 foi lido como número, ponha-o entre aspas/,
    );
  });

  test('confirmados aceita só os campos que podem coincidir com o exemplo', () => {
    assert.deepEqual(
      errorsWith({ 'empresa.yaml': stringify({ ...empresa, confirmados: ['horario', 'regiao'] }) }),
      [],
    );
    assert.match(
      joined({ 'empresa.yaml': stringify({ ...empresa, confirmados: ['horario', 'cnpj'] }) }),
      /› confirmados\[1\]: valor não aceito; use um destes: horario, horario_schema, regiao, pagamento/,
    );
  });

  test('texto maior que o limite, UF e link fora do formato', () => {
    const all = joined({
      'empresa.yaml': stringify({
        ...empresa,
        razao_social: 'x'.repeat(81),
        endereco: { ...empresa.endereco, uf: 'sp1' },
        mapa: 'http://maps.google.com',
      }),
    });
    assert.match(
      all,
      /› razao_social: tem 81 caracteres; o máximo é 80 \(um texto maior quebraria o layout\)/,
    );
    assert.match(all, /› endereco\.uf: use a sigla da UF com duas letras, ex\.: SP/);
    assert.match(all, /› mapa: o link do mapa precisa começar com https:\/\//);
  });
});

describe('listas', () => {
  const diferencial = { titulo: 'Título', texto: 'Texto.', icone: 'fabrica' };

  test('diferenciais: mais de 6, ícone fora da lista e título vazio', () => {
    const all = joined({
      'diferenciais.yaml': stringify({
        itens: [...Array(7).fill(diferencial), { ...diferencial, icone: 'estrela', titulo: '' }],
      }),
    });
    assert.match(all, /› itens: tem 8 itens; o máximo é 6/);
    assert.match(
      all,
      /› itens\[7\]\.icone: valor não aceito; use um destes: fabrica, lotes, conversa, caixa/,
    );
    assert.match(all, /› itens\[7\]\.titulo: não pode ficar vazio/);
  });

  test('clientes: mais de 12, logo fora do padrão, alt vazio e campo desconhecido', () => {
    const all = joined({
      'clientes.yaml': stringify({
        clientes: [
          ...Array(12).fill({ nome: 'Cliente' }),
          { nome: 'Loja', logo: 'Logo Alfa.PNG', alt: '', link: 'https://x.com' },
        ],
      }),
    });
    assert.match(all, /› clientes: tem 13 itens; o máximo é 12/);
    assert.match(
      all,
      /› clientes\[12\]\.logo: o logo é o nome de um arquivo SVG em content\/clientes\//,
    );
    assert.match(all, /› clientes\[12\]\.alt: não pode ficar vazio/);
    assert.match(all, /› clientes\[12\]\.link: o campo "link" não existe/);
  });

  test('produtos: peça 3D que não existe e mais de 3 cartões', () => {
    const item = { id: 'chapas', nome: 'N', mensagem: 'M', peca: 'P', texto: 'T' };
    const all = joined({
      'produtos.yaml': stringify({ itens: [item, item, item, { ...item, id: 'cubos' }] }),
    });
    assert.match(all, /› itens: tem 4 itens; o máximo é 3/);
    assert.match(
      all,
      /› itens\[3\]\.id: valor não aceito; use um destes: corte-e-vinco, divisorias, chapas/,
    );
  });

  test('provas: nota fora de 1 a 5 e depoimento sem autorização declarada', () => {
    const all = joined({
      'provas.yaml': stringify({
        depoimentos: [{ id: 'Padaria Real', citacao: 'Boa.', autor: 'Fulana' }],
        nota_google: { valor: 7, quantidade: 0, url: 'g.page/r/x', autorizado: true },
      }),
    });
    assert.match(all, /depoimentos\[0\]\.autorizado: falta o campo "autorizado"/);
    assert.match(all, /depoimentos\[0\]\.id: o id usa minúsculas, números e hífens/);
    assert.match(all, /nota_google\.valor: precisa ser no máximo 5/);
    assert.match(all, /nota_google\.quantidade: precisa ser 1 ou mais/);
    assert.match(all, /nota_google\.url: o link precisa começar com https:\/\//);
  });
});

describe('os textos', () => {
  test('travessão, variável que não existe e {{#se}} sem fechamento', () => {
    const all = joined({
      'produtos.yaml': stringify({
        itens: [
          {
            id: 'chapas',
            nome: 'Chapas — de papelão',
            mensagem: 'Olá {{cidde}}',
            peca: 'chapas {{#se cidade}} x',
            texto: 'T',
          },
        ],
      }),
    });
    assert.match(
      all,
      /› itens\[0\]\.nome: tem travessão longo \(— ou –\); use dois-pontos, vírgula, ponto ou hífen/,
    );
    assert.match(
      all,
      /› itens\[0\]\.mensagem: a variável \{\{cidde\}\} não existe; use: nome, razao_social/,
    );
    assert.match(all, /› itens\[0\]\.peca: \{\{#se cidade\}\} sem fechamento/);
  });
});
