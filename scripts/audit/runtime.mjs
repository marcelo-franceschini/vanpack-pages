// Runtime: rola a história inteira (14 s, linear) e mede, na thread principal, as tarefas longas
// (> 50 ms) e os quadros por segundo; no worker, os quadros desenhados; e confirma que, parada, a
// cena não desenha mais nada. Usa o build de auditoria (`npm run build:audit`).
//
// Atenção: o Chrome de teste não tem GPU (WebGL por software, SwiftShader), então os quadros do worker
// são um limite inferior; a thread principal é medida de verdade (com CPU 1× e 4× mais lenta).
import { existsSync } from 'node:fs';
import { ROOT, launch, startServer } from '../lib.mjs';

const SWEEP_MS = 14_000;
const SCENARIOS = [
  { name: 'desktop 1440×900, CPU 1×', cpu: 1, device: { viewport: { width: 1440, height: 900 } } },
  { name: 'desktop 1440×900, CPU 4×', cpu: 4, device: { viewport: { width: 1440, height: 900 } } },
  {
    name: 'celular 390×844, CPU 4×',
    cpu: 4,
    device: {
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
      deviceScaleFactor: 2,
    },
  },
];

if (!existsSync(`${ROOT}dist-audit/index.html`)) {
  console.error('Sem dist-audit/: rode `npm run build:audit` antes.');
  process.exit(2);
}

const server = await startServer('dist-audit');
const browser = await launch();
let failed = false;
console.log(
  'cenário                      tarefas>50ms  maior   fps da página  quadros do worker   parada: quadros em 2 s',
);
for (const scenario of SCENARIOS) {
  const context = await browser.newContext(scenario.device);
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__long.push(e.duration);
    }).observe({ type: 'longtask', buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpu });
  await page.goto(`${server.url}?tour=0`);
  await page.waitForSelector('.stage.ready', { timeout: 120_000 });
  await page.waitForTimeout(1500);
  const before = await page.evaluate(() => ({
    frames: window.__audit.stats.frames,
    long: window.__long.length,
  }));

  const sweep = await page.evaluate(
    (duration) =>
      new Promise((resolve) => {
        const story = document.querySelector('.story');
        const stage = document.querySelector('#stage');
        const top = story.getBoundingClientRect().top + scrollY;
        const range = story.offsetHeight - stage.offsetHeight;
        const t0 = performance.now();
        let frames = 0;
        const step = (now) => {
          frames += 1;
          const t = Math.min(1, (now - t0) / duration);
          scrollTo(0, top + range * t);
          if (t < 1) requestAnimationFrame(step);
          else resolve({ frames, seconds: (now - t0) / 1000 });
        };
        requestAnimationFrame(step);
      }),
    SWEEP_MS,
  );
  const during = await page.evaluate(() => ({
    frames: window.__audit.stats.frames,
    long: window.__long.slice(),
  }));
  const longTasks = during.long.slice(before.long);
  // parada no fim: a cena assenta e para de desenhar
  await page.waitForTimeout(6000);
  const settled = await page.evaluate(() => window.__audit.stats.frames);
  await page.waitForTimeout(2000);
  const idle = (await page.evaluate(() => window.__audit.stats.frames)) - settled;
  if (idle !== 0) failed = true;

  const workerFrames = during.frames - before.frames;
  console.log(
    `${scenario.name.padEnd(28)} ${String(longTasks.length).padStart(6)}  ${Math.max(
      0,
      ...longTasks,
    )
      .toFixed(0)
      .padStart(
        5,
      )} ms  ${(sweep.frames / sweep.seconds).toFixed(0).padStart(8)} fps  ${String(workerFrames).padStart(8)} (${(workerFrames / sweep.seconds).toFixed(1)}/s)   ${String(idle).padStart(10)}`,
  );
  await context.close();
}
await browser.close();
await server.close();
if (failed) {
  console.error('\nA cena continuou desenhando com a página parada.');
  process.exit(1);
}
