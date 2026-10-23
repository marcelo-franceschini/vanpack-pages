// Paridade visual: compara, pixel a pixel, o site de agora com o de uma base (padrão: origin/master).
// A base é extraída com `git archive` para uma pasta temporária (a árvore de trabalho não é tocada) e
// construída com o próprio `.env` e a própria configuração dela. Os dois builds são capturados nos 6
// tamanhos de tela do projeto, com movimento reduzido e ?tour=0 (a cena salta direto ao quadro pedido):
// os 5 quadros da história (p = 0, .25, .5, .75, 1), o topo de cada seção, o 3D de cada produto (um por vez),
// a política de privacidade e a altura total da página, mais a estrutura do HTML publicado (index.html e a política de privacidade, ver
// canonicalHtml), robots.txt e sitemap.xml. Byte igual passa direto; se os bytes diferem, conta-se por pixel: a tolerância
// é de 2/255 por canal (ruído de rasterização nas bordas suavizadas de ícones e sublinhados, medido em
// 1/255 entre duas séries da mesma base) e nenhuma mudança de tamanho. Mover algo em 1 px ou mudar um texto
// passa de 2/255 nas bordas. Uma troca de cor de 1 ou 2/255 não passa, mas atinge muitos pixels: por isso
// uma diferença abaixo da tolerância que atinge 0,1% da imagem ou mais também precisa ser confirmada
// numa 2ª captura (medido: trocar #14513a por #14513b dava 1/255 em um milhão de pixels e passava). Isso
// vale só para as capturas de página: nos quadros 3D (`-pNNN.png`) o runner do CI erra 1/255 em ~22 mil
// pixels de forma estável, e ali a tolerância de 2/255 continua sendo o critério. O renderizador
// do runner do CI às vezes erra um ou dois pixels de borda (2 pixels a 14/255 num sublinhado, em pontos
// diferentes a cada execução): por isso uma diferença acima da tolerância só reprova se se repetir nos
// mesmos pixels numa segunda captura dos dois lados; mudança real é determinística e se repete, o erro
// do renderizador não. Quando reprova, as duas imagens vão para dist-paridade/.
//
// Uso: node scripts/audit/paridade.mjs [--base=<ref do git>] [--telas=1440x900,390x844] [--html=aviso]
// (sai com 1 se algo mudou). --html=aviso: diferença só na estrutura do HTML (tags, atributos, texto) é
// mostrada, mas não reprova (correções de acessibilidade e de HTML válido que não mudam o desenho);
// os pixels continuam valendo.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, launch, openPage, scrollToProgress, startServer } from '../lib.mjs';
import { TOLERANCE, ehRuido, repetiu } from './paridade-criterio.mjs';

const base = process.argv.find((arg) => arg.startsWith('--base='))?.slice('--base='.length);
const BASE_REF = base || 'origin/master';
const only = process.argv.find((arg) => arg.startsWith('--telas='))?.slice('--telas='.length);
const htmlWarns = process.argv.includes('--html=aviso');
const OUT = `${ROOT}dist-paridade/`;
const VITE = `${ROOT}node_modules/vite/bin/vite.js`;

const MOBILE = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };
const SCREENS = [
  { name: '1440x900', viewport: { width: 1440, height: 900 } },
  { name: '1366x768', viewport: { width: 1366, height: 768 } },
  { name: '924x540', viewport: { width: 924, height: 540 } },
  { name: '720x450', viewport: { width: 720, height: 450 } },
  { name: '390x844', viewport: { width: 390, height: 844 }, ...MOBILE },
  { name: '844x390', viewport: { width: 844, height: 390 }, ...MOBILE },
];
const screens = SCREENS.filter(({ name }) => !only || only.split(',').includes(name));
const CENTERS = [0, 0.25, 0.5, 0.75, 1];
const SECTIONS = ['produtos', 'diferenciais', 'clientes', 'orcamento'];

/** `vite build` com a pasta `cwd` como raiz (o vite.config.js lê o .env do diretório de trabalho). */
function buildIn(cwd, outDir) {
  try {
    execFileSync(process.execPath, [VITE, 'build', '--outDir', outDir, '--emptyOutDir'], {
      cwd,
      stdio: 'pipe',
    });
  } catch (error) {
    process.stderr.write(`${error.stdout ?? ''}${error.stderr ?? ''}`);
    throw new Error(`o build em ${cwd} falhou`, { cause: error });
  }
}

