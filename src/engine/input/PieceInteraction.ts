import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { PieceSprite } from '../board/PieceSprite';
import type { PieceId } from '../../domain/pieceId';

export const TAP_THRESHOLD = 10;
export const TAP_ROTATE_DEBOUNCE_MS = 150;

export function clientToWorld(scene: Phaser.Scene, clientX: number, clientY: number) {
  const canvas = scene.game.canvas;
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / Math.max(1, rect.width)) * scene.scale.width;
  const y = ((clientY - rect.top) / Math.max(1, rect.height)) * scene.scale.height;
  return scene.cameras.main.getWorldPoint(x, y);
}

export function pointerToClient(scene: Phaser.Scene, pointer: Phaser.Input.Pointer) {
  const rect = scene.game.canvas.getBoundingClientRect();
  const w = Math.max(1, scene.scale.width);
  const h = Math.max(1, scene.scale.height);
  return {
    x: rect.left + (pointer.x / w) * rect.width,
    y: rect.top + (pointer.y / h) * rect.height,
  };
}

export function clientOverElement(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

export function attachPieceInteraction(
  sprite: PieceSprite,
  session: PuzzleSession,
  onSolvedVisual: (id: PieceSprite['pieceId']) => void,
  opts?: {
    isOverTray?: (clientX: number, clientY: number) => boolean;
    insertIndex?: (clientX: number, clientY: number, id: PieceId) => number;
    onReturnToTray?: (id: PieceSprite['pieceId']) => void;
    setCameraEnabled?: (on: boolean) => void;
    onHoldStart?: (id: PieceSprite['pieceId'], clientX: number, clientY: number) => void;
    onHoldMove?: (clientX: number, clientY: number) => void;
    onHoldEnd?: () => void;
  },
) {
  const audio = AudioService.getInstance();
  let startX = 0;
  let startY = 0;
  let lastRotateAt = 0;
  let holding = false;
  const winOpts: AddEventListenerOptions = { capture: true };

  sprite.setInteractive({ draggable: true, useHandCursor: true });

  const endHold = () => {
    if (!holding) return;
    holding = false;
    window.removeEventListener('pointermove', onWinMove, winOpts);
    window.removeEventListener('pointerup', onWinUp, winOpts);
    window.removeEventListener('pointercancel', onWinUp, winOpts);
    opts?.setCameraEnabled?.(true);
    opts?.onHoldEnd?.();
    sprite.setDepth(1);
    sprite.setScale(1);
  };

  const onWinMove = (ev: PointerEvent) => {
    if (!holding) return;
    opts?.onHoldMove?.(ev.clientX, ev.clientY);
  };

  const finish = (clientX: number, clientY: number, dist: number) => {
    if (!holding) return;
    const piece = session.getPiece(sprite.pieceId);
    endHold();
    if (!piece || piece.isSolved) return;
    if (opts?.isOverTray?.(clientX, clientY)) {
      const index = opts.insertIndex?.(clientX, clientY, sprite.pieceId);
      session.returnToTray(sprite.pieceId, index);
      opts.onReturnToTray?.(sprite.pieceId);
      return;
    }
    if (dist < TAP_THRESHOLD) {
      const now = performance.now();
      if (now - lastRotateAt >= TAP_ROTATE_DEBOUNCE_MS) {
        lastRotateAt = now;
        session.rotatePiece(sprite.pieceId);
        sprite.angle = session.getPiece(sprite.pieceId)!.angle;
        audio.playClick();
      }
    }
    if (session.trySnap(sprite.pieceId)) {
      audio.playSnap();
      onSolvedVisual(sprite.pieceId);
      return;
    }
    opts?.onReturnToTray?.(sprite.pieceId);
  };

  const onWinUp = (ev: PointerEvent) => {
    if (!holding) return;
    const dist = Phaser.Math.Distance.Between(startX, startY, ev.clientX, ev.clientY);
    finish(ev.clientX, ev.clientY, dist);
  };

  sprite.on('dragstart', (pointer: Phaser.Input.Pointer) => {
    if (session.getPiece(sprite.pieceId)?.isSolved) return;
    if (session.getReveal().eyeHold) return;
    const client = pointerToClient(sprite.scene, pointer);
    startX = client.x;
    startY = client.y;
    holding = true;
    audio.playPop();
    sprite.setDepth(100);
    opts?.setCameraEnabled?.(false);
    opts?.onHoldStart?.(sprite.pieceId, client.x, client.y);
    window.addEventListener('pointermove', onWinMove, winOpts);
    window.addEventListener('pointerup', onWinUp, winOpts);
    window.addEventListener('pointercancel', onWinUp, winOpts);
  });

  sprite.on('dragend', (pointer: Phaser.Input.Pointer) => {
    if (!holding) return;
    const client = pointerToClient(sprite.scene, pointer);
    const dist = Phaser.Math.Distance.Between(startX, startY, client.x, client.y);
    finish(client.x, client.y, dist);
  });
}
