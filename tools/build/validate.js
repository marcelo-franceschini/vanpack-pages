import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIFF_ICONS } from '../../site.config.js';
import { safeHttpsUrl } from './text.js';

const DEMO_PLACEHOLDERS = {
  cnpj: '00.000.000/0001-00',
  whatsapp: '5511900000000',
  telefone: '+551130000000',
  cep: '00000-000',
  rua: 'Rua Exemplo, 123',
  bairro: 'Bairro Demonstração',
};

const MAX_LOGO_BYTES = 20 * 1024;

export class SiteConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SiteConfigError';
  }
}

/** Validates site configuration, YAML content, assets, and production go-live guardrails. */
export function assertValidSite({ site, content, contentErrors = [], contentDir }) {
  const errors = [...contentErrors];
  const warnings = [];

  if (site.dataMode !== 'demo' && site.dataMode !== 'production') {
    errors.push(`VITE_DATA_MODE inválido: "${site.dataMode}" (use "demo" ou "production").`);
  }

  if (!/^\d{10,15}$/.test(site.whatsapp)) {
    errors.push(
      'content/empresa.yaml: "whatsapp" deve ter entre 10 e 15 dígitos (ex.: 5511912345678).',
    );
  }

  if (site.siteUrl) {
    try {
      const parsed = new URL(site.siteUrl);
      if (site.dataMode === 'production' && parsed.protocol !== 'https:') {
        errors.push('VITE_SITE_URL em production deve começar com https://.');
      }
    } catch {
      errors.push(`VITE_SITE_URL inválido: "${site.siteUrl}".`);
    }
  } else if (site.dataMode === 'production') {
    errors.push('VITE_SITE_URL é obrigatório em VITE_DATA_MODE=production.');
  }

  if (site.mapUrl && !safeHttpsUrl(site.mapUrl)) {
    errors.push('content/empresa.yaml: "mapa" deve começar com https://.');
  }

  for (const item of site.differentials) {
    if (!DIFF_ICONS.includes(item.icon)) {
      errors.push(`content/diferenciais.yaml: ícone inválido "${item.icon}".`);
    }
  }

  if (contentDir) {
    for (const client of site.clients) {
      if (!client.logo) continue;
      if (!client.logo.endsWith('.svg')) {
        errors.push(`content/clientes.yaml: logo "${client.logo}" deve ser um arquivo .svg.`);
        continue;
      }
      const logoPath = join(contentDir, 'clientes', client.logo);
      if (!existsSync(logoPath)) {
        errors.push(`Logo do cliente não encontrado: content/clientes/${client.logo}`);
        continue;
      }
      const size = statSync(logoPath).size;
      if (size > MAX_LOGO_BYTES) {
        errors.push(
          `Logo content/clientes/${client.logo} excede 20 KB (${Math.ceil(size / 1024)} KB).`,
        );
      }
    }
  }

  if (site.analytics.provider) {
    if (site.analytics.provider !== 'umami') {
      errors.push(`VITE_ANALYTICS_PROVIDER não suportado: "${site.analytics.provider}".`);
    } else if (site.dataMode === 'production' && !site.analytics.site) {
      errors.push('VITE_ANALYTICS_SITE é obrigatório quando VITE_ANALYTICS_PROVIDER=umami.');
    }
    if (site.analytics.endpoint && !safeHttpsUrl(site.analytics.endpoint)) {
      errors.push('VITE_ANALYTICS_ENDPOINT deve começar com https://.');
    }
  }

  if (site.dataMode === 'production') {
    const empresa = content?.empresa ?? {};
    if (!site.legalName || /demonstra[cç][aã]o/i.test(site.legalName)) {
      errors.push('Production: atualize "razao_social" em content/empresa.yaml com o dado real.');
    }
    if (site.cnpj === DEMO_PLACEHOLDERS.cnpj) {
      errors.push('Production: substitua o CNPJ fictício em content/empresa.yaml.');
    }
    if (site.whatsapp === DEMO_PLACEHOLDERS.whatsapp) {
      errors.push('Production: substitua o WhatsApp fictício em content/empresa.yaml.');
    }
    if (site.phone === DEMO_PLACEHOLDERS.telefone) {
      errors.push('Production: substitua o telefone fictício em content/empresa.yaml.');
    }
    if (
      site.address.street === DEMO_PLACEHOLDERS.rua ||
      site.address.district === DEMO_PLACEHOLDERS.bairro ||
      site.address.postalCode === DEMO_PLACEHOLDERS.cep
    ) {
      errors.push('Production: substitua o endereço fictício em content/empresa.yaml.');
    }
    if (!empresa.endereco?.cidade || !empresa.endereco?.uf) {
      errors.push('Production: informe cidade e UF em content/empresa.yaml.');
    }
  }

  if (errors.length > 0) {
    throw new SiteConfigError(
      `Configuração do site inválida:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return warnings;
}
