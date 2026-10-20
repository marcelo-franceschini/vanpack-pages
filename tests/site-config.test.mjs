// Config e render dos dados da empresa: puros (sem navegador nem build), então rodam em segundos.
// Cobre a trava de go-live (demo × production), o render com a config vazia (nada de campo vazio nem
// {{placeholder}} sobrando), o JSON-LD, o robots.txt e o sitemap.xml.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { parseEnv } from '../build/env.js';
import { contentSecurityPolicy } from '../build/csp.js';
import { robotsTxt, sitemapXml } from '../build/files.js';
import { buildJsonLd, interpolate, renderPage } from '../build/render.js';
import { isValidCnpj, validateSite } from '../build/validate.js';
import { DIFF_ICONS, createSiteConfig, models, proofs, slug } from '../site.config.js';
import { yearsSince } from '../src/years.js';
import { realEnv } from './real-env.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const html = read('index.html');
const example = parseEnv(read('.env.example'));

const REAL = realEnv(example);

const validate = (env, now) => validateSite({ site: createSiteConfig(env), env, example, now });

describe('createSiteConfig', () => {
  test('lê só o env recebido e normaliza os campos', () => {
    const site = createSiteConfig({
      VITE_WHATSAPP: '+55 (11) 91234-5678',
      VITE_PHONE: '+551147001234',
      VITE_CITY: ' Santo André ',
      VITE_STATE: 'SP',
    });
    assert.equal(site.whatsapp, '5511912345678');
    assert.equal(
      site.phoneDisplay,
      '(11) 4700-1234',
      'formata o telefone quando não há texto pronto',
    );
    assert.equal(site.cityState, 'Santo André-SP');
    assert.equal(site.vars.holder, 'Vanpack', 'sem razão social o © usa o nome da marca');
  });

  test('anos de mercado e ano do © vêm da data do build', () => {
    const site = createSiteConfig({ VITE_FOUNDED_YEAR: '2010' }, new Date('2031-06-01'));
    assert.equal(site.yearsInBusiness, '21');
    assert.equal(site.year, '2031');
    assert.equal(createSiteConfig({}).yearsInBusiness, '', 'sem ano de fundação não há texto');
    assert.equal(yearsSince('2010', new Date('2026-10-15')), 16);
    assert.ok(Number.isNaN(yearsSince('')));
    assert.ok(Number.isNaN(yearsSince('abc')));
  });

  test('com o env vazio todo campo da empresa fica vazio (nada inventado)', () => {
    const site = createSiteConfig({});
    for (const key of ['cnpj', 'phone', 'whatsapp', 'legalName', 'hours', 'mapUrl']) {
      assert.equal(site[key], '', key);
    }
    assert.ok(site.vars.description.length > 20, 'a descrição tem texto mesmo sem cidade');
  });
});

