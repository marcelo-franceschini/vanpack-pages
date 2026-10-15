// Câmera: ângulo de três quartos fixo; o alvo e o enquadramento seguem as chaves de cada capítulo.
// Em paisagem a cena é deslocada para a direita dos cartões; em retrato, para cima deles.
import { PerspectiveCamera, Vector3 } from 'three';
import { CAMERA, CAMERA_DIRECTION, CAMERA_PAUSE } from './constants.js';
import { lerp, smooth, within } from './math.js';

const FOV_LANDSCAPE = 22;
const FOV_PORTRAIT = 27;

export function createCameraRig() {
  const camera = new PerspectiveCamera(FOV_LANDSCAPE, 1, 0.5, 140);
  const direction = new Vector3(...CAMERA_DIRECTION).normalize();
  const target = new Vector3();
  let reach = 0;
  // fração da largura/altura da tela que a cena útil ocupa (o resto é dos cartões)
  const view = {
    portrait: false,
    aspect: 1,
    tanHalfFov: Math.tan((FOV_LANDSCAPE * Math.PI) / 360),
    fw: 0.6,
    fh: 0.8,
  };

  return {
    camera,
    /** Alvo (x, y, z) da câmera no último `place`; a luz principal o acompanha. */
    target,
    /** Metade da largura visível (m) no plano do alvo, no último `place`. */
    get reach() {
      return reach;
    },

    resize(width, height) {
      const portrait = width / height < 1;
      camera.aspect = width / height;
      camera.fov = portrait ? FOV_PORTRAIT : FOV_LANDSCAPE;
      if (portrait) camera.setViewOffset(width, height, 0, height * 0.125, width, height);
      else
        camera.setViewOffset(
          width,
          height,
          -width * (width < 1000 ? 0.25 : 0.2),
          -height * 0.03,
          width,
          height,
        );
      camera.updateProjectionMatrix();
      view.portrait = portrait;
      view.aspect = width / height;
      view.tanHalfFov = Math.tan((camera.fov * Math.PI) / 360);
      view.fw = portrait ? 1 : width < 1000 ? 0.5 : 0.6;
      view.fh = portrait ? 0.46 : 0.8;
    },

    /** Posiciona a câmera para o progresso `p` (0…1). Não aloca. */
    place(p) {
      const keys = view.portrait ? CAMERA.portrait : CAMERA.landscape;
      let i = 0;
      while (i < keys.length - 2 && p > keys[i + 1].p) i++;
      const a = keys[i];
      const b = keys[i + 1];
      const t = smooth((within(p, a.p, b.p) - CAMERA_PAUSE) / (1 - 2 * CAMERA_PAUSE));
      target.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t), lerp(a.z, b.z, t));
      const usefulWidth = lerp(a.w, b.w, t);
      const usefulHeight = lerp(a.h, b.h, t);
      const distance = Math.max(
        usefulHeight / (2 * view.tanHalfFov * view.fh),
        usefulWidth / (2 * view.tanHalfFov * view.aspect * view.fw),
      );
      reach = distance * view.tanHalfFov * view.aspect;
      camera.position.copy(target).addScaledVector(direction, distance);
      camera.lookAt(target);
    },
  };
}
