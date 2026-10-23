// Trava de go-live: a página só pode ir ao ar com dados reais. `VITE_DATA_MODE=demo` aceita os dados
// fictícios (e o site sai com noindex); `production` exige dado real e completo. As regras de formato
// (tipos, tamanhos, campos que existem) são do JSON Schema de cada arquivo de content/ (build/content.js);
// aqui ficam o que depende do modo, de outros arquivos ou do disco: CNPJ com dígito verificador, dados
// fictícios que sobraram, logos de cliente (existem, são SVG seguro, até 20 KB) e as autorizações
// registradas em docs/provas/.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { RICH_VARS, visibleProofs } from '../site.config.js';
import { renderText } from './texto.js';

const MODES = ['demo', 'production'];

/**
 * A configuração não pode ir ao ar. A mensagem já diz tudo (arquivo, linha, campo e o que fazer), então o
 * build a mostra sozinha, sem o rastro de pilha do Node (vite.config.js).
 */
export class SiteConfigError extends Error {
  name = 'SiteConfigError';
}

// Textos que, depois de trocadas as {{variáveis}}, não podem passar de um tamanho, senão o cartão da
// abertura estoura no celular deitado (844 x 390), onde ele tem 2 px de folga. Hoje nenhum campo pede
// isso (o tamanho de cada um é do schema); a lista fica para o próximo que precisar.
/** @type {[string, string, number, string][]} */
const RENDERED_LIMITS = [];
const MAX_LOGO_BYTES = 20 * 1024;

// Campos que podem ter o mesmo valor do exemplo mesmo em produção: já são reais desde já (cidade, UF,
// ano de fundação).
const REAL_BY_NATURE = new Set(['endereco.cidade', 'endereco.uf', 'ano_fundacao']);
// Campos cujo valor real pode coincidir com o de exemplo (horário comercial, região, pagamento): o dono confirma listando-os em `confirmados` no empresa.yaml (o schema aceita só estes).
// Dado que identifica a empresa (CNPJ, telefones, WhatsApp, endereço) nunca pode ser igual ao exemplo.
const CONFIRMABLE = new Set(['horario', 'horario_schema', 'regiao', 'pagamento']);

// Obrigatórios em produção (o WhatsApp e a URL do site valem nos dois modos).
const REQUIRED_IN_PRODUCTION = [
  ['cnpj', 'CNPJ'],
  ['telefone', 'telefone'],
  ['endereco.rua', 'rua e número'],
  ['endereco.cidade', 'cidade'],
  ['endereco.uf', 'UF'],
  ['endereco.cep', 'CEP'],
  ['horario', 'horário de atendimento'],
];

const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const field = (file, path) => `content/${file}.yaml › ${path}`;

/** Os campos de um objeto em linha: { 'endereco.cep': '01310-100', ... }. */
function flatten(object, prefix = '') {
  return Object.entries(object ?? {}).flatMap(([key, value]) =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? flatten(value, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value]],
  );
}

/** CNPJ com os dois dígitos verificadores certos (o CNPJ fictício do exemplo não passa). */
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

