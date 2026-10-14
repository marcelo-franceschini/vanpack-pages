import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const ATTRIBUTES = ['position', 'normal', 'uv'];

/** Geometria não indexada só com position/normal/uv, para todas poderem ser unidas. */
function normalized(geometry) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  for (const name of Object.keys(g.attributes)) {
    if (!ATTRIBUTES.includes(name)) g.deleteAttribute(name);
  }
  if (!g.attributes.uv) {
    const count = g.attributes.position.count;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  }
  return g;
}

function slice(geometry, start, count) {
  const out = new THREE.BufferGeometry();
  for (const [name, attr] of Object.entries(geometry.attributes)) {
    const s = attr.itemSize;
    out.setAttribute(
      name,
      new THREE.BufferAttribute(attr.array.slice(start * s, (start + count) * s), s),
    );
  }
  return out;
}

/** Pares [geometria, material]; malhas multi-material são separadas por grupo. */
function parts(mesh) {
  const g = normalized(mesh.geometry);
  if (!Array.isArray(mesh.material)) return [[g, mesh.material]];
  return g.groups.map(({ start, count, materialIndex }) => [
    slice(g, start, count),
    mesh.material[materialIndex],
  ]);
}

/**
 * Une as malhas de `root` (no espaço local de `root`) em uma malha por combinação de
 * material, sombra e renderOrder: dezenas de peças viram poucos draw calls.
 */
export function mergeByMaterial(root) {
  root.updateMatrixWorld(true);
  const toLocal = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const matrix = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isMesh) return;
    matrix.multiplyMatrices(toLocal, o.matrixWorld);
    for (const [geometry, material] of parts(o)) {
      const key = `${material.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}`;
      let bucket = buckets.get(key);
      if (!bucket) buckets.set(key, (bucket = { material, source: o, list: [] }));
      bucket.list.push(geometry.applyMatrix4(matrix));
    }
  });
  const out = new THREE.Group();
  for (const { material, source, list } of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(list), material);
    for (const g of list) g.dispose();
    mesh.castShadow = source.castShadow;
    mesh.receiveShadow = source.receiveShadow;
    mesh.renderOrder = source.renderOrder;
    out.add(mesh);
  }
  return out;
}
