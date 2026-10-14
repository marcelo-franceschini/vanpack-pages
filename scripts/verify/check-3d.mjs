import { chromium } from 'playwright-core';
import { preview } from 'vite';

const PORT = 4401;

const server = await preview({
  preview: { host: '127.0.0.1', port: PORT, strictPort: true },
  logLevel: 'silent',
});

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  reducedMotion: 'reduce',
  bypassCSP: true,
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

await page.goto(`http://127.0.0.1:${PORT}/?tour=0`);
await page.waitForSelector('.stage.ready', { timeout: 30_000 });

console.log('Stage 3D pronto!');

// Verifica os pins criados no DOM
const pinCount = await page.evaluate(() => document.querySelectorAll('.pin').length);
console.log(`Pinos no DOM: ${pinCount} (esperado: 5)`);

// Rola para os diferentes capítulos e checa pins ativos
for (let step = 0; step < 5; step++) {
  const scrollInfo = await page.evaluate(async (s) => {
    const story = document.querySelector('.story');
    const storyTop = story.getBoundingClientRect().top + window.scrollY;
    const storyRange = story.offsetHeight - window.innerHeight;
    const targetY = storyTop + (s / 4) * storyRange;
    window.scrollTo(0, targetY);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      scrollY: window.scrollY,
      targetY,
      storyTop,
      storyRange,
      activeCard: document.querySelector('.card.on')?.querySelector('.k')?.textContent,
    };
  }, step);
  await page.waitForTimeout(1500);

  const allPins = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.pin')).map((el) => ({
      pin: el.dataset.pin,
      active: el.classList.contains('active'),
      left: el.style.left,
      top: el.style.top,
    }));
  });

  console.log(`Capítulo ${step + 1} (${scrollInfo.activeCard}):`, allPins);
}

await context.close();
await browser.close();
await server.close();

if (errors.length) {
  console.error('Erros encontrados:', errors);
  process.exit(1);
} else {
  console.log('Verificação 3D concluída com sucesso sem erros!');
}
