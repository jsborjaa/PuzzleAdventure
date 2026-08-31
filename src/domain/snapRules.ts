import { SNAP_DISTANCE_PX } from './product';

export interface Snappable {
  x: number;
  y: number;
  angle: number;
  correctX: number;
  correctY: number;
  isSolved: boolean;
}

export function canSnap(piece: Snappable, snapDistance = SNAP_DISTANCE_PX): boolean {
  if (piece.isSolved) return false;
  if (piece.angle !== 0) return false;
  const dx = piece.x - piece.correctX;
  const dy = piece.y - piece.correctY;
  return Math.hypot(dx, dy) < snapDistance;
}

export function normalizeAngle(angle: number): number {
  const wrapped = ((angle % 360) + 360) % 360;
  return wrapped === 360 ? 0 : wrapped;
}
