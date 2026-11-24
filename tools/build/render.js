import { visibleClients, visibleProofs } from '../../site.config.js';
import { escapeHtml, expandTemplate, markdownToHtml, safeHttpsUrl, whatsappUrl } from './text.js';

function normalizeBaseUrl(siteUrl) {
  const raw = String(siteUrl ?? '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Looks up a dotted path in `site.content` or a top-level variable in `site.vars`. */
function lookupToken(path, site) {
  if (path in site.vars) {
    return { found: true, value: site.vars[path], isVar: true };
  }
  const parts = path.split('.');
  let current = site.content;
  for (const part of parts) {
    if (current == null || typeof current !== 'object' || !(part in current)) {
      return { found: false, value: '', isVar: false };
    }
    current = current[part];
  }
  return { found: true, value: String(current ?? ''), isVar: false };
}

/** Finds the end index (exclusive) of the matching closing tag for an opening tag at `start`. */
function findElementEnd(html, tagName, openEnd) {
  const tokenRe = new RegExp(`<(\\/?)${tagName}(?=[\\s/>])[^>]*>`, 'gi');
  tokenRe.lastIndex = openEnd;
  let depth = 1;
  let match;
  while ((match = tokenRe.exec(html)) !== null) {
    const isClosing = match[1] === '/';
    const isSelfClosing = match[0].endsWith('/>');
    if (isClosing) {
      depth -= 1;
      if (depth === 0) return tokenRe.lastIndex;
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }
  return openEnd;
}

/** Evaluates and resolves `data-need="var"` / `data-need="!var"` conditional elements. */
function applyDataNeed(html, vars) {
  const attrRe = /<([a-z][a-z0-9-]*)\b([^>]*?)\sdata-need="([^"]+)"([^>]*)>/i;
  let out = html;
  let match;

  while ((match = attrRe.exec(out)) !== null) {
    const [fullTag, tagName, before, expr, after] = match;
    const negated = expr.startsWith('!');
    const key = negated ? expr.slice(1) : expr;
    const hasValue = Boolean(String(vars[key] ?? '').trim());
    const keep = negated ? !hasValue : hasValue;
    const openStart = match.index;
    const openEnd = openStart + fullTag.length;

    if (keep) {
      const cleanTag = `<${tagName}${before}${after}>`;
      out = out.slice(0, openStart) + cleanTag + out.slice(openEnd);
    } else {
      const closeEnd = fullTag.endsWith('/>') ? openEnd : findElementEnd(out, tagName, openEnd);
      const beforeSlice = out.slice(0, openStart).replace(/[ \t]+$/, '');
      const afterSlice = out.slice(closeEnd);
      out = beforeSlice + afterSlice;
    }
  }

  return out;
}

function buildFieldContent(field, site) {
  const rodape = site.content?.rodape ?? {};
  switch (field) {
    case 'endereco': {
      const { street, district, postalCode } = site.address;
      const lines = [];
      if (street) lines.push(escapeHtml(street));
      if (district) lines.push(escapeHtml(district));
      if (site.cityState) lines.push(escapeHtml(site.cityState));
      if (postalCode) {
        const cepLabel = rodape.rotulos?.cep ?? 'CEP';
        lines.push(`${escapeHtml(cepLabel)} ${escapeHtml(postalCode)}`);
      }
      return lines.join('<br />');
    }
    case 'horario':
      return site.hours ? escapeHtml(site.hours) : '';
    case 'telefone':
      return site.phone
        ? `<a href="tel:${escapeHtml(site.phone)}" data-contact="phone">${escapeHtml(site.phoneDisplay)}</a>`
        : '';
    case 'mapa': {
      const safe = safeHttpsUrl(site.mapUrl);
      if (!safe) return '';
      const label = rodape.ver_mapa ?? 'Ver no mapa';
      return `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer" data-contact="map">${escapeHtml(label)}</a>`;
    }
    case 'cnpj':
      return site.cnpj ? escapeHtml(site.cnpj) : '';
    default:
      return '';
  }
}

/** Populates `[data-field="..."]` elements in the footer and mobile bar, removing empty ones. */
function applyDataFields(html, site) {
  const fieldRe = /<([a-z][a-z0-9-]*)\b([^>]*?)\sdata-field="([^"]+)"([^>]*)>/i;
  let out = html;
  let match;

  while ((match = fieldRe.exec(out)) !== null) {
    const [fullTag, tagName, before, fieldName, after] = match;
    const openStart = match.index;
    const openEnd = openStart + fullTag.length;
    const closeEnd = findElementEnd(out, tagName, openEnd);
    const closeTagLen = `</${tagName}>`.length;
    const inner = out.slice(openEnd, closeEnd - closeTagLen);
    const valueHtml = buildFieldContent(fieldName, site);

    if (!valueHtml) {
      out = out.slice(0, openStart) + out.slice(closeEnd);
      continue;
    }

    const attrs = `${before}${after}`.replace(/\s+hidden(?==|\s|$)(?:="[^"]*")?/i, '');
    const nextInner = /<dd><\/dd>/i.test(inner)
      ? inner.replace(/<dd><\/dd>/i, `<dd>${valueHtml}</dd>`)
      : valueHtml;

    out = `${out.slice(0, openStart)}<${tagName}${attrs}>${nextInner}</${tagName}>${out.slice(closeEnd)}`;
  }

  return out;
}

