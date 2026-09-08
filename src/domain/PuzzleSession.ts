import { ProgressStore } from '../data/ProgressStore';
import { consume, craft as craftInventory, hasCharges, type PowerupCounts } from './inventory';
import type { PieceId } from './pieceId';
import { allowCampaignWinDouble, packHasItems, type PowerupPack } from './powerups';
import { BOARD_WORLD_PAD, REVEAL_EYE_ALPHA, REVEAL_PERM_ALPHA, REVEAL_TEMP_ALPHA, REVEAL_TEMP_MS, type PlayMode, type PowerupKey } from './product';
import type { JigsawLayout } from './jigsaw';
import { SeededRng } from './rng';
import { canSnap, normalizeAngle } from './snapRules';
import { GameTimer } from './timer';
import { countSolved, isWon } from './win';
import type {
  LevelInfo,
  PieceState,
  RevealState,
  SavedSession,
  ScatterBounds,
  SessionEvent,
  SessionListener,
} from './types';

export interface SessionInit {
  level: LevelInfo;
  layout: JigsawLayout;
  bounds: ScatterBounds;
  mode: PlayMode;
  saved?: SavedSession | null;
  special: boolean;
  qualityReduced?: { from: number; to: number };
  store?: ProgressStore;
  now?: () => number;
  /** When set, campaign `save()` must not replace another level's in-progress slot. */
  skipCampaignSave?: boolean;
}

export class PuzzleSession {
  readonly levelId: string;
  readonly special: boolean;
  readonly mode: PlayMode;
  readonly layout: JigsawLayout;
  readonly bounds: ScatterBounds;
  private readonly eventType?: LevelInfo['eventType'];

  private pieces = new Map<PieceId, PieceState>();
  private listeners = new Set<SessionListener>();
  private store: ProgressStore;
  private timer = new GameTimer();
  private now: () => number;
  private reveal: RevealState = {
    eyeHold: false,
    temporary: false,
    temporaryEndsAt: null,
    permanent: false,
  };
  private inventory: PowerupCounts;
  private wonEmitted = false;
  private timerEmitAcc = 0;
  private skipCampaignSave = false;
  readonly qualityGate?: { from: number; to: number };

  constructor(init: SessionInit) {
    this.levelId = init.level.id;
    this.special = init.special;
    this.eventType = init.level.eventType;
    this.mode = init.mode;
    this.layout = init.layout;
    this.bounds = init.bounds;
    this.store = init.store ?? ProgressStore.getInstance();
    this.now = init.now ?? (() => Date.now());
    this.skipCampaignSave = !!init.skipCampaignSave;
    this.inventory = this.store.getPowerups();
    this.qualityGate = init.qualityReduced;
    this.buildPieces(init);
    if (init.mode === 'resume' && init.saved?.revealPermanent) {
      this.reveal.permanent = true;
    }
    if (init.mode !== 'replay') {
      this.timer.start(init.mode === 'resume' ? init.saved?.elapsedMs ?? 0 : 0);
    }
  }

