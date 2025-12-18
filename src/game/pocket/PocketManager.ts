import Phaser from 'phaser';
import { Piece } from '../../objects/Piece';
import { PuzzleBoard } from '../board/PuzzleBoard';

export interface PocketTemplate {
  pieceLayout: Record<number, { gridRow: number; gridCol: number }>;
  capturedAt: number;
  imageKey: string;
  crop: { x: number; y: number; w: number; h: number };
  solvedIds: number[];
}

export interface PocketPieceState {
  pieceId: number;
  angle: number;
  slotIndex?: number;
  lastWorldPos?: { x: number; y: number; angle: number };
}

export interface PocketState {
  id: number;
  pieces: PocketPieceState[];
  template?: PocketTemplate | null;
}

export class PocketManager {
  private pockets: PocketState[] = [
    { id: 0, pieces: [], template: null },
    { id: 1, pieces: [], template: null },
    { id: 2, pieces: [], template: null },
  ];

  private activePocket: number = 0;
  private maxPiecesPerPocket = 16;
  private storageKeyPrefix = 'pockets:';
  private currentLevel: string = '';
  private board?: PuzzleBoard;
  private scene?: Phaser.Scene;

  attach(board: PuzzleBoard, scene: Phaser.Scene, levelId: string) {
    this.board = board;
    this.scene = scene;
    this.currentLevel = levelId;
    this.restore(levelId);
  }

  setActivePocket(idx: number) {
    this.activePocket = Phaser.Math.Clamp(idx, 0, 2);
  }

  getActivePocket(): number {
    return this.activePocket;
  }

  getPocketState(idx: number): PocketState {
    return this.pockets[idx];
  }

  /** Retorna el slotIndex asignado a una pieza dentro de un bolsillo. */
  getSlotIndex(pocketIdx: number, pieceId: number): number {
    const pocket = this.pockets[pocketIdx];
    const state = pocket.pieces.find((p) => p.pieceId === pieceId);
    return state?.slotIndex ?? this.ensureSlotIndex(pocketIdx, pieceId);
  }

  /** Determina si una instancia Piece pertenece al bolsillo activo (por índice). */
  getPieceIdIfInPocket(pocketIdx: number, piece: Piece): number | null {
    if (!this.board) return null;
    const id = this.getPieceId(piece);
    const pocket = this.pockets[pocketIdx];
    return pocket.pieces.some((p) => p.pieceId === id) ? id : null;
  }

  stashPiece(piece: Piece, targetPocket?: number): boolean {
    if (!this.board || !this.scene) return false;
    const pocketIdx = targetPocket ?? this.activePocket;
    const pocket = this.pockets[pocketIdx];
    if (pocket.pieces.length >= this.maxPiecesPerPocket) return false;

    // Hide piece from board and store state
    const pieceId = this.getPieceId(piece);
    if (pieceId < 0) return false;
    if (pocket.pieces.some((p) => p.pieceId === pieceId)) return false;

    const slotIndex = this.findNextFreeSlotIndex(pocketIdx);
    if (slotIndex === null) return false;

    const state: PocketPieceState = {
      pieceId,
      angle: piece.angle,
      slotIndex,
      lastWorldPos: { x: piece.x, y: piece.y, angle: piece.angle },
    };

    piece.disableInteractive();
    piece.setVisible(false);
    piece.setScale(1.0);
    piece.setAlpha(1);

    pocket.pieces.push(state);
    this.persist();
    return true;
  }

  /** Mueve una pieza entre bolsillos sin sacarla al tablero (misma instancia `Piece`). */
  transferPiece(fromPocketIdx: number, toPocketIdx: number, pieceId: number): boolean {
    if (fromPocketIdx === toPocketIdx) return false;
    const from = this.pockets[fromPocketIdx];
    const to = this.pockets[toPocketIdx];
    if (!from || !to) return false;
    if (to.pieces.length >= this.maxPiecesPerPocket) return false;
    if (to.pieces.some((p) => p.pieceId === pieceId)) return false;

    const stateIdx = from.pieces.findIndex((p) => p.pieceId === pieceId);
    if (stateIdx === -1) return false;

    const state = from.pieces[stateIdx];
    from.pieces.splice(stateIdx, 1);

    const slotIndex = this.findNextFreeSlotIndex(toPocketIdx);
    if (slotIndex === null) {
      // rollback
      from.pieces.splice(stateIdx, 0, state);
      return false;
    }

    state.slotIndex = slotIndex;
    to.pieces.push(state);
    this.persist();
    return true;
  }

