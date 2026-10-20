// Trava de go-live: a página só pode ir ao ar com dados reais. `VITE_DATA_MODE=demo` aceita os dados
// fictícios do `.env.example` (e o site sai com noindex); `production` exige dado real e completo.

const MODES = ['demo', 'production'];

// Chaves que podem ter o mesmo valor do .env.example mesmo em produção: ou são reais desde já
// (cidade, UF, URL do site, ano de fundação, horário do assistente do WhatsApp, Umami) ou não são
// dados da empresa.
const REAL_BY_NATURE = new Set([
  'VITE_DATA_MODE',
  'VITE_SITE_URL',
  'VITE_CITY',
  'VITE_STATE',
  'VITE_FOUNDED_YEAR',
  'VITE_WHATSAPP_HOURS',
  'VITE_ANALYTICS_PROVIDER',
  'VITE_ANALYTICS_SITE',
  'VITE_ANALYTICS_ENDPOINT',
]);

// Obrigatórios em produção (WhatsApp e URL do site valem nos dois modos).
const REQUIRED_IN_PRODUCTION = [
  ['VITE_CNPJ', 'CNPJ'],
  ['VITE_PHONE', 'telefone'],
  ['VITE_STREET', 'rua e número'],
  ['VITE_CITY', 'cidade'],
  ['VITE_STATE', 'UF'],
  ['VITE_CEP', 'CEP'],
  ['VITE_HOURS', 'horário de atendimento'],
];

/** CNPJ com os dois dígitos verificadores certos (o CNPJ fictício do .env.example não passa). */
export function isValidCnpj(value) {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const check = (base) => {
    let sum = 0;
    let weight = base.length - 7;
    for (const d of base) {
      sum += Number(d) * weight;
      weight = weight - 1 < 2 ? 9 : weight - 1;
    }
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return (
    Number(digits[12]) === check(digits.slice(0, 12)) &&
    Number(digits[13]) === check(digits.slice(0, 13))
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {object} input
 * @param {ReturnType<import('../site.config.js').createSiteConfig>} input.site
 * @param {Record<string, string>} input.env variáveis VITE_* do build
 * @param {Record<string, string>} input.example variáveis do `.env.example` (os valores fictícios)
 * @param {Date} [input.now]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateSite({ site, env, example, now = new Date() }) {
  const errors = [];
  const warnings = [];

  if (!MODES.includes(site.dataMode)) {
    errors.push(
      `VITE_DATA_MODE="${site.dataMode}" não existe: use "demo" (dados fictícios, noindex) ou "production".`,
    );
  }
  if (!/^55\d{10,11}$/.test(site.whatsapp)) {
    errors.push(
      `VITE_WHATSAPP="${env.VITE_WHATSAPP ?? ''}" inválido ou vazio: use 55 + DDD + número, ex.: 5511912345678.`,
    );
  }
  if (!/^https?:\/\/[^/\s]+\/(\S*\/)?$/.test(site.siteUrl)) {
    errors.push(`VITE_SITE_URL="${site.siteUrl}" precisa ser uma URL que termina em "/".`);
  }
  if (site.foundedYear) {
    const year = Number(site.foundedYear);
    if (!/^\d{4}$/.test(site.foundedYear) || year < 1900 || year > now.getFullYear()) {
      errors.push(
        `VITE_FOUNDED_YEAR="${site.foundedYear}" precisa ser um ano entre 1900 e o atual.`,
      );
    }
  }
  const { provider, site: analyticsSite } = site.analytics;
  if (provider && provider !== 'umami') {
    errors.push(`VITE_ANALYTICS_PROVIDER="${provider}" não existe: use "umami" ou deixe vazio.`);
  }
  if (provider === 'umami' && !UUID.test(analyticsSite)) {
    errors.push('VITE_ANALYTICS_SITE precisa ser o Website ID (UUID) do site no Umami.');
  }
  if (
    site.analytics.endpoint &&
    !/^https?:\/\/[^/\s]+$/.test(site.analytics.endpoint.replace(/\/+$/, ''))
  ) {
    errors.push(
      `VITE_ANALYTICS_ENDPOINT="${site.analytics.endpoint}" precisa ser só o endereço do servidor, ex.: https://umami.empresa.com.br`,
    );
  }

  if (site.dataMode === 'demo') {
    warnings.push(
      'VITE_DATA_MODE=demo: dados fictícios no site e noindex ligado. Para ir ao ar, siga docs/go-live.md.',
    );
  }

  if (site.dataMode === 'production') {
    for (const [key, label] of REQUIRED_IN_PRODUCTION) {
      if (!env[key]?.trim()) errors.push(`${key} (${label}) é obrigatório em production.`);
    }
    if (site.cnpj && !isValidCnpj(site.cnpj)) {
      errors.push(`VITE_CNPJ="${site.cnpj}" não é um CNPJ válido (dígitos verificadores).`);
    }
    if (site.phone && !/^\+55\d{10,11}$/.test(site.phone)) {
      errors.push(
        `VITE_PHONE="${site.phone}" inválido: use +55 + DDD + número, ex.: +5511912345678.`,
      );
    }
    if (site.address.state && !/^[A-Z]{2}$/.test(site.address.state)) {
      errors.push(`VITE_STATE="${site.address.state}" precisa ser a sigla da UF, ex.: SP.`);
    }
    if (site.address.postalCode && !/^\d{5}-?\d{3}$/.test(site.address.postalCode)) {
      errors.push(`VITE_CEP="${site.address.postalCode}" inválido: use o formato 01310-100.`);
    }
    if (!/^https:\/\//.test(site.siteUrl)) {
      errors.push(`VITE_SITE_URL="${site.siteUrl}" precisa ser https em production.`);
    }
    for (const [key, sample] of Object.entries(example)) {
      if (REAL_BY_NATURE.has(key) || !sample) continue;
      if (env[key] === sample) {
        errors.push(
          `${key}="${sample}" ainda é o valor fictício do .env.example: troque pelo real.`,
        );
      }
    }
    if (!provider) {
      warnings.push('Sem VITE_ANALYTICS_PROVIDER: os eventos ficam só no dataLayer, sem medição.');
    }
  }
  return { errors, warnings };
}

/** Lança um erro claro (com todos os problemas) se a config não puder ir ao ar; devolve os avisos. */
export function assertValidSite(input) {
  const { errors, warnings } = validateSite(input);
  if (errors.length) {
    throw new Error(
      `Configuração do site inválida (veja docs/go-live.md):\n- ${errors.join('\n- ')}`,
    );
  }
  return warnings;
}
