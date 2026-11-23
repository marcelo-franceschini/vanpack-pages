import {
  CanvasTexture,
  DirectionalLight,
  HemisphereLight,
  PCFSoftShadowMap,
  SRGBColorSpace,
  type Scene,
  type Texture,
  type WebGLRenderer,
} from 'three';

export type DrawSurface = HTMLCanvasElement | OffscreenCanvas;
export type DrawContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Creates a 2D drawing surface compatible with both main thread and OffscreenCanvas workers. */
export function createSurface(
  width: number,
  height: number,
): {
  canvas: DrawSurface;
  ctx: DrawContext2D;
} {
  const canvas: DrawSurface =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : Object.assign(document.createElement('canvas'), { width, height });
  const ctx = canvas.getContext('2d') as DrawContext2D | null;
  if (!ctx) throw new Error('Unable to acquire 2D context for procedural texture.');
  return { canvas, ctx };
}

/** Detects software/CPU WebGL renderers (SwiftShader, llvmpipe) to dial down GPU cost safely. */
export function detectSoftwareGl(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(
      (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) ?? '',
    );
    return /SwiftShader|llvmpipe|Software|Mesa OffScreen/i.test(renderer);
  } catch {
    return false;
  }
}

export interface RendererOptions {
  isSoftware: boolean;
  mobile: boolean;
  dpr: number;
  shadows?: boolean;
}

/**
 * Configures crisp sRGB diorama rendering matching the Vanpack brand palette without color shift
 * (linear/sRGB fidelity so `#F2EDE3` paper, `#FAF5EA` ivory, `#B78C5C` kraft, and `#14513A` forest
 * match `public/og.jpg` and the brand manual accurately).
 */
export function configureRenderer(
  renderer: WebGLRenderer,
  { isSoftware, mobile, dpr, shadows = true }: RendererOptions,
): void {
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(isSoftware ? 1 : Math.min(dpr, mobile ? 1.5 : 2));

  const enableShadows = shadows && !isSoftware && !mobile;
  renderer.shadowMap.enabled = enableShadows;
  if (enableShadows) {
    renderer.shadowMap.type = PCFSoftShadowMap;
  }
}

export interface DioramaLightsOptions {
  shadows: boolean;
  shadowExtent?: number;
}

/**
 * Architectural miniature diorama lighting matching `public/og.jpg` and `products-svg.mjs`:
 * bright luminous top-left-front sun `[-4.5, 9, 6]`, warm paper hemisphere fill,
 * and gentle cool back-right fill for clean isometric face contrast.
 */
export function createDioramaLights(
  scene: Scene,
  { shadows, shadowExtent = 12 }: DioramaLightsOptions,
): { key: DirectionalLight; hemi: HemisphereLight; fill: DirectionalLight } {
  const hemi = new HemisphereLight(0xfffef9, 0xd8d0c2, 1.52);
  scene.add(hemi);

  const key = new DirectionalLight(0xfffaf0, 1.48);
  key.position.set(-4.5, 9, 6);
  if (shadows) {
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 3;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 36;
    key.shadow.camera.left = -shadowExtent;
    key.shadow.camera.right = shadowExtent;
    key.shadow.camera.top = shadowExtent;
    key.shadow.camera.bottom = -shadowExtent;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.015;
  }
  scene.add(key);

  const fill = new DirectionalLight(0xeef3f8, 0.36);
  fill.position.set(7, 4, -5);
  scene.add(fill);

  return { key, hemi, fill };
}

/** Soft elliptical contact shadow disc grounded directly beneath objects on warm paper. */
export function createContactShadowTexture(): Texture {
  const { canvas, ctx } = createSurface(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(27, 26, 23, 0.22)');
  grad.addColorStop(0.5, 'rgba(27, 26, 23, 0.11)');
  grad.addColorStop(0.82, 'rgba(27, 26, 23, 0.025)');
  grad.addColorStop(1, 'rgba(27, 26, 23, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft rounded-rectangle ambient occlusion shadow texture grounded beneath machine plinths
 * and vehicles, giving the exact soft studio contact shadow seen in `public/og.jpg`.
 */
export function createRectShadowTexture(): Texture {
  const size = 128;
  const { canvas, ctx } = createSurface(size, size);
  ctx.clearRect(0, 0, size, size);

  const layers: readonly [number, number, number][] = [
    [10, 26, 0.035],
    [16, 22, 0.055],
    [22, 18, 0.08],
    [28, 14, 0.11],
  ];

  for (const [inset, rad, alpha] of layers) {
    const w = size - inset * 2;
    const h = size - inset * 2;
    ctx.beginPath();
    ctx.moveTo(inset + rad, inset);
    ctx.lineTo(inset + w - rad, inset);
    ctx.quadraticCurveTo(inset + w, inset, inset + w, inset + rad);
    ctx.lineTo(inset + w, inset + h - rad);
    ctx.quadraticCurveTo(inset + w, inset + h, inset + w - rad, inset + h);
    ctx.lineTo(inset + rad, inset + h);
    ctx.quadraticCurveTo(inset, inset + h, inset, inset + h - rad);
    ctx.lineTo(inset, inset + rad);
    ctx.quadraticCurveTo(inset, inset, inset + rad, inset);
    ctx.closePath();
    ctx.fillStyle = `rgba(27, 26, 23, ${alpha})`;
    ctx.fill();
  }

  const tex = new CanvasTexture(canvas as HTMLCanvasElement);
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Paces software WebGL rendering with a GL fence sync so headless/CPU frames never starve UI. */
export function waitAfterDraw(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  isSoftware: boolean,
  onDone: () => void,
): void {
  if (!isSoftware) {
    onDone();
    return;
  }
  if (typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext) {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync) {
      gl.flush();
      const poll = () => {
        const status = gl.clientWaitSync(sync, 0, 0);
        if (status === gl.ALREADY_SIGNALED || status === gl.CONDITION_SATISFIED) {
          gl.deleteSync(sync);
          onDone();
        } else {
          setTimeout(poll, 8);
        }
      };
      setTimeout(poll, 4);
      return;
    }
  }
  setTimeout(onDone, 16);
}
