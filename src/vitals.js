// Core Web Vitals reais (LCP, INP e CLS) medidos nos visitantes. O pacote web-vitals só é carregado
// quando o navegador está ocioso, para não disputar a largada com a cena 3D.
export function watchVitals(report) {
  const start = () =>
    import('web-vitals').then(({ onCLS, onINP, onLCP }) => {
      for (const watch of [onLCP, onINP, onCLS]) watch(({ name, value }) => report(name, value));
    });
  if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 5000 });
  else setTimeout(start, 2000);
}
