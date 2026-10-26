// Orçamento de bytes do dist/ (o que o visitante baixa). Tetos em KB, medidos como o GitHub Pages
// entrega: gzip (nível 9) nos textos e o tamanho do arquivo na fonte e nas imagens (já comprimidas).
// Os tetos partem da linha de base de 20/10/2026 com uma folga curta (editar um texto da página
// mexe em alguns bytes do HTML) e só DESCEM: cada ganho de performance baixa o teto correspondente.
// Subir um teto, ou dar teto a um arquivo novo maior, é decisão do dono e vai no PR com a medição.
// Histórico: com o three.js num arquivo só (em vez de uma cópia em cada worker) a visita completa
// caiu de 321,3 para 199,5 KB, e a abertura subiu 3,9 KB (146,9 contra 142,9 KB de JS inicial).
// O gzip varia um pouco com a versão do Node (o zlib muda): no mesmo dist/, o Node 24 (o do CI, .nvmrc) dá
// three.js 119,54 KB e o Node 26 dá 119,36, e o JS inicial 139,10 contra 138,94. Os tetos valem o maior dos
// dois mais 0,1 KB, para o teste não depender de qual Node roda.
// Rodada 2: o three.js sem os shaders dos materiais que a cena não usa (build/three-compartilhado.js)
// baixou o JS inicial de 146,9 para 138,9 KB, a carga inicial de 186,4 para 178,4 e a visita completa de
// 196,0 para 188,0; os tetos desceram junto, para o maior valor medido mais 0,1 KB (HTML 0,6 KB: o go-live troca
// textos). Política, 404 e og.jpg ficaram como estavam: o texto da política vem do jurídico e a imagem de
// compartilhamento será refeita no go-live (npm run og), e nenhum deles sobe.
// Rodada 3: o three.js sem PMREMGenerator e WebXRManager (build/three-compartilhado.js) baixou o three.js de
// 119,54 para 111,71 KB e o JS inicial de 139,10 para 131,27. Os tetos agora partem do pior conteúdo que os
// schemas aceitam (dist-limite/, que tests/limites.test.mjs confere com este mesmo teste), medido no Node 24
// (o maior dos dois Node), mais 0,1 a 0,2 KB: three.js 111,71, JS inicial 131,29, carga 171,12 e visita 180,72
// KB. Descem 7,8 KB cada um (three.js, JS inicial, carga) e 7,4 KB (visita); nenhum sobe.
// Rodada 4 (ajustes estéticos): sem a faixa de confiança, o selo, a nota, o slogan e os controles do carrossel, o HTML
// e o script da página encolheram; a marca "SUA MARCA" nas caixas 3D (em vez do logo da Vanpack, que vinha junto
// no worker dos produtos) tirou 1,0 KB do produtos-worker e a caixa normal custou 0,2. Os tetos descem de novo ao
// pior caso (dist-limite, Node 24) mais 0,1 a 0,2 KB: script da página 7,7, produtos-worker 6,5, HTML 10,6,
// JS inicial 130,8, carga 170,2 e visita 179,0 KB. O único que sobe é o dos SVGs (13,5 para 13,7): a ilustração
// da caixa normal, o fallback do 3D novo, pesa 0,33 KB.
// O teto de JS inicial de npm run audit:bundle foi de 165 para 140, depois 132 e agora 131 KB (o do teste acima é 130,8).
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, test } from 'node:test';
import { gzipSync } from 'node:zlib';

const ROOT = new URL('..', import.meta.url).pathname;
// TESTE_DIST aponta outra pasta de build (tests/limites.test.mjs confere o conteúdo no máximo dos schemas).
const DIST = `${ROOT}${process.env.TESTE_DIST ?? 'dist'}/`;
const KB = 1024;

