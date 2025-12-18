import { Scene } from 'phaser';

export interface PuzzlePieceConfig {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  textureKey: string;
}

export class ImageSplitter {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public splitImage(imageKey: string, piecesAmount: number): PuzzlePieceConfig[] {
    const texture = this.scene.textures.get(imageKey);
    const sourceImage = texture.getSourceImage() as HTMLImageElement;
    
    const imgWidth = sourceImage.width;
    const imgHeight = sourceImage.height;

    const ratio = imgWidth / imgHeight;
    const cols = Math.round(Math.sqrt(piecesAmount * ratio));
    const rows = Math.round(piecesAmount / cols);
    
    const pieceWidth = imgWidth / cols;
    const pieceHeight = imgHeight / rows;

    console.log(`Generating Puzzle: ${cols}x${rows} = ${cols*rows} pieces`);

    const pieces: PuzzlePieceConfig[] = [];

    // We need consistent random shapes for shared edges.
    // We can store them in arrays.
    // horizontalShapes[col][row] = Shape of the TOP edge of piece (col, row).
    // This means horizontalShapes[col][row+1] is the shape of the BOTTOM edge of piece (col, row).
    // We need indices 0 to rows. 0 is Top Border. rows is Bottom Border.
    const horizontalShapes: number[][] = Array(cols).fill(0).map(() => Array(rows + 1).fill(0));
    
    // verticalShapes[col][row] = Shape of the LEFT edge of piece (col, row).
    // verticalShapes[col+1][row] = Shape of the RIGHT edge of piece (col, row).
    // Indices 0 to cols.
    const verticalShapes: number[][] = Array(cols + 1).fill(0).map(() => Array(rows).fill(0));

    // Fill internal Horizontal edges (indices 1 to rows-1)
    for (let c = 0; c < cols; c++) {
      for (let r = 1; r < rows; r++) {
        horizontalShapes[c][r] = Math.random() > 0.5 ? 1 : -1;
      }
    }

    // Fill internal Vertical edges (indices 1 to cols-1)
    for (let c = 1; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        verticalShapes[c][r] = Math.random() > 0.5 ? 1 : -1;
      }
    }

    const tabSize = Math.min(pieceWidth, pieceHeight) * 0.25; 
    
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        // Usar un canvas nuevo por pieza para evitar que todas compartan la misma referencia
        // y terminen sobrescribiendo sus formas/texturas.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        
        // Shape retrieval logic:
        // 1 = Outwards (Bump) relative to the drawing direction?
        // Let's redefine strictly:
        // The array value (1 or -1) defines the shape relative to the POSITIVE Axis direction of the grid.
        // Horizontal Edge (Row r): Perpendicular is Vertical. Positive is Down. 
        // Value 1 means Bump DOWN. Value -1 means Bump UP.
        
        // Top Edge of Piece(c,r) is Edge(c,r).
        // We draw Top L->R.
        // "Out" is UP (Negative Y).
        // If Edge(c,r) is 1 (Bump DOWN / In), then Top Shape should be "In".
        // If Edge(c,r) is -1 (Bump UP / Out), then Top Shape should be "Out".
        // So shape = -horizontalShapes[c][r].

        // Bottom Edge of Piece(c,r) is Edge(c,r+1).
        // We draw Bottom R->L.
        // "Out" is DOWN (Positive Y).
        // If Edge(c,r+1) is 1 (Bump DOWN / Out), then Bottom Shape should be "Out".
        // shape = horizontalShapes[c][r+1].

        // Left Edge of Piece(c,r) is Edge(c,r).
        // We draw Left B->T.
        // "Out" is LEFT (Negative X).
        // Edge(c,r) is Vertical Edge at column c.
        // Value 1 means Bump RIGHT (Positive X).
        // If Edge is 1 (Bump Right / In), Left Shape is "In".
        // If Edge is -1 (Bump Left / Out), Left Shape is "Out".
        // shape = -verticalShapes[c][r].

        // Right Edge of Piece(c,r) is Edge(c+1, r).
        // We draw Right T->B.
        // "Out" is RIGHT (Positive X).
        // If Edge is 1 (Bump Right / Out), Right Shape is "Out".
        // shape = verticalShapes[c+1][r].

        const shapes = {
          top: -horizontalShapes[col][row],
          right: verticalShapes[col + 1][row],
          bottom: horizontalShapes[col][row + 1],
          left: -verticalShapes[col][row]
        };