/** Replaces `{{...}}` tokens safely across both HTML attributes and text content. */
function applyTokens(html, site) {
  // Split HTML into tags and text segments so attributes never receive rich <span> tags
  return html.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) {
      return tag.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
        const hit = lookupToken(path, site);
        if (!hit.found) return match;
        const expanded = hit.isVar
          ? String(hit.value ?? '')
          : expandTemplate(hit.value, site.vars, { escape: false, rich: false });
        // Strip any HTML wrapper if a rich var was referenced inside an attribute
        const plain = expanded.replace(/<[^>]+>/g, '');
        return escapeHtml(plain);
      });
    }
    return text.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (match, path) => {
      const hit = lookupToken(path, site);
      if (!hit.found) return match;
      if (hit.isVar) {
        return expandTemplate(`{{${path}}}`, site.vars, { escape: true, rich: true });
      }
      return expandTemplate(hit.value, site.vars, { escape: true, rich: true });
    });
  });
}

/** Converts `data-wa="..."` attributes into full `wa.me` links with `[site-<cta>]` tags. */
function applyWhatsAppLinks(html, site) {
  return html.replace(/<a\b([^>]*?)\sdata-wa="([^"]*)"([^>]*)>/gi, (_, before, rawMsg, after) => {
    const combined = `${before}${after}`;
    const ctaMatch = /\bdata-cta="([^"]+)"/i.exec(combined);
    const cta = ctaMatch ? ctaMatch[1] : '';
    const decodedMsg = rawMsg
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
    const href = whatsappUrl(site.whatsapp, decodedMsg, cta);
    const extra = href.startsWith('https://')
      ? ` href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`
      : ` href="${escapeHtml(href)}"`;
    return `<a${before}${after}${extra}>`;
  });
}

function renderProducts(site) {
  const buttonLabel = escapeHtml(site.content?.produtos?.botao ?? 'Pedir orçamento');
  return site.products
    .map((item) => {
      const id = escapeHtml(item.id);
      const piece = escapeHtml(item.peca ?? item.nome);
      const name = escapeHtml(item.nome);
      const desc = escapeHtml(item.texto);
      const specs = Array.isArray(item.especificacoes) ? item.especificacoes : [];
      const specsHtml = specs.length
        ? `\n  <p class="model-specs">${specs
            .map((spec) => `<span>${escapeHtml(spec)}</span>`)
            .join('<span class="sep" aria-hidden="true">·</span>')}</p>`
        : '';
      const msg = expandTemplate(item.mensagem ?? '', site.vars, { escape: false, rich: false });
      const cta = `produto-${item.id}`;
      const href = whatsappUrl(site.whatsapp, msg, cta);
      const linkAttrs = href.startsWith('https://')
        ? `href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`
        : `href="${escapeHtml(href)}"`;

      return [
        '<article class="model">',
        `  <div class="model-3d" data-model="${id}" data-modelo="${id}" data-piece="${piece}" data-peca="${piece}">`,
        '    <span class="model-hint" aria-hidden="true">Arraste para girar</span>',
        '  </div>',
        `  <h3>${name}</h3>`,
        `  <p class="model-desc">${desc}</p>${specsHtml}`,
        `  <a class="btn" data-cta="${escapeHtml(cta)}" ${linkAttrs}>`,
        `    <svg aria-hidden="true"><use href="#i-wa" /></svg>${buttonLabel}`,
        '  </a>',
        '</article>',
      ].join('\n');
    })
    .join('\n');
}

