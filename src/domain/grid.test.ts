import { describe, expect, it } from 'vitest';
import { clampSelection, computeGrid, worldToCell } from './grid';

describe('grid', () => {
  it('computes a cols×rows grid from aspect ratio', () => {
    const g = computeGrid(800, 800, 16);
    expect(g.cols * g.rows).toBe(16);
    expect(g.pieceWidth).toBe(200);
  });

  it('maps world points to cells and rejects outside', () => {
    expect(worldToCell(350, 350, 250, 250, 800, 800, 200, 200)).toEqual({ col: 0, row: 0 });
    expect(worldToCell(10, 10, 250, 250, 800, 800, 200, 200)).toBeNull();
  });

  it('clamps a 3×3 selection inside the board', () => {
    expect(clampSelection(0, 0, 3, 4, 4)).toEqual({ startCol: 0, startRow: 0, endCol: 2, endRow: 2 });
    expect(clampSelection(3, 3, 3, 4, 4)).toEqual({ startCol: 1, startRow: 1, endCol: 3, endRow: 3 });
  });
});
