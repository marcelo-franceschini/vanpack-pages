// Acessibilidade (WCAG 2.2): estrutura, ordem de foco, foco visível, cartões inativos fora da leitura,
// contraste calculado a partir dos estilos reais e movimento reduzido.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, scrollToProgress, startServer } from '../scripts/lib.mjs';

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

const open = (contextOptions = {}) =>
  openPage(browser, server.url + '?tour=0', { reducedMotion: 'reduce', ...contextOptions });

describe('estrutura', () => {
  test('idioma, um único h1, hierarquia de títulos e landmarks', async () => {
    const { page, context } = await open();
    const info = await page.evaluate(() => ({
      lang: document.documentElement.lang,
      h1: document.querySelectorAll('h1').length,
      levels: [...document.querySelectorAll('h1, h2, h3')].map((h) => Number(h.tagName[1])),
      main: document.querySelectorAll('main').length,
      header: document.querySelectorAll('header').length,
      footer: document.querySelectorAll('footer').length,
      navs: [...document.querySelectorAll('nav')].map((n) => n.getAttribute('aria-label')),
      title: document.title,
    }));
    assert.equal(info.lang, 'pt-BR');
    assert.equal(info.h1, 1);
    assert.deepEqual([info.main, info.header, info.footer], [1, 1, 1]);
    assert.ok(info.navs.every(Boolean), 'toda navegação tem nome');
    assert.ok(info.title.length > 10);
    for (let i = 1; i < info.levels.length; i++) {
      assert.ok(info.levels[i] - info.levels[i - 1] <= 1, 'não pula nível de título');
    }
    await context.close();
  });

  test('o canvas 3D é uma imagem com descrição; o carregamento e as imagens decorativas são ocultos', async () => {
    const { page, context } = await open();
    const info = await page.evaluate(() => {
      const canvas = document.querySelector('#gl');
      return {
        role: canvas.getAttribute('role'),
        label: canvas.getAttribute('aria-label'),
        loaderHidden: document.querySelector('.loader').getAttribute('aria-hidden'),
        images: [...document.images].map((img) => ({
          src: img.getAttribute('src'),
          alt: img.getAttribute('alt'),
          width: img.getAttribute('width'),
          height: img.getAttribute('height'),
        })),
      };
    });
    assert.equal(info.role, 'img');
    assert.match(info.label, /caixas de papelão/);
    assert.equal(info.loaderHidden, 'true');
    for (const img of info.images) {
      assert.notEqual(img.alt, null, `${img.src} tem alt (vazio quando decorativa)`);
      assert.ok(img.width && img.height, `${img.src} tem width/height (sem salto de layout)`);
    }
    await context.close();
  });

  test('só o cartão ativo é lido e focável; os demais ficam inert', async () => {
    const { page, context } = await open();
    const inert = () =>
      page.evaluate(() => [...document.querySelectorAll('.card')].map((c) => c.inert));
    assert.deepEqual(await inert(), [false, true, true, true, true]);
    await scrollToProgress(page, 0.5);
    assert.deepEqual(await inert(), [true, true, false, true, true]);
    await scrollToProgress(page, 1);
    assert.deepEqual(await inert(), [true, true, true, true, false]);
    // o link do último cartão só é alcançável com o cartão ativo
    await scrollToProgress(page, 0);
    const reachable = await page.evaluate(() => {
      const link = document.querySelector('.more');
      return Boolean(link.closest('[inert]'));
    });
    assert.equal(
      reachable,
      true,
      'o link do capítulo 5 está dentro de um cartão inert no capítulo 1',
    );
    await context.close();
  });

  test('links externos abrem com rel="noopener"', async () => {
    const { page, context } = await open();
    const bad = await page.evaluate(() =>
      [...document.querySelectorAll('a[target="_blank"]')]
        .filter((a) => !a.rel.split(/\s+/).includes('noopener'))
        .map((a) => a.href),
    );
    assert.deepEqual(bad, []);
    const links = await page.evaluate(() =>
      [...document.querySelectorAll('a[data-cta]')].map((a) => a.href),
    );
    assert.ok(links.length >= 4 && links.every((href) => href.startsWith('https://wa.me/')));
    await context.close();
  });
});

describe('teclado', () => {
  test('ordem de foco: pular → logo → menu → botão do cabeçalho → hero', async () => {
    const { page, context } = await open();
    const order = [];
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      order.push(
        await page.evaluate(() => {
          const el = document.activeElement;
          return (el.getAttribute('aria-label') || el.textContent)
            .trim()
            .replace(/\s+/g, ' ')
            .slice(0, 40);
        }),
      );
    }
    assert.deepEqual(order.slice(0, 7), [
      'Pular para o conteúdo',
      'Vanpack · início',
      'Produtos',
      'Diferenciais',
      'Pedir orçamento',
      'Pedir orçamento no WhatsApp',
      'Ver produtos ↓',
    ]);
    // depois do cartão ativo o foco segue para o conteúdo seguinte, sem passar pelos cartões inert
    assert.notEqual(order[7], 'Veja por que a Vanpack ↓');
    await context.close();
  });

  test('todo elemento focável mostra um contorno visível de pelo menos 3 px', async () => {
    const { page, context } = await open();
    const failures = [];
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab');
      const result = await page.evaluate(() => {
        const el = document.activeElement;
        if (el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          label: (el.getAttribute('aria-label') || el.textContent).trim().slice(0, 30),
          style: style.outlineStyle,
          width: parseFloat(style.outlineWidth),
          focusVisible: el.matches(':focus-visible'),
        };
      });
      if (!result) continue;
      if (!result.focusVisible || result.style === 'none' || result.width < 3)
        failures.push(result);
    }
    assert.deepEqual(failures, []);
    await context.close();
  });

  test('o link "pular" aparece ao receber foco e leva ao conteúdo', async () => {
    const { page, context } = await open();
    // sem a animação de 0,2 s (que depende de quadros): confere a regra de foco em si
    await page.evaluate(() =>
      document.querySelector('.skip').style.setProperty('transition', 'none'),
    );
    const topBefore = await page.evaluate(
      () => document.querySelector('.skip').getBoundingClientRect().top,
    );
    assert.ok(topBefore < 0, 'fora da tela enquanto não tem foco');
    await page.keyboard.press('Tab');
    const top = await page.evaluate(
      () => document.querySelector('.skip').getBoundingClientRect().top,
    );
    assert.ok(top >= 0, 'visível dentro da tela com o foco');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => location.hash), '#conteudo');
    await context.close();
  });
});

