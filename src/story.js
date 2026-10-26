// A história ligada ao scroll: converte scrollY em progresso (0…1), troca o cartão ativo e atualiza
// cabeçalho, dica de scroll e botão flutuante. As medidas ficam em cache: o scroll só lê scrollY.

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
// No desktop o botão flutuante só aparece depois do fim da história (px além dele): o do cabeçalho já
// está à mão do mouse. Até 768 px (a barra de largura total, a mesma quebra do CSS) a barra aparece a
// partir do 2º capítulo: o cartão 1 tem o botão grande, e do 2 ao 5 o polegar fica sem botão perto.
// Os cartões 2 a 5 reservam o espaço da barra (index.html), então ela não cobre o texto.
const FAB_AFTER = 8;
const BAR = '(max-width: 768px)';

/**
 * @param {object} options
 * @param {HTMLElement} options.story seção `.story` (altura = scroll da história + 1 tela)
 * @param {HTMLElement} options.stage `.stage` fixo na tela
 * @param {HTMLElement} options.header
 * @param {HTMLElement} options.cue dica "Role para ver ↓"
 * @param {HTMLElement} options.fab botão flutuante de WhatsApp
 * @param {HTMLElement[]} options.cards um cartão por capítulo (o 1º já vem com `.on`)
 * @param {(progress: number) => void} options.onProgress o progresso mudou
 * @param {(index: number) => void} options.onChapter o capítulo ativo mudou
 * @param {(y: number, docHeight: number) => void} [options.onScroll] a cada atualização
 */
export function createStory({
  story,
  stage,
  header,
  cue,
  fab,
  cards,
  onProgress,
  onChapter,
  onScroll,
}) {
  const last = cards.length - 1;
  let top = 0;
  let range = 1;
  let docHeight = 1;
  let active = 0;
  let queued = false;
  let prev = { progress: -1, solid: null, cue: null, fab: null };
  const bar = matchMedia(BAR);

  // só o cartão ativo é lido por leitor de tela e recebe foco
  cards.forEach((card, i) => (card.inert = i !== active));

  function measure() {
    top = story.getBoundingClientRect().top + scrollY;
    range = Math.max(1, story.offsetHeight - stage.offsetHeight);
    docHeight = document.documentElement.scrollHeight;
  }
  const progressAt = (y) => clamp((y - top) / range);
  const yAt = (p) => top + p * range;

  function update() {
    queued = false;
    const y = scrollY;
    const progress = progressAt(y);
    const index = Math.round(progress * last);
    if (index !== active) {
      cards[active].classList.remove('on');
      cards[active].inert = true;
      cards[index].classList.add('on');
      cards[index].inert = false;
      active = index;
      onChapter(index);
    }
    const next = {
      progress,
      solid: y > 40,
      cue: progress > 0.02,
      fab: y > top + range + FAB_AFTER || (bar.matches && active > 0),
    };
    if (next.solid !== prev.solid) header.classList.toggle('solid', next.solid);
    if (next.cue !== prev.cue) cue.classList.toggle('gone', next.cue);
    if (next.fab !== prev.fab) fab.classList.toggle('on', next.fab);
    if (next.progress !== prev.progress) onProgress(progress);
    prev = next;
    onScroll?.(y, docHeight);
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  function remeasure() {
    measure();
    schedule();
  }

  measure();
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', remeasure);
  bar.addEventListener('change', schedule);
  new ResizeObserver(remeasure).observe(story);
  update();

  return {
    /** Progresso da história no scroll atual. */
    progress: () => progressAt(scrollY),
    /** scrollY em que a história chega ao progresso `p`. */
    yAt,
    lastChapter: last,
  };
}
