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
 * Perguntas do FAQ. Os {{placeholders}} das respostas vêm do .env; a pergunta cujo dado falta some.
 * "Nunca pedimos pagamento para conta de pessoa física" também funciona como defesa contra golpe.
 */
export const faq = [
  { id: 'minimo', q: 'Qual o pedido mínimo?', a: 'A partir de {{minOrder}} caixas por modelo.' },
  {
    id: 'entrega',
    q: 'Entregam na minha cidade?',
    a: 'Entregamos em {{serviceArea}}. Para outras regiões, consulte o frete.',
  },
  {
    id: 'medida',
    q: 'Não sei a medida da caixa. E agora?',
    a: 'Mande a medida do produto ou uma foto dele com uma régua ao lado, que a gente ajuda.',
  },
  {
    id: 'logo',
    q: 'Como envio minha logo?',
    a: 'Pelo próprio WhatsApp, em PDF, SVG ou PNG de boa resolução, com prova aprovada antes da produção.',
  },
  {
    id: 'pagamento',
    q: 'Formas de pagamento?',
    a: '{{paymentMethods}}. Nunca pedimos pagamento para conta de pessoa física.',
  },
  {
    id: 'confianca',
    q: 'Como sei que a Vanpack é confiável?',
    a: 'Somos a {{legalName}}, CNPJ {{cnpj}}, com fábrica em {{street}}, {{city}}. Pode nos visitar.',
  },
  {
    // o WhatsApp é atendido pelo assistente; a saída para uma pessoa é o telefone
    id: 'pessoa',
    q: 'Posso falar com uma pessoa?',
    a: 'Pode. Ligue para {{phoneDisplay}}, {{hours}}.',
  },
  {
    id: 'onda',
    q: 'Onda simples ou dupla?',
    a: 'A dupla é mais resistente, indicada para produtos pesados ou empilhamento alto. Ajudamos a escolher.',
  },
];

/**
 * Prova social: nada inventado. Só entra na página o item com `authorized: true` (e registro em
 * docs/provas/<id>.md). Itens `demo: true` são de exemplo: só aparecem em modo demo, com o rótulo
 * "Exemplo", e nunca em production. A nota do Google só vale com `authorized` (sem versão demo).
 * Logos de clientes só em SVG (public/clientes/<id>.svg), sempre com autorização.
 */
export const proofs = {
  testimonials: [
    {
      id: 'exemplo-ecommerce',
      demo: true,
      quote: 'As caixas chegaram na medida certa e com a nossa marca bem impressa.',
      author: 'Loja virtual de cosméticos',
    },
    {
      id: 'exemplo-industria',
      demo: true,
      quote: 'Pedimos a mesma caixa várias vezes e o padrão nunca mudou.',
      author: 'Indústria de alimentos',
    },
  ],
  clientLogos: [], // { id, name, src: '/clientes/<id>.svg', authorized: true }
  googleRating: null, // { value, count, url, authorized: true }
};

/** O que a página mostra da prova social neste modo (demo mostra os exemplos; production só o autorizado). */
export function visibleProofs(items, dataMode) {
  const shown = (item) => item.authorized === true || (item.demo === true && dataMode === 'demo');
  return {
    testimonials: items.testimonials.filter(shown),
    clientLogos: items.clientLogos.filter(shown),
    googleRating: items.googleRating?.authorized === true ? items.googleRating : null,
  };
}

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
  content = { models, faq, proofs, experiments },
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
    hasProofs: (() => {
      const shown = visibleProofs(content.proofs, text(env.VITE_DATA_MODE));
      return shown.testimonials.length || shown.clientLogos.length || shown.googleRating
        ? 'sim'
        : '';
    })(),
    // a faixa de confiança só existe se tiver ao menos um item
    hasTrust: [cityState, site.cnpj, foundedYear, site.mapUrl, phone].some(Boolean) ? 'sim' : '',
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