  /** Actualiza la posición/ángulo recordado para devolver una pieza al tablero principal. */
  updateLastWorldPos(pocketIdx: number, pieceId: number, pos: { x: number; y: number; angle: number }) {
    const pocket = this.pockets[pocketIdx];
    if (!pocket) return;
    const state = pocket.pieces.find((p) => p.pieceId === pieceId);
    if (!state) return;
    state.lastWorldPos = { x: pos.x, y: pos.y, angle: pos.angle };
    this.persist();
  }

  retrieveAll(pocketIdx: number) {
    if (!this.board || !this.scene) return;
    const pocket = this.pockets[pocketIdx];
    if (pocket.pieces.length === 0) return;
    const pieces = this.board.getPieces();
    pocket.pieces.forEach((state) => {
      const piece = pieces[state.pieceId];
      if (!piece) return;
      piece.setVisible(true);
      this.board!.enablePieceInteraction(piece);
      piece.isSolved = false;
      piece.setDepth(1);
      piece.setTint(0xffffff);
      piece.setAlpha(1);
      piece.angle = state.angle;
      piece.setScale(1.0);
      piece.setScrollFactor(1);
      if (state.lastWorldPos) {
        piece.x = state.lastWorldPos.x;
        piece.y = state.lastWorldPos.y;
      } else {
        piece.x = this.scene!.scale.width / 2 + Phaser.Math.Between(-120, 120);
        piece.y = this.scene!.scale.height / 2 + Phaser.Math.Between(-120, 120);
      }
    });
    pocket.pieces = [];
    this.persist();
  }

  retrievePiece(pocketIdx: number, pieceId: number) {
    if (!this.board || !this.scene) return;
    const pocket = this.pockets[pocketIdx];
    const stateIdx = pocket.pieces.findIndex((p) => p.pieceId === pieceId);
    if (stateIdx === -1) return;
    const state = pocket.pieces[stateIdx];
    const pieces = this.board.getPieces();
    const piece = pieces[state.pieceId];
    if (!piece) return;
    piece.setVisible(true);
    this.board!.enablePieceInteraction(piece);
    piece.isSolved = false;
    piece.setDepth(1);
    piece.setTint(0xffffff);
    piece.setAlpha(1);
    piece.angle = state.angle;
    piece.setScale(1.0);
    piece.setScrollFactor(1);
    if (state.lastWorldPos) {
      piece.x = state.lastWorldPos.x;
      piece.y = state.lastWorldPos.y;
    } else {
      piece.x = this.scene!.scale.width / 2 + Phaser.Math.Between(-120, 120);
      piece.y = this.scene!.scale.height / 2 + Phaser.Math.Between(-120, 120);
    }

    pocket.pieces.splice(stateIdx, 1);
    this.persist();
  }

  /** Saca una pieza del bolsillo vía interacción (drag fuera del overlay). */
  releasePieceToWorld(pocketIdx: number, pieceId: number) {
    this.retrievePiece(pocketIdx, pieceId);
  }

  clearPocket(pocketIdx: number) {
    const pocket = this.pockets[pocketIdx];
    pocket.pieces = [];
    pocket.template = null;
    this.persist();
  }

  saveTemplate(pocketIdx: number, template: PocketTemplate) {
    const pocket = this.pockets[pocketIdx];
    pocket.template = template;
    this.persist();
  }

  /**
   * Determina si la "zona fotografiada" (template) ya está completamente resuelta en el tablero principal.
   * Regla: todas las piezas incluidas en `template.pieceLayout` deben tener `isSolved === true`.
   */
  isTemplateComplete(pocketIdx: number): boolean {
    if (!this.board) return false;
    const pocket = this.pockets[pocketIdx];
    const template = pocket?.template ?? null;
    if (!template) return true;
    const ids = Object.keys(template.pieceLayout || {}).map((k) => parseInt(k, 10));
    if (ids.length === 0) return true;
    const pieces = this.board.getPieces();
    return ids.every((id) => !!pieces[id]?.isSolved);
  }

