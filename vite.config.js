import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { parseEnv } from './build/env.js';
import { contentSecurityPolicy } from './build/csp.js';
import { robotsTxt, sitemapXml } from './build/files.js';
import { renderPage } from './build/render.js';
import { assertValidSite } from './build/validate.js';
import { createSiteConfig } from './site.config.js';

/**
 * Escreve os dados da empresa (vindos do `.env` pela site.config.js) no HTML: links do WhatsApp,
 * rodapé, JSON-LD e, em modo demo, o noindex. A lógica está em build/render.js.
 */
function siteDataPlugin(site) {
  return {
    name: 'vanpack:site-data',
    transformIndexHtml: { order: 'post', handler: (html) => renderPage(html, site) },
  };
}

/** robots.txt e sitemap.xml saem da URL do site (em demo o robots bloqueia tudo). */
function siteFilesPlugin(site) {
  return {
    name: 'vanpack:site-files',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robotsTxt(site) });
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(site) });
    },
  };
}

/**
 * CSP via <meta> em cada página (o GitHub Pages não permite cabeçalhos), só no build: o servidor de
 * dev injeta scripts. Roda sobre o HTML final, porque o Vite ainda reescreve URLs dentro dos <style>
 * depois dos hooks de transformIndexHtml, e o hash precisa bater com o conteúdo publicado.
 */
function cspPlugin(site) {
  return {
    name: 'vanpack:csp',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const pages = Object.values(bundle).filter(
          (file) => file.type === 'asset' && file.fileName.endsWith('.html'),
        );
        if (!pages.some((page) => page.fileName === 'index.html')) {
          this.error('index.html não encontrado para aplicar a CSP.');
        }
        for (const page of pages) {
          const html = String(page.source);
          const styleHashes = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
            ([, css]) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`,
          );
          const policy = contentSecurityPolicy({ styleHashes, site });
          page.source = html.replace(
            /<meta charset="utf-8"\s*\/?>/i,
            (m) => `${m}\n<meta http-equiv="Content-Security-Policy" content="${policy}">`,
          );
        }
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  // O `.env` é a fonte única dos dados da empresa. O Vite não o copia para o process.env, então o
  // loadEnv é a única forma de lê-lo; as variáveis do processo (VITE_*) vencem o arquivo.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const site = createSiteConfig(env);
  const example = parseEnv(readFileSync(`${process.cwd()}/.env.example`, 'utf8'));
  for (const warning of assertValidSite({ site, env, example }))
    console.warn(`[vanpack] ${warning}`);
  return {
    base: './',
    plugins: [siteDataPlugin(site), siteFilesPlugin(site), cspPlugin(site)],
    // o que a medição precisa saber no navegador (host da página publicada, servidor e site do Umami)
    define: { __SITE__: JSON.stringify(site.client) },
    worker: { format: 'es' },
    build: {
      // duas páginas: a principal e a política de privacidade (que também recebe os dados do .env)
      rolldownOptions: {
        input: { index: 'index.html', privacidade: 'politica-de-privacidade.html' },
      },
      modulePreload: { polyfill: false },
      // O three.js vai inteiro no chunk do worker (~570 kB, ~150 kB gzip), de propósito.
      chunkSizeWarningLimit: 700,
    },
  };
});
