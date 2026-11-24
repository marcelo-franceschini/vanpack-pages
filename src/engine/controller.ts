import { WebGLRenderer } from 'three';
import { clamp, damp } from './math';
import { configureRenderer, detectSoftwareGl, waitAfterDraw } from './environment';
import { createFactoryScene, type FactorySceneHandle } from '../scenes/factory/index';

export interface StageState {
  width: number;
  height: number;
  dpr: number;
  progress: number;
  visible: boolean;
  reducedMotion: boolean;
}

export interface StageController {
  resize: (width: number, height: number, dpr: number) => void;
  setProgress: (progress: number) => void;
  setVisible: (visible: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  dispose: () => void;
}

const MOBILE_WIDTH = 760;

/**
 * Orchestrates the factory 3D WebGL renderer with smooth scroll damping, subtle living idle
 * motion when visible near p=0, visibility sleep, and software-GL safe frame pacing.
 */
export function createStageController(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  initial: StageState,
  onReady?: () => void,
): StageController {
  const probeCanvas = canvas;
  const mobile = initial.width <= MOBILE_WIDTH;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas: probeCanvas as HTMLCanvasElement,
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
    });
  } catch {
    renderer = new WebGLRenderer({
      canvas: probeCanvas as HTMLCanvasElement,
      antialias: false,
      alpha: false,
    });
  }

  const gl = renderer.getContext();
  const isSoftware = detectSoftwareGl(gl);
  configureRenderer(renderer, {
    isSoftware,
    mobile,
    dpr: initial.dpr,
    shadows: true,
  });

  const factory: FactorySceneHandle = createFactoryScene({
    renderer,
    shadows: renderer.shadowMap.enabled,
  });

  let width = Math.max(1, initial.width);
  let height = Math.max(1, initial.height);
  let targetProgress = clamp(initial.progress);
  let currentProgress = targetProgress;
  let visible = initial.visible;
  let reducedMotion = initial.reducedMotion;
  let disposed = false;
  let idleTime = 0;
  let rafId = 0;
  let pendingDraw = false;
  let lastTs = 0;
  let readyFired = false;

  const applySize = (w: number, h: number, dpr: number) => {
    width = Math.max(1, Math.round(w));
    height = Math.max(1, Math.round(h));
    const isMob = width <= MOBILE_WIDTH;
    renderer.setPixelRatio(isSoftware ? 1 : Math.min(dpr, isMob ? 1.75 : 2));
    renderer.setSize(width, height, false);
    factory.resize(width, height, isMob);
  };

  applySize(width, height, initial.dpr);

  const renderFrame = (dt: number) => {
    if (disposed) return;

    const delta = Math.min(0.05, Math.max(0.001, dt));
    if (reducedMotion || isSoftware) {
      currentProgress = targetProgress;
    } else {
      currentProgress = damp(currentProgress, targetProgress, 11, delta);
      if (Math.abs(currentProgress - targetProgress) < 0.00025) {
        currentProgress = targetProgress;
      }
    }

    const shouldIdle = !reducedMotion && !isSoftware && currentProgress < 0.06;
    if (shouldIdle) {
      idleTime += delta;
    }

    factory.update(currentProgress, idleTime, width <= MOBILE_WIDTH);
    renderer.render(factory.scene, factory.camera);

    if (!readyFired) {
      readyFired = true;
      onReady?.();
    }

    const needsMore =
      visible && (Math.abs(currentProgress - targetProgress) > 0.00025 || shouldIdle);

    if (needsMore) {
      pendingDraw = true;
      waitAfterDraw(gl, isSoftware, () => {
        pendingDraw = false;
        if (!disposed && visible) schedule();
      });
    }
  };

  let lastRenderAt = 0;

  const tick = (ts: number) => {
    rafId = 0;
    if (disposed || !visible) return;
    if (isSoftware && lastRenderAt && ts - lastRenderAt < 85) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    const dt = lastTs ? (ts - lastTs) / 1000 : 1 / 60;
    lastTs = ts;
    lastRenderAt = ts;
    renderFrame(dt);
  };

  const schedule = () => {
    if (disposed || !visible || rafId || pendingDraw) return;
    rafId = requestAnimationFrame(tick);
  };

  // Render first frame synchronously for instant visual presence
  renderFrame(1 / 60);
  if (visible && !isSoftware && !reducedMotion) {
    schedule();
  }

  return {
    resize(w, h, dpr) {
      if (disposed) return;
      applySize(w, h, dpr);
      renderFrame(1 / 60);
      schedule();
    },
    setProgress(p) {
      if (disposed) return;
      targetProgress = clamp(p);
      schedule();
    },
    setVisible(next) {
      if (disposed || visible === next) return;
      visible = next;
      if (visible) {
        lastTs = 0;
        schedule();
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
    setReducedMotion(reduced) {
      if (disposed) return;
      reducedMotion = reduced;
      if (reduced) {
        currentProgress = targetProgress;
        renderFrame(1 / 60);
      } else {
        schedule();
      }
    },
    dispose() {
      disposed = true;
      if (rafId) cancelAnimationFrame(rafId);
      factory.dispose();
      renderer.dispose();
    },
  };
}
