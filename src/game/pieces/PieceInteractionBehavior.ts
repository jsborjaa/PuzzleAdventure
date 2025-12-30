import { Scene } from 'phaser';
import { Piece } from '../../objects/Piece';
import { AudioService } from '../../services/AudioService';
import { SnapSystemOptions } from './SnapSystem';

export interface SnapLike {
  trySnap: (piece: Piece, options?: Pick<SnapSystemOptions, 'playAudio' | 'emitEvent'>) => boolean;
}

export interface PieceInteractionOptions {
  snapSystem: SnapLike;
  rotateRightClick?: boolean;
  boundsRect?: Phaser.Geom.Rectangle;
  boundsProvider?: () => Phaser.Geom.Rectangle | null;
  canSnap?: (piece: Piece) => boolean;
  idleDepth?: number;
  dragDepth?: number;
}

export interface PieceInteractionHandle {
  detach: () => void;
}

const INTERACTION_KEY = '__piece_interaction_handle__';

export function attachPieceInteraction(scene: Scene, piece: Piece, options: PieceInteractionOptions): PieceInteractionHandle {
  // Avoid double-binding handlers.
  const existing = (piece as any)[INTERACTION_KEY] as PieceInteractionHandle | undefined;
  if (existing) {
    // Ensure interactive is enabled if caller expects it.
    piece.setInteractive({ draggable: true, useHandCursor: true });
    return existing;
  }

  const audio = AudioService.getInstance();
  const rotateRightClick = options.rotateRightClick ?? true;
  const snapSystem = options.snapSystem;
  const boundsRect = options.boundsRect;
  const boundsProvider = options.boundsProvider;
  const canSnap = options.canSnap;
  const idleDepth = options.idleDepth ?? 1;
  const dragDepth = options.dragDepth ?? 100;

  // Variables para detectar "Tap"
  let startX = 0;
  let startY = 0;
  const TAP_THRESHOLD = 10; // Pixeles maximos para considerar un movimiento como tap

  piece.setInteractive({ draggable: true, useHandCursor: true });

  const onDragStart = (pointer: Phaser.Input.Pointer) => {
    if (piece.isSolved) return;
    startX = pointer.x;
    startY = pointer.y;

    audio.playPop();
    piece.setDepth(dragDepth);
    piece.setScale(1.1);
    scene.events.emit('piece-drag-start');
  };

  const onDrag = (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
    if (piece.isSolved) return;
    let x = dragX;
    let y = dragY;
    const bounds = boundsProvider ? boundsProvider() : boundsRect;
    if (bounds) {
      const halfW = piece.displayWidth / 2;
      const halfH = piece.displayHeight / 2;
      x = Phaser.Math.Clamp(x, bounds.left + halfW, bounds.right - halfW);
      y = Phaser.Math.Clamp(y, bounds.top + halfH, bounds.bottom - halfH);
    }
    piece.x = x;
    piece.y = y;
  };

  const onDragEnd = (pointer: Phaser.Input.Pointer) => {
    if (piece.isSolved) return;
    
    // Check for Tap to Rotate
    const dist = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);
    if (dist < TAP_THRESHOLD) {
        piece.angle += 90;
        audio.playClick();
    }

    piece.setDepth(idleDepth);
    piece.setScale(1.0);

    const allowSnap = canSnap ? canSnap(piece) : true;
    const snapped = allowSnap ? snapSystem.trySnap(piece, { playAudio: true, emitEvent: true }) : false;
    if (!snapped) {
      piece.setDepth(idleDepth);
    }

    // Mantener compatibilidad con el flujo actual del juego
    scene.events.emit('piece-drag-end', piece);
    scene.events.emit('request-save');
  };

  const onPointerDown = (pointer: Phaser.Input.Pointer) => {
    if (piece.isSolved) return;
    piece.setDepth(dragDepth);
    
    // PC Right Click Rotation
    if (rotateRightClick && pointer.rightButtonDown()) {
      piece.angle += 90;
      audio.playClick();
    }
  };

  piece.on('dragstart', onDragStart);
  piece.on('drag', onDrag);
  piece.on('dragend', onDragEnd);
  piece.on('pointerdown', onPointerDown);

  const handle: PieceInteractionHandle = {
    detach: () => {
      piece.off('dragstart', onDragStart);
      piece.off('drag', onDrag);
      piece.off('dragend', onDragEnd);
      piece.off('pointerdown', onPointerDown);
      // no disableInteractive here; caller decides lifecycle
      delete (piece as any)[INTERACTION_KEY];
    },
  };

  (piece as any)[INTERACTION_KEY] = handle;
  return handle;
}

export function detachPieceInteraction(piece: Piece): void {
  const existing = (piece as any)[INTERACTION_KEY] as PieceInteractionHandle | undefined;
  if (!existing) return;
  existing.detach();
}

export function hasPieceInteraction(piece: Piece): boolean {
  return !!(piece as any)[INTERACTION_KEY];
}
