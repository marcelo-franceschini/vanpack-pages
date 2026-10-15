// Linha do tempo: dado o progresso `p` (0…1), posiciona a chapa/caixa, as aparas, o palete, a cinta,
// a porta e o caminhão. As faixas de `p` estão em PHASE (constants.js).
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import {
  BOX,
  PALLET_END_X,
  PALLET_X,
  PHASE,
  RAIL_Y,
  SCRAPS,
  SCRAP_FALL,
  SHEET_LENGTH,
  SHEET_X,
  SHEET_Y,
  STACK_TOP,
} from './constants.js';
import { pathAt } from './geometry.js';
import { clamp, lerp, lin, ramp, smooth, within } from './math.js';

const GLUE_NOZZLE_X = -0.73; // bocal de cola, em x
const LIFT = 0.015; // a caixa sobe 15 mm ao chegar à mesa giratória
const HOP_HEIGHT = 0.38; // altura do salto da mesa para o palete
const DRIVE_DISTANCE = 9.5; // metros percorridos pelo caminhão na estrada
const TRUCK_PIVOT = 2.1; // distância da traseira ao centro do eixo, em x

/**
 * @param {object} parts
 * @param {import('three').Mesh} parts.plain chapa lisa antes da máquina
 * @param {ReturnType<import('./hero.js').createHero>} parts.hero
 * @param {import('three').InstancedMesh} parts.scraps
 * @param {import('three').Group} parts.load palete carregado
 * @param {import('three').Group} parts.strap cinta do palete
 * @param {import('three').Mesh} parts.loadBlob sombra falsa do palete
 * @param {import('three').Group} parts.doorPivot
 * @param {import('three').Group} parts.truck
 * @param {import('three').Mesh} parts.truckBlob sombra falsa do caminhão
 * @returns {(p: number) => void} aplica o progresso `p`; não aloca
 */
export function createTimeline({
  plain,
  hero,
  scraps,
  load,
  strap,
  loadBlob,
  doorPivot,
  truck,
  truckBlob,
}) {
  const position = new Vector3();
  const scale = new Vector3();
  const quaternion = new Quaternion();
  const euler = new Euler();
  const matrix = new Matrix4();
  const road = { x: 0, z: 0, a: 0 };
  const glueEnd = BOX.F + BOX.H;
  const scrapStartX = SCRAPS.map((scrap) => lin(scrap.t0, SHEET_X));

  return function update(p) {
    // chapa: sai do alimentador, passa pelas máquinas e chega à mesa giratória
    const sheetX = lin(p, SHEET_X);
    plain.visible = sheetX < PHASE.heroFromX;
    plain.position.set(sheetX, SHEET_Y - 0.004, -0.07);
    hero.spin.visible = sheetX >= PHASE.heroFromX && p < PHASE.heroEnd;

    // dobra enquanto atravessa a máquina de cola; depois abre, gira, fecha e salta para o palete
    const fold = smooth(within(sheetX, PHASE.fold.fromX, PHASE.fold.toX));
    const open = ramp(p, PHASE.open) * (1 - ramp(p, PHASE.close));
    const hop = ramp(p, PHASE.hop);
    const palletX = lerp(PALLET_X, PALLET_END_X, ramp(p, PHASE.slide));
    const x = lerp(sheetX, palletX, hop);
    const y =
      lerp(RAIL_Y + LIFT * ramp(p, PHASE.lift), RAIL_Y + STACK_TOP, hop) +
      HOP_HEIGHT * Math.sin(Math.PI * hop);
    const yaw =
      2 * Math.PI * ramp(p, PHASE.turn) -
      0.3 * ramp(p, PHASE.wobble) +
      0.3 * ramp(p, PHASE.turnBack);
    hero.place(
      x,
      y,
      yaw,
      fold,
      1 - open,
      (Math.PI / 2) * smooth(open / 0.8),
      ((50 * Math.PI) / 180) * smooth((open - 0.7) / 0.3),
      (Math.PI / 2) * smooth((open - 0.1) / 0.7),
    );

    // cola: o fio acompanha o bocal
    const glueStart = clamp(GLUE_NOZZLE_X - (sheetX - SHEET_LENGTH / 2), BOX.F, glueEnd);
    const glueLength = glueEnd - glueStart;
    hero.bead.visible = glueLength > 0.003 && p < PHASE.glueEnd;
    hero.bead.scale.x = Math.max(glueLength, 0.001);
    hero.bead.position.x = glueStart + glueLength / 2;

    // aparas: soltam da chapa no recolhimento e caem girando (antes disso nem entram no quadro)
    scraps.visible = p >= PHASE.scrapsFrom;
    if (scraps.visible) {
      for (let i = 0; i < SCRAPS.length; i++) {
        const scrap = SCRAPS[i];
        const fall = clamp((p - scrap.t0) / SCRAP_FALL);
        const from = lin(Math.min(p, scrap.t0), SHEET_X) - SHEET_LENGTH / 2 + scrap.w / 2;
        const to = scrapStartX[i] - SHEET_LENGTH / 2 + scrap.w / 2 + scrap.vx;
        scale.set(scrap.w, 1, scrap.d);
        position.set(
          lerp(from, to, fall) + scrap.vx * fall,
          SHEET_Y - 0.01 - 0.4 * fall * fall,
          scrap.z,
        );
        euler.set(0.3 * fall * Math.sign(scrap.rot), 0, scrap.rot * fall * 0.5);
        quaternion.setFromEuler(euler);
        scraps.setMatrixAt(i, matrix.compose(position, quaternion, scale));
      }
      scraps.instanceMatrix.needsUpdate = true;
    }

    // palete, cinta e porta do baú
    load.position.set(palletX, RAIL_Y, 0);
    load.visible = p < PHASE.heroEnd;
    loadBlob.position.x = palletX;
    loadBlob.visible = load.visible;
    const strapGrow = ramp(p, PHASE.strap);
    strap.visible = strapGrow > 0.01;
    strap.scale.setScalar(Math.max(strapGrow, 0.001));
    doorPivot.scale.y = 0.03 + 0.97 * ramp(p, PHASE.door);

    // caminhão: parte pela estrada
    const driven = DRIVE_DISTANCE * within(p, PHASE.drive[0], PHASE.drive[1]) ** 1.6;
    pathAt(driven, road);
    const cos = Math.cos(road.a);
    const sin = Math.sin(road.a);
    truck.position.set(road.x - TRUCK_PIVOT * cos, 0, road.z + TRUCK_PIVOT * sin);
    truck.rotation.y = road.a;
    truckBlob.position.set(truck.position.x, 0.007, truck.position.z);
    truckBlob.rotation.y = road.a;
  };
}
