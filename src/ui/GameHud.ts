import { formatTimer } from '../domain/timer';
import type { PowerupKey, ToolId } from '../domain/product';
import { packEntries, packHasItems, type PowerupPack } from '../domain/powerups';
import { PuzzleSession } from '../domain/PuzzleSession';
import { t } from '../i18n';
import { powerupName } from './powerupLabel';

export interface HudCallbacks {
  onExitToMenu: () => void;
  onActivateTool: (tool: ToolId) => void;
  onDeactivateTool: (pageX: number, pageY: number) => void;
  onReplay: () => void;
}

export class GameHud {
  private root: HTMLElement;
  private bottom: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private timerLabel: HTMLDivElement;
  private bestLabel: HTMLDivElement;
  private revealCountdown: HTMLDivElement;
  private replayBtn: HTMLButtonElement | null = null;
  private badges = new Map<PowerupKey, HTMLElement>();
  private unsub: () => void;
  private revealLeft = 0;
  private revealInterval: number | null = null;
  private overlay: HTMLElement | null = null;
  private abort = new AbortController();

  constructor(
    host: HTMLElement,
    private session: PuzzleSession,
    private callbacks: HudCallbacks,
  ) {
    host.innerHTML = '';
    this.root = host;
    const top = el('div', 'hud-top');
    const bottom = el('div', 'hud-bottom');

    const menu = button(t('hud.menu'), 'btn', () => this.callbacks.onExitToMenu());
    const progress = el('div', 'progress-bar-container');
    this.progressFill = el('div', 'progress-bar-fill');
    progress.appendChild(this.progressFill);
    this.timerLabel = el('div', 'timer-label');
    this.bestLabel = el('div', 'hud-best');
    this.revealCountdown = el('div', 'reveal-timer');
    this.revealCountdown.style.display = 'none';
    const mid = el('div', 'hud-top-mid');
    const times = el('div', 'hud-times');
    times.append(this.timerLabel, this.bestLabel);
    mid.append(progress, times, this.revealCountdown);

    const eye = button(t('hud.peek'), 'btn btn-secondary');
    const hold = (on: boolean) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.session.setEyeHold(on);
    };
    eye.addEventListener('pointerdown', hold(true));
    eye.addEventListener('pointerup', hold(false));
    eye.addEventListener('pointerleave', hold(false));
    eye.addEventListener('pointercancel', hold(false));
    top.append(menu, mid, eye);

    const perm = this.powerup(t('hud.revealPerm'), 'reveal_perm', () => this.session.togglePermanentReveal());
    const temp = this.powerup(t('hud.revealTemp'), 'reveal_temp', () => {
      if (this.session.activateTemporaryReveal()) this.startRevealCountdown(20);
    });
    const area = this.toolButton(t('hud.area'), 'area');
    const sarea = this.toolButton(t('hud.sarea'), 'sarea');
    const hint = this.toolButton(t('hud.hint'), 'hint');
    bottom.append(perm, temp, area, sarea, hint);
    if (import.meta.env.DEV) {
      const resetPu = button(t('hud.resetPu'), 'btn btn-ghost', () => this.session.resetPowerups());
      resetPu.title = t('hud.resetPuHint');
      bottom.append(resetPu);
    }

    this.setupUpgrade(area, sarea, () => this.session.upgradeArea());
    this.setupUpgrade(temp, perm, () => this.session.upgradeReveal());

    this.bottom = bottom;
    if (this.session.mode === 'replay' || this.session.hasWon) this.ensureReplayButton();

    host.append(top, bottom);
    preventCanvasSteal(host, this.abort.signal);

