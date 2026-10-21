// 3D dos produtos na página (carregado pelo gatilho.js quando a seção chega perto): decide entre o 3D
// e a ilustração em SVG, cria o canvas de cada cartão e conversa com o worker, dono do único contexto
// WebGL dos produtos. O modelo de um cartão só existe no worker enquanto o cartão está a 300 px da tela
// e só é desenhado enquanto está à vista; com a aba oculta, nada é desenhado. Longe de todos os
// cartões, o worker libera tudo (dispose e forceContextLoss) e é encerrado.
import { ilustrar } from './gatilho.js';

const MOBILE = '(max-width: 760px), (pointer: coarse)'; // o mesmo critério do 3D principal
const REDUCED = '(prefers-reduced-motion: reduce)';
const MAX_DENSITY = { desktop: 2, mobile: 1.5 };
const NEAR = '300px 0px';
const DISPOSE_WAIT_MS = 2000; // tempo para o worker liberar a GPU antes de ser encerrado

/** Por que este aparelho fica com a ilustração (ou '' se o 3D pode rodar). */
function withoutConditions() {
  const connection = navigator.connection;
  if (connection?.saveData) return 'economia de dados ligada';
  if (['slow-2g', '2g', '3g'].includes(connection?.effectiveType)) return 'rede 2g/3g';
  if (navigator.deviceMemory && navigator.deviceMemory <= 2) return 'até 2 GB de memória';
  if (
    typeof Worker !== 'function' ||
    typeof OffscreenCanvas !== 'function' ||
    typeof ImageBitmapRenderingContext !== 'function'
  ) {
    return 'sem OffscreenCanvas';
  }
  return '';
}

/** @param {HTMLElement[]} areas as `.model-3d[data-modelo]` dos cartões */
export function montarProdutos(areas) {
  const reason = withoutConditions();
  if (reason) {
    console.info(`[vanpack] produtos: ilustração no lugar do 3D (${reason})`);
    areas.forEach(ilustrar);
    return;
  }
  const reducedQuery = matchMedia(REDUCED);
  const density = Math.min(
    devicePixelRatio || 1,
    matchMedia(MOBILE).matches ? MAX_DENSITY.mobile : MAX_DENSITY.desktop,
  );
  /** @type {any} */
  const audit =
    import.meta.env.MODE === 'audit'
      ? ((window.__audit ??= {}).produtos = { frames: 0, stats: {}, memory: null, workers: 0 })
      : null;
  const cards = areas.map((area, id) => ({
    id,
    area,
    canvas: null,
    ctx: null,
    near: false,
    visible: false,
    width: 0,
    height: 0,
  }));
  /** @type {Map<Element, (typeof cards)[number]>} */
  const byArea = new Map(cards.map((card) => [card.area, card]));
  let worker = null;
  let failed = false;

  const label = (card) =>
    `Modelo 3D de ${card.area.dataset.peca}${reducedQuery.matches ? '' : ' girando'}`;
  const send = (msg) => worker?.postMessage(msg);

  function measure(card, rect = card.area.getBoundingClientRect()) {
    card.width = Math.max(1, Math.round(rect.width * density));
    card.height = Math.max(1, Math.round(rect.height * density));
    if (card.canvas) {
      card.canvas.width = card.width;
      card.canvas.height = card.height;
    }
  }

  function fail(message) {
    if (failed) return;
    failed = true;
    console.info(`[vanpack] produtos: ilustração no lugar do 3D (${message})`);
    worker?.terminate();
    worker = null;
    near.disconnect();
    seen.disconnect();
    sizes.disconnect();
    cards.forEach((card) => ilustrar(card.area));
  }

  function onMessage(from, msg) {
    if (msg.type === 'disposed') {
      from.terminate();
      return;
    }
    if (from !== worker) {
      msg.frames?.forEach(({ bitmap }) => bitmap.close());
      return;
    }
    if (msg.type === 'error') fail(msg.message);
    else if (msg.type === 'frame') {
      for (const { id, bitmap } of msg.frames) {
        const card = cards[id];
        if (!card.near || !card.ctx) {
          bitmap.close();
          continue;
        }
        card.ctx.transferFromImageBitmap(bitmap);
        card.area.classList.add('pronto');
      }
      send({ type: 'ack' });
      if (audit) {
        audit.frames += 1;
        Object.assign(audit.stats, msg.stats);
      }
    } else if (msg.type === 'stats' && audit) audit.memory = msg.memory;
  }

  function start() {
    const next = new Worker(new URL('./produtos-worker.js', import.meta.url), { type: 'module' });
    next.onmessage = ({ data }) => onMessage(next, data);
    next.onerror = (e) => {
      if (next === worker) fail(e.message || 'o worker não carregou');
    };
    next.postMessage({ type: 'init', reduced: reducedQuery.matches, hidden: document.hidden });
    worker = next;
    if (audit) audit.workers += 1;
  }

  function approach(card) {
    if (!worker) start();
    if (!card.canvas) {
      card.canvas = document.createElement('canvas');
      card.canvas.setAttribute('role', 'img');
      card.canvas.setAttribute('aria-label', label(card));
      card.ctx = card.canvas.getContext('bitmaprenderer');
      card.area.prepend(card.canvas);
    }
    measure(card);
    const { id, width, height, visible } = card;
    send({ type: 'add', id, modelo: card.area.dataset.modelo, width, height, visible });
  }

  function leave(card) {
    send({ type: 'remove', id: card.id });
    if (cards.some((c) => c.near)) return;
    // nenhum cartão perto: o worker libera tudo e sai
    const old = worker;
    worker = null;
    old.postMessage({ type: 'dispose' });
    setTimeout(() => old.terminate(), DISPOSE_WAIT_MS);
  }

  const near = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const card = byArea.get(target);
        if (card.near === isIntersecting) continue;
        card.near = isIntersecting;
        if (isIntersecting) approach(card);
        else leave(card);
      }
    },
    { rootMargin: NEAR },
  );
  const seen = new IntersectionObserver((entries) => {
    for (const { target, isIntersecting } of entries) {
      const card = byArea.get(target);
      card.visible = isIntersecting;
      if (card.near) send({ type: 'visible', id: card.id, on: isIntersecting });
    }
  });
  const sizes = new ResizeObserver((entries) => {
    for (const { target, contentRect } of entries) {
      const card = byArea.get(target);
      const { width, height } = card;
      measure(card, contentRect);
      if (card.near && (width !== card.width || height !== card.height)) {
        send({ type: 'resize', id: card.id, width: card.width, height: card.height });
      }
    }
  });
  for (const card of cards) {
    near.observe(card.area);
    seen.observe(card.area);
    sizes.observe(card.area);
  }

  document.addEventListener('visibilitychange', () =>
    send({ type: document.hidden ? 'pause' : 'resume' }),
  );
  reducedQuery.addEventListener('change', () => {
    send({ type: 'reduced', value: reducedQuery.matches });
    for (const card of cards) card.canvas?.setAttribute('aria-label', label(card));
  });
  if (audit) {
    audit.loseContext = () => send({ type: 'audit-lose' });
    audit.askMemory = () => send({ type: 'audit-memory' });
  }
}
