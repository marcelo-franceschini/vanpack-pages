import {
  CanvasTexture,
  ExtrudeGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { drawHorizontalBrand } from '../../engine/brand-marks';
import { createRectShadowTexture, createSurface } from '../../engine/environment';
import { COLORS } from './constants';

export interface FactoryMaterials {
  cream: MeshLambertMaterial;
  creamSide: MeshLambertMaterial;
  creamRecess: MeshLambertMaterial;
  charcoal: MeshLambertMaterial;
  charcoalSoft: MeshLambertMaterial;
  forest: MeshLambertMaterial;
  steel: MeshLambertMaterial;
  steelDark: MeshLambertMaterial;
  wood: MeshLambertMaterial;
  woodDark: MeshLambertMaterial;
  glass: MeshLambertMaterial;
  truckSide: MeshLambertMaterial;
  road: MeshLambertMaterial;
  roadLine: MeshLambertMaterial;
  strap: MeshLambertMaterial;
  lamp: MeshLambertMaterial;
  glue: MeshLambertMaterial;
  contactShadow: MeshBasicMaterial;
  dispose: () => void;
}

/**
 * Builds a clean architectural box with 45° chamfered vertical corners and crisp top/bottom bevel,
 * matching the refined industrial silhouette of the original Vanpack v4 machines in `public/og.jpg`.
 */
export function createChamferedBox(
  width: number,
  height: number,
  depth: number,
  corner = 0.08,
  bevel = 0.018,
): BufferGeometry {
  const c = Math.min(corner, width * 0.24, depth * 0.24);
  const b = Math.min(bevel, height * 0.18, c * 0.6);
  const hw = width * 0.5 - b;
  const hd = depth * 0.5 - b;
  const innerH = Math.max(0.004, height - b * 2);

  const shape = new Shape();
  shape.moveTo(-hw + c, -hd);
  shape.lineTo(hw - c, -hd);
  shape.lineTo(hw, -hd + c);
  shape.lineTo(hw, hd - c);
  shape.lineTo(hw - c, hd);
  shape.lineTo(-hw + c, hd);
  shape.lineTo(-hw, hd - c);
  shape.lineTo(-hw, -hd + c);
  shape.closePath();

  const geo = new ExtrudeGeometry(shape, {
    depth: innerH,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 1,
    curveSegments: 1,
  });
  // Extrude is along +Z; rotate so width=X, height=Y, depth=Z and center at origin
  geo.rotateX(-Math.PI * 0.5);
  geo.translate(0, -innerH * 0.5, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Creates a grounded soft rectangular contact-shadow quad (`y = 0.003`) for diorama plinths. */
export function createPlinthShadow(
  width: number,
  depth: number,
  mats: FactoryMaterials,
): Mesh {
  const mesh = new Mesh(new PlaneGeometry(width, depth), mats.contactShadow);
  mesh.rotation.x = -Math.PI * 0.5;
  mesh.position.y = 0.003;
  return mesh;
}

/** Crisp Vanpack horizontal vector lockup on warm ivory box-truck panel (brand manual §5). */
function createTruckBrandingTexture(maxAnisotropy: number): Texture {
  const w = 1024;
  const h = 512;
  const { canvas, ctx } = createSurface(w, h);

  ctx.fillStyle = '#faf5ea';
  ctx.fillRect(0, 0, w, h);

  // Forest-green lower stripe + subtle Kraft hairline trim
  ctx.fillStyle = '#14513a';
  ctx.fillRect(0, h - 54, w, 54);
  ctx.fillStyle = '#b78c5c';
  ctx.fillRect(0, h - 62, w, 8);

  drawHorizontalBrand(ctx, 182, 138, 660, '#14513a');

  const tex = new CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

/** Architectural matte diorama materials matching `public/og.jpg`. */
export function createFactoryMaterials(maxAnisotropy = 4): FactoryMaterials {
  const truckTex = createTruckBrandingTexture(maxAnisotropy);
  const shadowTex = createRectShadowTexture();

  const cream = new MeshLambertMaterial({ color: COLORS.cream });
  const creamSide = new MeshLambertMaterial({ color: COLORS.creamSide });
  const creamRecess = new MeshLambertMaterial({ color: 0xd9d2c4 });
  const charcoal = new MeshLambertMaterial({ color: COLORS.charcoal });
  const charcoalSoft = new MeshLambertMaterial({ color: COLORS.charcoalSoft });
  const forest = new MeshLambertMaterial({ color: COLORS.forest });
  const steel = new MeshLambertMaterial({ color: COLORS.steel });
  const steelDark = new MeshLambertMaterial({ color: COLORS.steelDark });
  const wood = new MeshLambertMaterial({ color: COLORS.wood });
  const woodDark = new MeshLambertMaterial({ color: COLORS.woodDark });
  const glass = new MeshLambertMaterial({ color: COLORS.glass });
  const truckSide = new MeshLambertMaterial({ map: truckTex });
  const road = new MeshLambertMaterial({ color: COLORS.road });
  const roadLine = new MeshLambertMaterial({ color: 0xeae5db });
  const strap = new MeshLambertMaterial({ color: COLORS.forestDark });
  const lamp = new MeshLambertMaterial({
    color: COLORS.amber,
    emissive: COLORS.amber,
    emissiveIntensity: 0.48,
  });
  const glue = new MeshLambertMaterial({ color: COLORS.glue });
  const contactShadow = new MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.92,
  });

  const all: Material[] = [
    cream,
    creamSide,
    creamRecess,
    charcoal,
    charcoalSoft,
    forest,
    steel,
    steelDark,
    wood,
    woodDark,
    glass,
    truckSide,
    road,
    roadLine,
    strap,
    lamp,
    glue,
    contactShadow,
  ];

  return {
    cream,
    creamSide,
    creamRecess,
    charcoal,
    charcoalSoft,
    forest,
    steel,
    steelDark,
    wood,
    woodDark,
    glass,
    truckSide,
    road,
    roadLine,
    strap,
    lamp,
    glue,
    contactShadow,
    dispose() {
      for (const m of all) m.dispose();
      truckTex.dispose();
      shadowTex.dispose();
    },
  };
}

export function setShadows(root: Object3D, cast: boolean, receive: boolean): void {
  root.traverse((obj) => {
    if (obj instanceof Mesh) {
      obj.castShadow = cast;
      obj.receiveShadow = receive;
    }
  });
}

export function disposeGeometries(root: Object3D): void {
  const seen = new Set<string>();
  root.traverse((obj) => {
    if (obj instanceof Mesh && obj.geometry && !seen.has(obj.geometry.uuid)) {
      seen.add(obj.geometry.uuid);
      obj.geometry.dispose();
    }
  });
}