// Cada arquivo de assets/ tem o prefixo do nome sem o hash (index-BsPmJb_d.js → index).
const JS = {
  index: 7.7, // o script da página (sem o three.js)
  worker: 11.6, // a cena da história, no Web Worker (o three.js vem do arquivo three)
  three: 111.9, // o three.js, num arquivo só para os dois workers e o render de reserva
  controller: 11.6, // o mesmo render da história, só se o worker falhar (thread principal)
  'produtos-worker': 7.5, // a vitrine dos produtos, baixada perto da seção (7,3 com as dobras de papelão e o papel granulado, aprovado pelo dono em 2026-10-26)
  montar: 1.7, // montagem do 3D dos produtos
  'web-vitals': 3.1,
  wizard: 2.2, // assistente do experimento (só na variante B)
};
const FILES = {
  'index.html': 10.6, // o conteúdo no limite dos schemas (dist-limite) mais 0,2 KB
  'politica-de-privacidade.html': 3.6,
  '404.html': 2,
  'fonts/archivo-latin.woff2': 27.8,
  'og.jpg': 65,
  'icon-512.png': 7.4,
  'apple-touch-icon.png': 3.4,
};
const SVG_TOTAL = 13.7; // todos os SVGs de brand/ e produtos/ (13,5 + o SVG da caixa normal, 0,3 KB)
const TOTAL = {
  jsInicial: 130.8, // script da página + worker da história + three.js
  carga: 170.2, // HTML + JS inicial + fonte + os 2 logos do topo e da cena
  visita: 181.0, // a carga + o 3D dos produtos + o logo do CTA final
};

const built = existsSync(`${DIST}index.html`);
const size = (file) => statSync(`${DIST}${file}`).size;
const gzip = (file) => gzipSync(readFileSync(`${DIST}${file}`), { level: 9 }).length;
const kb = (bytes) => (bytes / KB).toFixed(1).replace('.', ',');
const prefix = (name) => /^(.+?)-[\w-]{8}\.js$/.exec(name)?.[1];
const over = (what, bytes, limit) =>
  `${what}: ${kb(bytes)} KB passou do teto de ${limit} KB. O teto só desce: reduza o arquivo ` +
  '(ou, com a aprovação do dono, suba o teto neste teste junto com a medição).';

describe('orçamento de bytes', { skip: !built && 'sem dist/: rode `npm run build`' }, () => {
  const assets = built ? readdirSync(`${DIST}assets`) : [];
  const bytes = {};
  for (const name of assets) bytes[prefix(name)] = gzip(`assets/${name}`);

  test('cada arquivo de JS tem teto e está abaixo dele', () => {
    for (const name of assets) {
      assert.ok(prefix(name), `assets/${name}: nome fora do padrão <nome>-<hash>.js`);
      assert.ok(
        JS[prefix(name)],
        `assets/${name} é um arquivo novo sem teto: dê um teto a "${prefix(name)}" em tests/orcamento.test.mjs`,
      );
      assert.ok(
        bytes[prefix(name)] <= JS[prefix(name)] * KB,
        over(name, bytes[prefix(name)], JS[prefix(name)]),
      );
    }
  });

  test('HTML, fonte e imagens abaixo dos tetos', () => {
    for (const [file, limit] of Object.entries(FILES)) {
      const actual = /\.(html|svg)$/.test(file) ? gzip(file) : size(file);
      assert.ok(actual <= limit * KB, over(file, actual, limit));
    }
  });

  test('SVGs (marca e produtos) somam até o teto', () => {
    const files = ['brand', 'produtos'].flatMap((dir) =>
      readdirSync(`${DIST}${dir}`)
        .filter((name) => name.endsWith('.svg'))
        .map((name) => `${dir}/${name}`),
    );
    const total = files.reduce((sum, file) => sum + gzip(file), 0);
    assert.ok(total <= SVG_TOTAL * KB, over('SVGs', total, SVG_TOTAL));
  });

  test('o que o visitante baixa: JS inicial, carga inicial e visita completa', () => {
    const jsInicial = bytes.index + bytes.worker + bytes.three;
    const carga =
      gzip('index.html') +
      jsInicial +
      size('fonts/archivo-latin.woff2') +
      gzip('brand/vanpack-horizontal.svg') +
      gzip('brand/vanpack-simbolo.svg');
    const visita =
      carga +
      bytes.montar +
      bytes['produtos-worker'] +
      gzip('brand/vanpack-horizontal-negativo.svg');
    assert.ok(jsInicial <= TOTAL.jsInicial * KB, over('JS inicial', jsInicial, TOTAL.jsInicial));
    assert.ok(carga <= TOTAL.carga * KB, over('carga inicial', carga, TOTAL.carga));
    assert.ok(visita <= TOTAL.visita * KB, over('visita completa', visita, TOTAL.visita));
  });

  test('o three.js não entra no script da página', () => {
    const page = assets.find((name) => prefix(name) === 'index');
    const code = readFileSync(`${DIST}assets/${page}`, 'utf8');
    assert.ok(!/WebGLRenderer|WEBGL_lose_context/.test(code), 'three.js no script da página');
  });
});