function renderDifferentials(site) {
  return site.differentials
    .map((item) =>
      [
        '<article class="pillar">',
        `  <svg aria-hidden="true"><use href="#i-${escapeHtml(item.icon)}" /></svg>`,
        `  <h3>${escapeHtml(item.title)}</h3>`,
        `  <p>${escapeHtml(item.text)}</p>`,
        '</article>',
      ].join('\n'),
    )
    .join('\n');
}

function renderClients(site) {
  const shownClients = visibleClients(site.clients, site.dataMode);
  const shownProofs = visibleProofs(site.proofs);
  const parts = [];

  if (shownClients.length) {
    const items = shownClients
      .map((client) => {
        const alt = escapeHtml(client.alt || client.name);
        if (client.logo) {
          return `      <li class="cliente"><img src="./clientes/${escapeHtml(client.logo)}" alt="${alt}" loading="lazy" decoding="async" /></li>`;
        }
        return `      <li class="cliente"><span class="logo-name">${escapeHtml(client.name)}</span></li>`;
      })
      .join('\n');

    parts.push(
      [
        '<div class="carrossel" data-carousel>',
        '  <section class="carrossel-janela" aria-label="Clientes" tabindex="0">',
        '    <ul class="carrossel-trilho">',
        items,
        '    </ul>',
        '  </section>',
        '</div>',
      ].join('\n'),
    );
  }

  if (shownProofs.testimonials.length) {
    const figures = shownProofs.testimonials
      .map((item) =>
        [
          '  <figure class="proof">',
          `    <blockquote class="proof-quote">“${escapeHtml(item.quote)}”</blockquote>`,
          `    <figcaption>${escapeHtml(item.author)}</figcaption>`,
          '  </figure>',
        ].join('\n'),
      )
      .join('\n');
    parts.push(`<div class="proofs">\n${figures}\n</div>`);
  }

  if (shownProofs.googleRating) {
    const rating = shownProofs.googleRating;
    const textos = site.content?.provas?.textos ?? {};
    const score = String(rating.value).replace('.', ',');
    const noteText = textos.nota ?? 'de 5 no Google';
    const reviewsText = textos.avaliacoes ?? 'avaliações';
    const label = `${escapeHtml(score)} ${escapeHtml(noteText)} (${escapeHtml(rating.count)} ${escapeHtml(reviewsText)})`;
    const safeUrl = safeHttpsUrl(rating.url);
    const inner = safeUrl
      ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
    parts.push(`<p class="rating">${inner}</p>`);
  }

  return parts.join('\n');
}

function renderQuickQuote(site) {
  const montador = site.content?.orcamento?.montador;
  if (!montador) return '';

  const modelOptions = site.products
    .map((item) => `<option value="${escapeHtml(item.nome)}">${escapeHtml(item.nome)}</option>`)
    .join('');

  const printOptions = (montador.opcoes_impressao ?? [])
    .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
    .join('');

  const defaultModel = site.products[0]?.nome ?? 'Caixa de papelão';
  const defaultHref = whatsappUrl(
    site.whatsapp,
    `Olá! Gostaria de um orçamento: Modelo: ${defaultModel}.`,
    'montador',
  );
  const linkAttrs = defaultHref.startsWith('https://')
    ? `href="${escapeHtml(defaultHref)}"\n    target="_blank"\n    rel="noopener noreferrer"`
    : `href="${escapeHtml(defaultHref)}"`;

  return [
    '<div class="quick-quote" id="quick-quote" data-quick-quote role="group" aria-labelledby="qq-title">',
    `  <h3 class="qq-title" id="qq-title">${escapeHtml(montador.titulo)}</h3>`,
    '  <div class="qq-grid">',
    '    <label class="qq-field">',
    `      <span>${escapeHtml(montador.produto)}</span>`,
    `      <select name="model">${modelOptions}</select>`,
    '    </label>',
    '    <label class="qq-field">',
    `      <span>${escapeHtml(montador.impressao)}</span>`,
    `      <select name="print">${printOptions}</select>`,
    '    </label>',
    '    <label class="qq-field">',
    `      <span>${escapeHtml(montador.medidas)}</span>`,
    '      <input type="text" name="dimensions" placeholder="Ex.: 40 x 30 x 25" autocomplete="off" />',
    '    </label>',
    '    <label class="qq-field">',
    `      <span>${escapeHtml(montador.quantidade)}</span>`,
    '      <input type="text" name="quantity" inputmode="numeric" placeholder="Ex.: 500" autocomplete="off" />',
    '    </label>',
    '  </div>',
    '  <p class="qq-preview" data-qq-preview aria-live="polite"></p>',
    '  <a',
    '    class="btn btn-light qq-submit"',
    `    ${linkAttrs}`,
    '    data-cta="montador"',
    '    data-qq-link',
    '  >',
    `    <svg aria-hidden="true"><use href="#i-wa" /></svg>${escapeHtml(montador.enviar)}`,
    '  </a>',
    '</div>',
  ].join('\n');
}

