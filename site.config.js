// Configuração do site. Todo dado da empresa (CNPJ, telefone, endereço, prazos…) vive só no `.env`, a
// fonte única; aqui ficam as constantes da marca e a função que monta a config a partir dele.
// Valor vazio = sem dado: o trecho correspondente sai do HTML (nada é inventado nem fica vazio).
import { yearsSince } from './src/years.js';

/** Constantes da marca (manual da marca §7); não são dados da empresa. */
export const brand = {
  name: 'Vanpack',
  slogan: 'Do projeto à entrega',
  description:
    'Fábrica de caixas de papelão ondulado personalizadas: sob medida e com a marca do cliente impressa.',
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
export function createSiteConfig(env = {}, now = new Date()) {
  const city = text(env.VITE_CITY);
  const state = text(env.VITE_STATE);
  const phone = text(env.VITE_PHONE);
  const legalName = text(env.VITE_LEGAL_NAME);
  const foundedYear = text(env.VITE_FOUNDED_YEAR);
  const years = yearsSince(foundedYear, now);
  const cityState = city && state ? `${city}-${state}` : city || state;

  const site = {
    ...brand,
    dataMode: text(env.VITE_DATA_MODE),
    siteUrl: text(env.VITE_SITE_URL),
    whatsapp: text(env.VITE_WHATSAPP).replace(/\D/g, ''),
    phone,
    phoneDisplay: text(env.VITE_PHONE_DISPLAY) || formatPhone(phone),
    email: text(env.VITE_EMAIL),
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
    leadTimeDays: text(env.VITE_LEAD_TIME_DAYS),
    serviceArea: text(env.VITE_SERVICE_AREA),
    responseTime: text(env.VITE_RESPONSE_TIME),
    paymentMethods: text(env.VITE_PAYMENT_METHODS),
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
    analytics:
      site.analytics.provider === 'umami'
        ? {
            site: site.analytics.site,
            endpoint: (site.analytics.endpoint || UMAMI_CLOUD).replace(/\/+$/, ''),
            host: hostOf(site.siteUrl),
          }
        : null,
  };

  // Variáveis dos {{...}} do HTML (e, adiante, das respostas do FAQ). Vazia = o trecho que a usa tem
  // de estar dentro de um elemento com data-need.
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
    email: site.email,
    phone,
    hours: site.hours,
    foundedYear,
    yearsInBusiness: site.yearsInBusiness,
    year: site.year,
    // política de privacidade: a ferramenta de medição (ou a ausência dela)
    analyticsName: site.analytics.provider === 'umami' ? 'Umami Cloud' : '',
    noAnalytics: site.analytics.provider ? '' : 'sim',
    // a faixa de confiança só existe se tiver ao menos um item
    hasTrust: [cityState, site.cnpj, foundedYear, site.mapUrl, phone, site.email].some(Boolean)
      ? 'sim'
      : '',
    minOrder: site.minOrder,
    leadTimeDays: site.leadTimeDays,
    serviceArea: site.serviceArea,
    responseTime: site.responseTime,
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
