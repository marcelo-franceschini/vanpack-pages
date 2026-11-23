// O caminhão: baú com porta de enrolar, cabine e rodas, mesclados por material. Os logos das duas
// laterais do baú são decalques com a textura desenhada via Path2D.
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { RAIL_Y } from './constants.js';
import { Batch } from './geometry.js';

const RAIL = RAIL_Y;
const PROUD = 0.003; // a coluna da moldura avança 3 mm sobre a parede de dentro: esconde o começo dela, sem face rente
const GAP = 0.01; // recuo das caixas internas para não haver faces coplanares de materiais diferentes

/**
 * @param {Record<string, import('three').Material>} M materiais por cor
 * @param {import('three').Texture | null} logoTexture
 * @param {<T>(resource: T) => T} track registra o recurso para o `dispose()` da cena
 * @returns {{ truck: Group, doorPivot: Group }}
 */
export function buildTruck(M, logoTexture, track) {
  const truck = new Group();
  const doorPivot = new Group();
  {
    const b = new Batch();
    b.box(M.light2, 0, 3.0, 0.78, RAIL, -0.95, 0.95, 0.01);
    b.box(M.white, -0.02, 3.02, 2.38, 2.44, -0.97, 0.97, 0.01);
    for (const s of [-1, 1]) {
      b.box(M.white, 0, 3.0, RAIL, 2.38, s > 0 ? 0.92 : -0.95, s > 0 ? 0.95 : -0.92, 0.01);
      // a parede de dentro começa onde a coluna da moldura termina (x = 0,05): por baixo da coluna ela brigava com a face dela
      b.box(M.light2, 0.05, 3.0, RAIL, 2.38, s > 0 ? 0.9 : -0.92, s > 0 ? 0.92 : -0.9, 0.005);
      b.box(
        M.dark2,
        -0.03,
        0.05,
        RAIL,
        2.22,
        s > 0 ? 0.9 - PROUD : -0.97,
        s > 0 ? 0.97 : -0.9 + PROUD,
        0.01,
      );
      b.box(M.white, 3.2, 3.85, 1.52, 2.02, s > 0 ? 0.895 : -0.9, s > 0 ? 0.9 : -0.895, 0.004);
      b.box(M.dark, 4.18, 4.22, 0.75, 0.9, s * 0.55 - 0.125, s * 0.55 + 0.125, 0.01);
    }
    b.box(M.white, 2.94, 3.0, RAIL, 2.38, -0.95, 0.95, 0.01);
    b.box(M.dark2, -0.03, 0.05, 2.2, 2.42, -0.97 + GAP, 0.97 - GAP, 0.01);
    b.box(M.dark, 0, 3.0, 0.5, 0.78, -0.88, 0.88);
    b.box(M.dark2, -0.1, 0.02, 0.5, 0.64, -0.85, 0.85);
    b.box(M.dark2, 3.05, 4.2, 0.52, 1.38, -0.92, 0.92, 0.05);
    b.box(M.dark2, 3.05, 3.95, 1.38, 2.15, -0.9, 0.9, 0.05);
    b.box(M.glass, 3.93, 3.97, 1.5, 2.05, -0.8, 0.8, 0.004);
    for (const s of [-1, 1])
      b.box(M.glass, 3.2, 3.85, 1.52, 2.02, s > 0 ? 0.9 : -0.905, s > 0 ? 0.905 : -0.9, 0.004);
    b.box(M.dark, 4.2, 4.24, 0.62, 0.92, -0.4, 0.4, 0.01);
    for (const x of [0.95, 3.75])
      for (const s of [-1, 1]) {
        b.cyl(M.dark, x, 0.34, s * 0.78, 0.34, 0.22, 'z', 28);
        b.cyl(M.light2, x, 0.34, s * 0.78, 0.17, 0.235, 'z', 20);
      }
    b.cyl(M.dark2, 0.02, 2.3, 0, 0.07, 1.8);
    b.build(truck);
    const decal = track(new PlaneGeometry(2.222, 0.5556));
    const decalMaterial = track(
      new MeshBasicMaterial({
        map: logoTexture,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    if (logoTexture) {
      for (const side of [1, -1]) {
        const mesh = new Mesh(decal, decalMaterial);
        mesh.position.set(1.5, 1.6, side * 0.953);
        if (side < 0) mesh.rotation.y = Math.PI;
        truck.add(mesh);
      }
    }
    // porta de enrolar: encolhe em y a partir do topo
    doorPivot.position.set(0.033, 2.3, 0); // 2 mm recuada: a face de dentro não fica rente à da moldura
    const doorGeometry = new BoxGeometry(0.03, 2.3 - RAIL, 1.82);
    doorGeometry.translate(0, -(2.3 - RAIL) / 2, 0);
    doorPivot.add(new Mesh(track(doorGeometry), M.light));
    truck.add(doorPivot);
  }
  return { truck, doorPivot };
}
