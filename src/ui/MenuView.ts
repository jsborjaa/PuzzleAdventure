import { getLevelTitle, withDevCacheBust, type LevelData } from '../data/Levels';
import { LevelCatalog, type EventSlotType } from '../data/LevelCatalog';
import { ProgressStore } from '../data/ProgressStore';
import { syncNickname } from '../data/cloud/auth';
import { ensureImage } from '../data/imageCache';
import { canCraft } from '../domain/inventory';
import { CRAFT_RECIPES, getIapSku, POWERUP_DEFS, STORE_SKUS, AD_COMMON_DAILY_CAP, packHasItems, type IapSkuId, type StoreSku } from '../domain/powerups';
import { ensureBilling, getBilling, type BillingPort, type CatalogProduct } from '../data/billing';
import { ensureAds, type AdsPort } from '../data/ads';
import { submitScore } from '../data/cloud/leaderboard';
import { boardShape } from '../domain/boardShape';
import { formatTimer } from '../domain/timer';
import { getLocale, isLocaleId, setLocale, SUPPORTED_LOCALES, t, type LocaleId } from '../i18n';
import { iconHtml, type IconName } from './icons';
import { formatPack, powerupName } from './powerupLabel';
import { openRankingSheet } from './rankingSheet';

type HubTab = 'map' | 'events' | 'store' | 'workshop';

export class MenuView {
  private root: HTMLElement;
  private body: HTMLDivElement;
  private tab: HubTab = 'map';
  private mapTurning = false;
  private billing: BillingPort | null = null;
  private ads: AdsPort | null = null;

  constructor(
    private host: HTMLElement,
    private onPlay: (levelId: string) => void,
  ) {
    host.innerHTML = '';
    this.root = el('div', 'menu-root');
    const top = el('header', 'hub-top');
    const logo = el('div', 'hub-logo');
    logo.innerHTML = `<span class="brand-top">${t('menu.brandPuzzle')}</span><span class="brand-bottom">${t('menu.brandAdventure')}</span>`;
    const gear = iconButton('gear', 'hub-gear btn btn-mint', t('menu.settings'), () => this.openSettings());
    top.append(logo, gear);

    this.body = el('div', 'hub-body');
    const dock = el('nav', 'hub-dock');
    dock.append(
      this.dockTab('map', 'map', t('dock.map')),
      this.dockTab('events', 'events', t('dock.events')),
      this.dockTab('store', 'store', t('dock.store')),
      this.dockTab('workshop', 'workshop', t('dock.workshop')),
    );

    this.root.append(top, this.body, dock);
    host.appendChild(this.root);
    this.renderPane();
  }

  private async turnPage(delta: number) {
    if (this.mapTurning) return;
    const catalog = LevelCatalog.getInstance();
    if (!catalog.canShift(delta)) return;
    this.mapTurning = true;
    const grid = this.body.querySelector('.menu-grid');
    if (grid) {
      grid.classList.add('is-paging');
      const mask = el('div', 'map-paging-mask');
      mask.textContent = t('menu.mapLoading');
      grid.appendChild(mask);
    }
    this.body.querySelectorAll<HTMLButtonElement>('.hub-slice').forEach((btn) => {
      btn.disabled = true;
    });
    try {
      await catalog.shift(delta);
    } finally {
      this.mapTurning = false;
      this.renderPane();
    }
  }

  destroy() {
    this.root.remove();
  }

  private dockTab(tab: HubTab, icon: IconName, label: string) {
    const btn = el('button', `dock-tab${this.tab === tab ? ' is-active' : ''}`);
    btn.type = 'button';
    btn.innerHTML = `${iconHtml(icon)}<span>${label}</span>`;
    btn.onclick = () => this.setTab(tab);
    return btn;
  }

