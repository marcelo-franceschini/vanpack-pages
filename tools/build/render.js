import { visibleClients, visibleProofs } from '../../site.config.js';
import {
  escapeHtml,
  expandTemplate,
  renderMarkdown,
  resolvePath,
  stripTags,
  whatsappUrl,
} from './text.js';

function renderProducts(site) {
  const buttonLabel = escapeHtml(site.content.produtos?.botao ?? 'Pedir orçamento');
  return site.products
    .map((product) => {
      const specs = Array.isArray(product.especificacoes) ? product.especificacoes : [];
      const specsHtml = specs.length
        ? `\n  <p class="model-specs">${specs
            .map((s) => `<span>${escapeHtml(s)}</span>`)
            .join('<span class="sep" aria-hidden="true">·</span>')}</p>`
        : '';
      return `<article class="model">
  <div class="model-3d" data-model="${escapeHtml(product.id)}" data-modelo="${escapeHtml(product.id)}" data-piece="${escapeHtml(product.peca)}" data-peca="${escapeHtml(product.peca)}">
    <span class="model-hint" aria-hidden="true">Arraste para girar</span>
  </div>
  <h3>${escapeHtml(product.nome)}</h3>
  <p class="model-desc">${escapeHtml(product.texto)}</p>${specsHtml}
  <a class="btn" data-cta="produto-${escapeHtml(product.id)}" data-wa="${escapeHtml(product.mensagem)}">
    <svg aria-hidden="true"><use href="#i-wa" /></svg>${buttonLabel}
  </a>
</article>`;
    })
    .join('\n');
}

function renderDifferentials(site) {
  return site.differentials
    .map(
      (item) => `<article class="pillar">
  <svg aria-hidden="true"><use href="#i-${escapeHtml(item.icon)}" /></svg>
  <h3>${escapeHtml(item.title)}</h3>
  <p>${escapeHtml(item.text)}</p>
</article>`,
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
        const inner = client.logo
          ? `<img src="./clientes/${escapeHtml(client.logo)}" alt="${escapeHtml(client.alt || client.name)}" loading="lazy" decoding="async" />`
          : `<span class="logo-name">${escapeHtml(client.name)}</span>`;
        return `<li class="cliente">${inner}</li>`;
      })
      .join('\n');

    parts.push(`<div class="carrossel" data-carousel>
  <div class="carrossel-janela" role="region" aria-label="Clientes" tabindex="0">
    <ul class="carrossel-trilho">
      ${items}
    </ul>
  </div>
</div>`);
  }

  if (shownProofs.testimonials.length) {
    const figures = shownProofs.testimonials
      .map(
        (t) => `<figure class="proof">
  <blockquote class="proof-quote">“${escapeHtml(t.quote)}”</blockquote>
  <figcaption>${escapeHtml(t.author)}</figcaption>
</figure>`,
      )
      .join('\n');
    parts.push(`<div class="proofs">\n${figures}\n</div>`);
  }

  if (shownProofs.googleRating) {
    const g = shownProofs.googleRating;
    const labels = site.content.provas?.textos ?? {};
    const ratingVal = String(g.value).replace('.', ',');
    const text = `${ratingVal} ${labels.nota ?? 'de 5 no Google'} (${g.count} ${labels.avaliacoes ?? 'avaliações'})`;
    parts.push(
      `<p class="rating"><a href="${escapeHtml(g.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a></p>`,
    );
  }

  return parts.join('\n');
}

