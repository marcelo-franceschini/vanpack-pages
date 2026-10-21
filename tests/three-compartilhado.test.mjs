// O three.js compartilhado (build/three-compartilhado.js): a lista de imports sai do src/ sem erro, só
// aceita o padrão `import { Nome } from 'three'`, e o dist/ tem um único arquivo do three.js, importado
// pelos dois workers e pelo render de reserva, que não carregam cópia própria, e a página não o pede.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, test } from 'node:test';
import { jsSources, threeEntry, threeImports } from '../build/three-compartilhado.js';

const ROOT = new URL('..', import.meta.url).pathname;
const source = (text) => [{ path: 'src/exemplo.js', text }];

describe('lista de imports do three.js', () => {
  test('junta os nomes de cada módulo, sem repetição, e ignora o "as"', () => {
    const imports = threeImports([
      ...source("import { Mesh, Group as G } from 'three';\nimport { a } from './a.js';"),
      {
        path: 'src/outro.js',
        text: "import {\n  Mesh,\n  Vector3,\n} from 'three';\nimport { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';",
      },
    ]);
    assert.deepEqual(imports.get('three'), ['Group', 'Mesh', 'Vector3']);
    assert.deepEqual(imports.get('three/addons/utils/BufferGeometryUtils.js'), ['mergeGeometries']);
    assert.equal(
      threeEntry(imports),
      "export { Group, Mesh, Vector3 } from 'three';\nexport { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';",
    );
  });

  test('import padrão, "* as" e só "import" do three.js reprovam com o arquivo na mensagem', () => {
    for (const line of [
      "import THREE from 'three';",
      "import * as THREE from 'three';",
      "import 'three';",
    ]) {
      assert.throws(() => threeImports(source(line)), /src\/exemplo\.js: import de 'three'/);
    }
  });

  test('o src/ de verdade só importa por nome, e os dois workers e a cena estão na lista', () => {
    const imports = threeImports(jsSources(`${ROOT}src`));
    const names = imports.get('three');
    for (const name of ['WebGLRenderer', 'Scene', 'PerspectiveCamera', 'MeshLambertMaterial']) {
      assert.ok(names.includes(name), `${name} fora da lista`);
    }
    assert.deepEqual(imports.get('three/addons/utils/BufferGeometryUtils.js'), ['mergeGeometries']);
  });
});

const built = existsSync(`${ROOT}dist/index.html`);
describe('three.js no dist/', { skip: !built && 'sem dist/: rode `npm run build`' }, () => {
  const assets = built ? readdirSync(`${ROOT}dist/assets`) : [];
  const read = (name) => readFileSync(`${ROOT}dist/assets/${name}`, 'utf8');
  const shared = assets.filter((name) => /^three-[\w-]{8}\.js$/.test(name));

  test('um único arquivo do three.js, e é ele que tem o renderer', () => {
    assert.equal(shared.length, 1, `arquivos do three.js: ${shared}`);
    assert.match(read(shared[0]), /WEBGL_lose_context/);
  });

  for (const prefix of ['worker', 'produtos-worker', 'controller']) {
    test(`${prefix}-*.js importa o arquivo compartilhado e não leva cópia do three.js`, () => {
      const [name] = assets.filter((file) => file.startsWith(`${prefix}-`));
      assert.ok(name, `sem ${prefix}-*.js`);
      const code = read(name);
      assert.ok(code.includes(`"./${shared[0]}"`), `${name} não importa ./${shared[0]}`);
      assert.doesNotMatch(code, /WEBGL_lose_context/, `${name} leva uma cópia do three.js`);
    });
  }

  test('o index.html não pede o three.js: quem o pede é o worker (um prefetch na página piora o LCP do Lighthouse)', () => {
    const html = readFileSync(`${ROOT}dist/index.html`, 'utf8');
    assert.doesNotMatch(html, /<link[^>]*three-/);
  });
});
