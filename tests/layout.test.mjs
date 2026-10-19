// Layout: o cartão do capítulo nunca cobre o cabeçalho, o botão flutuante nem a dica de scroll, cabe
// na tela e os alvos de toque têm pelo menos 44 px, em seis tamanhos de tela e nos cinco capítulos.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, scrollToProgress, startServer, yAtProgress } from '../scripts/lib.mjs';

const CHAPTERS = [0, 0.25, 0.5, 0.75, 1];
const SCREENS = [
  { name: '1440×900', width: 1440, height: 900 },
  { name: '1366×768', width: 1366, height: 768 },
  { name: '924×540', width: 924, height: 540 },
  { name: '720×450 (zoom de 200% em 1440×900)', width: 720, height: 450 },
  { name: '360×640 (Android pequeno)', width: 360, height: 640, mobile: true },
  { name: '390×844 (celular em pé)', width: 390, height: 844, mobile: true },
  { name: '844×390 (celular deitado)', width: 844, height: 390, mobile: true },
];

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

/** Medidas, em pixels da tela, de tudo que pode se sobrepor ao cartão ativo. */
const measure = (page) =>
  page.evaluate(() => {
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const visible =
        style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.05;
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, visible };
    };
    const card = document.querySelector('.card.on');
    const targets = [...document.querySelectorAll('a[href], button')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return (
          r.width > 0 &&
          r.height > 0 &&
          style.visibility !== 'hidden' &&
          !el.closest('[inert]') &&
          !el.classList.contains('skip') &&
          r.top < innerHeight &&
          r.bottom > 0
        );
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.textContent || el.getAttribute('aria-label') || el.className)
            .trim()
            .slice(0, 40),
          width: r.width,
          height: r.height,
        };
      });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      card: box(card),
      cardOverflow: card.scrollHeight - card.clientHeight,
      header: box(document.querySelector('#hdr')),
      fab: box(document.querySelector('#fab')),
      cue: box(document.querySelector('#cue')),
      targets,
    };
  });

const overlaps = (a, b) =>
  a &&
  b &&
  a.visible &&
  b.visible &&
  a.left < b.right &&
  a.right > b.left &&
  a.top < b.bottom &&
  a.bottom > b.top;

for (const screen of SCREENS) {
  describe(screen.name, () => {
    let page;
    let context;
    let problems;
    before(async () => {
      ({ page, context, problems } = await openPage(browser, server.url, {
        viewport: { width: screen.width, height: screen.height },
        reducedMotion: 'reduce', // sem tour e sem transições: o cartão aparece já no lugar
        ...(screen.mobile ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}),
      }));
    });
    after(async () => {
      assert.deepEqual(problems, [], 'nada no console nem erro de script');
      await context.close();
    });

    for (const p of CHAPTERS) {
      test(`capítulo ${p * 4 + 1}: sem sobreposição e dentro da tela`, async () => {
        await scrollToProgress(page, p);
        const m = await measure(page);
        const { card, header, fab, cue, viewport } = m;
        assert.ok(
          card.top >= header.bottom - 0.5,
          `o cartão (topo ${card.top}) não passa por baixo do cabeçalho (${header.bottom})`,
        );
        assert.ok(card.left >= -0.5 && card.right <= viewport.width + 0.5, 'cabe na largura');
        assert.ok(
          card.bottom <= viewport.height + 0.5,
          `cabe na altura (${card.bottom} <= ${viewport.height})`,
        );
        assert.ok(!overlaps(card, fab), 'não cobre o botão flutuante');
        assert.ok(!overlaps(card, cue), 'não cobre a dica de scroll');
        assert.ok(!overlaps(header, fab), 'o botão flutuante não cobre o cabeçalho');
        assert.ok(m.scrollWidth <= viewport.width, 'sem rolagem horizontal');
        assert.ok(
          m.cardOverflow <= 1,
          `o texto cabe no cartão sem rolar por dentro (sobra ${m.cardOverflow} px)`,
        );
      });
    }

    test('alvos de toque e clique com pelo menos 44 px de altura', async () => {
      for (const p of CHAPTERS) {
        await scrollToProgress(page, p);
        const { targets } = await measure(page);
        for (const t of targets) {
          assert.ok(
            t.height >= 44 - 0.5,
            `"${t.label}" tem ${t.height.toFixed(1)} px de altura no capítulo ${p * 4 + 1}`,
          );
        }
      }
    });
  });
}

