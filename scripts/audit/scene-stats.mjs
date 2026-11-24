// Draw calls e triângulos nos 5 centros da história (p = 0, .25, .5, .75, 1), no desktop (sombra em
// tempo real) e no celular (sem sombra). Usa o build de auditoria (`npm run build:audit`), que expõe
// `renderer.info`. Os draw calls incluem a passada de sombra. Sai com erro se passar do orçamento.
import { existsSync } from 'node:fs';
import { ROOT, launch, openPage, scrollToProgress, startServer } from '../lib.mjs';

const BUDGET = { desktop: 90, mobile: 60 };
const CENTERS = [0, 0.25, 0.5, 0.75, 1];
const DEVICES = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
};

if (!existsSync(`${ROOT}dist-audit/index.html`)) {
  console.error('Sem dist-audit/: rode `npm run build:audit` antes.');
  process.exit(2);
}

const server = await startServer('dist-audit');
const browser = await launch();
let failed = false;
for (const [name, device] of Object.entries(DEVICES)) {
  const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
    reducedMotion: 'reduce', // a cena salta direto ao p pedido: um quadro por p
    ...device,
  });
  console.log(
    `\n${name}${name === 'mobile' ? ' (sem sombra em tempo real)' : ' (sombra em tempo real)'}`,
  );
  console.log('  p     draw calls  triângulos  geometrias  texturas');
  for (const p of CENTERS) {
    await scrollToProgress(page, p);
    await page.waitForFunction(
      (target) => Math.abs((window.__audit?.stats?.p ?? -1) - target) < 1e-3,
      p,
      { timeout: 60_000 },
    );
    const s = await page.evaluate(() => window.__audit.stats);
    if (s.calls > BUDGET[name]) failed = true;
    console.log(
      `  ${String(p).padEnd(5)} ${String(s.calls).padStart(10)}  ${String(s.triangles).padStart(10)}  ${String(s.geometries).padStart(10)}  ${String(s.textures).padStart(8)}`,
    );
  }
  console.log(`  orçamento: <= ${BUDGET[name]} draw calls`);
  await context.close();
}
await browser.close();
await server.close();
if (failed) process.exit(1);
