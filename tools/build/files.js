function normalizeBaseUrl(siteUrl) {
  const raw = String(siteUrl ?? '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

/** Emits `robots.txt`, disallowing crawlers outside `production` mode. */
export function robotsTxt(site) {
  if (site.dataMode !== 'production') {
    return 'User-agent: *\nDisallow: /\n';
  }
  const base = normalizeBaseUrl(site.siteUrl);
  const sitemapLine = base ? `\nSitemap: ${base}sitemap.xml\n` : '';
  return `User-agent: *\nAllow: /\n${sitemapLine}`;
}

/** Emits `sitemap.xml` for the public landing page and privacy policy. */
export function sitemapXml(site) {
  const base = normalizeBaseUrl(site.siteUrl) || 'https://example.invalid/';
  const urls = [base, `${base}politica-de-privacidade.html`];
  const entries = urls.map((loc) => `  <url>\n    <loc>${loc}</loc>\n  </url>`).join('\n');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries,
    '</urlset>',
    '',
  ].join('\n');
}
