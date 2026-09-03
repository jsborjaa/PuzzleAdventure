import { isoWeekKey, monthKey, utcDateKey } from '../domain/powerups';
import { LEVELS, SPECIAL_LEVELS, type LevelData } from './Levels';
import { MAP_WINDOW_RADIUS, mergeExtraLevel, shiftCenter } from './catalogWindow';
import { ProgressStore } from './ProgressStore';
import { ensureImage, retainImages } from './imageCache';
import { getSupabase, isCloudConfigured, publicImageUrl } from './cloud/supabase';

const CATALOG_CACHE_KEY = 'puzzle_adventure_catalog_v1';

interface CachedCatalog {
  total: number;
  center: number;
  campaign: LevelData[];
  events: LevelData[];
}

interface RemoteLevelRow {
  id: string;
  campaign_index: number;
  piece_count: number;
  image_path: string;
  thumb_path: string;
  content_hash?: string;
}

interface RemoteEventRow {
  id: string;
  event_type: 'daily' | 'weekly' | 'monthly';
  period_key: string;
  piece_count: number;
  image_path: string;
  thumb_path: string;
}

function toCampaignLevel(row: RemoteLevelRow): LevelData {
  return {
    id: row.id,
    difficulty: row.piece_count,
    imageKey: `img_${row.id}`,
    imageUrl: publicImageUrl(row.image_path),
    thumbUrl: publicImageUrl(row.thumb_path),
    campaignIndex: row.campaign_index,
  };
}

function toEventLevel(row: RemoteEventRow): LevelData {
  return {
    id: row.id,
    difficulty: row.piece_count,
    imageKey: `img_${row.id}`,
    imageUrl: publicImageUrl(row.image_path),
    thumbUrl: publicImageUrl(row.thumb_path),
    eventType: row.event_type,
  };
}

export class LevelCatalog {
  private static instance: LevelCatalog | null = null;
  private total = LEVELS.length;
  private center = 1;
  private campaign: LevelData[] = [...LEVELS];
  private events: LevelData[] = [...SPECIAL_LEVELS];
  private byId = new Map<string, LevelData>();
  private ready: Promise<void> | null = null;

  static getInstance(): LevelCatalog {
    if (!LevelCatalog.instance) LevelCatalog.instance = new LevelCatalog();
    return LevelCatalog.instance;
  }

  ensureLoaded(): Promise<void> {
    if (!this.ready) this.ready = this.load();
    return this.ready;
  }

  getTotal(): number {
    return this.total;
  }

  getCenter(): number {
    return this.center;
  }

  getCampaignWindow(): LevelData[] {
    const lastId = ProgressStore.getInstance().getLastPlayedLevelId();
    const last = lastId && !lastId.startsWith('event_') ? this.byId.get(lastId) : undefined;
    return mergeExtraLevel(this.campaign, last);
  }

  getEvents(): LevelData[] {
    return this.events.length > 0 ? this.events : [...SPECIAL_LEVELS];
  }

  getById(id: string): LevelData | undefined {
    return this.byId.get(id) ?? LEVELS.find((l) => l.id === id) ?? SPECIAL_LEVELS.find((l) => l.id === id);
  }

  canShift(delta: number): boolean {
    return shiftCenter(this.center, delta, this.total) !== this.center;
  }

  async shift(delta: number): Promise<void> {
    const next = shiftCenter(this.center, delta, this.total);
    if (next === this.center) return;
    this.center = next;
    await this.refreshWindow();
  }

  async focusOn(center: number): Promise<void> {
    this.center = Math.min(Math.max(1, center), Math.max(1, this.total));
    await this.refreshWindow();
  }

  private rebuildIndex() {
    this.byId.clear();
    for (const row of [...LEVELS, ...SPECIAL_LEVELS, ...this.campaign, ...this.events]) {
      this.byId.set(row.id, row);
    }
  }

  private async load() {
    this.readLocalCache();
    this.center = defaultMapCenter();
    if (isCloudConfigured()) {
      try {
        await this.refreshWindow();
        await this.refreshEvents();
        this.writeLocalCache();
      } catch {
        if (this.campaign.length === 0) this.useBundled();
      }
    } else {
      this.useBundled();
    }
    this.rebuildIndex();
    await this.cacheVisible();
  }

  private useBundled() {
    this.campaign = [...LEVELS];
    this.events = [...SPECIAL_LEVELS];
    this.total = LEVELS.length;
    this.center = Math.min(Math.max(1, this.center), this.total);
  }

  private async refreshWindow() {
    const supabase = getSupabase();
    if (!supabase) {
      this.useBundled();
      this.rebuildIndex();
      return;
    }
    const { data, error } = await supabase.rpc('get_level_window', {
      p_around: this.center,
      p_radius: MAP_WINDOW_RADIUS,
    });
    if (error || !data) throw error ?? new Error('no window');
    const payload = data as { total?: number; rows?: RemoteLevelRow[] };
    this.total = typeof payload.total === 'number' && payload.total > 0 ? payload.total : LEVELS.length;
    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    this.campaign = rows.length > 0 ? rows.map(toCampaignLevel) : [...LEVELS];
    if (rows.length === 0) this.total = LEVELS.length;
    this.rebuildIndex();
    await this.cacheVisible();
  }

  private async refreshEvents() {
    const supabase = getSupabase();
    if (!supabase) return;
    const now = Date.now();
    const { data, error } = await supabase.rpc('get_current_events', {
      p_daily: utcDateKey(now),
      p_weekly: isoWeekKey(now),
      p_monthly: monthKey(now),
    });
    if (error) return;
    const rows = (data as RemoteEventRow[] | null) ?? [];
    this.events = rows.length > 0 ? rows.map(toEventLevel) : [...SPECIAL_LEVELS];
    this.rebuildIndex();
  }

  private async cacheVisible() {
    const visible = [...this.getCampaignWindow(), ...this.getEvents()];
    const keep = new Set(visible.map((l) => l.id));
    const last = ProgressStore.getInstance().getLastPlayedLevelId();
    if (last) keep.add(last);
    await Promise.all(
      visible.map((level) => ensureImage('thumb', level.id, level.thumbUrl ?? level.imageUrl)),
    );
    await retainImages(keep);
  }

  private readLocalCache() {
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CachedCatalog;
      if (Array.isArray(parsed.campaign) && parsed.campaign.length > 0) this.campaign = parsed.campaign;
      if (Array.isArray(parsed.events) && parsed.events.length > 0) this.events = parsed.events;
      if (typeof parsed.total === 'number') this.total = parsed.total;
      if (typeof parsed.center === 'number') this.center = parsed.center;
    } catch {
      // ignore corrupt cache
    }
  }

  private writeLocalCache() {
    try {
      const payload: CachedCatalog = {
        total: this.total,
        center: this.center,
        campaign: this.campaign,
        events: this.events,
      };
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // quota
    }
  }
}

export function defaultMapCenter(): number {
  return ProgressStore.getInstance().getHighestUnlockedIndex() + 1;
}
