import { createHash } from 'node:crypto';
import { defineConfig, loadEnv } from 'vite';

const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

/**
 * Escreve os links do WhatsApp no HTML: `data-wa="mensagem"` vira `href="https://wa.me/<número>?text=…"`,
 * então os botões funcionam sem JS e o número fica só no `.env` (VITE_WHATSAPP).
 * Também minifica o JSON-LD e acrescenta o telefone quando houver número.
 */
function whatsapp(rawPhone = '') {
  const phone = rawPhone.replace(/\D/g, '');
  if (phone && !/^55\d{10,11}$/.test(phone)) {
    throw new Error(
      `VITE_WHATSAPP inválido ("${rawPhone}"): use 55 + DDD + número, ex.: 5511912345678.`,
    );
  }
  return {
    name: 'vanpack:whatsapp',
    transformIndexHtml: {
      order: 'post',
      handler: (html) =>
        html
          .replace(
            /data-wa="([^"]*)"/g,
            (_, text) =>
              `href="https://wa.me/${phone}?text=${encodeURIComponent(decodeEntities(text))}" target="_blank" rel="noopener"`,
          )
          .replace(
            /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,
            (_, open, json, close) => {
              const data = JSON.parse(json);
              if (phone) data.telephone = `+${phone}`;
              return open + JSON.stringify(data) + close;
            },
          ),
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
    plugins: [whatsapp(env.VITE_WHATSAPP), contentSecurityPolicy()],
    worker: { format: 'es' },
    build: {
      modulePreload: { polyfill: false },
      // O three.js vai inteiro no chunk do worker (~570 kB, ~150 kB gzip), de propósito.
      chunkSizeWarningLimit: 700,
    },
  };
});
