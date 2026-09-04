import { describe, expect, it } from 'vitest';
import { MemoryStorage, ProgressStore } from '../data/ProgressStore';
import { buildJigsawLayout } from './jigsaw';
import { packEntries, type PowerupPack } from './powerups';
import { makePieceId } from './pieceId';
import { makeScatterBounds, PuzzleSession } from './PuzzleSession';

function makeSession(mode: 'fresh' | 'resume' | 'replay' = 'fresh', extras: Partial<ConstructorParameters<typeof PuzzleSession>[0]> = {}) {
  const store = extras.store ?? new ProgressStore(new MemoryStorage());
  const level = extras.level ?? { id: 'level_1', title: 'Test', difficulty: 4, imageKey: 't', imageUrl: 't.jpg' };
  const layout = extras.layout ?? buildJigsawLayout(level.id, 400, 400, 4);
  const bounds = extras.bounds ?? makeScatterBounds(400, 400);
  return new PuzzleSession({
    special: false,
    now: () => 1_000,
    ...extras,
    level,
    layout,
    bounds,
    mode,
    store,
  });
}

function makeCampaignSession(
  levelNum: number,
  store: ProgressStore,
  mode: 'fresh' | 'resume' | 'replay' = 'fresh',
) {
  const id = `level_${levelNum}`;
  return makeSession(mode, {
    store,
    level: { id, title: 'Test', difficulty: 4, imageKey: 't', imageUrl: 't.jpg' },
    layout: buildJigsawLayout(id, 400, 400, 4),
  });
}

