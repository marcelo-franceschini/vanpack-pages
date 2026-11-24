import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'vite';

const VIRTUAL_ENTRY = '\0vanpack:shared-three-entry';

function collectThreeImports(dir, symbols = new Set()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectThreeImports(full, symbols);
    } else if (/\.(?:js|mjs|ts)$/.test(entry.name)) {
      const code = readFileSync(full, 'utf8');
      for (const match of code.matchAll(/import\s*\{([\s\S]*?)\}\s*from\s*['"]three['"]/g)) {
        for (const raw of match[1].split(',')) {
          const name = raw
            .trim()
            .split(/\s+as\s+/)[0]
            ?.trim();
          if (name) symbols.add(name);
        }
      }
    }
  }
  return [...symbols].sort();
}

async function bundleSharedThree(root) {
  const symbols = collectThreeImports(join(root, 'src'));
  const entryCode = `export { ${symbols.join(', ')} } from 'three';\n`;

  const result = await build({
    root,
    configFile: false,
    logLevel: 'silent',
    plugins: [
      {
        name: 'vanpack:shared-three-virtual',
        resolveId(id) {
          if (id === VIRTUAL_ENTRY) return id;
        },
        load(id) {
          if (id === VIRTUAL_ENTRY) return entryCode;
        },
      },
    ],
    build: {
      write: false,
      minify: true,
      rolldownOptions: {
        input: VIRTUAL_ENTRY,
        preserveEntrySignatures: 'strict',
        output: {
          format: 'es',
          entryFileNames: 'three.js',
        },
      },
    },
  });

  const outputs = Array.isArray(result) ? result : [result];
  const chunk = outputs.flatMap((out) => out.output ?? []).find((item) => item.type === 'chunk');
  if (!chunk) {
    throw new Error('Falha ao gerar o chunk compartilhado de Three.js.');
  }

  const hash = createHash('sha256').update(chunk.code).digest('base64url').slice(0, 8);
  return {
    code: chunk.code,
    fileName: `assets/three-${hash}.js`,
    importPath: `./three-${hash}.js`,
  };
}

/**
 * Deduplicates Three.js across the main bundle and Web Workers into a single shared ESM chunk
 * during production builds, while keeping native Vite resolution during `vite dev`.
 */
export function sharedThree(root) {
  let sharedPromise = null;
  let shared = null;

  const ensureShared = async () => {
    if (!sharedPromise) {
      sharedPromise = bundleSharedThree(root).then((bundle) => {
        shared = bundle;
        return bundle;
      });
    }
    return sharedPromise;
  };

  const resolveThreePlugin = {
    name: 'vanpack:shared-three-external',
    apply: 'build',
    enforce: 'pre',
    async buildStart() {
      await ensureShared();
    },
    resolveId(id) {
      if (id === 'three' && shared) {
        return { id: shared.importPath, external: true };
      }
    },
  };

  const emitAndPreloadPlugin = {
    name: 'vanpack:shared-three-emit',
    apply: 'build',
    generateBundle() {
      if (!shared) return;
      this.emitFile({
        type: 'asset',
        fileName: shared.fileName,
        source: shared.code,
      });
    },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!shared || !ctx?.filename?.endsWith('index.html')) return html;
        if (html.includes(shared.fileName)) return html;
        const preloadTag = `    <link rel="modulepreload" href="./${shared.fileName}" />`;
        return html.replace('</head>', `${preloadTag}\n  </head>`);
      },
    },
  };

  return {
    plugins: [resolveThreePlugin, emitAndPreloadPlugin],
    workerPlugins: () => [resolveThreePlugin],
  };
}
