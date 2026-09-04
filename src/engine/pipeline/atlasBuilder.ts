import { ATLAS_MAX_SIZE } from '../../domain/product';
import type { JigsawLayout } from '../../domain/jigsaw';
import type { PieceId } from '../../domain/pieceId';
import { drawPiecePath } from './piecePath';

export interface AtlasFrame {
  id: PieceId;
  atlasIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BuiltAtlas {
  cacheKey: string;
  canvases: HTMLCanvasElement[];
  frames: AtlasFrame[];
}

/** Extra pixels between packed frames so piece strokes and linear filtering do not bleed. */
const FRAME_GAP = 4;

export function atlasCacheKey(layout: JigsawLayout, imageKey: string, imageFingerprint: string): string {
  return `${layout.levelId}:${layout.cols}x${layout.rows}:${layout.seed}:${imageKey}:${imageFingerprint}:v3`;
}

/** Cheap pixel signature so replacing a photo invalidates the cached atlas. */
export function fingerprintImage(source: CanvasImageSource, width: number, height: number): string {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return `${width}x${height}`;
  ctx.drawImage(source, 0, 0, width, height, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let hash = 2166136261;
  for (let i = 0; i < data.length; i += 8) {
    hash ^= data[i]!;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildPieceAtlas(
  source: CanvasImageSource,
  layout: JigsawLayout,
  imageKey: string,
  imageFingerprint: string,
): BuiltAtlas {
  const pad = Math.ceil(layout.tabSize);
  const cellW = Math.ceil(layout.pieceWidth + pad * 2);
  const cellH = Math.ceil(layout.pieceHeight + pad * 2);
  const packed = packFrames(
    layout.pieces.map((p) => ({ id: p.id, w: cellW, h: cellH })),
    ATLAS_MAX_SIZE,
  );

  const canvases = packed.atlasSizes.map((size) => {
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    return canvas;
  });

  const defs = new Map(layout.pieces.map((p) => [p.id, p]));
  for (const frame of packed.frames) {
    const def = defs.get(frame.id)!;
    const ctx = canvases[frame.atlasIndex]!.getContext('2d')!;
    ctx.save();
    ctx.translate(frame.x + pad, frame.y + pad);
    drawPiecePath(ctx, layout.pieceWidth, layout.pieceHeight, layout.tabSize, def.shapes);
    ctx.clip();
    ctx.drawImage(
      source,
      def.srcX - pad,
      def.srcY - pad,
      def.srcW + pad * 2,
      def.srcH + pad * 2,
      -pad,
      -pad,
      def.srcW + pad * 2,
      def.srcH + pad * 2,
    );
    ctx.restore();

    ctx.save();
    ctx.translate(frame.x + pad, frame.y + pad);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    drawPiecePath(ctx, layout.pieceWidth, layout.pieceHeight, layout.tabSize, def.shapes);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    drawPiecePath(ctx, layout.pieceWidth, layout.pieceHeight, layout.tabSize, def.shapes);
    ctx.stroke();
    ctx.restore();
  }

  return { cacheKey: atlasCacheKey(layout, imageKey, imageFingerprint), canvases, frames: packed.frames };
}

function packFrames(
  items: { id: PieceId; w: number; h: number }[],
  maxSize: number,
): { frames: AtlasFrame[]; atlasSizes: { w: number; h: number }[] } {
  const frames: AtlasFrame[] = [];
  const atlasSizes: { w: number; h: number }[] = [];
  let atlasIndex = 0;
  let x = 0;
  let y = 0;
  let rowH = 0;
  let usedW = 0;
  let usedH = 0;

  const flushAtlas = () => {
    atlasSizes.push({ w: Math.max(1, usedW), h: Math.max(1, usedH) });
    atlasIndex += 1;
    x = 0;
    y = 0;
    rowH = 0;
    usedW = 0;
    usedH = 0;
  };

  for (const item of items) {
    if (item.w > maxSize || item.h > maxSize) {
      throw new Error(`Piece ${item.id} exceeds atlas max size`);
    }
    if (x + item.w > maxSize) {
      x = 0;
      y += rowH + FRAME_GAP;
      rowH = 0;
    }
    if (y + item.h > maxSize) {
      flushAtlas();
    }
    frames.push({ id: item.id, atlasIndex, x, y, w: item.w, h: item.h });
    x += item.w + FRAME_GAP;
    rowH = Math.max(rowH, item.h);
    usedW = Math.max(usedW, x - FRAME_GAP);
    usedH = Math.max(usedH, y + rowH);
  }
  atlasSizes.push({ w: Math.max(1, usedW), h: Math.max(1, usedH) });
  return { frames, atlasSizes };
}
