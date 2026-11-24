import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { collectThreeImports } from '../tools/build/shared-three.js';

test('shared Three entry collects runtime names without consuming unrelated imports or types', () => {
  const dir = mkdtempSync(join(tmpdir(), 'vanpack-three-imports-'));
  try {
    writeFileSync(
      join(dir, 'example.ts'),
      `import { unrelated } from './other';
import type { Texture } from 'three';
import { Mesh, type BufferGeometry, Group as SceneGroup } from 'three';
import { Vector3, Mesh } from 'three';`,
    );
    assert.deepEqual(collectThreeImports(dir), ['Group', 'Mesh', 'Vector3']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
