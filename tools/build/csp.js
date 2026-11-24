/** Generates the strict Content-Security-Policy meta tag value for production HTML pages. */
export function contentSecurityPolicy({ styleHashes = [], site } = {}) {
  const styleSrc = ["'self'", ...styleHashes].join(' ');
  const connectSources = ["'self'"];

  const endpoint = site?.client?.analytics?.endpoint;
  if (endpoint) {
    try {
      const origin = new URL(endpoint).origin;
      if (origin && !connectSources.includes(origin)) {
        connectSources.push(origin);
      }
    } catch {
      // Invalid endpoint is caught by site validation
    }
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "form-action 'none'",
    "script-src 'self'",
    "worker-src 'self' blob:",
    `style-src ${styleSrc}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(' ')}`,
  ].join('; ') + ';';
}
