// Tour automático: rola a página sozinho pelos 5 capítulos, com pausas para ler, e para no fim da
// história. A animação 3D continua ligada ao scroll, então cartões e cena ficam sincronizados e a
// pessoa pode pegar o controle a qualquer instante (qualquer toque, roda do mouse, tecla ou scroll
// interrompe). Interrompido, o tour nunca retoma sozinho.

// Progresso (0…1) no centro de cada capítulo e tempos, em ms.
const CENTERS = [0, 0.25, 0.5, 0.75, 1];
const FIRST_HOLD = 4500;
const HOLD = 5000;
const MOVE = 3000; // por quarto do percurso
const LAST_MOVE = 3500;
const MIN_MOVE = 1200;

const NEAR = 0.02; // a que distância de um centro conta como "já estou nele"
const SCROLL_TOLERANCE = 3; // px de diferença aceita entre o scroll pedido e o real
const MODIFIER_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * @param {object} options
 * @param {() => number} options.getProgress progresso atual da história (0…1)
 * @param {(p: number) => number} options.yAt scrollY que corresponde ao progresso p
 * @param {(state: 'idle'|'playing'|'paused'|'done') => void} [options.onState]
 * @param {(event: string, data: object) => void} [options.onEvent] medição
 * @param {(el: EventTarget | null) => boolean} [options.isUi] elementos que iniciam o tour não o interrompem
 */
export function createTour({ getProgress, yAt, onState, onEvent, isUi = () => false }) {
  let state = 'idle';
  let segments = [];
  let index = 0;
  let segStart = 0;
  let raf = 0;
  let lastY = null; // últimos scrollY pedidos pelo tour (o scroll chega um frame depois)
  let prevY = null;

  const set = (next) => {
    state = next;
    onState?.(next);
  };
  const chapter = () => Math.round(getProgress() * (CENTERS.length - 1)) + 1;

  /**
   * Sequência de trechos a partir de p0: parar para ler no capítulo, andar até o próximo…
   * `initialHold`: espera no capítulo em que está antes de andar (só no início automático).
   */
  function plan(p0, initialHold) {
    const segs = [];
    let cur = p0;
    const near = CENTERS.find((c) => Math.abs(c - p0) < NEAR);
    if (near !== undefined && initialHold) {
      segs.push({ hold: true, p: near, ms: near === 0 ? FIRST_HOLD : HOLD });
      cur = near;
    }
    for (const c of CENTERS) {
      if (c <= cur + 1e-6) continue;
      const ms = c === 1 ? LAST_MOVE : MOVE * ((c - cur) / 0.25);
      segs.push({ from: cur, to: c, ms: Math.max(MIN_MOVE, ms) });
      if (c < 1) segs.push({ hold: true, p: c, ms: HOLD });
      cur = c;
    }
    return segs;
  }

  function run(p0, initialHold) {
    segments = plan(p0, initialHold);
    index = 0;
    segStart = performance.now();
    lastY = prevY = null;
    set('playing');
    raf = requestAnimationFrame(tick);
  }

  function tick(now) {
    const seg = segments[index];
    const t = clamp((now - segStart) / seg.ms);
    const p = seg.hold ? seg.p : seg.from + (seg.to - seg.from) * easeInOut(t);
    const y = yAt(p);
    if (y !== lastY) {
      prevY = lastY;
      lastY = y;
      scrollTo(0, y);
    }
    if (t >= 1) {
      index += 1;
      segStart = now;
      if (index >= segments.length) return finish();
    }
    raf = requestAnimationFrame(tick);
  }

  function finish() {
    lastY = prevY = null;
    set('done');
    onEvent?.('tour_complete', {});
  }

  /** Começa do ponto atual; se a história já acabou, volta ao início. */
  function start({ auto = false } = {}) {
    cancelAnimationFrame(raf);
    let p0 = getProgress();
    const replay = p0 >= 0.98;
    if (replay) {
      p0 = 0;
      scrollTo(0, yAt(0));
    }
    onEvent?.('tour_start', { auto, replay });
    run(p0, auto);
  }

  function pause(by = 'user') {
    if (state !== 'playing') return;
    cancelAnimationFrame(raf);
    lastY = prevY = null;
    set('paused');
    onEvent?.('tour_pause', { chapter: chapter(), by });
  }

  // O usuário assumiu o controle: pausa e não retoma sozinho.
  const interrupt = (e) => {
    if (state !== 'playing' || isUi(e.target)) return;
    if (e.type === 'keydown' && MODIFIER_KEYS.has(e.key)) return;
    pause('user');
  };
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
    addEventListener(type, interrupt, { capture: true, passive: true });
  }
  // Scroll que não veio do tour (barra de rolagem, arrastar, etc.).
  addEventListener(
    'scroll',
    () => {
      if (state !== 'playing' || lastY === null) return;
      const y = scrollY;
      const fromTour = [lastY, prevY].some(
        (v) => v !== null && Math.abs(y - v) <= SCROLL_TOLERANCE,
      );
      if (!fromTour) pause('scroll');
    },
    { passive: true },
  );
  document.addEventListener('visibilitychange', () => document.hidden && pause('hidden'));

  return {
    get state() {
      return state;
    },
    start,
    pause,
  };
}