  private setTab(tab: HubTab) {
    this.tab = tab;
    this.root.querySelectorAll('.dock-tab').forEach((node, i) => {
      const keys: HubTab[] = ['map', 'events', 'store', 'workshop'];
      node.classList.toggle('is-active', keys[i] === tab);
    });
    this.renderPane();
  }

  private renderPane() {
    this.body.innerHTML = '';
    if (this.tab === 'map') this.body.appendChild(this.mapPane());
    else if (this.tab === 'events') this.body.appendChild(this.eventsPane());
    else if (this.tab === 'store') this.body.appendChild(this.storePane());
    else this.body.appendChild(this.workshopPane());
  }

  private mapPane() {
    const wrap = el('div');
    const catalog = LevelCatalog.getInstance();
    const title = el('h2', 'hub-pane-title');
    title.textContent = t('menu.subtitle');
    const pos = el('p', 'hub-pane-sub');
    const range = catalog.getPageBounds();
    pos.textContent =
      catalog.getTotal() <= 0
        ? t('menu.mapEmpty')
        : t('menu.mapPosition', {
            from: range.start,
            to: range.end,
            total: catalog.getTotal(),
          });
    const nav = el('div', 'hub-map-nav');
    const prev = el('button', 'btn btn-ghost hub-slice');
    prev.type = 'button';
    prev.textContent = '‹';
    prev.title = t('menu.prevSlice');
    prev.disabled = this.mapTurning || !catalog.canShift(-1);
    prev.onclick = () => {
      void this.turnPage(-1);
    };
    const next = el('button', 'btn btn-ghost hub-slice');
    next.type = 'button';
    next.textContent = '›';
    next.title = t('menu.nextSlice');
    next.disabled = this.mapTurning || !catalog.canShift(1);
    next.onclick = () => {
      void this.turnPage(1);
    };
    nav.append(prev, pos, next);

    const grid = el('div', 'menu-grid');
    const store = ProgressStore.getInstance();
    const currentId = currentUnlockId(store);
    catalog.getCampaignWindow().forEach((level) => {
      const index = (level.campaignIndex ?? parseInt(level.id.replace('level_', ''), 10)) - 1;
      const unlocked = store.isLevelUnlocked(level.id);
      const card = this.card(level, Number.isFinite(index) ? index : null, unlocked, store.getBestMs(level.id));
      if (unlocked && level.id === currentId && store.getBestMs(level.id) === null) {
        card.classList.add('is-current');
      }
      grid.appendChild(card);
    });
    wrap.append(title, nav, grid);
    return wrap;
  }

  private eventsPane() {
    const wrap = el('div');
    const title = el('h2', 'hub-pane-title');
    title.textContent = t('menu.events');
    const islands = el('div', 'event-islands');
    const store = ProgressStore.getInstance();
    for (const slot of LevelCatalog.getInstance().getEventSlots()) {
      islands.appendChild(
        slot.level
          ? this.eventIsland(slot.level, store.getBestMs(slot.level.id))
          : this.emptyEventIsland(slot.type),
      );
    }
    wrap.append(title, islands);
    return wrap;
  }

  private workshopPane() {
    const wrap = el('div', 'pane-stack');
    const title = el('h2', 'hub-pane-title');
    title.textContent = t('workshop.title');
    const sub = el('p', 'hub-pane-sub');
    sub.textContent = t('workshop.subtitle');
    const card = el('div', 'cream-card');
    const stockTitle = el('p');
    stockTitle.textContent = t('workshop.stock');
    const stock = el('ul', 'menu-stock');
    const fillStock = () => {
      const counts = ProgressStore.getInstance().getPowerups();
      stock.innerHTML = '';
      for (const def of POWERUP_DEFS) {
        const li = el('li');
        li.textContent = t('hud.rewardItem', { name: powerupName(def.id), n: counts[def.id] ?? 0 });
        stock.appendChild(li);
      }
    };
    fillStock();
    const craftBtns: HTMLButtonElement[] = [];
    for (const recipe of CRAFT_RECIPES) {
      const craftBtn = el('button', recipe.to === 'reveal_perm' ? 'btn btn-mint' : 'btn btn-coral');
      craftBtn.type = 'button';
      craftBtn.textContent = t('workshop.craftTo', {
        cost: formatPack(recipe.cost),
        name: powerupName(recipe.to),
      });
      craftBtn.onclick = () => {
        ProgressStore.getInstance().craftPowerup(recipe.to);
        fillStock();
        syncCraft();
      };
      craftBtns.push(craftBtn);
    }
    const syncCraft = () => {
      const counts = ProgressStore.getInstance().getPowerups();
      CRAFT_RECIPES.forEach((recipe, i) => {
        const btn = craftBtns[i];
        if (!btn) return;
        btn.disabled = !canCraft(counts, recipe.to);
      });
    };
    syncCraft();
    card.append(stockTitle, stock, ...craftBtns);
    wrap.append(title, sub, card);
    return wrap;
  }

