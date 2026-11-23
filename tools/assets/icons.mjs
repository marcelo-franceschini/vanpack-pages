// Gera os ícones da Vanpack (o site não é instalável como app: sem manifest nem service worker):
// - public/favicon.svg (símbolo em negativo)
// - PNGs: favicon-32x32, apple-touch-icon (180x180) e icon-512 (o logo do JSON-LD)
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright-core';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const SVG_NEGATIVO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="Vanpack"><rect width="100" height="100" fill="#14513A"/><rect x="3.5" y="3.5" width="93" height="93" fill="none" stroke="#FBF8F2" stroke-width="7"/><g transform="translate(22 22.6) scale(0.56)" fill="#FBF8F2"><polygon points="14,35 48,18 45,2 11,19"/><polygon points="86,35 52,18 55,2 89,19"/><polygon points="14,41 48,58 42,46 8,29"/><polygon points="86,41 52,58 58,46 92,29"/><polygon points="14,46 50,64 50,96 14,78"/><polygon points="50,64 86,46 86,78 50,96"/></g></svg>`;

// Salva favicon.svg
await writeFile(join(publicDir, 'favicon.svg'), SVG_NEGATIVO, 'utf-8');
console.log('favicon.svg gravado.');

// Gera PNGs via Chromium
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const page = await browser.newPage();

async function renderIcon(filename, size) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: ${size}px;
            height: ${size}px;
          }
        </style>
      </head>
      <body>
        ${SVG_NEGATIVO}
      </body>
    </html>
  `;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  const buf = await page.screenshot({ omitBackground: true });
  await writeFile(join(publicDir, filename), buf);
  console.log(`${filename} (${size}x${size}) gravado: ${(buf.length / 1024).toFixed(1)} KB`);
}

await renderIcon('favicon-32x32.png', 32);
await renderIcon('apple-touch-icon.png', 180);
await renderIcon('icon-512.png', 512);

await browser.close();
console.log('Todos os ícones gerados com sucesso.');