    this.unsub = this.session.on((event) => {
      if (event.type === 'progress' || event.type === 'piecePlaced') this.syncProgress();
      if (event.type === 'inventoryChanged') this.syncInventory();
      if (event.type === 'timer') this.timerLabel.textContent = formatTimer(event.elapsedMs);
      if (event.type === 'revealChanged') {
        const r = this.session.getReveal();
        if (r.temporary) this.startRevealCountdown(Math.ceil(((r.temporaryEndsAt ?? 0) - Date.now()) / 1000));
        else this.stopRevealCountdown();
      }
      if (event.type === 'won') {
        this.ensureReplayButton();
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
  }

  destroy() {
    this.abort.abort();
    this.unsub();
    this.stopRevealCountdown();
    this.root.innerHTML = '';
  }

  private powerup(label: string, key: PowerupKey, onClick: () => void) {
    const btn = this.badgeButton(label, key);
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private toolButton(label: string, tool: ToolId) {
    const key: PowerupKey = tool === 'sarea' ? 'sarea' : tool === 'area' ? 'area' : 'hint';
    const btn = this.badgeButton(label, key);
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
        window.removeEventListener('pointerup', stop);
        window.removeEventListener('pointercancel', stop);
        window.removeEventListener('touchend', stop);
      };
      window.addEventListener('pointerup', stop);
      window.addEventListener('pointercancel', stop);
      window.addEventListener('touchend', stop);
    };
    btn.addEventListener('pointerdown', start);
    return btn;
  }

  private badgeButton(label: string, key: PowerupKey) {
    const btn = button(label, 'btn btn-secondary hud-powerup');
    const badge = el('span', 'hud-badge');
    btn.appendChild(badge);
    this.badges.set(key, badge);
    return btn;
  }

  private setupUpgrade(source: HTMLElement, target: HTMLElement, apply: () => boolean) {
    let startX = 0;
    let startY = 0;
    source.addEventListener('pointerdown', (ev) => {
      startX = ev.clientX;
      startY = ev.clientY;
    });
    source.addEventListener('pointerup', (ev) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 8) return;
      const rect = target.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;
      apply();
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
    this.replayBtn = button(t('hud.replay'), 'btn hud-replay', () => this.callbacks.onReplay());
    this.bottom.prepend(this.replayBtn);
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
    if (packHasItems(event.rewards)) {
      const rewardsTitle = el('p', 'hud-rewards-title');
      rewardsTitle.textContent = t('hud.rewardsTitle');
      const list = el('ul', 'hud-rewards');
      for (const row of packEntries(event.rewards!)) {
        const item = el('li');
        item.textContent = t('hud.rewardItem', { name: powerupName(row.id), n: row.n });
        list.appendChild(item);
      }
      card.append(rewardsTitle, list);
    }
    const actions = el('div', 'hud-card-actions');
    const replay = button(t('hud.replay'), 'btn hud-replay', () => this.callbacks.onReplay());
    const menu = button(t('hud.menu'), 'btn btn-secondary', () => this.callbacks.onExitToMenu());
    actions.append(replay, menu);
    card.append(actions);
    this.overlay.appendChild(card);
    this.root.appendChild(this.overlay);
  }

  private toast(text: string) {
    const n = el('div', 'hud-toast');
    n.textContent = text;
    this.root.appendChild(n);
    window.setTimeout(() => n.remove(), 4000);
  }
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function button(label: string, className: string, onClick?: () => void) {
  const btn = el('button', className);
  btn.type = 'button';
  btn.textContent = label;
  if (onClick) btn.onclick = (e) => {
    e.stopPropagation();
    onClick();
  };
  return btn;
}

function pagePoint(ev: Event): { x: number; y: number } {
  const pt = ev as PointerEvent;
  if (typeof pt.pageX === 'number') return { x: pt.pageX, y: pt.pageY };
  const touch = (ev as TouchEvent).changedTouches?.[0];
  return { x: touch?.pageX ?? 0, y: touch?.pageY ?? 0 };
}

function preventCanvasSteal(root: HTMLElement, signal: AbortSignal) {
  const stop = (e: Event) => e.stopPropagation();
  root.addEventListener('mousedown', stop, { signal });
  root.addEventListener('touchstart', stop, { passive: false, signal });
  root.addEventListener('pointerdown', stop, { signal });
}
