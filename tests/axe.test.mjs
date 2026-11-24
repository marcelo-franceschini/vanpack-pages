// Acessibilidade automatizada: axe-core (WCAG 2.0, 2.1 e 2.2, níveis A e AA) na página principal, no topo
// e no fim, em desktop e celular, e na política de privacidade. Reprova em violação séria ou crítica (a
// automação não cobre tudo: os testes de foco, contraste calculado, movimento reduzido e alvos de toque
// do a11y.test.mjs e do foco.test.mjs seguem valendo). Movimento reduzido: o botão do cabeçalho some com
// uma transição, e o axe medindo no meio dela daria um falso contraste.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { after, before, describe, test } from 'node:test';
import { launch, openPage, startServer } from '../scripts/lib.mjs';

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const SCREENS = {
  '1440×900': { viewport: { width: 1440, height: 900 } },
  '390×844': {
    viewport: { width: 390, height: 844 },
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

/** As violações sérias e críticas do axe na página, formatadas (regra, impacto, elementos). */
async function violations(page) {
  // bypassCSP: o axe entra por addScriptTag, e a CSP da página (de propósito) não aceita script solto
  await page.addScriptTag({ content: AXE });
  const result = await page.evaluate(
    (tags) => window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
    TAGS,
  );
  return result.violations
    .filter((violation) => ['serious', 'critical'].includes(violation.impact))
    .map(
      (violation) =>
        `${violation.id} [${violation.impact}] ${violation.nodes.length}x: ${violation.nodes
          .slice(0, 3)
          .map((node) => node.target.join(' '))
          .join(' ; ')}`,
    );
}

describe('axe-core WCAG 2.2 AA', () => {
  for (const [name, device] of Object.entries(SCREENS)) {
    test(`página principal em ${name}, no topo e no fim`, async () => {
      const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
        reducedMotion: 'reduce',
        bypassCSP: true,
        ...device,
      });
      assert.deepEqual(await violations(page), [], 'no topo');
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(1200);
      assert.deepEqual(await violations(page), [], 'no fim');
      await context.close();
    });

    test(`política de privacidade em ${name}`, async () => {
      const { page, context } = await openPage(
        browser,
        server.url,
        { reducedMotion: 'reduce', bypassCSP: true, ...device },
        { waitFor: 'none' },
      );
      await page.goto(`${server.url}politica-de-privacidade.html`);
      assert.deepEqual(await violations(page), []);
      await context.close();
    });
  }

  test('o axe enxerga uma violação (se não, ele não prova nada)', async () => {
    const { page, context } = await openPage(
      browser,
      server.url,
      { bypassCSP: true },
      { waitFor: 'none' },
    );
    await page.setContent(
      '<!doctype html><html lang="pt-BR"><title>x</title><main><img src="a.png"><button></button></main></html>',
    );
    assert.ok((await violations(page)).length > 0);
    await context.close();
  });
});
