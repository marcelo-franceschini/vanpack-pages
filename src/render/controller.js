// Dono do loop de render: suaviza o progresso do scroll, só desenha quando algo muda e reduz a
// qualidade em aparelhos que não acompanham. Roda no Web Worker (OffscreenCanvas) ou, sem suporte,
// na thread principal.
import { createScene } from '../scene/index.js';

const DAMPING = 6.3; // 1/s: igual em qualquer taxa de atualização da tela
const SETTLED = 1e-4; // diferença de progresso abaixo da qual a cena "chegou"
// Qualidade adaptativa: a cada ~1 s de animação (mínimo de 6 quadros, para aparelhos muito lentos
// decidirem logo), uma mediana acima de 24 ms (< ~40 fps) reduz um nível.
const SAMPLE_WINDOW_MS = 1000;
const MIN_SAMPLES = 6;
const SLOW_FRAME_MS = 24;
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
 * @typedef {{ type: 'ready' } | { type: 'error', message: string } | { type: 'lost' }
 *   | { type: 'restored' } | { type: 'stats' } & Record<string, number>} ControllerEvent
 */

/**
 * @param {HTMLCanvasElement | OffscreenCanvas} canvas
 * @param {{ width: number, height: number, dpr: number, mobile: boolean, reduced: boolean, progress: number }} init
 * @param {(event: ControllerEvent) => void} emit
 * @returns {{ handle(msg: { type: string } & Record<string, unknown>): void }}
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
  let { progress: target, reduced, dpr, width, height } = init;
  let current = target;
  let ready = false;
  let running = false;
  let lost = false;
  let last = 0;
  let pixelRatio = dpr;
  const minPixelRatio = Math.min(1, dpr); // a qualidade adaptativa nunca sobe a resolução
  let shadows = !init.mobile;
  let sampledMs = 0;
  const samples = [];
  let frames = 0; // só para a auditoria

  function draw() {
    scene.render(current);
    if (import.meta.env.MODE === 'audit') {
      frames += 1;
      emit({ type: 'stats', frames, p: current, ...scene.stats() });
    }
  }

  function wake() {
    if (!ready || running || lost || current === target) return;
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
    if (last && !reduced) sample(now - last);
    last = now;
    const gap = target - current;
    current =
      reduced || Math.abs(gap) < SETTLED ? target : current + gap * (1 - Math.exp(-DAMPING * dt));
    draw();
    if (current !== target) schedule(frame);
    else running = false;
  }

  // Primeiro baixa a resolução, depois desliga as sombras em tempo real.
  function sample(ms) {
    samples.push(ms);
    sampledMs += ms;
    if (samples.length < MIN_SAMPLES || sampledMs < SAMPLE_WINDOW_MS) return;
    samples.sort((a, b) => a - b);
    const median = samples[samples.length >> 1];
    samples.length = 0;
    sampledMs = 0;
    if (median <= SLOW_FRAME_MS) return;
    if (pixelRatio > minPixelRatio) {
      pixelRatio = Math.max(minPixelRatio, pixelRatio - PIXEL_RATIO_STEP);
      scene.setPixelRatio(pixelRatio);
    } else if (shadows) {
      shadows = false;
      scene.setShadows(false);
    }
  }

  // Se o sistema derrubar o contexto (comum em celular), o three avisa; ao voltar, refaz o necessário.
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    emit({ type: 'lost' });
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    scene.restore();
    if (ready) draw();
    emit({ type: 'restored' });
    wake();
  });

  scene.resize(width, height);
  scene.compile().then(
    () => {
      draw();
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
          if (!ready) current = target; // a página abriu no meio da história: sem deslizar desde 0
          wake();
          break;
        case 'reduced':
          reduced = msg.value;
          wake();
          break;
        case 'resize': {
          if (msg.width === width && msg.height === height && msg.dpr === dpr) break;
          if (msg.dpr !== dpr) {
            // mantém a redução já aplicada pela qualidade adaptativa
            pixelRatio = Math.max(Math.min(1, msg.dpr), msg.dpr - (dpr - pixelRatio));
            dpr = msg.dpr;
            scene.setPixelRatio(pixelRatio);
          }
          width = msg.width;
          height = msg.height;
          scene.resize(width, height);
          if (ready && !lost) draw();
          break;
        }
        case 'audit-lose': {
          if (import.meta.env.MODE !== 'audit') break;
          // perde e devolve o contexto, para testar a recuperação
          const ext = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
          ext?.loseContext();
          setTimeout(() => ext?.restoreContext(), 200);
          break;
        }
        default:
      }
    },
  };
}
