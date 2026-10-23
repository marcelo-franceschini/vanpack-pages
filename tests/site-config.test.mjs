// Config e render dos dados da empresa: puros (sem navegador nem build), então rodam em segundos.
// Cobre a trava de go-live (demo × production), o render com a empresa vazia (nada de campo vazio nem
// {{placeholder}} sobrando), o JSON-LD, o robots.txt e o sitemap.xml.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { contentSecurityPolicy } from '../build/csp.js';
import { robotsTxt, sitemapXml } from '../build/files.js';
import { buildJsonLd, interpolate, renderPage } from '../build/render.js';
import { isValidCnpj, logoProblems, validateSite } from '../build/validate.js';
import { DIFF_ICONS, RICH_VARS, VAR_NAMES, slug } from '../site.config.js';
import { renderText } from '../build/texto.js';
import { yearsSince } from '../src/years.js';
import {
  ROOT,
  baseContent,
  contentCopy,
  emptySite,
  exampleEnv,
  realContent,
  realEmpresa,
  siteWith,
  withEmpresa,
} from './dados.mjs';

const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const html = read('index.html');

const PRODUCTION = { ...exampleEnv, VITE_DATA_MODE: 'production' };
const DEMO_EMPRESA = baseContent.empresa;

/** Troca um campo (`endereco.cep`) de um objeto, sem mexer no original. */
const setPath = (object, path, value) => {
  const copy = structuredClone(object);
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, key) => (o[key] ??= {}), copy);
  target[last] = value;
  return copy;
};

/** Os erros e avisos da trava; sem `root` as conferências de arquivos (logos, registros) ficam de fora. */
const validate = ({ env = exampleEnv, content = baseContent, now, root } = {}) =>
  validateSite({ site: siteWith({ env, content, now }), content, now, root });
const errorsOf = (options) => validate(options).errors.join('\n');

describe('createSiteConfig', () => {
  test('lê só o conteúdo recebido e normaliza os campos', () => {
    const site = siteWith({
      content: withEmpresa({
        whatsapp: '+55 (11) 91234-5678',
        telefone: '+551147001234',
        endereco: { cidade: ' Santo André ', uf: 'SP' },
      }),
    });
    assert.equal(site.whatsapp, '5511912345678');
    assert.equal(
      site.phoneDisplay,
      '(11) 4700-1234',
      'formata o telefone quando não há texto pronto',
    );
    assert.equal(site.cityState, 'Santo André-SP');
    assert.equal(site.vars.titular, 'Vanpack', 'sem razão social o © usa o nome da marca');
  });

  test('anos de mercado e ano do © vêm da data do build', () => {
    const site = siteWith({
      content: withEmpresa({ whatsapp: '5511912345678', ano_fundacao: 2010 }),
      now: new Date('2031-06-01'),
    });
    assert.equal(site.yearsInBusiness, '21');
    assert.equal(site.year, '2031');
    assert.equal(
      site.vars.anos,
      '<span data-since="2010">21</span>',
      'o número que o navegador recalcula',
    );
    assert.equal(site.vars.ano, '<span data-year>2031</span>');
    assert.equal(site.vars.ano_atual, '2031');
    assert.equal(emptySite().yearsInBusiness, '', 'sem ano de fundação não há texto');
    assert.equal(emptySite().vars.anos, '');
    assert.equal(yearsSince('2010', new Date('2026-10-15')), 16);
    assert.ok(Number.isNaN(yearsSince('')));
    assert.ok(Number.isNaN(yearsSince('abc')));
  });

  test('com a empresa vazia todo campo da empresa fica vazio (nada inventado)', () => {
    const site = emptySite();
    for (const key of ['cnpj', 'phone', 'legalName', 'hours', 'mapUrl']) {
      assert.equal(site[key], '', key);
    }
    const description = renderText(baseContent.site.pagina.descricao, site.vars, {
      rich: RICH_VARS,
    });
    assert.ok(
      description.length > 20 && !description.includes('Fábrica em'),
      'a descrição tem texto mesmo sem cidade',
    );
  });

  test('as variáveis de VAR_NAMES são exatamente as que a config entrega', () => {
    assert.deepEqual(Object.keys(emptySite().vars).sort(), [...VAR_NAMES].sort());
    for (const name of RICH_VARS) assert.ok(VAR_NAMES.includes(name), name);
  });
});

