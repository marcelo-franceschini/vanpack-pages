// Medição só com `dataLayer` (pronto para GTM/GA4); nenhum script de terceiros é carregado.
window.dataLayer = window.dataLayer || [];

const sent = new Set();

/** Milissegundos desde o início da navegação. */
export const sinceLoad = () => Math.round(performance.now());

export function track(event, data = {}) {
  window.dataLayer.push({ event, ...data });
}

/** Envia o evento uma única vez por visita para a mesma `key`. */
export function trackOnce(key, event, data) {
  if (sent.has(key)) return;
  sent.add(key);
  track(event, data);
}
