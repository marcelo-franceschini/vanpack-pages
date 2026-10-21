// Foco de teclado não encoberto (WCAG 2.4.11): ao percorrer a página com Tab, nenhum elemento focado
// fica totalmente atrás do cabeçalho fixo nem do botão fixo do WhatsApp (a barra no celular, o botão
// redondo no desktop). O link "Pular para o conteúdo" aparece de propósito por cima do cabeçalho e não conta.
import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer } from '../scripts/lib.mjs';

const SCREENS = {
  '1440×900': { viewport: { width: 1440, height: 900 } },
  '390×844': {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
  '360×640': {
    viewport: { width: 360, height: 640 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
  '844×390': {
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
};

let server;
let browser;
before(async () => {
  server = await startServer(process.env.TESTE_DIST ?? 'dist');
  browser = await launch();
});
after(async () => {
  await browser.close();
  await server.close();
});

/** O elemento focado e se está totalmente coberto por um elemento fixo à vista. */
const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body || el.classList.contains('skip')) return null;
    const box = el.getBoundingClientRect();
    const covers = [...document.querySelectorAll('.hdr, .fab, .sheet')].filter((cover) => {
      if (cover.contains(el)) return false;
      const style = getComputedStyle(cover);
      return (
        style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.5
      );
    });
    const hidden = covers.some((cover) => {
      const r = cover.getBoundingClientRect();
      return (
        box.left >= r.left - 0.5 &&
        box.right <= r.right + 0.5 &&
        box.top >= r.top - 0.5 &&
        box.bottom <= r.bottom + 0.5
      );
    });
    return {
      label: (el.getAttribute('aria-label') || el.textContent || el.className).trim().slice(0, 40),
      hidden,
      box: [box.top, box.bottom].map(Math.round),
    };
  });

describe('o foco de teclado nunca fica totalmente atrás do cabeçalho ou do botão fixo', () => {
  for (const [name, device] of Object.entries(SCREENS)) {
    test(name, async () => {
      const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
        reducedMotion: 'reduce',
        ...device,
      });
      const seen = [];
      for (let i = 0; i < 80; i++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(60);
        const state = await focused(page);
        if (!state) continue;
        seen.push(state.label);
        assert.equal(
          state.hidden,
          false,
          `"${state.label}" ficou totalmente coberto (topo e base ${state.box})`,
        );
      }
      assert.ok(new Set(seen).size > 15, `percorreu a página (${new Set(seen).size} elementos)`);
      await context.close();
    });
  }
});
