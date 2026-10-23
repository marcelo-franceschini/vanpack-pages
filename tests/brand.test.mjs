// Marca, produto e segurança: paleta e tipografia do manual, nada de raster/rota/pinos/formulário,
// SVGs oficiais em curvas e CSP do build sem violações nem requisições externas.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { after, before, describe, test } from 'node:test';
import { loadEnv } from 'vite';
import { ROOT, launch, openPage, scrollToProgress, startServer } from '../scripts/lib.mjs';
import { baseContent } from './dados.mjs';

const read = (file) => readFileSync(`${ROOT}${file}`, 'utf8');
const env = loadEnv('production', ROOT, 'VITE_');
// O único domínio externo permitido na CSP é o servidor da medição, e só com provedor configurado em
// production (em demo a medição fica desligada e a CSP não abre domínio nenhum).
const ALLOWED_ORIGINS =
  env.VITE_ANALYTICS_PROVIDER === 'umami' && env.VITE_DATA_MODE === 'production'
    ? [new URL(env.VITE_ANALYTICS_ENDPOINT || 'https://gateway.umami.is').origin]
    : [];
const html = read('index.html');
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
const text = (source) =>
  source
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ');

// Floresta, Carvão, Papel e Kraft (manual §2) + derivados só de Carvão/Papel/Floresta (documentados
// no comentário do :root de index.html).
const PALETTE = new Set(['#14513A', '#1B1A17', '#FBF8F2', '#B78C5C']);
const DERIVED = new Set(['#0D3C2A', '#454440', '#ECE9E3', '#DFDCD7', '#D0CDC8', '#2A5D47']);

