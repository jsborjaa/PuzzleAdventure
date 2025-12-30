import { Scene } from 'phaser';

export class CameraController {
    private scene: Scene;
    private enabled: boolean = true;
    private activePointers: Map<number, { isPanAllowed: boolean }> = new Map();
    // Pinch state
    private prevPinchDistance: number | null = null;
    private prevPinchCenter: Phaser.Math.Vector2 = new Phaser.Math.Vector2();

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
            this.prevPinchDistance = null;
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

        // Reset pinch state if number of pointers changes
        this.prevPinchDistance = null;
    }

    private onPointerUp(pointer: Phaser.Input.Pointer) {
        this.activePointers.delete(pointer.id);
        this.prevPinchDistance = null;
    }

    private onPointerMove(pointer: Phaser.Input.Pointer) {
        if (!this.enabled) return;
        if (!pointer.isDown) return;

        // PC: Middle Mouse Button Pan
        if (pointer.middleButtonDown()) {
             this.panCamera(pointer.x - pointer.prevPosition.x, pointer.y - pointer.prevPosition.y);
             return;
        }

        // 2 Fingers: Pinch Zoom & Pan
        if (this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown) {
            const p1 = this.scene.input.pointer1;
            const p2 = this.scene.input.pointer2;
            
            const currentDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
            const currentCenter = new Phaser.Math.Vector2((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);

            if (this.prevPinchDistance && this.prevPinchDistance > 0) {
                // 1. Calculate and Apply Zoom
                // Factor relative to previous frame (incremental zoom)
                const zoomFactor = currentDistance / this.prevPinchDistance;
                const oldZoom = this.scene.cameras.main.zoom;
                const newZoom = Phaser.Math.Clamp(oldZoom * zoomFactor, 0.2, 3); // Allow wider range
                this.scene.cameras.main.setZoom(newZoom);

                // 2. Adjust Camera Position (Pivot Zoom)
                // When zooming, we want the point under the pinch center to stay stationary (mostly).
                // However, Phaser zooms towards the camera center.
                // We need to offset the camera to compensate for the shift of the pinch center.
                
                // Simpler approach for now: Just Pan based on center movement
                // This allows moving the map while pinching
                const dx = currentCenter.x - this.prevPinchCenter.x;
                const dy = currentCenter.y - this.prevPinchCenter.y;
                
                // Also, dragging with two fingers should pan
                this.panCamera(dx, dy);
            }

            // Update state for next frame
            this.prevPinchDistance = currentDistance;
            this.prevPinchCenter.copy(currentCenter);
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
        this.scene.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.2, 3));
    }
    
    public destroy(): void {
        this.scene.input.off('pointerdown', this.onPointerDown, this);
        this.scene.input.off('pointerup', this.onPointerUp, this);
        this.scene.input.off('pointerupoutside', this.onPointerUp, this);
        this.scene.input.off('pointermove', this.onPointerMove, this);
        this.scene.input.off('wheel', this.onWheel, this);
    }
}
