import type { ProductModelId } from './models';
import {
  applyDragDelta,
  applyKeyStep,
  createTurntableState,
  stepTurntable,
  type TurntableState,
} from './physics';
import type { VitrineRenderer } from './vitrine';

interface ProductSlot {
  id: ProductModelId;
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: TurntableState;
  visible: boolean;
  dirty: boolean;
}

const VALID_IDS = new Set<ProductModelId>([
  'caixa-normal',
  'corte-e-vinco',
  'divisorias',
  'chapas',
]);

function installSvgFallback(slots: ProductSlot[]): void {
  for (const slot of slots) {
    slot.canvas.remove();
    slot.container.querySelector('.model-hint')?.remove();
    const img = document.createElement('img');
    img.src = `./produtos/${slot.id}.svg`;
    img.alt = slot.container.dataset.piece || slot.id;
    img.loading = 'lazy';
    img.decoding = 'async';
    slot.container.appendChild(img);
  }
}

/**
 * Mounts interactive PBR 3D turntables across all `.model-3d` product cards using a single
 * shared dynamically-imported WebGLRenderer, with inertial drag, clamped vertical pitch,
 * keyboard accessibility, and graceful SVG fallback if WebGL is unavailable.
 */
export function mountProductCatalog(root: Document | HTMLElement = document): () => void {
  const containers = [...root.querySelectorAll<HTMLElement>('.model-3d[data-model]')];
  if (!containers.length) return () => {};

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = reducedQuery.matches;
  let isSoftware = false;
  let disposed = false;
  let useFallback = false;
  let vitrine: VitrineRenderer | null = null;
  let vitrineLoading = false;
  let rafId = 0;
  let lastTs = 0;

  const initialAngles: Record<ProductModelId, number> = {
    'caixa-normal': 0,
    'corte-e-vinco': 0,
    divisorias: 0,
    chapas: 0,
  };

  const slots: ProductSlot[] = [];

  for (const container of containers) {
    const rawId = container.dataset.model as ProductModelId | undefined;
    if (!rawId || !VALID_IDS.has(rawId)) continue;

    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img');
    const pieceLabel = container.dataset.piece || rawId;
    canvas.setAttribute(
      'aria-label',
      `Visualização 3D interativa: ${pieceLabel}. Use o mouse ou as setas do teclado para girar.`,
    );
    canvas.tabIndex = 0;
    container.prepend(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const slot: ProductSlot = {
      id: rawId,
      container,
      canvas,
      ctx,
      state: createTurntableState(initialAngles[rawId]),
      visible: false,
      dirty: true,
    };
    slots.push(slot);

    let activePointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastMoveTs = 0;

    canvas.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      activePointerId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveTs = performance.now();
      slot.state.dragging = true;
      slot.state.yawVel = 0;
      slot.state.pitchVel = 0;
      container.dataset.interacted = 'true';
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic event capture failures
      }
    });

    canvas.addEventListener('pointermove', (e: PointerEvent) => {
      if (activePointerId !== e.pointerId || !slot.state.dragging) return;
      const now = performance.now();
      const dt = (now - lastMoveTs) / 1000;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastMoveTs = now;
      applyDragDelta(slot.state, dx, dy, dt);
      slot.dirty = true;
      schedule();
    });

    const endDrag = (e: PointerEvent) => {
      if (activePointerId !== e.pointerId) return;
      activePointerId = null;
      slot.state.dragging = false;
      schedule();
    };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);

    canvas.addEventListener('keydown', (e: KeyboardEvent) => {
      const step = 0.24;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        applyKeyStep(slot.state, -step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        applyKeyStep(slot.state, step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        applyKeyStep(slot.state, 0, -0.1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        applyKeyStep(slot.state, 0, 0.1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        slot.state = createTurntableState(initialAngles[slot.id]);
      } else {
        return;
      }
      container.dataset.interacted = 'true';
      slot.dirty = true;
      schedule();
    });
  }

  if (!slots.length) return () => {};
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  const ensureVitrine = () => {
    if (vitrine || vitrineLoading || useFallback || disposed) return;
    vitrineLoading = true;
    void import('./vitrine')
      .then(({ createVitrineRenderer }) => {
        if (disposed) return;
        vitrine = createVitrineRenderer();
        isSoftware = vitrine.isSoftware;
        for (const s of slots) s.dirty = true;
        schedule();
      })
      .catch(() => {
        if (disposed || useFallback) return;
        useFallback = true;
        installSvgFallback(slots);
      });
  };

  const renderSlot = (slot: ProductSlot) => {
    if (!vitrine) return;
    const rect = slot.container.getBoundingClientRect();
    const w = Math.max(160, Math.round(rect.width || 400));
    const h = Math.max(120, Math.round(rect.height || 300));
    const dpr = isSoftware ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    const outW = Math.round(w * dpr);
    const outH = Math.round(h * dpr);

    slot.dirty = false;
    const source = vitrine.renderModel(slot.id, slot.state.yaw, slot.state.pitch, w, h, dpr);
    if (slot.canvas.width !== outW || slot.canvas.height !== outH) {
      slot.canvas.width = outW;
      slot.canvas.height = outH;
    }
    slot.ctx.clearRect(0, 0, outW, outH);
    slot.ctx.drawImage(source, 0, 0, outW, outH);
  };

  const tick = (ts: number) => {
    rafId = 0;
    if (disposed || useFallback || document.hidden || !vitrine) return;
    const dt = lastTs ? (ts - lastTs) / 1000 : 1 / 60;
    lastTs = ts;

    let anyActive = false;
    for (const slot of slots) {
      if (!slot.visible) continue;
      const moved = stepTurntable(slot.state, dt, reducedMotion || isSoftware);
      if (moved || slot.dirty) {
        renderSlot(slot);
      }
      const needsMore =
        slot.dirty ||
        slot.state.dragging ||
        Math.abs(slot.state.yawVel) > 0.002 ||
        Math.abs(slot.state.pitch) > 0.001 ||
        (!reducedMotion && !isSoftware);
      if (needsMore) anyActive = true;
    }

    if (anyActive) {
      vitrine.afterDraw(() => {
        if (!disposed && !document.hidden) schedule();
      });
    }
  };

  const schedule = () => {
    if (disposed || useFallback || rafId || document.hidden) return;
    if (!vitrine) {
      ensureVitrine();
      return;
    }
    rafId = requestAnimationFrame(tick);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.model as ProductModelId;
        const slot = slotMap.get(id);
        if (!slot) continue;
        slot.visible = entry.isIntersecting;
        if (slot.visible) {
          slot.dirty = true;
          ensureVitrine();
          schedule();
        }
      }
    },
    { rootMargin: '40px 0px' },
  );

  for (const slot of slots) io.observe(slot.container);

  const ro = new ResizeObserver(() => {
    for (const slot of slots) {
      if (slot.visible) slot.dirty = true;
    }
    schedule();
  });
  for (const slot of slots) ro.observe(slot.container);

  const onReducedChange = (e: MediaQueryListEvent) => {
    reducedMotion = e.matches;
    schedule();
  };
  reducedQuery.addEventListener('change', onReducedChange);

  const onVisibility = () => {
    if (!document.hidden) {
      lastTs = 0;
      schedule();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    disposed = true;
    if (rafId) cancelAnimationFrame(rafId);
    io.disconnect();
    ro.disconnect();
    reducedQuery.removeEventListener('change', onReducedChange);
    document.removeEventListener('visibilitychange', onVisibility);
    vitrine?.dispose();
    vitrine = null;
  };
}
