import Phaser from 'phaser';
import { PocketManager } from './PocketManager';
import { PuzzleBoard } from '../board/PuzzleBoard';
import { Piece } from '../../objects/Piece';
import { detachPieceInteraction, attachPieceInteraction, SnapLike } from '../pieces/PieceInteractionBehavior';
import { AudioService } from '../../services/AudioService';

class PocketRestrictedSnapSystem implements SnapLike {
  private scene: Phaser.Scene;
  private board: PuzzleBoard;
  private pocketManager: PocketManager;
  private getPocketIdx: () => number | null;
  private onAfterPlace: () => void;
  private onSolvedInPocket: (pieceId: number) => void;
  private snapDistance = 30;

  constructor(
    scene: Phaser.Scene,
    board: PuzzleBoard,
    pocketManager: PocketManager,
    getPocketIdx: () => number | null,
    onSolvedInPocket: (pieceId: number) => void,
    onAfterPlace: () => void
  ) {
    this.scene = scene;
    this.board = board;
    this.pocketManager = pocketManager;
    this.getPocketIdx = getPocketIdx;
    this.onSolvedInPocket = onSolvedInPocket;
    this.onAfterPlace = onAfterPlace;
  }

  public trySnap(piece: Piece): boolean {
    const pocketIdx = this.getPocketIdx();
    if (pocketIdx === null) return false;

    // Regla base (distancia + angle0) igual que tablero principal
    const dist = Phaser.Math.Distance.Between(piece.x, piece.y, piece.correctX, piece.correctY);
    if (dist >= this.snapDistance) return false;
    if (piece.angle !== 0) return false;

    const pieces = this.board.getPieces();
    const pieceId = pieces.indexOf(piece);
    if (pieceId < 0) return false;

    const pocket = this.pocketManager.getPocketState(pocketIdx);
    if (!pocket.template) return false;

    const inPocket = pocket.pieces.some((p) => p.pieceId === pieceId);
    if (!inPocket) return false;

    const allowed = Object.prototype.hasOwnProperty.call(pocket.template.pieceLayout, pieceId);
    if (!allowed) return false;

    // Colocar en tablero principal y marcar resuelto (también actualiza estado del bolsillo)
    AudioService.getInstance().playSnap();
    this.pocketManager.placePieceFromPocket(pocketIdx, pieceId);
    // Evitar que al cerrar el modo bolsillo se restaure a "stashed/invisible"
    this.onSolvedInPocket(pieceId);
    this.scene.events.emit('pocket-updated', this.pocketManager.snapshot());
    this.scene.events.emit('request-save');

    this.onAfterPlace();
    return true;
  }
}

export class PocketFocusMode {
  private scene: Phaser.Scene;
  private board: PuzzleBoard;
  private pocketManager: PocketManager;
  private snapSystem: SnapLike;

  private openPocketIdx: number | null = null;
  private revealGroup?: Phaser.GameObjects.Group;
  private baselineCaptured: boolean = false;

  // State to restore
  private hiddenPieces: Piece[] = [];
  private pocketPieces: Piece[] = [];
  private movedToOverlay = new Set<number>();
  private releasedToWorld = new Set<number>();
  private prevPieceState = new Map<
    number,
    {
      visible: boolean;
      interactive: boolean;
      depth: number;
      scrollFactorX: number;
      scrollFactorY: number;
      alpha: number;
      tintTopLeft: number;
    }
  >();

  // Paleta consistente con el tablero principal
  private readonly solvedTint = 0xddffdd;
  private readonly vividTint = 0xffffff;
  private readonly guideSolvedAlpha = 0.55;
  private readonly guideUnsolvedAlpha = 0.22;
  private readonly guideUnsolvedTint = 0x777777;

  constructor(scene: Phaser.Scene, board: PuzzleBoard, pocketManager: PocketManager) {
    this.scene = scene;
    this.board = board;
    this.pocketManager = pocketManager;
    // Snap restringido al 4x4 del bolsillo: al encajar, se resuelve en el tablero principal.
    this.snapSystem = new PocketRestrictedSnapSystem(
      scene,
      board,
      pocketManager,
      () => this.openPocketIdx,
      (pieceId) => this.excludePieceFromRestore(pieceId),
      () => this.refresh()
    );
  }