function renderQuickQuote(site) {
  const m = site.content.orcamento?.montador;
  if (!m) return '';
  const productOptions = site.products
    .map((p) => `<option value="${escapeHtml(p.nome)}">${escapeHtml(p.nome)}</option>`)
    .join('');
  const printOptions = (m.opcoes_impressao ?? [])
    .map((opt) => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`)
    .join('');
  const defaultHref = whatsappUrl(
    site.whatsapp,
    `Olá! Gostaria de um orçamento — Modelo: ${site.products[0]?.nome ?? 'Caixa de papelão'}.`,
    'montador',
  );

  return `<form class="quick-quote" id="quick-quote" data-quick-quote>
  <h3 class="qq-title">${escapeHtml(m.titulo)}</h3>
  <div class="qq-grid">
    <label class="qq-field">
      <span>${escapeHtml(m.produto)}</span>
      <select name="model">${productOptions}</select>
    </label>
    <label class="qq-field">
      <span>${escapeHtml(m.impressao)}</span>
      <select name="print">${printOptions}</select>
    </label>
    <label class="qq-field">
      <span>${escapeHtml(m.medidas)}</span>
      <input type="text" name="dimensions" placeholder="Ex.: 40 x 30 x 25" autocomplete="off" />
    </label>
    <label class="qq-field">
      <span>${escapeHtml(m.quantidade)}</span>
      <input type="text" name="quantity" inputmode="numeric" placeholder="Ex.: 500" autocomplete="off" />
    </label>
  </div>
  <p class="qq-preview" data-qq-preview aria-live="polite"></p>
  <a
    class="btn btn-light qq-submit"
    href="${escapeHtml(defaultHref)}"
    target="_blank"
    rel="noopener noreferrer"
    data-cta="montador"
    data-qq-link
  >
    <svg aria-hidden="true"><use href="#i-wa" /></svg>${escapeHtml(m.enviar)}
  </a>
</form>`;
}

function buildJsonLd(site) {
  const url = site.siteUrl || undefined;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    legalName: site.legalName || undefined,
    description: site.description,
    url,
    logo: url ? new URL('icon-512.png', url).href : undefined,
    telephone: site.phone || undefined,
    taxID: site.cnpj || undefined,
    openingHours: site.hoursSchema || undefined,
    areaServed: site.serviceArea || undefined,
    hasMap: site.mapUrl || undefined,
  };

  if (site.address.street || site.address.city) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: site.address.street || undefined,
      addressLocality: site.address.city || undefined,
      addressRegion: site.address.state || undefined,
      postalCode: site.address.postalCode || undefined,
      addressCountry: site.address.country,
    };
  }

  return JSON.stringify(ld);
}

/** Removes any HTML element whose `data-need` requirement is not satisfied, handling nested same-name tags. */
function processDataNeed(html, vars) {
  const attrRe = /<([a-zA-Z][a-zA-Z0-9-]*)(\b[^>]*?\sdata-need="([^"]+)"[^>]*?)>/;
  let result = html;
  const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source']);

  while (true) {
    const match = attrRe.exec(result);
    if (!match) break;

    const [fullOpen, tagName, attrs, expr] = match;
    const startIdx = match.index;
    const conditions = expr.trim().split(/\s+/);
    const keep = conditions.every((cond) =>
      cond.startsWith('!') ? !vars[cond.slice(1)] : Boolean(vars[cond]),
    );

    if (keep) {
      const cleanedAttrs = attrs.replace(/\sdata-need="[^"]+"/, '');
      result =
        result.slice(0, startIdx) +
        `<${tagName}${cleanedAttrs}>` +
        result.slice(startIdx + fullOpen.length);
      continue;
    }

    if (voidTags.has(tagName.toLowerCase()) || fullOpen.endsWith('/>')) {
      result = result.slice(0, startIdx) + result.slice(startIdx + fullOpen.length);
      continue;
    }

    const tagRe = new RegExp(`<(\\/?)${tagName}(?=[\\s>/])[^>]*>`, 'gi');
    tagRe.lastIndex = startIdx + fullOpen.length;
    let depth = 1;
    let endIdx = result.length;
    let t;
    while ((t = tagRe.exec(result)) !== null) {
      if (t[1] === '/') {
        depth -= 1;
        if (depth === 0) {
          endIdx = t.index + t[0].length;
          break;
        }
      } else if (!t[0].endsWith('/>')) {
        depth += 1;
      }
    }
    result = result.slice(0, startIdx) + result.slice(endIdx);
  }

  return result;
}

function formatAddress(site) {
  const { street, district, postalCode } = site.address;
  const parts = [];
  if (street) parts.push(street);
  if (district) parts.push(district);
  if (site.cityState) parts.push(site.cityState);
  const cepLabel = site.content.rodape?.rotulos?.cep ?? 'CEP';
  if (postalCode) parts.push(`${cepLabel} ${postalCode}`);
  return parts.join(' · ');
}

function processDataFields(html, site) {
  const addressText = formatAddress(site);
  const mapLabel = site.content.rodape?.ver_mapa ?? 'Ver no mapa';

  const values = {
    endereco: addressText ? escapeHtml(addressText) : '',
    horario: site.hours ? escapeHtml(site.hours) : '',
    telefone: site.phone
      ? `<a href="tel:${escapeHtml(site.phone)}" data-contact="phone">${escapeHtml(site.phoneDisplay)}</a>`
      : '',
    mapa: site.mapUrl
      ? `<a href="${escapeHtml(site.mapUrl)}" target="_blank" rel="noopener noreferrer" data-contact="map">${escapeHtml(mapLabel)}</a>`
      : '',
    cnpj: site.cnpj ? escapeHtml(site.cnpj) : '',
  };

  // Footer <div data-field="X" hidden><dt>...</dt><dd></dd></div>
  let out = html.replace(
    /<div\s+data-field="([^"]+)"\s+hidden>([\s\S]*?)<dd><\/dd>([\s\S]*?)<\/div>/g,
    (_, field, before, after) => {
      const val = values[field];
      if (!val) return '';
      return `<div>${before}<dd>${val}</dd>${after}</div>`;
    },
  );

  // Mobile floating bar <div class="fab-tel" data-field="telefone" hidden></div>
  out = out.replace(
    /<div\s+class="fab-tel"\s+data-field="([^"]+)"\s+hidden><\/div>/g,
    (_, field) => {
      const val = values[field];
      if (!val) return '';
      return `<div class="fab-tel">${val}</div>`;
    },
  );

  return out;
}

function resolveToken(key, site, { rich }) {
  if (key in site.vars) {
    const val = site.vars[key];
    return rich ? String(val ?? '') : escapeHtml(stripTags(val));
  }
  const fromContent = resolvePath(site.content, key);
  if (fromContent !== undefined && fromContent !== null) {
    return expandTemplate(String(fromContent), site.vars, { rich });
  }
  return '';
}

function interpolateTokens(html, site) {
  // First resolve tokens inside HTML tags/attributes (plain text only, no <span> inside attributes)
  let out = html.replace(/<[^>]+>/g, (tag) =>
    tag.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) => resolveToken(key, site, { rich: false })),
  );

  // Resolve <title>...</title> in plain-text mode
  out = out.replace(/<title>([\s\S]*?)<\/title>/gi, (_, inner) => {
    const resolved = inner.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (__, key) =>
      resolveToken(key, site, { rich: false }),
    );
    return `<title>${resolved}</title>`;
  });

  // Resolve remaining text-node tokens with rich HTML support (e.g. {{anos}}, {{ano}})
  out = out.replace(/\{\{([a-zA-Z0-9_.]+)\}\}/g, (_, key) =>
    resolveToken(key, site, { rich: true }),
  );

  return out;
}

function processWhatsAppLinks(html, site) {
  return html.replace(/<a\b([^>]*?)>/gi, (full, attrs) => {
    const waMatch = /\sdata-wa="([^"]*)"/.exec(attrs);
    if (!waMatch) return full;
    const ctaMatch = /\sdata-cta="([^"]*)"/.exec(attrs);
    const message = waMatch[1]
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&');
    const url = whatsappUrl(site.whatsapp, message, ctaMatch?.[1] ?? '');
    const cleaned = attrs.replace(/\sdata-wa="[^"]*"/, '');
    return `<a${cleaned} href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">`;
  });
}

/** Transforms a raw HTML page template using the validated `site` model. */
export function renderPage(html, site) {
  let out = html;

  out = out.replace('<!--render:produtos-->', () => renderProducts(site));
  out = out.replace('<!--render:diferenciais-->', () => renderDifferentials(site));
  out = out.replace('<!--render:clientes-->', () => renderClients(site));
  out = out.replace('<!--render:montador-->', () => renderQuickQuote(site));
  out = out.replace('<!--render:politica-->', () =>
    renderMarkdown(site.content.privacidade ?? '', site),
  );

  out = processDataNeed(out, site.vars);
  out = processDataFields(out, site);
  out = interpolateTokens(out, site);
  out = processWhatsAppLinks(out, site);

  out = out.replace(
    /<script type="application\/ld\+json">\s*\{\}\s*<\/script>/i,
    `<script type="application/ld+json">${buildJsonLd(site)}</script>`,
  );

  return out;
}
