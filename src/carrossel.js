// Carrossel de clientes: uma esteira lenta e contínua, da direita para a esquerda, que dá a volta sem
// salto (os itens se repetem; as cópias ficam fora da leitura e do foco). O movimento é uma animação da
// Web Animations API em transform, que roda no compositor: nada é medido a cada quadro, só no
// ResizeObserver. Pausa com o mouse em cima, com foco de teclado, ao tocar ou arrastar, com a aba oculta
// e fora da tela, e retoma sozinha; pausada pelo botão, só volta pelo botão. Setas, teclado (← →) e
// arrasto movem a esteira. Com movimento reduzido no sistema não há movimento automático. Se os itens
// cabem na largura, fica parado, centralizado, sem cópias e sem controles.

const SPEED = 30; // px/s: lento, para ler cada logo
const GLIDE_MS = 420; // deslize das setas e do teclado
const RESUME_MS = 1500; // depois de soltar o dedo
const DRAG_MIN = 4; // px até um toque virar arrasto

const easeOut = (t) => 1 - (1 - t) ** 3;

/**
 * @param {HTMLElement | null} root elemento `[data-carrossel]` gerado pelo build/render.js
 */
export function mountCarousel(root) {
  if (!root || typeof root.animate !== 'function') return;
  const view = root.querySelector('.carrossel-janela');
  const track = root.querySelector('.carrossel-trilho');
  const controls = root.querySelector('.carrossel-controles');
  const pause = root.querySelector('[data-acao="pausa"]');
  const originals = [...track.children];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reasons = new Set(); // motivos de pausa; o botão é o único que não se desfaz sozinho
  let animation = null;
  let duration = 0; // ms para andar um conjunto inteiro
  let step = 0; // px do início de um item ao do seguinte
  let setWidth = 0;
  let clones = [];
  let glide = 0; // rAF do deslize em andamento
  let resumeTimer = 0;
  let drag = null;

  root.classList.add('on');
  const wrap = (t) => ((t % duration) + duration) % duration;

  function update() {
    if (!animation) {
      root.dataset.estado = 'estatico';
      return;
    }
    root.toggleAttribute('data-deslizando', glide !== 0);
    const auto = !reduced.matches && !reasons.size && !glide;
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
        const clone = item.cloneNode(true);
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
    step = originals[0].offsetWidth + gap;
    const nextWidth = originals.length * step;
    if (nextWidth - gap <= width + 0.5) {
      animation?.cancel();
      animation = null;
      setClones(0);
      root.classList.add('estatico');
      controls.hidden = true;
      update();
      return;
    }
    // cópias suficientes para a janela continuar cheia no fim de cada volta
    setClones(Math.ceil(width / nextWidth));
    if (!animation || nextWidth !== setWidth) {
      const fraction = animation ? wrap(animation.currentTime) / duration : 0;
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
    controls.hidden = false;
    pause.hidden = reduced.matches;
    update();
  }

  function stopGlide() {
    if (!glide) return;
    cancelAnimationFrame(glide);
    glide = 0;
  }

  // Anterior (-1) ou próximo (+1): 1 item, ou 2 quando cabem 4 ou mais, alinhando ao início do item.
  function move(direction) {
    if (!animation) return;
    stopGlide();
    const items = Math.floor(view.clientWidth / step) >= 4 ? 2 : 1;
    const from = animation.currentTime;
    const at = ((from / 1000) * SPEED) / step;
    const target = direction > 0 ? Math.floor(at + 1e-3) + items : Math.ceil(at - 1e-3) - items;
    const to = ((target * step) / SPEED) * 1000;
    if (reduced.matches) {
      animation.currentTime = wrap(to);
      return;
    }
    let start = 0; // o tempo do 1º quadro (o do rAF pode ser anterior ao clique)
    const frame = (now) => {
      start ||= now;
      const t = Math.min(1, (now - start) / GLIDE_MS);
      animation.currentTime = wrap(from + (to - from) * easeOut(t));
      if (t < 1) glide = requestAnimationFrame(frame);
      else {
        glide = 0;
        update();
      }
    };
    glide = requestAnimationFrame(frame);
    update();
  }

  pause.addEventListener('click', () => {
    const paused = !reasons.has('botao');
    pause.setAttribute('aria-pressed', String(paused));
    pause.querySelector('span').textContent = paused ? 'Retomar' : 'Pausar';
    pause.querySelector('use').setAttribute('href', paused ? '#i-retomar' : '#i-pausa');
    toggle('botao', paused);
  });
  root.querySelector('[data-acao="anterior"]').addEventListener('click', () => move(-1));
  root.querySelector('[data-acao="proximo"]').addEventListener('click', () => move(1));

  view.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    move(e.key === 'ArrowRight' ? 1 : -1);
  });

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

  view.addEventListener('pointerdown', (e) => {
    if (!animation || e.button > 0) return;
    if (e.pointerType !== 'mouse') {
      clearTimeout(resumeTimer);
      toggle('toque', true);
    }
    drag = { id: e.pointerId, x: e.clientX, t: animation.currentTime, moved: false };
  });
  view.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved) {
      if (Math.abs(dx) < DRAG_MIN) return;
      drag.moved = true;
      view.setPointerCapture(e.pointerId);
      stopGlide();
      drag.t = animation.currentTime;
      drag.x = e.clientX;
      toggle('arrasto', true);
      return;
    }
    animation.currentTime = wrap(drag.t - (dx / SPEED) * 1000);
  });
  const endDrag = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    toggle('arrasto', false);
    if (e.pointerType !== 'mouse') {
      resumeTimer = setTimeout(() => toggle('toque', false), RESUME_MS);
    }
  };
  view.addEventListener('pointerup', endDrag);
  view.addEventListener('pointercancel', endDrag);
  view.addEventListener('dragstart', (e) => e.preventDefault());

  document.addEventListener('visibilitychange', () => toggle('oculta', document.hidden));
  new IntersectionObserver(([entry]) => toggle('fora', !entry.isIntersecting)).observe(view);
  reduced.addEventListener('change', () => {
    if (animation) pause.hidden = reduced.matches;
    update();
  });
  new ResizeObserver(layout).observe(view);
}
