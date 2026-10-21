// O three.js num arquivo só (assets/three-<hash>.js), compartilhado pelo worker da história, pelo worker
// dos produtos e pelo render de reserva (thread principal). Cada um desses é construído à parte pelo
// Vite, e cada construção levava a sua própria cópia do three.js (~130 KB gzip): o visitante que rolava
// até os produtos baixava a biblioteca duas vezes. Aqui o three.js é construído uma vez, só com o que o
// src/ importa (a lista sai dos próprios imports, não há nada para manter), e os três pontos de entrada
// passam a importá-lo.
//
// O renderer do three.js importa os shaders de TODOS os materiais (Phong, Physical, Toon...), mesmo que a
// cena use só três. Aqui o ShaderChunk fica só com o que os materiais importados pelo src/ precisam (e o
// que o próprio renderer usa, como a sombra), e o three.js entra pelos módulos de three/src (que o
// bundler apara) em vez de build/three.module.js. Os textos dos shaders que ficam são os mesmos, então
// o desenho é o mesmo (paridade visual). Material fora da tabela, ou versão do three.js diferente da
// conferida, derruba o build com a explicação: nada falha em silêncio no navegador.
//
// Nada em src/ muda, e a cena é a mesma: só de onde vem o código do three.js.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'vite';

/** O endereço do three.js nos pontos de entrada; troca pelo arquivo de verdade ao gerar o código. */
const PLACEHOLDER = '__vanpack_three__';
const ENTRY = 'virtual:vanpack-three';

// import { A, B as C } from 'three'  ou  from 'three/addons/...'  (o ponto e vírgula fecha a instrução)
const THREE_IMPORT = /^import\s+([^;]*?)\s+from\s+['"](three(?:\/[^'"]+)?)['"]/gm;
const THREE_SIDE_EFFECT = /^import\s+['"](three(?:\/[^'"]+)?)['"]/gm; // import 'three' (sem nomes)

/**
 * Os nomes que o código importa do three.js, por módulo ('three' e 'three/addons/...'). Só aceita
 * `import { Nome } from 'three'`: import padrão, `* as THREE` ou só `import 'three'` trariam o pacote
 * inteiro (ou nada) e desfariam o tree-shaking.
 * @param {{ path: string, text: string }[]} sources
 * @returns {Map<string, string[]>} módulo → nomes (sem repetição, em ordem alfabética)
 */
export function threeImports(sources) {
  const byModule = new Map();
  for (const { path, text } of sources) {
    for (const [, module] of text.matchAll(THREE_SIDE_EFFECT)) {
      throw new Error(
        `${path}: import de '${module}' fora do padrão (sem nomes). Use import { Nome } from '${module}'.`,
      );
    }
    for (const [, clause, module] of text.matchAll(THREE_IMPORT)) {
      const named = /^\{([^}]*)\}$/.exec(clause.trim());
      if (!named) {
        throw new Error(
          `${path}: import de '${module}' fora do padrão (${clause.trim()}). Use import { Nome } from '${module}'.`,
        );
      }
      const names = byModule.get(module) ?? new Set();
      for (const part of named[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/)[0];
        if (name) names.add(name);
      }
      byModule.set(module, names);
    }
  }
  return new Map([...byModule].map(([module, names]) => [module, [...names].sort()]));
}

/** O código do ponto de entrada do three.js compartilhado: reexporta só os nomes usados. */
export function threeEntry(imports) {
  return [...imports]
    .map(([module, names]) => `export { ${names.join(', ')} } from '${module}';`)
    .join('\n');
}

/** A versão do three.js com a qual o aparo de shaders foi conferido (paridade visual e testes de 3D). */
export const SHADERS_CONFERIDOS_COM = '0.184.0';

/**
 * Os shaders (chaves do ShaderChunk) que cada material, ou objeto com material próprio, do three.js usa.
 * Mesh e Group não têm material por conta própria (Mesh sem material usa o MeshBasicMaterial).
 */
