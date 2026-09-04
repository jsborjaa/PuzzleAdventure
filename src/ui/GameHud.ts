import { formatTimer } from '../domain/timer';
import type { PowerupKey, ToolId } from '../domain/product';
import { canCraft } from '../domain/inventory';
import {
  getCraftRecipe,
  getPowerupDef,
  packEntries,
  packHasItems,
  POWERUP_DEFS,
  randomCommonId,
  type PowerupPack,
} from '../domain/powerups';
import { PuzzleSession } from '../domain/PuzzleSession';
import { ensureAds } from '../data/ads';
import { submitScore, type RankingResult } from '../data/cloud/leaderboard';
import { t } from '../i18n';
import { button, el, pagePoint, preventCanvasSteal, roundButton } from './dom';
import { iconHtml } from './icons';
import { formatPack, powerupName } from './powerupLabel';
import { openRankingSheet } from './rankingSheet';

export interface HudCallbacks {
  onExitToMenu: () => void;
  onActivateTool: (tool: ToolId) => void;
  onDeactivateTool: (pageX: number, pageY: number) => void;
  onReplay: () => void;
}

export class GameHud {
  private overlayHost: HTMLElement;
  private progressFill: HTMLDivElement;
  private timerLabel: HTMLDivElement;
  private bestLabel: HTMLDivElement;
  private revealCountdown: HTMLDivElement;
  private replayBtn: HTMLButtonElement | null = null;
  private popover: HTMLElement | null = null;
  private openTier: 'common' | 'rare' | null = null;
  private badges = new Map<PowerupKey, HTMLElement>();
  private powerupBtns = new Map<PowerupKey, HTMLButtonElement>();
  private unsub: () => void;
  private revealLeft = 0;
  private revealInterval: number | null = null;
  private overlay: HTMLElement | null = null;
  private abort = new AbortController();

  constructor(
    overlayHost: HTMLElement,
    private chrome: HTMLElement,
    private status: HTMLElement,
    private session: PuzzleSession,
    private callbacks: HudCallbacks,
  ) {
    overlayHost.innerHTML = '';
    this.overlayHost = overlayHost;
    this.chrome.replaceChildren();
    this.status.replaceChildren();

    const back = this.chromeItem('chevronLeft', t('hud.back'), 'btn-coral', () => this.callbacks.onExitToMenu());
    const commons = this.chromeItem('commons', t('hud.commons'), 'btn-mint', () => this.togglePopover('common'));
    const rares = this.chromeItem('rares', t('hud.rares'), 'btn-coral', () => this.togglePopover('rare'));
    const eyeWrap = this.chromeItem('peek', t('hud.peek'), 'btn-mint');
    const hold = (on: boolean) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.session.setEyeHold(on);
    };
    eyeWrap.btn.addEventListener('pointerdown', hold(true));
    eyeWrap.btn.addEventListener('pointerup', hold(false));
    eyeWrap.btn.addEventListener('pointerleave', hold(false));
    eyeWrap.btn.addEventListener('pointercancel', hold(false));
    this.chrome.append(back.wrap, commons.wrap, rares.wrap, eyeWrap.wrap);

    const progress = el('div', 'progress-bar-container');
    this.progressFill = el('div', 'progress-bar-fill');
    progress.appendChild(this.progressFill);
    this.timerLabel = el('div', 'timer-label');
    this.bestLabel = el('div', 'hud-best');
    this.revealCountdown = el('div', 'reveal-timer');
    this.revealCountdown.style.display = 'none';
    const times = el('div', 'hud-times hud-glass');
    times.append(this.timerLabel, this.bestLabel, this.revealCountdown);
    this.status.append(progress, times);

    for (const def of POWERUP_DEFS) {
      this.powerupBtns.set(def.id, this.toolButton(def.id));
    }

    if (this.session.mode === 'replay' || this.session.hasWon) {
      this.ensureReplayButton();
    }

    preventCanvasSteal(this.chrome, this.abort.signal);
    preventCanvasSteal(this.status, this.abort.signal);

