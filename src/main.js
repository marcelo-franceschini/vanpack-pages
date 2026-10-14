// Interface da página: progresso do scroll, cartões da história, rota, tour automático, header,
// botão flutuante e medição. Tudo que é 3D fica em ./render.
import { mountStage } from './render/stage.js';
import { createRoute } from './route.js';
import { createTour } from './tour.js';
import { createPins } from './pins.js';
import { sinceLoad, track, trackOnce } from './analytics.js';

const story = document.querySelector('.story');
const header = document.getElementById('hdr');
const cue = document.getElementById('cue');
const fab = document.getElementById('fab');
const dock = header.querySelector('.btn');
const routeEl = document.getElementById('route');
const toggleBtn = document.getElementById('tour-toggle');
const startLink = document.getElementById('tour-start');
const pinsEl = document.getElementById('pins');
const cards = [...document.querySelectorAll('.card')];

const params = new URLSearchParams(location.search);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const LAST = cards.length - 1;
const DEPTHS = [25, 50, 75, 100];

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const setClass = (el, name, on) => el.classList.toggle(name, on);

// Medidas em cache: o scroll só lê scrollY, sem forçar layout.
let storyTop = 0;
let storyRange = 1;
let docHeight = 1;
function measure() {
  storyTop = story.getBoundingClientRect().top + scrollY;
  storyRange = Math.max(1, story.offsetHeight - innerHeight);
  docHeight = document.documentElement.scrollHeight;
}
const progressAt = (y) => clamp((y - storyTop) / storyRange);
const yAt = (p) => storyTop + p * storyRange;

let active = 0; // o 1º cartão já vem ativo no HTML
let lastAnchors = [];
const pins = createPins(pinsEl);

measure();
const stage = mountStage(document.getElementById('stage'), progressAt(scrollY), {
  onAnchors: (list) => {
    lastAnchors = list;
    pins.update(list, active);
  },
});

// ---------- Tour automático ----------
let interacted = false; // a pessoa já mexeu na página antes de o tour começar?
const markInteraction = (e) => {
  if (interacted) return;
  interacted = true;
  track('first_interaction', { type: e.type, t: sinceLoad() });
};
for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
  addEventListener(type, markInteraction, { capture: true, passive: true });
}

const TOUR_BUTTON = {
  idle: ['play', 'Ver passo a passo'],
  playing: ['pause', 'Pausar'],
  paused: ['play', 'Continuar'],
  done: ['replay', 'Rever'],
};
let stageOk = false; // 3D funcionando
const tourAvailable = () => stageOk && !reducedMotion.matches;

function syncTour(state) {
  story.dataset.tour = state;
  toggleBtn.hidden = !tourAvailable();
  const [icon, label] = TOUR_BUTTON[state];
  toggleBtn.querySelector('use').setAttribute('href', `#i-${icon}`);
  toggleBtn.querySelector('.label').textContent = label;
  if (state === 'paused') stage.setSway(true);
  else if (state === 'playing') stage.setSway(false);
}

const tour = createTour({
  getProgress: () => progressAt(scrollY),
  yAt,
  speed: params.get('tour') === 'fast' ? 2 : 1,
  onState: syncTour,
  onEvent: track,
  isUi: (el) => Boolean(el?.closest?.('[data-tour-ui]')),
});

toggleBtn.addEventListener('click', () => {
  if (tour.state === 'playing') tour.pause('button');
  else if (tour.state === 'paused') tour.resume();
  else tour.start({ auto: false });
});

// "Ver como fazemos": com o tour disponível, toca o passo a passo; sem ele, o link âncora leva ao capítulo 2.
startLink.addEventListener('click', (e) => {
  if (!tourAvailable()) return;
  e.preventDefault();
  tour.start({ auto: false });
});

stage.ready.then((ok) => {
  stageOk = ok;
  syncTour(tour.state);
  const auto =
    tourAvailable() && params.get('tour') !== '0' && !location.hash && !interacted && scrollY < 40;
  if (!auto) return;
  setTimeout(() => {
    if (!interacted && scrollY < 40 && tour.state === 'idle') tour.start({ auto: true });
  }, 800);
});

reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) tour.pause('reduced');
  syncTour(tour.state);
});

// ---------- Rota ----------
function pulseDock() {
  if (reducedMotion.matches) return;
  dock.classList.add('pulse');
  dock.addEventListener('animationend', () => dock.classList.remove('pulse'), { once: true });
}

function goToChapter(i) {
  tour.pause('stop');
  scrollTo({ top: yAt(i / LAST), behavior: reducedMotion.matches ? 'auto' : 'smooth' });
}

routeEl.hidden = false;
const route = createRoute(routeEl, { dock, onStop: goToChapter, onArrive: pulseDock });

// ---------- Scroll → estado da página ----------
let last = { progress: -1, solid: null, cue: null, fab: null };
let queued = false;
let idleTimer = null;

function notifyActivity() {
  stage.setSway(false);
  clearTimeout(idleTimer);
  if (!reducedMotion.matches && tour.state !== 'playing') {
    idleTimer = setTimeout(() => {
      const p = progressAt(scrollY);
      if (p >= 0 && p <= 1) stage.setSway(true);
    }, 1500);
  }
}

function update() {
  queued = false;
  const y = scrollY;
  const progress = progressAt(y);
  const auto = tour.state === 'playing';
  const index = Math.round(progress * LAST);
  if (index !== active) {
    setClass(cards[active], 'on', false);
    setClass(cards[index], 'on', true);
    active = index;
    pins.update(lastAnchors, active);
    trackOnce(`chapter-${index}`, 'chapter_view', { chapter: index + 1, auto });
  }
  const state = { progress, solid: y > 40, cue: progress > 0.02, fab: progress >= 0.99 };
  if (state.solid !== last.solid) setClass(header, 'solid', state.solid);
  if (state.cue !== last.cue) setClass(cue, 'gone', state.cue);
  if (state.fab !== last.fab) setClass(fab, 'on', state.fab);
  if (progress !== last.progress) {
    stage.setProgress(progress);
    route.setProgress(progress);
    notifyActivity();
  }
  const depth = ((y + innerHeight) / docHeight) * 100;
  for (const d of DEPTHS) {
    if (depth >= d - 0.5) trackOnce(`depth-${d}`, 'scroll_depth', { pct: d, auto });
  }
  last = state;
}

function schedule() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(update);
  }
}

function remeasure() {
  measure();
  schedule();
}
addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', remeasure);
new ResizeObserver(remeasure).observe(story);
update();

// ---------- Conversão ----------
// Cada botão do WhatsApp tem data-cta com o ponto de contato.
document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[data-cta]');
  if (link) track('whatsapp_click', { cta: link.dataset.cta });
});
const finalCta = document.querySelector('#orcamento .btn');
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
