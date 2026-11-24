import type { StageController, StageState } from './controller';

export interface MountedStage {
  setProgress: (progress: number) => void;
  setVisible: (visible: boolean) => void;
  dispose: () => void;
}

/**
 * Mounts the sticky 3D factory stage on the provided container.
 * Dynamically imports the PBR Three.js controller (keeping initial JS lean), synchronizes
 * scroll progress instantaneously, and falls back smoothly to an editorial poster if WebGL fails.
 */
export function mountFactoryStage(stageEl: HTMLElement, initialProgress = 0): MountedStage {
  const canvas = stageEl.querySelector('canvas');
  if (!canvas) {
    stageEl.dataset.fallback = 'true';
    return { setProgress() {}, setVisible() {}, dispose() {} };
  }

  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const rect = stageEl.getBoundingClientRect();
  let latestProgress = initialProgress;
  let latestVisible = !document.hidden;
  let controller: StageController | null = null;
  let disposed = false;

  const initial: StageState = {
    width: Math.max(320, rect.width || window.innerWidth),
    height: Math.max(320, rect.height || window.innerHeight),
    dpr: window.devicePixelRatio || 1,
    progress: latestProgress,
    visible: latestVisible,
    reducedMotion: reducedQuery.matches,
  };

  void import('./controller')
    .then(({ createStageController }) => {
      if (disposed) return;
      controller = createStageController(
        canvas,
        { ...initial, progress: latestProgress, visible: latestVisible },
        () => {
          stageEl.dataset.ready = 'true';
        },
      );
    })
    .catch(() => {
      stageEl.dataset.fallback = 'true';
    });

  const sendResize = () => {
    const r = stageEl.getBoundingClientRect();
    if (!r.width || !r.height) return;
    controller?.resize(r.width, r.height, window.devicePixelRatio || 1);
  };

  const ro = new ResizeObserver(sendResize);
  ro.observe(stageEl);

  const onReducedChange = (e: MediaQueryListEvent) => {
    controller?.setReducedMotion(e.matches);
  };
  reducedQuery.addEventListener('change', onReducedChange);

  const setVisible = (visible: boolean) => {
    latestVisible = visible && !document.hidden;
    controller?.setVisible(latestVisible);
  };

  const onVisibility = () => setVisible(latestVisible);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setProgress(progress: number) {
      latestProgress = progress;
      controller?.setProgress(progress);
    },
    setVisible,
    dispose() {
      disposed = true;
      ro.disconnect();
      reducedQuery.removeEventListener('change', onReducedChange);
      document.removeEventListener('visibilitychange', onVisibility);
      controller?.dispose();
      controller = null;
    },
  };
}
