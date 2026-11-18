// Teste de fumaca no WebKit (Safari no motor WebKit): valida carregamento basico,
// cena 3D/fallback e os produtos sem erros de pagina ou de script.
// Disparado manualmente via workflow ou localmente quando o WebKit estiver instalado.
import { webkit } from 'playwright-core';
import { startServer } from './lib.mjs';

const server = await startServer('dist');
console.log(`[fumaca-webkit] Servidor iniciado em ${server.url}`);

let browser;
try {
  browser = await webkit.launch();
} catch (err) {
  console.error(
    '[fumaca-webkit] Falha ao iniciar WebKit. Instale com `npx playwright-core install webkit`.',
  );
  console.error(err.message);
  await server.close();
  process.exit(1);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];

page.on('pageerror', (err) => {
  errors.push(`pageerror: ${err.message}`);
});

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    errors.push(`console.error: ${msg.text()}`);
  }
});

try {
  console.log('[fumaca-webkit] Abrindo pagina...');
  await page.goto(`${server.url}?tour=0`, { waitUntil: 'domcontentloaded' });

  console.log('[fumaca-webkit] Aguardando stage (.ready ou .no-gl)...');
  await page.waitForSelector('.stage.ready, .stage.no-gl', { timeout: 15_000 });

  console.log('[fumaca-webkit] Rolando ate a secao de produtos...');
  await page.evaluate(() => {
    document.querySelector('#produtos')?.scrollIntoView({ block: 'center' });
  });

  console.log('[fumaca-webkit] Aguardando modelo 3D (.pronto ou .falhou)...');
  await page.waitForSelector('.model-3d.pronto, .model-3d.falhou', { timeout: 15_000 });

  console.log('[fumaca-webkit] Verificacao concluida com sucesso.');
} catch (err) {
  errors.push(`execucao: ${err.message}`);
} finally {
  await browser.close();
  await server.close();
}

if (errors.length) {
  console.error('[fumaca-webkit] Erros encontrados:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('[fumaca-webkit] Tudo limpo, nenhum erro de pagina.');
