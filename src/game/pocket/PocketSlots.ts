export interface PocketRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PocketSlotLayout {
  leftRect: PocketRect;
  rightRect: PocketRect;
  rows: number; // 4
  cols: number; // 2 per side
}

export class PocketSlots {
  private layout: PocketSlotLayout;

  constructor(layout: PocketSlotLayout) {
    this.layout = layout;
  }

  public getSlotIndexForSide(side: 'left' | 'right', idxInSide: number): number {
    return side === 'left' ? idxInSide : 8 + idxInSide;
  }

  public getSlotPosition(slotIndex: number): { x: number; y: number } {
    if (slotIndex < 0 || slotIndex > 15) {
      return { x: 0, y: 0 };
    }
    const isLeft = slotIndex < 8;
    const idxInSide = isLeft ? slotIndex : slotIndex - 8;
    const rect = isLeft ? this.layout.leftRect : this.layout.rightRect;

    const cols = this.layout.cols;
    const rows = this.layout.rows;
    const col = idxInSide % cols;
    const row = Math.floor(idxInSide / cols);

    const cellW = rect.w / cols;
    const cellH = rect.h / rows;

    return {
      x: rect.x + (col + 0.5) * cellW,
      y: rect.y + (row + 0.5) * cellH,
    };
  }
}


