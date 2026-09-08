import type { PieceId } from '../../domain/pieceId';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { PuzzleBoard } from '../board/PuzzleBoard';

/** Fly an unsolved piece to its slot, then run `onArrived`. */
export function flyPieceHome(
  scene: Phaser.Scene,
  board: PuzzleBoard,
  session: PuzzleSession,
  id: PieceId,
  duration: number,
  onArrived: (id: PieceId) => void,
  startWorld?: { x: number; y: number },
): boolean {
  const sprite = board.getSprite(id);
  const state = session.getPiece(id);
  if (!sprite || !state) return false;
  if (state.inTray && startWorld) session.movePiece(id, startWorld.x, startWorld.y);
  sprite.setVisible(true);
  sprite.setDepth(1000);
  sprite.disableInteractive();
  scene.tweens.add({
    targets: sprite,
    x: state.correctX,
    y: state.correctY,
    angle: 0,
    duration,
    ease: 'Power2',
    onComplete: () => onArrived(id),
  });
  return true;
}
