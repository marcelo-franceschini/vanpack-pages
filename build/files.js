// Arquivos gerados no build a partir da URL do site (nada de URL fixa em public/).

const escapeXml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Em demo o site inteiro fica fora dos buscadores; em production aponta para o sitemap. */
export function robotsTxt(site) {
  if (site.dataMode === 'demo') return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${site.siteUrl}sitemap.xml\n`;
}

/** `lastmod` é a data do build. */
export function sitemapXml(site, now = new Date()) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(site.siteUrl)}</loc>
    <lastmod>${now.toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
}