function buildJsonLd(site) {
  const base = normalizeBaseUrl(site.siteUrl);
  const safeBase = safeHttpsUrl(base);
  const safeMap = safeHttpsUrl(site.mapUrl);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
  };
  if (site.legalName) ld.legalName = site.legalName;
  if (site.description) ld.description = site.description;
  if (safeBase) {
    ld.url = safeBase;
    ld.logo = `${safeBase}icon-512.png`;
  }
  if (site.phone) ld.telephone = site.phone;
  if (site.cnpj) ld.taxID = site.cnpj;
  if (site.hoursSchema) ld.openingHours = site.hoursSchema;
  if (site.serviceArea) ld.areaServed = site.serviceArea;
  if (safeMap) ld.hasMap = safeMap;

  const { street, city, state, postalCode, country } = site.address;
  if (street || city || state || postalCode) {
    const addr = { '@type': 'PostalAddress' };
    if (street) addr.streetAddress = street;
    if (city) addr.addressLocality = city;
    if (state) addr.addressRegion = state;
    if (postalCode) addr.postalCode = postalCode;
    if (country) addr.addressCountry = country;
    ld.address = addr;
  }

  return JSON.stringify(ld).replace(/</g, '\\u003c');
}

/** Transforms an HTML entry document using the resolved `site` config and YAML content. */
export function renderPage(html, site) {
  const baseUrl = normalizeBaseUrl(site.siteUrl);
  let out = String(html ?? '');
  if (baseUrl) {
    out = out.replaceAll('%VITE_SITE_URL%', escapeHtml(baseUrl));
  } else {
    out = out
      .replace(/^[ \t]*<link\s+rel="canonical"\s+href="%VITE_SITE_URL%"\s*\/?>\r?\n?/gim, '')
      .replace(/^[ \t]*<meta\s+property="og:url"\s+content="%VITE_SITE_URL%"\s*\/?>\r?\n?/gim, '')
      .replaceAll('%VITE_SITE_URL%', './');
  }

  if (site.dataMode !== 'production' && !/<meta\s+name="robots"/i.test(out)) {
    out = out.replace(
      /(<meta\s+name="viewport"[^>]*\/?>)/i,
      '$1\n    <meta name="robots" content="noindex,nofollow" />',
    );
  }

  if (/<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i.test(out)) {
    const jsonLd = buildJsonLd(site);
    out = out.replace(
      /<script\s+type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script type="application/ld+json">${jsonLd}</script>`,
    );
  }

  out = out
    .replace('<!--render:produtos-->', () => renderProducts(site))
    .replace('<!--render:diferenciais-->', () => renderDifferentials(site))
    .replace('<!--render:clientes-->', () => renderClients(site))
    .replace('<!--render:montador-->', () => renderQuickQuote(site))
    .replace('<!--render:politica-->', () => markdownToHtml(site.content?.privacidade ?? '', site));

  out = applyDataNeed(out, site.vars);
  out = applyDataFields(out, site);
  out = applyTokens(out, site);
  out = applyWhatsAppLinks(out, site);

  return out;
}
