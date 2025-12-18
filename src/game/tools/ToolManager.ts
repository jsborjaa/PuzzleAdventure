import { Scene } from 'phaser';
import { AbstractTool } from './AbstractTool';

export class ToolManager {
    private scene: Scene;
    private tools: Map<string, AbstractTool> = new Map();
    private currentTool: AbstractTool | null = null;
    private activeToolId: string | null = null;

    constructor(scene: Scene) {
        this.scene = scene;
        this.setupInputListeners();
    }

    public addTool(id: string, tool: AbstractTool): void {
        this.tools.set(id, tool);
    }

    public activateTool(id: string): void {
        // Deactivate current
        if (this.currentTool) {
            this.currentTool.deactivate();
        }

        // If selecting the same tool or 'NONE', just clear
        if (id === 'NONE' || (this.activeToolId === id && id !== 'NONE')) {
            this.currentTool = null;
            this.activeToolId = null;
            this.scene.sys.canvas.style.cursor = 'default';
            return;
        }

        const tool = this.tools.get(id);
        if (tool) {
            this.currentTool = tool;
            this.activeToolId = id;
            tool.activate();
        } else {
            console.warn(`Tool ${id} not found.`);
        }
    }

    public getActiveToolId(): string | null {
        return this.activeToolId;
    }

    private setupInputListeners(): void {
        this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.currentTool) this.currentTool.onPointerDown(pointer);
        });
        
        this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.currentTool) this.currentTool.onPointerMove(pointer);
        });

        this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
            if (this.currentTool) this.currentTool.onPointerUp(pointer);
        });
    }

    public destroy(): void {
        if (this.currentTool) {
            this.currentTool.deactivate();
        }
        this.tools.clear();
        this.scene.input.off('pointerdown');
        this.scene.input.off('pointermove');
        this.scene.input.off('pointerup');
    }
}

