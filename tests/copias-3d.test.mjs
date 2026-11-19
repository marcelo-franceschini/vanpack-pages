// Números do 3D escritos à mão que precisam bater com outro lugar, sem nada que os trave. A luz e o FOV
// ficam copiados em src/produtos/cena.js porque exportá-los do 3D principal custa bytes no worker da
// história (58 bytes gzip, medido no e747779), que está no teto; pelo mesmo motivo, a largura da palavra
// da marca (src/scene/textures.js) é uma conta de constantes, e não um laço sobre as letras. Os testes
// leem os arquivos ou desenham num contexto falso: zero byte no site e nada na trava do 3D. Puros, sem
// navegador.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { WORD_HEIGHT, WORD_WIDTH, drawWord } from '../src/scene/textures.js';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const grab = (source, pattern, what) => {
  const found = source.match(pattern);
  assert.ok(found, `${what}: o trecho mudou de forma, ajuste este teste`);
  return found.slice(1);
};

test('a luz e o FOV do 3D dos produtos são os do 3D principal (cópias de propósito, ver cena.js)', () => {
  const scene = read('src/scene/index.js');
  const camera = read('src/scene/camera.js');
  const cena = read('src/produtos/cena.js');

  const [sky, ground, fill] = grab(
    scene,
    /new HemisphereLight\((0x\w+), (0x\w+), ([\d.]+)\)/,
    'luz de céu',
  );
  const [sunColor, sunPower] = grab(scene, /new DirectionalLight\((0x\w+), ([\d.]+)\)/, 'sol');
  const [offset] = grab(scene, /const SUN_OFFSET = new Vector3\(([^)]+)\)/, 'posição do sol');
  const [fov] = grab(camera, /const FOV_LANDSCAPE = (\d+);/, 'FOV');

  assert.equal(Number(grab(cena, /const SKY = (0x\w+);/, 'SKY')[0]), Number(sky));
  assert.equal(Number(grab(cena, /const GROUND = (0x\w+);/, 'GROUND')[0]), Number(ground));
  assert.equal(Number(grab(cena, /const SUN = (0x\w+);/, 'SUN')[0]), Number(sunColor));
  assert.equal(grab(cena, /const SUN_OFFSET = new Vector3\(([^)]+)\)/, 'SUN_OFFSET')[0], offset);
  assert.equal(Number(grab(cena, /const FOV = (\d+);/, 'FOV')[0]), Number(fov));
  assert.equal(
    Number(grab(cena, /new HemisphereLight\(SKY, GROUND, ([\d.]+)\)/, 'céu')[0]),
    Number(fill),
  );
  assert.equal(
    Number(grab(cena, /new DirectionalLight\(SUN, ([\d.]+)\)/, 'sol')[0]),
    Number(sunPower),
  );
});

test('a largura e a altura da palavra da marca (WORD_WIDTH, WORD_HEIGHT) são as do desenho', () => {
  // a palavra é desenhada num contexto que só anota os pontos; a extensão do traço tem de bater com elas
  const xs = [];
  const ys = [];
  const point = (x, y) => {
    xs.push(x);
    ys.push(y);
  };
  const g = { beginPath() {}, stroke() {}, moveTo: point, lineTo: point };
  drawWord(g, 0, 0);
  assert.equal(g.lineCap, 'square', 'a ponta quadrada passa meio traço do último ponto');
  const half = g.lineWidth / 2;
  assert.equal(Math.min(...xs) - half, 0);
  assert.equal(Math.max(...xs) + half, WORD_WIDTH);
  assert.equal(Math.min(...ys) - half, 0);
  assert.equal(Math.max(...ys) + half, WORD_HEIGHT);
});
