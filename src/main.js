// Orquestra a página: liga o scroll à cena 3D, roda o tour automático e mede o uso.
// Tudo que é 3D fica em ./render e ./scene.
import { sinceLoad, track, trackOnce } from './analytics.js';
import { startExperiments, variant } from './experiments.js';
import { mountStage } from './render/stage.js';
import { createStory } from './story.js';
import { createTour } from './tour.js';
import { watchVitals } from './vitals.js';
import { yearsSince } from './years.js';

const $ = (selector) => document.querySelector(selector);

// Experimentos A/B: resolvidos antes de qualquer evento, para todo evento levar a variante.
startExperiments();

// Textos que dependem do ano corrente (anos de mercado, ©): o build escreve o valor do dia do deploy
// e aqui ele é recalculado, para não envelhecer entre um deploy e outro.
for (const el of document.querySelectorAll('[data-since]')) {
  const years = yearsSince(el.dataset.since);
  if (Number.isFinite(years)) el.textContent = String(years);
}
for (const el of document.querySelectorAll('[data-year]')) {
  el.textContent = String(new Date().getFullYear());
}

const storyEl = $('.story');
const dock = $('#hdr .btn'); // "Pedir orçamento" do cabeçalho: pulsa quando o tour termina
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DEPTHS = [25, 50, 75, 100];

let stageOk = false; // 3D funcionando
// O tour é criado mais abaixo; os callbacks da história só o leem quando chamados.
let tour = null;

// F5 recomeça do topo e o tour toca; sem isso o navegador restaura o scroll e o tour não começa.
// Voltar e avançar continuam com a posição restaurada. O navegador restaura no reload mesmo com
// history.scrollRestoration = 'manual' (medido), às vezes depois do nosso código: por isso a
// restauração também é desfeita por evento, mais abaixo.
const reloaded = performance.getEntriesByType('navigation')[0]?.type === 'reload' && !location.hash;
if (reloaded) scrollTo(0, 0);

// ---------- Cena e scroll ----------
// O worker é criado primeiro (o download dele é o que mais demora); a história lê o layout depois.
const stage = mountStage($('#stage'));
const story = createStory({
  story: storyEl,
  stage: $('#stage'),
  header: $('#hdr'),
  cue: $('#cue'),
  fab: $('#fab'),
  cards: [...document.querySelectorAll('.card')],
  onProgress: (p) => stage.setProgress(p),
  onChapter: (index) =>
    trackOnce(`chapter-${index}`, 'chapter_view', {
      chapter: index + 1,
      auto: tour?.state === 'playing',
    }),
  onScroll: (y, docHeight) => {
    const depth = ((y + innerHeight) / docHeight) * 100;
    for (const d of DEPTHS) {
      if (depth >= d - 0.5) {
        trackOnce(`depth-${d}`, 'scroll_depth', { pct: d, auto: tour?.state === 'playing' });
      }
    }
  },
});

// ---------- Tour automático ----------
// A página rola sozinha pelos capítulos (a cena continua ligada ao scroll) e para no fim da
// história. Qualquer interação da pessoa interrompe, e o tour nunca retoma sozinho.
// ?tour=1 (QA) força o tour mesmo com movimento reduzido no sistema; ?tour=0 desliga o autoplay.
const forceTour = params.get('tour') === '1';
const tourAvailable = () => stageOk && (forceTour || !reducedMotion.matches);

function pulseDock() {
  if (reducedMotion.matches) return;
  dock.classList.add('pulse');
  dock.addEventListener('animationend', () => dock.classList.remove('pulse'), { once: true });
}

function goToChapter(index) {
  tour.pause('stop');
  scrollTo({
    top: story.yAt(index / story.lastChapter),
    behavior: reducedMotion.matches ? 'auto' : 'smooth',
  });
}

tour = createTour({
  getProgress: story.progress,
  yAt: story.yAt,
  onState: (state) => {
    storyEl.dataset.tour = state;
    if (state === 'done') pulseDock();
  },
  onEvent: track,
  isUi: (el) => Boolean(el?.closest?.('[data-tour-ui]')),
});

// "Ver como fazemos": com o tour disponível, toca o passo a passo; sem ele, leva ao capítulo 2.
$('#tour-start').addEventListener('click', (e) => {
  e.preventDefault();
  if (tourAvailable()) tour.start({ auto: false });
  else goToChapter(1);
});

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && !forceTour) tour.pause('reduced');
});

// A pessoa já mexeu na página antes de o tour começar?
let interacted = false;
const markInteraction = (e) => {
  if (interacted) return;
  interacted = true;
  track('first_interaction', { type: e.type, t: sinceLoad() });
};
for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
  addEventListener(type, markInteraction, { capture: true, passive: true });
}

// Depois de um F5, volta ao topo se o navegador restaurar o scroll, até a pessoa mexer ou o tour
// decidir se começa.
const undoRestore = () => {
  if (!interacted && tour.state === 'idle' && scrollY >= 40) scrollTo(0, 0);
};
if (reloaded) addEventListener('scroll', undoRestore, { passive: true });

