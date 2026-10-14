import { chromium } from 'playwright-core';
import { preview } from 'vite';

const PORT = 4403;

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
  bypassCSP: true,
});

const page = await context.newPage();
await page.goto(`http://127.0.0.1:${PORT}/?tour=0`);
await page.waitForSelector('.stage.ready', { timeout: 30_000 });

// Mede estatísticas da cena injetando inspeção de WebGL draw calls
const stats = await page.evaluate(async () => {
  // Rola por 5 progressos e conta draw calls se exposto, ou faz scroll
  const story = document.querySelector('.story');
  const storyTop = story.getBoundingClientRect().top + window.scrollY;
  const storyRange = story.offsetHeight - window.innerHeight;

  const results = [];
  for (const p of [0, 0.25, 0.5, 0.75, 1.0]) {
    window.scrollTo(0, storyTop + p * storyRange);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    results.push({ p, scrollY: window.scrollY });
  }
  return results;
});

console.log('Scroll nos capítulos testado:', stats);

await context.close();
await browser.close();
await server.close();
console.log('Medição concluída com sucesso!');