/** Extrai o commit de `ref` numa pasta temporária (com o node_modules daqui) e constrói. */
function buildBase(ref) {
  const dir = mkdtempSync(join(tmpdir(), 'paridade-base-'));
  const files = execFileSync('git', ['archive', ref], { cwd: ROOT, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: files });
  symlinkSync(`${ROOT}node_modules`, `${dir}/node_modules`, 'dir');
  buildIn(dir, 'dist');
  return { dir, dist: `${dir}/dist` };
}

/** Captura um build: nome do arquivo → bytes (PNG, ou a altura da página em texto). */
async function capture(browser, url, screen) {
  const { name, ...device } = screen;
  const shots = new Map();
  const { page, context, problems } = await openPage(browser, `${url}?tour=0`, {
    reducedMotion: 'reduce',
    ...device,
  });
  for (const p of CENTERS) {
    await scrollToProgress(page, p);
    await page.waitForTimeout(2500); // o worker desenha o quadro pedido e assenta
    shots.set(`${name}-p${String(p * 100).padStart(3, '0')}.png`, await page.screenshot());
  }
  for (const id of SECTIONS) {
    const found = await page.evaluate((id) => {
      const section = document.getElementById(id);
      section?.scrollIntoView({ block: 'start' });
      return Boolean(section);
    }, id);
    if (!found) continue;
    if (id === 'produtos') {
      // o 3D de cada produto (ou a ilustração) carrega quando a seção chega perto
      await page.waitForFunction(
        () =>
          [...document.querySelectorAll('.model-3d')]
            .filter((area) => area.getBoundingClientRect().top < innerHeight)
            .every((area) => area.classList.contains('pronto')),
        null,
        { timeout: 60_000 },
      );
    }
    await page.waitForTimeout(1200); // barra do WhatsApp e cabeçalho terminam de entrar ou sair
    shots.set(`${name}-secao-${id}.png`, await page.screenshot());
  }
  // O 3D de cada produto, um por vez (a imagem da seção mostra só os cartões que cabem na tela: em coluna
  // única, só o 1º, e em 844x390 nenhum). Em movimento reduzido o modelo fica numa pose fixa.
  const modelos = await page.$$eval('.model-3d[data-modelo]', (areas) =>
    areas.map((area) => /** @type {HTMLElement} */ (area).dataset.modelo),
  );
  for (const modelo of modelos) {
    const area = page.locator(`.model-3d[data-modelo="${modelo}"]`);
    await area.scrollIntoViewIfNeeded();
    await page.waitForFunction(
      (modelo) =>
        document.querySelector(`.model-3d[data-modelo="${modelo}"]`)?.classList.contains('pronto'),
      modelo,
      { timeout: 60_000 },
    );
    await page.waitForTimeout(1200); // o worker devolve o quadro do cartão que acabou de chegar perto
    shots.set(`${name}-produto-${modelo}.png`, await area.screenshot());
  }
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  shots.set(`${name}-altura.txt`, Buffer.from(`${height}\n`));
  await context.close();

  // as outras páginas (política de privacidade e 404), inteiras
  const extra = [];
  for (const [label, file] of [
    ['privacidade', 'politica-de-privacidade.html'],
    ['404', '404.html'],
  ]) {
    const other = await openPage(
      browser,
      url,
      { reducedMotion: 'reduce', ...device },
      { waitFor: 'none' },
    );
    await other.page.goto(`${url}${file}`);
    await other.page.waitForTimeout(500);
    shots.set(`${name}-${label}.png`, await other.page.screenshot({ fullPage: true }));
    extra.push(...other.problems);
    await other.context.close();
  }
  return { shots, problems: [...problems, ...extra] };
}

/**
 * Pixels que mudaram, quantos passam da tolerância (`over`, e a posição dos primeiros em `at`) e a maior
 * diferença de canal, contados no navegador.
 */
