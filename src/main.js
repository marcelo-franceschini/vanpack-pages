// Orquestra a página: liga o scroll à cena 3D, roda o tour automático e mede o uso.
// Tudo que é 3D fica em ./render e ./scene.
import { sinceLoad, track, trackOnce } from './analytics.js';
import { mountStage } from './render/stage.js';
import { createStory } from './story.js';
import { createTour } from './tour.js';

const $ = (selector) => document.querySelector(selector);
const storyEl = $('.story');
const dock = $('#hdr .btn'); // "Pedir orçamento" do cabeçalho: pulsa quando o tour termina
const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const DEPTHS = [25, 50, 75, 100];
const AUTOPLAY_DELAY = 800; // ms depois de a cena ficar pronta

let stageOk = false; // 3D funcionando
// O tour é criado mais abaixo; os callbacks da história só o leem quando chamados.
let tour = null;

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
const tourAvailable = () => stageOk && !reducedMotion.matches;

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
  if (reducedMotion.matches) tour.pause('reduced');
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

function startAutoplay() {
  const canStart =
    tourAvailable() &&
    params.get('tour') !== '0' &&
    !location.hash &&
    !interacted &&
    scrollY < 40 &&
    tour.state === 'idle';
  if (!canStart) return;
  // aba em segundo plano: espera a pessoa voltar para começar
  if (document.hidden) {
    document.addEventListener('visibilitychange', () => setTimeout(startAutoplay, AUTOPLAY_DELAY), {
      once: true,
    });
    return;
  }
  tour.start({ auto: true });
}

stage.ready.then((ok) => {
  stageOk = ok;
  setTimeout(startAutoplay, AUTOPLAY_DELAY);
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