describe('trava de go-live', () => {
  test('sem content/empresa.yaml válido, a trava não inventa erro de WhatsApp nem de campo obrigatório', () => {
    // o carregador já aponta o erro do arquivo (e descarta o conteúdo dele): repetir como
    // "whatsapp () inválido" ou "cnpj é obrigatório" só confunde quem edita
    const content = { ...baseContent, empresa: undefined };
    for (const dataMode of ['demo', 'production']) {
      const env = { ...exampleEnv, VITE_DATA_MODE: dataMode };
      const { errors } = validateSite({ site: siteWith({ env, content }), content });
      assert.deepEqual(
        errors.filter((error) => /whatsapp|obrigatório em production/.test(error)),
        [],
        dataMode,
      );
    }
  });

  test('o CNPJ fictício é inválido e o real passa', () => {
    assert.equal(isValidCnpj(DEMO_EMPRESA.cnpj), false, 'o CNPJ fictício é inválido');
    assert.equal(isValidCnpj('11.111.111/1111-11'), false);
    assert.equal(isValidCnpj('11.222.333/0001-81'), true);
    assert.equal(isValidCnpj('11222333000181'), true);
  });

  test('demo aceita os dados fictícios e avisa', () => {
    const { errors, warnings } = validate();
    assert.deepEqual(errors, []);
    assert.ok(warnings.some((w) => w.includes('demo')));
  });

  test('modo desconhecido, WhatsApp vazio ou inválido e URL sem "/" falham com mensagem clara', () => {
    assert.match(errorsOf({ env: { ...exampleEnv, VITE_DATA_MODE: 'xyz' } }), /VITE_DATA_MODE/);
    assert.match(errorsOf({ env: { ...exampleEnv, VITE_DATA_MODE: '' } }), /VITE_DATA_MODE/);
    for (const whatsapp of ['', '119000']) {
      assert.match(
        errorsOf({ content: withEmpresa(setPath(DEMO_EMPRESA, 'whatsapp', whatsapp)) }),
        /content\/empresa\.yaml › whatsapp/,
      );
    }
    assert.match(
      errorsOf({ env: { ...exampleEnv, VITE_SITE_URL: 'https://site.com.br' } }),
      /VITE_SITE_URL/,
    );
  });

  test('production com os dados fictícios falha e lista cada valor que sobrou', () => {
    const all = errorsOf({ env: PRODUCTION });
    for (const path of [
      'whatsapp',
      'telefone',
      'cnpj',
      'razao_social',
      'endereco.rua',
      'endereco.cep',
      'horario',
      'regiao',
    ]) {
      assert.match(all, new RegExp(`› ${path}`), `${path} sobrou na empresa`);
    }
    assert.ok(!/diferenciais/.test(all), 'os diferenciais não contam como fictícios');
    assert.match(all, /não é um CNPJ válido/, 'o CNPJ fictício também é inválido');
  });

  test('production recusa cliente de exemplo (exemplo: true), mas não o cliente real ainda sem autorização', () => {
    const clientes = (lista) =>
      realContent({ clientes: { ...baseContent.clientes, clientes: lista } });
    const comExemplo = errorsOf({
      env: PRODUCTION,
      content: clientes([{ nome: 'Cliente 1', exemplo: true }]),
    });
    assert.match(comExemplo, /› clientes\[0\] \("Cliente 1"\) é um cliente de exemplo/);
    // o cliente real sem autorização não derruba o build: fica fora da página até o registro
    const semAutorizacao = errorsOf({
      env: PRODUCTION,
      content: clientes([{ nome: 'Biscoitê', logo: 'biscoite.svg', autorizado: false }]),
    });
    assert.ok(!/clientes/.test(semAutorizacao), semAutorizacao);
  });

  test('production com dados reais passa; cidade e UF iguais ao exemplo não contam como fictício', () => {
    const { errors, warnings } = validate({ env: PRODUCTION, content: realContent() });
    assert.deepEqual(errors, []);
    assert.equal(realEmpresa.endereco.cidade, DEMO_EMPRESA.endereco.cidade);
    assert.ok(
      warnings.some((w) => w.includes('VITE_ANALYTICS_PROVIDER')),
      'avisa que não há medição',
    );
    assert.deepEqual(
      validate({
        env: {
          ...PRODUCTION,
          VITE_ANALYTICS_PROVIDER: 'umami',
          VITE_ANALYTICS_SITE: '56f48c71-e0b8-4e7a-ac56-be2631e2e31d',
        },
        content: realContent(),
      }).warnings,
      [],
    );
  });

  test('valor real igual ao de exemplo (horário, região, pagamento) só passa se confirmado', () => {
    // um horário comercial como "Seg a Sex, 8h às 17h" pode ser o real: sem confirmação o build recusa
    // (para pegar o que ficou esquecido) e diz como confirmar
    const igual = {
      ...realEmpresa,
      horario: DEMO_EMPRESA.horario,
      horario_schema: DEMO_EMPRESA.horario_schema,
      regiao: DEMO_EMPRESA.regiao,
    };
    const clientes = { ...baseContent.clientes, clientes: [] };
    const content = (empresa) => withEmpresa(empresa, { clientes });
    const sem = errorsOf({ env: PRODUCTION, content: content(igual) });
    assert.match(sem, /› horario \("Seg a Sex, 8h às 17h"\) ainda é o valor fictício/);
    assert.match(sem, /liste "horario" em "confirmados" no content\/empresa\.yaml/);
    assert.match(sem, /› regiao /);
    // confirmar só o horário: sobra a região
    const parcial = errorsOf({
      env: PRODUCTION,
      content: content({ ...igual, confirmados: ['horario', 'horario_schema'] }),
    });
    assert.doesNotMatch(parcial, /› horario/);
    assert.match(parcial, /› regiao /);
    // confirmados os três: passa
    assert.deepEqual(
      validate({
        env: PRODUCTION,
        content: content({ ...igual, confirmados: ['horario', 'horario_schema', 'regiao'] }),
      }).errors,
      [],
    );
    // dado que identifica a empresa nunca é confirmável: sem dica, e a confirmação não o salva
    const cnpj = errorsOf({
      env: PRODUCTION,
      content: content({ ...realEmpresa, cnpj: DEMO_EMPRESA.cnpj, confirmados: ['horario'] }),
    });
    assert.match(cnpj, /› cnpj \("00\.000\.000\/0001-00"\) ainda é o valor fictício/);
    assert.doesNotMatch(cnpj, /liste "cnpj"/);
  });

  test('production exige os campos obrigatórios e os formatos', () => {
    for (const [path, value] of [
      ['cnpj', ''],
      ['cnpj', '11.222.333/0001-82'],
      ['telefone', '11 4700-1234'],
      ['endereco.uf', 'sp'],
      ['endereco.cep', '123'],
      ['horario', ''],
    ]) {
      const content = realContent({ empresa: setPath(realEmpresa, path, value) });
      assert.match(
        errorsOf({ env: PRODUCTION, content }),
        new RegExp(`content/empresa\\.yaml › ${path.replace('.', '\\.')}`),
        `${path}="${value}" deveria falhar`,
      );
    }
    assert.match(
      errorsOf({
        env: { ...PRODUCTION, VITE_SITE_URL: 'http://empresa.com.br/' },
        content: realContent(),
      }),
      /VITE_SITE_URL/,
    );
  });

  test('analytics: provedor desconhecido ou Umami sem Website ID falham; ano de fundação no futuro também', () => {
    assert.match(
      errorsOf({ env: { ...exampleEnv, VITE_ANALYTICS_PROVIDER: 'ga4' } }),
      /ANALYTICS_PROVIDER/,
    );
    assert.match(
      errorsOf({ env: { ...exampleEnv, VITE_ANALYTICS_PROVIDER: 'umami' } }),
      /ANALYTICS_SITE/,
    );
    assert.match(
      errorsOf({
        content: withEmpresa(setPath(DEMO_EMPRESA, 'ano_fundacao', 2999)),
        now: new Date('2026-10-15'),
      }),
      /ano_fundacao/,
    );
  });

  test('a linha pequena da abertura, já com a cidade no lugar, não passa de 48 caracteres', () => {
    assert.deepEqual(validate().errors, [], 'Santo André-SP cabe');
    const longCity = withEmpresa(
      setPath(DEMO_EMPRESA, 'endereco.cidade', 'São José dos Campos de Cima'),
    );
    assert.match(
      errorsOf({ content: longCity }),
      /content\/historia\.yaml › hero\.etiqueta: depois de trocar as variáveis, o texto tem 49 caracteres \("Fábrica própria em São José dos Campos de Cima-SP"\); o máximo é 48/,
    );
  });

  test('cada peça 3D dos produtos aparece uma vez só', () => {
    const [first, ...rest] = baseContent.produtos.itens;
    const content = { ...baseContent, produtos: { itens: [first, { ...rest[0], id: first.id }] } };
    assert.match(
      errorsOf({ content }),
      new RegExp(`o produto "${first.id}" aparece mais de uma vez`),
    );
  });

  test('cliente autorizado e prova autorizada precisam do registro em docs/provas/', () => {
    const clientes = { clientes: [{ nome: 'Padaria Sem Registro', autorizado: true }] };
    const provas = {
      ...baseContent.provas,
      depoimentos: [
        { id: 'sem-registro', citacao: 'Boa.', autor: 'Fulano', autorizado: true },
        { id: 'nao-autorizado', citacao: 'Ok.', autor: 'Ciclano', autorizado: false },
      ],
      nota_google: null,
    };
    const all = errorsOf({ content: { ...baseContent, clientes, provas }, root: ROOT });
    assert.match(all, /clientes\[0\].*docs\/provas\/padaria-sem-registro\.md/);
    assert.match(all, /provas\.yaml › sem-registro.*docs\/provas\/sem-registro\.md/);
    assert.ok(!all.includes('nao-autorizado'), 'só o autorizado precisa de registro');
    assert.deepEqual(validate({ root: ROOT }).errors, [], 'o conteúdo de verdade está em ordem');
  });

  test('logo de cliente: precisa existir, ser SVG leve, com viewBox, sem script nem imagem embutida', () => {
    const { dir, remove } = contentCopy();
    try {
      mkdirSync(join(dir, 'clientes'), { recursive: true });
      const put = (name, text) => writeFileSync(join(dir, 'clientes', name), text);
      const ok =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10z"/></svg>';
      put('bom.svg', ok);
      put('script.svg', ok.replace('<path', '<script>alert(1)</script><path'));
      put('evento.svg', ok.replace('<path', '<path onclick="x()"'));
      put('imagem.svg', ok.replace('<path', '<image href="data:image/png;base64,AAAA"/><path'));
      put('semviewbox.svg', ok.replace(' viewBox="0 0 10 10"', ''));
      put('grande.svg', ok.replace('</svg>', `<!--${'x'.repeat(21 * 1024)}--></svg>`));
      put('texto.svg', 'não sou svg');
      assert.deepEqual(logoProblems(dir, 'bom.svg'), []);
      assert.match(logoProblems(dir, 'nao-existe.svg').join(), /não existe/);
      assert.match(logoProblems(dir, 'script.svg').join(), /script/);
      assert.match(logoProblems(dir, 'evento.svg').join(), /script/);
      assert.match(logoProblems(dir, 'imagem.svg').join(), /imagem|fora/);
      assert.match(logoProblems(dir, 'semviewbox.svg').join(), /viewBox/);
      assert.match(logoProblems(dir, 'grande.svg').join(), /máximo é 20 KB/);
      assert.match(logoProblems(dir, 'texto.svg').join(), /não é um SVG/);
    } finally {
      remove();
    }
  });
});

