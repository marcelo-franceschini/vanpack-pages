// Experimentos A/B no navegador (a configuração está em site.config.js, `experiments`, e chega por
// __SITE__). A variante é sorteada uma vez por visita e fica só no sessionStorage: sem banner não há
// consentimento, então nada de localStorage. Todo evento leva `exp_<nome>` (analytics.js) e o <html>
// ganha `data-exp_<nome>`. `?exp_<nome>=A|B` força a variante (QA e testes), mesmo com o experimento
// desligado; depois de `endsAt` só vale a variante A.
const config = typeof __SITE__ === 'undefined' ? {} : (__SITE__.experiments ?? {});

const chosen = {}; // variante de cada experimento já resolvido
const running = new Set(); // experimentos ligados (ou forçados) nesta visita

function stored(key, draw) {
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) return saved;
    const value = draw();
    sessionStorage.setItem(key, value);
    return value;
  } catch {
    return draw(); // storage bloqueado: vale o sorteio desta página
  }
}

/** Sorteia uma variante pelos pesos de `split`. */
function draw({ variants, split }) {
  const total = split.reduce((sum, weight) => sum + weight, 0);
  let point = Math.random() * total;
  for (const [i, weight] of split.entries()) {
    point -= weight;
    if (point < 0) return variants[i];
  }
  return variants[0];
}

/** Variante do experimento nesta visita ("A" quando não existe, está desligado ou já acabou). */
export function variant(name) {
  if (name in chosen) return chosen[name];
  const experiment = config[name];
  let value = 'A';
  if (experiment) {
    const forced = new URLSearchParams(location.search).get(`exp_${name}`);
    const over = experiment.endsAt && Date.now() > Date.parse(experiment.endsAt);
    if (forced && experiment.variants.includes(forced)) {
      value = forced;
      running.add(name);
    } else if (experiment.enabled && !over) {
      const picked = stored(`vanpack:exp:${name}`, () => draw(experiment));
      value = experiment.variants.includes(picked) ? picked : 'A';
      running.add(name);
    }
    // só o experimento em andamento marca o <html> e os eventos
    if (running.has(name)) document.documentElement.dataset[`exp_${name}`] = value;
  }
  chosen[name] = value;
  return value;
}

/** Sorteia (ou força) todos os experimentos configurados; chame no início da página. */
export function startExperiments() {
  for (const name of Object.keys(config)) variant(name);
}

/** `exp_<nome>: variante` de cada experimento em andamento, para somar a todo evento. */
export function experimentContext() {
  return Object.fromEntries([...running].map((name) => [`exp_${name}`, chosen[name]]));
}