describe('paleta e tipografia (index.html)', () => {
  test('só as 4 cores da marca e os derivados documentados', () => {
    const hexes = [...styles.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toUpperCase());
    assert.ok(hexes.length >= 10);
    for (const hex of hexes) {
      assert.ok(PALETTE.has(hex) || DERIVED.has(hex), `cor fora da paleta: ${hex}`);
    }
    // rgb()/rgba() só do Papel (cartões e emendas translúcidas)
    for (const [, channels] of styles.matchAll(/rgba?\(\s*([^)]*?)\s*\)/g)) {
      const [r, g, b] = channels.split(/[\s,/]+/).map(Number);
      assert.deepEqual([r, g, b], [251, 248, 242], `rgb fora do Papel: ${channels}`);
    }
    assert.ok(!/\b(hsl|oklch|lab|lch)\(/.test(styles), 'sem outros espaços de cor');
  });

  test('Kraft é só o material: nunca cor de texto, fundo de botão ou de interface', () => {
    const uses = [...styles.matchAll(/([^{}]+)\{[^}]*(?:#B78C5C|var\(--kraft\))[^}]*\}/gi)].map(
      (m) => m[1].trim(),
    );
    assert.deepEqual(
      uses.filter((selector) => !/\.wave|:root$/.test(selector)),
      [],
      'só a onda do papelão usa o Kraft',
    );
  });

  test('só Archivo (sem fonte mono) e uma única fonte carregada', () => {
    assert.match(styles, /--font:\s*'Archivo'/);
    const families = [...styles.matchAll(/font-family:\s*([^;}]+)/g)].map((m) => m[1].trim());
    assert.deepEqual(
      families.filter((f) => f !== "'Archivo'" && f !== 'var(--font)'),
      [],
    );
    assert.ok(!/mono|courier|consolas|menlo/i.test(styles));
    assert.equal([...styles.matchAll(/@font-face/g)].length, 1);
    assert.deepEqual(readdirSync(`${ROOT}public/fonts`).sort(), [
      'OFL-Archivo.txt',
      'archivo-latin.woff2',
    ]);
  });

  test('sem efeitos que o manual proíbe: desfoque, sombra de texto, brilho, giro de marca', () => {
    assert.ok(
      !/backdrop-filter|text-shadow|drop-shadow|blur\(|filter:|linear-gradient\([^)]*#/.test(
        styles,
      ) || /linear-gradient/.test(styles),
    );
    assert.ok(!/backdrop-filter|text-shadow|drop-shadow|blur\(|(?<![-\w])filter:/.test(styles));
    assert.equal(
      [...styles.matchAll(/box-shadow/g)].length,
      1,
      'uma só sombra: o fio do cabeçalho',
    );
    assert.ok(!/rotate\(|skew\(/.test(styles));
    assert.ok(!/will-change/.test(styles), 'sem camadas forçadas');
    assert.ok(!/mask-image/.test(styles), 'sem máscara no canvas');
  });
});

describe('produto', () => {
  test('sem imagem raster da cena, rota, pinos, caminhão-ícone, formulário ou depoimentos', () => {
    assert.ok(
      ![...html.matchAll(/<img[^>]+src="([^"]+)"/g)].some(([, src]) => !src.endsWith('.svg')),
    );
    assert.ok(!/<picture|<video|poster=|srcset=/.test(html));
    assert.ok(!/url\([^)]*\.(png|jpe?g|webp|gif|avif)/i.test(styles));
    assert.ok(
      !/route|pins?-layer|i-truck|class="pin/i.test(
        html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, ''),
      ),
    );
    assert.ok(!/<form|<input|<textarea|<select|<blockquote|depoimento/i.test(html));
    for (const gone of ['public/posters', 'scripts/poster.mjs', 'src/route.js', 'src/pins.js']) {
      assert.equal(existsSync(`${ROOT}${gone}`), false, `${gone} saiu`);
    }
    assert.equal(JSON.parse(read('package.json')).scripts.poster, undefined);
  });

  test('sem números, datas, velocidades, capacidades ou alegações ambientais inventados', () => {
    const visible = text(html.slice(html.indexOf('<body>')))
      .replace(/© 2026 /, '')
      .replace(/<b>\d<\/b>/g, '')
      .replace(/\{\{[^}]*\}\}/g, ' '); // o que está dentro de {{ }} é o caminho do texto em content/
    const digits = visible.match(/\d+/g) ?? [];
    // só os números 1, 2 e 3 dos passos "Como pedir"
    assert.deepEqual(
      [...new Set(digits)].sort(),
      ['1', '2', '3'],
      `números no texto: ${visible.match(/.{0,20}\d+.{0,20}/g)}`,
    );
    // os textos da página vivem em content/ (o template não tem texto de negócio: tests/template.test.mjs)
    const collect = (value, into) => {
      if (typeof value === 'string') into.push(value);
      else if (Array.isArray(value)) value.forEach((item) => collect(item, into));
      else if (value && typeof value === 'object') {
        Object.values(value).forEach((item) => collect(item, into));
      }
    };
    const all = [];
    const withoutLegal = []; // sem os nomes dos clientes de exemplo (Cliente 1...), a política (art. 7, art. 18) e "de 5 no Google"
    for (const [name, value] of Object.entries(baseContent)) {
      if (name === 'empresa' || name === 'exemplo') continue;
      collect(value, all);
      if (!['clientes', 'privacidade', 'provas'].includes(name)) collect(value, withoutLegal);
    }
    const plain = (list) => `${visible} ${list.join(' ').replace(/\{\{[^}]*\}\}/g, ' ')}`;
    assert.deepEqual([...new Set(plain(withoutLegal).match(/\d+/g) ?? [])].sort(), ['1', '2', '3']);
    assert.ok(
      !/ecol[óo]gic|sustent[áa]vel|recicl|ambient|carbono|verde|certifica|iso\s?\d|dias|horas|\b\d+\s?%/i.test(
        plain(all),
      ),
    );
  });

  test('o rodapé não tem slogan e nenhuma marca de campo sobra no HTML publicado', () => {
    // o rodapé sem dado (campos que somem) é testado com a config vazia em site-config.test.mjs
    const dist = read('dist/index.html');
    assert.ok(!/slogan|Do projeto à entrega/.test(dist), 'sem slogan por enquanto');
    assert.ok(!/data-field|data-need|\{\{/.test(dist), 'todas as marcas foram resolvidas');
  });
});

describe('SVGs da marca (public/brand)', () => {
  const files = readdirSync(`${ROOT}public/brand`).filter((f) => f.endsWith('.svg'));
  test('existem os 6 arquivos, inclusive o horizontal em negativo', () => {
    assert.deepEqual(files.sort(), [
      'vanpack-horizontal-negativo.svg',
      'vanpack-horizontal.svg',
      'vanpack-simbolo-negativo.svg',
      'vanpack-simbolo-preto.svg',
      'vanpack-simbolo.svg',
      'vanpack-vertical.svg',
    ]);
  });

  for (const file of files) {
    test(`${file}: logotipo em curvas, só cores da marca, sem efeitos nem metadados`, () => {
      const svg = read(`public/brand/${file}`);
      assert.ok(
        !/<text|<image|<filter|<style|<metadata|c2pa|<script|rotate\(|skew|opacity/i.test(svg),
      );
      const colors = [...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase());
      assert.ok(colors.length > 0);
      assert.ok(
        colors.every((c) => ['#14513A', '#FBF8F2', '#1B1A17'].includes(c)),
        `${file}: ${new Set(colors)}`,
      );
      assert.ok(svg.length < 4000, 'sem peso extra');
    });
  }

  test('o horizontal em negativo é o horizontal oficial com a cor Papel', () => {
    const official = read('public/brand/vanpack-horizontal.svg');
    assert.equal(
      read('public/brand/vanpack-horizontal-negativo.svg'),
      official.replaceAll('#14513A', '#FBF8F2'),
    );
  });
});

describe('ilustrações dos produtos (public/produtos)', () => {
  // o material da cena: Kraft, a face interna mais clara e o Kraft escuro (src/scene/constants.js)
  const MATERIAL = new Set(['#B78C5C', '#CFA978', '#9A7447', '#FBF8F2']);
  test('as 4 existem, em 4:3, só com as cores do material, sem texto, imagem, efeito ou script', () => {
    const files = readdirSync(`${ROOT}public/produtos`).sort();
    assert.deepEqual(files, [
      'caixa-normal.svg',
      'chapas.svg',
      'corte-e-vinco.svg',
      'divisorias.svg',
    ]);
    for (const file of files) {
      const svg = read(`public/produtos/${file}`);
      assert.match(svg, /viewBox="0 0 400 300"/, file);
      assert.ok(!/<text|<image|<filter|<style|<script|<metadata|opacity|url\(/i.test(svg), file);
      const colors = [...svg.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toUpperCase());
      assert.ok(colors.length > 0, file);
      for (const color of colors) assert.ok(MATERIAL.has(color), `${file}: ${color}`);
      assert.ok(svg.length < 40_000, `${file}: ${svg.length} bytes`);
    }
  });
});

describe('build: CSP, requisições e marca na página', () => {
  let server;
  let browser;
  before(async () => {
    server = await startServer('dist');
    browser = await launch();
  });
  after(async () => {
    await browser.close();
    await server.close();
  });

  test('CSP por <meta> com hash de cada <style>, sem unsafe-inline/eval e sem script inline', () => {
    const dist = read('dist/index.html');
    const csp = dist.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, 'CSP presente');
    for (const directive of [
      "default-src 'self'",
      "script-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "worker-src 'self'",
    ]) {
      assert.ok(csp.includes(directive), directive);
    }
    assert.ok(!/unsafe-(inline|eval)|\*/.test(csp));
    assert.deepEqual(csp.match(/https?:\/\/[^\s;']+/g) ?? [], ALLOWED_ORIGINS, 'domínios externos');
    const hashes = [...csp.matchAll(/'sha256-[^']+'/g)].length;
    assert.equal(hashes, [...dist.matchAll(/<style>/g)].length, 'um hash por <style>');
    const inlineScripts = [...dist.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].filter(
      ([, attrs]) => !/application\/ld\+json/.test(attrs),
    );
    assert.deepEqual(inlineScripts, []);
    for (const file of readdirSync(`${ROOT}dist/assets`).filter((f) => f.endsWith('.js'))) {
      const js = read(`dist/assets/${file}`);
      assert.ok(!/\beval\(|new Function\(/.test(js), `${file} sem eval`);
    }
  });

  test('JSON-LD válido, canonical e imagem de compartilhamento', () => {
    const dist = read('dist/index.html');
    const ld = JSON.parse(
      dist.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1],
    );
    assert.equal(ld['@type'], 'LocalBusiness');
    assert.match(dist, /<link rel="canonical" href="https:\/\/[^"]+\/"/);
    assert.ok(existsSync(`${ROOT}dist/og.jpg`));
    assert.ok(!dist.includes('%VITE_'), 'nenhuma variável sem substituir');
  });

  test('política de privacidade: dados de content/, CSP própria, só as cores da marca e abre sem erro', async () => {
    const page = read('dist/politica-de-privacidade.html');
    assert.ok(!/\{\{|data-need|data-field/.test(page), 'marcas e placeholders resolvidos');
    for (const key of ['razao_social', 'cnpj']) {
      const value = baseContent.empresa[key];
      if (value) assert.ok(page.includes(value), `${key} na política`);
    }
    const csp = page.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
    assert.ok(csp, 'CSP presente');
    assert.equal(
      [...csp.matchAll(/'sha256-[^']+'/g)].length,
      [...page.matchAll(/<style>/g)].length,
    );
    assert.deepEqual(csp.match(/https?:\/\/[^\s;']+/g) ?? [], ALLOWED_ORIGINS);
    const css = [...page.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
    for (const [hex] of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      const color = hex.toUpperCase();
      assert.ok(PALETTE.has(color) || DERIVED.has(color), `cor fora da paleta: ${color}`);
    }
    assert.ok(read('dist/index.html').includes('politica-de-privacidade.html'), 'link no rodapé');

    const {
      page: tab,
      context,
      problems,
      requests,
    } = await openPage(
      browser,
      `${server.url}politica-de-privacidade.html`,
      { reducedMotion: 'reduce' },
      { waitFor: 'none' },
    );
    await tab.goto(`${server.url}politica-de-privacidade.html`);
    assert.equal(await tab.locator('h1').count(), 1);
    assert.equal(await tab.evaluate(() => document.documentElement.lang), 'pt-BR');
    assert.deepEqual(problems, []);
    assert.deepEqual(
      requests.filter((url) => !url.startsWith(server.url)),
      [],
      'sem requisição externa',
    );
    await context.close();
  });

  test('a página publicada não tem <form> nem controle de formulário (só o assistente da variante B, por JS)', () => {
    for (const file of ['dist/index.html', 'dist/politica-de-privacidade.html']) {
      assert.ok(
        !/<(form|input|select|textarea)\b/i.test(read(file)),
        `${file} tem controle estático`,
      );
    }
  });

  test('sem travessão longo no texto visível nem nos atributos (title, meta, aria-label)', () => {
    for (const file of ['dist/index.html', 'dist/404.html']) {
      const page = read(file)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, '');
      assert.ok(!page.includes('\u2014'), `${file} tem travessão longo`);
    }
    const title = read('dist/index.html').match(/<title>([^<]*)<\/title>/)[1];
    assert.match(title, /^Caixas de papelão sob medida com a sua marca \| Vanpack/);
  });

  test('sem PWA: sem manifest, service worker nem instalação como app', async () => {
    const dist = read('dist/index.html');
    assert.ok(!/rel="manifest"/.test(dist), 'sem <link rel="manifest">');
    assert.equal(existsSync(`${ROOT}dist/manifest.webmanifest`), false);
    for (const file of readdirSync(`${ROOT}dist/assets`).filter((f) => f.endsWith('.js'))) {
      assert.ok(
        !/navigator\.serviceWorker|beforeinstallprompt/.test(read(`dist/assets/${file}`)),
        `${file} sem service worker nem pedido de instalação`,
      );
    }
    // o próprio Chrome diz que a página não é instalável
    const { page, context } = await openPage(browser, server.url + '?tour=0', {
      reducedMotion: 'reduce',
    });
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    assert.ok(
      installabilityErrors.some((e) => e.errorId === 'no-manifest'),
      `o Chrome deveria acusar no-manifest: ${JSON.stringify(installabilityErrors)}`,
    );
    await context.close();
  });

  test('percorrer a página inteira não gera violação de CSP, erro nem requisição externa', async () => {
    const { page, context, problems, requests } = await openPage(browser, server.url + '?tour=0', {
      reducedMotion: 'reduce',
    });
    for (const p of [0.25, 0.5, 0.75, 1]) await scrollToProgress(page, p);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(500);
    assert.deepEqual(await page.evaluate(() => window.__csp ?? []), []);
    assert.deepEqual(problems, []);
    const external = requests.filter(
      (url) => !url.startsWith(server.url) && !url.startsWith('data:') && !url.startsWith('blob:'),
    );
    assert.deepEqual(external, []);
    await context.close();
  });

  test('logotipo: símbolo >= 24 px, respiro >= 1/4 do símbolo e negativo sobre Floresta', async () => {
    const { page, context } = await openPage(browser, server.url + '?tour=0', {
      reducedMotion: 'reduce',
    });
    const count = await page.evaluate(() => document.querySelectorAll('img[src*="brand"]').length);
    assert.ok(count >= 4, 'cabeçalho, carregamento, chamada final e rodapé');
    for (let index = 0; index < count; index++) {
      // cada logotipo é medido no meio da tela (o cabeçalho fixo não pode cobri-lo)
      await page.evaluate((i) => {
        const img = document.querySelectorAll('img[src*="brand"]')[i];
        if (!img.closest('#hdr')) img.scrollIntoView({ block: 'center' });
      }, index);
      await page.waitForTimeout(200);
      const logo = await page.evaluate((i) => {
        const img = document.querySelectorAll('img[src*="brand"]')[i];
        const r = img.getBoundingClientRect();
        const rects = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          if (
            !node.textContent.trim() ||
            node.parentElement.closest('script, style, svg, [hidden], [inert]')
          )
            continue;
          const range = document.createRange();
          range.selectNodeContents(node);
          for (const q of range.getClientRects()) rects.push(q);
        }
        for (const el of document.querySelectorAll('a, button, img:not([src*="brand"])')) {
          if (el.contains(img) || el.closest('[hidden], [inert]')) continue;
          const q = el.getBoundingClientRect();
          if (q.width && q.height) rects.push(q);
        }
        const gap = (a, b) =>
          Math.hypot(
            Math.max(0, a.left - b.right, b.left - a.right),
            Math.max(0, a.top - b.bottom, b.top - a.bottom),
          );
        const inside = (q) =>
          q.left >= r.left - 1 &&
          q.right <= r.right + 1 &&
          q.top >= r.top - 1 &&
          q.bottom <= r.bottom + 1;
        const clear = Math.min(...rects.filter((q) => !inside(q)).map((q) => gap(r, q)));
        let node = img;
        let background = 'rgba(0, 0, 0, 0)';
        while (node && background === 'rgba(0, 0, 0, 0)') {
          background = getComputedStyle(node).backgroundColor;
          node = node.parentElement;
        }
        return {
          src: img.getAttribute('src'),
          symbol: r.height, // no horizontal o símbolo ocupa a altura toda e é quadrado
          clear,
          background,
          visible: r.width > 0 && getComputedStyle(img).visibility !== 'hidden',
        };
      }, index);
      if (!logo.visible) continue;
      assert.ok(logo.symbol >= 24, `${logo.src}: símbolo de ${logo.symbol}px`);
      assert.ok(
        logo.clear >= logo.symbol / 4 - 0.5,
        `${logo.src}: respiro ${logo.clear.toFixed(1)}px < ${(logo.symbol / 4).toFixed(1)}px`,
      );
      if (logo.background === 'rgb(20, 81, 58)') {
        assert.match(logo.src, /negativo/, 'sobre Floresta só em negativo');
      }
    }
    await context.close();
  });
});
