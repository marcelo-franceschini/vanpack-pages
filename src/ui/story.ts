import { clamp } from '../engine/math';
import { mountFactoryStage } from '../engine/stage';
import { CHAPTER_STOPS } from '../scenes/factory/constants';

/** Maps normalized scroll progress `p` (0..1) to the active story chapter index (0..4). */
export function chapterIndexFromProgress(p: number): number {
  const x = clamp(p);
  if (x < 0.14) return 0;
  if (x < 0.37) return 1;
  if (x < 0.62) return 2;
  if (x < 0.85) return 3;
  return 4;
}

/** Computes the exact scrollY coordinate to land on a given chapter index (0..4). */
export function scrollTargetForChapter(
  storyTop: number,
  storyHeight: number,
  viewportHeight: number,
  chapterIndex: number,
): number {
  const idx = clamp(Math.round(chapterIndex), 0, CHAPTER_STOPS.length - 1);
  const scrollable = Math.max(1, storyHeight - viewportHeight);
  return Math.round(storyTop + CHAPTER_STOPS[idx] * scrollable);
}

/**
 * Wires the sticky 3D factory story section (`#processo`), chapter beats (`01`..`05`),
 * and discreet clickable chapter navigator without ever hijacking the user's scroll position.
 */
export function mountStory(root: Document = document): () => void {
  const story = root.getElementById('processo');
  const stageEl = story?.querySelector<HTMLElement>('[data-stage]');
  if (!story || !stageEl) return () => {};

  const beats = [...story.querySelectorAll<HTMLElement>('[data-beat]')];
  const navButtons = [...story.querySelectorAll<HTMLButtonElement>('[data-chapter]')];
  const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  const computeProgress = (): number => {
    if (reducedQuery.matches) return 0;
    const rect = story.getBoundingClientRect();
    const scrollable = Math.max(1, story.offsetHeight - window.innerHeight);
    return clamp(-rect.top / scrollable);
  };

  let activeBeat = -1;
  const stage = mountFactoryStage(stageEl, computeProgress());

  const applyProgress = (p: number) => {
    stageEl.style.setProperty('--story-p', p.toFixed(4));
    stage.setProgress(p);

    const nextBeat = chapterIndexFromProgress(p);
    if (nextBeat !== activeBeat) {
      activeBeat = nextBeat;
      beats.forEach((beat, idx) => {
        const on = idx === activeBeat;
        beat.classList.toggle('on', on);
        if (on) beat.removeAttribute('aria-hidden');
        else beat.setAttribute('aria-hidden', 'true');
      });
      navButtons.forEach((btn, idx) => {
        if (idx === activeBeat) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      });
    }
  };

  let scheduled = false;
  const onScrollOrResize = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      applyProgress(computeProgress());
    });
  };

  // Interactive chapter navigation clicks
  const onNavClick = (event: MouseEvent) => {
    const btn = event.currentTarget as HTMLButtonElement | null;
    if (!btn) return;
    const idx = Number.parseInt(btn.dataset.chapter ?? '0', 10);
    const storyTop = story.getBoundingClientRect().top + window.scrollY;
    const targetY = scrollTargetForChapter(storyTop, story.offsetHeight, window.innerHeight, idx);
    window.scrollTo({
      top: targetY,
      behavior: reducedQuery.matches ? 'auto' : 'smooth',
    });
  };

  for (const btn of navButtons) {
    btn.addEventListener('click', onNavClick);
  }

  // Pause 3D factory rendering cleanly when scrolled past `#processo`
  const io = new IntersectionObserver(
    (entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      stage.setVisible(visible);
    },
    { rootMargin: '120px 0px' },
  );
  io.observe(story);

  window.addEventListener('scroll', onScrollOrResize, { passive: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });

  // Apply initial state without mutating scroll position
  applyProgress(computeProgress());

  return () => {
    io.disconnect();
    window.removeEventListener('scroll', onScrollOrResize);
    window.removeEventListener('resize', onScrollOrResize);
    for (const btn of navButtons) {
      btn.removeEventListener('click', onNavClick);
    }
    stage.dispose();
  };
}
