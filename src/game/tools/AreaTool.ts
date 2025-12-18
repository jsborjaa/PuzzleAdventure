import { SelectionTool } from './SelectionTool';
import { Piece } from '../../objects/Piece';
import { AudioService } from '../../services/AudioService';

export class AreaTool extends SelectionTool {
    
    // gridSize passed to super. 3 for Area, 4 for SuperArea.

    protected confirmSelection(pointer: Phaser.Input.Pointer): void {
        const pieces = this.board.getPieces();
        if (pieces.length === 0) return;

        const pieceW = pieces[0].logicalWidth;
        const pieceH = pieces[0].logicalHeight;
        
        const container = this.board.getContainer();
        const boardX = container.x;
        const boardY = container.y;
        const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;

        const relX = worldPoint.x - boardX;
        const relY = worldPoint.y - boardY;

        // Compute intended start based on pointer (centered box)
        const centerCol = Math.floor(relX / pieceW);
        const centerRow = Math.floor(relY / pieceH);
        const rawStartCol = this.gridSize > 1 ? centerCol - 1 : centerCol;
        const rawStartRow = this.gridSize > 1 ? centerRow - 1 : centerRow;

        // World-space box for the selection (may extend outside board)
        const boxLeft = boardX + rawStartCol * pieceW;
        const boxTop = boardY + rawStartRow * pieceH;
        const boxRight = boxLeft + this.gridSize * pieceW;
        const boxBottom = boxTop + this.gridSize * pieceH;

        // Board bounds
        const boardRight = boardX + this.board.boardWidth;
        const boardBottom = boardY + this.board.boardHeight;

        // If no intersection with board, do nothing
        const noOverlap = boxRight <= boardX || boxLeft >= boardRight || boxBottom <= boardY || boxTop >= boardBottom;
        if (noOverlap) return;

        // Grid bounds from pieces
        const maxCol = Math.max(...pieces.map(p => p.gridCol));
        const maxRow = Math.max(...pieces.map(p => p.gridRow));

        // Clamp selection to board to find the overlapping cells
        const startCol = Math.max(0, rawStartCol);
        const startRow = Math.max(0, rawStartRow);
        const endCol = Math.min(rawStartCol + this.gridSize - 1, maxCol);
        const endRow = Math.min(rawStartRow + this.gridSize - 1, maxRow);

        // If no overlap with the board, do nothing
        if (endCol < startCol || endRow < startRow) {
            return;
        }

        const selectedPieces = pieces.filter(p => 
            !p.isSolved && 
            p.gridCol >= startCol && p.gridCol <= endCol &&
            p.gridRow >= startRow && p.gridRow <= endRow
        );

        if (selectedPieces.length > 0) {
            const selWidthCols = endCol - startCol + 1;
            const selHeightRows = endRow - startRow + 1;
            const selRect = {
              x: boardX + startCol * pieceW,
              y: boardY + startRow * pieceH,
              w: selWidthCols * pieceW,
              h: selHeightRows * pieceH,
            };
            const centerX = selRect.x + selRect.w / 2;
            const centerY = selRect.y + selRect.h / 2;

            this.groupPieces(selectedPieces, centerX, centerY, pieceW, pieceH, boardX, boardY, selRect);
            // Consume power-up based on size
            const key = this.gridSize === 4 ? 'sarea' : 'area';
            this.scene.events.emit('powerup-used', key);
        }
    }

    private groupPieces(pieces: Piece[], centerSelX: number, centerSelY: number, pieceW: number, pieceH: number, boardX: number, boardY: number, selRect: { x: number, y: number, w: number, h: number }) {
         // Try to place near the selected area, prioritizing free spots
         const allPieces = this.board.getPieces();
         const maxCol = Math.max(...allPieces.map(p => p.gridCol));
         const maxRow = Math.max(...allPieces.map(p => p.gridRow));
         const totalWidth = (maxCol + 1) * pieceW;
         const totalHeight = (maxRow + 1) * pieceH;

         // Start from center of selected area
         let targetX = centerSelX;
         let targetY = centerSelY;

         // Search for a nearby free spot (outside selected area) with increasing radius
         const selectedSet = new Set(pieces.map(p => p)); // For quick lookup
         const occupied = allPieces.filter(p => !selectedSet.has(p) && !p.isSolved);

         const isFree = (x: number, y: number) => {
           const radius = Math.max(pieceW, pieceH) * 0.8;
           return !occupied.some(p => Phaser.Math.Distance.Between(p.x, p.y, x, y) < radius);
         };

         const baseRadius = Math.max(selRect.w, selRect.h) * 0.5 + Math.max(pieceW, pieceH) * 1.5;
         const radii = [baseRadius, baseRadius + 120, baseRadius + 200, baseRadius + 260, baseRadius + 320];
         let found = false;
         for (const r of radii) {
           if (found) break;
           const angles = [0, 60, 120, 180, 240, 300];
           for (const deg of angles) {
             const rad = Phaser.Math.DegToRad(deg);
             const cx = centerSelX + Math.cos(rad) * r;
             const cy = centerSelY + Math.sin(rad) * r;
             // keep inside screen margins
             const margin = 50;
             const cxClamped = Phaser.Math.Clamp(cx, margin, this.scene.scale.width - margin);
             const cyClamped = Phaser.Math.Clamp(cy, margin, this.scene.scale.height - margin);
             const insideSel = cxClamped >= selRect.x && cxClamped <= selRect.x + selRect.w && cyClamped >= selRect.y && cyClamped <= selRect.y + selRect.h;
             if (!insideSel && isFree(cxClamped, cyClamped)) {
               targetX = cxClamped;
               targetY = cyClamped;
               found = true;
               break;
             }
           }
         }

         if (!found) {
           // fallback: use projected outwards
           const centerX = boardX + totalWidth / 2;
           const centerY = boardY + totalHeight / 2;
           let vecX = centerSelX - centerX;
           let vecY = centerSelY - centerY;
           const len = Math.sqrt(vecX*vecX + vecY*vecY);
           const pushDist = Math.max(totalWidth, totalHeight) * 0.6 + 100; 
           if (len === 0) {
             targetX = centerX + pushDist;
             targetY = centerY;
           } else {
             targetX = centerX + (vecX / len) * pushDist;
             targetY = centerY + (vecY / len) * pushDist;
           }
           const margin = 50;
           targetX = Phaser.Math.Clamp(targetX, margin, this.scene.scale.width - margin);
           targetY = Phaser.Math.Clamp(targetY, margin, this.scene.scale.height - margin);
         }

         // Animation
         AudioService.getInstance().playPop();
         let completedTweens = 0;

         pieces.forEach((p) => {
            p.setDepth(100);
            const offsetX = Phaser.Math.Between(-50, 50);
            const offsetY = Phaser.Math.Between(-50, 50);

            this.scene.tweens.add({
                targets: p,
                x: targetX + offsetX,
                y: targetY + offsetY,
                duration: 500,
                ease: 'Cubic.out',
                onComplete: () => {
                    p.setDepth(1);
                    completedTweens++;
                    if (completedTweens === pieces.length) {
                        this.saveSession();
                    }
                }
            });
         });
    }

    private saveSession() {
         // Hack: Invoke save on GameScene? Or move save logic to ProgressService purely?
         // GameScene has `saveGameSession`. We should probably expose it or move it.
         // For now, let's emit an event that GameScene listens to.
         this.scene.events.emit('request-save');
    }
}