describe('PuzzleSession', () => {
  it('assigns stable col/row ids and puts unsolved pieces in the tray', () => {
    const session = makeSession('fresh');
    const ids = session.getPieces().map((p) => p.id).sort();
    expect(ids).toContain(makePieceId('level_1', 0, 0));
    expect(session.getPieces().every((p) => !p.isSolved && p.inTray)).toBe(true);
    const angles = new Set(session.getPieces().map((p) => p.angle));
    expect([...angles].every((a) => a === 0 || a === 90 || a === 180 || a === 270)).toBe(true);
  });

  it('places a piece through the single snap path and wins', () => {
    const session = makeSession('fresh');
    const events: string[] = [];
    session.on((e) => events.push(e.type));
    for (const piece of session.getPieces()) {
      session.movePiece(piece.id, piece.correctX, piece.correctY);
      piece.angle = 0;
      expect(session.trySnap(piece.id)).toBe(true);
    }
    expect(events).toContain('won');
    expect(session.getProgress()).toEqual({ solved: 4, total: 4 });
    expect(session.hasWon).toBe(true);
  });

  it('does not restore a solved session after a win', () => {
    const store = new ProgressStore(new MemoryStorage());
    const session = makeSession('fresh', { store });
    for (const piece of session.getPieces()) {
      session.movePiece(piece.id, piece.correctX, piece.correctY);
      piece.angle = 0;
      session.trySnap(piece.id);
    }
    expect(session.hasWon).toBe(true);
    session.save();
    expect(store.getSession()).toBeNull();
    expect(store.getBestMs('level_1')).not.toBeNull();
  });

  it('hint consumes inventory only after confirm', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.setPowerups({ ...store.getPowerups(), hint: 1 });
    const session = makeSession('fresh', { store });
    expect(session.getInventory().hint).toBe(1);
    const id = session.queueHint(0, 0);
    expect(id).toBeTruthy();
    expect(session.getInventory().hint).toBe(1);
    expect(session.confirmHint(id!)).toBe(true);
    expect(session.getInventory().hint).toBe(0);
    expect(session.getPiece(id!)?.isSolved).toBe(true);
  });

  it('lucky consumes after confirm and solver places a 3×3', () => {
    const luckyStore = new ProgressStore(new MemoryStorage());
    luckyStore.setPowerups({ ...luckyStore.getPowerups(), lucky: 1 });
    const session = makeSession('fresh', { store: luckyStore });
    expect(session.getInventory().lucky).toBe(1);
    const luckyId = session.queueLucky();
    expect(luckyId).toBeTruthy();
    expect(session.getInventory().lucky).toBe(1);
    expect(session.confirmLucky(luckyId!)).toBe(true);
    expect(session.getInventory().lucky).toBe(0);

    const store = new ProgressStore(new MemoryStorage());
    store.setPowerups({ ...store.getPowerups(), solver: 1 });
    const solverSession = makeSession('fresh', { store });
    const ids = solverSession.queueSolver(0, 0, 3);
    expect(ids.length).toBeGreaterThan(0);
    expect(solverSession.getInventory().solver).toBe(0);
    expect(solverSession.queueSolver(0, 0, 3)).toEqual([]);
    for (const id of ids) expect(solverSession.confirmSolver(id)).toBe(true);
  });

  it('resumes from saved piece ids, not array indexes', () => {
    const first = makeSession('fresh');
    const piece = first.getPiece(makePieceId('level_1', 1, 1))!;
    first.movePiece(piece.id, 12, 34);
    const saved = {
      version: 4 as const,
      levelId: 'level_1',
      pieces: first.getPieces().map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        angle: p.angle,
        isSolved: p.isSolved,
        inTray: p.inTray,
      })),
      revealPermanent: false,
      elapsedMs: 5000,
      lastUpdated: 1,
    };
    const resumed = makeSession('resume', { saved });
    expect(resumed.getPiece(piece.id)?.x).toBe(12);
    expect(resumed.getPiece(piece.id)?.y).toBe(34);
    expect(resumed.getElapsed()).toBe(5000);
  });

  it('grants campaign first-clear pack once when unlock bumps', () => {
    const store = new ProgressStore(new MemoryStorage());
    const before = store.getPowerups();
    const session = makeSession('fresh', { store });
    const wins: { rewards: PowerupPack | null; allowWinDouble: boolean; replayFarm: boolean }[] = [];
    session.on((e) => {
      if (e.type === 'won') wins.push({ rewards: e.rewards, allowWinDouble: e.allowWinDouble, replayFarm: e.replayFarm });
    });
    solveAll(session);
    expect(wins[0]).toEqual({ rewards: { hint: 1 }, allowWinDouble: false, replayFarm: false });
    expect(store.getPowerups().hint).toBe(before.hint + 1);

    const again = makeSession('fresh', { store });
    const second: unknown[] = [];
    again.on((e) => {
      if (e.type === 'won') second.push(e.rewards);
    });
    solveAll(again);
    expect(second[0]).toBeNull();
    expect(store.getPowerups().hint).toBe(before.hint + 1);
  });

  it('grants the Área recipe on first clear of level 4 and random commons from level 5', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.completeLevel(0);
    store.completeLevel(1);
    store.completeLevel(2);
    const four = makeCampaignSession(4, store);
    const rewards: unknown[] = [];
    four.on((e) => {
      if (e.type === 'won') rewards.push(e.rewards, e.allowWinDouble);
    });
    solveAll(four);
    expect(rewards[0]).toEqual({ hint: 6, lucky: 3, reveal_temp: 1 });
    expect(rewards[1]).toBe(false);

    const fiveStore = new ProgressStore(new MemoryStorage());
    for (let i = 0; i < 4; i++) fiveStore.completeLevel(i);
    const five = makeCampaignSession(5, fiveStore);
    const fiveWins: { rewards: PowerupPack | null; allowWinDouble: boolean }[] = [];
    five.on((e) => {
      if (e.type === 'won') fiveWins.push({ rewards: e.rewards, allowWinDouble: e.allowWinDouble });
    });
    solveAll(five);
    const pack = fiveWins[0]!.rewards as PowerupPack;
    expect(packEntries(pack)).toHaveLength(1);
    expect(['hint', 'lucky', 'reveal_temp']).toContain(packEntries(pack)[0]!.id);
    expect(fiveWins[0]!.allowWinDouble).toBe(true);
  });

  it('does not grant on replay', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.completeLevel(0);
    const before = store.getPowerups();
    const session = makeSession('fresh', { store });
    const wins: { rewards: PowerupPack | null; replayFarm: boolean }[] = [];
    session.on((e) => {
      if (e.type === 'won') wins.push({ rewards: e.rewards, replayFarm: e.replayFarm });
    });
    solveAll(session);
    expect(store.getPowerups()).toEqual(before);
    expect(wins[0]).toEqual({ rewards: null, replayFarm: true });
  });

  it('grants event packs once per period', () => {
    const store = new ProgressStore(new MemoryStorage());
    const before = store.getPowerups();
    const day = Date.UTC(2026, 7, 31, 12);
    const session = makeEventSession(store, 'daily', day);
    const rewards: unknown[] = [];
    session.on((e) => {
      if (e.type === 'won') rewards.push(e.rewards);
    });
    solveAll(session);
    expect(rewards[0]).toEqual({ hint: 2, lucky: 2, reveal_temp: 2 });
    expect(store.getPowerups().hint).toBe(before.hint + 2);

    const sameDay = makeEventSession(store, 'daily', day);
    const again: unknown[] = [];
    sameDay.on((e) => {
      if (e.type === 'won') again.push(e.rewards);
    });
    solveAll(sameDay);
    expect(again[0]).toBeNull();
    expect(store.getPowerups().hint).toBe(before.hint + 2);

    const nextDay = makeEventSession(store, 'daily', Date.UTC(2026, 8, 1, 12));
    solveAll(nextDay);
    expect(store.getPowerups().hint).toBe(before.hint + 4);
  });

  it('drops a piece onto the board and returns it to the tray', () => {
    const session = makeSession('fresh');
    const piece = session.getPieces()[0]!;
    expect(piece.inTray).toBe(true);
    session.movePiece(piece.id, piece.correctX + 40, piece.correctY + 40);
    expect(session.getPiece(piece.id)?.inTray).toBe(false);
    expect(session.returnToTray(piece.id)).toBe(true);
    expect(session.getPiece(piece.id)?.inTray).toBe(true);
  });

  it('rotates a tray piece without leaving the tray', () => {
    const session = makeSession('fresh');
    const piece = session.getPieces()[0]!;
    const start = piece.angle;
    session.rotatePiece(piece.id);
    expect(session.getPiece(piece.id)?.inTray).toBe(true);
    expect(session.getPiece(piece.id)?.angle).toBe((start + 90) % 360);
  });

  it('migrates v3 unsolved pieces into the tray', () => {
    const first = makeSession('fresh');
    const piece = first.getPiece(makePieceId('level_1', 0, 0))!;
    const saved = {
      version: 3 as const,
      levelId: 'level_1',
      pieces: first.getPieces().map((p) => ({
        id: p.id,
        x: p.id === piece.id ? 12 : p.correctX,
        y: p.id === piece.id ? 34 : p.correctY,
        angle: p.angle,
        isSolved: p.isSolved,
      })),
      revealPermanent: false,
      elapsedMs: 1200,
      lastUpdated: 1,
    };
    const resumed = makeSession('resume', { saved });
    expect(resumed.getPiece(piece.id)?.inTray).toBe(true);
    expect(resumed.getElapsed()).toBe(1200);
  });

  it('resumes v4 pieces that were left on the board', () => {
    const store = new ProgressStore(new MemoryStorage());
    const first = makeSession('fresh', { store });
    const piece = first.getPiece(makePieceId('level_1', 1, 1))!;
    first.movePiece(piece.id, 80, 90);
    first.save();
    const saved = store.getSession();
    expect(saved?.version).toBe(4);
    const resumed = makeSession('resume', { saved, store });
    expect(resumed.getPiece(piece.id)?.inTray).toBe(false);
    expect(resumed.getPiece(piece.id)?.x).toBe(80);
    expect(resumed.getPiece(piece.id)?.y).toBe(90);
  });

  it('inserts a returned piece at the requested tray index', () => {
    const session = makeSession('fresh');
    const tray = session.getTrayPieces();
    expect(tray.length).toBe(4);
    const a = tray[0]!;
    const b = tray[1]!;
    const c = tray[2]!;
    const d = tray[3]!;
    session.movePiece(b.id, 80, 90);
    session.returnToTray(b.id, 0);
    expect(session.getTrayPieces().map((p) => p.id)).toEqual([b.id, a.id, c.id, d.id]);
  });

  it('keeps infinite reveal on resume until the level is solved', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.setPowerups({ ...store.getPowerups(), reveal_perm: 2 });
    const first = makeSession('fresh', { store });
    expect(first.activatePermanentReveal()).toBe(true);
    expect(first.getReveal().permanent).toBe(true);
    expect(first.activatePermanentReveal()).toBe(false);
    expect(store.getPowerups().reveal_perm).toBe(1);
    const saved = store.getSession();
    expect(saved?.revealPermanent).toBe(true);
    const resumed = makeSession('resume', { saved, store });
    expect(resumed.getReveal().permanent).toBe(true);
  });

  it('does not clear another campaign save when a different level is replayed', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.setPowerups({ ...store.getPowerups(), reveal_perm: 1 });
    const open = makeSession('fresh', { store });
    expect(open.activatePermanentReveal()).toBe(true);
    expect(store.getSession()?.levelId).toBe('level_1');

    const layout = buildJigsawLayout('level_2', 400, 400, 4);
    const replay = new PuzzleSession({
      level: { id: 'level_2', title: 'Two', difficulty: 4, imageKey: 't', imageUrl: 't.jpg' },
      layout,
      bounds: makeScatterBounds(400, 400),
      mode: 'replay',
      special: false,
      store,
    });
    store.clearCampaignSessionIf('level_2');
    solveAll(replay);
    expect(store.getSession()?.levelId).toBe('level_1');
    expect(store.getSession()?.revealPermanent).toBe(true);

    const scatter = new PuzzleSession({
      level: { id: 'level_2', title: 'Two', difficulty: 4, imageKey: 't', imageUrl: 't.jpg' },
      layout,
      bounds: makeScatterBounds(400, 400),
      mode: 'fresh',
      special: false,
      store,
      skipCampaignSave: true,
    });
    const piece = scatter.getPieces()[0]!;
    scatter.movePiece(piece.id, 10, 10);
    scatter.save();
    expect(store.getSession()?.levelId).toBe('level_1');
    expect(store.getSession()?.revealPermanent).toBe(true);
  });
});

function solveAll(session: PuzzleSession) {
  for (const piece of session.getPieces()) {
    session.movePiece(piece.id, piece.correctX, piece.correctY);
    piece.angle = 0;
    session.trySnap(piece.id);
  }
}

function makeEventSession(store: ProgressStore, eventType: 'daily' | 'weekly' | 'monthly', nowMs: number) {
  const layout = buildJigsawLayout(`event_${eventType}`, 400, 400, 4);
  const bounds = makeScatterBounds(400, 400);
  return new PuzzleSession({
    level: {
      id: `event_${eventType}`,
      title: eventType,
      difficulty: 4,
      imageKey: 't',
      imageUrl: 't.jpg',
      eventType,
    },
    layout,
    bounds,
    mode: 'fresh',
    special: true,
    store,
    now: () => nowMs,
  });
}
