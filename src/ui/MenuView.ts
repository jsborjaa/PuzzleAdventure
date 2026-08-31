import { LEVELS, SPECIAL_LEVELS, getLevelTitle, withDevCacheBust, type LevelData } from '../data/Levels';
import { ProgressStore } from '../data/ProgressStore';
import { getPowerupDef, POWERUP_DEFS, STORE_SKUS, AD_COMMON_DAILY_CAP, packHasItems } from '../domain/powerups';
import { formatTimer } from '../domain/timer';
import { getLocale, isLocaleId, setLocale, SUPPORTED_LOCALES, t, type LocaleId } from '../i18n';
import { formatPack, powerupName } from './powerupLabel';

export class MenuView {
  private root: HTMLElement;

  constructor(host: HTMLElement, private onPlay: (levelId: string) => void) {
    host.innerHTML = '';
    this.root = el('div', 'menu-root');
    const header = el('header', 'menu-header');
    const title = el('h1');
    title.textContent = 'Puzzle Adventure';
    const subtitle = el('p');
    subtitle.textContent = t('menu.subtitle');
    header.append(title, subtitle);

    const lang = el('label', 'menu-lang');
    lang.setAttribute('aria-label', t('menu.language'));
    const select = document.createElement('select');
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
      host.innerHTML = '';
      new MenuView(host, onPlay);
    };
    lang.appendChild(select);
    header.appendChild(lang);

    const actions = el('div', 'menu-dev-actions');
    const reset = el('button', 'btn btn-ghost');
    reset.type = 'button';
    reset.textContent = t('menu.reset');
    reset.onclick = () => {
      if (confirm(t('menu.resetConfirm'))) {
        ProgressStore.getInstance().resetProgress();
        host.innerHTML = '';
        new MenuView(host, onPlay);
      }
    };
    const resetEvents = el('button', 'btn btn-ghost');
    resetEvents.type = 'button';
    resetEvents.textContent = t('menu.resetEvents');
    resetEvents.title = t('menu.resetHint');
    resetEvents.onclick = () => {
      if (confirm(t('menu.resetEventsConfirm'))) {
        ProgressStore.getInstance().resetSpecialEvents();
        host.innerHTML = '';
        new MenuView(host, onPlay);
      }
    };
    actions.append(reset, resetEvents);
    header.appendChild(actions);

    const economy = el('div', 'menu-economy-actions');
    const workshopBtn = el('button', 'btn btn-secondary');
    workshopBtn.type = 'button';
    workshopBtn.textContent = t('menu.workshop');
    workshopBtn.onclick = () => this.openWorkshop();
    const storeBtn = el('button', 'btn btn-secondary');
    storeBtn.type = 'button';
    storeBtn.textContent = t('menu.store');
    storeBtn.onclick = () => this.openStore();
    economy.append(workshopBtn, storeBtn);
    header.appendChild(economy);

    const store = ProgressStore.getInstance();
    const grid = el('div', 'menu-grid');
    LEVELS.forEach((level, index) =>
      grid.appendChild(this.card(level, index, store.isLevelUnlocked(level.id), store.getBestMs(level.id))),
    );

    const eventsTitle = el('h2', 'menu-section');
    eventsTitle.textContent = t('menu.events');
    const events = el('div', 'menu-events');
    SPECIAL_LEVELS.forEach((level) =>
      events.appendChild(this.card(level, null, true, store.getBestMs(level.id))),
    );

    const max = el('p', 'menu-max');
    max.textContent = t('menu.maxLevel', { n: store.getHighestUnlockedIndex() + 1 });

    this.root.append(header, grid, eventsTitle, events, max);
    host.appendChild(this.root);
  }

  destroy() {
    this.root.remove();
  }

  private openWorkshop() {
    this.openPanel((panel, close) => {
      const title = el('h2');
      title.textContent = t('workshop.title');
      const subtitle = el('p', 'menu-panel-sub');
      subtitle.textContent = t('workshop.subtitle');
      const stockTitle = el('p', 'menu-panel-label');
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

      const areaCost = getPowerupDef('area')?.craftCost ?? 4;
      const revealCost = getPowerupDef('reveal_temp')?.craftCost ?? 10;
      const craftArea = el('button', 'btn');
      craftArea.type = 'button';
      craftArea.textContent = t('workshop.craftArea', { n: areaCost });
      craftArea.onclick = () => {
        ProgressStore.getInstance().craftPowerup('area');
        fillStock();
        syncCraft();
      };
      const craftReveal = el('button', 'btn');
      craftReveal.type = 'button';
      craftReveal.textContent = t('workshop.craftReveal', { n: revealCost });
      craftReveal.onclick = () => {
        ProgressStore.getInstance().craftPowerup('reveal_temp');
        fillStock();
        syncCraft();
      };
      const syncCraft = () => {
        const counts = ProgressStore.getInstance().getPowerups();
        craftArea.disabled = (counts.area ?? 0) < areaCost;
        craftReveal.disabled = (counts.reveal_temp ?? 0) < revealCost;
      };
      syncCraft();

      const back = el('button', 'btn btn-secondary');
      back.type = 'button';
      back.textContent = t('workshop.back');
      back.onclick = () => close();
      panel.append(title, subtitle, stockTitle, stock, craftArea, craftReveal, back);
    });
  }

  private openStore() {
    this.openPanel((panel, close) => {
      const title = el('h2');
      title.textContent = t('store.title');
      const subtitle = el('p', 'menu-panel-sub');
      subtitle.textContent = t('store.subtitle');
      panel.append(title, subtitle);

      const status = el('p', 'menu-panel-status');
      panel.appendChild(status);

      for (const sku of STORE_SKUS) {
        const card = el('div', 'store-sku');
        const name = el('h3');
        const body = el('p');
        const action = el('button', 'btn');
        action.type = 'button';
        if (sku.id === 'ad_common') {
          name.textContent = t('store.adTitle');
          body.textContent = t('store.adBody', { n: AD_COMMON_DAILY_CAP });
          const leftover = el('p', 'store-sku-meta');
          const refreshAd = () => {
            const left = ProgressStore.getInstance().adsRemainingToday();
            leftover.textContent = t('store.adLeft', { n: left });
            action.disabled = left <= 0 || !import.meta.env.DEV;
            if (left <= 0) leftover.textContent = t('store.adCap');
          };
          if (import.meta.env.DEV) {
            action.textContent = t('store.adSimulate');
            action.onclick = () => {
              const pack = ProgressStore.getInstance().tryClaimAdCommon();
              refreshAd();
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
          const hint = el('p', 'store-sku-meta');
          hint.textContent = sku.id === 'pack_handy' ? t('store.packHandyHint') : t('store.packRareHint');
          action.textContent = t('store.iapSoon');
          action.disabled = true;
          card.append(name, body, hint, action);
        }
        panel.appendChild(card);
      }

      const back = el('button', 'btn btn-secondary');
      back.type = 'button';
      back.textContent = t('store.back');
      back.onclick = () => close();
      panel.appendChild(back);
    });
  }

  private openPanel(fill: (panel: HTMLElement, close: () => void) => void) {
    const overlay = el('div', 'menu-panel-overlay');
    const panel = el('div', 'menu-panel');
    const close = () => overlay.remove();
    fill(panel, close);
    overlay.appendChild(panel);
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
      btn.onclick = () => this.onPlay(level.id);
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