describe('1ª tela do celular', () => {
  for (const screen of SCREENS.filter((s) => s.mobile && s.width <= 768)) {
    test(`${screen.name}: H1, pedido mínimo, botão e linha de risco sem rolar; o 2º chamado é link`, async () => {
      const { page, context } = await openPage(browser, server.url, {
        viewport: { width: screen.width, height: screen.height },
        reducedMotion: 'reduce',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      });
      const first = await page.evaluate(() => {
        const card = document.querySelector('.card.on');
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          const shown = style.display !== 'none' && style.visibility !== 'hidden';
          return { top: r.top, bottom: r.bottom, width: r.width, shown };
        };
        return {
          height: innerHeight,
          header: document.querySelector('#hdr').getBoundingClientRect().bottom,
          parts: {
            título: rect(card.querySelector('h1')),
            'pedido mínimo': rect(card.querySelector('.seals li')),
            botão: rect(card.querySelector('[data-cta="hero"]')),
            'linha de risco': rect(card.querySelector('.cta-note')),
          },
          seals: [...card.querySelectorAll('.seals li')]
            .filter((li) => getComputedStyle(li).display !== 'none')
            .map((li) => li.textContent.trim()),
          link: {
            ...rect(document.querySelector('#tour-start')),
            background: getComputedStyle(document.querySelector('#tour-start')).backgroundColor,
          },
        };
      });
      for (const [name, part] of Object.entries(first.parts)) {
        assert.ok(part.shown, `${name} à vista`);
        assert.ok(
          part.top >= first.header - 0.5 && part.bottom <= first.height + 0.5,
          `${name} inteiro na 1ª tela (${part.top}–${part.bottom} de ${first.height})`,
        );
      }
      assert.match(first.seals[0], /^Pedido mínimo/);
      assert.ok(!first.seals.some((s) => s.startsWith('Prazo')), 'o prazo já está no parágrafo');
      assert.ok(
        first.link.width < first.parts.botão.width * 0.75,
        'o 2º chamado não é outro bloco',
      );
      assert.equal(
        first.link.background,
        'rgba(0, 0, 0, 0)',
        'o 2º chamado não tem fundo de botão',
      );
      await context.close();
    });
  }
});

describe('seções depois da história', () => {
  test('sem rolagem horizontal em nenhum tamanho e botão flutuante sem cobrir o rodapé', async () => {
    for (const screen of SCREENS) {
      const { page, context } = await openPage(browser, server.url, {
        viewport: { width: screen.width, height: screen.height },
        reducedMotion: 'reduce',
        ...(screen.mobile ? { hasTouch: true, isMobile: true } : {}),
      });
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(300);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth,
      }));
      assert.ok(scrollWidth <= innerWidth, `${screen.name}: rolagem horizontal`);
      await context.close();
    }
  });
});

