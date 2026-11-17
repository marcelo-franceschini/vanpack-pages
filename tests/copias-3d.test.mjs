// As cópias de propósito entre o 3D principal e o 3D dos produtos não podem se afastar sem aviso.
// A luz e o FOV ficam copiados em src/produtos/cena.js porque exportá-los do 3D principal custa bytes no
// worker da história (58 bytes gzip, medido no e747779), que está no teto. Este teste lê os arquivos:
// custa zero byte e não toca na trava do 3D. Puro, sem navegador.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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

test('o critério de "celular" do 3D principal e o dos produtos são o mesmo', () => {
  const stage = grab(read('src/render/stage.js'), /const MOBILE = '([^']+)'/, 'stage.js')[0];
  const montar = grab(read('src/produtos/montar.js'), /const MOBILE = '([^']+)'/, 'montar.js')[0];
  assert.equal(montar, stage);
});
