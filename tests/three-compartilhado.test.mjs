// O three.js compartilhado (build/three-compartilhado.js): a lista de imports sai do src/ sem erro, só
// aceita o padrão `import { Nome } from 'three'`, e o dist/ tem um único arquivo do three.js, importado
// pelos dois workers e pelo render de reserva, que não carregam cópia própria, e a página não o pede.
import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import {
  SHADERS_CONFERIDOS_COM,
  aparoDeShaders,
  chunksAlcancaveis,
  jsSources,
  shaderChunkEnxuto,
  shadersDosNomes,
  threeEntry,
  threeImports,
} from '../build/three-compartilhado.js';

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

describe('aparo dos shaders do three.js', () => {
  test('os nomes que o src/ importa pedem os shaders de Basic, Lambert e sombra, e nenhum outro material', () => {
    const names = threeImports(jsSources(`${ROOT}src`)).get('three');
    const roots = shadersDosNomes(names);
    for (const key of ['meshbasic_frag', 'meshlambert_vert', 'shadow_frag', 'depth_frag']) {
      assert.ok(roots.includes(key), `${key} fora das raízes`);
    }
    assert.ok(
      !roots.some((key) => /phong|physical|toon|matcap|points|sprite/.test(key)),
      roots.join(),
    );
  });

  test('material (ou classe com material próprio) que o aparo não conhece derruba o build, com o nome', () => {
    for (const name of [
      'MeshPhongMaterial',
      'MeshStandardMaterial',
      'PointsMaterial',
      'Sprite',
      'Points',
    ]) {
      assert.throws(
        () => shadersDosNomes(['Mesh', name]),
        new RegExp(`importa ${name}\\b.*SHADERS_POR_NOME`),
      );
    }
    // o que não usa shader de material passa
    assert.doesNotThrow(() => shadersDosNomes(['Group', 'Vector3', 'BoxGeometry']));
  });

  test('chunksAlcancaveis segue os #include de forma recursiva e ignora o resto', () => {
    const chunks = {
      a: 'x\n#include <b>',
      b: '#include <c>\n#include <b>',
      c: 'y',
      d: '#include <a>',
    };
    assert.deepEqual([...chunksAlcancaveis(chunks, ['a'])].sort(), ['a', 'b', 'c']);
  });

  test('shaderChunkEnxuto tira os imports e as entradas que não ficam, sem deixar vírgula sobrando', () => {
    const source = [
      "import alfa from './ShaderChunk/alfa.glsl.js';",
      "import beta from './ShaderChunk/beta.glsl.js';",
      "import * as meshbasic from './ShaderLib/meshbasic.glsl.js';",
      "import * as meshphong from './ShaderLib/meshphong.glsl.js';",
      '',
      'export const ShaderChunk = {',
      '\talfa: alfa,',
      '\tbeta: beta,',
      '\tmeshbasic_vert: meshbasic.vertex,',
      '\tmeshphong_vert: meshphong.vertex',
      '};',
    ].join('\n');
    const out = shaderChunkEnxuto(source, new Set(['alfa', 'meshbasic_vert']));
    assert.equal(
      out,
      [
        "import alfa from './ShaderChunk/alfa.glsl.js';",
        "import * as meshbasic from './ShaderLib/meshbasic.glsl.js';",
        '',
        'export const ShaderChunk = {',
        '\talfa: alfa,',
        '\tmeshbasic_vert: meshbasic.vertex',
        '};',
      ].join('\n'),
    );
  });

  test('o projeto usa a versão do three.js com a qual o aparo foi conferido; outra versão derruba o build', async () => {
    const real = JSON.parse(readFileSync(`${ROOT}node_modules/three/package.json`, 'utf8')).version;
    assert.equal(real, SHADERS_CONFERIDOS_COM);
    const dir = mkdtempSync(join(tmpdir(), 'vanpack-three-'));
    try {
      mkdirSync(join(dir, 'node_modules', 'three'), { recursive: true });
      writeFileSync(join(dir, 'node_modules', 'three', 'package.json'), '{"version":"0.185.0"}');
      await assert.rejects(
        aparoDeShaders(dir, ['Mesh']),
        /conferido com o three\.js 0\.184\.0 e o projeto usa 0\.185\.0.*decisão do dono/s,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
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

  test('o three.js leva os shaders de Lambert e Basic e não leva os de Phong nem de Physical', () => {
    const code = read(shared[0]);
    assert.match(code, /#define LAMBERT/);
    assert.match(code, /USE_SHADOWMAP/);
    assert.doesNotMatch(code, /#define PHONG|#define PHYSICAL|#define TOON|#define MATCAP/);
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
