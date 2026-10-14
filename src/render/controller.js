// Dono do loop de render: suaviza o progresso, só desenha quando algo muda e
// reduz a qualidade em aparelhos que não acompanham. Roda no worker ou inline.
import { createScene } from '../scene/index.js';

const DAMPING = 6.3; // 1/s; equivale ao antigo k = 0,1 por frame a 60 Hz, agora igual em qualquer tela
const SETTLED = 1e-4;
// Qualidade adaptativa: a cada ~1 s de animação (mínimo de 6 frames, para aparelhos muito lentos
// decidirem logo), uma mediana acima de 24 ms (< ~40 fps) reduz um nível.
const SAMPLE_WINDOW_MS = 1000;
const MIN_SAMPLES = 6;
const SLOW_FRAME_MS = 24;
const MIN_PIXEL_RATIO = 1;
const PIXEL_RATIO_STEP = 0.25;

// requestAnimationFrame existe em workers no Chrome/Firefox; senão, um relógio de 60 Hz.
const frameScheduler = () => {
  if (typeof requestAnimationFrame === 'function') return (cb) => requestAnimationFrame(cb);
  let next = 0;
  return (cb) => {
    const now = performance.now();
    next = Math.max(now, next + 1000 / 60);
    setTimeout(() => cb(performance.now()), next - now);
  };
};

/**
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {{ width: number, height: number, dpr: number, mobile: boolean, reduced: boolean, progress: number }} init
 * @param {(msg: { type: 'ready' } | { type: 'error', message: string }) => void} emit
 * @returns {{ handle(msg: object): void }}
 */
export function createController(canvas, init, emit) {
  let scene;
  try {
    scene = createScene(canvas, init);
  } catch (err) {
    emit({ type: 'error', message: String(err?.message ?? err) });
    return { handle() {} };
  }

  const schedule = frameScheduler();
  let { progress: target, reduced, dpr } = init;
  let current = target;
  let ready = false;
  let running = false;
  let lost = false;
  let last = 0;
  let pixelRatio = dpr;
  let shadows = true;
  let samples = [];
  let sampledMs = 0;

  function wake() {
    if (!ready || running || lost) return;
    running = true;
    last = 0;
    schedule(frame);
  }

  function frame(now) {
    if (lost) {
      running = false;
      return;
    }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    if (last && !reduced) track(now - last);
    last = now;
    current = reduced ? target : current + (target - current) * (1 - Math.exp(-DAMPING * dt));
    if (Math.abs(target - current) < SETTLED) current = target;
    scene.render(current);
    if (current !== target) schedule(frame);
    else running = false;
  }

  // Primeiro baixa a resolução, depois desliga as sombras em tempo real.
  function track(ms) {
    samples.push(ms);
    sampledMs += ms;
    if (samples.length < MIN_SAMPLES || sampledMs < SAMPLE_WINDOW_MS) return;
    const median = samples.sort((a, b) => a - b)[samples.length >> 1];
    samples = [];
    sampledMs = 0;
    if (median <= SLOW_FRAME_MS) return;
    if (pixelRatio > MIN_PIXEL_RATIO) {
      pixelRatio = Math.max(MIN_PIXEL_RATIO, pixelRatio - PIXEL_RATIO_STEP);
      scene.setPixelRatio(pixelRatio);
    } else if (shadows) {
      shadows = false;
      scene.setShadows(false);
    }
  }

  // Se o sistema derrubar o contexto (comum em celular), o three avisa; ao voltar, refaz o necessário.
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    scene.restore();
    if (ready) scene.render(current);
    wake();
  });

  scene.resize(init.width, init.height);
  scene.compile().then(
    () => {
      scene.render(current);
      ready = true;
      emit({ type: 'ready' });
      wake();
    },
    (err) => emit({ type: 'error', message: String(err?.message ?? err) }),
  );

  return {
    handle(msg) {
      switch (msg.type) {
        case 'progress':
          target = msg.value;
          break;
        case 'reduced':
          reduced = msg.value;
          break;
        case 'resize':
          if (msg.dpr !== dpr) {
            // mantém a redução já aplicada pela qualidade adaptativa
            pixelRatio = Math.max(MIN_PIXEL_RATIO, msg.dpr - (dpr - pixelRatio));
            dpr = msg.dpr;
            scene.setPixelRatio(pixelRatio);
          }
          scene.resize(msg.width, msg.height);
          if (ready && !running && !lost) scene.render(current);
          return;
        default:
          return;
      }
      wake();
    },
  };
}