/** Problemas de um logo de cliente (content/clientes/<arquivo>): existe, é SVG seguro e leve. */
export function logoProblems(contentDir, logo) {
  const path = join(contentDir, 'clientes', logo);
  if (!existsSync(path)) return [`o arquivo content/clientes/${logo} não existe`];
  const problems = [];
  const bytes = statSync(path).size;
  if (bytes > MAX_LOGO_BYTES) {
    problems.push(
      `content/clientes/${logo} tem ${(bytes / 1024).toFixed(1)} KB; o máximo é ${MAX_LOGO_BYTES / 1024} KB`,
    );
  }
  const svg = readFileSync(path, 'utf8');
  if (!/<svg[\s>]/.test(svg)) problems.push(`content/clientes/${logo} não é um SVG`);
  if (!/viewBox=/.test(svg)) problems.push(`content/clientes/${logo} precisa ter viewBox`);
  if (/<script|\son\w+\s*=|javascript:/i.test(svg)) {
    problems.push(`content/clientes/${logo} tem script, e o site não aceita`);
  }
  if (/<image\b|data:image|href=["']?https?:/i.test(svg)) {
    problems.push(
      `content/clientes/${logo} embute imagem ou carrega algo de fora; o logo precisa ser só vetor`,
    );
  }
  return problems;
}

/**
 * @param {object} input
 * @param {ReturnType<typeof import('../site.config.js').createSiteConfig>} input.site
 * @param {Record<string, any>} input.content o conteúdo lido de content/ (inclui `exemplo`)
 * @param {string} [input.root] pasta do projeto (onde ficam content/ e docs/provas/); sem ela, as
 *   conferências de arquivos (logos, registros de autorização) ficam de fora
 * @param {string} [input.contentDir] pasta do conteúdo (padrão: content/ dentro de `root`)
 * @param {Date} [input.now]
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateSite({
  site,
  content,
  root,
  contentDir = root && join(root, 'content'),
  now = new Date(),
}) {
  const errors = [];
  const warnings = [];

  if (!MODES.includes(site.dataMode)) {
    errors.push(
      `VITE_DATA_MODE="${site.dataMode}" não existe: use "demo" (dados fictícios, noindex) ou "production".`,
    );
  }
  // sem content/empresa.yaml válido o erro já está na lista do carregador: não repete como "whatsapp ()"
  if (content.empresa && !/^55\d{10,11}$/.test(site.whatsapp)) {
    errors.push(
      `${field('empresa', 'whatsapp')} (${content.empresa?.whatsapp ?? ''}) inválido ou vazio: use 55 + DDD + número, ex.: 5511912345678.`,
    );
  }
  if (!/^https?:\/\/[^/\s]+\/(\S*\/)?$/.test(site.siteUrl)) {
    errors.push(`VITE_SITE_URL="${site.siteUrl}" precisa ser uma URL que termina em "/".`);
  }
  if (site.foundedYear) {
    const year = Number(site.foundedYear);
    if (!/^\d{4}$/.test(site.foundedYear) || year < 1900 || year > now.getFullYear()) {
      errors.push(
        `${field('empresa', 'ano_fundacao')} (${site.foundedYear}) precisa ser um ano entre 1900 e o atual.`,
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

  // Produtos: cada peça 3D uma vez só.
  const ids = (content.produtos?.itens ?? []).map((item) => item.id);
  for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) {
    errors.push(`${field('produtos', 'itens')}: o produto "${id}" aparece mais de uma vez.`);
  }

  // Clientes: logo de arquivo (SVG leve e seguro) e autorização com registro em docs/provas/.
  const registry = (id) => root && existsSync(join(root, 'docs', 'provas', `${id}.md`));
  for (const [i, client] of site.clients.entries()) {
    const where = field('clientes', `clientes[${i}]`);
    if (client.logo && contentDir) {
      for (const problem of logoProblems(contentDir, client.logo))
        errors.push(`${where}.logo: ${problem}.`);
    }
    if (client.authorized && root && !registry(client.id)) {
      errors.push(
        `${where}: o cliente está autorizado, mas falta o registro docs/provas/${client.id}.md (quem autorizou, quando e o quê).`,
      );
    }
  }
  const proofs = visibleProofs(site.proofs);
  for (const item of [...proofs.testimonials, ...(proofs.googleRating ? [{ id: 'google' }] : [])]) {
    if (root && !registry(item.id)) {
      errors.push(
        `${field('provas', item.id)}: a prova está autorizada, mas falta o registro docs/provas/${item.id}.md.`,
      );
    }
  }

  // Textos prontos que não podem passar de um tamanho (a cidade ou a região entram neles).
  for (const [file, path, max, why] of RENDERED_LIMITS) {
    const source = get(content[file], path);
    if (typeof source !== 'string') continue;
    let ready;
    try {
      ready = renderText(source, site.vars, { rich: RICH_VARS });
    } catch {
      continue; // variável vazia: o trecho some junto com o elemento, e o carregador já avisa do resto
    }
    const length = [...ready.replace(/<[^>]*>/g, '')].length;
    if (length > max) {
      errors.push(
        `${field(file, path)}: depois de trocar as variáveis, o texto tem ${length} caracteres ("${ready}"); o máximo é ${max}, ${why}. Encurte o texto, ou o nome da cidade, da região...`,
      );
    }
  }

  if (site.dataMode === 'demo') {
    warnings.push(
      'VITE_DATA_MODE=demo: dados fictícios no site e noindex ligado. Para ir ao ar, siga docs/go-live.md.',
    );
  }

  if (site.dataMode === 'production') {
    const empresa = content.empresa ?? {};
    for (const [path, label] of REQUIRED_IN_PRODUCTION) {
      if (content.empresa && !String(get(empresa, path) ?? '').trim()) {
        errors.push(`${field('empresa', path)} (${label}) é obrigatório em production.`);
      }
    }
    if (site.cnpj && !isValidCnpj(site.cnpj)) {
      errors.push(
        `${field('empresa', 'cnpj')} ("${site.cnpj}") não é um CNPJ válido (dígitos verificadores).`,
      );
    }
    if (site.phone && !/^\+55\d{10,11}$/.test(site.phone)) {
      errors.push(
        `${field('empresa', 'telefone')} ("${site.phone}") inválido: use +55 + DDD + número, ex.: +5511912345678.`,
      );
    }
    if (site.address.state && !/^[A-Z]{2}$/.test(site.address.state)) {
      errors.push(
        `${field('empresa', 'endereco.uf')} ("${site.address.state}") precisa ser a sigla da UF em maiúsculas, ex.: SP.`,
      );
    }
    if (site.address.postalCode && !/^\d{5}-?\d{3}$/.test(site.address.postalCode)) {
      errors.push(
        `${field('empresa', 'endereco.cep')} ("${site.address.postalCode}") inválido: use o formato 01310-100.`,
      );
    }
    if (!/^https:\/\//.test(site.siteUrl)) {
      errors.push(`VITE_SITE_URL="${site.siteUrl}" precisa ser https em production.`);
    }
    const confirmed = new Set(empresa.confirmados ?? []);
    for (const [path, sample] of flatten(content.exemplo?.empresa)) {
      if (REAL_BY_NATURE.has(path) || confirmed.has(path) || !String(sample ?? '').trim()) continue;
      if (String(get(content.empresa, path) ?? '').trim() === String(sample).trim()) {
        const confirm = CONFIRMABLE.has(path)
          ? ` Se o valor real for mesmo esse, liste "${path}" em "confirmados" no content/empresa.yaml.`
          : '';
        errors.push(
          `${field('empresa', path)} ("${sample}") ainda é o valor fictício de content/exemplo/empresa.yaml: troque pelo real.${confirm}`,
        );
      }
    }
    for (const [i, client] of site.clients.entries()) {
      if (client.example) {
        errors.push(
          `${field('clientes', `clientes[${i}]`)} ("${client.name}") é um cliente de exemplo: troque por um cliente real autorizado ou apague a linha.`,
        );
      } else if (!client.authorized) {
        warnings.push(
          `${field('clientes', `clientes[${i}]`)} ("${client.name}") ainda não está autorizado e fica fora da página em production: registre docs/provas/${client.id}.md e ponha "autorizado: true".`,
        );
      }
    }
    if (!provider) {
      warnings.push('Sem VITE_ANALYTICS_PROVIDER: os eventos ficam só no dataLayer, sem medição.');
    }
  }
  return { errors, warnings };
}

/**
 * Lança um erro claro (com todos os problemas, os do conteúdo primeiro) se a config não puder ir ao ar;
 * devolve os avisos.
 * @param {Parameters<typeof validateSite>[0] & { contentErrors?: string[] }} input
 */
export function assertValidSite({ contentErrors = [], ...input }) {
  const { errors, warnings } = validateSite(input);
  const all = [...contentErrors, ...errors];
  if (all.length) {
    throw new SiteConfigError(
      `Configuração do site inválida (veja docs/go-live.md):\n- ${all.join('\n- ')}`,
    );
  }
  return warnings;
}
