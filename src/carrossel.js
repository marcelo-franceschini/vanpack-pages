// Carrossel de clientes: uma esteira lenta e contínua, da direita para a esquerda, que dá a volta sem
// salto (os itens se repetem; as cópias ficam fora da leitura e do foco). O movimento é uma animação da
// Web Animations API em transform, que roda no compositor: nada é medido a cada quadro, só no
// ResizeObserver. A página não tem controle da esteira (nem pausa, nem setas): ela pausa sozinha com o
// mouse em cima, com foco de teclado, ao tocar, com a aba oculta e fora da tela, e retoma sozinha. Com
// movimento reduzido no sistema não há movimento: se os itens cabem na largura, ficam parados e
// centralizados, sem cópias.

const SPEED = 30; // px/s: lento, para ler cada logo
const RESUME_MS = 1500; // depois de soltar o dedo

/**
 * @param {HTMLElement | null} root elemento `[data-carrossel]` gerado pelo build/render.js
 */
export function mountCarousel(root) {
  if (!root || typeof root.animate !== 'function') return;
  const view = /** @type {HTMLElement} */ (root.querySelector('.carrossel-janela'));
  const track = /** @type {HTMLElement} */ (root.querySelector('.carrossel-trilho'));
  const originals = /** @type {HTMLElement[]} */ ([...track.children]);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reasons = new Set(); // motivos de pausa
  let animation = null;
  let duration = 0; // ms para andar um conjunto inteiro
  let setWidth = 0;
  /** @type {HTMLElement[]} */
  let clones = [];
  let resumeTimer = 0;

  root.classList.add('on');

  function update() {
    if (!animation) {
      root.dataset.estado = 'estatico';
      return;
    }
    const auto = !reduced.matches && !reasons.size;
    if (auto) animation.play();
    else animation.pause();
    root.dataset.estado = auto ? 'rodando' : 'pausado';
  }

  const toggle = (reason, on) => {
    if (on) reasons.add(reason);
    else reasons.delete(reason);
    update();
  };

  function setClones(sets) {
    if (clones.length === sets * originals.length) return;
    for (const clone of clones) clone.remove();
    clones = [];
    for (let s = 0; s < sets; s++) {
      for (const item of originals) {
        const clone = /** @type {HTMLElement} */ (item.cloneNode(true));
        clone.setAttribute('aria-hidden', 'true');
        clone.inert = true;
        clones.push(clone);
      }
    }
    track.append(...clones);
  }

  // Medidas só aqui (ao montar e quando a largura muda).
  function layout() {
    const width = view.clientWidth;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    const nextWidth = originals.length * (originals[0].offsetWidth + gap);
    // Com poucos logos a esteira anda do mesmo jeito (os itens se repetem para encher a janela); só com
    // movimento reduzido eles ficam parados e centralizados, sem cópias.
    if (nextWidth - gap <= width + 0.5 && reduced.matches) {
      animation?.cancel();
      animation = null;
      setClones(0);
      root.classList.add('estatico');
      update();
      return;
    }
    // cópias suficientes para a janela continuar cheia no fim de cada volta
    setClones(Math.ceil(width / nextWidth));
    if (!animation || nextWidth !== setWidth) {
      // a esteira não volta ao início quando a largura muda: segue de onde estava
      const fraction = animation
        ? (((animation.currentTime % duration) + duration) % duration) / duration
        : 0;
      animation?.cancel();
      setWidth = nextWidth;
      duration = (setWidth / SPEED) * 1000;
      animation = track.animate(
        [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(${-setWidth}px, 0, 0)` }],
        { duration, iterations: Infinity },
      );
      animation.currentTime = fraction * duration;
    }
    root.classList.remove('estatico');
    update();
  }

  // Mouse em cima pausa; o toque é tratado no pointerdown (pointerenter também dispara no toque).
  view.addEventListener('pointerenter', (e) => {
    if (e.pointerType === 'mouse') toggle('hover', true);
  });
  view.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse') toggle('hover', false);
  });
  // Só o foco de teclado pausa: um clique também dá foco à região, e ela não pode ficar parada
  // depois de o mouse sair.
  view.addEventListener('focus', () => toggle('foco', view.matches(':focus-visible')));
  view.addEventListener('blur', () => toggle('foco', false));

  // O dedo em cima segura a esteira e, ao soltar, ela retoma sozinha.
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    clearTimeout(resumeTimer);
    toggle('toque', true);
  });
  const release = (e) => {
    if (e.pointerType === 'mouse') return;
    resumeTimer = setTimeout(() => toggle('toque', false), RESUME_MS);
  };
  view.addEventListener('pointerup', release);
  view.addEventListener('pointercancel', release);

  document.addEventListener('visibilitychange', () => toggle('oculta', document.hidden));
  new IntersectionObserver(([entry]) => toggle('fora', !entry.isIntersecting)).observe(view);
  reduced.addEventListener('change', layout);
  new ResizeObserver(layout).observe(view);
}
