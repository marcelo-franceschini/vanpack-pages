// Liga o canvas da animação ao render: em um Web Worker (OffscreenCanvas) quando possível, senão
// na thread principal. A página só envia o progresso do scroll e o tamanho; o render devolve
// "pronto", "erro" e perda/volta do contexto WebGL.

const MOBILE = '(max-width: 760px), (pointer: coarse)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';
// Resolução do canvas: densidade da tela limitada a 2x (1,5x no celular) e a um teto de pixels, para
// monitores 4K e janelas enormes não pesarem; abaixo disso a qualidade adaptativa assume.
const MAX_DENSITY = { desktop: 2, mobile: 1.5 };
const MAX_PIXELS = 4_500_000;
const MIN_DENSITY = 0.75;

/**
 * @param {HTMLElement} stage elemento `.stage` com um `<canvas>` dentro
 * @param {number} progress progresso inicial do scroll (0…1)
 * @returns {{ setProgress(p: number): void, ready: Promise<boolean> }} `ready` resolve `false`
 *   quando não há WebGL (a página fica com o fundo Papel, o símbolo e os cartões)
 */
export function mountStage(stage, progress) {
  const mobile = matchMedia(MOBILE).matches;
  const reducedQuery = matchMedia(REDUCED_MOTION);
  const pixelRatio = (width, height) =>
    Math.max(
      MIN_DENSITY,
      Math.min(
        devicePixelRatio || 1,
        mobile ? MAX_DENSITY.mobile : MAX_DENSITY.desktop,
        Math.sqrt(MAX_PIXELS / Math.max(1, width * height)),
      ),
    );
  const width = stage.clientWidth;
  const height = stage.clientHeight;
  const state = {
    progress,
    width,
    height,
    dpr: pixelRatio(width, height),
    mobile,
    reduced: reducedQuery.matches,
  };
  let send = () => {};
  let settle;
  const ready = new Promise((resolve) => (settle = resolve));

  // `ready` mostra o canvas (fade); perdendo o contexto volta ao Papel com o símbolo até restaurar.
  const onEvent = (msg) => {
    if (msg.type === 'ready' || msg.type === 'restored') {
      stage.classList.add('ready');
      if (msg.type === 'ready') settle(true);
    } else if (msg.type === 'lost') {
      stage.classList.remove('ready');
    } else if (msg.type === 'stats') {
      if (import.meta.env.MODE === 'audit') (window.__audit ??= {}).stats = msg;
    } else if (msg.type === 'error') fallback(msg.message);
  };

  let inline = false;
  async function startInline(canvas) {
    inline = true;
    const { createController } = await import('./controller.js');
    const controller = createController(canvas, { ...state }, (msg) => {
      if (msg.type === 'error') {
        stage.classList.add('no-gl');
        settle(false);
      } else onEvent(msg);
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
    state.dpr = pixelRatio(state.width, state.height);
    send({ type: 'resize', width: state.width, height: state.height, dpr: state.dpr });
  }).observe(stage);

  reducedQuery.addEventListener('change', (e) => {
    state.reduced = e.matches;
    send({ type: 'reduced', value: e.matches });
  });

  if (import.meta.env.MODE === 'audit') {
    (window.__audit ??= {}).loseContext = () => send({ type: 'audit-lose' });
  }

  return {
    ready,
    setProgress(p) {
      state.progress = p;
      send({ type: 'progress', value: p });
    },
  };
}