  public isOpen(): boolean {
    return this.openPocketIdx !== null;
  }

  public open(pocketIdx: number) {
    this.close();
    this.openPocketIdx = pocketIdx;

    this.baselineCaptured = false;
    this.applyVisibilityAndInteraction(true);
    this.renderReveal16();
  }

  public refresh() {
    if (this.openPocketIdx === null) return;
    this.destroyReveal16();
    this.applyVisibilityAndInteraction(false);
    this.renderReveal16();
  }

  /**
   * Si una pieza se devolvió al tablero principal mientras el modo bolsillo está activo,
   * no debemos restaurarla al estado base (normalmente invisible porque estaba stashed).
   */
  public excludePieceFromRestore(pieceId: number) {
    this.prevPieceState.delete(pieceId);
  }

  /** Marca una pieza como devuelta al tablero principal durante el modo bolsillo. */
  public markPieceReleasedToWorld(pieceId: number) {
    this.releasedToWorld.add(pieceId);
    this.excludePieceFromRestore(pieceId);
  }

  public close() {
    if (this.openPocketIdx === null) return;

    // Restore pieces
    const pieces = this.board.getPieces();
    for (const piece of pieces) {
      const id = pieces.indexOf(piece);
      const prev = this.prevPieceState.get(id);
      if (!prev) continue;

      // Restaurar layer del tablero si la movimos al overlay
      if (this.movedToOverlay.has(id)) {
        this.board.restorePieceLayer(piece);
      }

      piece.setVisible(prev.visible);
      piece.setDepth(prev.depth);
      piece.setScrollFactor(prev.scrollFactorX, prev.scrollFactorY);
      piece.setAlpha(prev.alpha);
      piece.setTint(prev.tintTopLeft);

      if (prev.interactive) {
        // Restore normal board interaction
        this.board.enablePieceInteraction(piece);
      } else {
        piece.disableInteractive();
      }
    }

    // Piezas devueltas al tablero durante el modo bolsillo:
    // no se restauran por baseline (estaban stashed), así que las mostramos/activamos aquí.
    for (const id of this.releasedToWorld) {
      const piece = pieces[id];
      if (!piece) continue;
      this.board.restorePieceLayer(piece);
      piece.setVisible(true);
      piece.setAlpha(1);
      piece.setTint(this.vividTint);
      this.board.enablePieceInteraction(piece);
    }

    this.prevPieceState.clear();
    this.hiddenPieces = [];
    this.pocketPieces = [];
    this.movedToOverlay.clear();
    this.baselineCaptured = false;
    this.releasedToWorld.clear();

    this.destroyReveal16();

    this.openPocketIdx = null;
  }

  private destroyReveal16() {
    if (this.revealGroup) {
      this.revealGroup.clear(true, true);
      this.revealGroup.destroy(true);
      this.revealGroup = undefined;
    }
  }

