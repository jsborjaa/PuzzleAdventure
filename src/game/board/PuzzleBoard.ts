import { Scene } from 'phaser';
import { Piece } from '../../objects/Piece';
import { ImageSplitter } from '../../services/ImageSplitter';
import { getLevelById } from '../../core/Levels';
import { SnapSystem } from '../pieces/SnapSystem';
import { attachPieceInteraction, detachPieceInteraction } from '../pieces/PieceInteractionBehavior';
import { PuzzleLayerStack } from './PuzzleLayerStack';

export class PuzzleBoard {
    private scene: Scene;
    private boardContainer: Phaser.GameObjects.Container;
    private pieces: Piece[] = [];
    private piecesGroup: Phaser.GameObjects.Group;
    private splitter: ImageSplitter;
    private bgHint!: Phaser.GameObjects.Image;
    private border!: Phaser.GameObjects.Graphics;
    private layers: PuzzleLayerStack;
    private snapSystem: SnapSystem;
    
    public boardWidth: number = 0;
    public boardHeight: number = 0;
    
    constructor(scene: Scene) {
        this.scene = scene;
        this.splitter = new ImageSplitter(scene);
        this.boardContainer = this.scene.add.container(0, 0);
        this.layers = new PuzzleLayerStack(this.scene as any);
        // Tablero siempre debajo de las piezas: lo agregamos a su layer dedicada.
        this.layers.addBoard(this.boardContainer);
        // Asegurar que cuando una pieza encaje, también se mueva a la layer de resueltas.
        this.snapSystem = new SnapSystem(this.scene, {
            onSolved: (piece) => this.layers.moveToSolved(piece),
        });
        this.piecesGroup = this.scene.add.group();
    }

    public initialize(levelId: string): void {
        const levelConfig = getLevelById(levelId);
        if (!levelConfig) {
            console.error('Level config not found!');
            return;
        }

        const imageKey = levelConfig.imageKey;
        const img = this.scene.textures.get(imageKey).getSourceImage();
        this.boardWidth = img.width;
        this.boardHeight = img.height;

        // Setup Board UI
        this.setupBoardUI(imageKey);
        
        // Center container
        this.boardContainer.setPosition(
            (this.scene.scale.width - this.boardWidth) / 2, 
            (this.scene.scale.height - this.boardHeight) / 2
        );
    }

    private setupBoardUI(imageKey: string): void {
        // Background Hint
        this.bgHint = this.scene.add.image(0, 0, imageKey);
        this.bgHint.setAlpha(0);
        this.bgHint.setOrigin(0, 0);
        this.bgHint.setName('guide_image');
        this.boardContainer.add(this.bgHint);

        // Border
        this.border = this.scene.add.graphics();
        this.border.lineStyle(4, 0x666666, 0.8);
        this.border.strokeRect(0, 0, this.boardWidth, this.boardHeight);
        this.boardContainer.add(this.border);
    }

    public createPieces(levelId: string, loadFromSession: boolean, loadSolved: boolean, sessionPieces?: any[]): Piece[] {
        const levelConfig = getLevelById(levelId);
        if (!levelConfig) return [];

        this.clearPieces();
        
        const difficulty = levelConfig.difficulty;
        const imageKey = levelConfig.imageKey;
        const pieceConfigs = this.splitter.splitImage(imageKey, difficulty);
        const maxRow = Math.max(...pieceConfigs.map(c => c.row));
        const maxCol = Math.max(...pieceConfigs.map(c => c.col));

        pieceConfigs.forEach((config, index) => {
             const worldCorrectX = this.boardContainer.x + config.x + config.width/2; 
             const worldCorrectY = this.boardContainer.y + config.y + config.height/2;
       
             const finalConfig = {
               ...config,
               x: worldCorrectX,
               y: worldCorrectY
             };
       
             const piece = new Piece(this.scene, finalConfig);
             // Piezas en coordenadas de mundo (NO Containers). Layers reales (Layer) para separar.
             this.layers.addToActive(piece);
             
             // Mark edges
             if (config.row === 0 || config.row === maxRow || config.col === 0 || config.col === maxCol) {
                 piece.isEdge = true;
             }
             
             // State Restoration
             if (loadFromSession && sessionPieces && sessionPieces[index]) {
                 const state = sessionPieces[index];
                 piece.x = state.x;
                 piece.y = state.y;
                 piece.angle = state.angle;
                 if (state.isSolved) {
                     this.setPieceSolved(piece, true);
                     this.layers.moveToSolved(piece);
                 } else {
                     this.layers.moveToActive(piece);
                     attachPieceInteraction(this.scene, piece, { snapSystem: this.snapSystem, rotateRightClick: true });
                 }
             } else if (loadSolved) {
                 piece.x = piece.correctX;
                 piece.y = piece.correctY;
                 piece.angle = 0;
                 this.setPieceSolved(piece, false); // False to skip sound/event? Or handle separately.
                 // Actually setPieceSolved might trigger events. Let's do it manually for loadSolved to avoid spam.
                 piece.isSolved = true;
                 piece.disableInteractive();
                 this.layers.moveToSolved(piece);
                 piece.setTint(0xffffff);
             } else {
                 // Scatter
                 this.scatterPiece(piece);
                 attachPieceInteraction(this.scene, piece, { snapSystem: this.snapSystem, rotateRightClick: true });
             }
             
             this.pieces.push(piece);
             this.piecesGroup.add(piece);
        });

        return this.pieces;
    }

