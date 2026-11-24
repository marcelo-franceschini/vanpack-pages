function normalizeBaseUrl(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return '';
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

/** Generates `robots.txt` for static builds. */
export function robotsTxt(site) {
  const base = normalizeBaseUrl(site.siteUrl);
  const lines = ['User-agent: *', 'Allow: /'];
  if (base) {
    lines.push('', `Sitemap: ${base}sitemap.xml`);
  }
  return `${lines.join('\n')}\n`;
}

/** Generates `sitemap.xml` listing the public HTML pages. */
export function sitemapXml(site) {
  const base = normalizeBaseUrl(site.siteUrl) || 'https://example.com/';
  const urls = [base, `${base}politica-de-privacidade.html`];
  const entries = urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;
}
