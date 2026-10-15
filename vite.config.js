import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig, loadEnv } from 'vite';
import { parseEnv } from './build/env.js';
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
 * CSP via <meta> (o GitHub Pages não permite cabeçalhos), só no build: o servidor de dev injeta
 * scripts. Roda sobre o index.html final, porque o Vite ainda reescreve URLs dentro dos <style>
 * depois dos hooks de transformIndexHtml, e o hash precisa bater com o conteúdo publicado.
 */
function contentSecurityPolicy() {
  return {
    name: 'vanpack:csp',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const page = bundle['index.html'];
        if (page?.type !== 'asset') this.error('index.html não encontrado para aplicar a CSP.');
        const html = String(page.source);
        const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
          ([, css]) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`,
        );
        const policy = [
          "default-src 'self'",
          "script-src 'self'",
          `style-src 'self' ${styles.join(' ')}`,
          "img-src 'self' data:",
          "font-src 'self'",
          "worker-src 'self'",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join('; ');
        page.source = html.replace(
          /<meta charset="utf-8"\s*\/?>/i,
          (m) => `${m}\n<meta http-equiv="Content-Security-Policy" content="${policy}">`,
        );
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
    plugins: [siteDataPlugin(site), siteFilesPlugin(site), contentSecurityPolicy()],
    worker: { format: 'es' },
    build: {
      modulePreload: { polyfill: false },
      // O three.js vai inteiro no chunk do worker (~570 kB, ~150 kB gzip), de propósito.
      chunkSizeWarningLimit: 700,
    },
  };
});