    public setPieceSolved(piece: Piece, _animate: boolean = true): void {
        piece.isSolved = true;
        piece.disableInteractive();
        this.layers.moveToSolved(piece);
        piece.setTint(0xddffdd); // Solved tint
    }

    private scatterPiece(piece: Piece): void {
        const scrW = this.scene.scale.width;
        const scrH = this.scene.scale.height;
        
        // Define simple scatter logic or reuse the one from GameScene
        // Reusing Logic:
        const boardRect = new Phaser.Geom.Rectangle(
            this.boardContainer.x,
            this.boardContainer.y,
            this.boardWidth,
            this.boardHeight
        );

        const margin = 80; 
        const validZones = [];
        if (boardRect.top > margin) validZones.push(0);
        if (scrW - boardRect.right > margin) validZones.push(1);
        if (scrH - boardRect.bottom > margin) validZones.push(2);
        if (boardRect.left > margin) validZones.push(3);

        const zone = validZones.length > 0 
            ? Phaser.Math.RND.pick(validZones) 
            : Phaser.Math.Between(0, 3);

        let minX = 0, maxX = scrW, minY = 0, maxY = scrH;

        switch (zone) {
            case 0: // Top
                minX = 50; maxX = scrW - 50; minY = 50; maxY = boardRect.top - 50;
                break;
            case 1: // Right
                minX = boardRect.right + 50; maxX = scrW - 50; minY = 50; maxY = scrH - 50;
                break;
            case 2: // Bottom
                minX = 50; maxX = scrW - 50; minY = boardRect.bottom + 50; maxY = scrH - 50;
                break;
            case 3: // Left
                minX = 50; maxX = boardRect.left - 50; minY = 50; maxY = scrH - 50;
                break;
        }
        
        if (minX > maxX || minY > maxY) {
            minX = 0; maxX = scrW; minY = 0; maxY = scrH;
        }

        piece.x = Phaser.Math.Between(minX, maxX);
        piece.y = Phaser.Math.Between(minY, maxY);
        piece.angle = Phaser.Math.RND.pick([0, 90, 180, 270]);
    }

    public clearPieces(): void {
        this.pieces.forEach(p => p.destroy());
        this.pieces = [];
        this.piecesGroup.clear(true, true);
    }

    public getPieces(): Piece[] {
        return this.pieces;
    }

    /** Mueve una pieza al overlay render (por encima de board/solved/active). */
    public movePieceToOverlay(piece: Piece): void {
        this.layers.addToOverlay(piece);
    }

    /** Devuelve una pieza a su layer normal (solved vs active) según su estado actual. */
    public restorePieceLayer(piece: Piece): void {
        this.layers.removeFromOverlay(piece);
        if (piece.isSolved) {
            this.layers.moveToSolved(piece);
        } else {
            this.layers.moveToActive(piece);
        }
    }

    /**
     * Re-activa la interacción estándar del tablero (drag/rotación + snap al tablero)
     * para una pieza existente. Útil cuando una pieza vuelve desde el bolsillo.
     */
    public enablePieceInteraction(piece: Piece): void {
        // Si viene de otro modo (p.ej. bolsillo), puede tener handlers distintos.
        // Reemplazamos la interacción para volver a la lógica estándar del tablero.
        detachPieceInteraction(piece);
        attachPieceInteraction(this.scene, piece, { snapSystem: this.snapSystem, rotateRightClick: true });
        piece.setInteractive({ draggable: true, useHandCursor: true });
        piece.setAlpha(1);
    }

    public getContainer(): Phaser.GameObjects.Container {
        return this.boardContainer;
    }

    public worldToGrid(worldX: number, worldY: number, pieceW: number, pieceH: number): { col: number, row: number } | null {
        const relX = worldX - this.boardContainer.x;
        const relY = worldY - this.boardContainer.y;

        if (relX < 0 || relX > this.boardWidth || relY < 0 || relY > this.boardHeight) {
            return null;
        }

        const col = Math.floor(relX / pieceW);
        const row = Math.floor(relY / pieceH);
        return { col, row };
    }

    public getGridToWorld(col: number, row: number, pieceW: number, pieceH: number): { x: number, y: number } {
        return {
            x: this.boardContainer.x + col * pieceW,
            y: this.boardContainer.y + row * pieceH
        };
    }
}

