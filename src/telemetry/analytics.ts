type EventPayload = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

function sendUmami(name: string, data?: EventPayload): void {
  const cfg = __SITE__.analytics;
  if (!cfg || navigator.webdriver) return;
  if (cfg.host && window.location.hostname !== cfg.host) return;
  const body = JSON.stringify({
    type: 'event',
    payload: {
      website: cfg.site,
      hostname: cfg.host || window.location.hostname,
      language: navigator.language,
      screen: `${window.screen.width}x${window.screen.height}`,
      title: document.title,
      url: window.location.pathname,
      name,
      ...(data ? { data } : {}),
    },
  });

  const url = `${cfg.endpoint}/api/send`;
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(url, {
        method: 'POST',
        body,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    // Non-blocking telemetry
  }
}

export function trackEvent(name: string, data?: EventPayload): void {
  (window.dataLayer ??= []).push({ event: name, ...data });
  sendUmami(name, data);
}

/**
 * Initializes anonymous conversion tracking on CTAs and lazily loads `web-vitals` ONLY when
 * an analytics endpoint is configured in production.
 */
export function initAnalytics(root: Document = document): () => void {
  const onClick = (event: MouseEvent) => {
    const el = (event.target as Element | null)?.closest<HTMLElement>('[data-cta],[data-contact]');
    if (!el) return;
    if (el.dataset.cta) {
      trackEvent('cta_whatsapp', { source: el.dataset.cta });
    } else if (el.dataset.contact) {
      trackEvent('contact_click', { channel: el.dataset.contact });
    }
  };

  root.addEventListener('click', onClick);

  if (__SITE__.analytics) {
    sendUmami('pageview');
    void import('web-vitals')
      .then(({ onCLS, onINP, onLCP }) => {
        const report = (metric: { name: string; value: number; rating: string }) => {
          trackEvent('web_vital', {
            metric: metric.name,
            value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
            rating: metric.rating,
          });
        };
        onLCP(report);
        onCLS(report);
        onINP(report);
      })
      .catch(() => {});
  }

  return () => {
    root.removeEventListener('click', onClick);
  };
}
