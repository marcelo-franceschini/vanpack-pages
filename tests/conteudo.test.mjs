// Conteúdo que não pode estar na página: e-mail fora do lugar dele (o rodapé, o JSON-LD e o texto da
// política de privacidade), prazo de produção ou entrega, promessa de tempo de resposta e descrição do
// processo industrial, em nada que se veja ou que um leitor de tela leia (texto, aria-label, alt, title,
// metas, JSON-LD e as mensagens prontas do WhatsApp); nem travessão longo ou meio travessão. Renderiza a
// página e a política de privacidade em demo e em production, com os mesmos helpers do site-config, e
// confere também o build publicado (o content/ de verdade).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { decodeEntities, renderPage } from '../build/render.js';
import { baseContent, exampleEnv, realContent, siteWith } from './dados.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const POLITICA = 'politica-de-privacidade.html';
const PAGES = ['index.html', POLITICA];
const CONFIGS = {
  demo: siteWith(),
  production: siteWith({
    env: { ...exampleEnv, VITE_DATA_MODE: 'production' },
    content: realContent(),
  }),
};

// Palavras do produto continuam valendo: "Corte e vinco", "com a sua marca impressa", "impressão",
// "O que fabricamos".
const FORBIDDEN = [
  ['e-mail', /e-?mail|mailto:|[\w.+-]+@[\w-]+\.[a-z]{2,}/i],
  ['prazo', /prazo|dias? úteis|\d+\s*dias|entrega em \d|em até \d/i],
  [
    'promessa de tempo de resposta',
    /resposta (na hora|imediata|rápida|em)|respondemos|na hora|24\s*h(oras)?\b|r[áa]pid|\bhoje\b|imediat|em minutos/i,
  ],
  [
    'processo industrial',
    /imprim|\bcort(ar|amos|ada|ado)\b|\bdobr|\bcol(a|ar|amos|ada|ado|agem)\b|vincad|m[áa]quina|linha de produção|\bprodução\b|chapa entra|como fazemos|processo|fabricação/i,
  ],
  ['travessão longo ou meio travessão', /[\u2013\u2014]/],
];

/** Textos de um valor do JSON-LD, em qualquer profundidade. */
const strings = (value) =>
  typeof value === 'string'
    ? [value]
    : value && typeof value === 'object'
      ? Object.values(value).flatMap(strings)
      : [];

/** Tudo o que a página mostra ou faz um leitor de tela ler, num texto só. */
function readable(html) {
  const parts = [];
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/g)) {
    if (!/\s(name|property)="(description|og:[^"]+|twitter:[^"]+)"/.test(tag)) continue;
    parts.push(/\scontent="([^"]*)"/.exec(tag)?.[1] ?? '');
  }
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  if (ld) parts.push(...strings(JSON.parse(ld)));
  for (const [, href] of html.matchAll(/\shref="(https:\/\/wa\.me\/[^"]*)"/g)) {
    parts.push(new URL(decodeEntities(href)).searchParams.get('text') ?? '');
  }
  for (const [, , value] of html.matchAll(/\s(aria-label|alt|title)="([^"]*)"/g)) parts.push(value);
  parts.push(
    html
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  );
  return decodeEntities(parts.join('\n')).replace(/\s+/g, ' ');
}

// Onde o e-mail tem lugar: o rodapé (o campo opcional, com o rótulo "E-mail") e o JSON-LD
// (LocalBusiness.email), em qualquer página; e, só na política de privacidade, o texto dela (a medição
// cita os cliques no e-mail). Na página principal o <main> inteiro continua vigiado.
const EMAIL_LIVRE = [
  /<footer\b[\s\S]*?<\/footer>/gi,
  /<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi,
];
const TEXTO_DA_POLITICA = /<main id="conteudo"[\s\S]*?<\/main>/gi;

