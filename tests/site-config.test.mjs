// Config e render dos dados da empresa: puros (sem navegador nem build), então rodam em segundos.
// Cobre a trava de go-live (demo × production), o render com a config vazia (nada de campo vazio nem
// {{placeholder}} sobrando), o JSON-LD, o robots.txt e o sitemap.xml.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { parseEnv } from '../build/env.js';
import { contentSecurityPolicy } from '../build/csp.js';
import { robotsTxt, sitemapXml } from '../build/files.js';
import { buildJsonLd, interpolate, renderPage } from '../build/render.js';
import { isValidCnpj, validateSite } from '../build/validate.js';
import { createSiteConfig } from '../site.config.js';
import { yearsSince } from '../src/years.js';

const ROOT = new URL('..', import.meta.url).pathname;
const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const html = read('index.html');
const example = parseEnv(read('.env.example'));

// Um conjunto de dados "reais" só para os testes: tudo diferente do .env.example (menos o que é real
// por natureza, como cidade e UF).
const REAL = {
  ...example,
  VITE_DATA_MODE: 'production',
  VITE_WHATSAPP: '5511987654321',
  VITE_PHONE: '+551147001234',
  VITE_PHONE_DISPLAY: '(11) 4700-1234',
  VITE_EMAIL: 'vendas@empresa.com.br',
  VITE_CNPJ: '11.222.333/0001-81',
  VITE_LEGAL_NAME: 'Vanpack Embalagens LTDA',
  VITE_STREET: 'Av. das Caixas, 500',
  VITE_DISTRICT: 'Distrito Industrial',
  VITE_CEP: '09000-100',
  VITE_HOURS: 'Seg a Sex, 7h30 às 17h30',
  VITE_HOURS_SCHEMA: 'Mo-Fr 07:30-17:30',
  VITE_MAP_URL: 'https://maps.google.com/?q=Av+das+Caixas+500',
  VITE_MIN_ORDER: '300',
  VITE_LEAD_TIME_DAYS: '7',
  VITE_SERVICE_AREA: 'Grande São Paulo',
  VITE_RESPONSE_TIME: '1 h útil',
  VITE_PAYMENT_METHODS: 'Pix e boleto',
};

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
    for (const key of ['cnpj', 'phone', 'email', 'whatsapp', 'legalName', 'hours', 'mapUrl']) {
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
      'VITE_EMAIL',
      'VITE_CNPJ',
      'VITE_LEGAL_NAME',
      'VITE_STREET',
      'VITE_CEP',
      'VITE_HOURS',
      'VITE_SERVICE_AREA',
    ]) {
      assert.match(all, new RegExp(`${key}`), `${key} sobrou no .env`);
    }
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
      ['VITE_EMAIL', 'sem-arroba'],
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
    assert.ok(!out.includes('Atendemos'));
    assert.match(
      out,
      /Da nossa fábrica até o seu endereço/,
      'o trecho da cidade some sem sobrar espaço',
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
    for (const value of [
      example.VITE_CNPJ,
      example.VITE_LEGAL_NAME,
      example.VITE_HOURS,
      example.VITE_EMAIL,
    ]) {
      assert.ok(flat.includes(value), value);
    }
    assert.ok(flat.includes(`href="tel:${example.VITE_PHONE}"`));
    assert.ok(flat.includes(`href="mailto:${example.VITE_EMAIL}"`));
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
    assert.ok(!/anos de mercado|tel:|mailto:|Fábrica própria/.test(strip), strip);
  });

  test('sem ano de fundação não há anos de mercado nem "Desde" no rodapé', () => {
    const semAno = createSiteConfig({ ...example, VITE_FOUNDED_YEAR: '' });
    const out = renderPage(html, semAno);
    assert.ok(!/anos de mercado|Desde/.test(out));
    assert.ok(renderPage(html, demo).includes('Desde 2010'));
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