  /**
   * Restricción de captura:
   * - Si NO hay template => se puede capturar.
   * - Si hay template => solo se puede capturar si el template está completo.
   */
  canCaptureTemplate(pocketIdx: number): boolean {
    const pocket = this.pockets[pocketIdx];
    const hasTemplate = !!pocket?.template;
    if (!hasTemplate) return true;
    return this.isTemplateComplete(pocketIdx);
  }

  /** Si el template está completo, lo limpia y persiste. Retorna true si limpió. */
  clearTemplateIfComplete(pocketIdx: number): boolean {
    const pocket = this.pockets[pocketIdx];
    if (!pocket?.template) return false;
    if (!this.isTemplateComplete(pocketIdx)) return false;
    pocket.template = null;
    this.persist();
    return true;
  }

  /** Limpia templates completos en todos los bolsillos. Retorna cuántos limpió. */
  clearAllTemplatesIfComplete(): number {
    let cleared = 0;
    for (const p of this.pockets) {
      if (p.template && this.isTemplateComplete(p.id)) {
        p.template = null;
        cleared++;
      }
    }
    if (cleared > 0) this.persist();
    return cleared;
  }

  autoInsertIfSolved(pocketIdx: number) {
    if (!this.board || !this.scene) return;
    const pocket = this.pockets[pocketIdx];
    if (!pocket.template) return;
    const templateIds = Object.keys(pocket.template.pieceLayout).map((k) => parseInt(k, 10));
    // Only require unsolved pieces captured to be present in pocket
    const unsolvedIds = templateIds.filter((id) => !(pocket.template?.solvedIds || []).includes(id));
    if (pocket.pieces.length !== unsolvedIds.length) return;

    const pieces = this.board.getPieces();
    pocket.pieces.forEach((state) => {
      const piece = pieces[state.pieceId];
      if (!piece) return;
      this.board!.setPieceSolved(piece);
      piece.setVisible(true);
      piece.angle = 0;
      const layout = pocket.template?.pieceLayout[state.pieceId];
      if (layout) {
        // move to correct grid world position using piece dimensions
        const pos = this.board!.getGridToWorld(
          layout.gridCol,
          layout.gridRow,
          piece.logicalWidth,
          piece.logicalHeight
        );
        piece.x = pos.x + piece.logicalWidth / 2;
        piece.y = pos.y + piece.logicalHeight / 2;
      } else {
        piece.x = piece.correctX;
        piece.y = piece.correctY;
      }
      this.scene!.events.emit('piece-placed');
    });

    pocket.pieces = [];
    pocket.template = null;
    this.persist();
  }

  placePieceFromPocket(pocketIdx: number, pieceId: number) {
    if (!this.board || !this.scene) return;
    const pocket = this.pockets[pocketIdx];
    if (!pocket.template) return;
    const layout = pocket.template.pieceLayout[pieceId];
    if (!layout) return;
    const stateIdx = pocket.pieces.findIndex((p) => p.pieceId === pieceId);
    if (stateIdx === -1) return;

    const pieces = this.board.getPieces();
    const piece = pieces[pieceId];
    if (!piece) return;

    // Colocar en tablero en su celda correcta
    this.board.setPieceSolved(piece);
    piece.setVisible(true);
    piece.angle = 0;
    const pos = this.board.getGridToWorld(layout.gridCol, layout.gridRow, piece.logicalWidth, piece.logicalHeight);
    piece.x = pos.x + piece.logicalWidth / 2;
    piece.y = pos.y + piece.logicalHeight / 2;

    // Actualizar estado del bolsillo
    pocket.pieces.splice(stateIdx, 1);
    const solvedSet = new Set(pocket.template.solvedIds ?? []);
    solvedSet.add(pieceId);
    pocket.template.solvedIds = Array.from(solvedSet);

    this.scene.events.emit('piece-placed');
    this.persist();
  }

