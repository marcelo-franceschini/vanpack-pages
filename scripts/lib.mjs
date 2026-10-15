// Utilidades dos testes e das auditorias: servidor de preview do build, Chrome com WebGL por
// software (SwiftShader) e medições comuns da página. O Chrome vem de CHROME_PATH
// (padrão: /usr/bin/google-chrome-stable).
import { chromium } from 'playwright-core';
import { preview } from 'vite';

export const ROOT = new URL('..', import.meta.url).pathname;
const CHROME = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
const GL_ARGS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
];

/** Sobe o `vite preview` de uma pasta de build (porta livre) e devolve a URL. */
export async function startServer(outDir = 'dist') {
  const server = await preview({
    root: ROOT,
    logLevel: 'silent',
    build: { outDir },
    preview: { host: '127.0.0.1', port: 0 },
  });
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

export const launch = (args = []) =>
  chromium.launch({ executablePath: CHROME, args: [...GL_ARGS, ...args] });

// O SwiftShader não tem a extensão de compilação paralela; o aviso do three é esperado nos testes.
const EXPECTED_CONSOLE = [/KHR_parallel_shader_compile/];

/**
 * Abre a página e registra erros de script, mensagens do console (página e worker) e violações da CSP.
 * @returns {Promise<{ page: import('playwright-core').Page, context: import('playwright-core').BrowserContext, problems: string[], requests: string[] }>}
 */
export async function openPage(
  browser,
  url,
  contextOptions = {},
  { waitFor = 'ready', setup } = {},
) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...contextOptions,
  });
  const page = await context.newPage();
  const problems = [];
  const requests = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    const text = m.text();
    if (['error', 'warning'].includes(m.type()) && !EXPECTED_CONSOLE.some((re) => re.test(text))) {
      problems.push(`console.${m.type()}: ${text}`);
    }
  });
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(() => {
    addEventListener('securitypolicyviolation', (e) => {
      (window.__csp ??= []).push(`${e.violatedDirective} ${e.blockedURI}`);
    });
  });
  await setup?.({ context, page });
  if (waitFor === 'ready') {
    await page.goto(url);
    await page.waitForSelector('.stage.ready', { timeout: 60_000 });
  } else if (waitFor === 'settled') {
    await page.goto(url);
    await page.waitForSelector('.stage.ready, .stage.no-gl', { timeout: 60_000 });
  }
  return { page, context, problems, requests };
}

/** scrollY em que a história chega ao progresso `p` (mesma conta da página). */
export const yAtProgress = (page, p) =>
  page.evaluate((p) => {
    const story = document.querySelector('.story');
    const stage = document.querySelector('#stage');
    return (
      story.getBoundingClientRect().top + scrollY + p * (story.offsetHeight - stage.offsetHeight)
    );
  }, p);

/** Rola até o progresso `p` e espera o cartão do capítulo certo ficar ativo e parado no lugar. */
export async function scrollToProgress(page, p) {
  const y = await yAtProgress(page, p);
  await page.evaluate((y) => scrollTo(0, y), y);
  const chapter = Math.round(p * 4);
  await page.waitForFunction(
    (i) => {
      const card = document.querySelectorAll('.card')[i];
      if (!card?.classList.contains('on')) return false;
      const style = getComputedStyle(card);
      return style.transform === 'none' && Number(style.opacity) === 1; // transição de entrada terminou
    },
    chapter,
    { timeout: 10_000 },
  );
}

export const tourState = (page) =>
  page.evaluate(() => document.querySelector('.story').dataset.tour);
