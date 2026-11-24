import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DIFF_ICONS, visibleProofs } from '../../site.config.js';

export class SiteConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SiteConfigError';
  }
}

const MAX_LOGO_BYTES = 20 * 1024;

/**
 * Validates the combined site configuration, YAML schema errors, referenced assets, and
 * production-mode readiness rules. Returns non-fatal warnings or throws `SiteConfigError`.
 */
export function assertValidSite({ site, content, contentErrors = [], root, contentDir }) {
  const errors = [...contentErrors];
  const warnings = [];

  if (site.dataMode !== 'demo' && site.dataMode !== 'production') {
    errors.push(`VITE_DATA_MODE inválido ("${site.dataMode}"): use "demo" ou "production".`);
  }

  for (const diff of site.differentials) {
    if (!DIFF_ICONS.includes(diff.icon)) {
      errors.push(`Ícone desconhecido em diferenciais.yaml: "${diff.icon}".`);
    }
  }

  for (const client of site.clients) {
    if (!client.logo) continue;
    const logoPath = join(contentDir, 'clientes', client.logo);
    if (!client.logo.endsWith('.svg')) {
      errors.push(`Logo de "${client.name}" precisa ser SVG: "${client.logo}".`);
    } else if (!existsSync(logoPath)) {
      errors.push(`Logo ausente em content/clientes/: "${client.logo}".`);
    } else if (statSync(logoPath).size > MAX_LOGO_BYTES) {
      warnings.push(`Logo "${client.logo}" excede 20 KB.`);
    }
  }

  if (site.dataMode === 'production') {
    const confirmed = new Set(content.empresa?.confirmados ?? []);

    if (!site.whatsapp || site.whatsapp === '5511900000000') {
      errors.push('Em production, defina o número real de whatsapp em content/empresa.yaml.');
    }
    if (!site.siteUrl || !/^https:\/\//.test(site.siteUrl)) {
      errors.push('Em production, defina VITE_SITE_URL começando com https://.');
    }
    if (/demonstra[cç][aã]o/i.test(site.legalName)) {
      errors.push('Em production, substitua razao_social de demonstração em content/empresa.yaml.');
    }
    if (site.cnpj === '00.000.000/0001-00') {
      errors.push('Em production, substitua o CNPJ de demonstração em content/empresa.yaml.');
    }
    if (site.hours === 'Seg a Sex, 8h às 17h' && !confirmed.has('horario')) {
      warnings.push(
        'Confirme o campo "horario" em content/empresa.yaml (ou liste em confirmados).',
      );
    }

    for (const client of site.clients.filter((c) => c.authorized)) {
      const proofFile = join(root, 'docs', 'provas', `${client.id}.md`);
      if (!existsSync(proofFile)) {
        errors.push(
          `Cliente autorizado "${client.name}" requer registro em docs/provas/${client.id}.md.`,
        );
      }
    }

    const shownProofs = visibleProofs(site.proofs);
    for (const item of shownProofs.testimonials) {
      const proofFile = join(root, 'docs', 'provas', `${item.id}.md`);
      if (!existsSync(proofFile)) {
        errors.push(`Depoimento autorizado "${item.id}" requer docs/provas/${item.id}.md.`);
      }
    }
  }

  if (errors.length) {
    throw new SiteConfigError(
      `Configuração do site inválida:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  return warnings;
}