        // Debug check: Ensure internals are not 0
        if (row > 0 && shapes.top === 0) console.warn(`Piece ${col},${row} has FLAT TOP but is internal!`);
        if (row < rows-1 && shapes.bottom === 0) console.warn(`Piece ${col},${row} has FLAT BOTTOM but is internal!`);
        if (col > 0 && shapes.left === 0) console.warn(`Piece ${col},${row} has FLAT LEFT but is internal!`);
        if (col < cols-1 && shapes.right === 0) console.warn(`Piece ${col},${row} has FLAT RIGHT but is internal!`);

        const pieceTextureKey = `piece_${imageKey}_${col}_${row}`;
        
        canvas.width = pieceWidth + tabSize * 2;
        canvas.height = pieceHeight + tabSize * 2;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        
        ctx.translate(tabSize, tabSize);

        this.drawPiecePath(ctx, pieceWidth, pieceHeight, tabSize, shapes);
        
        ctx.clip();

        ctx.drawImage(
          sourceImage,
          col * pieceWidth - tabSize,
          row * pieceHeight - tabSize,
          pieceWidth + tabSize * 2,
          pieceHeight + tabSize * 2,
          -tabSize, 
          -tabSize,
          pieceWidth + tabSize * 2,
          pieceHeight + tabSize * 2
        );

        ctx.restore();

        // Outline
        ctx.save();
        ctx.translate(tabSize, tabSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth = 2;
        this.drawPiecePath(ctx, pieceWidth, pieceHeight, tabSize, shapes);
        ctx.stroke();
        
        // Inner Highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1;
        this.drawPiecePath(ctx, pieceWidth, pieceHeight, tabSize, shapes);
        ctx.stroke();

        ctx.restore();

        this.scene.textures.addCanvas(pieceTextureKey, canvas);

        pieces.push({
          row,
          col,
          x: col * pieceWidth,
          y: row * pieceHeight,
          width: pieceWidth,
          height: pieceHeight,
          textureKey: pieceTextureKey
        });
      }
    }

    return pieces;
  }

  private drawPiecePath(
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    tabSize: number, 
    shapes: { top: number, right: number, bottom: number, left: number }
  ) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    
    this.drawSide(ctx, 0, 0, width, 0, shapes.top, tabSize); // Top
    this.drawSide(ctx, width, 0, width, height, shapes.right, tabSize); // Right
    this.drawSide(ctx, width, height, 0, height, shapes.bottom, tabSize); // Bottom
    this.drawSide(ctx, 0, height, 0, 0, shapes.left, tabSize); // Left

    ctx.closePath();
  }

  private drawSide(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    shape: number,
    tabSize: number
  ) {
    if (shape === 0) {
      ctx.lineTo(x2, y2);
      return;
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    
    // Unit vectors
    const ux = dx / len;
    const uy = dy / len;
    
    // Normal vector (Left)
    const nx = -uy;
    const ny = ux;

    // Height of the tab
    const h = shape * tabSize; 
    
    // Center of the side
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    
    // Neck width: Fixed relative to tabSize to ensure consistent shape
    // regardless of side length.
    // A standard tab neck is roughly equal to the tab height.
    const neckHalfW = Math.abs(tabSize) * 0.20; 
    const headHalfW = Math.abs(tabSize) * 0.60;

    // Control Point Offsets
    const cpOut = h * 1.1; // Control point height (slightly higher than tip)
    const cpNeck = h * 0.2; // Control point for neck shoulder

    // Points relative to Center and Unit Vectors
    // P_NeckStart
    const pNeckStart = { x: cx - ux * neckHalfW * 2.5, y: cy - uy * neckHalfW * 2.5 };
    const pNeckEnd = { x: cx + ux * neckHalfW * 2.5, y: cy + uy * neckHalfW * 2.5 };
    
    // Start drawing from current pos (x1,y1) to Neck Start
    ctx.lineTo(pNeckStart.x, pNeckStart.y);
    
    // Bezier 1: Left Shoulder to Tip
    // CP1: Neck Base (slightly out)
    // CP2: Tip Left (High)
    // P3: Tip (Center)
    
    ctx.bezierCurveTo(
        pNeckStart.x + nx * cpNeck, pNeckStart.y + ny * cpNeck, 
        cx - ux * headHalfW + nx * cpOut, cy - uy * headHalfW + ny * cpOut, 
        cx + nx * h, cy + ny * h
    );

    // Bezier 2: Tip to Right Shoulder
    // CP3: Tip Right (High)
    // CP4: Neck Base (slightly out)
    // P5: Neck End
    
    ctx.bezierCurveTo(
        cx + ux * headHalfW + nx * cpOut, cy + uy * headHalfW + ny * cpOut, 
        pNeckEnd.x + nx * cpNeck, pNeckEnd.y + ny * cpNeck,
        pNeckEnd.x, pNeckEnd.y
    );
    
    // Line to end
    ctx.lineTo(x2, y2);
  }
}
