import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { optimize } from 'svgo';
import { defineConfig, loadEnv } from 'vite';
import { createSiteConfig } from './site.config.js';
import { readContent } from './tools/build/content.js';
import { contentSecurityPolicy } from './tools/build/csp.js';
import { robotsTxt, sitemapXml } from './tools/build/files.js';
import { renderPage } from './tools/build/render.js';
import { sharedThree } from './tools/build/shared-three.js';
import { SiteConfigError, assertValidSite } from './tools/build/validate.js';

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

function clientLogosPlugin(site, contentDir) {
  const logos = [...new Set(site.clients.map((client) => client.logo).filter(Boolean))];
  return {
    name: 'vanpack:client-logos',
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
          basename(decodeURIComponent((req.url ?? '').split('?')[0])),
        );
        if (!file.endsWith('.svg') || !existsSync(file)) return next();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end(readFileSync(file));
      });
    },
  };
}

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
 * Inlines emitted CSS bundles into `<style>` tags during production builds so every page
 * ships with zero render-blocking CSS requests while authoring stays modular under `src/styles/`.
 * Runs right before CSP hash generation.
 */
function inlineCssAndCspPlugin(site) {
  return {
    name: 'vanpack:inline-css-and-csp',
    apply: 'build',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const cssFiles = new Map();
        for (const [fileName, asset] of Object.entries(bundle)) {
          if (asset.type === 'asset' && fileName.endsWith('.css')) {
            cssFiles.set(fileName, String(asset.source));
          }
        }

        const inlined = new Set();
        const pages = Object.values(bundle).filter(
          (file) => file.type === 'asset' && file.fileName.endsWith('.html'),
        );
        if (!pages.some((page) => page.fileName === 'index.html')) {
          this.error('index.html não encontrado para aplicar a CSP.');
        }

        for (const page of pages) {
          let html = String(page.source);
          html = html.replace(
            /<link\s+[^>]*rel="stylesheet"[^>]*href="\.?\/?([^"]+\.css)"[^>]*\/?>/gi,
            (tag, href) => {
              const clean = href.replace(/^\.?\//, '');
              const css = cssFiles.get(clean);
              if (css === undefined) return tag;
              inlined.add(clean);
              return `<style>${css}</style>`;
            },
          );

          const styleHashes = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(
            ([, css]) => `'sha256-${createHash('sha256').update(css).digest('base64')}'`,
          );
          const policy = contentSecurityPolicy({ styleHashes, site });
          html = html.replace(
            /<meta charset="utf-8"\s*\/?>/i,
            (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
          );
          page.source = html;
        }

        for (const fileName of inlined) {
          delete bundle[fileName];
        }
      },
    },
  };
}

export default defineConfig(({ mode, command }) => {
  const root = process.cwd();
  const env = loadEnv(mode, root, 'VITE_');
  const contentDir = process.env.VANPACK_CONTENT ?? join(root, 'content');

  const loadSite = () => {
    const { content, errors: contentErrors } = readContent(contentDir);
    const site = createSiteConfig({ env, content });
    return { site, warnings: assertValidSite({ site, content, contentErrors, root, contentDir }) };
  };

  let loaded;
  try {
    loaded = loadSite();
  } catch (error) {
    if (!(error instanceof SiteConfigError)) throw error;
    console.error(`\n${error.message}\n`);
    process.exit(1);
  }

  const { site, warnings } = loaded;
  for (const warning of warnings) console.warn(`[vanpack] ${warning}`);
  const three = sharedThree();

  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      ...three.plugins,
      siteDataPlugin(
        site,
        command === 'serve' ? { reload: () => loadSite().site, contentDir } : {},
      ),
      clientLogosPlugin(site, contentDir),
      siteFilesPlugin(site),
      inlineCssAndCspPlugin(site),
    ],
    define: { __SITE__: JSON.stringify(site.client) },
    worker: { format: 'es', plugins: three.workerPlugins },
    build: {
      rolldownOptions: {
        input: {
          index: 'index.html',
          privacidade: 'politica-de-privacidade.html',
          naoEncontrada: '404.html',
        },
      },
      modulePreload: { polyfill: false },
    },
  };
});