describe('trava de go-live', () => {
  test('o CNPJ fictício é inválido e o real passa', () => {
    assert.equal(isValidCnpj(example.VITE_CNPJ), false, 'o CNPJ fictício é inválido');
    assert.equal(isValidCnpj('11.111.111/1111-11'), false);
    assert.equal(isValidCnpj('11.222.333/0001-81'), true);
    assert.equal(isValidCnpj('11222333000181'), true);
  });

  test('demo aceita os dados fictícios do .env.example e avisa', () => {
    const { errors, warnings } = validate(example);
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => w.includes('demo')));
  });

  test('modo desconhecido, WhatsApp vazio ou inválido e URL sem "/" falham com mensagem clara', () => {
    assert.match(
      validate({ ...example, VITE_DATA_MODE: 'xyz' }).errors.join('\n'),
      /VITE_DATA_MODE/,
    );
    assert.match(validate({ ...example, VITE_DATA_MODE: '' }).errors.join('\n'), /VITE_DATA_MODE/);
    assert.match(validate({ ...example, VITE_WHATSAPP: '' }).errors.join('\n'), /VITE_WHATSAPP/);
    assert.match(
      validate({ ...example, VITE_WHATSAPP: '119000' }).errors.join('\n'),
      /VITE_WHATSAPP/,
    );
    assert.match(
      validate({ ...example, VITE_SITE_URL: 'https://site.com.br' }).errors.join('\n'),
      /VITE_SITE_URL/,
    );
  });

  test('production com os dados fictícios falha e lista cada valor que sobrou', () => {
    const { errors } = validate({ ...example, VITE_DATA_MODE: 'production' });
    const all = errors.join('\n');
    for (const key of [
      'VITE_WHATSAPP',
      'VITE_PHONE',
      'VITE_CNPJ',
      'VITE_LEGAL_NAME',
      'VITE_STREET',
      'VITE_CEP',
      'VITE_HOURS',
      'VITE_SERVICE_AREA',
      'VITE_CLIENT_1_NAME',
      'VITE_CLIENT_6_NAME',
    ]) {
      assert.match(all, new RegExp(`${key}`), `${key} sobrou no .env`);
    }
    assert.ok(!/VITE_DIFF_/.test(all), 'os diferenciais não contam como fictícios');
    assert.match(all, /CNPJ válido|não é um CNPJ válido/, 'o CNPJ fictício também é inválido');
  });

  test('production com dados reais passa; cidade e UF iguais ao exemplo não contam como fictício', () => {
    const { errors, warnings } = validate(REAL);
    assert.deepEqual(errors, []);
    assert.equal(REAL.VITE_CITY, example.VITE_CITY);
    assert.ok(
      warnings.some((w) => w.includes('VITE_ANALYTICS_PROVIDER')),
      'avisa que não há medição',
    );
    assert.deepEqual(
      validate({
        ...REAL,
        VITE_ANALYTICS_PROVIDER: 'umami',
        VITE_ANALYTICS_SITE: '56f48c71-e0b8-4e7a-ac56-be2631e2e31d',
      }).warnings,
      [],
    );
  });

  test('production exige os campos obrigatórios e os formatos', () => {
    for (const [key, value] of [
      ['VITE_CNPJ', ''],
      ['VITE_CNPJ', '11.222.333/0001-82'],
      ['VITE_PHONE', '11 4700-1234'],
      ['VITE_STATE', 'sp'],
      ['VITE_CEP', '123'],
      ['VITE_HOURS', ''],
      ['VITE_SITE_URL', 'http://empresa.com.br/'],
    ]) {
      const { errors } = validate({ ...REAL, [key]: value });
      assert.ok(
        errors.some((e) => e.includes(key)),
        `${key}="${value}" deveria falhar`,
      );
    }
  });

  test('diferenciais e clientes: ícone, logo, autorização e numeração inválidos falham nos dois modos', () => {
    for (const [key, value] of [
      ['VITE_DIFF_1_ICON', 'estrela'],
      ['VITE_CLIENT_1_LOGO', 'logo.png'],
      ['VITE_CLIENT_1_LOGO', '../logo.svg'],
      ['VITE_CLIENT_1_LOGO', '/clientes/logo.svg'],
      ['VITE_CLIENT_1_AUTH', 'talvez'],
      ['VITE_DIFF_7_TITLE', 'Sétimo'],
      ['VITE_DIFF_0_TITLE', 'Zero'],
      ['VITE_CLIENT_13_NAME', 'Décimo terceiro'],
    ]) {
      for (const env of [example, REAL]) {
        assert.ok(
          validate({ ...env, [key]: value }).errors.some((e) => e.includes(key)),
          `${key}="${value}" deveria falhar (${env.VITE_DATA_MODE})`,
        );
      }
    }
    for (const [key, value] of [
      ['VITE_DIFF_6_ICON', 'caixa'],
      ['VITE_CLIENT_12_LOGO', 'loja-1.svg'],
      ['VITE_CLIENT_12_AUTH', 'Sim'],
    ]) {
      assert.deepEqual(validate({ ...REAL, [key]: value }).errors, [], `${key}="${value}"`);
    }
  });

  test('analytics: provedor desconhecido ou Umami sem Website ID falham; ano de fundação no futuro também', () => {
    assert.match(
      validate({ ...example, VITE_ANALYTICS_PROVIDER: 'ga4' }).errors.join('\n'),
      /ANALYTICS_PROVIDER/,
    );
    assert.match(
      validate({ ...example, VITE_ANALYTICS_PROVIDER: 'umami' }).errors.join('\n'),
      /ANALYTICS_SITE/,
    );
    assert.match(
      validate({ ...example, VITE_FOUNDED_YEAR: '2999' }, new Date('2026-10-15')).errors.join('\n'),
      /VITE_FOUNDED_YEAR/,
    );
  });
});

