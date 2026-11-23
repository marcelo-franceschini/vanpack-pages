/**
 * Canonical Vanpack horizontal mark vector drawing for 2D/OffscreenCanvas decals (e.g. delivery truck).
 * Coordinates match `/public/brand/vanpack-horizontal.svg` (`viewBox="0 0 400 100"`).
 */

type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const SYMBOL_POLYGONS: readonly (readonly [number, number])[][] = [
  [
    [14, 35],
    [48, 18],
    [45, 2],
    [11, 19],
  ],
  [
    [86, 35],
    [52, 18],
    [55, 2],
    [89, 19],
  ],
  [
    [14, 41],
    [48, 58],
    [42, 46],
    [8, 29],
  ],
  [
    [86, 41],
    [52, 58],
    [58, 46],
    [92, 29],
  ],
  [
    [14, 46],
    [50, 64],
    [50, 96],
    [14, 78],
  ],
  [
    [50, 64],
    [86, 46],
    [86, 78],
    [50, 96],
  ],
];

const WORDMARK_PATH =
  'M137.05 67.0 124.85 32.6H136.65L143.55 55.6H143.75L150.7 32.6H162.0L149.85 67.0Z ' +
  'M187.3 67.0 185.85 62.15H173.8L172.35 67.0H161.05L173.6 32.6H186.45L199.0 67.0ZM176.1 54.45H183.55L179.95 42.2H179.75Z ' +
  'M228.25 67.0 213.8 50.3V67.0H203.65V32.6H213.3L227.75 49.55V32.6H237.9V67.0Z ' +
  'M276.1 43.9V44.55Q276.1 47.75 274.7 50.35Q273.3 52.95 270.8 54.425Q268.3 55.9 265.1 55.9H256.85V67.0H245.8V32.6H265.1Q268.3 32.6 270.8 34.075Q273.3 35.55 274.7 38.125Q276.1 40.7 276.1 43.9ZM256.85 47.85H261.4Q263.15 47.85 264.025 46.95Q264.9 46.05 264.9 44.5V44.1Q264.9 42.5 264.025 41.625Q263.15 40.75 261.4 40.75H256.85Z ' +
  'M301.2 67.0 299.75 62.15H287.7L286.25 67.0H274.95L287.5 32.6H300.35L312.9 67.0ZM290.0 54.45H297.45L293.85 42.2H293.65Z ' +
  'M349.6 46.75H339.05Q339.05 43.75 337.475 42.0Q335.9 40.25 333.0 40.25Q329.65 40.25 328.075 42.35Q326.5 44.45 326.5 48.2V51.4Q326.5 55.1 328.075 57.225Q329.65 59.35 332.9 59.35Q336.1 59.35 337.75 57.7Q339.4 56.05 339.4 53.05H349.6Q349.6 60.1 345.275 63.85Q340.95 67.6 333.05 67.6Q324.25 67.6 319.725 63.1Q315.2 58.6 315.2 49.8Q315.2 41.0 319.725 36.5Q324.25 32.0 333.05 32.0Q340.7 32.0 345.15 35.825Q349.6 39.65 349.6 46.75Z ' +
  'M379.35 32.6H393.05L380.7 46.75L393.3 67.0H380.25L373.1 54.4L367.1 59.3V67.0H356.05V32.6H367.1V47.3Z';

export function drawVanpackSymbol(
  ctx: Canvas2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const scale = size / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = color;
  ctx.lineWidth = 7;
  ctx.strokeRect(3.5, 3.5, 93, 93);

  ctx.translate(22, 22.6);
  ctx.scale(0.56, 0.56);
  ctx.fillStyle = color;
  for (const poly of SYMBOL_POLYGONS) {
    ctx.beginPath();
    poly.forEach(([px, py], i) => {
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

export function drawHorizontalBrand(
  ctx: Canvas2D,
  x: number,
  y: number,
  width: number,
  color: string,
): void {
  const scale = width / 400;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);

  drawVanpackSymbol(ctx, 0, 0, 100, color);

  ctx.fillStyle = color;
  if (typeof Path2D !== 'undefined') {
    ctx.fill(new Path2D(WORDMARK_PATH));
  } else {
    ctx.font = '900 44px Archivo, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('VANPACK', 124, 52);
  }
  ctx.restore();
}
