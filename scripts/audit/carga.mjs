// Carga com rede e CPU limitadas (rode `npm run build` antes): o que o Lighthouse não mostra. Abre a página
// num celular (390x844), com cache frio, atrás de um servidor que imita uma rede lenta (150 ms por
// resposta, 1,6 Mbps compartilhados, gzip nível 9, ver servidor-lento.mjs) e com a CPU 4x mais lenta, e
// mede, na mediana de 11 aberturas (a 1ª, que aquece o Chrome, é descartada): FCP e LCP reais, o tempo até
// a cena 3D aparecer (o LCP não enxerga o <canvas>), as tarefas longas e a fila de pedidos
// (script da página, worker da história, three.js), com o início de cada um.
//
// Atenção: o Chrome de teste não tem GPU (WebGL por software), então o tempo da cena vale para comparar
// duas versões do site na mesma máquina, não como promessa para um aparelho real. A variação entre séries
// da mesma versão é de uns 40 ms.
//
// Tetos (só valem no perfil padrão, e só descem; medidos em 21/10/2026 com o three.js avisado no <head>:
// cena 1,57 s, FCP e LCP 0,57 s): cena pronta ≤ 1,75 s, FCP e LCP ≤ 0,70 s. Passar de um teto sai com erro.
//
// Uso: node scripts/audit/carga.mjs [--dir=dist (ou um caminho absoluto)] [--runs=11] [--rtt=150] [--kbps=1600] [--cpu=4]
//        [--tela=celular|desktop]
import { existsSync } from 'node:fs';
import { ROOT, launch } from '../lib.mjs';
import { iniciarServidorLento } from './servidor-lento.mjs';

const arg = (name, fallback) =>
  process.argv.find((item) => item.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const chosen = arg('dir', 'dist');
const dir = chosen.startsWith('/') ? chosen : `${ROOT}${chosen}`;
const runs = Number(arg('runs', 11));
const rtt = Number(arg('rtt', 150));
const kbps = Number(arg('kbps', 1600));
const cpu = Number(arg('cpu', 4));
const mobile = arg('tela', 'celular') !== 'desktop';
const defaults = rtt === 150 && kbps === 1600 && cpu === 4 && mobile && runs >= 11;
const MAX_SCENE_MS = 1750;
const MAX_PAINT_MS = 700;

if (!existsSync(`${dir}/index.html`)) {
  console.error(`Sem ${dir}/index.html: rode \`npm run build\` antes.`);
  process.exit(2);
}

const median = (values) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? sorted[sorted.length >> 1] : NaN;
};
const round = (value) => (Number.isFinite(value) ? Math.round(value) : 'n/d');

const server = await iniciarServidorLento({ dir, rttMs: rtt, kbps });
const browser = await launch();
const rows = [];
for (let i = 0; i < runs + 1; i++) {
  server.reset();
  const context = await browser.newContext(
    mobile
      ? {
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
        }
      : { viewport: { width: 1440, height: 900 } },
  );
  const page = await context.newPage();
  await page.addInitScript(() => {
    const seen = { longTasks: 0 };
    /** @type {any} */ (window).__carga = seen;
    const watch = (type, onEntry) =>
      new PerformanceObserver((list) => list.getEntries().forEach(onEntry)).observe({
        type,
        buffered: true,
      });
    watch('paint', (e) => e.name === 'first-contentful-paint' && (seen.fcp = e.startTime));
    watch('largest-contentful-paint', (e) => (seen.lcp = e.startTime));
    watch('longtask', (e) => (seen.longTasks += Math.max(0, e.duration - 50)));
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
  await page.goto(`${server.url}?tour=0`, { waitUntil: 'commit' });
  await page.waitForSelector('.stage.ready', { timeout: 90_000 }).catch(() => {});
  await page.waitForTimeout(800);
  const seen = await page.evaluate(() => ({
    .../** @type {any} */ (window).__carga,
    scene: /** @type {any} */ (window).dataLayer?.find((e) => e.event === 'scene_ready')?.ms,
  }));
  const request = (pattern) => server.log.find((entry) => pattern.test(entry.url));
  const bytes = server.log.reduce((sum, entry) => sum + (entry.tamanho ?? 0), 0);
  rows.push({
    fcp: seen.fcp,
    lcp: seen.lcp,
    scene: seen.scene,
    longTasks: seen.longTasks,
    script: request(/assets\/index-/)?.chegou,
    worker: request(/assets\/worker-/)?.chegou,
    three: request(/assets\/three-/)?.chegou,
    threeEnd: request(/assets\/three-/)?.fim ?? NaN,
    requests: server.log.length,
    bytes,
  });
  await context.close();
}
rows.shift();
await browser.close();
await server.close();

const col = (key) => median(rows.map((row) => row[key]));
console.log(
  `${dir.replace(ROOT, '')}: n=${rows.length}, ${rtt} ms, ${kbps} kbps, CPU ${cpu}x, ${mobile ? 'celular' : 'desktop'}`,
);
console.log(
  `  FCP ${round(col('fcp'))} ms | LCP ${round(col('lcp'))} ms | cena pronta ${round(col('scene'))} ms | tarefas longas (excesso sobre 50 ms) ${round(col('longTasks'))} ms`,
);
console.log(
  `  pedidos (início, ms): script ${round(col('script'))} > worker ${round(col('worker'))} > three.js ${round(col('three'))} (termina ${round(col('threeEnd'))}) | ${round(col('requests'))} pedidos, ${(col('bytes') / 1024).toFixed(1)} KB gzip`,
);
console.log(`  cena pronta por abertura: ${rows.map((row) => round(row.scene)).join(' ')}`);

if (defaults) {
  const problems = [];
  if (!(col('scene') <= MAX_SCENE_MS))
    problems.push(`cena pronta ${round(col('scene'))} ms passou do teto de ${MAX_SCENE_MS} ms`);
  for (const key of ['fcp', 'lcp']) {
    if (!(col(key) <= MAX_PAINT_MS))
      problems.push(
        `${key.toUpperCase()} ${round(col(key))} ms passou do teto de ${MAX_PAINT_MS} ms`,
      );
  }
  if (problems.length) {
    console.error(
      `\n${problems.join('\n')}\nOs tetos só descem: entenda a causa antes de mexer neles.`,
    );
    process.exit(1);
  }
  console.log(`  dentro dos tetos (cena ≤ ${MAX_SCENE_MS} ms, FCP e LCP ≤ ${MAX_PAINT_MS} ms)`);
}