  private storePane() {
    const wrap = el('div', 'pane-stack');
    const title = el('h2', 'hub-pane-title');
    title.textContent = t('store.title');
    const sub = el('p', 'hub-pane-sub');
    sub.textContent = t('store.subtitle');
    wrap.append(title, sub);
    const status = el('p', 'hub-pane-sub');
    wrap.appendChild(status);

    if (!this.billing || !this.ads) {
      sub.textContent = t('store.loading');
      void Promise.all([ensureBilling(), ensureAds()]).then(([billing, ads]) => {
        this.billing = billing;
        this.ads = ads;
        this.deliverQueued(billing);
        if (this.tab === 'store') this.renderPane();
      });
      return wrap;
    }

    const billing = this.billing;
    const ads = this.ads;
    this.deliverQueued(billing);
    const products = billing.getProducts();

    for (const sku of STORE_SKUS) {
      const card = el('div', 'cream-card');
      const name = el('h3');
      const body = el('p');
      const action = el('button', 'btn');
      action.type = 'button';
      if (sku.id === 'ad_common') {
        name.textContent = t('store.adTitle');
        body.textContent = t('store.adBody', { n: AD_COMMON_DAILY_CAP });
        const leftover = el('p');
        const refreshAd = () => {
          const left = ProgressStore.getInstance().adsRemainingToday();
          leftover.textContent = left <= 0 ? t('store.adCap') : t('store.adLeft', { n: left });
          action.disabled = left <= 0 || !ads.available;
        };
        if (!ads.available) {
          action.textContent = t('store.adUnavailable');
          action.disabled = true;
        } else {
          action.textContent = ads.simulated ? t('store.adSimulate') : t('store.adWatch');
          action.onclick = () => {
            void this.watchAd(action, status, refreshAd);
          };
        }
        refreshAd();
        card.append(name, body, leftover, action);
      } else {
        const iap = sku as StoreSku & { id: IapSkuId; kind: 'iap' };
        const catalog = products.find((row) => row.id === iap.id);
        name.textContent = iap.id === 'pack_handy' ? t('store.packHandy') : t('store.packRare');
        body.textContent = formatPack(iap.pack);
        const hint = el('p');
        hint.textContent = iap.id === 'pack_handy' ? t('store.packHandyHint') : t('store.packRareHint');
        action.textContent = iapActionLabel(billing, catalog);
        action.onclick = () => {
          void this.buyIap(iap, action, status, catalog);
        };
        card.append(name, body, hint, action);
      }
      wrap.appendChild(card);
    }
    return wrap;
  }

  private deliverQueued(billing: BillingPort) {
    for (const id of billing.drainQueued()) {
      const sku = getIapSku(id);
      if (!sku) continue;
      ProgressStore.getInstance().grantPack(sku.pack);
    }
  }

