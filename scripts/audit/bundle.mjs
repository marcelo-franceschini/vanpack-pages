// Peso do build (rode `npm run build` antes): gzip e brotli por arquivo, o JS carregado no caminho
// normal (página + worker da história + three.js) e no fallback, o CSS inline, a carga inicial, o 3D
// dos produtos (baixado só perto da seção, fora da carga inicial), a visita completa e os maiores
// módulos. O three.js é um arquivo só, compartilhado pelos dois workers e pelo fallback
// (build/three-compartilhado.js). Sai com erro se o JS inicial passar do orçamento de 165 KB gzip ou
// se o script da página levar o three.js. Os tetos por arquivo ficam em tests/orcamento.test.mjs.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { buildThree } from '../../build/three-compartilhado.js';
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
  three: find(/^assets\/three-.*\.js$/),
  fallback: find(/^assets\/controller-.*\.js$/),
  // 3D dos produtos: só quando a seção chega perto (src/produtos/gatilho.js)
  produtos: find(/^assets\/montar-.*\.js$/),
  produtosWorker: find(/^assets\/produtos-worker-.*\.js$/),
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
const jsInitial = sizes.main.gzip + sizes.worker.gzip + sizes.three.gzip;
const jsFallbackPath = jsInitial + sizes.fallback.gzip;
const initial = sizes.html.gzip + jsInitial + font + logos.reduce((a, b) => a + b, 0);

console.log('\nResumo (KB, gzip)');
console.log(
  `  JS no caminho normal (página + worker + three): ${kb(jsInitial)}   orçamento ${BUDGET_KB}`,
);
console.log(`  JS se o worker falhar (+ thread principal): ${kb(jsFallbackPath)}`);
console.log(`  Carga inicial (HTML + JS + fonte + logos): ${kb(initial)}`);
const lazy = sizes.produtos.gzip + sizes.produtosWorker.gzip;
console.log(`  3D dos produtos, só perto da seção (montar + worker): ${kb(lazy)}`);
console.log(`  Visita completa (carga inicial + 3D dos produtos): ${kb(initial + lazy)}`);
const threeInMain = /WebGLRenderer|WEBGL_lose_context/.test(read(files.main).toString('utf8'));
console.log(`  three.js no script da página: ${threeInMain ? 'SIM (erro)' : 'não'}`);

// Maiores módulos: tamanho renderizado (antes da minificação, depois do tree-shaking). O three.js sai
// do build compartilhado; o resto, do código da cena e do render (os módulos de src/ no worker).
const rows = [];
const analyzer = () => ({
  name: 'audit:modules',
  generateBundle(_, bundle) {
    for (const chunk of Object.values(bundle)) {
      if (chunk.type !== 'chunk') continue;
      for (const [id, module] of Object.entries(chunk.modules)) {
        rows.push({ id: id.replace(ROOT, ''), size: module.renderedLength });
      }
    }
  },
});
await buildThree(ROOT, [analyzer()]);
const grouped = new Map();
for (const { id, size } of rows) {
  const key = id.includes('node_modules/three/')
    ? id.replace(/^.*node_modules\/three\//, 'three/')
    : id;
  grouped.set(key, (grouped.get(key) ?? 0) + size);
}
console.log('\n5 maiores módulos do three.js compartilhado (KB renderizados, antes de minificar)');
for (const [id, size] of [...grouped].sort((a, b) => b[1] - a[1]).slice(0, 5)) {
  console.log(`  ${kb(size)}  ${id}`);
}

if (threeInMain) {
  console.error('\nO script da página não pode levar o three.js (o 3D dos produtos é preguiçoso).');
  process.exit(1);
}
if (jsInitial / 1024 > BUDGET_KB) {
  console.error(`\nJS inicial acima do orçamento de ${BUDGET_KB} KB gzip.`);
  process.exit(1);
}
