// Configuração do site. Todo dado da empresa (CNPJ, telefone, endereço, pedido mínimo…) vive só no
// `.env`, a fonte única; aqui ficam as constantes da marca e a função que monta a config a partir dele.
// Valor vazio = sem dado: o trecho correspondente sai do HTML (nada é inventado nem fica vazio).
import { yearsSince } from './src/years.js';

/** Constantes da marca (manual da marca §7); não são dados da empresa. */
export const brand = {
  name: 'Vanpack',
  slogan: 'Do projeto à entrega',
  description:
    'Fábrica de caixas de papelão ondulado personalizadas: sob medida e com a marca do cliente impressa.',
};

/**
 * Produtos da seção "O que fabricamos": texto genérico e sem números; o dono confere no go-live
 * (docs/go-live.md). O `id` vira o código de origem do botão ([site-produtos-<id>]) e o `subject`
 * completa a mensagem do WhatsApp ("Olá! Quero um orçamento de <subject>.").
 */
export const models = [
  {
    id: 'corte-e-vinco',
    name: 'Corte e vinco',
    subject: 'caixas com corte e vinco',
    text: 'Caixas com corte e vinco sob medida, para encaixe, tampa e formatos especiais.',
  },
  {
    id: 'divisorias',
    name: 'Divisórias, tabuleiros e separadores',
    subject: 'divisórias, tabuleiros e separadores',
    text: 'Separam, organizam e protegem o que vai dentro da caixa.',
  },
  {
    id: 'chapas',
    name: 'Chapas de papelão ondulado',
    subject: 'chapas de papelão ondulado',
    text: 'Chapas para embalar, proteger e forrar.',
  },
];

/**
 * Depoimentos e nota do Google: nada inventado. Só entra na página o item com `authorized: true` (e
 * registro em docs/provas/<id>.md), em qualquer modo; o JSON-LD nunca leva nota própria. Os clientes
 * da faixa de logos vêm do .env (VITE_CLIENT_<n>_*).
 */
export const proofs = {
  testimonials: [], // { id, quote, author, authorized: true }
  googleRating: null, // { value, count, url, authorized: true }
};

/** Depoimentos e nota do Google que a página mostra: só os autorizados. */
export function visibleProofs(items) {
  return {
    testimonials: items.testimonials.filter((item) => item.authorized === true),
    googleRating: items.googleRating?.authorized === true ? items.googleRating : null,
  };
}

/** Ícones dos diferenciais (VITE_DIFF_<n>_ICON): cada um é um <symbol id="i-<nome>"> do index.html. */
export const DIFF_ICONS = ['fabrica', 'lotes', 'conversa', 'caixa'];

/** Quantos diferenciais (VITE_DIFF_1_* a VITE_DIFF_6_*) e clientes (até VITE_CLIENT_12_*) o .env aceita. */
export const LIMITS = { diffs: 6, clients: 12 };

/** "Café & Cia." → "cafe-cia": o id do cliente, que nomeia o registro em docs/provas/<id>.md. */
export const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Clientes que a página mostra: em production só os que autorizaram (AUTH=sim); em demo todos, e o
 * não autorizado leva o rótulo "Exemplo".
 */
export const visibleClients = (clients, dataMode) =>
  clients.filter((client) => client.authorized || dataMode === 'demo');

/**
 * Experimentos A/B (src/experiments.js). Todos desligados: ligue com `enabled: true` e uma data fixa em
 * `endsAt` (depois dela só a variante A). `split` são os pesos das variantes, na ordem de `variants`.
 * `?exp_<nome>=A|B` na URL força a variante (QA e testes), mesmo desligado. Detalhes e a conta do
 * tamanho de amostra em docs/experimentos.md.
 */
export const experiments = {
  // B troca o CTA final por um assistente de 3 passos que monta a mensagem do WhatsApp.
  quote_wizard: { enabled: false, variants: ['A', 'B'], split: [50, 50], endsAt: '' },
};

const text = (value) => String(value ?? '').trim();

/** Servidor do Umami Cloud; `VITE_ANALYTICS_ENDPOINT` só muda numa instância própria. */
export const UMAMI_CLOUD = 'https://gateway.umami.is';

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

/**
 * Itens numerados do .env (VITE_<prefixo>_<n>_<CAMPO>, de 1 a `max`). Item sem o campo principal
 * (título do diferencial, nome do cliente) não existe.
 */
function numbered(env, prefix, max, main, read) {
  const items = [];
  for (let n = 1; n <= max; n++) {
    const field = (name) => text(env[`VITE_${prefix}_${n}_${name}`]);
    if (field(main)) items.push(read(field));
  }
  return items;
}

/** (11) 4700-1234 a partir de +551147001234; vazio se o telefone não tiver o formato do Brasil. */
function formatPhone(phone) {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : '';
}

/**
 * Monta a configuração do site a partir das variáveis VITE_* (o objeto que o `loadEnv` do Vite
 * devolve). Pura: não lê `process.env` nem arquivos.
 * @param {Record<string, string | undefined>} env
 * @param {Date} [now] data do build (ano do © e anos de mercado)
 */
