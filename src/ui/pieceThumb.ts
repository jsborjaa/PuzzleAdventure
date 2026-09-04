import type { PieceSprite } from '../engine/board/PieceSprite';

export function drawPieceThumb(canvas: HTMLCanvasElement, sprite: PieceSprite, angle: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const frame = sprite.frame;
  const src = sprite.texture.getSourceImage() as CanvasImageSource;
  const size = canvas.width;
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate((angle * Math.PI) / 180);
  const scale = size / Math.max(frame.cutWidth, frame.cutHeight, 1);
  ctx.scale(scale, scale);
  ctx.drawImage(
    src,
    frame.cutX,
    frame.cutY,
    frame.cutWidth,
    frame.cutHeight,
    -frame.cutWidth / 2,
    -frame.cutHeight / 2,
    frame.cutWidth,
    frame.cutHeight,
  );
  ctx.restore();
}
