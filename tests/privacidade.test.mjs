// A política de privacidade em Markdown mínimo (build/privacidade.js e content/privacidade.md): título,
// resumo, seções, links (https, tel, WhatsApp), os trechos que dependem de dado ({{#se}}), as duas
// versões da seção de medição e os erros de build (HTML escrito à mão, título ###, link não aceito).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { policyProblems, renderPolicy } from '../build/privacidade.js';
import { renderPage } from '../build/render.js';
import { ROOT, baseContent, emptySite, exampleEnv, siteWith } from './dados.mjs';

const { empresa } = baseContent; // os dados de demonstração, lidos de content/ (nada escrito à mão aqui)

const policy = (site) => renderPolicy(baseContent.privacidade, site);
const page = (site) =>
  renderPage(readFileSync(`${ROOT}politica-de-privacidade.html`, 'utf8'), site);

describe('o texto da política', () => {
  test('título, resumo e seções viram h1, parágrafo lead e h2, na ordem', () => {
    const html = policy(siteWith());
    assert.ok(
      html.startsWith(
        `<h1>Política de privacidade</h1>\n<p class="lead">Em linguagem simples: o site da ${empresa.razao_social}`,
      ),
    );
    const headings = [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1]);
    assert.deepEqual(headings, [
      'Quem é o responsável',
      'Cookies e armazenamento',
      'Medição do uso do site',
      'Para quê e com que base legal',
      'O WhatsApp',
      'Seus direitos',
      'Mudanças',
    ]);
    assert.equal((html.match(/<p class="lead">/g) ?? []).length, 1, 'só um resumo');
  });

  test('a seção de medição: a do Umami com medição, a outra sem', () => {
    const sem = policy(siteWith({ env: { ...exampleEnv, VITE_ANALYTICS_PROVIDER: '' } }));
    assert.ok(sem.includes('O site não envia dados de uso a nenhuma ferramenta de medição.'));
    assert.ok(!sem.includes('A medição é feita pelo'));
    const com = policy(
      siteWith({
        env: {
          ...exampleEnv,
          VITE_ANALYTICS_PROVIDER: 'umami',
          VITE_ANALYTICS_SITE: '12345678-1234-4234-8234-123456789abc',
        },
      }),
    );
    assert.ok(com.includes('A medição é feita pelo Umami Cloud, que não usa cookies'));
    assert.ok(!com.includes('O site não envia dados de uso'));
    for (const html of [sem, com]) {
      assert.equal((html.match(/<h2>Medição do uso do site<\/h2>/g) ?? []).length, 1);
    }
  });

  test('CNPJ, sede e telefone só aparecem com dado; o WhatsApp é um link com a mensagem pronta', () => {
    const demo = policy(siteWith());
    assert.ok(
      demo.includes(
        `é a ${empresa.razao_social}, CNPJ ${empresa.cnpj}, com sede em ${empresa.endereco.rua}, ${empresa.endereco.cidade}-${empresa.endereco.uf}.`,
      ),
    );
    assert.ok(
      demo.includes(
        `chame no <a data-cta="privacidade" data-wa="Olá! Quero falar sobre os meus dados pessoais.">WhatsApp ${siteWith().whatsappDisplay}</a>`,
      ),
    );
    assert.ok(
      demo.includes(
        `ou ligue para <a href="tel:${empresa.telefone}">${empresa.telefone_exibicao}</a>.`,
      ),
    );
    assert.ok(demo.includes(`pelo telefone ${empresa.telefone_exibicao}.`));

    const so = policy(emptySite());
    assert.ok(
      so.includes('é a Vanpack.</p>'),
      'sem razão social, o nome da marca; sem CNPJ nem sede',
    );
    assert.ok(!/CNPJ|com sede em|ou ligue para|pelo telefone/.test(so));
    assert.ok(!so.includes('{{') && !so.includes('{#'));
  });

  test('a página inteira não deixa marca, variável nem link sem destino', () => {
    for (const site of [siteWith(), emptySite()]) {
      const out = page(site);
      assert.ok(!/\{\{|data-need|data-field|<!--render/.test(out));
      for (const [, link] of out.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)) {
        assert.ok(/^https:\/\/wa\.me\/\d{12,13}\?text=/.test(link), link);
        assert.ok(decodeURIComponent(link).endsWith('[site-privacidade]'));
      }
    }
    assert.match(page(siteWith()), /<title>Política de privacidade \| Vanpack<\/title>/);
  });
});

describe('erros de build', () => {
  test('HTML escrito à mão, título ###, link não aceito e falta do título', () => {
    const all = policyProblems(
      [
        '# Título',
        '',
        'Texto com <b>HTML</b>',
        '',
        '### Fundo',
        '',
        '[x](http://inseguro.com) e [y](javascript:alert(1))',
      ].join('\n'),
    ).join('\n');
    assert.match(all, /linha 3: HTML não é aceito/);
    assert.match(all, /linha 5: só há títulos # e ##/);
    assert.match(all, /linha 7: o link \(http:\/\/inseguro\.com\) não é aceito/);
    assert.match(all, /linha 7: o link \(javascript:alert\(1\) não é aceito/);
    assert.match(policyProblems('só texto').join(), /falta o título/);
    assert.deepEqual(
      policyProblems(baseContent.privacidade),
      [],
      'a política de verdade está em ordem',
    );
  });

  test('wa:<código> sem mensagem em whatsapp.yaml é erro', () => {
    assert.throws(
      () => renderPolicy('# T\n\n[x](wa:inventado)', siteWith()),
      /não há whatsapp\.mensagens\.inventado/,
    );
  });
});
