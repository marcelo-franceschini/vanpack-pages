import { createHash } from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';
import { siteConfig } from './site.config.js';

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Valores do rodapé vindos de site.config.js; vazio = sem dado (o elemento sai do HTML). */
function footerFields() {
  const { address, slogan, hours, cnpj, mapUrl } = siteConfig;
  const place = address.street
    ? [
        address.street,
        `${address.city}-${address.state}`,
        address.postalCode && `CEP ${address.postalCode}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  return {
    slogan: slogan && escapeHtml(slogan),
    endereco: place && escapeHtml(place),
    horario: hours && escapeHtml(hours),
    cnpj: cnpj && escapeHtml(cnpj),
    mapa:
      mapUrl && `<a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener">Ver no mapa</a>`,
  };
}

// <tag … data-field="nome" …>miolo</tag>; o miolo nunca repete a tag (sem aninhamento).
const FIELD = /<(\w+)([^>]*?)\sdata-field="([a-z]+)"([^>]*)>([\s\S]*?)<\/\1>\s*/g;

/**
 * Escreve os links do WhatsApp e dados institucionais no HTML:
 * - `data-wa="mensagem"` vira `href="https://wa.me/<número>?text=…"`;
 * - Minifica o JSON-LD e acrescenta telefone/cnpj quando existirem;
 * - Preenche os elementos `data-field` (slogan, endereco, horario, cnpj, mapa) com os valores de
 *   site.config.js e remove do HTML os que não têm dado: nada é inventado nem fica vazio na página.
 */
function siteDataPlugin(rawPhone = '') {
  const phone = (rawPhone || siteConfig.whatsapp || '').replace(/\D/g, '');
  if (phone && !/^55\d{10,11}$/.test(phone)) {
    throw new Error(
      `VITE_WHATSAPP inválido ("${rawPhone}"): use 55 + DDD + número, ex.: 5511912345678.`,
    );
  }
  return {
    name: 'vanpack:site-data',
    transformIndexHtml: {
      order: 'post',
      handler: (html) => {
        let result = html;
        result = result.replace(
          /data-wa="([^"]*)"/g,
          (_, text) =>
            `href="https://wa.me/${phone}?text=${encodeURIComponent(decodeEntities(text))}" target="_blank" rel="noopener"`,
        );

        result = result.replace(
          /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
          (_, open, json, close) => {
            const data = JSON.parse(json);
            if (phone) data.telephone = `+${phone}`;
            if (siteConfig.cnpj) data.taxID = siteConfig.cnpj;
            if (siteConfig.email) data.email = siteConfig.email;
            return open + JSON.stringify(data) + close;
          },
        );

        const fields = footerFields();
        result = result.replace(FIELD, (_, tag, before, name, after, inner) => {
          const value = fields[name];
          if (!value) return '';
          const attrs = `${before}${after}`.replace(/\shidden(?=\s|$)/g, '');
          const body = name === 'slogan' ? value : inner.replace('<dd></dd>', `<dd>${value}</dd>`);
          return `<${tag}${attrs}>${body}</${tag}>\n`;
        });
        result = result.replace(/<dl class="foot-info">\s*<\/dl>\s*/, '');

        return result;
      },
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
  const env = loadEnv(mode, process.cwd());
  return {
    base: './',
    plugins: [siteDataPlugin(env.VITE_WHATSAPP), contentSecurityPolicy()],
    worker: { format: 'es' },
    build: {
      modulePreload: { polyfill: false },
      // O three.js vai inteiro no chunk do worker (~570 kB, ~150 kB gzip), de propósito.
      chunkSizeWarningLimit: 700,
    },
  };
});
