// Escreve os dados da empresa no HTML. Puro (HTML + config → HTML): roda no plugin do Vite e nos
// testes, que renderizam o index.html com a config vazia sem precisar de um build.
//
//   data-wa="mensagem"       o link vira https://wa.me/<número>?text=<mensagem> (nunca sem número)
//   data-field="nome"        rodapé: recebe o valor da config; sem valor, o elemento sai do HTML
//   data-need="chave outra"  o elemento sai se qualquer chave estiver vazia (e o atributo some)
//   {{variavel}}             valor da config; vazio fora de um data-need é erro de build
//   JSON-LD                  montado inteiro a partir da config
//   modo demo                <meta name="robots" content="noindex,nofollow">

export const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const decodeEntities = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const VOID_TAGS = new Set(['area', 'br', 'col', 'embed', 'hr', 'img', 'input', 'source', 'wbr']);

/** Posição logo depois do `>` que fecha a tag aberta em `start` (respeita aspas nos atributos). */
function openingEnd(html, start) {
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i + 1;
  }
  throw new Error('HTML malformado: tag sem ">"');
}

/** Posição logo depois do elemento que abre em `start`, contando aninhamento da mesma tag. */
function elementEnd(html, start, tag) {
  const afterOpen = openingEnd(html, start);
  if (VOID_TAGS.has(tag.toLowerCase()) || html[afterOpen - 2] === '/') return afterOpen;
  const re = new RegExp(`<(/?)${tag}(?=[\\s>/])`, 'gi');
  re.lastIndex = afterOpen;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[1]) {
      depth -= 1;
      if (depth === 0) return openingEnd(html, m.index);
    } else if (html[openingEnd(html, m.index) - 2] !== '/') {
      depth += 1;
    }
  }
  throw new Error(`HTML malformado: <${tag}> sem </${tag}>`);
}

