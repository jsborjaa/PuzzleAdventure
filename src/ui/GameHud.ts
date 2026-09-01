import { formatTimer } from '../domain/timer';
import type { PowerupKey, ToolId } from '../domain/product';
import { packEntries, packHasItems, type PowerupPack } from '../domain/powerups';
import { PuzzleSession } from '../domain/PuzzleSession';
import { t } from '../i18n';
import { iconHtml, type IconName } from './icons';
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
  private toolsRow: HTMLDivElement;
  private mapRail: HTMLDivElement;
  private mapTab: HTMLButtonElement;
  private toolsTab: HTMLButtonElement;
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

    const mapTab = edgeTab('chevronRight', t('hud.showMap'), () => this.toggleMap());
    const menu = roundButton('map', t('hud.map'), 'btn-coral', () => this.callbacks.onExitToMenu());
    const mapRail = el('div', 'hud-map-rail');
    mapRail.append(mapTab, menu);

    const progress = el('div', 'progress-bar-container');
    this.progressFill = el('div', 'progress-bar-fill');
    progress.appendChild(this.progressFill);
    this.timerLabel = el('div', 'timer-label');
    this.bestLabel = el('div', 'hud-best');
    this.revealCountdown = el('div', 'reveal-timer');
    this.revealCountdown.style.display = 'none';
    const mid = el('div', 'hud-top-mid');
    const times = el('div', 'hud-times hud-glass');
    times.append(this.timerLabel, this.bestLabel, this.revealCountdown);
    mid.append(progress, times);

    const eye = roundButton('peek', t('hud.peek'), 'btn-mint');
    const hold = (on: boolean) => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      this.session.setEyeHold(on);
    };
    eye.addEventListener('pointerdown', hold(true));
    eye.addEventListener('pointerup', hold(false));
    eye.addEventListener('pointerleave', hold(false));
    eye.addEventListener('pointercancel', hold(false));
    top.append(mapRail, mid, eye);

    const tools = el('div', 'hud-tools');
    const perm = this.powerup('reveal_perm', () => this.session.togglePermanentReveal());
    const temp = this.powerup('reveal_temp', () => {
      if (this.session.activateTemporaryReveal()) this.startRevealCountdown(20);
    });
    const area = this.toolButton('area');
    const sarea = this.toolButton('sarea');
    const hint = this.toolButton('hint');
    tools.append(perm, temp, area, sarea, hint);

    this.setupUpgrade(area, sarea, () => this.session.upgradeArea());
    this.setupUpgrade(temp, perm, () => this.session.upgradeReveal());

    const toolsTab = edgeTab('chevronLeft', t('hud.showTools'), () => this.toggleTools());
    bottom.append(toolsTab, tools);

    this.mapRail = mapRail;
    this.mapTab = mapTab;
    this.toolsTab = toolsTab;
    this.toolsRow = tools;
    this.bottom = bottom;
    if (this.session.mode === 'replay' || this.session.hasWon) {
      this.ensureReplayButton();
      this.setToolsOpen(true);
    }

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
        this.setToolsOpen(true);
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

  private powerup(key: PowerupKey, onClick: () => void) {
    const btn = this.badgeButton(key);
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  private toolButton(tool: ToolId) {
    const key: PowerupKey = tool === 'sarea' ? 'sarea' : tool === 'area' ? 'area' : 'hint';
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
        this.setToolsOpen(false);
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
    const tone = key === 'sarea' ? 'btn-coral' : 'btn-mint';
    const btn = roundButton(key, label, tone);
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

  private toggleMap() {
    this.setMapOpen(!this.mapRail.classList.contains('is-open'));
  }

  private toggleTools() {
    this.setToolsOpen(!this.bottom.classList.contains('is-open'));
  }

  private setMapOpen(open: boolean) {
    this.mapRail.classList.toggle('is-open', open);
    this.mapTab.innerHTML = iconHtml(open ? 'chevronLeft' : 'chevronRight');
    const label = open ? t('hud.hideMap') : t('hud.showMap');
    this.mapTab.title = label;
    this.mapTab.setAttribute('aria-label', label);
    this.mapTab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  private setToolsOpen(open: boolean) {
    this.bottom.classList.toggle('is-open', open);
    this.toolsTab.innerHTML = iconHtml(open ? 'chevronRight' : 'chevronLeft');
    const label = open ? t('hud.hideTools') : t('hud.showTools');
    this.toolsTab.title = label;
    this.toolsTab.setAttribute('aria-label', label);
    this.toolsTab.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  private ensureReplayButton() {
    if (this.replayBtn) return;
    this.replayBtn = roundButton('replay', t('hud.replay'), 'btn-coral', () => this.callbacks.onReplay());
    this.toolsRow.prepend(this.replayBtn);
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
      const row = el('div', 'hud-reward-row');
      for (const item of packEntries(event.rewards!)) {
        const chip = el('span', 'hud-chip');
        chip.textContent = t('hud.rewardItem', { name: powerupName(item.id), n: item.n });
        row.appendChild(chip);
      }
      card.append(rewardsTitle, row);
    }
    const actions = el('div', 'hud-card-actions');
    const replay = button(t('hud.replay'), 'btn', () => this.callbacks.onReplay());
    const menu = button(t('hud.map'), 'btn btn-mint', () => this.callbacks.onExitToMenu());
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

function tap(btn: HTMLButtonElement, onClick: () => void) {
  btn.addEventListener(
    'pointerdown',
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    },
    { passive: false },
  );
}

function button(label: string, className: string, onClick?: () => void) {
  const btn = el('button', className);
  btn.type = 'button';
  btn.textContent = label;
  if (onClick) tap(btn, onClick);
  return btn;
}

function edgeTab(icon: IconName, label: string, onClick: () => void) {
  const btn = el('button', 'hud-edge-tab');
  btn.type = 'button';
  btn.innerHTML = iconHtml(icon);
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-expanded', 'false');
  tap(btn, onClick);
  return btn;
}

function roundButton(icon: IconName, label: string, tone: string, onClick?: () => void) {
  const btn = el('button', `btn ${tone} hud-round`);
  btn.type = 'button';
  btn.innerHTML = iconHtml(icon);
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (onClick) tap(btn, onClick);
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
  root.addEventListener('touchstart', stop, { passive: true, signal });
  root.addEventListener('pointerdown', stop, { signal });
}
