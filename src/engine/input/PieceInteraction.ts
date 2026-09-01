import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { PieceSprite } from '../board/PieceSprite';

const TAP_THRESHOLD = 10;
const TAP_ROTATE_DEBOUNCE_MS = 150;

/** Touch + pointer both reach Phaser when capture is off; skip the TouchEvent copy. */
function isDuplicateTouch(pointer: Phaser.Input.Pointer): boolean {
  const ev = pointer.event as Event | undefined;
  if (!ev) return false;
  return typeof PointerEvent !== 'undefined' && ev.type.startsWith('touch');
}

export function attachPieceInteraction(
  sprite: PieceSprite,
  session: PuzzleSession,
  onSolvedVisual: (id: PieceSprite['pieceId']) => void,
) {
  const audio = AudioService.getInstance();
  let startX = 0;
  let startY = 0;
  let lastRotateAt = 0;

  sprite.setInteractive({ draggable: true, useHandCursor: true });

  sprite.on('dragstart', (pointer: Phaser.Input.Pointer) => {
    if (isDuplicateTouch(pointer)) return;
    if (session.getPiece(sprite.pieceId)?.isSolved) return;
    startX = pointer.x;
    startY = pointer.y;
    audio.playPop();
    sprite.setDepth(100);
    sprite.setScale(1.1);
  });

  sprite.on('drag', (pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
    if (isDuplicateTouch(pointer)) return;
    if (session.getPiece(sprite.pieceId)?.isSolved) return;
    sprite.x = dragX;
    sprite.y = dragY;
    session.movePiece(sprite.pieceId, dragX, dragY);
  });

  sprite.on('dragend', (pointer: Phaser.Input.Pointer) => {
    if (isDuplicateTouch(pointer)) return;
    const piece = session.getPiece(sprite.pieceId);
    if (!piece || piece.isSolved) return;
    const dist = Phaser.Math.Distance.Between(startX, startY, pointer.x, pointer.y);
    if (dist < TAP_THRESHOLD) {
      const now = performance.now();
      if (now - lastRotateAt >= TAP_ROTATE_DEBOUNCE_MS) {
        lastRotateAt = now;
        session.rotatePiece(sprite.pieceId);
        sprite.angle = session.getPiece(sprite.pieceId)!.angle;
        audio.playClick();
      }
    }
    sprite.setDepth(1);
    sprite.setScale(1);
    if (session.trySnap(sprite.pieceId)) {
      audio.playSnap();
      onSolvedVisual(sprite.pieceId);
    }
  });
}
