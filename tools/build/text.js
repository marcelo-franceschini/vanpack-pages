import { RICH_VARS } from '../../site.config.js';

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes HTML special characters for safe interpolation into markup and attributes. */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ENTITIES[ch]);
}

/** Returns a normalized HTTPS URL string, or empty string for any non-HTTPS/invalid URL. */
export function safeHttpsUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

/** Builds a `wa.me` deep link with an optional `[site-<tag>]` attribution suffix. */
export function whatsappUrl(number, message, tag = '') {
  const clean = String(number ?? '').replace(/\D/g, '');
  if (!clean) return '#orcamento';
  const base = String(message ?? '').trim();
  const cleanTag = String(tag ?? '').trim();
  const suffix = cleanTag ? `[site-${cleanTag}]` : '';
  let text = base;
  if (suffix && !text.endsWith(suffix)) {
    text = text ? `${text} ${suffix}` : suffix;
  }
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

/**
 * Resolves `{{#se var1 var2}}...{{/se}}` blocks and `{{var}}` placeholders against `vars`.
 * When `rich` is true, variables listed in `RICH_VARS` are emitted unescaped (e.g. `<span>`).
 */
export function expandTemplate(input, vars = {}, { escape = true, rich = false } = {}) {
  let result = String(input ?? '');

  // Resolve conditional blocks (innermost first to support nesting cleanly)
  const condRe = /\{\{#se\s+([^}]+)\}\}([\s\S]*?)\{\{\/se\}\}/g;
  let prev;
  do {
    prev = result;
    result = result.replace(condRe, (_, names, body) => {
      const keys = names.trim().split(/\s+/);
      const allTruthy = keys.every((key) => Boolean(String(vars[key] ?? '').trim()));
      return allTruthy ? body : '';
    });
  } while (result !== prev);

  return result.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in vars)) return match;
    const raw = String(vars[key] ?? '');
    if (rich && RICH_VARS.has(key)) return raw;
    return escape ? escapeHtml(raw) : raw;
  });
}

function renderInlineMarkdown(line, site) {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  let out = '';
  let lastIndex = 0;

  for (const match of line.matchAll(linkRe)) {
    const [full, label, target] = match;
    const index = match.index ?? 0;
    out += escapeHtml(line.slice(lastIndex, index));

    const cleanTarget = target.trim();
    const safeLabel = escapeHtml(label);

    if (cleanTarget.startsWith('wa:')) {
      const key = cleanTarget.slice(3).trim();
      const rawMsg = site.content?.whatsapp?.mensagens?.[key] ?? '';
      const expandedMsg = expandTemplate(rawMsg, site.vars, { escape: false, rich: false });
      const href = whatsappUrl(site.whatsapp, expandedMsg, key);
      out += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
    } else if (cleanTarget.startsWith('tel:')) {
      const tel = cleanTarget.slice(4).replace(/[^+\d]/g, '');
      out += tel ? `<a href="tel:${escapeHtml(tel)}">${safeLabel}</a>` : safeLabel;
    } else {
      const https = safeHttpsUrl(cleanTarget);
      out += https
        ? `<a href="${escapeHtml(https)}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`
        : safeLabel;
    }

    lastIndex = index + full.length;
  }

  out += escapeHtml(line.slice(lastIndex));
  return out;
}

/** Converts the simple Markdown privacy policy into clean semantic HTML. */
export function markdownToHtml(markdown, site) {
  const expanded = expandTemplate(markdown, site.vars, { escape: false, rich: false });
  const blocks = expanded
    .split(/\r?\n\s*\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => {
      const heading = /^(#{1,3})\s+(.+)$/.exec(block);
      if (heading) {
        const level = heading[1].length;
        return `<h${level}>${renderInlineMarkdown(heading[2].trim(), site)}</h${level}>`;
      }
      const joined = block.replace(/\r?\n/g, ' ').trim();
      return `<p>${renderInlineMarkdown(joined, site)}</p>`;
    })
    .join('\n');
}
