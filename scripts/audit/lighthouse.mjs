// Lighthouse (mobile e desktop) sobre o build de produção: mediana de N execuções.
// Baixa o Lighthouse com `npx` (precisa de rede, na versão fixada abaixo) e usa o Chrome de CHROME_PATH.
// Uso: node scripts/audit/lighthouse.mjs [execuções=3]
//
// Tetos, medidos em 21/10/2026 com o three.js avisado no <head> (mobile: desempenho 99, LCP 2,0 s, FCP
// 1,24 s, TBT 0, CLS 0; desktop: desempenho 99 a 100, LCP 0,44 s); só descem. Passar de um teto sai com
// erro; no CI do PR este script roda como informativo (o job não bloqueia o merge). O SEO não entra: em
// modo demo o `noindex` o derruba de propósito (SEO 100 só em production, ver docs/go-live.md).
// Com GITHUB_STEP_SUMMARY definido (Actions), escreve também o resumo em Markdown.
import { execFile } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ROOT, startServer } from '../lib.mjs';

const LIGHTHOUSE = 'lighthouse@13.5.0';
const BUDGETS = {
  mobile: { performance: 99, accessibility: 96, bestPractices: 100, lcp: 2200, tbt: 50, cls: 0.01 },
  desktop: { performance: 99, accessibility: 96, bestPractices: 100, lcp: 500, tbt: 50, cls: 0.01 },
};

const run = promisify(execFile);
const runs = Number(process.argv[2] ?? 3);
const chrome = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';
if (!existsSync(`${ROOT}dist/index.html`)) {
  console.error('Sem dist/: rode `npm run build` antes.');
  process.exit(2);
}

const median = (values) => [...values].sort((a, b) => a - b)[values.length >> 1];
const server = await startServer('dist');
const dir = mkdtempSync(join(tmpdir(), 'lighthouse-'));
console.log(`Lighthouse, mediana de ${runs} execuções (${server.url})`);
console.log(
  'modo     desempenho  acessib.  boas práticas  SEO   LCP      TBT     CLS    FCP     execuções',
);
const summary = [
  `### Lighthouse (informativo, mediana de ${runs}; teto entre parênteses)`,
  '',
  '| modo | desempenho | acessibilidade | boas práticas | LCP | TBT | CLS | FCP |',
  '|---|---|---|---|---|---|---|---|',
];
const problems = [];
for (const mode of ['mobile', 'desktop']) {
  const reports = [];
  for (let i = 1; i <= runs; i++) {
    const output = join(dir, `${mode}-${i}.json`);
    await run(
      'npx',
      [
        '--yes',
        LIGHTHOUSE,
        server.url,
        ...(mode === 'desktop' ? ['--preset=desktop'] : []),
        '--only-categories=performance,accessibility,best-practices,seo',
        `--chrome-flags=--headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`,
        '--output=json',
        `--output-path=${output}`,
        '--quiet',
      ],
      { env: { ...process.env, CHROME_PATH: chrome }, maxBuffer: 64 * 1024 * 1024 },
    );
    reports.push(JSON.parse(readFileSync(output, 'utf8')));
  }
  const score = (key) => median(reports.map((r) => Math.round(r.categories[key].score * 100)));
  const metric = (key) => median(reports.map((r) => r.audits[key].numericValue));
  const got = {
    performance: score('performance'),
    accessibility: score('accessibility'),
    bestPractices: score('best-practices'),
    lcp: metric('largest-contentful-paint'),
    tbt: metric('total-blocking-time'),
    cls: metric('cumulative-layout-shift'),
    fcp: metric('first-contentful-paint'),
  };
  console.log(
    `${mode.padEnd(8)} ${String(got.performance).padStart(10)}  ${String(got.accessibility).padStart(8)}  ${String(got.bestPractices).padStart(13)}  ${String(score('seo')).padStart(3)}  ${(got.lcp / 1000).toFixed(2).padStart(5)} s  ${got.tbt.toFixed(0).padStart(4)} ms  ${got.cls.toFixed(3)}  ${(got.fcp / 1000).toFixed(2)} s  ${reports.map((r) => Math.round(r.categories.performance.score * 100)).join('/')}`,
  );
  const limit = BUDGETS[mode];
  for (const [key, floor, label] of [
    ['performance', limit.performance, 'desempenho'],
    ['accessibility', limit.accessibility, 'acessibilidade'],
    ['bestPractices', limit.bestPractices, 'boas práticas'],
  ]) {
    if (got[key] < floor) problems.push(`${mode}: ${label} ${got[key]} abaixo do piso de ${floor}`);
  }
  for (const [key, ceiling, label, unit] of [
    ['lcp', limit.lcp, 'LCP', 'ms'],
    ['tbt', limit.tbt, 'TBT', 'ms'],
    ['cls', limit.cls, 'CLS', ''],
  ]) {
    if (got[key] > ceiling) {
      problems.push(
        `${mode}: ${label} ${got[key].toFixed(key === 'cls' ? 3 : 0)}${unit && ` ${unit}`} passou do teto de ${ceiling}${unit && ` ${unit}`}`,
      );
    }
  }
  summary.push(
    `| ${mode} | ${got.performance} (≥ ${limit.performance}) | ${got.accessibility} (≥ ${limit.accessibility}) | ${got.bestPractices} (≥ ${limit.bestPractices}) | ${(got.lcp / 1000).toFixed(2)} s (≤ ${limit.lcp / 1000} s) | ${got.tbt.toFixed(0)} ms (≤ ${limit.tbt}) | ${got.cls.toFixed(3)} (≤ ${limit.cls}) | ${(got.fcp / 1000).toFixed(2)} s |`,
  );
}
rmSync(dir, { recursive: true, force: true });
await server.close();

summary.push(
  '',
  problems.length ? `Fora do orçamento: ${problems.join('; ')}.` : 'Dentro do orçamento.',
);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary.join('\n')}\n\n`);
}
if (problems.length) {
  console.error(
    `\n${problems.join('\n')}\nOs tetos só descem: entenda a causa antes de mexer neles.`,
  );
  process.exit(1);
}
console.log('Dentro do orçamento.');
