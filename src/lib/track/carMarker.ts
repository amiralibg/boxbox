/**
 * Top-down open-wheeler silhouette drawn as canvas vectors — crisper than a
 * PNG sprite at any DPR and tintable per team. Local coordinates point +x;
 * pass `heading` in screen-space radians. Base footprint ≈ 22×10 at size 1.
 */
export function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  heading: number,
  color: string,
  size = 1,
  opts: { glow?: boolean; alpha?: number } = {},
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(size, size);
  ctx.globalAlpha = opts.alpha ?? 1;

  if (opts.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 / size;
  }

  // tyres — dark, slightly proud of the body
  ctx.fillStyle = "#16161f";
  for (const [wx, wy] of [
    [4.6, -4.4],
    [4.6, 4.4],
    [-6.2, -4.6],
    [-6.2, 4.6],
  ] as const) {
    ctx.beginPath();
    ctx.roundRect(wx - 1.9, wy - 1.5, 3.8, 3.0, 1.2);
    ctx.fill();
  }

  // front + rear wings
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(9.2, -4.6, 1.9, 9.2, 0.8); // front wing
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-10.6, -4.2, 2.2, 8.4, 0.8); // rear wing
  ctx.fill();

  // body: nose → cockpit → engine cover, one tapered polygon
  ctx.beginPath();
  ctx.moveTo(9.4, 0); // nose tip
  ctx.quadraticCurveTo(6.5, -2.4, 1.5, -3.1);
  ctx.lineTo(-3.5, -3.1); // sidepod edge
  ctx.quadraticCurveTo(-8.6, -2.6, -9.2, 0);
  ctx.quadraticCurveTo(-8.6, 2.6, -3.5, 3.1);
  ctx.lineTo(1.5, 3.1);
  ctx.quadraticCurveTo(6.5, 2.4, 9.4, 0);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;

  // cockpit + halo hint
  ctx.fillStyle = "rgba(8,8,13,0.85)";
  ctx.beginPath();
  ctx.ellipse(-0.6, 0, 2.1, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/** screen-space heading from two projected points; falls back to `prev` when stationary */
export function headingBetween(ax: number, ay: number, bx: number, by: number, prev = 0): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx * dx + dy * dy < 0.01) return prev;
  return Math.atan2(dy, dx);
}
