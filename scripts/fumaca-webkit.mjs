// Teste de fumaça no WebKit, o motor do Safari: a página abre, a cena 3D fica pronta (ou cai para o
// fundo sem WebGL), o 3D dos produtos monta (ou mostra a ilustração) e nada dá erro de página nem de
// console. Fica fora da suíte (não há WebKit no runner dos testes): roda à mão pelo workflow "Fumaça
// WebKit" (aba Actions, Run workflow) ou aqui, com o WebKit do Playwright e as bibliotecas que ele
// pede (só existem prontas no Ubuntu e no Debian). O WebKit do Playwright não é o Safari do iPhone,
// mas pega erro de motor.
import { webkit } from 'playwright-core';
import { startServer } from './lib.mjs';

// O mesmo prazo dos testes: com WebGL por software a cena e os produtos demoram a ficar prontos.
const TIMEOUT = 60_000;

const server = await startServer('dist');
console.log(`[fumaça-webkit] servidor em ${server.url}`);

let browser;
try {
  browser = await webkit.launch();
} catch (err) {
  console.error(
    '[fumaça-webkit] o WebKit não abriu. Instale com `npx playwright-core install --with-deps webkit`.',
  );
  console.error(err.message);
  await server.close();
  process.exit(1);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
});

try {
  console.log('[fumaça-webkit] abrindo a página');
  await page.goto(`${server.url}?tour=0`, { waitUntil: 'domcontentloaded' });
  console.log('[fumaça-webkit] esperando a cena (.ready, ou .no-gl sem WebGL)');
  await page.waitForSelector('.stage.ready, .stage.no-gl', { timeout: TIMEOUT });
  console.log('[fumaça-webkit] rolando até os produtos');
  await page.evaluate(() =>
    document.querySelector('#produtos')?.scrollIntoView({ block: 'center' }),
  );
  // .pronto vale para o 3D e para a ilustração em SVG que o substitui (src/produtos/gatilho.js)
  console.log('[fumaça-webkit] esperando um cartão de produto pronto');
  await page.waitForSelector('.model-3d.pronto', { timeout: TIMEOUT });
} catch (err) {
  errors.push(`execução: ${err.message}`);
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error('[fumaça-webkit] erros encontrados:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('[fumaça-webkit] tudo limpo: nenhum erro de página nem de console');
