// Rota da entrega: um caminho tracejado até o botão "Pedir orçamento" do header. O caminhãozinho
// anda por ele conforme o progresso da história e estaciona no botão ao fim; as 5 paradas são os
// capítulos e funcionam como navegação.
const SAMPLES = 160;
const AMPLITUDE = 9; // px
const WAVE_EVERY = 460; // px de largura por onda
const START_X = 16;
const END_MARGIN = 16;
const TRUCK = { w: 44, h: 26, wheelBottom: 24.5 };
const MAX_TILT = 22; // graus
const ARRIVED_AT = 0.98;

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

/**
 * @param {HTMLElement} root `<nav class="route">`
 * @param {object} options
 * @param {HTMLElement} options.dock botão onde o caminhão estaciona
 * @param {(index: number) => void} options.onStop clique numa parada
 * @param {() => void} [options.onArrive] o caminhão chegou ao botão
 */
export function createRoute(root, { dock, onStop, onArrive }) {
  const track = root.querySelector('.route-track');
  const svg = root.querySelector('.route-svg');
  const base = svg.querySelector('.route-base');
  const fill = svg.querySelector('.route-fill');
  const clip = svg.querySelector('clipPath rect');
  const truck = svg.querySelector('.route-truck');
  const stopItems = [...root.querySelectorAll('.route-stops li')];
  const stops = stopItems.map((li) => li.querySelector('.route-stop'));
  const last = stops.length - 1;

  let xs = [];
  let ys = [];
  let cum = [];
  let progress = 0;
  let arrived = false;

  /** Ponto e inclinação a uma fração f (0…1) do comprimento do caminho. */
  function pointAt(f) {
    const total = cum[cum.length - 1];
    const target = clamp(f) * total;
    let lo = 0;
    let hi = cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1;
    const k = (target - cum[lo]) / span;
    return {
      x: xs[lo] + (xs[hi] - xs[lo]) * k,
      y: ys[lo] + (ys[hi] - ys[lo]) * k,
      angle: (Math.atan2(ys[hi] - ys[lo], xs[hi] - xs[lo]) * 180) / Math.PI,
    };
  }

  function layout() {
    const box = track.getBoundingClientRect();
    if (!box.width) return;
    const dockBox = dock.getBoundingClientRect();
    const endX = clamp(
      dockBox.left + dockBox.width / 2 - box.left,
      box.width * 0.5,
      box.width - END_MARGIN,
    );
    const mid = box.height - 18;
    const waves = Math.max(1, Math.round(box.width / WAVE_EVERY));
    xs = [];
    ys = [];
    cum = [0];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      xs.push(START_X + (endX - START_X) * u);
      // Onda suave que começa e termina na horizontal: o caminhão sai e estaciona nivelado.
      ys.push(mid + AMPLITUDE * Math.sin(2 * Math.PI * waves * u) * Math.sin(Math.PI * u));
      if (i) cum.push(cum[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
    }
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    const d = `M${xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' L')}`;
    base.setAttribute('d', d);
    fill.setAttribute('d', d);
    clip.setAttribute('height', String(box.height));
    stopItems.forEach((li, i) => {
      const p = pointAt(i / last);
      li.style.left = `${p.x}px`;
      li.style.top = `${p.y}px`;
    });
    setProgress(progress);
  }

  function setProgress(p) {
    progress = clamp(p);
    if (!cum.length) return;
    const pt = pointAt(progress);
    const tilt = clamp(pt.angle, -MAX_TILT, MAX_TILT);
    truck.setAttribute(
      'transform',
      `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) rotate(${tilt.toFixed(1)}) translate(${-TRUCK.w / 2} ${-TRUCK.wheelBottom})`,
    );
    clip.setAttribute('width', pt.x.toFixed(1));
    const active = Math.round(progress * last);
    stops.forEach((btn, i) => {
      btn.classList.toggle('passed', i < active);
      if (i === active) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });
    const now = progress >= ARRIVED_AT;
    if (now !== arrived) {
      arrived = now;
      root.classList.toggle('arrived', now);
      if (now) onArrive?.();
    }
  }

  stops.forEach((btn, i) => btn.addEventListener('click', () => onStop(i)));
  new ResizeObserver(layout).observe(track);
  addEventListener('resize', layout);
  layout();

  return { setProgress, layout };
}
