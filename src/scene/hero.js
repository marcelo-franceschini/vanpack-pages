// A peça "herói": a chapa, o tubo achatado e a caixa são a mesma peça (4 painéis + abas). Ela dobra
// por baixo, abre cisalhando, gira e volta a dobrar. A marca do cliente demo fica nos dois painéis
// longos.
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
} from 'three';
import { BOX, KRAFT, KRAFT_INNER, LAYER, PALETTE, SHEET_LENGTH } from './constants.js';
import { panelGeometry } from './geometry.js';
import { bodyTexture, flapTexture } from './textures.js';

const { L, D, H, F } = BOX;

/**
 * @param {<T>(resource: T) => T} track registra o recurso para o `dispose()` da cena
 */
export function createHero(track) {
  const spin = new Group();
  const root = new Group();
  spin.add(root);

  const innerColor = new Color(KRAFT_INNER);
  const panelMaterial = (map) => {
    const material = track(
      new MeshLambertMaterial({ color: map ? 0xffffff : KRAFT, map, side: DoubleSide }),
    );
    // a face de dentro do papelão é mais clara e lisa
    const inner = [innerColor.r, innerColor.g, innerColor.b].map((c) => c.toFixed(4)).join(',');
    material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\nif(!gl_FrontFacing){diffuseColor.rgb=vec3(${inner});}`,
      );
    };
    material.customProgramCacheKey = () => `vp-panel${map ? 1 : 0}`;
    return material;
  };
  const textures = [track(bodyTexture(false)), track(bodyTexture(true)), track(flapTexture())];
  const bodyMaterial = panelMaterial(textures[0]);
  const printMaterial = panelMaterial(textures[1]);
  const flapMaterial = panelMaterial(textures[2]);

  // Um painel de largura `w` (em z) com aba em cima e, opcionalmente, embaixo.
  const panel = (w, withBottomFlap, printed) => {
    const group = new Group();
    const mesh = (geometry, material) => {
      const m = new Mesh(track(geometry), material);
      m.castShadow = true;
      return m;
    };
    group.add(
      mesh(
        panelGeometry(F, F + H, w, (x) => (x - F) / H),
        printed ? printMaterial : bodyMaterial,
      ),
    );
    const top = new Group();
    top.position.x = F + H;
    top.add(
      mesh(
        panelGeometry(0, F, w, (x) => x / F),
        flapMaterial,
      ),
    );
    group.add(top);
    let bottom = null;
    if (withBottomFlap) {
      bottom = new Group();
      bottom.position.x = F;
      bottom.add(
        mesh(
          panelGeometry(-F, 0, w, (x) => -x / F),
          flapMaterial,
        ),
      );
      group.add(bottom);
    }
    return { group, top, bottom };
  };

  const side1 = panel(D, false, false);
  const back = panel(L, true, true);
  const front = panel(L, true, true);
  const side2 = panel(D, false, false);
  const hingeFront = new Group();
  const hingeBack = new Group();
  const hingeSide = new Group();
  root.add(side1.group);
  side1.group.add(hingeFront);
  hingeFront.add(front.group);
  side1.group.add(hingeBack);
  hingeBack.add(back.group);
  back.group.add(hingeSide);
  hingeSide.add(side2.group);
  hingeBack.position.set(0, 0, D);
  hingeSide.position.set(0, 0, L);

  // fio de cola na aba de emenda
  const bead = new Mesh(
    track(new BoxGeometry(1, 0.008, 0.032)),
    track(new MeshBasicMaterial({ color: PALETTE.white })),
  );
  bead.position.set(0, 0.005, D - 0.05);
  side2.group.add(bead);

  const panels = [side1, back, front, side2];
  function pose(b1, b2, b3, flapTop, flapBottom, lift) {
    hingeFront.rotation.x = -b1;
    front.group.position.set(0, LAYER * lift, -L);
    hingeBack.rotation.x = b2;
    hingeSide.rotation.x = b3;
    side2.group.position.set(0, LAYER * (b3 / Math.PI), 0);
    for (const p of panels) {
      p.top.rotation.z = flapTop;
      if (p.bottom) p.bottom.rotation.z = flapBottom;
    }
  }

  /**
   * @param {number} x posição da peça na linha
   * @param {number} y altura
   * @param {number} yaw giro na mesa
   * @param {number} fold 0 = chapa plana, 1 = tubo achatado
   * @param {number} squash 1 = tubo achatado, 0 = caixa aberta (só vale com `fold` = 1)
   * @param {number} phi inclinação em z ao abrir
   * @param {number} flapTop ângulo das abas de cima
   * @param {number} flapBottom ângulo das abas de baixo
   */
  function place(x, y, yaw, fold, squash, phi, flapTop, flapBottom) {
    const sheared = fold >= 1;
    const theta = sheared ? Math.PI / 2 + (Math.PI / 2) * squash : Math.PI;
    const b1 = sheared ? theta : Math.PI * fold;
    const b2 = sheared ? Math.PI - theta : 0;
    pose(b1, b2, b1, flapTop, flapBottom, b1 / Math.PI);
    const ym = (-L * Math.sin(theta)) / 2;
    const zm = D / 2 - (L * Math.cos(theta)) / 2;
    const cx = (SHEET_LENGTH / 2) * Math.cos(phi) - ym * Math.sin(phi);
    root.position.set(-cx, LAYER + (sheared ? L * Math.sin(theta) * Math.cos(phi) : 0), -zm);
    root.rotation.z = phi;
    spin.position.set(x, y, 0);
    spin.rotation.y = yaw;
  }

  return { spin, bead, place, textures };
}