    this.unsub = this.session.on((event) => {
      if (event.type === 'progress' || event.type === 'piecePlaced') this.syncProgress();
      if (event.type === 'inventoryChanged') {
        this.syncInventory();
        this.syncCraftButtons();
      }
      if (event.type === 'timer') this.timerLabel.textContent = formatTimer(event.elapsedMs);
      if (event.type === 'revealChanged') {
        const r = this.session.getReveal();
        if (r.temporary) this.startRevealCountdown(Math.ceil(((r.temporaryEndsAt ?? 0) - Date.now()) / 1000));
        else this.stopRevealCountdown();
      }
      if (event.type === 'won') {
        this.ensureReplayButton();
        this.closePopover();
        this.showWin(event);
      }
    });

    this.syncProgress();
    this.syncInventory();
    this.syncBest();
    this.timerLabel.textContent = formatTimer(this.session.getElapsed());
    if (this.session.qualityGate) {
      this.toast(t('hud.quality', { n: this.session.qualityGate.to }));
    }

    window.addEventListener('pointerdown', this.onDocPointer, { signal: this.abort.signal });
  }

  destroy() {
    this.abort.abort();
    this.unsub();
    this.stopRevealCountdown();
    this.closePopover();
    this.chrome.replaceChildren();
    this.status.replaceChildren();
    this.overlayHost.innerHTML = '';
  }

  private onDocPointer = (ev: PointerEvent) => {
    if (!this.popover) return;
    const node = ev.target as Node | null;
    if (this.popover.contains(node) || this.chrome.contains(node)) return;
    this.closePopover();
  };

  private togglePopover(tier: 'common' | 'rare') {
    if (this.openTier === tier) {
      this.closePopover();
      return;
    }
    this.closePopover();
    const pop = el('div', 'hud-popover');
    pop.setAttribute('role', 'menu');
    const ids = POWERUP_DEFS.filter((d) => d.tier === tier).map((d) => d.id);
    for (const id of ids) {
      const btn = this.powerupBtns.get(id);
      if (!btn) continue;
      const recipe = getCraftRecipe(id);
      if (tier === 'rare' && recipe) {
        const row = el('div', 'hud-popover-row');
        row.appendChild(btn);
        const craftBtn = el('button', 'btn hud-craft');
        craftBtn.type = 'button';
        craftBtn.dataset.craft = id;
        const label = el('span', 'hud-craft-label');
        label.textContent = t('hud.craft');
        const cost = el('span', 'hud-craft-cost');
        cost.textContent = formatPack(recipe.cost);
        craftBtn.append(label, cost);
        craftBtn.title = `${t('hud.craft')}: ${formatPack(recipe.cost)}`;
        craftBtn.setAttribute('aria-label', `${t('hud.craft')}: ${formatPack(recipe.cost)}`);
        craftBtn.disabled = !canCraft(this.session.getInventory(), id);
        craftBtn.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        craftBtn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.session.craft(id);
          this.syncCraftButtons();
        });
        row.appendChild(craftBtn);
        pop.appendChild(row);
      } else {
        pop.appendChild(btn);
      }
    }
    this.chrome.appendChild(pop);
    this.popover = pop;
    this.openTier = tier;
  }

  handleBack(): boolean {
    if (!this.popover) return false;
    this.closePopover();
    return true;
  }

  closePopover() {
    if (!this.popover) {
      this.openTier = null;
      return;
    }
    this.popover.remove();
    this.popover = null;
    this.openTier = null;
  }

  private chromeItem(icon: Parameters<typeof roundButton>[0], label: string, tone: string, onClick?: () => void) {
    const wrap = el('div', 'hud-chrome-item');
    const btn = roundButton(icon, label, tone, onClick);
    const cap = el('span', 'hud-chrome-caption');
    cap.textContent = label;
    wrap.append(btn, cap);
    return { wrap, btn };
  }

  private toolButton(tool: ToolId) {
    const key: PowerupKey = tool;
    const btn = this.badgeButton(key);
    const start = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      if ((this.session.getInventory()[key] ?? 0) <= 0) return;
      btn.classList.add('active');
      this.callbacks.onActivateTool(tool);
      let done = false;
      const stop = (ev: Event) => {
        if (done) return;
        done = true;
        btn.classList.remove('active');
        const page = pagePoint(ev);
        this.callbacks.onDeactivateTool(page.x, page.y);
        this.closePopover();
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        window.removeEventListener('touchend', stop);
      };
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      window.addEventListener('touchend', stop);
    };
    btn.addEventListener('pointerdown', start, { passive: false });
    return btn;
  }

  private badgeButton(key: PowerupKey) {
    const label = powerupName(key);
    const tone = getPowerupDef(key)?.tier === 'rare' ? 'btn-coral' : 'btn-mint';
    const btn = roundButton(key, label, tone);
    const badge = el('span', 'hud-badge');
    btn.appendChild(badge);
    this.badges.set(key, badge);
    return btn;
  }

  private syncCraftButtons() {
    if (!this.popover) return;
    const counts = this.session.getInventory();
    this.popover.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((btn) => {
      const id = btn.dataset.craft as PowerupKey;
      btn.disabled = !canCraft(counts, id);
    });
  }

  private syncProgress() {
    const { solved, total } = this.session.getProgress();
    this.progressFill.style.width = total ? `${Math.min(100, (solved / total) * 100)}%` : '0%';
  }

  private syncInventory() {
    const counts = this.session.getInventory();
    (Object.keys(counts) as PowerupKey[]).forEach((key) => {
      const badge = this.badges.get(key);
      if (!badge) return;
      badge.textContent = String(counts[key] ?? 0);
      const parent = badge.parentElement;
      if (parent) parent.style.opacity = (counts[key] ?? 0) === 0 ? '0.45' : '1';
    });
  }

  private startRevealCountdown(seconds: number) {
    this.stopRevealCountdown();
    this.revealLeft = Math.max(0, seconds);
    this.revealCountdown.style.display = 'inline-block';
    this.revealCountdown.textContent = `${this.revealLeft}s`;
    this.revealInterval = window.setInterval(() => {
      this.revealLeft -= 1;
      if (this.revealLeft <= 0) {
        this.stopRevealCountdown();
        return;
      }
      this.revealCountdown.textContent = `${this.revealLeft}s`;
    }, 1000);
  }

  private stopRevealCountdown() {
    if (this.revealInterval !== null) window.clearInterval(this.revealInterval);
    this.revealInterval = null;
    this.revealCountdown.style.display = 'none';
  }

  private ensureReplayButton() {
    if (this.replayBtn) return;
    this.replayBtn = roundButton('replay', t('hud.replay'), 'btn-coral', () => this.callbacks.onReplay());
    this.chrome.appendChild(this.replayBtn);
  }

  private syncBest() {
    const best = this.session.getBestMs();
    if (best === null) {
      this.bestLabel.textContent = '';
      this.bestLabel.hidden = true;
      return;
    }
    this.bestLabel.hidden = false;
    this.bestLabel.textContent = t('hud.record', { time: formatTimer(best) });
  }

  private showWin(event: {
    elapsedMs: number;
    bestMs: number;
    isRecord: boolean;
    rewards: PowerupPack | null;
    allowWinDouble: boolean;
    replayFarm: boolean;
  }) {
    this.syncBest();
    if (this.overlay) return;
    this.overlay = el('div', 'hud-overlay');
    const card = el('div', 'hud-card');
    const title = el('h2');
    title.textContent = t('hud.winTitle');
    const time = el('p', 'hud-card-time');
    time.textContent = t('hud.time', { time: formatTimer(event.elapsedMs) });
    const best = el('p', 'hud-card-best');
    best.textContent = event.isRecord
      ? t('hud.newRecord', { time: formatTimer(event.bestMs) })
      : t('hud.record', { time: formatTimer(event.bestMs) });
    if (event.isRecord) best.classList.add('is-record');
    card.append(title, time, best);
    const cup = el('button', 'hud-cup is-loading');
    cup.type = 'button';
    cup.innerHTML = iconHtml('cup');
    cup.disabled = true;
    cup.title = t('rank.open');
    cup.setAttribute('aria-label', t('rank.open'));
    card.appendChild(cup);
    const rewardsRow = el('div', 'hud-reward-row');
    if (packHasItems(event.rewards)) {
      const rewardsTitle = el('p', 'hud-rewards-title');
      rewardsTitle.textContent = t('hud.rewardsTitle');
      for (const item of packEntries(event.rewards!)) {
        const chip = el('span', 'hud-chip');
        chip.textContent = t('hud.rewardItem', { name: powerupName(item.id), n: item.n });
        rewardsRow.appendChild(chip);
      }
      card.append(rewardsTitle, rewardsRow);
    }
    const actions = el('div', 'hud-card-actions');
    const replay = button(t('hud.replay'), 'btn', () => this.callbacks.onReplay());
    const menu = button(t('hud.map'), 'btn btn-mint', () => this.callbacks.onExitToMenu());
    actions.append(replay, menu);
    card.append(actions);
    this.overlay.appendChild(card);
    this.overlayHost.appendChild(this.overlay);
    this.mountWinAd(card, actions, rewardsRow, event);
    void this.loadBoard(event.bestMs).then((result) => {
      this.fillCup(cup, result);
    });
  }

  private mountWinAd(
    card: HTMLElement,
    actions: HTMLElement,
    rewardsRow: HTMLElement,
    event: { rewards: PowerupPack | null; allowWinDouble: boolean; replayFarm: boolean },
  ) {
    const wantsDouble = event.allowWinDouble && packHasItems(event.rewards);
    const wantsFarm = event.replayFarm;
    if (!wantsDouble && !wantsFarm) return;
    void ensureAds().then((ads) => {
      if (!ads.available || !this.overlay) return;
      const label = ads.simulated
        ? t('store.adSimulate')
        : wantsDouble
          ? t('hud.winDouble')
          : t('hud.winFarm');
      let used = false;
      const adBtn = button(label, 'btn btn-coral', () => {
        void (async () => {
          if (used) return;
          if (ads.simulated && !confirm(t('store.adSimulateConfirm'))) return;
          adBtn.disabled = true;
          const result = await ads.watchRewarded();
          if (result.status !== 'rewarded') {
            adBtn.disabled = false;
            return;
          }
          used = true;
          const pack: PowerupPack = wantsDouble && event.rewards ? { ...event.rewards } : { [randomCommonId()]: 1 };
          this.session.grantWinPack(pack);
          if (!rewardsRow.parentElement) {
            const rewardsTitle = el('p', 'hud-rewards-title');
            rewardsTitle.textContent = t('hud.rewardsTitle');
            card.insertBefore(rewardsTitle, actions);
            card.insertBefore(rewardsRow, actions);
          }
          for (const item of packEntries(pack)) {
            const chip = el('span', 'hud-chip');
            chip.textContent = t('hud.rewardItem', { name: powerupName(item.id), n: item.n });
            rewardsRow.appendChild(chip);
          }
          adBtn.remove();
        })();
      });
      actions.prepend(adBtn);
    });
  }

  private async loadBoard(bestMs: number): Promise<RankingResult> {
    return submitScore(this.session.levelId, bestMs);
  }

  private fillCup(cup: HTMLButtonElement, result: RankingResult) {
    cup.disabled = false;
    cup.classList.remove('is-loading');
    const rank = result.board?.my_rank;
    const label = el('span', 'hud-cup-rank');
    if (!result.board && result.error) {
      cup.classList.add('is-offline');
      label.textContent = t('rank.offline');
    } else {
      label.textContent = rank ? t('rank.position', { n: rank }) : t('rank.open');
    }
    cup.appendChild(label);
    cup.onclick = () => openRankingSheet(this.overlayHost, result.board, result.error);
  }

  private toast(text: string) {
    const n = el('div', 'hud-toast');
    n.textContent = text;
    this.overlayHost.appendChild(n);
    window.setTimeout(() => n.remove(), 4000);
  }
}
