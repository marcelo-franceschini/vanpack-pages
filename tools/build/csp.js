function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return '';
  }
}

/** Builds a strict Content-Security-Policy string embedding SHA-256 hashes for inlined styles. */
export function contentSecurityPolicy({ styleHashes = [], site } = {}) {
  const analyticsOrigin = site?.client?.analytics?.endpoint
    ? originOf(site.client.analytics.endpoint)
    : '';

  const styleSrc = ["'self'", ...styleHashes].join(' ');
  const connectSrc = analyticsOrigin ? `'self' ${analyticsOrigin}` : "'self'";

  return [
    "default-src 'self'",
    "script-src 'self'",
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
