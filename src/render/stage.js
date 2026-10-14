// Liga o canvas da animação ao render: em um Web Worker (OffscreenCanvas) quando possível,
// senão na thread principal. A página só envia o progresso do scroll e o tamanho.

const MOBILE = '(max-width: 760px), (pointer: coarse)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * @param {HTMLElement} stage elemento `.stage` com um `<canvas>` dentro
 * @param {number} progress progresso inicial do scroll (0…1)
 * @returns {{ setProgress(p: number): void }}
 */
export function mountStage(stage, progress) {
  const mobile = matchMedia(MOBILE).matches;
  const reducedQuery = matchMedia(REDUCED_MOTION);
  const pixelRatio = () => Math.min(devicePixelRatio || 1, mobile ? 1.5 : 2);
  const state = {
    progress,
    width: stage.clientWidth,
    height: stage.clientHeight,
    dpr: pixelRatio(),
    mobile,
    reduced: reducedQuery.matches,
  };
  let send = () => {};

  const onEvent = (msg) => {
    if (msg.type === 'ready') stage.classList.add('ready');
    else if (msg.type === 'error') fallback(msg.message);
  };

  let inline = false;
  async function startInline(canvas) {
    inline = true;
    const { createController } = await import('./controller.js');
    const controller = createController(canvas, { ...state }, (msg) => {
      if (msg.type === 'error') stage.classList.add('no-gl');
      else onEvent(msg);
    });
    send = (msg) => controller.handle(msg);
  }

  // O worker falhou (ex.: Safari < 17 sem WebGL em OffscreenCanvas): o canvas transferido não
  // pode mais ser usado na página, então entra um clone e o render roda inline.
  function fallback(reason) {
    if (inline) return;
    console.warn('Render em worker indisponível; usando a thread principal.', reason);
    worker?.terminate();
    const old = stage.querySelector('canvas');
    const fresh = old.cloneNode(false);
    old.replaceWith(fresh);
    startInline(fresh);
  }

  const canvas = stage.querySelector('canvas');
  let worker = null;
  if (typeof canvas.transferControlToOffscreen === 'function' && typeof Worker === 'function') {
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      const offscreen = canvas.transferControlToOffscreen();
      worker.onmessage = ({ data }) => onEvent(data);
      worker.onerror = (e) => fallback(e.message);
      worker.postMessage({ type: 'init', canvas: offscreen, state: { ...state } }, [offscreen]);
      send = (msg) => worker.postMessage(msg);
    } catch (err) {
      fallback(err);
    }
  } else {
    startInline(canvas);
  }

  new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect;
    state.width = Math.round(width);
    state.height = Math.round(height);
    state.dpr = pixelRatio();
    send({ type: 'resize', width: state.width, height: state.height, dpr: state.dpr });
  }).observe(stage);

  reducedQuery.addEventListener('change', (e) => {
    state.reduced = e.matches;
    send({ type: 'reduced', value: e.matches });
  });

  return {
    setProgress(p) {
      state.progress = p;
      send({ type: 'progress', value: p });
    },
  };
}
