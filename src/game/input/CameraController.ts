import { Scene } from 'phaser';

export class CameraController {
    private scene: Scene;
    private enabled: boolean = true;
    
    constructor(scene: Scene) {
        this.scene = scene;
        this.setupCamera();
        this.setupInput();
    }

    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    private setupCamera(): void {
        this.scene.cameras.main.setBackgroundColor('#2f3542');
    }

    private setupInput(): void {
        this.scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
            if (!this.enabled) return;
            if (!p.isDown) return;

            // PC: Pan with Middle Mouse Button
            // Mobile: TODO: Add 2-finger pan logic here
            if (p.middleButtonDown()) {
                this.scene.cameras.main.scrollX -= (p.x - p.prevPosition.x) / this.scene.cameras.main.zoom;
                this.scene.cameras.main.scrollY -= (p.y - p.prevPosition.y) / this.scene.cameras.main.zoom;
            }
        });

        this.scene.input.on('wheel', (_pointer: any, _gameObjects: any, _deltaX: number, deltaY: number, _deltaZ: number) => {
            if (!this.enabled) return;
            const zoom = this.scene.cameras.main.zoom - deltaY * 0.001;
            this.scene.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2));
        });
    }
    
    // Cleanup
    public destroy(): void {
        this.scene.input.off('pointermove');
        this.scene.input.off('wheel');
    }
}
