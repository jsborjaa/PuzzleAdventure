import { Scene } from 'phaser';
import { PuzzleBoard } from '../board/PuzzleBoard';

export abstract class AbstractTool {
    protected scene: Scene;
    protected board: PuzzleBoard;
    protected isActive: boolean = false;

    constructor(scene: Scene, board: PuzzleBoard) {
        this.scene = scene;
        this.board = board;
    }

    public activate(): void {
        this.isActive = true;
        this.onActivate();
    }

    public deactivate(): void {
        this.isActive = false;
        this.onDeactivate();
    }

    // Hooks for subclasses
    protected onActivate(): void {}
    protected onDeactivate(): void {}

    // Input Handlers
    public onPointerDown(_pointer: Phaser.Input.Pointer): void {}
    public onPointerMove(_pointer: Phaser.Input.Pointer): void {}
    public onPointerUp(_pointer: Phaser.Input.Pointer): void {}
}