describe('render', () => {
  // O render recusa wa.me sem número, então a config "vazia" leva só o WhatsApp.
  const empty = emptySite();
  const demo = siteWith();

  test('com a empresa vazia nenhum campo, elemento vazio ou {{placeholder}} sobra na página', () => {
    const out = renderPage(html, empty);
    assert.ok(!/data-need|data-field|\{\{/.test(out), 'sem marcas nem placeholders');
    assert.ok(!/slogan|Do projeto à entrega/.test(out), 'sem slogan por enquanto');
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

  test('com os dados de demonstração tudo aparece, o JSON-LD é completo e o noindex liga', () => {
    const out = renderPage(html, demo);
    const flat = out.replace(/\s+/g, ' ');
    assert.ok(!/data-need|data-field|\{\{/.test(out));
    for (const value of [DEMO_EMPRESA.cnpj, DEMO_EMPRESA.razao_social, DEMO_EMPRESA.horario]) {
      assert.ok(flat.includes(value), value);
    }
    assert.ok(flat.includes(`href="tel:${DEMO_EMPRESA.telefone}"`));
    assert.ok(!flat.includes('mailto:'), 'sem e-mail na página');
    assert.ok(flat.includes('Fábrica própria em Santo André-SP'));
    assert.ok(flat.includes('Atendemos Santo André, ABC e Grande São Paulo'));
    assert.match(out, /<meta name="robots" content="noindex,nofollow" \/>/);
    for (const [, link] of out.matchAll(/href="(https:\/\/wa\.me\/[^"]*)"/g)) {
      assert.ok(link.startsWith(`https://wa.me/${DEMO_EMPRESA.whatsapp}?text=`), link);
    }
    const ld = buildJsonLd(demo);
    assert.equal(ld.telephone, DEMO_EMPRESA.telefone);
    assert.equal(ld.openingHours, DEMO_EMPRESA.horario_schema);
    assert.equal(ld.address.addressLocality, 'Santo André');
    assert.equal(
      ld.address.streetAddress,
      `${DEMO_EMPRESA.endereco.rua}, ${DEMO_EMPRESA.endereco.bairro}`,
    );
    assert.ok(!('aggregateRating' in ld), 'sem avaliação própria');
  });

  test('sem ano de fundação não há anos de mercado nem "Desde"; o cartão 2 usa o texto alternativo', () => {
    const semAno = siteWith({ content: withEmpresa(setPath(DEMO_EMPRESA, 'ano_fundacao', '')) });
    const out = renderPage(html, semAno);
    assert.ok(!/data-since|anos de\s+mercado<|Desde/.test(out));
    assert.ok(out.includes('Experiência em caixas de papelão'));
    const comAno = renderPage(html, demo);
    assert.ok(comAno.includes('Desde 2010'));
    assert.match(comAno, /<span data-since="2010">\d+<\/span> anos de\s+mercado/);
    assert.ok(!comAno.includes('Experiência em caixas de papelão'));
  });

  test('os 5 cartões da história ficam com qualquer config (o scroll depende deles)', () => {
    for (const site of [empty, demo, siteWith({ env: PRODUCTION, content: realContent() })]) {
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
      '<div data-need="cnpj"><div>a</div><div>b</div></div><p data-need="cidade">x</p><p>fica</p>',
      empty,
    );
    assert.equal(out, '<p>fica</p>');
  });

  test('{{variável}} vazia fora de data-need e variável desconhecida são erro de build', () => {
    assert.throws(() => interpolate('a {{cnpj}} b', { cnpj: '' }), /data-need="cnpj"/);
    assert.throws(() => interpolate('{{nada}}', {}), /desconhecida/);
    assert.equal(interpolate('<{{x}}>', { x: 'a&b' }), '<a&amp;b>', 'escapa o valor');
    assert.equal(
      interpolate('{{anos}}', { anos: '<span data-since="2010">16</span>' }),
      '<span data-since="2010">16</span>',
      'a variável rica já é HTML',
    );
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
      () => renderPage('<a data-wa="oi"></a>', siteWith({ content: withEmpresa({}) })),
      /content\/empresa\.yaml › whatsapp está vazio/,
    );
  });

  test('o link morto sai sozinho, mesmo com o fechamento quebrado pelo Prettier', () => {
    const nav = '<a href="#y">y</a\n><a href="#x">x</a\n><a href="#y">z</a><p id="y"></p>';
    assert.equal(renderPage(nav, empty), '<a href="#y">y</a\n><a href="#y">z</a><p id="y"></p>');
  });
});

describe('robots.txt e sitemap.xml', () => {
  const production = siteWith({ env: PRODUCTION, content: realContent() });

  test('em demo o robots bloqueia tudo e não aponta para o sitemap', () => {
    assert.equal(robotsTxt(siteWith()), 'User-agent: *\nDisallow: /\n');
  });

  test('em production o robots libera e aponta para o sitemap da URL do site', () => {
    const robots = robotsTxt(production);
    assert.match(robots, /^User-agent: \*\nAllow: \/\n/);
    assert.ok(robots.includes(`Sitemap: ${exampleEnv.VITE_SITE_URL}sitemap.xml`));
  });

  test('o sitemap usa a URL do site e a data do build', () => {
    const xml = sitemapXml(production, new Date('2031-01-02T10:00:00Z'));
    assert.ok(xml.includes(`<loc>${exampleEnv.VITE_SITE_URL}</loc>`));
    assert.ok(xml.includes('<lastmod>2031-01-02</lastmod>'));
  });
});

describe('medição e CSP', () => {
  const UMAMI = {
    VITE_ANALYTICS_PROVIDER: 'umami',
    VITE_ANALYTICS_SITE: '12345678-1234-4234-8234-123456789abc',
    VITE_SITE_URL: 'https://empresa.com.br/loja/',
    VITE_DATA_MODE: 'production', // em demo a medição não liga (teste abaixo)
  };
  const csp = (env) =>
    contentSecurityPolicy({ styleHashes: ["'sha256-x'"], site: siteWith({ env }) });

  test('sem provedor o navegador não recebe config de medição e a CSP não abre domínio nenhum', () => {
    assert.equal(siteWith({ env: {} }).client.analytics, null);
    assert.match(csp({}), /connect-src 'self';/);
    assert.ok(!/https?:/.test(csp({})));
  });

  test('com Umami a config leva o host do site e a CSP abre só o servidor da medição', () => {
    const { analytics } = siteWith({ env: UMAMI }).client;
    assert.deepEqual(analytics, {
      site: UMAMI.VITE_ANALYTICS_SITE,
      endpoint: 'https://gateway.umami.is',
      host: 'empresa.com.br',
    });
    assert.match(csp(UMAMI), /connect-src 'self' https:\/\/gateway\.umami\.is;/);
  });

  test('em demo a medição não liga, mesmo com Umami configurado: nada vai ao navegador nem à CSP', () => {
    const demo = { ...UMAMI, VITE_DATA_MODE: 'demo' };
    assert.equal(siteWith({ env: demo }).client.analytics, null);
    assert.match(csp(demo), /connect-src 'self';/);
    assert.ok(!/https?:/.test(csp(demo)));
  });

  test('instância própria: o endereço do servidor vai na config e na CSP', () => {
    const own = { ...UMAMI, VITE_ANALYTICS_ENDPOINT: 'https://umami.empresa.com.br/' };
    assert.equal(siteWith({ env: own }).client.analytics.endpoint, 'https://umami.empresa.com.br');
    assert.match(csp(own), /connect-src 'self' https:\/\/umami\.empresa\.com\.br;/);
    assert.match(
      errorsOf({ env: { ...exampleEnv, ...own, VITE_ANALYTICS_ENDPOINT: 'umami.empresa.com.br' } }),
      /VITE_ANALYTICS_ENDPOINT/,
    );
  });
});

describe('conteúdo: produtos, diferenciais, clientes, prova social e menus', () => {
  const demo = siteWith();
  const production = siteWith({ env: PRODUCTION, content: realContent() });
  const empty = emptySite();
  const diferenciais = (itens) =>
    siteWith({ content: { ...baseContent, diferenciais: { ...baseContent.diferenciais, itens } } });
  const pillars = (site) =>
    [...renderPage(html, site).matchAll(/<article class="pillar">[\s\S]*?<\/article>/g)].map(
      (m) => m[0],
    );

  test('os 4 produtos têm cada um o seu botão, com o produto na mensagem e o código de origem', () => {
    const produtos = baseContent.produtos.itens;
    assert.deepEqual(
      produtos.map(({ id }) => id),
      ['caixa-normal', 'corte-e-vinco', 'divisorias', 'chapas'],
    );
    const cards = [
      ...renderPage(html, demo).matchAll(/<article class="model">[\s\S]*?<\/article>/g),
    ];
    assert.equal(cards.length, produtos.length);
    for (const [i, item] of produtos.entries()) {
      assert.ok(cards[i][0].includes(`<h3>${item.nome}</h3>`), item.nome);
      // a área do 3D vem antes do título, com o modelo e a descrição da peça
      assert.ok(
        cards[i][0].startsWith(
          `<article class="model">\n  <div class="model-3d" data-modelo="${item.id}" data-peca="${item.peca}"></div>\n  <h3>`,
        ),
        `${item.id}: área do 3D no topo`,
      );
      const text = new URL(cards[i][0].match(/href="([^"]+)"/)[1]).searchParams.get('text');
      assert.equal(text, `${item.mensagem} [site-produtos-${item.id}]`);
    }
  });

  test('a faixa de confiança (#confianca) não existe mais, em nenhum modo', () => {
    for (const site of [demo, production, empty]) {
      const out = renderPage(html, site);
      assert.ok(!/id="confianca"|class="trust|Quem somos/.test(out));
    }
  });

  test('o rodapé leva a regra do pagamento, e só quando há CNPJ', () => {
    const rule = 'Nunca pedimos pagamento para conta de pessoa física';
    const footer = (site) => renderPage(html, site).match(/<footer>[\s\S]*<\/footer>/)?.[0] ?? '';
    assert.ok(footer(demo).includes(rule));
    assert.ok(footer(production).includes(rule));
    const semCnpj = siteWith({
      env: PRODUCTION,
      content: realContent({ empresa: { ...realEmpresa, cnpj: '' } }),
    });
    assert.ok(!footer(semCnpj).includes(rule), 'sem CNPJ a página não promete nada');
  });

  test('diferenciais vêm de content/: item sem ícone ou texto se adapta e, sem nenhum, a seção e os links somem', () => {
    const [primeiro, ...resto] = baseContent.diferenciais.itens;
    const shown = pillars(demo);
    assert.equal(shown.length, 3);
    assert.equal(
      shown[0],
      `<article class="pillar"><svg aria-hidden="true"><use href="#i-fabrica" /></svg><h3>${primeiro.titulo}</h3><p>${primeiro.texto}</p></article>`,
    );
    assert.equal(pillars(diferenciais(resto)).length, 2);
    const semIcone = pillars(diferenciais([{ ...primeiro, icone: '' }, ...resto]))[0];
    assert.ok(!semIcone.includes('<svg') && semIcone.includes(primeiro.titulo));
    const semTexto = pillars(diferenciais([{ ...primeiro, texto: '' }, ...resto]))[0];
    assert.ok(!semTexto.includes('<p>'));
    const nenhum = renderPage(html, diferenciais([]));
    assert.ok(!nenhum.includes('id="diferenciais"') && !nenhum.includes('href="#diferenciais"'));
    assert.equal(
      (nenhum.match(/<div class="card(?: on)?">/g) ?? []).length,
      5,
      'os 5 cartões ficam',
    );
  });

  test('cada ícone de diferencial tem o seu <symbol> no index.html e está no schema', () => {
    for (const icon of DIFF_ICONS) assert.ok(html.includes(`<symbol id="i-${icon}"`), icon);
    const schema = JSON.parse(read('content/schemas/diferenciais.schema.json'));
    assert.deepEqual(schema.properties.itens.items.properties.icone.enum, DIFF_ICONS);
  });

  test('clientes vêm de content/: demo mostra todos, só com o logo (o nome fica no alt), rotulados; production só os autorizados', () => {
    const carrossel = (site) =>
      renderPage(html, site).match(
        /<div class="carrossel" data-carrossel>[\s\S]*?<\/section><\/div>/,
      )?.[0] ?? '';
    const emDemo = carrossel(demo);
    assert.match(
      emDemo,
      /<section class="carrossel-janela" aria-roledescription="carrossel" aria-label="[^"]+" tabindex="0">/,
    );
    const listados = baseContent.clientes.clientes;
    assert.ok(
      listados.length >= 1 && listados.every((c) => c.logo),
      'todo cliente listado tem logo',
    );
    assert.equal(
      (emDemo.match(/<li class="cliente">/g) ?? []).length,
      listados.length,
      'só os originais',
    );
    assert.ok(!/<li[^>]*aria-hidden/.test(emDemo), 'as cópias do loop são do JS, não do build');
    // nenhum controle: nem botão de pausa, nem setas
    assert.ok(
      !/<button|data-acao|carrossel-controles/.test(emDemo),
      'o carrossel não tem controle',
    );
    const naoAutorizados = listados.filter((c) => !c.autorizado).length;
    assert.equal((emDemo.match(/<span class="tag">Exemplo<\/span>/g) ?? []).length, naoAutorizados);
    assert.ok(!emDemo.includes('logo-name'), 'sem nome visível: só o logo');
    for (const { nome, logo, alt } of listados) {
      assert.ok(
        emDemo.includes(
          `<img src="./clientes/${logo}" alt="${alt ?? nome}" width="160" height="64"`,
        ),
        `${nome}: logo com o nome no alt`,
      );
    }
    const site = siteWith({
      env: PRODUCTION,
      content: realContent({
        clientes: {
          ...baseContent.clientes,
          clientes: [
            { nome: 'Padaria Real', logo: 'padaria-real.svg', autorizado: true },
            {
              nome: 'Loja Alfa',
              logo: 'loja-alfa.svg',
              alt: 'Logo da Loja Alfa',
              autorizado: true,
            },
            { nome: 'Mercado Sem Autorização' },
          ],
        },
      }),
    });
    assert.deepEqual(
      site.clients.map(({ id, authorized }) => [id, authorized]),
      [
        ['padaria-real', true],
        ['loja-alfa', true],
        ['mercado-sem-autorizacao', false],
      ],
    );
    const emProducao = carrossel(site);
    assert.ok(
      emProducao.includes(
        '<img src="./clientes/padaria-real.svg" alt="Padaria Real" width="160" height="64"',
      ),
      'logo com caminho relativo à página',
    );
    assert.ok(emProducao.includes('alt="Logo da Loja Alfa"'), 'o alt próprio vence o nome');
    assert.ok(!emProducao.includes('Mercado') && !emProducao.includes('Exemplo'));
    assert.equal(slug('Café & Cia. Ltda'), 'cafe-cia-ltda');
  });

  test('depoimento e nota do Google só aparecem autorizados, em qualquer modo', () => {
    const provas = {
      ...baseContent.provas,
      depoimentos: [
        { id: 'cliente-a', autorizado: true, citacao: 'Caixa sempre igual.', autor: 'Cliente A' },
        { id: 'exemplo-x', autorizado: false, citacao: 'Texto de exemplo.', autor: 'Cliente X' },
      ],
      nota_google: {
        valor: 4.8,
        quantidade: 37,
        url: 'https://g.page/r/exemplo',
        autorizado: true,
      },
    };
    for (const [env, content] of [
      [exampleEnv, { ...baseContent, provas }],
      [PRODUCTION, realContent({ provas })],
    ]) {
      const out = renderPage(html, siteWith({ env, content }));
      assert.ok(out.includes('Caixa sempre igual.'), env.VITE_DATA_MODE);
      assert.ok(!out.includes('Texto de exemplo.'), env.VITE_DATA_MODE);
      assert.ok(out.includes('4,8 de 5 no Google (37 avaliações)'), env.VITE_DATA_MODE);
    }
    // sem prova autorizada a seção e os links para ela somem
    const semProva = renderPage(html, production);
    assert.ok(!semProva.includes('id="clientes"') && !semProva.includes('href="#clientes"'));
    assert.ok(renderPage(html, demo).includes('href="#clientes"'));
  });

  test('a nota do Google nunca aparece sem autorização', () => {
    const provas = {
      ...baseContent.provas,
      depoimentos: [],
      nota_google: { valor: 5, quantidade: 1, url: 'https://g.page/r/x', autorizado: false },
    };
    assert.ok(
      !renderPage(html, siteWith({ content: { ...baseContent, provas } })).includes('no Google'),
    );
  });

  test('todo cliente autorizado e toda prova do conteúdo de verdade têm registro em docs/provas', () => {
    const { clientes, provas } = baseContent;
    const autorizados = [
      ...clientes.clientes.filter((c) => c.autorizado).map((c) => slug(c.nome)),
      ...provas.depoimentos.filter((d) => d.autorizado).map((d) => d.id),
      ...(provas.nota_google?.autorizado ? ['google'] : []),
    ];
    for (const id of autorizados) {
      assert.ok(existsSync(`${ROOT}docs/provas/${id}.md`), `${id}: falta docs/provas/${id}.md`);
    }
    for (const { logo } of clientes.clientes.filter((c) => c.logo)) {
      assert.deepEqual(logoProblems(`${ROOT}content`, logo), [], logo);
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
