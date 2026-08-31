import { LEVELS, SPECIAL_LEVELS, getLevelTitle, withDevCacheBust, type LevelData } from '../data/Levels';
import { ProgressStore } from '../data/ProgressStore';
import { getPowerupDef, POWERUP_DEFS, STORE_SKUS, AD_COMMON_DAILY_CAP, packHasItems } from '../domain/powerups';
import type { PowerupKey } from '../domain/product';
import { formatTimer } from '../domain/timer';
import { getLocale, isLocaleId, setLocale, SUPPORTED_LOCALES, t, type LocaleId } from '../i18n';
import { iconHtml, type IconName } from './icons';
import { formatPack, powerupName } from './powerupLabel';

type HubTab = 'map' | 'events' | 'store' | 'workshop';

export class MenuView {
  private root: HTMLElement;
  private body: HTMLDivElement;
  private chips: HTMLDivElement;
  private tab: HubTab = 'map';

  constructor(
    private host: HTMLElement,
    private onPlay: (levelId: string) => void,
  ) {
    host.innerHTML = '';
    this.root = el('div', 'menu-root');
    const top = el('header', 'hub-top');
    const logo = el('div', 'hub-logo');
    logo.innerHTML = `<span class="brand-top">${t('menu.brandPuzzle')}</span><span class="brand-bottom">${t('menu.brandAdventure')}</span>`;
    this.chips = el('div', 'hub-chips');
    const gear = iconButton('gear', 'hub-gear btn btn-mint', t('menu.settings'), () => this.openSettings());
    top.append(logo, this.chips, gear);

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
    this.syncChips();
    this.renderPane();
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

  private syncChips() {
    const counts = ProgressStore.getInstance().getPowerups();
    this.chips.innerHTML = '';
    const keys: PowerupKey[] = ['hint', 'area', 'reveal_temp'];
    for (const key of keys) {
      const chip = el('button', 'hub-chip');
      chip.type = 'button';
      chip.innerHTML = `${iconHtml(key)}<span>${counts[key] ?? 0}</span>`;
      chip.title = powerupName(key);
      chip.setAttribute('aria-label', powerupName(key));
      chip.onclick = () => this.setTab('store');
      this.chips.appendChild(chip);
    }
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
    const title = el('h2', 'hub-pane-title');
    title.textContent = t('menu.subtitle');
    const grid = el('div', 'menu-grid');
    const store = ProgressStore.getInstance();
    const currentId = currentUnlockId(store);
    LEVELS.forEach((level, index) => {
      const unlocked = store.isLevelUnlocked(level.id);
      const card = this.card(level, index, unlocked, store.getBestMs(level.id));
      if (unlocked && level.id === currentId && store.getBestMs(level.id) === null) {
        card.classList.add('is-current');
      }
      grid.appendChild(card);
    });
    wrap.append(title, grid);
    return wrap;
  }

  private eventsPane() {
    const wrap = el('div');
    const title = el('h2', 'hub-pane-title');
    title.textContent = t('menu.events');
    const islands = el('div', 'event-islands');
    const store = ProgressStore.getInstance();
    SPECIAL_LEVELS.forEach((level) => islands.appendChild(this.eventIsland(level, store.getBestMs(level.id))));
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
      this.syncChips();
    };
    fillStock();
    const areaCost = getPowerupDef('area')?.craftCost ?? 4;
    const revealCost = getPowerupDef('reveal_temp')?.craftCost ?? 10;
    const craftArea = el('button', 'btn btn-coral');
    craftArea.type = 'button';
    craftArea.textContent = t('workshop.craftArea', { n: areaCost });
    const craftReveal = el('button', 'btn btn-mint');
    craftReveal.type = 'button';
    craftReveal.textContent = t('workshop.craftReveal', { n: revealCost });
    const syncCraft = () => {
      const counts = ProgressStore.getInstance().getPowerups();
      craftArea.disabled = (counts.area ?? 0) < areaCost;
      craftReveal.disabled = (counts.reveal_temp ?? 0) < revealCost;
    };
    craftArea.onclick = () => {
      ProgressStore.getInstance().craftPowerup('area');
      fillStock();
      syncCraft();
    };
    craftReveal.onclick = () => {
      ProgressStore.getInstance().craftPowerup('reveal_temp');
      fillStock();
      syncCraft();
    };
    syncCraft();
    card.append(stockTitle, stock, craftArea, craftReveal);
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
          action.disabled = left <= 0 || !import.meta.env.DEV;
        };
        if (import.meta.env.DEV) {
          action.textContent = t('store.adSimulate');
          action.onclick = () => {
            const pack = ProgressStore.getInstance().tryClaimAdCommon();
            refreshAd();
            this.syncChips();
            status.textContent = packHasItems(pack) ? t('store.granted', { name: formatPack(pack!) }) : t('store.adCap');
          };
        } else {
          action.textContent = t('store.iapSoon');
          action.disabled = true;
        }
        refreshAd();
        card.append(name, body, leftover, action);
      } else {
        name.textContent = sku.id === 'pack_handy' ? t('store.packHandy') : t('store.packRare');
        body.textContent = formatPack(sku.pack);
        const hint = el('p');
        hint.textContent = sku.id === 'pack_handy' ? t('store.packHandyHint') : t('store.packRareHint');
        action.textContent = t('store.iapSoon');
        action.disabled = true;
        card.append(name, body, hint, action);
      }
      wrap.appendChild(card);
    }
    return wrap;
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
      sheet.append(title, langLabel, select);

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
      img.src = withDevCacheBust(level.imageUrl);
      img.alt = getLevelTitle(level);
      const title = el('h2');
      title.textContent = index !== null ? t('level.title', { n: index + 1 }) : getLevelTitle(level);
      const meta = el('div', 'hub-sheet-meta');
      const pieces = el('span');
      pieces.textContent = t('start.pieces', { n: level.difficulty });
      meta.appendChild(pieces);
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
    if (unlocked) {
      const img = document.createElement('img');
      img.src = withDevCacheBust(level.imageUrl);
      img.alt = title;
      btn.appendChild(img);
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
    img.src = withDevCacheBust(level.imageUrl);
    img.alt = title;
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
