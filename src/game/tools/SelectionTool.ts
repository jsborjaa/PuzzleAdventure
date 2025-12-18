import { AbstractTool } from './AbstractTool';
import { PuzzleBoard } from '../board/PuzzleBoard';
import { Scene } from 'phaser';

export class SelectionTool extends AbstractTool {
    protected selectionGraphics: Phaser.GameObjects.Graphics;
    protected previewImage: Phaser.GameObjects.Image | null = null;
    protected gridSize: number; // 1 for 1x1, 3 for 3x3, 4 for 4x4

    constructor(scene: Scene, board: PuzzleBoard, gridSize: number = 1) {
        super(scene, board);
        this.gridSize = gridSize;
        
        this.selectionGraphics = this.scene.add.graphics();
        this.selectionGraphics.setDepth(2000);
        this.selectionGraphics.setVisible(false);
    }

    protected onActivate(): void {
        this.selectionGraphics.setVisible(true);
        this.scene.sys.canvas.style.cursor = 'crosshair';
        
        // If pointer is already down/active, update immediately
        const pointer = this.scene.input.activePointer;
        if (pointer) {
            this.updateGraphics(pointer);
        }
    }

    protected onDeactivate(): void {
        this.selectionGraphics.clear();
        this.selectionGraphics.setVisible(false);
        if (this.previewImage) {
            this.previewImage.setVisible(false);
        }
        this.scene.sys.canvas.style.cursor = 'default';
    }

    public onPointerMove(pointer: Phaser.Input.Pointer): void {
        this.updateGraphics(pointer);
    }

    public onPointerUp(pointer: Phaser.Input.Pointer): void {
        // To be implemented by subclasses or handle generic logic
        this.confirmSelection(pointer);
        // Usually tools deactivate after use or stay active? 
        // In original code: "deactivate-area-drag" calls confirm and resets modes.
        // So we should deactivate self.
        this.deactivate();
    }

    protected updateGraphics(pointer: Phaser.Input.Pointer): void {
        this.selectionGraphics.clear();
        
        const pieces = this.board.getPieces();
        if (pieces.length === 0) return;

        const pieceW = pieces[0].logicalWidth;
        const pieceH = pieces[0].logicalHeight;
        const maxCol = Math.max(...pieces.map(p => p.gridCol));
        const maxRow = Math.max(...pieces.map(p => p.gridRow));
        
        const container = this.board.getContainer();
        const boardX = container.x;
        const boardY = container.y;
        
        const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
        const relX = worldPoint.x - boardX;
        const relY = worldPoint.y - boardY;

        // Si el cursor está fuera del área del rompecabezas, ocultar el preview/resaltado.
        // (Además evita la confusión de ver un cuadro "clampado" en borde cuando en realidad estás fuera)
        const insideBoard =
          relX >= 0 &&
          relY >= 0 &&
          relX <= this.board.boardWidth &&
          relY <= this.board.boardHeight;
        if (!insideBoard) {
            if (this.previewImage) this.previewImage.setVisible(false);
            return;
        }
        
        const col = Math.floor(relX / pieceW);
        const row = Math.floor(relY / pieceH);
        
        // Mantener el cuadro completo dentro del tablero para evitar recortes parciales
        const rawStartCol = this.gridSize > 1 ? col - Math.floor(this.gridSize / 2) : col;
        const rawStartRow = this.gridSize > 1 ? row - Math.floor(this.gridSize / 2) : row;
        const maxStartCol = Math.max(0, maxCol - (this.gridSize - 1));
        const maxStartRow = Math.max(0, maxRow - (this.gridSize - 1));
        const startCol = Phaser.Math.Clamp(rawStartCol, 0, maxStartCol);
        const startRow = Phaser.Math.Clamp(rawStartRow, 0, maxStartRow);

        const drawX = boardX + startCol * pieceW;
        const drawY = boardY + startRow * pieceH;
        const width = pieceW * this.gridSize;
        const height = pieceH * this.gridSize;

        this.selectionGraphics.fillStyle(0xffff00, 0.3);
        this.selectionGraphics.lineStyle(2, 0xffff00, 0.8);
        this.selectionGraphics.fillRect(drawX, drawY, width, height);
        this.selectionGraphics.strokeRect(drawX, drawY, width, height);

        this.updatePreview(startCol, startRow, pieceW, pieceH, width, height);
    }

    protected updatePreview(gridCol: number, gridRow: number, pieceW: number, pieceH: number, width: number, height: number): void {
        // We need the image key. 
        // Hack: Get it from the board's bgHint or store it. 
        // Better: Add getImageKey() to PuzzleBoard.
        // For now, let's look it up from LEVELS via GameScene context if possible, 
        // or just peek at the first piece texture?
        // Pieces use textures like "image_0_0". The main image is "imageKey".
        // Let's assume we can get it from the guide image name?
        // The guide image is named 'guide_image'.
        
        const guide = this.board.getContainer().getByName('guide_image') as Phaser.GameObjects.Image;
        if (!guide) return;
        const imageKey = guide.texture.key;

        if (!this.previewImage) {
            this.previewImage = this.scene.add.image(0, 0, imageKey);
            this.previewImage.setOrigin(0, 0);
            this.previewImage.setAlpha(0.6);
            this.previewImage.setDepth(2001);
        } else if (this.previewImage.texture.key !== imageKey) {
            this.previewImage.setTexture(imageKey);
        }

        const container = this.board.getContainer();
        this.previewImage.setVisible(true);
        this.previewImage.setPosition(container.x, container.y);

        // Board logical size (from pieces)
        const pieces = this.board.getPieces();
        if (pieces.length === 0) return;
        const maxCol = Math.max(...pieces.map(p => p.gridCol)) + 1;
        const maxRow = Math.max(...pieces.map(p => p.gridRow)) + 1;
        const boardW = maxCol * pieceW;
        const boardH = maxRow * pieceH;

        const cropX = gridCol * pieceW;
        const cropY = gridRow * pieceH;
        const cropW = width;
        const cropH = height;

        // Clamp crop to board bounds so we only show the portion that overlaps the board
        const visibleX = Math.max(0, cropX);
        const visibleY = Math.max(0, cropY);
        const visibleW = Math.max(0, Math.min(cropX + cropW, boardW) - visibleX);
        const visibleH = Math.max(0, Math.min(cropY + cropH, boardH) - visibleY);

        if (visibleW <= 0 || visibleH <= 0) {
            this.previewImage.setVisible(false);
            return;
        }

        this.previewImage.setVisible(true);
        this.previewImage.setCrop(visibleX, visibleY, visibleW, visibleH);
    }

    protected confirmSelection(_pointer: Phaser.Input.Pointer): void {
        // Override me
    }
}

