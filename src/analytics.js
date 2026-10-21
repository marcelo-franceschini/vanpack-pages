// Medição. Todo evento vai para o `dataLayer` (pronto para GTM/GA4). Com VITE_ANALYTICS_PROVIDER=umami
// os eventos de negócio também vão ao Umami Cloud, pelo nosso próprio JS: sem cookies, sem storage e
// sem script de terceiro. Só envia na página publicada (o host da VITE_SITE_URL), então dev, preview e
// testes nunca sujam a medição real.
import { experimentContext } from './experiments.js';
import { inAppBrowser } from './handoff.js';

window.dataLayer = window.dataLayer || [];

const sent = new Set();

// Navegador embutido de rede social (ig, fb, tt): vai em todo evento e no resumo da visita, para
// separar a medição de quem abriu o site dentro do app (onde o WhatsApp mais falha em abrir).
const inapp = inAppBrowser();
const context = () => ({ ...(inapp && { inapp }), ...experimentContext() });

/** Milissegundos desde o início da navegação. */
export const sinceLoad = () => Math.round(performance.now());

// O plano grátis do Umami tem 100 mil eventos por mês, então só o que importa ao negócio vai para
// lá (cerca de 5 por visita); o resto (capítulos, rolagem, seções, tour, métricas) entra num único
// `visit_summary` por visita. O dataLayer continua com tudo. `handoff_fail` (o WhatsApp não abriu
// depois do clique) e `whatsapp_copy` (copiou o número na folha de ajuda) são raros.
const FORWARD = new Set([
  'whatsapp_click',
  'handoff_fail',
  'whatsapp_copy',
  'phone_click',
  'map_click',
  'cta_view',
]);

const umami = typeof __SITE__ === 'undefined' ? null : __SITE__.analytics;
// Navegador controlado por automação (Lighthouse, Playwright, Selenium) não é visitante: sem esta guarda,
// cada execução de teste no site publicado entra na medição e gasta a cota do plano grátis.
const live = Boolean(umami) && location.hostname === umami.host && !navigator.webdriver;

let cache = ''; // devolvido pelo servidor: poupa trabalho nas próximas chamadas
let disabled = false; // o servidor pediu para parar (ex.: cota esgotada)

/** POST em /api/send no mesmo formato do tracker oficial do Umami (que já funciona entre domínios). */
function send(extra = {}) {
  if (!live || disabled) return;
  fetch(`${umami.endpoint}/api/send`, {
    method: 'POST',
    credentials: 'omit',
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      'x-umami-website-id': umami.site,
      'x-umami-hostname': location.hostname,
      ...(cache && { 'x-umami-cache': cache }),
    },
    body: JSON.stringify({
      type: 'event',
      payload: {
        website: umami.site,
        hostname: location.hostname,
        language: navigator.language,
        screen: `${screen.width}x${screen.height}`,
        title: document.title,
        url: location.pathname + location.search, // com os utm_*, que o Umami lê da URL
        referrer: document.referrer,
        ...extra,
      },
    }),
  })
    .then((response) => response.json())
    .then((reply) => {
      if (reply?.disabled) disabled = true;
      if (reply?.cache) cache = reply.cache;
    })
    .catch(() => {});
}

// ---------- Resumo da visita ----------
const visit = {};
const TOUR = { tour_start: 'andando', tour_pause: 'pausado', tour_complete: 'completo' };

function remember(event, data) {
  if (event === 'chapter_view') visit.chapter = Math.max(visit.chapter ?? 0, data.chapter);
  else if (event === 'scroll_depth') visit.scroll = Math.max(visit.scroll ?? 0, data.pct);
  else if (event === 'web_vitals') visit[data.name.toLowerCase()] = data.value;
  else if (event === 'scene_ready')
    visit.scene = data.ms; // ms até a cena aparecer (0 = sem 3D)
  else if (event in TOUR) visit.tour = TOUR[event];
}

let lastSummary = '';
function sendSummary() {
  const summary = JSON.stringify(visit);
  if (summary === '{}' || summary === lastSummary) return;
  lastSummary = summary;
  send({ name: 'visit_summary', data: { ...visit, ...context() } });
}

// A visualização da página (evento sem nome) sai depois do carregamento, com o navegador ocioso: ela
// não disputa a largada (conexão com um servidor de terceiro, pedido CORS) com o worker da cena. Se a
// pessoa sai antes, ou se um evento de negócio vem antes, ela vai primeiro: a ordem é sempre
// visualização, eventos, resumo.
let viewSent = false;
function sendView() {
  if (viewSent) return;
  viewSent = true;
  send();
}

if (live) {
  const idle = () =>
    'requestIdleCallback' in window
      ? requestIdleCallback(sendView, { timeout: 3000 })
      : setTimeout(sendView, 1500);
  if (document.readyState === 'complete') idle();
  else addEventListener('load', idle, { once: true });
  // Ao sair da página (aba escondida ou fechada). O setTimeout deixa o web-vitals, que também
  // reporta ao esconder a aba, entregar LCP, INP e CLS antes do resumo.
  addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      sendView();
      setTimeout(sendSummary);
    }
  });
  addEventListener('pagehide', () => {
    sendView();
    sendSummary();
  });
}

export function track(event, data = {}) {
  // todo evento leva a variante de cada experimento (exp_<nome>) e, se houver, o navegador embutido
  const full = { ...data, ...context() };
  window.dataLayer.push({ event, ...full });
  remember(event, data);
  if (FORWARD.has(event)) {
    if (live) sendView();
    send({ name: event, data: full });
  }
}

/** Envia o evento uma única vez por visita para a mesma `key`. */
export function trackOnce(key, event, data) {
  if (sent.has(key)) return;
  sent.add(key);
  track(event, data);
}
