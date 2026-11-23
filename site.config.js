// Site configuration: combines editable YAML content (`content/`) with environment variables (`.env`).
// Pure function: does not read `process.env` or filesystem directly.

export const DIFF_ICONS = ['fabrica', 'lotes', 'conversa', 'caixa'];

export const VAR_NAMES = [
  'nome',
  'razao_social',
  'titular',
  'cnpj',
  'rua',
  'bairro',
  'cidade',
  'uf',
  'cidade_uf',
  'cep',
  'telefone',
  'telefone_exibicao',
  'whatsapp',
  'whatsapp_exibicao',
  'horario',
  'ano_fundacao',
  'anos',
  'ano',
  'ano_atual',
  'regiao',
  'pagamento',
  'medicao_nome',
  'sem_medicao',
  'tem_diferenciais',
  'tem_provas',
];

export const RICH_VARS = new Set(['anos', 'ano']);

export const UMAMI_CLOUD = 'https://gateway.umami.is';

/** Calculates full years in business from founding year (`YYYY`). */
export function yearsSince(foundedYear, now = new Date()) {
  const year = Number.parseInt(String(foundedYear ?? '').trim(), 10);
  if (!Number.isFinite(year) || year < 1900 || year > now.getFullYear()) return Number.NaN;
  return now.getFullYear() - year;
}

/** Converts a client name to an ASCII slug (`"Café & Cia."` -> `"cafe-cia"`). */
export const slug = (name) =>
  String(name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function visibleProofs(items) {
  return {
    testimonials: items.testimonials.filter((item) => item.authorized === true),
    googleRating: items.googleRating?.authorized === true ? items.googleRating : null,
  };
}

export const visibleClients = (clients, dataMode) =>
  clients.filter((client) => client.authorized || dataMode === 'demo');

const text = (value) => String(value ?? '').trim();

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function formatPhone(phone) {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : '';
}

export function createSiteConfig({ env = {}, content, now = new Date() }) {
  const empresa = content.empresa ?? {};
  const endereco = empresa.endereco ?? {};
  const city = text(endereco.cidade);
  const state = text(endereco.uf);
  const phone = text(empresa.telefone);
  const legalName = text(empresa.razao_social);
  const whatsapp = text(empresa.whatsapp).replace(/\D/g, '');
  const foundedYear = text(empresa.ano_fundacao);
  const years = yearsSince(foundedYear, now);
  const cityState = city && state ? `${city}-${state}` : city || state;

  const products = content.produtos?.itens ?? [];
  const brand = content.site ?? {};

  const site = {
    name: text(brand.nome),
    description: text(brand.descricao),
    content,
    products,
    dataMode: text(env.VITE_DATA_MODE) || 'demo',
    siteUrl: text(env.VITE_SITE_URL),
    whatsapp,
    whatsappDisplay: whatsapp ? formatPhone(`+${whatsapp}`) || `+${whatsapp}` : '',
    phone,
    phoneDisplay: text(empresa.telefone_exibicao) || formatPhone(phone) || phone,
    cnpj: text(empresa.cnpj),
    legalName,
    address: {
      street: text(endereco.rua),
      district: text(endereco.bairro),
      city,
      state,
      postalCode: text(endereco.cep),
      country: 'BR',
    },
    cityState,
    hours: text(empresa.horario),
    hoursSchema: text(empresa.horario_schema),
    mapUrl: text(empresa.mapa),
    foundedYear,
    serviceArea: text(empresa.regiao),
    paymentMethods: text(empresa.pagamento),
    differentials: (content.diferenciais?.itens ?? []).map((item) => ({
      title: text(item.titulo),
      text: text(item.texto),
      icon: text(item.icone),
    })),
    clients: (content.clientes?.clientes ?? []).map((client) => ({
      id: slug(text(client.nome)),
      name: text(client.nome),
      logo: text(client.logo),
      alt: text(client.alt),
      authorized: client.autorizado === true,
      example: client.exemplo === true,
    })),
    proofs: {
      testimonials: (content.provas?.depoimentos ?? []).map((item) => ({
        id: text(item.id),
        quote: text(item.citacao),
        author: text(item.autor),
        authorized: item.autorizado === true,
      })),
      googleRating: content.provas?.nota_google
        ? {
            value: content.provas.nota_google.valor,
            count: content.provas.nota_google.quantidade,
            url: text(content.provas.nota_google.url),
            authorized: content.provas.nota_google.autorizado === true,
          }
        : null,
    },
    analytics: {
      provider: text(env.VITE_ANALYTICS_PROVIDER),
      site: text(env.VITE_ANALYTICS_SITE),
      endpoint: text(env.VITE_ANALYTICS_ENDPOINT),
    },
    year: String(now.getFullYear()),
    yearsInBusiness: Number.isFinite(years) ? String(years) : '',
  };

  site.client = {
    whatsapp,
    analytics:
      site.analytics.provider === 'umami' && site.dataMode === 'production'
        ? {
            site: site.analytics.site,
            endpoint: (site.analytics.endpoint || UMAMI_CLOUD).replace(/\/+$/, ''),
            host: hostOf(site.siteUrl),
          }
        : null,
  };

  const shownProofs = visibleProofs(site.proofs);
  const shownClients = visibleClients(site.clients, site.dataMode);
  site.vars = {
    nome: site.name,
    razao_social: legalName,
    titular: legalName || site.name,
    cnpj: site.cnpj,
    rua: site.address.street,
    bairro: site.address.district,
    cidade: city,
    uf: state,
    cidade_uf: cityState,
    cep: site.address.postalCode,
    telefone_exibicao: site.phoneDisplay,
    telefone: phone,
    whatsapp,
    whatsapp_exibicao: site.whatsappDisplay,
    horario: site.hours,
    ano_fundacao: foundedYear,
    anos: site.yearsInBusiness
      ? `<span class="anos" data-since="${foundedYear}">${site.yearsInBusiness}</span>`
      : '',
    ano: `<span data-year>${site.year}</span>`,
    ano_atual: site.year,
    medicao_nome: site.analytics.provider === 'umami' ? 'Umami Cloud' : '',
    sem_medicao: site.analytics.provider ? '' : 'sim',
    tem_diferenciais: site.differentials.length ? 'sim' : '',
    tem_provas:
      shownClients.length || shownProofs.testimonials.length || shownProofs.googleRating
        ? 'sim'
        : '',
    regiao: site.serviceArea,
    pagamento: site.paymentMethods,
  };

  return site;
}
