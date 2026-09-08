import type { PieceId } from '../domain/pieceId';
import { PuzzleSession } from '../domain/PuzzleSession';
import { AudioService } from '../engine/audio/AudioService';
import { PuzzleBoard } from '../engine/board/PuzzleBoard';
import { TAP_ROTATE_DEBOUNCE_MS, TAP_THRESHOLD } from '../engine/input/PieceInteraction';
import { el, preventCanvasSteal } from './dom';
import type { HeldPiece } from './HeldPiece';
import { drawPieceThumb } from './pieceThumb';

const HOLD_MS = 80;
const FLICK_MIN = 0.35;
const FLICK_DECAY = 0.94;

export class PieceTray {
  private chips = new Map<PieceId, HTMLButtonElement>();
  private canvases = new Map<PieceId, HTMLCanvasElement>();
  private unsub: () => void;
  private abort = new AbortController();
  private draggingId: PieceId | null = null;
  private dragOriginIndex = 0;
  private lastRotateAt = 0;
  private flickRaf = 0;
  private flickV = 0;
  private slot: HTMLDivElement | null = null;

  constructor(
    private host: HTMLElement,
    private session: PuzzleSession,
    private board: PuzzleBoard,
    private hooks: {
      setCameraEnabled: (on: boolean) => void;
      isOverTray: (clientX: number, clientY: number) => boolean;
      applyPieceVisual: (id: PieceId) => void;
      onSolvedVisual: (id: PieceId) => void;
      held: HeldPiece;
    },
  ) {
    host.replaceChildren();
    preventCanvasSteal(host, this.abort.signal);
    this.bindTraySwipe();
    this.rebuild();
    this.unsub = session.on((event) => {
      if (event.type === 'pieceRotated') {
        this.paintChip(event.id);
        return;
      }
      if (
        event.type === 'pieceTrayChanged' ||
        event.type === 'piecePlaced' ||
        event.type === 'won' ||
        event.type === 'progress'
      ) {
        if (this.draggingId && event.type === 'pieceTrayChanged' && event.id === this.draggingId) return;
        this.rebuild();
      }
    });
  }

  destroy() {
    this.abort.abort();
    this.stopFlick();
    this.clearPreview();
    this.unsub();
    this.host.replaceChildren();
    this.chips.clear();
    this.canvases.clear();
  }

  private isLandscape() {
    return document.getElementById('app')?.classList.contains('is-landscape') ?? false;
  }

  private scrollBy(delta: number) {
    if (this.isLandscape()) this.host.scrollTop += delta;
    else this.host.scrollLeft += delta;
  }

  private stopFlick() {
    if (this.flickRaf) cancelAnimationFrame(this.flickRaf);
    this.flickRaf = 0;
    this.flickV = 0;
  }

  private startFlick(velocity: number) {
    this.stopFlick();
    if (Math.abs(velocity) < FLICK_MIN) return;
    this.flickV = velocity;
    const step = () => {
      this.flickV *= FLICK_DECAY;
      if (Math.abs(this.flickV) < 0.08) {
        this.stopFlick();
        return;
      }
      this.scrollBy(-this.flickV * 16);
      this.flickRaf = requestAnimationFrame(step);
    };
    this.flickRaf = requestAnimationFrame(step);
  }

