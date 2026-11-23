const IN_APP_UA = /Instagram|FBAN|FBAV|FB_IAB|TikTok|BytedanceWebview|musical_ly|LinkedInApp/i;

/** Detects restrictive mobile in-app WebViews that frequently block `wa.me` deep links. */
export function isRestrictiveInAppBrowser(userAgent: string): boolean {
  return IN_APP_UA.test(userAgent);
}

/**
 * Provides a non-intrusive fallback sheet (`#zap-ajuda`) when a user clicks a WhatsApp CTA
 * inside an in-app WebView (Instagram, Facebook, TikTok) and stays on the page.
 */
export function mountWhatsAppHandoff(root: Document = document): () => void {
  const dialog = root.getElementById('zap-ajuda') as HTMLDialogElement | null;
  if (!dialog) return () => {};

  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-sheet-close]');
  const copyBtn = dialog.querySelector<HTMLButtonElement>('[data-copy-wa]');
  const statusEl = dialog.querySelector<HTMLElement>('[data-copy-status]');

  let timer = 0;

  const openSheet = () => {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  };

  const closeSheet = () => {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  };

  const onDocClick = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href*="wa.me"]');
    if (!link) return;
    if (!isRestrictiveInAppBrowser(navigator.userAgent)) return;

    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (document.visibilityState === 'visible') {
        openSheet();
      }
    }, 1100);
  };

  const onVisibility = () => {
    if (document.hidden) {
      window.clearTimeout(timer);
    }
  };

  const onBackdropClick = (event: MouseEvent) => {
    if (event.target === dialog) closeSheet();
  };

  const onCopy = async () => {
    const number = copyBtn?.dataset.copyWa ?? '';
    if (!number) return;
    try {
      await navigator.clipboard.writeText(number);
      if (statusEl) statusEl.textContent = 'Número copiado para a área de transferência.';
    } catch {
      if (statusEl) statusEl.textContent = `Número: ${number}`;
    }
  };

  root.addEventListener('click', onDocClick);
  document.addEventListener('visibilitychange', onVisibility);
  closeBtn?.addEventListener('click', closeSheet);
  dialog.addEventListener('click', onBackdropClick);
  copyBtn?.addEventListener('click', onCopy);

  return () => {
    window.clearTimeout(timer);
    root.removeEventListener('click', onDocClick);
    document.removeEventListener('visibilitychange', onVisibility);
    closeBtn?.removeEventListener('click', closeSheet);
    dialog.removeEventListener('click', onBackdropClick);
    copyBtn?.removeEventListener('click', onCopy);
  };
}