const pixelDiff = (page, a, b) =>
  page.evaluate(
    async ([left, right, tolerance]) => {
      const load = async (base64) => {
        const image = new Image();
        image.src = `data:image/png;base64,${base64}`;
        await image.decode();
        const canvas = new OffscreenCanvas(image.width, image.height);
        const context = canvas.getContext('2d');
        context.drawImage(image, 0, 0);
        return context.getImageData(0, 0, image.width, image.height);
      };
      const [p, q] = await Promise.all([load(left), load(right)]);
      if (p.width !== q.width || p.height !== q.height) {
        return { size: `${p.width}x${p.height} contra ${q.width}x${q.height}` };
      }
      let pixels = 0;
      let over = 0;
      let max = 0;
      const at = [];
      const any = [];
      for (let i = 0; i < p.data.length; i += 4) {
        const delta = Math.max(
          Math.abs(p.data[i] - q.data[i]),
          Math.abs(p.data[i + 1] - q.data[i + 1]),
          Math.abs(p.data[i + 2] - q.data[i + 2]),
        );
        if (delta) {
          pixels += 1;
          if (any.length < 5000) any.push(i / 4);
        }
        if (delta > tolerance) {
          over += 1;
          if (at.length < 5000) at.push(i / 4);
        }
        max = Math.max(max, delta);
      }
      return { pixels, over, max, at, any, total: p.width * p.height };
    },
    [a.toString('base64'), b.toString('base64'), TOLERANCE],
  );

/**
 * A estrutura do HTML publicado como uma lista de linhas, para comparar dois builds sem se perder em
 * detalhes que não aparecem: o HTML é lido por um DOMParser (nada roda), os atributos saem em ordem
 * alfabética, o espaço em branco vira um só e some nas pontas dos elementos, <div> e <span> sem
 * atributo são ignorados, os nomes de arquivo com hash perdem o hash e o conteúdo do <style> e da meta da CSP (que deriva dele) não entra. O texto, as
 * tags e os atributos entram todos: trocar uma palavra, uma classe ou um link muda a lista.
 */
const canonicalHtml = (page, source) =>
  page.evaluate((source) => {
    const doc = new DOMParser().parseFromString(source, 'text/html');
    const lines = [];
    const attributes = (el) =>
      [...el.attributes]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(({ name, value }) => {
          let text = value
            .replace(/\s+/g, ' ')
            .trim()
            .replace(/-[\w-]{8}\.(js|css)\b/g, '-HASH.$1');
          if (el.localName === 'meta' && el.hasAttribute('http-equiv') && name === 'content') {
            text = '(CSP)';
          }
          return `${name}="${text}"`;
        })
        .join(' ');
    // texto vizinho (separado só por <span> sem atributo) vira um texto só
    let pending = '';
    const flush = () => {
      const text = pending.replace(/\s+/g, ' ').trim();
      pending = '';
      if (text) lines.push(JSON.stringify(text));
    };
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        pending += node.data;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const tag = node.localName;
      const attrs = attributes(node);
      // <div> e <span> sem atributo não têm efeito sozinhos: eram só o gatilho do data-need de um trecho
      if (!attrs && (tag === 'div' || tag === 'span')) {
        node.childNodes.forEach(walk);
        return;
      }
      flush();
      lines.push(`<${tag}${attrs ? ` ${attrs}` : ''}>`);
      if (tag === 'style') lines.push('(css)');
      else if (tag === 'script') lines.push(node.textContent.replace(/\s+/g, ' ').trim());
      else node.childNodes.forEach(walk);
      flush();
      lines.push(`</${tag}>`);
    };
    walk(doc.documentElement);
    flush();
    return lines;
  }, source);

const PAGES = ['index.html', 'politica-de-privacidade.html', '404.html'];
const FILES = ['robots.txt', 'sitemap.xml'];

/** Compara a estrutura das páginas e os arquivos de texto; devolve as diferenças, uma por linha. */
async function compareHtml(page, nowUrl, beforeUrl) {
  const changes = [];
  const get = async (url, file) => (await fetch(`${url}${file}`)).text();
  for (const file of PAGES) {
    const a = await canonicalHtml(page, await get(nowUrl, file));
    const b = await canonicalHtml(page, await get(beforeUrl, file));
    const at = a.findIndex((line, i) => line !== b[i]);
    if (at === -1 && a.length === b.length) continue;
    const from = Math.max(0, at - 2);
    changes.push(
      `${file}: primeira diferença na linha ${at + 1} de ${Math.max(a.length, b.length)}\n` +
        `    base : ${b.slice(from, at + 3).join(' ')}\n    atual: ${a.slice(from, at + 3).join(' ')}`,
    );
  }
  for (const file of FILES) {
    const [a, b] = [await get(nowUrl, file), await get(beforeUrl, file)];
    if (a !== b) changes.push(`${file}: o conteúdo mudou`);
  }
  return changes;
}

