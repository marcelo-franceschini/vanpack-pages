// Configuração do site: junta o conteúdo editável (content/, lido e validado por build/content.js) com o
// que muda por ambiente (.env: modo, URL do site e medição) e monta tudo o que o build precisa (as
// variáveis dos textos, a config da medição). Nenhum dado nem texto de negócio fica escrito aqui.
// Valor vazio = sem dado: o trecho correspondente sai do HTML (nada é inventado nem fica vazio).
import { yearsSince } from './src/years.js';

/** Ícones dos diferenciais (diferenciais.yaml): cada um é um <symbol id="i-<nome>"> do index.html. */
export const DIFF_ICONS = ['fabrica', 'lotes', 'conversa', 'caixa'];

/** Variáveis que os textos de content/ e os data-need do HTML podem usar (`{{cidade}}`...). */
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

/** Variáveis cujo valor já é HTML montado aqui (o número que o navegador recalcula): não são escapadas. */
export const RICH_VARS = new Set(['anos', 'ano']);

/** "Café & Cia." → "cafe-cia": o id do cliente, que nomeia o registro em docs/provas/<id>.md. */
export const slug = (name) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * Depoimentos e nota do Google que a página mostra: só os autorizados (e com registro em
 * docs/provas/<id>.md). O JSON-LD nunca leva nota própria.
 */
export function visibleProofs(items) {
  return {
    testimonials: items.testimonials.filter((item) => item.authorized === true),
    googleRating: items.googleRating?.authorized === true ? items.googleRating : null,
  };
}

/**
 * Clientes que a página mostra: em production só os que autorizaram; em demo todos, e o não autorizado
 * leva o rótulo "Exemplo".
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

/** (11) 4700-1234 a partir de +551147001234; vazio se o telefone não tiver o formato do Brasil. */
function formatPhone(phone) {
  const match = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(phone);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : '';
}

/**
 * Monta a configuração do site. Pura: não lê `process.env` nem arquivos.
 * @param {object} options
 * @param {Record<string, string | undefined>} [options.env] variáveis VITE_* do ambiente (modo, URL, medição)
 * @param {Record<string, any>} options.content o conteúdo de content/ (ver build/content.js)
 * @param {Date} [options.now] data do build (ano do © e anos de mercado)
 * @param {typeof experiments} [options.experiments] experimentos A/B
 */
export function createSiteConfig({
  env = {},
  content,
  now = new Date(),
  experiments: tests = experiments,
}) {
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
    dataMode: text(env.VITE_DATA_MODE),
    siteUrl: text(env.VITE_SITE_URL),
    whatsapp,
    // como aparece na folha "O WhatsApp não abriu?": (11) 91234-5678
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
    // "Por que a Vanpack" e a faixa de logos
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

  // O que vai ao navegador (define __SITE__): a medição só liga na página publicada (o host do site) e só em
  // production: o site de demonstração tem CNPJ e telefone fictícios e não pode somar visitas ao Umami.
  site.client = {
    experiments: tests ?? {},
    models: products.map(({ id, nome }) => ({ id, name: nome })), // assistente de orçamento
    analytics:
      site.analytics.provider === 'umami' && site.dataMode === 'production'
        ? {
            site: site.analytics.site,
            endpoint: (site.analytics.endpoint || UMAMI_CLOUD).replace(/\/+$/, ''),
            host: hostOf(site.siteUrl),
          }
        : null,
  };

  // Variáveis dos {{...}} do HTML e dos textos de content/. Vazia = o trecho que a usa tem de estar
  // dentro de um elemento com data-need (ou de um {{#se}}).
  const shownProofs = visibleProofs(site.proofs);
  const shownClients = visibleClients(site.clients, site.dataMode);
  site.vars = {
    nome: site.name,
    razao_social: legalName,
    titular: legalName || site.name, // titular do ©
    cnpj: site.cnpj,
    rua: site.address.street,
    bairro: site.address.district,
    cidade: city,
    uf: state,
    cidade_uf: cityState,
    cep: site.address.postalCode,
    telefone_exibicao: site.phoneDisplay,
    telefone: phone,
    whatsapp, // folha "O WhatsApp não abriu?": o número para copiar
    whatsapp_exibicao: site.whatsappDisplay,
    horario: site.hours,
    ano_fundacao: foundedYear,
    // os números que o navegador recalcula (src/main.js lê data-since e data-year)
    anos: site.yearsInBusiness
      ? `<span data-since="${foundedYear}">${site.yearsInBusiness}</span>`
      : '',
    ano: `<span data-year>${site.year}</span>`,
    ano_atual: site.year, // o mesmo ano em texto puro, para a página sem script (política de privacidade)
    // política de privacidade: a ferramenta de medição (ou a ausência dela)
    medicao_nome: site.analytics.provider === 'umami' ? 'Umami Cloud' : '',
    sem_medicao: site.analytics.provider ? '' : 'sim',
    // seções que só existem se tiverem algo a mostrar
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
