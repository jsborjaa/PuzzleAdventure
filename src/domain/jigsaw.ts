import { computeGrid } from './grid';
import { makePieceId, type PieceId } from './pieceId';
import { hashSeed, SeededRng } from './rng';

export type EdgeShape = -1 | 0 | 1;

export interface PieceShapes {
  top: EdgeShape;
  right: EdgeShape;
  bottom: EdgeShape;
  left: EdgeShape;
}

export interface JigsawPieceDef {
  id: PieceId;
  col: number;
  row: number;
  shapes: PieceShapes;
  srcX: number;
  srcY: number;
  srcW: number;
  srcH: number;
}

export interface JigsawLayout {
  levelId: string;
  cols: number;
  rows: number;
  pieceWidth: number;
  pieceHeight: number;
  tabSize: number;
  seed: number;
  imageWidth: number;
  imageHeight: number;
  pieces: JigsawPieceDef[];
}

export function buildJigsawLayout(
  levelId: string,
  imageWidth: number,
  imageHeight: number,
  pieceCount: number,
): JigsawLayout {
  const { cols, rows, pieceWidth, pieceHeight } = computeGrid(imageWidth, imageHeight, pieceCount);
  const seed = hashSeed(`${levelId}:${cols}x${rows}:${Math.round(imageWidth)}x${Math.round(imageHeight)}`);
  const rng = new SeededRng(seed);

  const horizontal: EdgeShape[][] = Array.from({ length: cols }, () => Array<EdgeShape>(rows + 1).fill(0));
  const vertical: EdgeShape[][] = Array.from({ length: cols + 1 }, () => Array<EdgeShape>(rows).fill(0));

  for (let c = 0; c < cols; c++) {
    for (let r = 1; r < rows; r++) {
      horizontal[c][r] = rng.nextBool() ? 1 : -1;
    }
  }
  for (let c = 1; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      vertical[c][r] = rng.nextBool() ? 1 : -1;
    }
  }

  const tabSize = Math.min(pieceWidth, pieceHeight) * 0.25;
  const pieces: JigsawPieceDef[] = [];

  for (let col = 0; col < cols; col++) {
    for (let row = 0; row < rows; row++) {
      pieces.push({
        id: makePieceId(levelId, col, row),
        col,
        row,
        shapes: {
          top: (-horizontal[col][row]) as EdgeShape,
          right: vertical[col + 1][row],
          bottom: horizontal[col][row + 1],
          left: (-vertical[col][row]) as EdgeShape,
        },
        srcX: col * pieceWidth,
        srcY: row * pieceHeight,
        srcW: pieceWidth,
        srcH: pieceHeight,
      });
    }
  }

  return {
    levelId,
    cols,
    rows,
    pieceWidth,
    pieceHeight,
    tabSize,
    seed,
    imageWidth,
    imageHeight,
    pieces,
  };
}
