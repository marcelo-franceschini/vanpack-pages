// Interface da página: progresso do scroll, cartões da história, header, botão flutuante
// e medição dos cliques no WhatsApp. Tudo que é 3D fica em ./render.
import { mountStage } from './render/stage.js';

const story = document.querySelector('.story');
const header = document.getElementById('hdr');
const cue = document.getElementById('cue');
const fab = document.getElementById('fab');
const cards = [...document.querySelectorAll('.card')];
const dots = [...document.querySelectorAll('#dots li')];

// Medidas em cache: o scroll só lê scrollY, sem forçar layout.
let storyTop = 0;
let storyRange = 1;
function measure() {
  storyTop = story.getBoundingClientRect().top + scrollY;
  storyRange = Math.max(1, story.offsetHeight - innerHeight);
}

const progressAt = (y) => Math.min(1, Math.max(0, (y - storyTop) / storyRange));
const setClass = (el, name, on) => el.classList.toggle(name, on);

measure();
const stage = mountStage(document.getElementById('stage'), progressAt(scrollY));

let active = 0; // o 1º cartão já vem ativo no HTML
let last = { progress: -1, solid: null, cue: null, fab: null };
let queued = false;

function update() {
  queued = false;
  const y = scrollY;
  const progress = progressAt(y);
  const index = Math.round(progress * (cards.length - 1));
  if (index !== active) {
    setClass(cards[active], 'on', false);
    setClass(dots[active], 'on', false);
    setClass(cards[index], 'on', true);
    setClass(dots[index], 'on', true);
    active = index;
  }
  const state = { progress, solid: y > 40, cue: progress > 0.02, fab: progress >= 0.99 };
  if (state.solid !== last.solid) setClass(header, 'solid', state.solid);
  if (state.cue !== last.cue) setClass(cue, 'gone', state.cue);
  if (state.fab !== last.fab) setClass(fab, 'on', state.fab);
  if (progress !== last.progress) stage.setProgress(progress);
  last = state;
}

function schedule() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(update);
  }
}

addEventListener('scroll', schedule, { passive: true });
addEventListener('resize', () => {
  measure();
  schedule();
});
new ResizeObserver(() => {
  measure();
  schedule();
}).observe(story);
update();

// Conversão: cada botão do WhatsApp tem data-cta com o ponto de contato (pronto para GTM/GA4).
window.dataLayer = window.dataLayer || [];
document.addEventListener('click', (e) => {
  const link = e.target.closest?.('a[data-cta]');
  if (link) window.dataLayer.push({ event: 'whatsapp_click', cta: link.dataset.cta });
});
