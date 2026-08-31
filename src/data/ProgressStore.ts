import { DEFAULT_POWERUPS, DEV_POWERUP_CHARGES, type PowerupKey } from '../domain/product';
import type { SavedSession } from '../domain/types';
import type { PowerupCounts } from '../domain/inventory';
import { applyPack, craft, createInventory } from '../domain/inventory';
import {
  AD_COMMON_DAILY_CAP,
  eventGrant,
  eventPeriodKey,
  GRANT_CAMPAIGN_FIRST_CLEAR,
  randomCommonId,
  utcDateKey,
  type PowerupPack,
} from '../domain/powerups';

const PROGRESS_KEY = 'puzzle_adventure_progress_v2';
const SESSION_KEY = 'puzzle_adventure_session_v3';
const SPECIAL_SESSIONS_KEY = 'puzzle_adventure_special_sessions_v3';
const TIMES_KEY = 'puzzle_adventure_times_v1';
const POWERUPS_KEY = 'puzzle_adventure_powerups_v1';
const LOCALE_KEY = 'puzzle_adventure_locale_v1';
const CLAIMS_KEY = 'puzzle_adventure_claims_v1';
const LEGACY_SESSION_KEY = 'puzzle_adventure_active_session';
const LEGACY_SPECIAL_KEY = 'puzzle_adventure_special_sessions_v1';
const POCKET_KEY_PREFIX = 'pockets:';

export class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.data.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

export interface LevelTime {
  bestMs: number;
  lastMs: number;
  clears: number;
}

interface EconomyClaims {
  eventPeriods: Record<string, string>;
  adsDate: string;
  adsCount: number;
}

export class ProgressStore {
  private static instance: ProgressStore | null = null;
  private highestUnlockedIndex = 0;
  private specialSessions: Record<string, SavedSession> = {};
  private powerups: PowerupCounts = createInventory();
  private times: Record<string, LevelTime> = {};
  private locale: string | null = null;
  private claims: EconomyClaims = { eventPeriods: {}, adsDate: '', adsCount: 0 };

  constructor(private storage: Storage = localStorage) {
    this.loadProgress();
    this.loadSpecialSessions();
    this.loadPowerups();
    this.loadTimes();
    this.loadLocale();
    this.loadClaims();
    this.purgePockets();
  }

  static getInstance(): ProgressStore {
    if (!ProgressStore.instance) {
      ProgressStore.instance = new ProgressStore();
    }
    return ProgressStore.instance;
  }

  private loadProgress() {
    const stored = this.storage.getItem(PROGRESS_KEY);
    if (stored) {
      this.highestUnlockedIndex = parseInt(stored, 10) || 0;
      return;
    }
    const oldStored = this.storage.getItem('puzzle_adventure_progress');
    if (oldStored) {
      try {
        const arr = JSON.parse(oldStored);
        this.highestUnlockedIndex = Math.max(0, arr.length - 1);
      } catch {
        this.highestUnlockedIndex = 0;
      }
    }
    this.saveProgress();
  }

  private saveProgress() {
    this.storage.setItem(PROGRESS_KEY, this.highestUnlockedIndex.toString());
  }

  private loadSpecialSessions() {
    const stored = this.storage.getItem(SPECIAL_SESSIONS_KEY) ?? this.storage.getItem(LEGACY_SPECIAL_KEY);
    if (!stored) {
      this.specialSessions = {};
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Record<string, SavedSession>;
      this.specialSessions = {};
      for (const [id, session] of Object.entries(parsed)) {
        if (session?.version === 3) this.specialSessions[id] = session;
      }
    } catch {
      this.specialSessions = {};
    }
  }

  private saveSpecialSessions() {
    this.storage.setItem(SPECIAL_SESSIONS_KEY, JSON.stringify(this.specialSessions));
  }