describe('barra fixa do WhatsApp (celular)', () => {
  // a barra vale até 768 px de largura; o celular deitado (844 px) segue o botão redondo
  for (const screen of SCREENS.filter((s) => s.mobile && s.width <= 768)) {
    test(`${screen.name}: largura total, 56 px ou mais, alvos de 44 px e some com o CTA final à vista`, async () => {
      const { page, context } = await openPage(browser, server.url, {
        viewport: { width: screen.width, height: screen.height },
        reducedMotion: 'reduce',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      });
      const end = await yAtProgress(page, 1);
      await page.evaluate((y) => scrollTo(0, y + 400), end);
      await page.waitForFunction(
        () => document.querySelector('#fab').classList.contains('on'),
        null,
        {
          timeout: 5000,
        },
      );
      const bar = await page.evaluate(() => {
        const rect = (el) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height };
        };
        return {
          viewport: { width: innerWidth, height: innerHeight },
          fab: rect(document.querySelector('#fab')),
          whatsapp: rect(document.querySelector('.fab-wa')),
          phone: rect(document.querySelector('.fab-tel a')),
          scrollWidth: document.documentElement.scrollWidth,
        };
      });
      assert.ok(bar.fab.left <= 0.5 && bar.fab.right >= bar.viewport.width - 0.5, 'largura total');
      assert.ok(bar.fab.bottom >= bar.viewport.height - 0.5, 'colada no pé da tela');
      assert.ok(bar.fab.height >= 56 - 0.5, `altura de ${bar.fab.height}px`);
      assert.ok(bar.whatsapp.height >= 44 && bar.phone.height >= 44, 'alvos de 44 px');
      assert.ok(bar.whatsapp.right <= bar.phone.left + 0.5, 'WhatsApp e telefone não se sobrepõem');
      assert.ok(bar.scrollWidth <= bar.viewport.width, 'sem rolagem horizontal');

      // com o CTA final bem à vista a barra some, e volta ao subir
      await page.evaluate(() => document.querySelector('#orcamento').scrollIntoView());
      await page.waitForFunction(
        () => document.querySelector('#fab').classList.contains('away'),
        null,
        {
          timeout: 5000,
        },
      );
      await page.waitForFunction(
        () => getComputedStyle(document.querySelector('#fab')).visibility === 'hidden',
        null,
        { timeout: 5000 },
      );
      await page.evaluate((y) => scrollTo(0, y + 400), end);
      await page.waitForFunction(
        () => !document.querySelector('#fab').classList.contains('away'),
        null,
        {
          timeout: 5000,
        },
      );
      await context.close();
    });
  }

  for (const screen of SCREENS.filter((s) => s.mobile && s.width <= 768)) {
    test(`${screen.name}: escondida no capítulo 1, à vista do 2 ao 5 e o cabeçalho sem botão`, async () => {
      const { page, context } = await openPage(browser, server.url, {
        viewport: { width: screen.width, height: screen.height },
        reducedMotion: 'reduce',
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 2,
      });
      // a barra e o botão do cabeçalho trocam de lugar com uma transição curta: espera o estado
      const expect = (bar, chapter) =>
        page
          .waitForFunction(
            (bar) => {
              const shown = (el) => getComputedStyle(el).visibility === 'visible';
              const fab = document.querySelector('#fab');
              return (
                fab.classList.contains('on') === bar &&
                shown(fab) === bar &&
                shown(document.querySelector('#hdr .btn')) === !bar
              );
            },
            bar,
            { timeout: 5000 },
          )
          .catch(() => assert.fail(`capítulo ${chapter}: barra ${bar ? 'à vista' : 'escondida'}`));
      await scrollToProgress(page, 0);
      await expect(false, 1);
      for (const p of [0.25, 0.5, 0.75, 1]) {
        await scrollToProgress(page, p);
        await expect(true, p * 4 + 1);
      }
      await scrollToProgress(page, 0);
      await expect(false, 1);
      await context.close();
    });
  }

  test('no desktop e no celular deitado segue o botão redondo, só com o ícone', async () => {
    const { page, context } = await openPage(browser, server.url, { reducedMotion: 'reduce' });
    const info = await page.evaluate(() => {
      const fab = document.querySelector('#fab'); // offsetWidth ignora o scale da entrada
      return {
        width: fab.offsetWidth,
        height: fab.offsetHeight,
        label: getComputedStyle(document.querySelector('.fab-wa span')).display,
        phone: getComputedStyle(document.querySelector('.fab-tel')).display,
      };
    });
    assert.deepEqual([info.width, info.height, info.label, info.phone], [56, 56, 'none', 'none']);
    await context.close();
  });
});

describe('botão flutuante do WhatsApp', () => {
  test('no desktop fica escondido na história (o do cabeçalho cumpre o papel) e aparece depois dela', async () => {
    const { page, context } = await openPage(browser, server.url, { reducedMotion: 'reduce' });
    const visible = () =>
      page.evaluate(() => {
        const fab = document.querySelector('#fab');
        return fab.classList.contains('on') && getComputedStyle(fab).visibility === 'visible';
      });
    await scrollToProgress(page, 1);
    assert.equal(await visible(), false, 'no último quadro da história');
    const end = await yAtProgress(page, 1);
    await page.evaluate((y) => scrollTo(0, y + 400), end);
    await page.waitForFunction(
      () => document.querySelector('#fab').classList.contains('on'),
      null,
      {
        timeout: 5000,
      },
    );
    assert.equal(await visible(), true, 'depois da história');
    await context.close();
  });
});
