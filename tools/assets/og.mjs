// Gera public/og.jpg (1200×630), a imagem de compartilhamento: o primeiro quadro da história (marca,
// chamada e a cena), sem menu nem botões. Usa o build de produção (`npm run build`) e o Chrome de
// CHROME_PATH. Rode de novo quando a cena ou a chamada mudarem e confira a imagem antes de commitar.
import { existsSync, writeFileSync } from 'node:fs';
import { ROOT, launch, openPage, startServer } from './lib.mjs';

if (!existsSync(`${ROOT}dist/index.html`)) {
  console.error('Sem dist/: rode `npm run build` antes.');
  process.exit(2);
}

const server = await startServer('dist');
const browser = await launch();
// Layout normal de desktop (1400×735, proporção do OG) reduzido para 1200×630: com menos de 700 px de
// altura a página usa o layout compacto, que não é o que queremos na imagem.
const { page, context } = await openPage(browser, `${server.url}?tour=0`, {
  viewport: { width: 1400, height: 735 },
  deviceScaleFactor: 1200 / 1400,
  reducedMotion: 'reduce', // a cena salta direto ao primeiro quadro
});
// só a marca, a chamada e a cena
await page.evaluate(() => {
  for (const selector of ['.nav', '#hdr .btn', '.scrollcue', '.actions', '.seal', '.optional']) {
    for (const el of document.querySelectorAll(selector)) el.style.setProperty('display', 'none');
  }
});
await page.waitForTimeout(3000);
const image = await page.screenshot({ type: 'jpeg', quality: 88 });
writeFileSync(`${ROOT}public/og.jpg`, image);
console.log(`public/og.jpg  ${(image.length / 1024).toFixed(1)} KB`);
await context.close();
await browser.close();
await server.close();