  private bindTraySwipe() {
    let pointerId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;

    const onMove = (ev: PointerEvent) => {
      if (pointerId !== ev.pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      const axis = this.isLandscape() ? dy : dx;
      vel = axis / dt;
      this.scrollBy(-axis);
      lastX = ev.clientX;
      lastY = ev.clientY;
      lastT = now;
    };

    const onUp = (ev: PointerEvent) => {
      if (pointerId !== ev.pointerId) return;
      pointerId = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      this.startFlick(vel);
    };

    this.host.addEventListener(
      'pointerdown',
      (ev) => {
        if (ev.target !== this.host) return;
        ev.preventDefault();
        this.stopFlick();
        pointerId = ev.pointerId;
        lastX = ev.clientX;
        lastY = ev.clientY;
        lastT = performance.now();
        vel = 0;
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      },
      { passive: false, signal: this.abort.signal },
    );
  }

  insertIndexAt(clientX: number, clientY: number, excludeId?: PieceId | null): number {
    const landscape = this.isLandscape();
    const pos = landscape ? clientY : clientX;
    let index = 0;
    for (const id of this.orderedIds()) {
      if (id === excludeId) continue;
      const chip = this.chips.get(id);
      if (!chip || chip.classList.contains('is-dragging')) continue;
      const r = chip.getBoundingClientRect();
      const mid = landscape ? (r.top + r.bottom) / 2 : (r.left + r.right) / 2;
      if (pos < mid) return index;
      index += 1;
    }
    return index;
  }

  previewInsert(index: number, excludeId?: PieceId | null, originIndex?: number | null) {
    if (originIndex != null && index === originIndex) {
      this.clearPreview();
      return;
    }
    if (!this.slot) {
      this.slot = el('div', 'piece-chip-slot');
      this.slot.setAttribute('aria-hidden', 'true');
    }
    const ids = this.orderedIds().filter((id) => id !== excludeId);
    const refId = ids[index];
    const ref = refId ? this.chips.get(refId) : null;
    if (ref) this.host.insertBefore(this.slot, ref);
    else this.host.appendChild(this.slot);
  }

  clearPreview() {
    this.slot?.remove();
    this.slot = null;
  }

  revealChip(id: PieceId) {
    const chip = this.chips.get(id);
    chip?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  pieceIdAt(clientX: number, clientY: number): PieceId | null {
    for (const id of [...this.orderedIds()].reverse()) {
      const chip = this.chips.get(id);
      if (!chip || chip.classList.contains('is-dragging')) continue;
      const r = chip.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) return id;
    }
    return null;
  }

  setToolTarget(id: PieceId | null) {
    for (const [pid, chip] of this.chips) {
      chip.classList.toggle('is-tool-target', pid === id);
    }
  }

  private orderedIds(): PieceId[] {
    return this.session.getTrayPieces().map((p) => p.id);
  }

  private rebuild() {
    this.clearPreview();
    const ids = this.orderedIds();
    const keep = new Set(ids);
    for (const [id, chip] of this.chips) {
      if (!keep.has(id)) {
        chip.remove();
        this.chips.delete(id);
        this.canvases.delete(id);
      }
    }
    for (const id of ids) {
      let chip = this.chips.get(id);
      if (!chip) chip = this.makeChip(id);
      this.host.appendChild(chip);
    }
  }

  private makeChip(id: PieceId) {
    const btn = el('button', 'piece-chip');
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    btn.dataset.pieceId = id;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    btn.appendChild(canvas);
    this.chips.set(id, btn);
    this.canvases.set(id, canvas);
    this.paintChip(id);
    this.bindChip(id, btn);
    return btn;
  }

  private paintChip(id: PieceId) {
    const canvas = this.canvases.get(id);
    const piece = this.session.getPiece(id);
    const sprite = this.board.getSprite(id);
    if (!canvas || !piece || !sprite) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawPieceThumb(canvas, sprite, piece.angle);
  }

  private bindChip(id: PieceId, btn: HTMLButtonElement) {
    let startX = 0;
    let startY = 0;
    let lastX = 0;
    let lastY = 0;
    let lastT = 0;
    let vel = 0;
    let mode: 'pending' | 'scroll' | 'drag' = 'pending';
    let pointerId: number | null = null;
    let holdTimer = 0;
    const audio = AudioService.getInstance();

    const clearHold = () => {
      if (holdTimer) window.clearTimeout(holdTimer);
      holdTimer = 0;
    };

    const beginDrag = (clientX: number, clientY: number) => {
      mode = 'drag';
      this.draggingId = id;
      this.dragOriginIndex = this.orderedIds().indexOf(id);
      btn.classList.add('is-dragging');
      this.hooks.setCameraEnabled(false);
      audio.playPop();
      this.hooks.held.start(id, clientX, clientY);
    };

    const onMove = (ev: PointerEvent) => {
      if (pointerId !== ev.pointerId) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      const axis = this.isLandscape() ? dy : dx;
      vel = axis / dt;
      lastX = ev.clientX;
      lastY = ev.clientY;
      lastT = now;

      if (mode === 'drag') {
        this.hooks.held.move(ev.clientX, ev.clientY);
        const moved = Math.hypot(ev.clientX - startX, ev.clientY - startY) >= TAP_THRESHOLD;
        if (moved && this.hooks.isOverTray(ev.clientX, ev.clientY)) {
          this.previewInsert(this.insertIndexAt(ev.clientX, ev.clientY, id), id, this.dragOriginIndex);
        } else {
          this.clearPreview();
        }
        return;
      }

      if (mode === 'pending') {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        const along = this.isLandscape() ? dy : dx;
        const perp = this.isLandscape() ? dx : dy;
        const towardBoard = perp < 0;
        if (towardBoard && Math.abs(perp) >= TAP_THRESHOLD && Math.abs(perp) >= Math.abs(along)) {
          clearHold();
          beginDrag(ev.clientX, ev.clientY);
          return;
        }
        if (Math.abs(along) >= TAP_THRESHOLD && Math.abs(along) > Math.abs(perp)) {
          clearHold();
          mode = 'scroll';
        }
      }
      if (mode === 'scroll') this.scrollBy(-axis);
    };

    const onUp = (ev: PointerEvent) => {
      if (pointerId !== ev.pointerId) return;
      pointerId = null;
      clearHold();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);

      if (mode === 'drag') {
        btn.classList.remove('is-dragging');
        this.hooks.setCameraEnabled(true);
        this.hooks.held.stop();
        this.draggingId = null;
        mode = 'pending';
        this.clearPreview();
        if (this.hooks.isOverTray(ev.clientX, ev.clientY)) {
          this.session.returnToTray(id, this.insertIndexAt(ev.clientX, ev.clientY, id));
          this.hooks.applyPieceVisual(id);
          this.rebuild();
          this.revealChip(id);
          return;
        }
        if (this.session.trySnap(id)) {
          audio.playSnap();
          this.hooks.onSolvedVisual(id);
        } else {
          this.hooks.applyPieceVisual(id);
          this.session.save();
        }
        this.rebuild();
        return;
      }

      if (mode === 'scroll') {
        this.startFlick(vel);
        mode = 'pending';
        return;
      }

      const now = performance.now();
      if (now - this.lastRotateAt >= TAP_ROTATE_DEBOUNCE_MS) {
        this.lastRotateAt = now;
        this.session.rotatePiece(id);
        audio.playClick();
      }
    };

    btn.addEventListener(
      'pointerdown',
      (ev) => {
        if (this.session.getReveal().eyeHold) return;
        ev.preventDefault();
        ev.stopPropagation();
        this.stopFlick();
        startX = ev.clientX;
        startY = ev.clientY;
        lastX = ev.clientX;
        lastY = ev.clientY;
        lastT = performance.now();
        vel = 0;
        mode = 'pending';
        pointerId = ev.pointerId;
        clearHold();
        holdTimer = window.setTimeout(() => {
          holdTimer = 0;
          if (mode !== 'pending' || pointerId === null) return;
          beginDrag(lastX, lastY);
        }, HOLD_MS);
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
      },
      { passive: false },
    );
  }
}