/** Valores do rodapé (HTML já escapado); vazio = sem dado, o elemento sai. */
export function footerFields(site) {
  const { address } = site;
  const place = address.street
    ? [
        address.street,
        address.district,
        site.cityState,
        address.postalCode && `CEP ${address.postalCode}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : '';
  const link = (href, label, extra = '') =>
    `<a href="${escapeHtml(href)}"${extra}>${escapeHtml(label)}</a>`;
  return {
    slogan: escapeHtml(site.slogan),
    razao: site.legalName && escapeHtml(site.legalName),
    cnpj: site.cnpj && escapeHtml(site.cnpj),
    endereco: place && escapeHtml(place),
    horario: site.hours && escapeHtml(site.hours),
    telefone: site.phone && link(`tel:${site.phone}`, site.phoneDisplay || site.phone),
    email: site.email && link(`mailto:${site.email}`, site.email),
    mapa: site.mapUrl && link(site.mapUrl, 'Ver no mapa', ' target="_blank" rel="noopener"'),
  };
}

// <tag … data-need|data-field="…" …>: o `before`/`after` são os demais atributos.
const MARKED = /<([a-zA-Z][\w-]*)((?:\s[^>]*?)?)\s(data-need|data-field)="([^"]*)"([^>]*)>/g;

/** Aplica data-field e data-need: preenche o que tem dado e tira do HTML o que não tem. */
function applyMarks(html, { fields, vars }) {
  let out = html;
  let pos = 0;
  for (;;) {
    MARKED.lastIndex = pos;
    const m = MARKED.exec(out);
    if (!m) return out;
    const [open, tag, before, kind, key, after] = m;
    let keep;
    let value = '';
    if (kind === 'data-field') {
      if (!(key in fields)) throw new Error(`data-field desconhecido: "${key}"`);
      value = fields[key];
      keep = Boolean(value);
    } else {
      const keys = key.trim().split(/\s+/);
      for (const k of keys) if (!(k in vars)) throw new Error(`data-need desconhecido: "${k}"`);
      keep = keys.every((k) => vars[k]);
    }
    const end = elementEnd(out, m.index, tag);
    if (!keep) {
      // Elemento sozinho na linha leva junto a linha inteira; elemento no meio de um texto (um <span>)
      // não leva o espaço que vem depois, que ainda separa as palavras.
      const lineStart = out.lastIndexOf('\n', m.index - 1) + 1;
      const alone = /^[ \t]*$/.test(out.slice(lineStart, m.index));
      const from = alone ? lineStart : m.index;
      const to = alone ? end + /^[ \t]*\n?/.exec(out.slice(end))[0].length : end;
      out = out.slice(0, from) + out.slice(to);
      pos = from;
      continue;
    }
    let attrs = `${before}${after}`;
    if (kind === 'data-field') attrs = attrs.replace(/\shidden(?=\s|$)/g, '');
    const openTag = `<${tag}${attrs}>`;
    let rest = out.slice(m.index + open.length, end);
    if (kind === 'data-field') {
      const closing = `</${tag}>`;
      const inner = rest.slice(0, rest.length - closing.length);
      let body = inner;
      if (inner.includes('<dd></dd>')) body = inner.replace('<dd></dd>', `<dd>${value}</dd>`);
      else if (inner.trim() === '') body = value;
      rest = body + closing;
    }
    out = out.slice(0, m.index) + openTag + rest + out.slice(end);
    pos = m.index + openTag.length; // continua dentro do elemento: pode ter marcas aninhadas
  }
}

// <style> e <script> não têm {{variáveis}}.
const RAW_BLOCKS = /(<(?:style|script)\b[\s\S]*?<\/(?:style|script)>)/gi;
const outsideRawBlocks = (html, fn) =>
  html
    .split(RAW_BLOCKS)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join('');

/** Troca {{variavel}} pelo valor escapado; variável desconhecida ou vazia é erro de build. */
export function interpolate(text, vars, where = 'HTML') {
  return text.replace(/\{\{\s*([A-Za-z]\w*)\s*\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`${where}: variável desconhecida {{${key}}}`);
    if (!vars[key]) {
      throw new Error(`${where}: {{${key}}} está vazio; proteja o trecho com data-need="${key}"`);
    }
    return escapeHtml(vars[key]);
  });
}

/**
 * Cada <a data-wa="…"> vira um link do wa.me com o número da config e a mensagem pronta. O fim da
 * mensagem leva o código de origem do botão ([site-hero], pelo data-cta): o dono vê de qual ponto
 * da página veio cada conversa.
 */
function whatsappLinks(html, site) {
  return html.replace(/<a\b[^>]*\sdata-wa="[^"]*"[^>]*>/g, (tag) => {
    if (!site.whatsapp) {
      throw new Error(
        'VITE_WHATSAPP vazio: os botões do WhatsApp abririam wa.me/?text=… sem número.',
      );
    }
    const cta = /\sdata-cta="([^"]*)"/.exec(tag)?.[1];
    return tag.replace(/\sdata-wa="([^"]*)"/, (_, message) => {
      const text = decodeEntities(message) + (cta ? ` [site-${cta}]` : '');
      return ` href="https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}" target="_blank" rel="noopener"`;
    });
  });
}

/** JSON-LD LocalBusiness só com o que há de dado (sem aggregateRating próprio). */
export function buildJsonLd(site) {
  const { address } = site;
  const streetAddress = [address.street, address.district].filter(Boolean).join(', ');
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: site.name,
    ...(site.legalName && { legalName: site.legalName }),
    description: site.description,
    url: site.siteUrl,
    image: `${site.siteUrl}og.jpg`,
    logo: `${site.siteUrl}icon-512.png`,
    ...(site.phone && { telephone: site.phone }),
    ...(site.email && { email: site.email }),
    ...(site.cnpj && { taxID: site.cnpj }),
    ...(site.foundedYear && { foundingDate: site.foundedYear }),
    ...(site.hoursSchema && { openingHours: site.hoursSchema }),
    ...(site.serviceArea && { areaServed: site.serviceArea }),
    address: {
      '@type': 'PostalAddress',
      ...(streetAddress && { streetAddress }),
      ...(address.city && { addressLocality: address.city }),
      ...(address.state && { addressRegion: address.state }),
      ...(address.postalCode && { postalCode: address.postalCode }),
      addressCountry: address.country,
    },
  };
}

/** Renderiza a página: dados da empresa, links do WhatsApp, JSON-LD e, em demo, o noindex. */
export function renderPage(html, site) {
  let out = whatsappLinks(html, site);
  out = outsideRawBlocks(out, (part) =>
    applyMarks(part, { fields: footerFields(site), vars: site.vars }),
  );
  out = outsideRawBlocks(out, (part) => interpolate(part, site.vars));
  out = out.replace(
    /(<script type="application\/ld\+json">)[\s\S]*?(<\/script>)/,
    (_, open, close) => open + JSON.stringify(buildJsonLd(site)).replace(/</g, '\\u003c') + close,
  );
  // <dl> sem nenhum campo (nada a mostrar) não fica vazio na página
  out = out.replace(/<dl class="foot-info">\s*<\/dl>\s*/, '');
  if (site.dataMode === 'demo') {
    out = out.replace(
      /<meta charset="utf-8"\s*\/?>/i,
      (meta) => `${meta}\n<meta name="robots" content="noindex,nofollow" />`,
    );
  }
  return out;
}