  snapshot(): PocketState[] {
    return this.pockets.map((p) => ({
      id: p.id,
      pieces: [...p.pieces],
      template: p.template ? { ...p.template, pieceLayout: { ...p.template.pieceLayout } } : null,
    }));
  }

  persist() {
    if (!this.currentLevel) return;
    try {
      localStorage.setItem(this.storageKeyPrefix + this.currentLevel, JSON.stringify(this.snapshot()));
    } catch (err) {
      console.warn('Pocket persist failed', err);
    }
  }

  restore(levelId: string) {
    this.currentLevel = levelId;
    try {
      const stored = localStorage.getItem(this.storageKeyPrefix + levelId);
      if (!stored) {
        this.pockets = this.pockets.map((p) => ({ id: p.id, pieces: [], template: null }));
        return;
      }
      const parsed = JSON.parse(stored) as PocketState[];
      this.pockets = [0, 1, 2].map((idx) => {
        const found = parsed.find((p) => p.id === idx) || { id: idx, pieces: [], template: null };
        // Migración: asegurar slotIndex
        const used = new Set<number>();
        (found.pieces || []).forEach((ps: any) => {
          if (typeof ps.slotIndex === 'number') used.add(ps.slotIndex);
        });
        let next = 0;
        (found.pieces || []).forEach((ps: any) => {
          if (typeof ps.slotIndex !== 'number') {
            while (used.has(next) && next < 16) next++;
            ps.slotIndex = next;
            used.add(next);
            next++;
          }
        });
        return found as PocketState;
      });
    } catch (err) {
      console.warn('Pocket restore failed', err);
      this.pockets = this.pockets.map((p) => ({ id: p.id, pieces: [], template: null }));
    }
  }

  applyHiddenPiecesOnLoad() {
    if (!this.board) return;
    const pieces = this.board.getPieces();
    this.pockets.forEach((pocket) => {
      pocket.pieces.forEach((state) => {
        const piece = pieces[state.pieceId];
        if (!piece) return;
        piece.disableInteractive();
        piece.setVisible(false);
      });
    });
  }

  clearAll() {
    this.pockets = this.pockets.map((p) => ({ id: p.id, pieces: [], template: null }));
    if (this.currentLevel) {
      localStorage.removeItem(this.storageKeyPrefix + this.currentLevel);
    }
  }

  rotatePiece(pocketIdx: number, pieceId: number, deltaAngle: number = 90) {
    const pocket = this.pockets[pocketIdx];
    if (!pocket) return;
    const state = pocket.pieces.find((p) => p.pieceId === pieceId);
    if (!state) return;
    state.angle = ((state.angle ?? 0) + deltaAngle) % 360;

    // Mantener la instancia real sincronizada (aunque esté oculta):
    // así, cuando se recupere, es literalmente "la misma pieza" con el mismo estado.
    if (this.board) {
      const pieces = this.board.getPieces();
      const piece = pieces[pieceId];
      if (piece) {
        piece.angle = state.angle;
      }
    }
    this.persist();
  }

  private ensureSlotIndex(pocketIdx: number, pieceId: number): number {
    const pocket = this.pockets[pocketIdx];
    const state = pocket.pieces.find((p) => p.pieceId === pieceId);
    if (!state) return 0;
    if (typeof state.slotIndex === 'number') return state.slotIndex;
    const slotIndex = this.findNextFreeSlotIndex(pocketIdx) ?? 0;
    state.slotIndex = slotIndex;
    this.persist();
    return slotIndex;
  }

  private findNextFreeSlotIndex(pocketIdx: number): number | null {
    const pocket = this.pockets[pocketIdx];
    const used = new Set<number>(pocket.pieces.map((p) => p.slotIndex).filter((x): x is number => typeof x === 'number'));
    for (let i = 0; i < 16; i++) {
      if (!used.has(i)) return i;
    }
    return null;
  }

  private getPieceId(piece: Piece): number {
    if (!this.board) return -1;
    return this.board.getPieces().indexOf(piece);
  }
}