  on(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getPieces(): PieceState[] {
    return Array.from(this.pieces.values());
  }

  getPiece(id: PieceId): PieceState | undefined {
    return this.pieces.get(id);
  }

  getInventory(): PowerupCounts {
    return { ...this.inventory };
  }

  getReveal(): RevealState {
    return { ...this.reveal };
  }

  getElapsed(): number {
    return this.timer.getElapsed();
  }

  getBestMs(): number | null {
    return this.store.getBestMs(this.levelId);
  }

  get hasWon(): boolean {
    return this.wonEmitted;
  }

  get guideAlpha(): number {
    // Chrome Peek (hold) wins over Peek ∞, which wins over Glimpse.
    if (this.reveal.eyeHold) return REVEAL_EYE_ALPHA;
    if (this.reveal.permanent) return REVEAL_PERM_ALPHA;
    if (this.reveal.temporary) return REVEAL_TEMP_ALPHA;
    return 0;
  }

  getProgress() {
    return countSolved(this.pieces.values());
  }

  tick(deltaMs: number) {
    this.timer.tick(deltaMs);
    if (this.reveal.temporary && this.reveal.temporaryEndsAt && this.now() >= this.reveal.temporaryEndsAt) {
      this.reveal.temporary = false;
      this.reveal.temporaryEndsAt = null;
      this.emit({ type: 'revealChanged' });
    }
    this.timerEmitAcc += deltaMs;
    if (this.timerEmitAcc >= 200) {
      this.timerEmitAcc = 0;
      this.emit({ type: 'timer', elapsedMs: this.timer.getElapsed() });
    }
  }

  movePiece(id: PieceId, x: number, y: number) {
    const piece = this.pieces.get(id);
    if (!piece || piece.isSolved) return;
    if (piece.inTray) {
      piece.inTray = false;
      this.reindexTray();
      this.emit({ type: 'pieceTrayChanged', id, inTray: false });
    }
    piece.x = x;
    piece.y = y;
    this.emit({ type: 'pieceMoved', id, x, y });
  }

  rotatePiece(id: PieceId) {
    const piece = this.pieces.get(id);
    if (!piece || piece.isSolved) return;
    piece.angle = normalizeAngle(piece.angle + 90);
    this.emit({ type: 'pieceRotated', id, angle: piece.angle });
  }

  returnToTray(id: PieceId, insertIndex?: number): boolean {
    const piece = this.pieces.get(id);
    if (!piece || piece.isSolved) return false;
    piece.inTray = true;
    piece.x = piece.correctX;
    piece.y = piece.correctY;
    this.reindexTray({ id, index: insertIndex });
    this.emit({ type: 'pieceTrayChanged', id, inTray: true });
    this.save();
    return true;
  }

  getTrayPieces() {
    return this.getPieces()
      .filter((p) => p.inTray && !p.isSolved)
      .sort((a, b) => a.trayIndex - b.trayIndex);
  }

  trySnap(id: PieceId): boolean {
    const piece = this.pieces.get(id);
    if (!piece || !canSnap(piece)) return false;
    this.placePiece(id);
    return true;
  }

  /** Single solve path used by snap, hint, and load. */
  placePiece(id: PieceId, opts: { consume?: PowerupKey; silent?: boolean } = {}): boolean {
    const piece = this.pieces.get(id);
    if (!piece || piece.isSolved) return false;
    const wasInTray = piece.inTray;
    piece.isSolved = true;
    piece.inTray = false;
    piece.x = piece.correctX;
    piece.y = piece.correctY;
    piece.angle = 0;
    if (wasInTray) {
      this.reindexTray();
      this.emit({ type: 'pieceTrayChanged', id, inTray: false });
    }
    if (opts.consume && this.mode !== 'replay') {
      this.applyConsume(opts.consume);
    }
    const { solved, total } = this.getProgress();
    if (!opts.silent) {
      this.emit({ type: 'piecePlaced', id });
      this.emit({ type: 'progress', solved, total });
    }
    this.save();
    if (!this.wonEmitted && isWon(this.pieces.values())) {
      this.wonEmitted = true;
      this.timer.pause();
      const elapsedMs = this.timer.getElapsed();
      const result = this.handleWin();
      if (result.rewards) this.emit({ type: 'inventoryChanged' });
      this.emit({
        type: 'won',
        elapsedMs,
        bestMs: result.bestMs,
        isRecord: result.isRecord,
        rewards: result.rewards,
        allowWinDouble: result.allowWinDouble,
        replayFarm: result.replayFarm,
      });
    }
    return true;
  }

  queueHint(col: number, row: number): PieceId | null {
    if (this.mode === 'replay') return null;
    if (!hasCharges(this.inventory, 'hint')) return null;
    const target = this.findHintTarget(col, row);
    if (!target) return null;
    return target.id;
  }

  confirmHint(id: PieceId): boolean {
    return this.placePiece(id, { consume: 'hint' });
  }

  queueLucky(id: PieceId): PieceId | null {
    if (this.mode === 'replay') return null;
    if (!hasCharges(this.inventory, 'lucky')) return null;
    const piece = this.getPiece(id);
    if (!piece || piece.isSolved) return null;
    return id;
  }

  confirmLucky(id: PieceId): boolean {
    return this.placePiece(id, { consume: 'lucky' });
  }

  queueSolver(startCol: number, startRow: number, size: number): PieceId[] {
    if (this.mode === 'replay') return [];
    if (!hasCharges(this.inventory, 'solver')) return [];
    const selected = this.unsolvedInRect(startCol, startRow, size);
    if (selected.length === 0) return [];
    this.applyConsume('solver');
    return selected.map((p) => p.id);
  }

  confirmSolver(id: PieceId): boolean {
    return this.placePiece(id);
  }

  useArea(startCol: number, startRow: number, size: number): PieceId[] {
    if (this.mode === 'replay') return [];
    const key: PowerupKey = size >= 4 ? 'sarea' : 'area';
    if (!hasCharges(this.inventory, key)) return [];
    const selected = this.unsolvedInRect(startCol, startRow, size);
    if (selected.length === 0) return [];

    const target = this.findGroupTarget(selected, startCol, startRow, size);
    for (const piece of selected) {
      const wasInTray = piece.inTray;
      piece.inTray = false;
      piece.x = target.x + (Math.random() * 100 - 50);
      piece.y = target.y + (Math.random() * 100 - 50);
      if (wasInTray) this.emit({ type: 'pieceTrayChanged', id: piece.id, inTray: false });
      this.emit({ type: 'pieceMoved', id: piece.id, x: piece.x, y: piece.y });
    }
    this.reindexTray();
    this.applyConsume(key);
    const ids = selected.map((p) => p.id);
    this.save();
    return ids;
  }

  setEyeHold(active: boolean) {
    this.reveal.eyeHold = active;
    this.emit({ type: 'revealChanged' });
  }

  activatePermanentReveal(): boolean {
    if (this.mode === 'replay') return false;
    if (this.reveal.permanent) return false;
    if (!hasCharges(this.inventory, 'reveal_perm')) return false;
    this.reveal.permanent = true;
    this.reveal.temporary = false;
    this.reveal.temporaryEndsAt = null;
    this.applyConsume('reveal_perm');
    this.emit({ type: 'revealChanged' });
    this.save();
    return true;
  }

  activateTemporaryReveal(): boolean {
    if (this.mode === 'replay') return false;
    if (this.reveal.permanent || this.reveal.temporary) return false;
    if (!hasCharges(this.inventory, 'reveal_temp')) return false;
    this.reveal.temporary = true;
    this.reveal.temporaryEndsAt = this.now() + REVEAL_TEMP_MS;
    this.applyConsume('reveal_temp');
    this.emit({ type: 'revealChanged' });
    return true;
  }

  save() {
    if (this.mode === 'replay' || this.skipCampaignSave || this.wonEmitted || isWon(this.pieces.values())) return;
    const saved: SavedSession = {
      version: 4,
      levelId: this.levelId,
      pieces: this.getPieces().map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        angle: p.angle,
        isSolved: p.isSolved,
        inTray: p.inTray,
        trayIndex: p.trayIndex,
      })),
      revealPermanent: this.reveal.permanent,
      elapsedMs: this.timer.getElapsed(),
      lastUpdated: this.now(),
    };
    if (this.special) this.store.saveSpecialSession(saved);
    else this.store.saveSession(saved);
  }

  private handleWin(): {
    bestMs: number;
    lastMs: number;
    isRecord: boolean;
    rewards: PowerupPack | null;
    allowWinDouble: boolean;
    replayFarm: boolean;
  } {
    const result = this.store.recordClear(this.levelId, this.timer.getElapsed());
    let rewards: PowerupPack | null = null;
    let allowWinDouble = false;
    if (this.mode !== 'replay') {
      if (!this.special && this.levelId.startsWith('level_')) {
        const num = parseInt(this.levelId.replace('level_', ''), 10);
        const unlocked = this.store.completeLevel(num - 1);
        rewards = this.store.tryClaimCampaignFirstClear(unlocked, num, this.layout.pieces.length);
        allowWinDouble = !!rewards && allowCampaignWinDouble(num);
      }
      if (this.special && this.eventType) {
        rewards = this.store.tryClaimEventReward(this.eventType, this.levelId, this.now());
        allowWinDouble = !!rewards;
      }
      if (rewards) this.inventory = this.store.getPowerups();
    }
    if (this.special) this.store.clearSpecialSession(this.levelId);
    else this.store.clearCampaignSessionIf(this.levelId);
    return { ...result, rewards, allowWinDouble, replayFarm: !rewards };
  }

  grantWinPack(pack: PowerupPack) {
    if (!packHasItems(pack)) return;
    this.store.grantPack(pack);
    this.inventory = this.store.getPowerups();
    this.emit({ type: 'inventoryChanged' });
  }

  craft(to: PowerupKey): boolean {
    const next = craftInventory(this.inventory, to);
    if (!next) return false;
    this.inventory = next;
    this.store.setPowerups(this.inventory);
    this.emit({ type: 'inventoryChanged' });
    return true;
  }

  private applyConsume(key: PowerupKey) {
    const next = consume(this.inventory, key);
    if (!next) return;
    this.inventory = next;
    this.store.setPowerups(this.inventory);
    this.emit({ type: 'inventoryChanged' });
  }

  private findHintTarget(col: number, row: number): PieceState | null {
    const here = this.getPieces().find((p) => p.col === col && p.row === row);
    if (here && !here.isSolved) return here;
    if (here && here.isSolved) {
      const neighbors = this.getPieces().filter((p) => {
        if (p.isSolved) return false;
        const dc = Math.abs(p.col - col);
        const dr = Math.abs(p.row - row);
        return dc + dr === 1;
      });
      if (neighbors.length === 0) return null;
      return neighbors[Math.floor(Math.random() * neighbors.length)]!;
    }
    return this.getPieces().find((p) => !p.isSolved && p.col === col && p.row === row) ?? null;
  }

  private unsolvedInRect(startCol: number, startRow: number, size: number): PieceState[] {
    const endCol = startCol + size - 1;
    const endRow = startRow + size - 1;
    return this.getPieces().filter(
      (p) => !p.isSolved && p.col >= startCol && p.col <= endCol && p.row >= startRow && p.row <= endRow,
    );
  }

  private findGroupTarget(selected: PieceState[], startCol: number, startRow: number, size: number) {
    const pw = this.layout.pieceWidth;
    const ph = this.layout.pieceHeight;
    const board = this.bounds.board;
    const world = this.bounds.world;
    const selRect = {
      x: board.x + startCol * pw,
      y: board.y + startRow * ph,
      w: size * pw,
      h: size * ph,
    };
    const centerX = selRect.x + selRect.w / 2;
    const centerY = selRect.y + selRect.h / 2;
    const selectedSet = new Set(selected.map((p) => p.id));
    const occupied = this.getPieces().filter((p) => !selectedSet.has(p.id) && !p.isSolved && !p.inTray);
    const radius = Math.max(pw, ph) * 0.8;
    const isFree = (x: number, y: number) => occupied.every((p) => Math.hypot(p.x - x, p.y - y) >= radius);

    const baseRadius = Math.max(selRect.w, selRect.h) * 0.5 + Math.max(pw, ph) * 1.5;
    const radii = [baseRadius, baseRadius + 120, baseRadius + 200, baseRadius + 260];
    for (const r of radii) {
      for (const deg of [0, 60, 120, 180, 240, 300]) {
        const rad = (deg * Math.PI) / 180;
        const cx = Math.min(Math.max(centerX + Math.cos(rad) * r, world.x + 50), world.x + world.width - 50);
        const cy = Math.min(Math.max(centerY + Math.sin(rad) * r, world.y + 50), world.y + world.height - 50);
        const inside =
          cx >= selRect.x && cx <= selRect.x + selRect.w && cy >= selRect.y && cy <= selRect.y + selRect.h;
        if (!inside && isFree(cx, cy)) return { x: cx, y: cy };
      }
    }
    return { x: world.x + world.width - 80, y: centerY };
  }

  private buildPieces(init: SessionInit) {
    const savedMap = new Map((init.saved?.pieces ?? []).map((p) => [p.id, p]));
    const { board } = init.bounds;
    const trayRng = new SeededRng(Date.now() % 2147483647);

    for (const def of init.layout.pieces) {
      const correctX = board.x + def.srcX + def.srcW / 2;
      const correctY = board.y + def.srcY + def.srcH / 2;
      const saved = savedMap.get(def.id);
      const piece: PieceState = {
        id: def.id,
        col: def.col,
        row: def.row,
        x: correctX,
        y: correctY,
        correctX,
        correctY,
        angle: 0,
        isSolved: false,
        inTray: true,
        trayIndex: 0,
        logicalWidth: def.srcW,
        logicalHeight: def.srcH,
      };

      if (init.mode === 'replay') {
        piece.isSolved = true;
        piece.inTray = false;
      } else if (init.mode === 'resume' && saved) {
        piece.x = saved.x;
        piece.y = saved.y;
        piece.angle = saved.angle;
        piece.isSolved = saved.isSolved;
        if (piece.isSolved) {
          piece.x = correctX;
          piece.y = correctY;
          piece.angle = 0;
          piece.inTray = false;
        } else if (typeof saved.inTray === 'boolean') {
          piece.inTray = saved.inTray;
        } else {
          piece.inTray = true;
        }
        if (piece.inTray) {
          piece.x = correctX;
          piece.y = correctY;
        }
      } else {
        this.shuffleToTray(piece, trayRng);
      }
      this.pieces.set(piece.id, piece);
    }
    this.initTrayOrder(init, trayRng, savedMap);
  }

  private initTrayOrder(
    init: SessionInit,
    rng: SeededRng,
    savedMap: Map<PieceId, { trayIndex?: number }>,
  ) {
    const tray = this.getPieces().filter((p) => p.inTray && !p.isSolved);
    if (init.mode === 'resume') {
      tray.sort((a, b) => {
        const ia = savedMap.get(a.id)?.trayIndex;
        const ib = savedMap.get(b.id)?.trayIndex;
        if (typeof ia === 'number' && typeof ib === 'number' && ia !== ib) return ia - ib;
        if (typeof ia === 'number') return -1;
        if (typeof ib === 'number') return 1;
        return a.col - b.col || a.row - b.row;
      });
    } else {
      for (let i = tray.length - 1; i > 0; i--) {
        const j = rng.between(0, i);
        const tmp = tray[i]!;
        tray[i] = tray[j]!;
        tray[j] = tmp;
      }
    }
    tray.forEach((p, i) => {
      p.trayIndex = i;
    });
  }

  private reindexTray(insert?: { id: PieceId; index?: number }) {
    const moving = insert ? this.pieces.get(insert.id) : undefined;
    const tray = this.getPieces()
      .filter((p) => p.inTray && !p.isSolved && p.id !== insert?.id)
      .sort((a, b) => a.trayIndex - b.trayIndex);
    if (moving && moving.inTray) {
      const idx =
        insert?.index === undefined ? tray.length : Math.max(0, Math.min(insert.index, tray.length));
      tray.splice(idx, 0, moving);
    }
    tray.forEach((p, i) => {
      p.trayIndex = i;
    });
  }

  private shuffleToTray(piece: PieceState, rng: SeededRng) {
    piece.inTray = true;
    piece.x = piece.correctX;
    piece.y = piece.correctY;
    piece.angle = rng.pick([0, 90, 180, 270]);
    piece.isSolved = false;
  }

  private emit(event: SessionEvent) {
    this.listeners.forEach((fn) => fn(event));
  }
}

export function makeScatterBounds(imageWidth: number, imageHeight: number): ScatterBounds {
  const margin = BOARD_WORLD_PAD;
  return {
    world: { x: 0, y: 0, width: imageWidth + margin * 2, height: imageHeight + margin * 2 },
    board: { x: margin, y: margin, width: imageWidth, height: imageHeight },
  };
}