/** @param {{ politica?: boolean }} [options] `politica`: a página é a política de privacidade */
function assertClean(html, where, { politica = false } = {}) {
  const text = readable(html);
  assert.ok(text.length > 200, `${where}: a página tem texto`);
  const semEmailLiberado = readable(
    [...EMAIL_LIVRE, ...(politica ? [TEXTO_DA_POLITICA] : [])].reduce(
      (rest, area) => rest.replace(area, ' '),
      html,
    ),
  );
  for (const [name, pattern] of FORBIDDEN) {
    const alvo = name === 'e-mail' ? semEmailLiberado : text;
    const found = pattern.exec(alvo);
    const around = found && alvo.slice(Math.max(0, found.index - 40), found.index + 40);
    assert.equal(found, null, `${where}: ${name} em "…${around}…"`);
  }
}

describe('conteúdo que não pode estar na página', () => {
  for (const [mode, site] of Object.entries(CONFIGS)) {
    for (const page of PAGES) {
      test(`${page} em ${mode}: sem e-mail fora do lugar, prazo, promessa de resposta, processo nem travessão`, () => {
        const html = renderPage(read(page), site);
        assertClean(html, `${page} (${mode})`, { politica: page === POLITICA });
        if (page === 'index.html') {
          const cards = html.match(/<div class="card(?: on)?">/g) ?? [];
          assert.equal(cards.length, 5, 'os 5 cartões da história ficam');
        }
      });
    }
  }

  test('o build publicado (dados de content/) também está limpo', () => {
    for (const page of PAGES) {
      assertClean(read(`dist/${page}`), `dist/${page}`, { politica: page === POLITICA });
    }
  });

  test('os textos de content/ também estão limpos, antes de virarem página', () => {
    const texts = [];
    const textsComEmail = [];
    const collect = (value, target) => {
      if (typeof value === 'string') target.push(value);
      else if (Array.isArray(value)) value.forEach((v) => collect(v, target));
      else if (value && typeof value === 'object')
        Object.values(value).forEach((v) => collect(v, target));
    };
    // o que vira texto da página: tudo menos os dados da empresa (valores) e os de exemplo.
    // O rodapé e a política podem citar e-mail; os outros arquivos não.
    for (const [name, value] of Object.entries(baseContent)) {
      if (name === 'empresa' || name === 'exemplo') continue;
      if (name === 'rodape' || name === 'privacidade') {
        collect(value, textsComEmail);
      } else {
        collect(value, texts);
        collect(value, textsComEmail);
      }
    }
    const text = texts.join(' ');
    const textComEmail = textsComEmail.join(' ');
    for (const [name, pattern] of FORBIDDEN) {
      const alvo = name === 'e-mail' ? text : textComEmail;
      const found = pattern.exec(alvo);
      assert.equal(
        found,
        null,
        `content/: ${name} em "…${found && alvo.slice(Math.max(0, found.index - 40), found.index + 40)}…"`,
      );
    }
  });

  test('o próprio filtro pega cada caso proibido', () => {
    const page = (body) =>
      `<html><head><title>Vanpack</title></head><body><p>${body}</p></body></html>`;
    const filler = 'Caixas de papelão sob medida, com a sua marca impressa. '.repeat(5);
    for (const sample of [
      'Fale com vendas@empresa.com.br',
      'Prazo de 10 dias úteis',
      'Resposta na hora, 24 horas',
      'Orçamento rápido',
      'Receba o orçamento hoje',
      'A chapa entra na máquina',
      'Imprimimos e cortamos de uma vez',
      'Dobramos e colamos',
      'Ver como fazemos',
      'Caixas \u2014 sob medida',
    ]) {
      assert.throws(() => assertClean(page(filler + sample), 'amostra'), sample);
    }
    assert.doesNotThrow(() =>
      assertClean(page(`${filler}Corte e vinco. O que fabricamos. Mesma impressão.`), 'amostra'),
    );
    // o e-mail no lugar dele passa; no <main> da página principal, não
    const html = (main, footer = '') =>
      `<html><head><title>Vanpack</title></head><body><main id="conteudo"><p>${filler}${main}</p></main><footer>${footer}</footer></body></html>`;
    const email = 'Fale com vendas@empresa.com.br';
    assert.doesNotThrow(() => assertClean(html('', email), 'rodapé'), 'e-mail no rodapé');
    assert.throws(() => assertClean(html(email), 'página principal'), 'e-mail no <main>');
    assert.doesNotThrow(
      () => assertClean(html(email), 'política', { politica: true }),
      'e-mail no texto da política',
    );
  });
});
