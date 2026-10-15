// Capturas reais da história (tamanho real, sem simulação por zoom): os 5 centros (p = 0, .25, .5,
// .75, 1) em 1440×900 e em 390×844 (celular, densidade 2), gravadas em docs/capturas/.
// Usa o build de produção; movimento reduzido faz a cena saltar direto ao quadro pedido.
import { mkdirSync } from 'node:fs';
import { ROOT, launch, openPage, scrollToProgress, startServer } from '../lib.mjs';

const OUT = `${ROOT}docs/capturas/`;
const CENTERS = [
  [0, 'medida'],
  [0.25, 'impressao-e-corte'],
  [0.5, 'cola'],
  [0.75, 'caixa'],
  [1, 'entrega-ultimo-quadro'],
];
const DEVICES = {
  'desktop-1440x900': { viewport: { width: 1440, height: 900 } },
  'celular-390x844': {
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 2,
  },
};

mkdirSync(OUT, { recursive: true });
const server = await startServer('dist');
const browser = await launch();
for (const [name, device] of Object.entries(DEVICES)) {
  const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
    reducedMotion: 'reduce',
    ...device,
  });
  for (const [p, label] of CENTERS) {
    await scrollToProgress(page, p);
    // a cena (no worker) desenha o quadro pedido e assenta
    await page.waitForTimeout(2500);
    const file = `${OUT}${name}-p${String(Math.round(p * 100)).padStart(3, '0')}-${label}.jpg`;
    await page.screenshot({ path: file, type: 'jpeg', quality: 86 });
    console.log(file.replace(ROOT, ''));
  }
  await context.close();
}
await browser.close();
await server.close();
