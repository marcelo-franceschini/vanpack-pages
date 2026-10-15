// Lighthouse (mobile e desktop) sobre o build de produção: mediana de N execuções.
// Baixa o Lighthouse com `npx` (precisa de rede) e usa o Chrome de CHROME_PATH.
// Uso: node scripts/audit/lighthouse.mjs [execuções=3]
import { execFile } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { ROOT, startServer } from '../lib.mjs';

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
for (const mode of ['mobile', 'desktop']) {
  const reports = [];
  for (let i = 1; i <= runs; i++) {
    const output = join(dir, `${mode}-${i}.json`);
    await run(
      'npx',
      [
        '--yes',
        'lighthouse',
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
  console.log(
    `${mode.padEnd(8)} ${String(score('performance')).padStart(10)}  ${String(score('accessibility')).padStart(8)}  ${String(score('best-practices')).padStart(13)}  ${String(score('seo')).padStart(3)}  ${(metric('largest-contentful-paint') / 1000).toFixed(2).padStart(5)} s  ${metric('total-blocking-time').toFixed(0).padStart(4)} ms  ${metric('cumulative-layout-shift').toFixed(3)}  ${(metric('first-contentful-paint') / 1000).toFixed(2)} s  ${reports.map((r) => Math.round(r.categories.performance.score * 100)).join('/')}`,
  );
}
rmSync(dir, { recursive: true, force: true });
await server.close();