const SHADERS_POR_NOME = {
  Mesh: ['meshbasic_vert', 'meshbasic_frag'],
  MeshBasicMaterial: ['meshbasic_vert', 'meshbasic_frag'],
  MeshLambertMaterial: ['meshlambert_vert', 'meshlambert_frag'],
  ShadowMaterial: ['shadow_vert', 'shadow_frag'],
};
/** Sempre presentes: o renderer usa para a sombra, o fundo e as conversões de cor e de tom. */
const SHADERS_DO_RENDERER = [
  'depth_vert',
  'depth_frag',
  'distance_vert',
  'distance_frag',
  'background_vert',
  'background_frag',
  'backgroundCube_vert',
  'backgroundCube_frag',
  'tonemapping_pars_fragment',
  'colorspace_pars_fragment',
];
/** Classes que criam um material por conta própria (o nome não termina em "Material"). */
const COM_MATERIAL_PROPRIO = new Set(['Sprite', 'Points', 'Line', 'LineSegments', 'LineLoop']);

/**
 * Os shaders de que os nomes importados do three.js precisam.
 * @param {string[]} names os nomes que o src/ importa de 'three'
 * @returns {string[]} chaves do ShaderChunk (sem os includes, que `chunksAlcancaveis` acrescenta)
 */
export function shadersDosNomes(names) {
  const roots = new Set(SHADERS_DO_RENDERER);
  for (const name of names) {
    if (name in SHADERS_POR_NOME) for (const key of SHADERS_POR_NOME[name]) roots.add(key);
    else if (/Material$/.test(name) || COM_MATERIAL_PROPRIO.has(name)) {
      throw new Error(
        `build/three-compartilhado.js: o src/ importa ${name}, que usa shaders que o aparo do ShaderChunk ` +
          'não conhece. Acrescente os shaders dele em SHADERS_POR_NOME (as chaves de ' +
          'node_modules/three/src/renderers/shaders/ShaderChunk.js) e confira com a paridade visual.',
      );
    }
  }
  return [...roots];
}

/**
 * Raízes mais tudo o que os shaders delas incluem (`#include <nome>`), de forma recursiva.
 * @param {Record<string, unknown>} chunks o ShaderChunk do three.js
 * @param {string[]} roots
 */