/** Por que o autoplay não pode começar agora (ou null, se pode). */
function whyNoAutoplay() {
  if (!stageOk) return 'a cena 3D não iniciou (sem WebGL?)';
  if (!tourAvailable()) return 'movimento reduzido no sistema (?tour=1 força o autoplay)';
  if (params.get('tour') === '0') return '?tour=0 na URL';
  if (location.hash) return '#hash na URL';
  if (interacted) return 'a pessoa já mexeu na página';
  if (scrollY >= 40) return 'a página não está no topo';
  if (tour.state !== 'idle') return `o tour já está em "${tour.state}"`;
  return null;
}

function startAutoplay() {
  if (reloaded) undoRestore(); // o evento de scroll da restauração pode ainda não ter chegado
  const reason = whyNoAutoplay();
  if (reason) {
    console.info(`[vanpack] autoplay não iniciou: ${reason}`);
    return;
  }
  // aba em segundo plano: espera a pessoa voltar para começar
  if (document.hidden) {
    document.addEventListener('visibilitychange', startAutoplay, { once: true });
    return;
  }
  tour.start({ auto: true });
}

// Sem espera: o tour começa no instante em que a cena fica pronta.
stage.ready.then((ok) => {
  stageOk = ok;
  startAutoplay();
  removeEventListener('scroll', undoRestore);
});

// ---------- Conversão ----------
// Cada botão do WhatsApp tem data-cta com o ponto de contato, e o build já põe o código [site-<cta>]
// no fim da mensagem. Se a visita veio de uma campanha, a origem (utm_source e utm_campaign da URL)
// entra no texto também: o wa.me ignora parâmetros extras, é no texto que o dono a enxerga. Sem
// cookie nem storage, e só valores simples (letras, números, "." "_" "-", até 40 caracteres), para
// um link forjado não injetar texto na mensagem.
const campaign = ['utm_source', 'utm_campaign']
  .map((key) => params.get(key) ?? '')
  .filter((value) => /^[\w.-]{1,40}$/.test(value))
  .join('/');

function addCampaign(link) {
  if (!campaign) return;
  const url = new URL(link.href);
  const message = url.searchParams.get('text');
  if (!message || message.includes('[utm:')) return;
  link.href = `${url.origin}${url.pathname}?text=${encodeURIComponent(`${message} [utm: ${campaign}]`)}`;
}

document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[data-cta]');
  if (link) {
    addCampaign(link);
    track('whatsapp_click', { cta: link.dataset.cta });
  }
  // telefone, e-mail e mapa (data-contact="phone|email|map"); cta é o lugar da página do link
  const contact = e.target.closest?.('a[data-contact]');
  if (contact) {
    const place = contact.closest('footer') ? 'rodape' : (contact.closest('[id]')?.id ?? 'pagina');
    track(`${contact.dataset.contact}_click`, { cta: place });
  }
});
// Experimento quote_wizard: na variante B o CTA final vira um assistente de 3 passos (src/wizard.js,
// carregado só nessa variante). O cta_view passa a observar o assistente.
const wizardReady =
  variant('quote_wizard') === 'B'
    ? import('./wizard.js').then(({ mountQuoteWizard }) =>
        mountQuoteWizard($('#orcamento'), { models: __SITE__.models ?? [] }),
      )
    : Promise.resolve();
wizardReady.then(() => {
  const finalCta = $('#orcamento .wizard') ?? $('#orcamento .btn');
  if (!finalCta) return;
  new IntersectionObserver(
    ([entry], observer) => {
      if (!entry.isIntersecting) return;
      trackOnce('cta-view', 'cta_view', {});
      observer.disconnect();
    },
    { threshold: 0.6 },
  ).observe(finalCta);
});

// O botão fixo do WhatsApp (barra no celular) sai de cena quando o CTA final já está bem à vista.
const fab = $('#fab');
const quote = $('#orcamento');
if (fab && quote) {
  new IntersectionObserver(
    ([entry]) => fab.classList.toggle('away', entry.intersectionRatio >= 0.3),
    {
      threshold: [0.3],
    },
  ).observe(quote);
}

// ---------- Uso da página ----------
// section_view: a seção conta quando metade dela está à vista, ou metade da tela nas seções mais altas
// que a tela (que nunca chegariam a 50% de si mesmas). #processo é a história 3D e já tem chapter_view.
const sectionView = new IntersectionObserver(
  (entries) => {
    for (const { target, intersectionRect, boundingClientRect } of entries) {
      const needed = Math.min(boundingClientRect.height, innerHeight) * 0.5;
      if (intersectionRect.height >= needed) {
        trackOnce(`section-${target.id}`, 'section_view', { section_id: target.id });
      }
    }
  },
  { threshold: Array.from({ length: 11 }, (_, i) => i / 10) },
);
for (const section of document.querySelectorAll('main section[id]:not(#processo)')) {
  sectionView.observe(section);
}

// faq_open: o evento `toggle` do <details> não borbulha, então só chega em fase de captura.
document.addEventListener(
  'toggle',
  (e) => {
    const question = e.target;
    if (question.open && question.dataset?.faq) {
      track('faq_open', { question_id: question.dataset.faq });
    }
  },
  true,
);

watchVitals((name, value) => {
  track('web_vitals', {
    name,
    value: name === 'CLS' ? Math.round(value * 1000) / 1000 : Math.round(value),
  });
});