describe('movimento reduzido', () => {
  test('sem animações nem transições longas e sem rolagem automática', async () => {
    const { page, context } = await openPage(browser, server.url, { reducedMotion: 'reduce' });
    const durations = await page.evaluate(() =>
      ['.card', '.btn', '.fab', '.stage canvas'].map((selector) => {
        const style = getComputedStyle(document.querySelector(selector));
        return { selector, transition: parseFloat(style.transitionDuration) };
      }),
    );
    for (const d of durations) assert.ok(d.transition <= 0.001, `${d.selector}: ${d.transition}s`);
    await page.waitForTimeout(3000);
    assert.equal(await page.evaluate(() => scrollY), 0);
    await context.close();
  });
});

describe('contraste (calculado nos estilos reais)', () => {
  // Texto sobre o cartão (97% opaco sobre a cena) é medido contra o pior caso: cartão sobre preto.
  const PAIRS = [
    ['.card.on h1', 7],
    ['.card.on p', 7],
    ['.card.on .k', 7],
    ['.seals li', 7],
    ['.card.on .cta-note', 7],
    ['.btn-primary', 7],
    ['.btn-soft', 7],
    ['.nav a', 7],
    ['.scrollcue', 7],
    ['.sec-head h2', 7],
    ['.sec-head .k', 7],
    ['#diferenciais .sec-head .k', 7], // faixa tint
    ['#diferenciais .sec-head h2', 7],
    ['.pillar h3', 7], // cartão Papel sobre a faixa tint
    ['.pillar p', 7],
    ['.cta h2', 7],
    ['.cta p.lead', 7],
    ['.cta .cta-note', 7],
    ['.trust-list li', 7],
    ['.trust-list a', 7],
    ['.facts li', 7],
    ['.facts b', 7],
    ['.model h3', 7],
    ['.model p', 7],
    ['.logo-name', 7],
    ['.cliente .tag', 7],
    ['.carrossel-btn', 7],
    ['.cta .alt a', 7],
    ['.fab-wa', 7],
    ['.fab-tel a', 7],
    ['.btn-light', 7],
    ['.how li', 7],
    ['.foot-nav a', 7],
    ['.slogan', 7],
    ['.legal', 7],
  ];

  test('texto e fundo de cada elemento têm ao menos 4,5:1 (7:1 quando o texto é pequeno)', async () => {
    const { page, context } = await open();
    const results = await page.evaluate((pairs) => {
      const parse = (css) => {
        const m = css.match(/rgba?\(([^)]+)\)/);
        const [r, g, b, a = 1] = m[1]
          .split(/[ ,/]+/)
          .filter(Boolean)
          .map(Number);
        return { r, g, b, a };
      };
      const over = (top, base) => ({
        r: top.r * top.a + base.r * (1 - top.a),
        g: top.g * top.a + base.g * (1 - top.a),
        b: top.b * top.a + base.b * (1 - top.a),
        a: 1,
      });
      const lum = ({ r, g, b }) => {
        const [R, G, B] = [r, g, b].map((v) => {
          const c = v / 255;
          return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * R + 0.7152 * G + 0.0722 * B;
      };
      const backgroundOf = (el) => {
        const layers = [];
        for (let node = el; node; node = node.parentElement) {
          const bg = parse(getComputedStyle(node).backgroundColor);
          if (bg.a > 0) layers.push(bg);
          if (bg.a === 1) break;
        }
        // do mais de fundo para o mais de cima, começando do pior caso (preto) sob a cena
        return layers.reduceRight((base, layer) => over(layer, base), { r: 0, g: 0, b: 0, a: 1 });
      };
      return pairs.map(([selector, minimum]) => {
        const el = document.querySelector(selector);
        if (!el) return { selector, missing: true };
        const fg = parse(getComputedStyle(el).color);
        const bg = backgroundOf(el);
        const text = over(fg, bg);
        const [a, b] = [lum(text), lum(bg)].sort((x, y) => y - x);
        return { selector, minimum, ratio: (a + 0.05) / (b + 0.05) };
      });
    }, PAIRS);
    const lines = [];
    for (const r of results) {
      assert.ok(!r.missing, `${r.selector} existe`);
      lines.push(`${r.selector.padEnd(18)} ${r.ratio.toFixed(2)}:1`);
      assert.ok(r.ratio >= r.minimum, `${r.selector}: ${r.ratio.toFixed(2)}:1 < ${r.minimum}:1`);
    }
    console.log('contraste:\n  ' + lines.join('\n  '));
    await context.close();
  });
});
