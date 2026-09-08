import type { ToolId } from '../../domain/product';
import { AbstractTool } from './AbstractTool';

export class ToolManager {
  private tools = new Map<ToolId, AbstractTool>();
  private current: AbstractTool | null = null;
  private windowMove = (e: PointerEvent) => {
    this.moveToPage(e.pageX, e.pageY, true);
  };

  constructor(private scene: Phaser.Scene) {}

  addTool(id: ToolId, tool: AbstractTool) {
    this.tools.set(id, tool);
  }

  activate(id: ToolId | null) {
    if (this.current) this.current.deactivate();
    window.removeEventListener('pointermove', this.windowMove);
    if (!id) {
      this.current = null;
      this.scene.sys.canvas.style.cursor = 'default';
      return;
    }
    const tool = this.tools.get(id);
    if (!tool) return;
    this.current = tool;
    window.addEventListener('pointermove', this.windowMove);
    tool.activate();
  }

  moveToPage(pageX: number, pageY: number, wasMove = true) {
    const pointer = this.scene.input.activePointer;
    this.scene.input.manager.transformPointer(pointer, pageX, pageY, wasMove);
    this.current?.onPointerMove(pointer, pageX, pageY);
    return pointer;
  }

  confirmAt(pageX: number, pageY: number) {
    const pointer = this.moveToPage(pageX, pageY, false);
    this.current?.confirm(pointer, pageX, pageY);
    this.activate(null);
  }

  confirm(pointer: Phaser.Input.Pointer) {
    this.current?.confirm(pointer);
    this.activate(null);
  }

  destroy() {
    this.activate(null);
  }
}