  private loadPowerups() {
    const stored = this.storage.getItem(POWERUPS_KEY);
    if (!stored) {
      this.powerups = createInventory();
      return;
    }
    try {
      this.powerups = { ...DEFAULT_POWERUPS, ...JSON.parse(stored) };
    } catch {
      this.powerups = createInventory();
    }
  }

  private savePowerups() {
    this.storage.setItem(POWERUPS_KEY, JSON.stringify(this.powerups));
  }

  private loadTimes() {
    const stored = this.storage.getItem(TIMES_KEY);
    if (!stored) {
      this.times = {};
      return;
    }
    try {
      this.times = JSON.parse(stored) as Record<string, LevelTime>;
    } catch {
      this.times = {};
    }
  }

  private saveTimes() {
    this.storage.setItem(TIMES_KEY, JSON.stringify(this.times));
  }

  private loadLocale() {
    const stored = this.storage.getItem(LOCALE_KEY);
    this.locale = stored && stored.length > 0 ? stored : null;
  }

  getLocale(): string | null {
    return this.locale;
  }

  setLocale(id: string) {
    this.locale = id;
    this.storage.setItem(LOCALE_KEY, id);
  }

  private loadClaims() {
    const stored = this.storage.getItem(CLAIMS_KEY);
    if (!stored) {
      this.claims = { eventPeriods: {}, adsDate: '', adsCount: 0 };
      return;
    }
    try {
      const parsed = JSON.parse(stored) as Partial<EconomyClaims>;
      this.claims = {
        eventPeriods: parsed.eventPeriods ?? {},
        adsDate: parsed.adsDate ?? '',
        adsCount: parsed.adsCount ?? 0,
      };
    } catch {
      this.claims = { eventPeriods: {}, adsDate: '', adsCount: 0 };
    }
  }

  private saveClaims() {
    this.storage.setItem(CLAIMS_KEY, JSON.stringify(this.claims));
  }

  grantPack(pack: PowerupPack): PowerupCounts {
    this.powerups = applyPack(this.powerups, pack);
    this.savePowerups();
    return this.getPowerups();
  }

  craftPowerup(from: PowerupKey): boolean {
    const next = craft(this.powerups, from);
    if (!next) return false;
    this.powerups = next;
    this.savePowerups();
    return true;
  }

  /** True when this clear newly unlocks the next campaign level. */
  completeLevel(levelIndex: number): boolean {
    const nextIndex = levelIndex + 1;
    if (nextIndex > this.highestUnlockedIndex) {
      this.highestUnlockedIndex = nextIndex;
      this.saveProgress();
      return true;
    }
    return false;
  }

  tryClaimCampaignFirstClear(didUnlock: boolean): PowerupPack | null {
    if (!didUnlock) return null;
    this.grantPack(GRANT_CAMPAIGN_FIRST_CLEAR);
    return { ...GRANT_CAMPAIGN_FIRST_CLEAR };
  }

  tryClaimEventReward(
    eventType: 'daily' | 'weekly' | 'monthly',
    eventId: string,
    nowMs: number,
  ): PowerupPack | null {
    const period = eventPeriodKey(eventType, nowMs);
    if (this.claims.eventPeriods[eventId] === period) return null;
    const pack = eventGrant(eventType);
    this.claims.eventPeriods[eventId] = period;
    this.saveClaims();
    this.grantPack(pack);
    return { ...pack };
  }

  adsRemainingToday(nowMs: number = Date.now()): number {
    const day = utcDateKey(nowMs);
    if (this.claims.adsDate !== day) return AD_COMMON_DAILY_CAP;
    return Math.max(0, AD_COMMON_DAILY_CAP - this.claims.adsCount);
  }

  /** DEV / later rewarded-ad: one random common, 5 per UTC day. */
  tryClaimAdCommon(nowMs: number = Date.now(), rng?: () => number): PowerupPack | null {
    const day = utcDateKey(nowMs);
    if (this.claims.adsDate !== day) {
      this.claims.adsDate = day;
      this.claims.adsCount = 0;
    }
    if (this.claims.adsCount >= AD_COMMON_DAILY_CAP) return null;
    this.claims.adsCount += 1;
    this.saveClaims();
    const id = randomCommonId(rng);
    const pack: PowerupPack = { [id]: 1 };
    this.grantPack(pack);
    return pack;
  }

