export interface GridSize {
  cols: number;
  rows: number;
  pieceWidth: number;
  pieceHeight: number;
}

export function computeGrid(imageWidth: number, imageHeight: number, pieceCount: number): GridSize {
  const ratio = imageWidth / imageHeight;
  const cols = Math.max(1, Math.round(Math.sqrt(pieceCount * ratio)));
  const rows = Math.max(1, Math.round(pieceCount / cols));
  return {
    cols,
    rows,
    pieceWidth: imageWidth / cols,
    pieceHeight: imageHeight / rows,
  };
}

export function worldToCell(
  worldX: number,
  worldY: number,
  boardX: number,
  boardY: number,
  boardWidth: number,
  boardHeight: number,
  pieceWidth: number,
  pieceHeight: number,
): { col: number; row: number } | null {
  const relX = worldX - boardX;
  const relY = worldY - boardY;
  if (relX < 0 || relY < 0 || relX > boardWidth || relY > boardHeight) return null;
  return {
    col: Math.floor(relX / pieceWidth),
    row: Math.floor(relY / pieceHeight),
  };
}

export function clampSelection(
  centerCol: number,
  centerRow: number,
  size: number,
  cols: number,
  rows: number,
): { startCol: number; startRow: number; endCol: number; endRow: number } {
  const rawStartCol = size > 1 ? centerCol - Math.floor(size / 2) : centerCol;
  const rawStartRow = size > 1 ? centerRow - Math.floor(size / 2) : centerRow;
  const maxStartCol = Math.max(0, cols - size);
  const maxStartRow = Math.max(0, rows - size);
  const startCol = Math.min(Math.max(rawStartCol, 0), maxStartCol);
  const startRow = Math.min(Math.max(rawStartRow, 0), maxStartRow);
  return {
    startCol,
    startRow,
    endCol: startCol + size - 1,
    endRow: startRow + size - 1,
  };
}

export function deviceMemoryGb(): number | undefined {
  if (typeof navigator === 'undefined') return undefined;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof mem === 'number' ? mem : undefined;
}
