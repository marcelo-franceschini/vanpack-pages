// Content-Security-Policy da página (via <meta>: o GitHub Pages não permite cabeçalhos). Pura, para o
// plugin do Vite e para os testes. Sem 'unsafe-inline': cada <style> entra pelo hash do conteúdo, e o
// único domínio externo é o servidor da medição (só quando há provedor configurado).

/** @param {{ styleHashes: string[], site: { client: { analytics: { endpoint: string } | null } } }} input */
export function contentSecurityPolicy({ styleHashes, site }) {
  const analytics = site.client.analytics;
  const connect = ["'self'", ...(analytics ? [new URL(analytics.endpoint).origin] : [])];
  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self' ${styleHashes.join(' ')}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "worker-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}