  private applyVisibilityAndInteraction(captureBaseline: boolean) {
    if (this.openPocketIdx === null) return;

    const pocket = this.pocketManager.getPocketState(this.openPocketIdx);
    const pocketIds = new Set<number>(pocket.pieces.map((p) => p.pieceId));
    const templateIds = new Set<number>(Object.keys(pocket.template?.pieceLayout || {}).map((k) => parseInt(k, 10)));
    const hasTemplate = !!pocket.template;

    const pieces = this.board.getPieces();
    // Bounds dinámico basado en la cámara: permite zoom/pan sin “romper” el movimiento.
    // Damos un margen para poder maniobrar piezas de borde.
    const boundsProvider = () => {
      const cam = this.scene.cameras.main;
      const vw = cam.worldView;
      const padX = vw.width * 0.12;
      const padY = vw.height * 0.12;
      return new Phaser.Geom.Rectangle(vw.x - padX, vw.y - padY, vw.width + padX * 2, vw.height + padY * 2);
    };

    // Recalcular por refresh (evita acumulación)
    this.hiddenPieces = [];
    this.pocketPieces = [];

    pieces.forEach((piece, id) => {
      // Guardar estado base SOLO una vez al entrar al modo bolsillo.
      if (captureBaseline && !this.baselineCaptured && !this.prevPieceState.has(id)) {
        this.prevPieceState.set(id, {
          visible: piece.visible,
          interactive: piece.input ? piece.input.enabled : false,
          depth: piece.depth,
          scrollFactorX: (piece as any).scrollFactorX ?? 1,
          scrollFactorY: (piece as any).scrollFactorY ?? 1,
          alpha: piece.alpha,
          tintTopLeft: (piece as any).tintTopLeft ?? 0xffffff,
        });
      }

      const isPocketPiece = pocketIds.has(id);
      if (isPocketPiece) {
        // Importante: sacar la pieza de las Layers normales a overlayLayer.
        // Si no, el depth del sprite se ignora y puede quedar por debajo de la guía, pareciendo “transparente”.
        this.board.movePieceToOverlay(piece);
        this.movedToOverlay.add(id);

        // Mostrar y permitir interacción solo a piezas del bolsillo
        piece.setVisible(true);
        piece.isSolved = false;
        piece.setTint(this.vividTint);
        piece.setAlpha(1);
        piece.setScrollFactor(1);

        // Interacción del bolsillo: clamp al tablero + snap restringido al 4x4
        detachPieceInteraction(piece);
        attachPieceInteraction(this.scene, piece, {
          snapSystem: this.snapSystem,
          rotateRightClick: true,
          boundsProvider,
          canSnap: () => pocket.template ? templateIds.has(id) : false,
          idleDepth: 950,
          dragDepth: 980,
        });
        piece.setInteractive({ draggable: true, useHandCursor: true });
        piece.setDepth(950);

        this.pocketPieces.push(piece);
        return;
      }

      // Si una pieza ya no pertenece al bolsillo pero estaba en overlay, restaurar su layer normal.
      if (this.movedToOverlay.has(id)) {
        this.board.restorePieceLayer(piece);
        this.movedToOverlay.delete(id);
      }

      // Si fue devuelta al tablero principal durante el modo bolsillo:
      // - En el modo bolsillo NO se muestra (igual que otras piezas fuera del bolsillo)
      // - Al cerrar, se mostrará/activará en `close()`.
      if (this.releasedToWorld.has(id)) {
        piece.setVisible(false);
        piece.disableInteractive();
        return;
      }

      // No-pocket pieces: mostrar solo las resueltas, ocultar las no resueltas
      if (piece.isSolved) {
        // En modo bolsillo con foto: mostrar solo las resueltas dentro del 4x4 fotografiado.
        // Sin foto: ocultar también las resueltas (no hay área enfocada).
        const shouldShowSolved = hasTemplate ? templateIds.has(id) : false;
        piece.setVisible(shouldShowSolved);
        piece.disableInteractive();
        piece.setDepth(0);
        piece.setTint(this.solvedTint);
        piece.setAlpha(1);
      } else {
        piece.setVisible(false);
        piece.disableInteractive();
        this.hiddenPieces.push(piece);
      }
    });

    if (captureBaseline) {
      this.baselineCaptured = true;
    }
  }

  private renderReveal16() {
    if (this.openPocketIdx === null) return;
    const pocket = this.pocketManager.getPocketState(this.openPocketIdx);
    if (!pocket.template) return;

    const ids = Object.keys(pocket.template.pieceLayout).map((k) => parseInt(k, 10));
    const pieces = this.board.getPieces();

    this.revealGroup = this.scene.add.group();

    ids.forEach((id) => {
      const piece = pieces[id];
      if (!piece) return;

      const ghost = this.scene.add.image(piece.correctX, piece.correctY, piece.texture.key);
      ghost.setOrigin(0.5, 0.5);
      ghost.setDepth(920);
      ghost.setAngle(0);

      if (piece.isSolved) {
        // Guía: resueltas un poco más vivas (pero sigue siendo guía)
        ghost.setAlpha(this.guideSolvedAlpha);
        ghost.setTint(this.solvedTint);
      } else {
        // Guía: no resueltas más opacas
        ghost.setAlpha(this.guideUnsolvedAlpha);
        ghost.setTint(this.guideUnsolvedTint);
      }

      this.revealGroup!.add(ghost);
    });
  }

  // (helper removido) ya no usamos bounds basados en tablero, sino en cámara (worldView).
}