describe('render', () => {
  // O render recusa wa.me sem número, então a config "vazia" leva só o WhatsApp.
  const empty = createSiteConfig({ VITE_WHATSAPP: '5511912345678' });
  const demo = createSiteConfig(example);

  test('com a config vazia nenhum campo, elemento vazio ou {{placeholder}} sobra na página', () => {
    const out = renderPage(html, empty);
    assert.ok(!/data-need|data-field|\{\{/.test(out), 'sem marcas nem placeholders');
    assert.match(out, /<p class="slogan">Do projeto à entrega<\/p>/, 'o slogan do manual fica');
    assert.ok(!/<dl|<dt|<dd/.test(out), 'sem campos de rodapé vazios');
    assert.ok(!out.includes('Fábrica própria'), 'sem cidade o eyebrow some');
    assert.ok(!/Atendemos (?!lojas)/.test(out), 'sem região, nenhum "Atendemos" da região');
    assert.match(
      out,
      /<span>Da nossa fábrica até o seu endereço\.<\/span>/,
      'sem região, o cartão 5 mostra o texto alternativo',
    );
    assert.ok(!out.includes('noindex'), 'só o modo demo leva noindex');
    const ld = JSON.parse(
      out.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(ld['@type'], 'LocalBusiness');
    for (const key of [
      'telephone',
      'email',
      'taxID',
      'openingHours',
      'areaServed',
      'foundingDate',
    ]) {
      assert.ok(!(key in ld), `${key} não sai no JSON-LD sem dado`);
    }
  });

  test('com os dados do .env.example tudo aparece, o JSON-LD é completo e o noindex liga', () => {
    const out = renderPage(html, demo);
    const flat = out.replace(/\s+/g, ' ');
    assert.ok(!/data-need|data-field|\{\{/.test(out));
    for (const value of [example.VITE_CNPJ, example.VITE_LEGAL_NAME, example.VITE_HOURS]) {
      assert.ok(flat.includes(value), value);
    }
    assert.ok(flat.includes(`href="tel:${example.VITE_PHONE}"`));
    assert.ok(!flat.includes('mailto:'), 'sem e-mail na página');
    assert.ok(flat.includes('Fábrica própria em Santo André-SP'));
    assert.ok(flat.includes('Atendemos Santo André, ABC e Grande São Paulo'));
    assert.match(out, /<meta name="robots" content="noindex,nofollow" \/>/);
    for (const [, link] of out.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)) {
      assert.ok(link.startsWith(`https://wa.me/${example.VITE_WHATSAPP}?text=`), link);
    }
    const ld = buildJsonLd(demo);
    assert.equal(ld.telephone, example.VITE_PHONE);
    assert.equal(ld.openingHours, example.VITE_HOURS_SCHEMA);
    assert.equal(ld.address.addressLocality, 'Santo André');
    assert.equal(ld.address.streetAddress, `${example.VITE_STREET}, ${example.VITE_DISTRICT}`);
    assert.ok(!('aggregateRating' in ld), 'sem avaliação própria');
  });

  test('a faixa de confiança some inteira sem dado e, com pouco dado, mostra só o que existe', () => {
    assert.ok(!renderPage(html, empty).includes('id="confianca"'));
    const onlyCnpj = createSiteConfig({
      VITE_WHATSAPP: '5511912345678',
      VITE_CNPJ: REAL.VITE_CNPJ,
    });
    const strip = renderPage(html, onlyCnpj).match(/<section class="trust"[\s\S]*?<\/section>/)[0];
    assert.ok(strip.includes(`CNPJ ${REAL.VITE_CNPJ}`));
    assert.ok(strip.includes('Nunca pedimos pagamento para conta de pessoa física'));
    assert.ok(!/anos de mercado|tel:|mailto:|Fábrica própria|Pagamento:/.test(strip), strip);
  });

  test('sem ano de fundação não há anos de mercado nem "Desde"; o cartão 2 usa o texto alternativo', () => {
    const semAno = createSiteConfig({ ...example, VITE_FOUNDED_YEAR: '' });
    const out = renderPage(html, semAno);
    assert.ok(!/data-since|anos de\s+mercado<|Desde/.test(out));
    assert.ok(out.includes('Experiência em caixas de papelão'));
    const comAno = renderPage(html, demo);
    assert.ok(comAno.includes('Desde 2010'));
    assert.match(comAno, /<span data-since="2010">\d+<\/span> anos de\s+mercado/);
    assert.ok(!comAno.includes('Experiência em caixas de papelão'));
  });

  test('os 5 cartões da história ficam com qualquer config (o scroll depende deles)', () => {
    for (const site of [empty, demo, createSiteConfig(REAL)]) {
      const cards = renderPage(html, site).match(/<div class="card(?: on)?">/g) ?? [];
      assert.equal(cards.length, 5, site.dataMode || 'vazia');
    }
  });

  test('data-need="!chave" mostra o texto de quando falta o dado', () => {
    const snippet = '<p data-need="cnpj">com</p><p data-need="!cnpj">sem</p>';
    assert.equal(renderPage(snippet, empty), '<p>sem</p>');
    assert.equal(renderPage(snippet, demo), '<p>com</p>');
    assert.throws(() => renderPage('<p data-need="!inventada">x</p>', empty), /desconhecido/);
  });

  test('elemento removido leva junto o que tem dentro, mesmo com a mesma tag aninhada', () => {
    const out = renderPage(
      '<div data-need="cnpj"><div>a</div><div>b</div></div><p data-need="city">x</p><p>fica</p>',
      empty,
    );
    assert.equal(out, '<p>fica</p>');
  });

  test('{{variável}} vazia fora de data-need e variável desconhecida são erro de build', () => {
    assert.throws(() => interpolate('a {{cnpj}} b', { cnpj: '' }), /data-need="cnpj"/);
    assert.throws(() => interpolate('{{nada}}', {}), /desconhecida/);
    assert.equal(interpolate('<{{x}}>', { x: 'a&b' }), '<a&amp;b>', 'escapa o valor');
    assert.throws(() => renderPage('<p>{{cnpj}}</p>', empty), /vazio/);
    assert.throws(() => renderPage('<p data-need="inventada">x</p>', empty), /desconhecido/);
  });

  test('o fim da mensagem do WhatsApp leva o código de origem do botão (data-cta)', () => {
    const out = renderPage('<a data-cta="hero" data-wa="Olá! Quero um orçamento."></a>', demo);
    const text = new URL(out.match(/href="([^"]+)"/)[1]).searchParams.get('text');
    assert.equal(text, 'Olá! Quero um orçamento. [site-hero]');
    const sem = renderPage('<a data-wa="Oi"></a>', demo);
    assert.equal(new URL(sem.match(/href="([^"]+)"/)[1]).searchParams.get('text'), 'Oi');
  });

  test('sem número de WhatsApp o build não gera link wa.me/?', () => {
    assert.throws(
      () => renderPage('<a data-wa="oi"></a>', createSiteConfig({})),
      /VITE_WHATSAPP vazio/,
    );
  });

  test('o link morto sai sozinho, mesmo com o fechamento quebrado pelo Prettier', () => {
    const nav = '<a href="#y">y</a\n><a href="#x">x</a\n><a href="#y">z</a><p id="y"></p>';
    assert.equal(renderPage(nav, empty), '<a href="#y">y</a\n><a href="#y">z</a><p id="y"></p>');
  });
});

describe('robots.txt e sitemap.xml', () => {
  test('em demo o robots bloqueia tudo e não aponta para o sitemap', () => {
    assert.equal(robotsTxt(createSiteConfig(example)), 'User-agent: *\nDisallow: /\n');
  });

  test('em production o robots libera e aponta para o sitemap da URL do site', () => {
    const robots = robotsTxt(createSiteConfig(REAL));
    assert.match(robots, /^User-agent: \*\nAllow: \/\n/);
    assert.ok(robots.includes(`Sitemap: ${REAL.VITE_SITE_URL}sitemap.xml`));
  });

  test('o sitemap usa a URL do site e a data do build', () => {
    const xml = sitemapXml(createSiteConfig(REAL), new Date('2031-01-02T10:00:00Z'));
    assert.ok(xml.includes(`<loc>${REAL.VITE_SITE_URL}</loc>`));
    assert.ok(xml.includes('<lastmod>2031-01-02</lastmod>'));
  });
});

describe('medição e CSP', () => {
  const UMAMI = {
    VITE_ANALYTICS_PROVIDER: 'umami',
    VITE_ANALYTICS_SITE: '12345678-1234-4234-8234-123456789abc',
    VITE_SITE_URL: 'https://empresa.com.br/loja/',
  };
  const csp = (env) =>
    contentSecurityPolicy({ styleHashes: ["'sha256-x'"], site: createSiteConfig(env) });

  test('sem provedor o navegador não recebe config de medição e a CSP não abre domínio nenhum', () => {
    assert.equal(createSiteConfig({}).client.analytics, null);
    assert.match(csp({}), /connect-src 'self';/);
    assert.ok(!/https?:/.test(csp({})));
  });

  test('com Umami a config leva o host do site e a CSP abre só o servidor da medição', () => {
    const { analytics } = createSiteConfig(UMAMI).client;
    assert.deepEqual(analytics, {
      site: UMAMI.VITE_ANALYTICS_SITE,
      endpoint: 'https://gateway.umami.is',
      host: 'empresa.com.br',
    });
    assert.match(csp(UMAMI), /connect-src 'self' https:\/\/gateway\.umami\.is;/);
  });

  test('instância própria: o endereço do servidor vai na config e na CSP', () => {
    const own = { ...UMAMI, VITE_ANALYTICS_ENDPOINT: 'https://umami.empresa.com.br/' };
    assert.equal(createSiteConfig(own).client.analytics.endpoint, 'https://umami.empresa.com.br');
    assert.match(csp(own), /connect-src 'self' https:\/\/umami\.empresa\.com\.br;/);
    assert.match(
      validate({ ...example, ...own, VITE_ANALYTICS_ENDPOINT: 'umami.empresa.com.br' }).errors.join(
        '\n',
      ),
      /VITE_ANALYTICS_ENDPOINT/,
    );
  });
});

describe('conteúdo: produtos, diferenciais, clientes, prova social e menus', () => {
  const demo = createSiteConfig(example);
  const production = createSiteConfig(REAL);
  const empty = createSiteConfig({ VITE_WHATSAPP: '5511912345678' });

  test('os 3 produtos têm cada um o seu botão, com o produto na mensagem e o código de origem', () => {
    assert.deepEqual(
      models.map(({ id }) => id),
      ['corte-e-vinco', 'divisorias', 'chapas'],
    );
    const cards = [
      ...renderPage(html, demo).matchAll(/<article class="model">[\s\S]*?<\/article>/g),
    ];
    assert.equal(cards.length, models.length);
    for (const [i, model] of models.entries()) {
      assert.ok(cards[i][0].includes(`<h3>${model.name}</h3>`), model.name);
      // a área do 3D vem antes do título, com o modelo e a descrição da peça
      assert.ok(
        cards[i][0].startsWith(
          `<article class="model">\n  <div class="model-3d" data-modelo="${model.id}" data-peca="${model.peca}"></div>\n  <h3>`,
        ),
        `${model.id}: área do 3D no topo`,
      );
      const text = new URL(cards[i][0].match(/href="([^"]+)"/)[1]).searchParams.get('text');
      assert.equal(
        text,
        `Olá! Quero um orçamento de ${model.subject}. [site-produtos-${model.id}]`,
      );
    }
  });

  test('a regra do pagamento fica na faixa de confiança, com as formas de pagamento quando há', () => {
    const strip = (site) =>
      renderPage(html, site).match(/<section class="trust"[\s\S]*?<\/section>/)?.[0] ?? '';
    const rule = 'Nunca pedimos pagamento para conta de pessoa física';
    assert.ok(strip(production).includes(rule));
    assert.ok(strip(production).includes(`Pagamento: ${REAL.VITE_PAYMENT_METHODS}`));
    const semPagamento = strip(createSiteConfig({ ...REAL, VITE_PAYMENT_METHODS: '' }));
    assert.ok(semPagamento.includes(rule) && !semPagamento.includes('Pagamento:'));
    assert.ok(!strip(createSiteConfig({ ...REAL, VITE_CNPJ: '' })).includes(rule), 'só com CNPJ');
  });

  test('diferenciais vêm do .env: item sem título some e, sem nenhum, a seção e os links somem', () => {
    const pillars = (site) =>
      [...renderPage(html, site).matchAll(/<article class="pillar">[\s\S]*?<\/article>/g)].map(
        (m) => m[0],
      );
    const shown = pillars(demo);
    assert.equal(shown.length, 3);
    assert.equal(
      shown[0],
      `<article class="pillar"><svg aria-hidden="true"><use href="#i-fabrica" /></svg><h3>${example.VITE_DIFF_1_TITLE}</h3><p>${example.VITE_DIFF_1_TEXT}</p></article>`,
    );
    assert.equal(pillars(createSiteConfig({ ...example, VITE_DIFF_2_TITLE: '' })).length, 2);
    const semIcone = pillars(createSiteConfig({ ...example, VITE_DIFF_1_ICON: '' }))[0];
    assert.ok(!semIcone.includes('<svg') && semIcone.includes(example.VITE_DIFF_1_TITLE));
    const semTexto = pillars(createSiteConfig({ ...example, VITE_DIFF_1_TEXT: '' }))[0];
    assert.ok(!semTexto.includes('<p>'));
    assert.deepEqual(
      createSiteConfig({
        VITE_DIFF_6_TITLE: 'Sexto',
        VITE_DIFF_7_TITLE: 'Sétimo',
      }).differentials.map(({ title }) => title),
      ['Sexto'],
      'até 6',
    );
    const nenhum = renderPage(
      html,
      createSiteConfig({
        ...example,
        VITE_DIFF_1_TITLE: '',
        VITE_DIFF_2_TITLE: '',
        VITE_DIFF_3_TITLE: '',
      }),
    );
    assert.ok(!nenhum.includes('id="diferenciais"') && !nenhum.includes('href="#diferenciais"'));
    assert.equal(
      (nenhum.match(/<div class="card(?: on)?">/g) ?? []).length,
      5,
      'os 5 cartões ficam',
    );
  });

  test('cada ícone de diferencial tem o seu <symbol> no index.html', () => {
    for (const icon of DIFF_ICONS) assert.ok(html.includes(`<symbol id="i-${icon}"`), icon);
  });

  test('clientes vêm do .env: demo mostra os 6 exemplos rotulados; production só os autorizados', () => {
    const strip = (site) =>
      renderPage(html, site).match(
        /<div class="carrossel" data-carrossel>[\s\S]*?<\/button><\/div><\/div>/,
      )?.[0] ?? '';
    const emDemo = strip(demo);
    assert.match(
      emDemo,
      /<div class="carrossel-janela" role="region" aria-roledescription="carrossel" aria-label="[^"]+" tabindex="0">/,
    );
    assert.equal((emDemo.match(/<li class="cliente">/g) ?? []).length, 6, 'só os originais');
    assert.ok(!/<li[^>]*aria-hidden/.test(emDemo), 'as cópias do loop são do JS, não do build');
    // controles escondidos até o JS ver que os itens não cabem na largura
    assert.match(emDemo, /<div class="carrossel-controles" hidden>/);
    assert.match(emDemo, /data-acao="pausa" aria-pressed="false">[\s\S]*?<span>Pausar<\/span>/);
    assert.match(emDemo, /data-acao="anterior" aria-label="Anterior"/);
    assert.match(emDemo, /data-acao="proximo" aria-label="Próximo"/);
    assert.equal((emDemo.match(/<span class="tag">Exemplo<\/span>/g) ?? []).length, 6);
    assert.ok(emDemo.includes('<span class="logo-name">Cliente 1</span>'));
    assert.ok(!emDemo.includes('<img'), 'exemplo sem logo real');
    const site = createSiteConfig({
      ...REAL,
      VITE_CLIENT_1_NAME: 'Padaria Real',
      VITE_CLIENT_1_LOGO: 'padaria-real.svg',
      VITE_CLIENT_1_AUTH: 'sim',
      VITE_CLIENT_2_NAME: 'Mercado Sem Autorização',
    });
    assert.deepEqual(
      site.clients.map(({ id, authorized }) => [id, authorized]),
      [
        ['padaria-real', true],
        ['mercado-sem-autorizacao', false],
      ],
    );
    const emProducao = strip(site);
    assert.ok(
      emProducao.includes(
        '<img src="./clientes/padaria-real.svg" alt="Padaria Real" width="160" height="64"',
      ),
      'logo com caminho relativo à página',
    );
    assert.ok(!emProducao.includes('Mercado') && !emProducao.includes('Exemplo'));
    assert.equal(slug('Café & Cia. Ltda'), 'cafe-cia-ltda');
  });

  test('depoimento e nota do Google só aparecem autorizados, em qualquer modo', () => {
    const own = {
      testimonials: [
        { id: 'cliente-a', authorized: true, quote: 'Caixa sempre igual.', author: 'Cliente A' },
        { id: 'exemplo-x', demo: true, quote: 'Texto de exemplo.', author: 'Cliente X' },
      ],
      googleRating: { value: 4.8, count: 37, url: 'https://g.page/r/exemplo', authorized: true },
    };
    const content = { models, proofs: own };
    for (const env of [example, REAL]) {
      const out = renderPage(html, createSiteConfig(env, new Date(), content));
      assert.ok(out.includes('Caixa sempre igual.'), env.VITE_DATA_MODE);
      assert.ok(!out.includes('Texto de exemplo.'), env.VITE_DATA_MODE);
      assert.ok(out.includes('4,8 de 5 no Google (37 avaliações)'), env.VITE_DATA_MODE);
    }
    // sem prova autorizada a seção e os links para ela somem
    const semProva = renderPage(html, production);
    assert.ok(!semProva.includes('id="clientes"') && !semProva.includes('href="#clientes"'));
    assert.ok(renderPage(html, demo).includes('href="#clientes"'));
  });

  test('a nota do Google nunca aparece como exemplo', () => {
    const content = {
      models,
      proofs: {
        testimonials: [],
        googleRating: { value: 5, count: 1, url: 'https://g.page/r/x', demo: true },
      },
    };
    assert.ok(
      !renderPage(html, createSiteConfig(example, new Date(), content)).includes('no Google'),
    );
  });

  test('todo cliente autorizado do .env e toda prova têm registro em docs/provas; logos só em SVG', () => {
    const site = createSiteConfig(parseEnv(read('.env')));
    const items = [
      ...site.clients.filter((client) => client.authorized),
      ...proofs.testimonials,
      ...(proofs.googleRating ? [{ id: 'google', ...proofs.googleRating }] : []),
    ];
    for (const item of items) {
      assert.equal(item.authorized, true, `${item.id}: sem autorização`);
      assert.ok(existsSync(`${ROOT}docs/provas/${item.id}.md`), `${item.id}: falta docs/provas`);
    }
    for (const { logo } of site.clients.filter((client) => client.logo)) {
      assert.match(logo, /^[\w-]+\.svg$/);
      assert.ok(existsSync(`${ROOT}public/clientes/${logo}`), `${logo} falta em public/clientes`);
    }
  });

  test('o menu leva às seções e o link para uma seção que saiu da página sai junto', () => {
    const out = renderPage(html, production);
    for (const id of ['produtos', 'diferenciais']) {
      assert.ok(out.includes(`<a href="#${id}">`), `link #${id}`);
    }
    assert.ok(!out.includes('href="#processo"'), 'sem "Como fazemos" no menu');
    assert.ok(!/id="faq"|href="#faq"/.test(out), 'sem FAQ');
    assert.equal(
      renderPage('<a href="#x">x</a><a href="#y">y</a><p id="y"></p><a href="#">topo</a>', empty),
      '<a href="#y">y</a><p id="y"></p><a href="#">topo</a>',
    );
  });
});