console.log(`Paridade visual: site de agora contra ${BASE_REF}`);
mkdirSync(OUT, { recursive: true });
rmSync(`${OUT}diferencas`, { recursive: true, force: true });
buildIn(ROOT, `${OUT}atual`);
const baseBuild = buildBase(BASE_REF);
const [atual, anterior] = await Promise.all([
  startServer(`${OUT}atual`),
  startServer(baseBuild.dist),
]);
const browser = await launch();
const diffPage = await browser.newPage();
let different = 0;
let noisy = 0;
let compared = 0;
for (const screen of screens) {
  const now = await capture(browser, atual.url, screen);
  const before = await capture(browser, anterior.url, screen);
  const changed = [];
  const noise = [];
  /** A 2ª captura da tela (só se algo passar da tolerância), para confirmar que a diferença se repete. */
  let second;
  for (const name of new Set([...now.shots.keys(), ...before.shots.keys()])) {
    const a = now.shots.get(name);
    const b = before.shots.get(name);
    compared += 1;
    if (a && b && a.equals(b)) continue;
    let detail = 'só existe de um lado';
    if (a && b && name.endsWith('.png')) {
      const diff = await pixelDiff(diffPage, a, b);
      if (ehRuido(diff, name)) {
        noise.push(`${name} (${diff.pixels} pixels, no máximo ${diff.max}/255)`);
        noisy += 1;
        continue;
      }
      if (!diff.size) {
        second ??= {
          now: await capture(browser, atual.url, screen),
          before: await capture(browser, anterior.url, screen),
        };
        const again =
          second.now.shots.get(name) && second.before.shots.get(name)
            ? await pixelDiff(diffPage, second.now.shots.get(name), second.before.shots.get(name))
            : { size: 'sumiu na 2ª captura' };
        const repeated = repetiu(diff, again);
        if (!repeated) {
          noise.push(
            `${name} (${diff.over} pixels acima de ${TOLERANCE}/255, máximo ${diff.max}/255, não se repetiu na 2ª captura)`,
          );
          noisy += 1;
          continue;
        }
      }
      detail =
        diff.size ??
        (diff.over
          ? `${diff.over} pixels acima de ${TOLERANCE}/255, máximo ${diff.max}/255`
          : `${diff.pixels} pixels diferem em até ${diff.max}/255 e se repetiram na 2ª captura: mudança ampla de baixa amplitude`);
    } else if (a && b) {
      detail = `${b.toString().trim()} contra ${a.toString().trim()}`;
    }
    different += 1;
    changed.push(`${name} (${detail})`);
    mkdirSync(`${OUT}diferencas`, { recursive: true });
    if (a && name.endsWith('.png'))
      writeFileSync(`${OUT}diferencas/${name.replace('.png', '')}-atual.png`, a);
    if (b && name.endsWith('.png'))
      writeFileSync(`${OUT}diferencas/${name.replace('.png', '')}-base.png`, b);
  }
  const issues = [...now.problems, ...before.problems];
  console.log(
    `${screen.name.padEnd(9)} ${changed.length ? `${changed.length} mudou` : 'preservado'}`,
  );
  for (const line of changed) console.log(`  MUDOU ${line}`);
  for (const line of noise) console.log(`  ruído  ${line}`);
  for (const issue of issues) console.log(`  aviso da página: ${issue}`);
}
const markup = await compareHtml(diffPage, atual.url, anterior.url);
compared += PAGES.length + FILES.length;
if (!htmlWarns) different += markup.length;
console.log(
  `HTML      ${markup.length ? `${markup.length} mudou${htmlWarns ? ' (aviso)' : ''}` : 'preservado'}`,
);
for (const line of markup) console.log(`  ${htmlWarns ? 'AVISO' : 'MUDOU'} ${line}`);
await browser.close();
await atual.close();
await anterior.close();
rmSync(baseBuild.dir, { recursive: true, force: true });

if (different) {
  console.error(
    `\n${different} de ${compared} itens mudaram (imagens em dist-paridade/diferencas/). Se a mudança é intencional, revise e aprove.`,
  );
  process.exit(1);
}
console.log(
  `\nParidade visual preservada: ${compared} itens em ${screens.length} tamanho(s) (${noisy} com ruído de até ${TOLERANCE}/255).`,
);
