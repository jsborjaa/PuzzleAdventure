import { isoWeekKey, monthKey, utcDateKey } from '../domain/powerups';
import { type LevelData } from './Levels';
import { campaignIndexOf, MAP_PAGE_SIZE, pageBounds, pageForIndex, pageQuery, shiftPage, sliceByPage } from './catalogWindow';
import { ProgressStore } from './ProgressStore';
import { ensureImage, retainImages } from './imageCache';
import { getSupabase, isCloudConfigured, publicImageUrl } from './cloud/supabase';

const CATALOG_CACHE_KEY = 'puzzle_adventure_catalog_v3';

export const EVENT_SLOT_TYPES = ['daily', 'weekly', 'monthly'] as const;
export type EventSlotType = (typeof EVENT_SLOT_TYPES)[number];

export interface EventSlot {
  type: EventSlotType;
  level: LevelData | undefined;
}

interface CachedCatalog {
  total: number;
  page?: number;
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
  event_type: EventSlotType;
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
  private total = 0;
  private page = 1;
  private campaign: LevelData[] = [];
  private events: LevelData[] = [];
  private known = new Map<string, LevelData>();
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

  getPage(): number {
    return this.page;
  }

  getPageBounds(): { start: number; end: number } {
    return pageBounds(this.page, this.total);
  }

  getCampaignWindow(): LevelData[] {
    return this.campaign;
  }

  getEvents(): LevelData[] {
    return this.events;
  }

  getEventSlots(): EventSlot[] {
    const byType = new Map(
      this.events.filter((row) => row.eventType).map((row) => [row.eventType, row] as const),
    );
    return EVENT_SLOT_TYPES.map((type) => ({ type, level: byType.get(type) }));
  }

  getById(id: string): LevelData | undefined {
    return this.known.get(id);
  }

  canShift(deltaPages: number): boolean {
    return shiftPage(this.page, deltaPages, this.total) !== this.page;
  }

  async shift(deltaPages: number): Promise<void> {
    const next = shiftPage(this.page, deltaPages, this.total);
    if (next === this.page) return;
    await this.refreshWindow(next);
    this.writeLocalCache();
  }

  async focusOn(index: number): Promise<void> {
    await this.refreshWindow(pageForIndex(index, this.total));
  }

  private remember(rows: LevelData[]) {
    for (const row of rows) this.known.set(row.id, row);
  }

  private async load() {
    this.readLocalCache();
    this.page = pageForIndex(ProgressStore.getInstance().getHighestUnlockedIndex() + 1, this.total);
    if (isCloudConfigured()) {
      try {
        await this.refreshWindow(this.page);
        await this.refreshEvents();
        this.writeLocalCache();
      } catch {
        await this.retainVisible();
      }
    } else {
      this.campaign = [];
      this.events = [];
      this.total = 0;
    }
  }

  private async refreshWindow(page: number = this.page) {
    const supabase = getSupabase();
    if (!supabase) {
      this.campaign = [];
      this.total = 0;
      this.page = 1;
      await this.retainVisible();
      return;
    }
    const query = pageQuery(page, this.total > 0 ? this.total : MAP_PAGE_SIZE);
    const { data, error } = await supabase.rpc('get_level_window', {
      p_around: query.around,
      p_radius: query.radius,
    });
    if (error || !data) throw error ?? new Error('no window');
    const payload = data as { total?: number; rows?: RemoteLevelRow[] };
    this.total = typeof payload.total === 'number' && payload.total > 0 ? payload.total : 0;
    this.page = shiftPage(page, 0, this.total);
    const rows = Array.isArray(payload.rows) ? payload.rows.map(toCampaignLevel) : [];
    this.campaign = this.total > 0 ? sliceByPage(rows, this.page, this.total, campaignIndexOf) : [];
    this.remember(this.campaign);
    await this.retainVisible();
  }

  private async refreshEvents() {
    const supabase = getSupabase();
    if (!supabase) {
      this.events = [];
      return;
    }
    const now = Date.now();
    const { data, error } = await supabase.rpc('get_current_events', {
      p_daily: utcDateKey(now),
      p_weekly: isoWeekKey(now),
      p_monthly: monthKey(now),
    });
    if (error) {
      this.events = [];
      return;
    }
    const rows = (data as RemoteEventRow[] | null) ?? [];
    this.events = rows.map(toEventLevel);
    this.remember(this.events);
    await this.retainVisible();
    void Promise.all(
      this.events.map((level) => ensureImage('thumb', level.id, level.thumbUrl ?? level.imageUrl)),
    );
  }

  /** Keep thumbs/full for the visible page, current events, and last-played (even if off-page). */
  private async retainVisible() {
    const keep = new Set(this.campaign.map((level) => level.id));
    for (const level of this.events) keep.add(level.id);
    const last = ProgressStore.getInstance().getLastPlayedLevelId();
    if (last) keep.add(last);
    await retainImages(keep);
  }

  private readLocalCache() {
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CachedCatalog;
      if (Array.isArray(parsed.campaign) && parsed.campaign.length > 0) {
        this.campaign = parsed.campaign;
        this.remember(parsed.campaign);
      }
      if (Array.isArray(parsed.events)) {
        this.events = parsed.events;
        this.remember(parsed.events);
      }
      if (typeof parsed.total === 'number') this.total = parsed.total;
      if (typeof parsed.page === 'number') this.page = parsed.page;
    } catch {
      // ignore corrupt cache
    }
  }

  private writeLocalCache() {
    try {
      const payload: CachedCatalog = {
        total: this.total,
        page: this.page,
        campaign: this.campaign,
        events: this.events,
      };
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // quota
    }
  }
}