  private async watchAd(
    action: HTMLButtonElement,
    status: HTMLElement,
    refreshAd: () => void,
  ) {
    const ads = this.ads ?? (await ensureAds());
    if (ProgressStore.getInstance().adsRemainingToday() <= 0) {
      refreshAd();
      status.textContent = t('store.adCap');
      return;
    }
    if (ads.simulated && !confirm(t('store.adSimulateConfirm'))) return;
    action.disabled = true;
    action.textContent = t('store.adWatching');
    const result = await ads.watchRewarded();
    if (result.status === 'rewarded') {
      const pack = ProgressStore.getInstance().tryClaimAdCommon();
      status.textContent = packHasItems(pack) ? t('store.granted', { name: formatPack(pack!) }) : t('store.adCap');
    } else if (result.status === 'cancelled') {
      status.textContent = t('store.adCancelled');
    } else {
      status.textContent = result.message === 'unavailable' ? t('store.adUnavailable') : t('store.adError');
    }
    refreshAd();
    if (ads.available && ProgressStore.getInstance().adsRemainingToday() > 0) {
      action.textContent = ads.simulated ? t('store.adSimulate') : t('store.adWatch');
    }
  }

  private async buyIap(
    sku: StoreSku & { id: IapSkuId },
    action: HTMLButtonElement,
    status: HTMLElement,
    catalog: CatalogProduct | undefined,
  ) {
    const billing = this.billing ?? getBilling();
    if (billing.simulated && !confirm(t('store.simulateConfirm'))) return;
    action.disabled = true;
    action.textContent = t('store.buying');
    const result = await billing.purchase(sku.id);
    if (result.status === 'purchased') {
      ProgressStore.getInstance().grantPack(sku.pack);
      status.textContent = t('store.granted', { name: formatPack(sku.pack) });
    } else if (result.status === 'cancelled') {
      status.textContent = t('store.cancelled');
    } else {
      status.textContent = result.message === 'unavailable' ? t('store.unavailable') : t('store.error');
    }
    action.disabled = false;
    action.textContent = iapActionLabel(billing, catalog ?? billing.getProducts().find((row) => row.id === sku.id));
  }

  private openSettings() {
    this.openSheet((sheet, close) => {
      const title = el('h2');
      title.textContent = t('menu.settings');
      const langLabel = el('p');
      langLabel.textContent = t('menu.language');
      const select = document.createElement('select');
      select.setAttribute('aria-label', t('menu.language'));
      const active = getLocale();
      for (const loc of SUPPORTED_LOCALES) {
        const opt = document.createElement('option');
        opt.value = loc.id;
        opt.textContent = loc.nativeName;
        select.appendChild(opt);
      }
      select.value = active;
      select.onchange = () => {
        const id = select.value as LocaleId;
        if (!isLocaleId(id)) return;
        setLocale(id);
        ProgressStore.getInstance().setLocale(id);
        close();
        this.host.innerHTML = '';
        new MenuView(this.host, this.onPlay);
      };
      const nickLabel = el('p');
      nickLabel.textContent = t('menu.nickname');
      const nickHint = el('p');
      nickHint.textContent = t('menu.nicknameHint');
      const nick = document.createElement('input');
      nick.type = 'text';
      nick.maxLength = 24;
      nick.value = ProgressStore.getInstance().getNickname() ?? '';
      nick.setAttribute('aria-label', t('menu.nickname'));
      nick.onchange = () => {
        void syncNickname(nick.value);
      };
      sheet.append(title, langLabel, select, nickLabel, nickHint, nick);

      if (import.meta.env.DEV) {
        const dev = el('p');
        dev.textContent = t('menu.developer');
        const reset = el('button', 'btn btn-ghost');
        reset.type = 'button';
        reset.textContent = t('menu.reset');
        reset.onclick = () => {
          if (!confirm(t('menu.resetConfirm'))) return;
          ProgressStore.getInstance().resetProgress();
          close();
          this.host.innerHTML = '';
          new MenuView(this.host, this.onPlay);
        };
        const resetEvents = el('button', 'btn btn-ghost');
        resetEvents.type = 'button';
        resetEvents.textContent = t('menu.resetEvents');
        resetEvents.title = t('menu.resetHint');
        resetEvents.onclick = () => {
          if (!confirm(t('menu.resetEventsConfirm'))) return;
          ProgressStore.getInstance().resetSpecialEvents();
          close();
          this.host.innerHTML = '';
          new MenuView(this.host, this.onPlay);
        };
        sheet.append(dev, reset, resetEvents);
      }

      const done = el('button', 'btn btn-mint');
      done.type = 'button';
      done.textContent = t('menu.close');
      done.onclick = () => close();
      sheet.appendChild(done);
    });
  }

