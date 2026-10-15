// Orquestra a página: liga o scroll à cena 3D, roda o tour automático e mede o uso.
// Tudo que é 3D fica em ./render e ./scene.
import { sinceLoad, track, trackOnce } from './analytics.js';
import { mountStage } from './render/stage.js';
import { createStory } from './story.js';
import { createTour } from './tour.js';
import { yearsSince } from './years.js';

const $ = (selector) => document.querySelector(selector);

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
// Cada botão do WhatsApp tem data-cta com o ponto de contato.
document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[data-cta]');
  if (link) track('whatsapp_click', { cta: link.dataset.cta });
});
const finalCta = $('#orcamento .btn');
if (finalCta) {
  new IntersectionObserver(
    ([entry], observer) => {
      if (!entry.isIntersecting) return;
      trackOnce('cta-view', 'cta_view', {});
      observer.disconnect();
    },
    { threshold: 0.6 },
  ).observe(finalCta);
}
