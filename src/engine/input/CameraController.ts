import { CAMERA_ZOOM_MAX, CAMERA_ZOOM_MIN } from '../../domain/product';

export class CameraController {
  private enabled = true;
  private activePointers = new Map<number, { isPanAllowed: boolean }>();
  private prevPinchDistance: number | null = null;
  private prevPinchCenter = new Phaser.Math.Vector2();

  constructor(private scene: Phaser.Scene) {
    this.scene.input.addPointer(1);
    this.scene.cameras.main.setBackgroundColor('#2f3542');
    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.activePointers.clear();
      this.prevPinchDistance = null;
    }
  }

  private onPointerDown(pointer: Phaser.Input.Pointer, gameObjects: Phaser.GameObjects.GameObject[]) {
    if (!this.enabled) return;
    this.activePointers.set(pointer.id, { isPanAllowed: gameObjects.length === 0 });
    this.prevPinchDistance = null;
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    this.activePointers.delete(pointer.id);
    this.prevPinchDistance = null;
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.enabled || !pointer.isDown) return;

    if (this.scene.input.pointer1.isDown && this.scene.input.pointer2.isDown) {
      const p1 = this.scene.input.pointer1;
      const p2 = this.scene.input.pointer2;
      const currentDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const currentCenter = new Phaser.Math.Vector2((p1.x + p2.x) / 2, (p1.y + p2.y) / 2);
      if (this.prevPinchDistance && this.prevPinchDistance > 0) {
        const zoomFactor = currentDistance / this.prevPinchDistance;
        const newZoom = Phaser.Math.Clamp(this.scene.cameras.main.zoom * zoomFactor, CAMERA_ZOOM_MIN, CAMERA_ZOOM_MAX);
        this.scene.cameras.main.setZoom(newZoom);
        this.panCamera(currentCenter.x - this.prevPinchCenter.x, currentCenter.y - this.prevPinchCenter.y);
      }
      this.prevPinchDistance = currentDistance;
      this.prevPinchCenter.copy(currentCenter);
      return;
    }

    const pointerData = this.activePointers.get(pointer.id);
    if (pointerData?.isPanAllowed) {
      this.panCamera(pointer.x - pointer.prevPosition.x, pointer.y - pointer.prevPosition.y);
    }
  }

  private panCamera(dx: number, dy: number) {
    this.scene.cameras.main.scrollX -= dx / this.scene.cameras.main.zoom;
    this.scene.cameras.main.scrollY -= dy / this.scene.cameras.main.zoom;
  }

  destroy() {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
  }
}