  private openStart(level: LevelData, index: number | null) {
    const store = ProgressStore.getInstance();
    const best = store.getBestMs(level.id);
    this.openSheet((sheet, close) => {
      const img = document.createElement('img');
      img.alt = getLevelTitle(level);
      this.bindThumb(sheet, img, level);
      const title = el('h2');
      title.textContent = index !== null ? t('level.title', { n: index + 1 }) : getLevelTitle(level);
      const meta = el('div', 'hub-sheet-meta');
      const pieces = el('span');
      pieces.textContent = t('start.pieces', { n: level.difficulty });
      meta.appendChild(pieces);
      const addShape = () => {
        if (!img.naturalWidth || meta.querySelector('[data-shape]')) return;
        const shape = boardShape(img.naturalWidth, img.naturalHeight);
        const chip = el('span');
        chip.dataset.shape = shape;
        chip.textContent =
          shape === 'square' ? t('start.shapeSquare') : shape === 'landscape' ? t('start.shapeLandscape') : t('start.shapePortrait');
        meta.appendChild(chip);
      };
      img.addEventListener('load', addShape);
      if (img.complete) addShape();
      if (best !== null) {
        const rec = el('span');
        rec.textContent = t('hud.record', { time: formatTimer(best) });
        meta.appendChild(rec);
      }
      const play = el('button', 'btn');
      play.type = 'button';
      play.textContent = t('start.play');
      play.onclick = () => {
        close();
        this.onPlay(level.id);
      };
      sheet.append(img, title, meta, play);
      if (best !== null) {
        const cup = el('button', 'hud-cup');
        cup.type = 'button';
        cup.innerHTML = iconHtml('cup');
        cup.title = t('rank.open');
        cup.setAttribute('aria-label', t('rank.open'));
        const rankLabel = el('span', 'hud-cup-rank');
        rankLabel.textContent = t('rank.open');
        cup.appendChild(rankLabel);
        cup.onclick = () => {
          void (async () => {
            cup.disabled = true;
            cup.classList.add('is-loading');
            const result = await submitScore(level.id, best);
            cup.disabled = false;
            cup.classList.remove('is-loading');
            rankLabel.textContent = result.board?.my_rank
              ? t('rank.position', { n: result.board.my_rank })
              : t('rank.open');
            openRankingSheet(this.root, result.board, result.error);
          })();
        };
        sheet.appendChild(cup);
      }
    });
  }

  private openSheet(fill: (sheet: HTMLElement, close: () => void) => void) {
    const overlay = el('div', 'hub-overlay');
    const sheet = el('div', 'hub-sheet');
    const close = () => overlay.remove();
    fill(sheet, close);
    overlay.appendChild(sheet);
    overlay.addEventListener('click', (ev) => {
      if (ev.target === overlay) close();
    });
    this.root.appendChild(overlay);
  }

