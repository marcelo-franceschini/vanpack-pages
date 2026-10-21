// O three.js num arquivo só (assets/three-<hash>.js), compartilhado pelo worker da história, pelo worker
// dos produtos e pelo render de reserva (thread principal). Cada um desses é construído à parte pelo
// Vite, e cada construção levava a sua própria cópia do three.js (~130 KB gzip): o visitante que rolava
// até os produtos baixava a biblioteca duas vezes. Aqui o three.js é construído uma vez, só com o que o
// src/ importa (a lista sai dos próprios imports, não há nada para manter), e os três pontos de entrada
// passam a importá-lo.
//
// Nada em src/ muda, e a cena é a mesma: só de onde vem o código do three.js.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
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
 * @param {object[]} [plugins] plugins extras do Vite (a auditoria usa um para medir os módulos)
 * @returns {Promise<string>} o código do módulo
 */
export async function buildThree(root, plugins = []) {
  const entry = threeEntry(threeImports(jsSources(join(root, 'src'))));
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