export function createSiteConfig(
  env = {},
  now = new Date(),
  content = { models, proofs, experiments },
) {
  const city = text(env.VITE_CITY);
  const state = text(env.VITE_STATE);
  const phone = text(env.VITE_PHONE);
  const legalName = text(env.VITE_LEGAL_NAME);
  const whatsapp = text(env.VITE_WHATSAPP).replace(/\D/g, '');
  const foundedYear = text(env.VITE_FOUNDED_YEAR);
  const years = yearsSince(foundedYear, now);
  const cityState = city && state ? `${city}-${state}` : city || state;

  const site = {
    ...brand,
    content,
    dataMode: text(env.VITE_DATA_MODE),
    siteUrl: text(env.VITE_SITE_URL),
    whatsapp,
    // como aparece na folha "O WhatsApp não abriu?": (11) 91234-5678
    whatsappDisplay: whatsapp ? formatPhone(`+${whatsapp}`) || `+${whatsapp}` : '',
    phone,
    phoneDisplay: text(env.VITE_PHONE_DISPLAY) || formatPhone(phone) || phone,
    cnpj: text(env.VITE_CNPJ),
    legalName,
    address: {
      street: text(env.VITE_STREET),
      district: text(env.VITE_DISTRICT),
      city,
      state,
      postalCode: text(env.VITE_CEP),
      country: 'BR',
    },
    cityState,
    hours: text(env.VITE_HOURS),
    hoursSchema: text(env.VITE_HOURS_SCHEMA),
    mapUrl: text(env.VITE_MAP_URL),
    foundedYear,
    minOrder: text(env.VITE_MIN_ORDER),
    serviceArea: text(env.VITE_SERVICE_AREA),
    paymentMethods: text(env.VITE_PAYMENT_METHODS),
    // "Por que a Vanpack" e a faixa de logos
    differentials: numbered(env, 'DIFF', LIMITS.diffs, 'TITLE', (field) => ({
      title: field('TITLE'),
      text: field('TEXT'),
      icon: field('ICON'),
    })),
    clients: numbered(env, 'CLIENT', LIMITS.clients, 'NAME', (field) => ({
      id: slug(field('NAME')),
      name: field('NAME'),
      logo: field('LOGO'),
      authorized: field('AUTH').toLowerCase() === 'sim',
    })),
    analytics: {
      provider: text(env.VITE_ANALYTICS_PROVIDER),
      site: text(env.VITE_ANALYTICS_SITE),
      endpoint: text(env.VITE_ANALYTICS_ENDPOINT),
    },
    year: String(now.getFullYear()),
    yearsInBusiness: Number.isFinite(years) ? String(years) : '',
  };

  // O que vai ao navegador (define __SITE__): a medição só liga na página publicada (o host do site).
  site.client = {
    experiments: content.experiments ?? {},
    models: content.models.map(({ id, name }) => ({ id, name })), // assistente de orçamento
    analytics:
      site.analytics.provider === 'umami'
        ? {
            site: site.analytics.site,
            endpoint: (site.analytics.endpoint || UMAMI_CLOUD).replace(/\/+$/, ''),
            host: hostOf(site.siteUrl),
          }
        : null,
  };

  // Variáveis dos {{...}} do HTML. Vazia = o trecho que a usa tem de estar dentro de um elemento com
  // data-need.
  site.vars = {
    name: site.name,
    slogan: site.slogan,
    legalName,
    holder: legalName || site.name, // titular do ©
    cnpj: site.cnpj,
    street: site.address.street,
    district: site.address.district,
    city,
    state,
    cityState,
    postalCode: site.address.postalCode,
    phoneDisplay: site.phoneDisplay,
    phone,
    whatsapp, // folha "O WhatsApp não abriu?": o número para copiar
    whatsappDisplay: site.whatsappDisplay,
    hours: site.hours,
    foundedYear,
    yearsInBusiness: site.yearsInBusiness,
    year: site.year,
    // política de privacidade: a ferramenta de medição (ou a ausência dela)
    analyticsName: site.analytics.provider === 'umami' ? 'Umami Cloud' : '',
    noAnalytics: site.analytics.provider ? '' : 'sim',
    // seções que só existem se tiverem algo a mostrar
    hasFacts: site.minOrder || site.serviceArea ? 'sim' : '',
    hasDiffs: site.differentials.length ? 'sim' : '',
    hasProofs: (() => {
      const shown = visibleProofs(content.proofs);
      const clients = visibleClients(site.clients, site.dataMode);
      return clients.length || shown.testimonials.length || shown.googleRating ? 'sim' : '';
    })(),
    // a faixa de confiança só existe se tiver ao menos um item
    hasTrust: [cityState, site.cnpj, foundedYear, site.mapUrl, phone, site.paymentMethods].some(
      Boolean,
    )
      ? 'sim'
      : '',
    minOrder: site.minOrder,
    serviceArea: site.serviceArea,
    paymentMethods: site.paymentMethods,
    // título e descrição da página (title, og e twitter); a cidade entra só se houver
    title: `Caixas de papelão sob medida com a sua marca | ${site.name}${city ? ` ${city}` : ''}`,
    description: [
      'Caixas de papelão ondulado sob medida, com a sua marca impressa.',
      cityState && `Fábrica em ${cityState}.`,
      'Peça seu orçamento pelo WhatsApp.',
    ]
      .filter(Boolean)
      .join(' '),
  };
  return site;
}
