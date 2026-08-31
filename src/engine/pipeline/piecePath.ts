import type { PieceShapes } from '../../domain/jigsaw';

export function drawPiecePath(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tabSize: number,
  shapes: PieceShapes,
) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  drawSide(ctx, 0, 0, width, 0, shapes.top, tabSize);
  drawSide(ctx, width, 0, width, height, shapes.right, tabSize);
  drawSide(ctx, width, height, 0, height, shapes.bottom, tabSize);
  drawSide(ctx, 0, height, 0, 0, shapes.left, tabSize);
  ctx.closePath();
}

function drawSide(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  shape: number,
  tabSize: number,
) {
  if (shape === 0) {
    ctx.lineTo(x2, y2);
    return;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const h = shape * tabSize;
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const neckHalfW = Math.abs(tabSize) * 0.2;
  const headHalfW = Math.abs(tabSize) * 0.6;
  const cpOut = h * 1.1;
  const cpNeck = h * 0.2;
  const pNeckStart = { x: cx - ux * neckHalfW * 2.5, y: cy - uy * neckHalfW * 2.5 };
  const pNeckEnd = { x: cx + ux * neckHalfW * 2.5, y: cy + uy * neckHalfW * 2.5 };

  ctx.lineTo(pNeckStart.x, pNeckStart.y);
  ctx.bezierCurveTo(
    pNeckStart.x + nx * cpNeck,
    pNeckStart.y + ny * cpNeck,
    cx - ux * headHalfW + nx * cpOut,
    cy - uy * headHalfW + ny * cpOut,
    cx + nx * h,
    cy + ny * h,
  );
  ctx.bezierCurveTo(
    cx + ux * headHalfW + nx * cpOut,
    cy + uy * headHalfW + ny * cpOut,
    pNeckEnd.x + nx * cpNeck,
    pNeckEnd.y + ny * cpNeck,
    pNeckEnd.x,
    pNeckEnd.y,
  );
  ctx.lineTo(x2, y2);
}
