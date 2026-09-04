import type { PieceId } from './pieceId';
import type { PowerupPack } from './powerups';

export interface PieceState {
  id: PieceId;
  col: number;
  row: number;
  x: number;
  y: number;
  correctX: number;
  correctY: number;
  angle: number;
  isSolved: boolean;
  inTray: boolean;
  trayIndex: number;
  logicalWidth: number;
  logicalHeight: number;
}

export interface RevealState {
  eyeHold: boolean;
  temporary: boolean;
  temporaryEndsAt: number | null;
  permanent: boolean;
}

export interface SavedPiece {
  id: PieceId;
  x: number;
  y: number;
  angle: number;
  isSolved: boolean;
  /** v4. Missing on v3 saves; unsolved pieces migrate into the tray. */
  inTray?: boolean;
  trayIndex?: number;
}

export interface SavedSession {
  version: 3 | 4;
  levelId: string;
  pieces: SavedPiece[];
  revealPermanent: boolean;
  elapsedMs: number;
  lastUpdated: number;
}

export type SessionEvent =
  | { type: 'pieceMoved'; id: PieceId; x: number; y: number }
  | { type: 'pieceRotated'; id: PieceId; angle: number }
  | { type: 'pieceTrayChanged'; id: PieceId; inTray: boolean }
  | { type: 'piecePlaced'; id: PieceId }
  | {
      type: 'won';
      elapsedMs: number;
      bestMs: number;
      isRecord: boolean;
      rewards: PowerupPack | null;
      allowWinDouble: boolean;
      replayFarm: boolean;
    }
  | { type: 'progress'; solved: number; total: number }
  | { type: 'inventoryChanged' }
  | { type: 'revealChanged' }
  | { type: 'timer'; elapsedMs: number };

export type SessionListener = (event: SessionEvent) => void;

export interface LevelInfo {
  id: string;
  title?: string;
  difficulty: number;
  imageKey: string;
  imageUrl: string;
  eventType?: 'daily' | 'weekly' | 'monthly';
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScatterBounds {
  world: Rect;
  board: Rect;
}