  private purgePockets() {
    const toRemove: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(POCKET_KEY_PREFIX)) toRemove.push(key);
    }
    toRemove.forEach((k) => this.storage.removeItem(k));
    this.storage.removeItem(LEGACY_SESSION_KEY);
  }

  isLevelUnlocked(levelId: string): boolean {
    if (!levelId.startsWith('level_')) return true;
    const num = parseInt(levelId.replace('level_', ''), 10);
    return num - 1 <= this.highestUnlockedIndex;
  }

  isLevelCompleted(levelId: string): boolean {
    if (!levelId.startsWith('level_')) return false;
    const num = parseInt(levelId.replace('level_', ''), 10);
    return num - 1 < this.highestUnlockedIndex;
  }

  getHighestUnlockedIndex() {
    return this.highestUnlockedIndex;
  }

  resetProgress() {
    this.highestUnlockedIndex = 0;
    this.saveProgress();
    this.storage.removeItem('puzzle_adventure_progress');
    this.clearSession();
  }

  /** Dev helper: wipe daily / weekly / monthly in-progress saves. */
  resetSpecialEvents() {
    this.specialSessions = {};
    this.storage.removeItem(SPECIAL_SESSIONS_KEY);
    this.storage.removeItem(LEGACY_SPECIAL_KEY);
    for (const id of Object.keys(this.times)) {
      if (id.startsWith('event_')) delete this.times[id];
    }
    this.saveTimes();
    this.claims.eventPeriods = {};
    this.saveClaims();
  }

  saveSession(session: SavedSession) {
    this.storage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  getSession(): SavedSession | null {
    return this.parseSession(this.storage.getItem(SESSION_KEY));
  }

  clearSession() {
    this.storage.removeItem(SESSION_KEY);
    this.storage.removeItem(LEGACY_SESSION_KEY);
  }

  saveSpecialSession(session: SavedSession) {
    this.specialSessions[session.levelId] = session;
    this.saveSpecialSessions();
  }

  getSpecialSession(levelId: string): SavedSession | null {
    return this.specialSessions[levelId] ?? null;
  }

  clearSpecialSession(levelId: string) {
    delete this.specialSessions[levelId];
    this.saveSpecialSessions();
  }

  recordClear(levelId: string, elapsedMs: number): { bestMs: number; lastMs: number; isRecord: boolean } {
    const prev = this.times[levelId];
    const isRecord = !prev || elapsedMs < prev.bestMs;
    const next: LevelTime = {
      bestMs: prev ? Math.min(prev.bestMs, elapsedMs) : elapsedMs,
      lastMs: elapsedMs,
      clears: (prev?.clears ?? 0) + 1,
    };
    this.times[levelId] = next;
    this.saveTimes();
    return { bestMs: next.bestMs, lastMs: elapsedMs, isRecord };
  }

  getBestMs(levelId: string): number | null {
    const best = this.times[levelId]?.bestMs;
    return typeof best === 'number' ? best : null;
  }

  getPowerups(): PowerupCounts {
    return { ...this.powerups };
  }

  setPowerups(counts: PowerupCounts) {
    this.powerups = { ...counts };
    this.savePowerups();
  }

  /** Dev helper: set every power-up to 5. */
  resetPowerups() {
    this.powerups = {
      reveal_temp: DEV_POWERUP_CHARGES,
      area: DEV_POWERUP_CHARGES,
      hint: DEV_POWERUP_CHARGES,
      sarea: DEV_POWERUP_CHARGES,
      reveal_perm: DEV_POWERUP_CHARGES,
    };
    this.savePowerups();
  }

  private parseSession(raw: string | null): SavedSession | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as SavedSession;
      if (parsed?.version !== 3 || !Array.isArray(parsed.pieces)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}