export function chunksAlcancaveis(chunks, roots) {
  const found = new Set(roots);
  const queue = [...roots];
  while (queue.length) {
    const text = chunks[/** @type {string} */ (queue.pop())];
    if (typeof text !== 'string') continue;
    for (const [, name] of text.matchAll(/#include <(\w+)>/g)) {
      if (!found.has(name)) {
        found.add(name);
        queue.push(name);
      }
    }
  }
  return found;
}

/** O texto do ShaderChunk.js só com os chunks que ficam (as importações dos demais somem junto). */
export function shaderChunkEnxuto(source, keep) {
  const libs = new Set([...keep].map((key) => key.replace(/_(vert|frag)$/, '')));
  const out = [];
  for (const line of source.split('\n')) {
    let m;
    if ((m = /^import (\w+) from '\.\/ShaderChunk\//.exec(line))) {
      if (keep.has(m[1])) out.push(line);
    } else if ((m = /^import \* as (\w+) from '\.\/ShaderLib\//.exec(line))) {
      if (libs.has(m[1])) out.push(line);
    } else if ((m = /^\t(\w+): \w+(?:\.(?:vertex|fragment))?,?$/.exec(line))) {
      if (keep.has(m[1])) out.push(line.replace(/,?$/, ','));
    } else out.push(line);
  }
  return out.join('\n').replace(/,\n\};/, '\n};');
}

/**
 * Plugins do Vite que trocam build/three.module.js pelos módulos de three/src e apagam os shaders de que a
 * cena não precisa.
 * @param {string} root pasta do projeto (o three.js fica em node_modules/three)
 * @param {string[]} names os nomes que o src/ importa de 'three'
 * @returns {Promise<import('vite').Plugin[]>}
 */
export async function aparoDeShaders(root, names) {
  const dir = join(root, 'node_modules', 'three');
  const { version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
  if (version !== SHADERS_CONFERIDOS_COM) {
    throw new Error(
      `build/three-compartilhado.js: o aparo de shaders foi conferido com o three.js ${SHADERS_CONFERIDOS_COM} ` +
        `e o projeto usa ${version}. Troque a versão só como decisão do dono: confira a lista de shaders ` +
        '(tests/three-compartilhado.test.mjs), rode npm run audit:paridade e atualize SHADERS_CONFERIDOS_COM.',
    );
  }
  const chunks = (
    await import(pathToFileURL(join(dir, 'src', 'renderers', 'shaders', 'ShaderChunk.js')).href)
  ).ShaderChunk;
  const keep = chunksAlcancaveis(chunks, shadersDosNomes(names));
  const missing = [...keep].filter((key) => typeof chunks[key] !== 'string');
  if (missing.length) {
    throw new Error(`build/three-compartilhado.js: shaders que o three.js não tem: ${missing}`);
  }
  return [
    {
      name: 'vanpack:three-src',
      enforce: 'pre',
      resolveId: (id) => (id === 'three' ? join(dir, 'src', 'Three.js') : null),
    },
    {
      name: 'vanpack:three-shaders',
      enforce: 'pre',
      load: (id) =>
        id.endsWith('/renderers/shaders/ShaderChunk.js')
          ? shaderChunkEnxuto(readFileSync(id, 'utf8'), keep)
          : null,
    },
  ];
}

/** Todos os .js de uma pasta, com o caminho e o texto. */
export function jsSources(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.js'))
    .map((entry) => {
      const path = join(entry.parentPath, entry.name);
      return { path, text: readFileSync(path, 'utf8') };
    });
}

/**
 * Constrói o three.js compartilhado: um módulo só, com os nomes que o src/ importa, minificado.
 * @param {string} root pasta do projeto (o src/ fica dentro dela)
 * @param {import('vite').Plugin[]} [plugins] plugins extras do Vite (a auditoria usa um para medir os módulos)
 * @returns {Promise<string>} o código do módulo
 */
export async function buildThree(root, plugins = []) {
  const imports = threeImports(jsSources(join(root, 'src')));
  const entry = threeEntry(imports);
  const slim = await aparoDeShaders(root, imports.get('three') ?? []);
  /** @type {any} */
  const output = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'vanpack:three-entrada',
        resolveId: (id) => (id === ENTRY ? `\0${ENTRY}` : null),
        load: (id) => (id === `\0${ENTRY}` ? entry : null),
      },
      ...slim,
      ...plugins,
    ],
    build: {
      write: false,
      modulePreload: false,
      rolldownOptions: { input: ENTRY, preserveEntrySignatures: 'strict' },
    },
  });
  const file = [output].flat()[0].output.find((item) => item.type === 'chunk' && item.isEntry);
  return file.code;
}

/** Marca o three.js como externo (os pontos de entrada o importam do arquivo compartilhado). */
function externalThree(shared) {
  return {
    name: 'vanpack:three-externo',
    apply: 'build',
    enforce: 'pre',
    resolveId(id) {
      if (id === 'three' || id.startsWith('three/')) return { id: PLACEHOLDER, external: true };
      return null;
    },
    renderChunk(code) {
      if (!code.includes(PLACEHOLDER)) return null;
      // o arquivo fica ao lado de quem o importa (assets/)
      return code.replaceAll(PLACEHOLDER, `./${basename(shared.fileName)}`);
    },
  };
}

/**
 * Plugins do Vite (só no build; o servidor de desenvolvimento segue com o three.js do pacote).
 * `plugins` vão na lista principal e `workerPlugins` em `worker.plugins`.
 */
export function sharedThree() {
  const shared = { fileName: '', code: '' };
  let root = '';
  const main = {
    name: 'vanpack:three-compartilhado',
    apply: 'build',
    configResolved(config) {
      root = config.root; // a pasta do projeto: o src/ fica dentro dela
    },
    async buildStart() {
      shared.code = await buildThree(root);
      const hash = createHash('sha256').update(shared.code).digest('hex').slice(0, 8);
      shared.fileName = `assets/three-${hash}.js`;
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: shared.fileName, source: shared.code });
    },
  };
  return {
    plugins: [main, externalThree(shared)],
    workerPlugins: () => [externalThree(shared)],
  };
}
