// Gera as imagens estáticas do site a partir da própria cena 3D:
//   public/posters/landscape.webp, portrait.webp  1º quadro (aparece antes do 3D e sem WebGL)
//   public/og.jpg                                  imagem de compartilhamento (1200×630)
// Uso: npm run build && CHROME_PATH=/caminho/do/chrome npm run poster
// Rode de novo (e faça o build) sempre que a cena ou o enquadramento inicial mudarem.
import { access, mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const PORT = 4399;
const MAX_POSTER_KB = 70;
const HIDE_CHROME = `
  .hdr, .steps, .route, .scrollcue, .fab, .skip, .poster { visibility: hidden !important; }
  *, *::before, *::after { transition: none !important; animation: none !important; }
`;
const HIDE_FOR_SHARE = `
  .nav, .hdr .btn, .route, .scrollcue, .fab, .skip, .chips, .actions, .poster { display: none !important; }
  *, *::before, *::after { transition: none !important; animation: none !important; }
`;

try {
  await access('dist/index.html');
} catch {
  console.error('dist/ não existe: rode `npm run build` antes.');
  process.exit(1);
}

const server = await preview({
  preview: { host: '127.0.0.1', port: PORT, strictPort: true },
  logLevel: 'silent',
});
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

/** Abre a página, espera a cena 3D e devolve a captura depois de aplicar `css`. */
async function capture({ viewport, deviceScaleFactor = 1 }, css, screenshotOptions = {}) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor,
    reducedMotion: 'reduce',
    bypassCSP: true,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?tour=0`);
  await page.waitForSelector('.stage.ready', { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: css });
  await page.waitForTimeout(1200);
  const image = await page.screenshot(screenshotOptions);
  await context.close();
  return image;
}

/** PNG → WebP pelo próprio Chromium (sem dependências nativas). */
async function toWebp(png, quality) {
  const page = await browser.newPage();
  const base64 = await page.evaluate(
    async ({ b64, quality }) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      const out = await canvas.convertToBlob({ type: 'image/webp', quality });
      const bytes = new Uint8Array(await out.arrayBuffer());
      let s = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return btoa(s);
    },
    { b64: png.toString('base64'), quality },
  );
  await page.close();
  return Buffer.from(base64, 'base64');
}

async function savePoster(name, png) {
  let quality = 0.85;
  let webp = await toWebp(png, quality);
  while (webp.length > MAX_POSTER_KB * 1024 && quality > 0.45) {
    quality -= 0.05;
    webp = await toWebp(png, quality);
  }
  await writeFile(`public/posters/${name}.webp`, webp);
  console.log(
    `posters/${name}.webp  ${(webp.length / 1024).toFixed(1)} KB  (qualidade ${quality.toFixed(2)})`,
  );
}

try {
  await mkdir('public/posters', { recursive: true });
  await savePoster(
    'landscape',
    await capture({ viewport: { width: 1440, height: 900 } }, HIDE_CHROME),
  );
  await savePoster(
    'portrait',
    await capture({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 }, HIDE_CHROME),
  );
  const og = await capture({ viewport: { width: 1200, height: 630 } }, HIDE_FOR_SHARE, {
    type: 'jpeg',
    quality: 82,
  });
  await writeFile('public/og.jpg', og);
  console.log(`og.jpg  ${(og.length / 1024).toFixed(1)} KB`);
} finally {
  await browser.close();
  await server.close();
}
