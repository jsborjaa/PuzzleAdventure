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

  // Camera Spotlight State
  private isCameraMode = false;
  private spotlightOverlay?: Phaser.GameObjects.Graphics;

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

  private readonly solvedTint = 0xffffff;
  private readonly vividTint = 0xffffff;
  private readonly guideSolvedAlpha = 0.55;
  private readonly guideUnsolvedAlpha = 0.4;
  private readonly guideUnsolvedTint = 0xffffff;

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
    // Re-apply visibility. If in camera mode, this logic might need adjustment?
    // Actually, refresh is called when pieces move in/out of pocket.
    // If we are in camera mode, we likely want to exit it or stay in it.
    // Let's assume refresh keeps standard pocket mode.
    this.applyVisibilityAndInteraction(false);
    this.renderReveal16();
    
    // If we were in camera mode, re-apply overlay if needed
    if (this.isCameraMode) {
        // actually if pieces changed, we should probably update spotlight overlay if needed
        // but camera mode is "modal" usually.
    }
  }

  public excludePieceFromRestore(pieceId: number) {
    this.prevPieceState.delete(pieceId);
  }

  public markPieceReleasedToWorld(pieceId: number) {
    this.releasedToWorld.add(pieceId);
    this.excludePieceFromRestore(pieceId);
  }

  public close() {
    if (this.openPocketIdx === null) return;

    // Exit camera mode if active
    if (this.isCameraMode) {
        this.exitCameraMode();
    }

    // Restore pieces
    const pieces = this.board.getPieces();
    for (const piece of pieces) {
      const id = pieces.indexOf(piece);
      const prev = this.prevPieceState.get(id);
      if (!prev) continue;

      if (this.movedToOverlay.has(id)) {
        this.board.restorePieceLayer(piece);
      }

      piece.setVisible(prev.visible);
      piece.setDepth(prev.depth);
      piece.setScrollFactor(prev.scrollFactorX, prev.scrollFactorY);
      piece.setAlpha(prev.alpha);
      piece.setTint(prev.tintTopLeft);

      if (prev.interactive) {
        this.board.enablePieceInteraction(piece);
      } else {
        piece.disableInteractive();
      }
    }

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
    const boundsProvider = () => {
      const cam = this.scene.cameras.main;
      const vw = cam.worldView;
      const padX = vw.width * 0.12;
      const padY = vw.height * 0.12;
      return new Phaser.Geom.Rectangle(vw.x - padX, vw.y - padY, vw.width + padX * 2, vw.height + padY * 2);
    };

    this.hiddenPieces = [];
    this.pocketPieces = [];

    pieces.forEach((piece, id) => {
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
        this.board.movePieceToOverlay(piece);
        this.movedToOverlay.add(id);

        piece.setVisible(true);
        piece.isSolved = false;
        piece.setTint(this.vividTint);
        piece.setAlpha(1);
        piece.setScrollFactor(1);

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

      if (this.movedToOverlay.has(id)) {
        this.board.restorePieceLayer(piece);
        this.movedToOverlay.delete(id);
      }

      if (this.releasedToWorld.has(id)) {
        piece.setVisible(false);
        piece.disableInteractive();
        return;
      }

      if (piece.isSolved) {
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
        ghost.setAlpha(this.guideSolvedAlpha);
        ghost.setTint(this.solvedTint);
      } else {
        ghost.setAlpha(this.guideUnsolvedAlpha);
        ghost.setTint(this.guideUnsolvedTint);
      }

      this.revealGroup!.add(ghost);
    });
  }

  // --- SPOTLIGHT CAMERA MODE ---
  // Muestra el tablero completo oscurecido, excepto un área (la cámara)
  // Permite al usuario "ver" dónde está tomando la foto sin salir del contexto visual del bolsillo.

  public enterCameraMode() {
    if (this.isCameraMode) return;
    this.isCameraMode = true;

    // 1. Mostrar temporalmente TODAS las piezas del tablero (incluso las ocultas) para que se vea qué fotografiar
    //    Las piezas del bolsillo se mantienen visibles encima (ya están en overlay)
    const pieces = this.board.getPieces();
    pieces.forEach(p => {
        if (!this.pocketPieces.includes(p) && !this.releasedToWorld.has(pieces.indexOf(p))) {
            p.setVisible(true);
            // Hacerlas un poco más oscuras para resaltar que son "fondo"? 
            // O dejarlas normal y el overlay se encarga.
            // p.setAlpha(0.5); 
        }
    });

    // 2. Crear Overlay Oscuro
    // Usamos un Graphics gigante que cubre todo el WorldBounds
    const bounds = this.board.worldBounds;
    this.spotlightOverlay = this.scene.add.graphics();
    this.spotlightOverlay.fillStyle(0x000000, 0.7);
    this.spotlightOverlay.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
    this.spotlightOverlay.setDepth(2000); // Muy arriba

    // 3. Crear Máscara (Spotlight)
    // Phaser Geometry Mask: Usamos otro Graphics para definir qué SE VE.
    // Invertido: Queremos ver lo que está DENTRO del cuadrado, el resto oscuro.
    // Espera, la técnica común es: Overlay negro con agujero. 
    // O Overlay negro con alpha sobre todo, y "recortar" el agujero.
    // Phaser mask funciona "mostrando" lo que está bajo la máscara.
    // Si queremos oscurecer todo MENOS el cuadrado, necesitamos una máscara INVERTIDA 
    // o dibujar el overlay negro como 4 rectángulos alrededor del hueco.
    // Dibujar 4 rectángulos es más fácil y performante que máscaras invertidas complejas.
    this.updateSpotlight(0, 0, 0, 0); // Start hidden/empty
  }

  public updateSpotlight(x: number, y: number, w: number, h: number) {
    if (!this.isCameraMode || !this.spotlightOverlay) return;

    // Redraw overlay as 4 rectangles around the "hole"
    this.spotlightOverlay.clear();
    this.spotlightOverlay.fillStyle(0x000000, 0.7);

    const bounds = this.board.worldBounds;

    // Top
    this.spotlightOverlay.fillRect(bounds.x, bounds.y, bounds.width, y - bounds.y);
    // Bottom
    this.spotlightOverlay.fillRect(bounds.x, y + h, bounds.width, bounds.bottom - (y + h));
    // Left
    this.spotlightOverlay.fillRect(bounds.x, y, x - bounds.x, h);
    // Right
    this.spotlightOverlay.fillRect(x + w, y, bounds.right - (x + w), h);
    
    // Border for the spotlight
    this.spotlightOverlay.lineStyle(2, 0xffe66d, 1);
    this.spotlightOverlay.strokeRect(x, y, w, h);
  }

  public exitCameraMode() {
    if (!this.isCameraMode) return;
    this.isCameraMode = false;

    if (this.spotlightOverlay) {
        this.spotlightOverlay.destroy();
        this.spotlightOverlay = undefined;
    }

    // Restaurar visibilidad normal del modo bolsillo (ocultar lo que no es bolsillo/resuelto-en-foto)
    // Llamamos a refresh() o reaplicamos applyVisibility
    this.applyVisibilityAndInteraction(false);
  }
}
