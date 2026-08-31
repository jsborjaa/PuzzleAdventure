export type PieceId = `${string}:${number}:${number}`;

export function makePieceId(levelId: string, col: number, row: number): PieceId {
  return `${levelId}:${col}:${row}`;
}

export function parsePieceId(id: PieceId): { levelId: string; col: number; row: number } {
  const last = id.lastIndexOf(':');
  const mid = id.lastIndexOf(':', last - 1);
  const levelId = id.slice(0, mid);
  const col = Number(id.slice(mid + 1, last));
  const row = Number(id.slice(last + 1));
  return { levelId, col, row };
}
