export interface TimerSnapshot {
  levelId: string;
  elapsedMs: number;
  updatedAt: number;
}

export class TimerStore {
  private static instance: TimerStore;

  private levelId: string = '';
  private elapsedMs: number = 0;
  private isRunning: boolean = false;
  private lastPersistAt: number = 0;
  private readonly persistEveryMs = 2000;

  public static getInstance() {
    if (!TimerStore.instance) {
      TimerStore.instance = new TimerStore();
    }
    return TimerStore.instance;
  }

  private storageKey(levelId: string) {
    return `timer:${levelId}`;
  }

  start(levelId: string, initialMs: number = 0) {
    this.levelId = levelId;
    this.elapsedMs = initialMs;
    this.isRunning = true;
    this.lastPersistAt = Date.now();
    this.persist(true);
  }

  resume() {
    if (!this.levelId) return;
    this.isRunning = true;
  }

  pause() {
    this.isRunning = false;
  }

  tick(deltaMs: number) {
    if (!this.isRunning || !this.levelId) return;
    this.elapsedMs += deltaMs;
    const now = Date.now();
    if (now - this.lastPersistAt >= this.persistEveryMs) {
      this.persist();
    }
  }

  setElapsed(ms: number) {
    this.elapsedMs = ms;
  }

  getElapsed() {
    return this.elapsedMs;
  }

  persist(force: boolean = false) {
    if (!this.levelId) return;
    const now = Date.now();
    if (!force && now - this.lastPersistAt < this.persistEveryMs) return;
    try {
      const snapshot: TimerSnapshot = {
        levelId: this.levelId,
        elapsedMs: this.elapsedMs,
        updatedAt: now,
      };
      localStorage.setItem(this.storageKey(this.levelId), JSON.stringify(snapshot));
      this.lastPersistAt = now;
    } catch (err) {
      console.warn('TimerStore persist failed', err);
    }
  }

  restore(levelId: string): TimerSnapshot | null {
    try {
      const stored = localStorage.getItem(this.storageKey(levelId));
      if (!stored) return null;
      const snapshot: TimerSnapshot = JSON.parse(stored);
      this.levelId = snapshot.levelId;
      this.elapsedMs = snapshot.elapsedMs || 0;
      this.lastPersistAt = Date.now();
      this.isRunning = false;
      return snapshot;
    } catch (err) {
      console.warn('TimerStore restore failed', err);
      return null;
    }
  }

  clear(levelId?: string) {
    const key = levelId || this.levelId;
    if (!key) return;
    localStorage.removeItem(this.storageKey(key));
  }

  isTimerRunning() {
    return this.isRunning;
  }
}

