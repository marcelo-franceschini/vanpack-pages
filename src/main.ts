import { mountStage } from './render/stage.js';
import { createStory } from './story.js';
import { observeProdutos } from './produtos/gatilho.js';
import { initAnalytics } from './telemetry/analytics';
import { mountClientShowcase } from './ui/carousel';
import { mountWhatsAppHandoff } from './ui/handoff';
import { mountQuickQuote } from './ui/quick-quote';
import { updateYears } from './ui/years';

function bindMobileMenu(): void {
  const menu = document.querySelector<HTMLDetailsElement>('.nav-m');
  if (!menu) return;
  for (const link of menu.querySelectorAll('a')) {
    link.addEventListener('click', () => {
      menu.open = false;
    });
  }
}

function onIdle(cb: () => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => cb(), { timeout: 1500 });
  } else {
    setTimeout(cb, 50);
  }
}

// Inicializações básicas imediatas
updateYears();
bindMobileMenu();

// 1. Hero e Fábrica 3D
const stageEl = document.getElementById('stage');
const storyEl = document.querySelector<HTMLElement>('.story');
const headerEl = document.querySelector<HTMLElement>('#hdr');
const cueEl = document.getElementById('cue');
const fabEl = document.getElementById('fab');
const cards = [...document.querySelectorAll<HTMLElement>('.card')];

if (stageEl && storyEl) {
  const stage = mountStage(stageEl);
  createStory({
    story: storyEl,
    stage: stageEl,
    header: headerEl,
    cue: cueEl,
    fab: fabEl,
    cards,
    onProgress: (p: number) => stage.setProgress(p),
    onChapter: (_index: number) => {},
  });

  stage.ready.then(() => {
    stageEl.classList.add('ready');
  });
}

// 2. Vitrine 3D dos Produtos e seções inferiores (diferidas para não disputar CPU com o Hero)
onIdle(() => {
  observeProdutos();
  mountClientShowcase();
  mountQuickQuote(__SITE__.whatsapp);
  mountWhatsAppHandoff();
  initAnalytics();
});
