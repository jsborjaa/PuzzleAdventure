export function isWon(pieces: Iterable<{ isSolved: boolean }>): boolean {
  let count = 0;
  for (const piece of pieces) {
    count += 1;
    if (!piece.isSolved) return false;
  }
  return count > 0;
}

export function countSolved(pieces: Iterable<{ isSolved: boolean }>): { solved: number; total: number } {
  let solved = 0;
  let total = 0;
  for (const piece of pieces) {
    total += 1;
    if (piece.isSolved) solved += 1;
  }
  return { solved, total };
}
