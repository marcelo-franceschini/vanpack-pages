// Draw calls, triângulos e o que fica na GPU do 3D de cada produto, no desktop (os cartões à vista) e no
// celular (um cartão por vez), mais a memória depois de rolar para dentro e para fora 3 vezes. Usa o
// build de auditoria (`npm run build:audit`), em que o worker dos produtos devolve o `renderer.info`.
// Sai com erro se um modelo passar de 60 draw calls ou se geometrias e texturas crescerem a cada volta.
import { existsSync } from 'node:fs';
import { ROOT, launch, openPage, startServer } from '../lib.mjs';

const BUDGET = 60; // draw calls por modelo, igual no desktop e no celular (não há sombra em tempo real)
const MODELS = ['caixa-normal', 'corte-e-vinco', 'divisorias', 'chapas']; // na ordem dos cartões
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

/** Rola até o cartão `i` e espera um quadro dele com os contadores. */
async function measure(page, i) {
  await page.evaluate(() => {
    if (window.__audit?.produtos) window.__audit.produtos.stats = {};
  });
  await page.evaluate((i) => {
    document.querySelectorAll('.model-3d')[i].scrollIntoView({ block: 'center' });
  }, i);
  await page.waitForFunction((i) => window.__audit?.produtos?.stats?.[i], i, { timeout: 60_000 });
  return page.evaluate((i) => window.__audit.produtos.stats[i], i);
}

for (const [name, device] of Object.entries(DEVICES)) {
  const { page, context } = await openPage(
    browser,
    `${server.url}?tour=0`,
    { reducedMotion: 'no-preference', ...device },
    { waitFor: 'settled' },
  );
  console.log(`\n${name} (sem sombra em tempo real)`);
  console.log('  modelo          draw calls  triângulos  geometrias  texturas');
  for (const [i, model] of MODELS.entries()) {
    const s = await measure(page, i);
    if (s.calls > BUDGET) failed = true;
    console.log(
      `  ${model.padEnd(15)} ${String(s.calls).padStart(10)}  ${String(s.triangles).padStart(10)}  ${String(s.geometries).padStart(10)}  ${String(s.textures).padStart(8)}`,
    );
  }
  console.log(`  orçamento: <= ${BUDGET} draw calls por modelo`);

  if (name === 'mobile') {
    // Vazamento: com o 2º cartão no meio da tela os 3 modelos de perto estão montados; indo até os
    // diferenciais o 1º se afasta (é liberado) e o worker continua vivo pelo 3º. De volta ao mesmo
    // ponto, a GPU tem de ter as mesmas geometrias e texturas, volta após volta.
    // `card`: espera um quadro desse cartão (à vista) antes de ler; sem ele, só espera assentar
    const memory = async (card) => {
      await page.evaluate(() => (window.__audit.produtos.stats = {}));
      if (card !== undefined) {
        await page.waitForFunction((card) => window.__audit.produtos.stats[card], card, {
          timeout: 60_000,
        });
      }
      await page.waitForTimeout(800);
      await page.evaluate(() => {
        window.__audit.produtos.memory = null;
        window.__audit.produtos.askMemory();
      });
      await page.waitForFunction(() => window.__audit.produtos.memory, null, { timeout: 30_000 });
      return page.evaluate(() => window.__audit.produtos.memory);
    };
    const counts = [];
    for (let round = 0; round < 3; round++) {
      await page.evaluate(() =>
        document.querySelectorAll('.model-3d')[1].scrollIntoView({ block: 'center' }),
      );
      counts.push(await memory(1));
      await page.evaluate(() => document.querySelector('#diferenciais').scrollIntoView());
      const away = await memory();
      console.log(
        `  volta ${round + 1}: ${away.models} modelo(s) montado(s) com o 1º cartão longe`,
      );
    }
    console.log('\n  com o 2º cartão no meio da tela (modelos, geometrias, texturas, programas)');
    for (const c of counts) {
      console.log(`    ${c.models}, ${c.geometries}, ${c.textures}, ${c.programs}`);
    }
    const grew = counts.some(
      (c) =>
        c.models !== counts[0].models ||
        c.geometries !== counts[0].geometries ||
        c.textures !== counts[0].textures,
    );
    if (grew) failed = true;
    console.log(`  ${grew ? 'MUDOU entre as voltas' : 'igual nas 3 voltas: sem vazamento'}`);
    const workers = await page.evaluate(() => window.__audit.produtos.workers);
    console.log(`  workers criados na visita: ${workers}`);
  }
  await context.close();
}
await browser.close();
await server.close();
if (failed) process.exit(1);
