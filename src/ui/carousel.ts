export const MIN_MARQUEE_CLIENTS = 4;

/**
 * Pure decision rule: only run an infinite marquee when there are enough distinct clients (>= 4)
 * and the user has not requested reduced motion. Prevents awkwardly cloning 1-3 logos repeatedly.
 */
export function shouldActivateMarquee(itemCount: number, reducedMotion: boolean): boolean {
  return itemCount >= MIN_MARQUEE_CLIENTS && !reducedMotion;
}

/**
 * Smart client logo showcase: renders a clean static layout for 1–3 clients and automatically
 * promotes to an accessible, pause-on-hover/focus WAAPI marquee once 4+ clients are configured.
 */
export function mountClientShowcase(root: Document | HTMLElement = document): () => void {
  const container = root.querySelector<HTMLElement>('[data-carousel]');
  const track = container?.querySelector<HTMLUListElement>('.carrossel-trilho');
  const viewport = container?.querySelector<HTMLElement>('.carrossel-janela');
  if (!container || !track || !viewport) return () => {};

  const items = [...track.children] as HTMLElement[];
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!shouldActivateMarquee(items.length, reducedQuery.matches)) {
    container.classList.add('is-static');
    container.classList.remove('is-marquee');
    return () => {};
  }

  container.classList.add('is-marquee');
  container.classList.remove('is-static');

  // Clone one clean pass for seamless infinite loop
  for (const item of items) {
    const clone = item.cloneNode(true) as HTMLElement;
    clone.setAttribute('aria-hidden', 'true');
    track.appendChild(clone);
  }

  let animation: Animation | null = null;
  let pausedByUser = false;
  let inView = true;

  const syncPlayState = () => {
    if (!animation) return;
    if (pausedByUser || !inView || reducedQuery.matches) animation.pause();
    else animation.play();
  };

  const buildAnimation = () => {
    animation?.cancel();
    const halfWidth = track.scrollWidth / 2;
    if (halfWidth < 20) return;
    const durationMs = Math.max(12000, Math.round((halfWidth / 52) * 1000));
    animation = track.animate(
      [{ transform: 'translate3d(0, 0, 0)' }, { transform: `translate3d(-${halfWidth}px, 0, 0)` }],
      { duration: durationMs, iterations: Infinity, easing: 'linear' },
    );
    syncPlayState();
  };

  buildAnimation();

  const pause = () => {
    pausedByUser = true;
    syncPlayState();
  };
  const resume = () => {
    pausedByUser = false;
    syncPlayState();
  };

  viewport.addEventListener('mouseenter', pause);
  viewport.addEventListener('mouseleave', resume);
  viewport.addEventListener('focusin', pause);
  viewport.addEventListener('focusout', resume);
  viewport.addEventListener('pointerdown', pause);

  const io = new IntersectionObserver((entries) => {
    inView = entries.some((e) => e.isIntersecting);
    syncPlayState();
  });
  io.observe(container);

  const ro = new ResizeObserver(() => buildAnimation());
  ro.observe(viewport);

  return () => {
    io.disconnect();
    ro.disconnect();
    viewport.removeEventListener('mouseenter', pause);
    viewport.removeEventListener('mouseleave', resume);
    viewport.removeEventListener('focusin', pause);
    viewport.removeEventListener('focusout', resume);
    viewport.removeEventListener('pointerdown', pause);
    animation?.cancel();
  };
}
