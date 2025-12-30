import { Scene } from 'phaser';

export class CameraController {
    private scene: Scene;
    private enabled: boolean = true;
    private activePointers: Map<number, { isPanAllowed: boolean }> = new Map();
    private initialPinchDistance: number | null = null;
    private initialZoom: number = 1;

    constructor(scene: Scene) {
        this.scene = scene;
        // Ensure we have enough pointers for multi-touch (default is usually 2, but let's be safe)
        this.scene.input.addPointer(1);
        this.setupCamera();
        this.setupInput();
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        if (!enabled) {
            this.activePointers.clear();
            this.initialPinchDistance = null;
        }
    }

    private setupCamera(): void {
        this.scene.cameras.main.setBackgroundColor('#2f3542');
    }

    private setupInput(): void {
        this.scene.input.on('pointerdown', this.onPointerDown, this);
        this.scene.input.on('pointerup', this.onPointerUp, this);
        this.scene.input.on('pointerupoutside', this.onPointerUp, this);
        this.scene.input.on('pointermove', this.onPointerMove, this);
        this.scene.input.on('wheel', this.onWheel, this);
    }

    private onPointerDown(pointer: Phaser.Input.Pointer, gameObjects: any[]) {
        if (!this.enabled) return;

        // If we hit something interactive (pieces), we don't want to pan with this finger
        const isPanAllowed = gameObjects.length === 0;
        this.activePointers.set(pointer.id, { isPanAllowed });

        // Check for 2-finger pinch start
        if (this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown) {
            this.initialPinchDistance = Phaser.Math.Distance.Between(
                this.scene.input.pointer1.x, this.scene.input.pointer1.y,
                this.scene.input.pointer2.x, this.scene.input.pointer2.y
            );
            this.initialZoom = this.scene.cameras.main.zoom;
        }
    }

    private onPointerUp(pointer: Phaser.Input.Pointer) {
        this.activePointers.delete(pointer.id);
        if (this.activePointers.size < 2) {
            this.initialPinchDistance = null;
        }
    }

    private onPointerMove(pointer: Phaser.Input.Pointer) {
        if (!this.enabled) return;
        if (!pointer.isDown) return;

        // PC: Middle Mouse Button Pan
        if (pointer.middleButtonDown()) {
             this.panCamera(pointer.x - pointer.prevPosition.x, pointer.y - pointer.prevPosition.y);
             return;
        }

        // 2 Fingers: Pinch Zoom
        if (this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown) {
            const p1 = this.scene.input.pointer1;
            const p2 = this.scene.input.pointer2;
            
            const currentDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
            
            if (this.initialPinchDistance && this.initialPinchDistance > 0) {
                const scale = currentDistance / this.initialPinchDistance;
                const newZoom = Phaser.Math.Clamp(this.initialZoom * scale, 0.5, 2);
                this.scene.cameras.main.setZoom(newZoom);
            }
            // Note: We skip panning during pinch to keep it stable
            return;
        }

        // 1 Finger: Pan (if allowed)
        // We only pan if this specific pointer started on the background
        const pointerData = this.activePointers.get(pointer.id);
        if (pointerData && pointerData.isPanAllowed) {
            const dx = pointer.x - pointer.prevPosition.x;
            const dy = pointer.y - pointer.prevPosition.y;
            this.panCamera(dx, dy);
        }
    }

    private panCamera(dx: number, dy: number) {
        // Divide by zoom to keep movement 1:1 with finger on screen
        this.scene.cameras.main.scrollX -= dx / this.scene.cameras.main.zoom;
        this.scene.cameras.main.scrollY -= dy / this.scene.cameras.main.zoom;
    }

    private onWheel(_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number, _deltaZ: number) {
        if (!this.enabled) return;
        const zoom = this.scene.cameras.main.zoom - deltaY * 0.001;
        this.scene.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2));
    }
    
    public destroy(): void {
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.input.off('pointerupoutside', this.onPointerUp, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('wheel', this.onWheel, this);
    }
}
