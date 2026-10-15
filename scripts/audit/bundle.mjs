// Peso do build (rode `npm run build` antes): gzip e brotli por arquivo, o JS carregado no caminho
// normal (página + worker) e no fallback, o CSS inline, a carga inicial e os maiores módulos.
// Sai com erro se o JS inicial passar do orçamento de 165 KB gzip.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { build } from 'vite';
import { ROOT } from '../lib.mjs';

const BUDGET_KB = 165;
const dist = `${ROOT}dist/`;
if (!existsSync(`${dist}index.html`)) {
  console.error('Sem dist/: rode `npm run build` antes.');
  process.exit(2);
}

const kb = (bytes) => (bytes / 1024).toFixed(1).padStart(7);
const gzip = (buffer) => gzipSync(buffer, { level: 9 }).length;
const brotli = (buffer) =>
  brotliCompressSync(buffer, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const read = (file) => readFileSync(`${dist}${file}`);

const assets = readdirSync(`${dist}assets`).map((name) => `assets/${name}`);
const find = (re) => assets.find((file) => re.test(file));
const files = {
  html: 'index.html',
  main: find(/^assets\/index-.*\.js$/),
  worker: find(/^assets\/worker-.*\.js$/),
  fallback: find(/^assets\/controller-.*\.js$/),
};

const html = read(files.html).toString('utf8');
const css = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('');

console.log('Arquivo                                         bruto    gzip  brotli');
const sizes = {};
for (const [role, file] of Object.entries(files)) {
  const data = read(file);
  sizes[role] = { raw: data.length, gzip: gzip(data), brotli: brotli(data) };
  console.log(
    `${`${role} (${file})`.padEnd(44)} ${kb(data.length)} ${kb(sizes[role].gzip)} ${kb(sizes[role].brotli)}`,
  );
}
const cssSize = { raw: Buffer.byteLength(css), gzip: gzip(Buffer.from(css)) };
console.log(`${'CSS inline (dentro do HTML)'.padEnd(44)} ${kb(cssSize.raw)} ${kb(cssSize.gzip)}`);

// Caminho normal: HTML + script da página + worker (o fallback só baixa se o worker falhar).
const font = read('fonts/archivo-latin.woff2').length;
const logos = ['brand/vanpack-horizontal.svg', 'brand/vanpack-simbolo.svg'].map((f) =>
  gzip(read(f)),
);
const jsInitial = sizes.main.gzip + sizes.worker.gzip;
const jsFallbackPath = sizes.main.gzip + sizes.worker.gzip + sizes.fallback.gzip;
const initial = sizes.html.gzip + jsInitial + font + logos.reduce((a, b) => a + b, 0);

console.log('\nResumo (KB, gzip)');
console.log(`  JS no caminho normal (página + worker) : ${kb(jsInitial)}   orçamento ${BUDGET_KB}`);
console.log(`  JS se o worker falhar (+ thread principal): ${kb(jsFallbackPath)}`);
console.log(`  Carga inicial (HTML + JS + fonte + logos): ${kb(initial)}`);

// Maiores módulos: tamanho renderizado (antes da minificação, depois do tree-shaking).
const rows = [];
const analyzer = () => ({
  name: 'audit:modules',
  generateBundle(_, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue;
      for (const [id, module] of Object.entries(chunk.modules)) {
        rows.push({ chunk: chunk.fileName, id: id.replace(ROOT, ''), size: module.renderedLength });
      }
    }
  },
});
await build({
  root: ROOT,
  logLevel: 'silent',
  plugins: [analyzer()],
  worker: { plugins: () => [analyzer()] },
  build: { write: false },
});
const worker = rows.filter((r) => /^assets\/worker-/.test(r.chunk));
const grouped = new Map();
for (const { id, size } of worker) {
  const key = id.includes('node_modules/three/')
    ? id.replace(/^.*node_modules\/three\//, 'three/')
    : id;
  grouped.set(key, (grouped.get(key) ?? 0) + size);
}
console.log('\n5 maiores módulos do worker (KB renderizados, antes de minificar)');
for (const [id, size] of [...grouped].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`  ${kb(size)}  ${id}`);
}

if (jsInitial / 1024 > BUDGET_KB) {
  console.error(`\nJS inicial acima do orçamento de ${BUDGET_KB} KB gzip.`);
  process.exit(1);
}