  private card(level: LevelData, index: number | null, unlocked: boolean, bestMs: number | null) {
    const title = getLevelTitle(level);
    const btn = el('button', `menu-card${unlocked ? '' : ' is-locked'}`);
    btn.type = 'button';
    btn.disabled = !unlocked;
    const img = document.createElement('img');
    img.alt = unlocked ? title : '';
    if (!unlocked) img.setAttribute('aria-hidden', 'true');
    this.bindThumb(btn, img, level);
    btn.appendChild(img);
    if (unlocked) {
      btn.onclick = () => this.openStart(level, index);
    } else {
      const lock = el('span', 'menu-lock');
      lock.textContent = '?';
      btn.appendChild(lock);
    }
    const meta = el('div', 'menu-card-meta');
    const num = index !== null ? `${index + 1}` : title;
    meta.innerHTML = `<span>${num}</span><span class="diff">${diffLabel(level.difficulty)}</span>`;
    btn.appendChild(meta);
    if (bestMs !== null) {
      const time = el('span', 'menu-card-time');
      time.textContent = formatTimer(bestMs);
      btn.appendChild(time);
    }
    return btn;
  }

  private eventIsland(level: LevelData, bestMs: number | null) {
    const title = getLevelTitle(level);
    const btn = el('button', 'event-island');
    btn.type = 'button';
    const img = document.createElement('img');
    img.alt = title;
    this.bindThumb(btn, img, level);
    const meta = el('div', 'event-island-meta');
    const name = el('span');
    name.textContent = title;
    const extra = el('span');
    extra.textContent = bestMs !== null ? formatTimer(bestMs) : t('start.pieces', { n: level.difficulty });
    meta.append(name, extra);
    btn.append(img, meta);
    btn.onclick = () => this.openStart(level, null);
    return btn;
  }

  private emptyEventIsland(type: EventSlotType) {
    const btn = el('button', 'event-island is-empty');
    btn.type = 'button';
    btn.disabled = true;
    const mark = el('span', 'event-empty-mark');
    mark.textContent = '?';
    const meta = el('div', 'event-island-meta');
    const name = el('span');
    name.textContent = eventSlotTitle(type);
    const extra = el('span');
    extra.textContent = emptyEventCopy(type);
    meta.append(name, extra);
    btn.append(mark, meta);
    return btn;
  }

  private bindThumb(host: HTMLElement, img: HTMLImageElement, level: LevelData) {
    host.classList.add('is-thumb-loading');
    const url = level.thumbUrl ?? level.imageUrl;
    void ensureImage('thumb', level.id, url)
      .then((src) => {
        const reveal = () => host.classList.remove('is-thumb-loading');
        img.addEventListener('load', reveal, { once: true });
        img.src = withDevCacheBust(src);
        if (img.complete) reveal();
      })
      .catch(() => host.classList.remove('is-thumb-loading'));
  }
}

function eventSlotTitle(type: EventSlotType): string {
  if (type === 'daily') return t('event.daily');
  if (type === 'weekly') return t('event.weekly');
  return t('event.monthly');
}

function emptyEventCopy(type: EventSlotType): string {
  if (type === 'daily') return t('event.noneDaily');
  if (type === 'weekly') return t('event.noneWeekly');
  return t('event.noneMonthly');
}

function iapActionLabel(billing: BillingPort, catalog: CatalogProduct | undefined): string {
  if (billing.simulated) return t('store.simulateBuy');
  if (catalog?.priceLabel) return t('store.buyFor', { price: catalog.priceLabel });
  return t('store.buy');
}

function currentUnlockId(store: ProgressStore): string {
  const n = store.getHighestUnlockedIndex() + 1;
  return `level_${n}`;
}

function diffLabel(n: number) {
  if (n <= 16) return 'C';
  if (n <= 36) return 'B';
  if (n <= 64) return 'A';
  if (n >= 1000) return 'SSSS';
  if (n >= 500) return 'SSS';
  if (n >= 200) return 'SS';
  return 'S';
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function iconButton(name: IconName, className: string, label: string, onClick: () => void) {
  const btn = el('button', className);
  btn.type = 'button';
  btn.innerHTML = iconHtml(name);
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.onclick = (e) => {
    e.stopPropagation();
    onClick();
  };
  return btn;
}
