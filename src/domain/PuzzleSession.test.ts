import { describe, expect, it } from 'vitest';
import { MemoryStorage, ProgressStore } from '../data/ProgressStore';
import { buildJigsawLayout } from './jigsaw';
import { packEntries, type PowerupPack } from './powerups';
import { makePieceId } from './pieceId';
import { makeScatterBounds, PuzzleSession } from './PuzzleSession';

function makeSession(mode: 'fresh' | 'resume' | 'replay' = 'fresh', extras: Partial<ConstructorParameters<typeof PuzzleSession>[0]> = {}) {
  const store = new ProgressStore(new MemoryStorage());
  const layout = buildJigsawLayout('level_1', 400, 400, 4);
  const bounds = makeScatterBounds(400, 400);
  return new PuzzleSession({
    level: { id: 'level_1', title: 'Test', difficulty: 4, imageKey: 't', imageUrl: 't.jpg' },
    layout,
    bounds,
    mode,
    special: false,
    store,
    now: () => 1_000,
    ...extras,
  });
}

describe('PuzzleSession', () => {
  it('assigns stable col/row ids and scatters on fresh start', () => {
    const session = makeSession('fresh');
    const ids = session.getPieces().map((p) => p.id).sort();
    expect(ids).toContain(makePieceId('level_1', 0, 0));
    expect(session.getPieces().every((p) => !p.isSolved)).toBe(true);
    const moved = session.getPieces().filter((p) => p.x !== p.correctX || p.y !== p.correctY);
    expect(moved.length).toBeGreaterThan(0);
    const { board } = session.bounds;
    for (const piece of session.getPieces()) {
      const onBoard =
        piece.x >= board.x &&
        piece.x <= board.x + board.width &&
        piece.y >= board.y &&
        piece.y <= board.y + board.height;
      expect(onBoard).toBe(false);
    }
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
    const session = makeSession('fresh');
    const before = session.getInventory().hint;
    const id = session.queueHint(0, 0);
    expect(id).toBeTruthy();
    expect(session.getInventory().hint).toBe(before);
    expect(session.confirmHint(id!)).toBe(true);
    expect(session.getInventory().hint).toBe(before - 1);
    expect(session.getPiece(id!)?.isSolved).toBe(true);
  });

  it('resumes from saved piece ids, not array indexes', () => {
    const first = makeSession('fresh');
    const piece = first.getPiece(makePieceId('level_1', 1, 1))!;
    first.movePiece(piece.id, 12, 34);
    const saved = {
      version: 3 as const,
      levelId: 'level_1',
      pieces: first.getPieces().map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        angle: p.angle,
        isSolved: p.isSolved,
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
    const rewards: unknown[] = [];
    session.on((e) => {
      if (e.type === 'won') rewards.push(e.rewards);
    });
    solveAll(session);
    const pack = rewards[0] as PowerupPack;
    const entries = packEntries(pack);
    expect(entries).toHaveLength(1);
    expect(['hint', 'area', 'reveal_temp']).toContain(entries[0]!.id);
    expect(entries[0]!.n).toBe(1);
    const after = store.getPowerups();
    expect(after[entries[0]!.id]).toBe(before[entries[0]!.id] + 1);

    const again = makeSession('fresh', { store });
    const second: unknown[] = [];
    again.on((e) => {
      if (e.type === 'won') second.push(e.rewards);
    });
    solveAll(again);
    expect(second[0]).toBeNull();
    expect(store.getPowerups()).toEqual(after);
  });

  it('does not grant on replay', () => {
    const store = new ProgressStore(new MemoryStorage());
    store.completeLevel(0);
    const before = store.getPowerups();
    const session = makeSession('replay', { store });
    solveAll(session);
    expect(store.getPowerups()).toEqual(before);
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
    expect(rewards[0]).toEqual({ hint: 2, area: 2, reveal_temp: 2 });
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
