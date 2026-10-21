import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { optimize } from 'svgo';
import { defineConfig, loadEnv } from 'vite';
import { readContent } from './build/content.js';
import { contentSecurityPolicy } from './build/csp.js';
import { robotsTxt, sitemapXml } from './build/files.js';
import { sharedThree } from './build/three-compartilhado.js';
import { renderPage } from './build/render.js';
import { assertValidSite } from './build/validate.js';
import { createSiteConfig } from './site.config.js';

/**
 * Escreve os dados da empresa (de content/, validados) no HTML: links do WhatsApp, rodapé, JSON-LD e,
 * em modo demo, o noindex. A lógica está em build/render.js. No servidor de desenvolvimento o conteúdo é
 * relido a cada página (`reload`), e mexer em content/ recarrega o navegador.
 */
function siteDataPlugin(site, { reload, contentDir } = {}) {
  return {
    name: 'vanpack:site-data',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => renderPage(html, reload ? reload() : site),
    },
    configureServer(server) {
      if (!contentDir) return;
      server.watcher.add(contentDir);
      server.watcher.on('change', (file) => {
        if (file.startsWith(contentDir)) server.ws.send({ type: 'full-reload' });
      });
    },
  };
}

/**
 * Os logos dos clientes (content/clientes/*.svg) saem em clientes/<arquivo>, otimizados pelo svgo (o
 * desenho é o mesmo, o arquivo fica menor). Só os que content/clientes.yaml usa. No desenvolvimento o
 * arquivo é servido como está.
 */
function clientLogosPlugin(site, contentDir) {
  const logos = [...new Set(site.clients.map((client) => client.logo).filter(Boolean))];
  return {
    name: 'vanpack:clientes',
    generateBundle() {
      for (const logo of logos) {
        const source = readFileSync(join(contentDir, 'clientes', logo), 'utf8');
        const { data } = optimize(source, { multipass: true, plugins: ['preset-default'] });
        this.emitFile({ type: 'asset', fileName: `clientes/${logo}`, source: data });
      }
    },
    configureServer(server) {
      server.middlewares.use('/clientes', (req, res, next) => {
        const file = join(
          contentDir,
          'clientes',
          basename(decodeURIComponent(req.url.split('?')[0])),
        );
        if (!file.endsWith('.svg') || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end(readFileSync(file));
      });
    },
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

export default defineConfig(({ mode, command }) => {
  const root = process.cwd();
  // O conteúdo editável vive em content/ (lido e validado aqui, no build); o .env guarda só o que muda
  // por ambiente (modo, URL do site, medição). O Vite não copia o .env para o process.env, então o
  // loadEnv é a única forma de lê-lo; as variáveis do processo (VITE_*) vencem o arquivo.
  // VANPACK_CONTENT aponta para outra pasta de conteúdo (os testes usam, para exercitar o production).
  const env = loadEnv(mode, root, 'VITE_');
  const contentDir = process.env.VANPACK_CONTENT ?? `${root}/content`;
  const loadSite = () => {
    const { content, errors: contentErrors } = readContent(contentDir);
    const site = createSiteConfig({ env, content });
    return { site, warnings: assertValidSite({ site, content, contentErrors, root, contentDir }) };
  };
  const { site, warnings } = loadSite();
  for (const warning of warnings) console.warn(`[vanpack] ${warning}`);
  const three = sharedThree();
  return {
    base: './',
    plugins: [
      ...three.plugins,
      siteDataPlugin(
        site,
        command === 'serve' ? { reload: () => loadSite().site, contentDir } : {},
      ),
      clientLogosPlugin(site, contentDir),
      siteFilesPlugin(site),
      cspPlugin(site),
    ],
    // o que a medição precisa saber no navegador (host da página publicada, servidor e site do Umami)
    define: { __SITE__: JSON.stringify(site.client) },
    // o three.js sai num arquivo só, importado pelos workers e pelo render de reserva
    // (build/three-compartilhado.js)
    worker: { format: 'es', plugins: three.workerPlugins },
    build: {
      // duas páginas: a principal e a política de privacidade (que também recebe os dados do .env)
      rolldownOptions: {
        input: { index: 'index.html', privacidade: 'politica-de-privacidade.html' },
      },
      modulePreload: { polyfill: false },
      // O three.js fica no seu próprio arquivo (~520 kB, ~130 kB gzip), de propósito.
      chunkSizeWarningLimit: 700,
    },
  };
});
