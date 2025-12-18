import { SelectionTool } from './SelectionTool';
import { Piece } from '../../objects/Piece';
import { AudioService } from '../../services/AudioService';

export class HintTool extends SelectionTool {
    
    constructor(scene: Phaser.Scene, board: any) {
        super(scene, board, 1); // Always 1x1
    }

    protected onActivate(): void {
        super.onActivate();
        this.scene.sys.canvas.style.cursor = 'help';
    }

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
        
        if (relX < 0 || relX > this.board.boardWidth || relY < 0 || relY > this.board.boardHeight) {
            return;
        }
        
        const col = Math.floor(relX / pieceW);
        const row = Math.floor(relY / pieceH);
        
        // 1. Check if there is a solved piece here
        const solvedPiece = pieces.find(p => p.isSolved && p.gridCol === col && p.gridRow === row);
        if (solvedPiece) {
            this.showNeighborHint(solvedPiece);
            return;
        }
        
        // 2. If empty, find the piece that belongs here
        const targetPiece = pieces.find(p => !p.isSolved && p.gridCol === col && p.gridRow === row);
        if (targetPiece) {
            this.solveSpecificPiece(targetPiece);
            return;
        }
    }

    private showNeighborHint(sourcePiece: Piece) {
        const pieces = this.board.getPieces();
        const neighbors = pieces.filter(p => !p.isSolved && 
            Phaser.Math.Distance.Between(p.correctX, p.correctY, sourcePiece.correctX, sourcePiece.correctY) < Math.max(p.width, p.height) * 1.2
        );
        
        if (neighbors.length > 0) {
            const target = Phaser.Math.RND.pick(neighbors);
            this.solveSpecificPiece(target);
        } else {
            // Flash source
            this.flashPiece(sourcePiece);
        }
    }

    private solveSpecificPiece(piece: Piece) {
        AudioService.getInstance().playSnap();
        piece.setDepth(1000);
        piece.disableInteractive();
        
        this.scene.tweens.add({
            targets: piece,
            x: piece.correctX,
            y: piece.correctY,
            angle: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => {
                // Replicate snap logic
                if (!piece.isSolved) {
                    // Use board method if available or manual
                    this.board.setPieceSolved(piece);
                    this.scene.events.emit('piece-placed');
                    this.scene.events.emit('request-save');
                    this.scene.events.emit('powerup-used', 'hint');
                }
            }
        });
    }

    private flashPiece(piece: Piece) {
        piece.setDepth(1000);
        this.scene.tweens.add({
            targets: piece,
            scale: 1.5,
            alpha: 1,
            duration: 300,
            yoyo: true,
            repeat: 3,
            onComplete: () => piece.setDepth(0) // Return to solved depth
        });
    }
}

