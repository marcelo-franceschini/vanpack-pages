// Nenhum texto de negócio no template nem no render: a prova é por comportamento. Todo texto de
// content/ (menos os dados da empresa e os campos técnicos: id, ícone, logo, URL) vira um marcador
// único, ⟦1⟧, ⟦2⟧..., a página é renderizada e, tirados os marcadores, os dados da empresa e os poucos
// rótulos de interface listados abaixo, não pode sobrar nenhuma letra. Se sobrar, há texto escrito à mão
// no index.html (ou no build/render.js) que deveria estar em content/.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { decodeEntities, renderPage } from '../build/render.js';
import { ROOT, baseContent, siteWith } from './dados.mjs';

// Rótulos de interface: não são texto de negócio e ficam no código (a lista é o contrato; ver o README).
const INTERFACE_TEXT = [
  'Pular para o conteúdo', // link de pular, só para teclado e leitor de tela
  'ROLE ↓', // dica de rolagem da abertura
  'Fechar', // botão da folha "O WhatsApp não abriu?"
  'Exemplo', // rótulo do cliente de demonstração
  'Pausar', // controles do carrossel de clientes
];
const INTERFACE_ATTRIBUTES = [
  'Principal', // aria-label dos menus e das regiões
  'Rodapé',
  'Quem somos',
  'Como pedir',
  'Diferenciais',
  'Logos de clientes',
  'Anterior',
  'Próximo',
  'carrossel',
  'Apresentação da', // + {{nome}}
  'Animação 3D da', // + {{nome}} + "com caixas de papelão e o caminhão de entrega"
  'com caixas de papelão e o caminhão de entrega',
  'início',
];
// campos técnicos: não são texto
const TECHNICAL = new Set(['id', 'icone', 'logo', 'url']);

/** O conteúdo com todo texto trocado por um marcador (menos os dados da empresa e os campos técnicos). */
function poisoned(paths = {}) {
  let n = 0;
  const walk = (value, key, path) => {
    if (typeof value === 'string') {
      if (TECHNICAL.has(key)) return value;
      paths[`⟦${++n}⟧`] = path;
      return `⟦${n}⟧`;
    }
    if (Array.isArray(value)) return value.map((item, i) => walk(item, key, `${path}.${i}`));
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, walk(v, k, `${path}.${k}`)]),
      );
    }
    return value;
  };
  const content = { ...baseContent };
  for (const name of Object.keys(content)) {
    if (name !== 'empresa' && name !== 'exemplo') content[name] = walk(content[name], name, name);
  }
  return content;
}

const letters = /[A-Za-zÀ-ÿ]/;
const withoutAll = (text, phrases) =>
  phrases.reduce((rest, phrase) => rest.replaceAll(phrase, ' '), text);

/** O que a página mostra (texto, aria-label, alt, title, metas de descrição), sem os marcadores. */
function shown(html, { companyData }) {
  const clean = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ');
  const text = decodeEntities(clean.replace(/<[^>]+>/g, ' '));
  const attributes = [];
  for (const [tag] of clean.matchAll(/<[a-z][^>]*>/gi)) {
    for (const [, , value] of tag.matchAll(
      /\s(aria-label|alt|title|aria-roledescription)="([^"]*)"/g,
    )) {
      attributes.push(decodeEntities(value));
    }
    const meta = /^<meta\b/.test(tag) && /\s(name|property)="([^"]+)"/.exec(tag)?.[2];
    if (
      [
        'description',
        'og:title',
        'og:description',
        'og:image:alt',
        'og:site_name',
        'twitter:title',
        'twitter:description',
      ].includes(meta)
    ) {
      attributes.push(decodeEntities(/\scontent="([^"]*)"/.exec(tag)?.[1] ?? ''));
    }
  }
  const tidy = (value) =>
    withoutAll(withoutAll(value.replace(/⟦\d+⟧/g, ' '), companyData), [])
      .replace(/\s+/g, ' ')
      .trim();
  return {
    text: withoutAll(tidy(text), INTERFACE_TEXT),
    attributes: attributes.map((value) => withoutAll(tidy(value), INTERFACE_ATTRIBUTES)),
  };
}

/** Os dados da empresa (e o que deriva deles) que a página mostra, para não contarem como texto fixo. */
function companyData(site) {
  const values = [];
  const collect = (value) => {
    if (value && typeof value === 'object') Object.values(value).forEach(collect);
    else if (value !== undefined && value !== null) values.push(String(value));
  };
  collect(baseContent.empresa);
  values.push(
    site.cityState,
    site.phoneDisplay,
    site.whatsappDisplay,
    site.year,
    site.yearsInBusiness,
  );
  return values.filter(Boolean).sort((a, b) => b.length - a.length);
}

const paths = {}; // marcador → de onde veio
const site = siteWith({ content: poisoned(paths) });
const data = { companyData: companyData(site) };

describe('nenhum texto de negócio escrito à mão', () => {
  test('o index.html renderizado só tem texto de content/, dados da empresa e rótulos de interface', () => {
    const page = shown(renderPage(readFileSync(`${ROOT}index.html`, 'utf8'), site), data);
    assert.ok(!letters.test(page.text), `texto fixo no index.html ou no render: "${page.text}"`);
    for (const value of page.attributes) {
      assert.ok(!letters.test(value), `atributo com texto fixo: "${value}"`);
    }
  });

  test('o teste enxerga um texto escrito à mão (se não, ele não prova nada)', () => {
    const template = readFileSync(`${ROOT}index.html`, 'utf8').replace(
      '<h1>{{historia.hero.titulo}}</h1>',
      '<h1>Título escrito à mão</h1>',
    );
    assert.notEqual(template, readFileSync(`${ROOT}index.html`, 'utf8'));
    const page = shown(renderPage(template, site), data);
    assert.match(page.text, /Título escrito à mão/);
    const attribute = readFileSync(`${ROOT}index.html`, 'utf8').replace(
      'aria-label="{{whatsapp.botoes.flutuante_aria}}"',
      'aria-label="Pedir já"',
    );
    assert.ok(shown(renderPage(attribute, site), data).attributes.some((v) => /Pedir já/.test(v)));
  });

  test('todo marcador de content/ aparece em algum lugar da página (nenhum texto fica sem uso)', () => {
    const html = renderPage(readFileSync(`${ROOT}index.html`, 'utf8'), site);
    // as mensagens do WhatsApp vão codificadas no link
    const decoded = [...html.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)]
      .map(([, link]) => decodeURIComponent(link))
      .join(' ');
    const used = new Set(`${html} ${decoded}`.match(/⟦\d+⟧/g));
    const unused = Object.entries(paths)
      .filter(([token]) => !used.has(token))
      .map(([, path]) => path);
    // só os textos que dependem de um dado que a demonstração não tem (o título alternativo do cartão 2, o
    // texto alternativo do cartão 5 e as palavras da nota do Google) e o da política de privacidade
    assert.deepEqual(unused.sort(), [
      'historia.anos.titulo_sem_ano',
      'historia.entrega.texto_sem_regiao',
      'provas.textos.avaliacoes',
      'provas.textos.nota',
      'whatsapp.mensagens.privacidade',
    ]);
  });
});
