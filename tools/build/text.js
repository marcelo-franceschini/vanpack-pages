import { RICH_VARS } from '../../site.config.js';

/** Escapes HTML special characters for safe interpolation in text nodes and attributes. */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Strips HTML tags from a string (used when rich vars appear in plain-text/attribute contexts). */
export function stripTags(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}

/**
 * Builds a `https://wa.me/...` link with an optional `[site-<code>]` attribution suffix
 * appended at most once. Returns `#orcamento` when no WhatsApp number is configured.
 */
export function whatsappUrl(whatsapp, message, ctaCode) {
  const digits = String(whatsapp ?? '').replace(/\D/g, '');
  if (!digits) return '#orcamento';
  const code = String(ctaCode ?? '').trim();
  const tag = code ? `[site-${code}]` : '';
  let body = String(message ?? '').trim();
  if (tag && !body.includes(tag)) {
    body = body ? `${body} ${tag}` : tag;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
}

/** Resolves a dot-separated path (supporting numeric array indices) against an object. */
export function resolvePath(obj, path) {
  let cur = obj;
  for (const part of String(path).split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Expands `{{#se var1 var2}}...{{/se}}` blocks and `{{var}}` placeholders against `vars`.
 * When `rich` is true, variables listed in `RICH_VARS` keep their markup (`<span ...>`).
 */
export function expandTemplate(template, vars, { rich = false } = {}) {
  let out = String(template ?? '');
  const conditionalRe = /\{\{#se\s+([^}]+)\}\}([\s\S]*?)\{\{\/se\}\}/g;
  let prev;
  do {
    prev = out;
    out = out.replace(conditionalRe, (_, keys, body) => {
      const names = keys.trim().split(/\s+/);
      const ok = names.every((name) => Boolean(vars[name]));
      return ok ? body : '';
    });
  } while (out !== prev);

  return out.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const raw = vars[key];
    if (RICH_VARS.has(key)) {
      return rich ? String(raw ?? '') : escapeHtml(stripTags(raw));
    }
    return escapeHtml(raw);
  });
}

function renderInlineMarkdown(line, site) {
  const tokens = [];
  const withPlaceholders = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const idx = tokens.length;
    const safeLabel = escapeHtml(label);
    const trimmedHref = href.trim();
    if (trimmedHref.startsWith('wa:')) {
      const key = trimmedHref.slice(3).trim();
      const rawMsg = site.content?.whatsapp?.mensagens?.[key] ?? '';
      const msg = expandTemplate(rawMsg, site.vars, { rich: false });
      const url = whatsappUrl(site.whatsapp, msg, key);
      tokens.push(
        `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" data-cta="${escapeHtml(key)}">${safeLabel}</a>`,
      );
    } else if (trimmedHref.startsWith('tel:')) {
      tokens.push(`<a href="${escapeHtml(trimmedHref)}" data-contact="phone">${safeLabel}</a>`);
    } else if (/^(https?:\/\/|\/|\.\/|#)/.test(trimmedHref)) {
      const external = /^https?:\/\//.test(trimmedHref);
      const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : '';
      tokens.push(`<a href="${escapeHtml(trimmedHref)}"${attrs}>${safeLabel}</a>`);
    } else {
      tokens.push(safeLabel);
    }
    return `%%LINK_${idx}%%`;
  });

  return escapeHtml(withPlaceholders).replace(/%%LINK_(\d+)%%/g, (_, idx) => tokens[Number(idx)]);
}

/** Converts simple Markdown (headings, paragraphs, and `wa:`/`tel:`/standard links) into HTML. */
export function renderMarkdown(markdown, site) {
  const expanded = expandTemplate(markdown, site.vars, { rich: false });
  const blocks = expanded
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const heading = /^(#{1,3})\s+([\s\S]+)$/.exec(block);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${renderInlineMarkdown(heading[2].trim(), site)}</h${level}>`;
      }
      return `<p>${renderInlineMarkdown(block.replace(/\n+/g, ' '), site)}</p>`;
    })
    .join('\n');
}
