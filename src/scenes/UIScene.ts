import { Scene } from 'phaser';
import { ProgressService } from '../services/ProgressService';
import { TimerStore } from '../game/timer/TimerStore';

export class UIScene extends Scene {
  private uiContainer: HTMLElement | null = null;
  private progressBarFill: HTMLElement | null = null;
  private piecesTotal: number = 0;
  private piecesSolved: number = 0;
  private revealTimerEl: HTMLElement | null = null;
  private revealIntervalId: number | null = null;
  private revealRemaining: number = 0;
  private powerupCounts: Record<string, number> = { };
  private powerupBadges: Map<string, HTMLElement> = new Map();
  private dragSource: { key: string, startX: number, startY: number } | null = null;
  private timerLabel: HTMLElement | null = null;
  private liveTimerInterval: number | null = null;
  private pocketButtons: { btn: HTMLButtonElement, idx: number }[] = [];
  private isPocketOpen: boolean = false;
  private bottomBarEl: HTMLElement | null = null;
  private pocketActionsEl: HTMLElement | null = null;
  private pocketPuzzleBtnEl: HTMLButtonElement | null = null;
  private pocketCameraBtnEl: HTMLButtonElement | null = null;
  private activePocketIdx: number = 0;
  private pocketCapturePending: boolean = false;
  private pocketCameraHoldActive: boolean = false;

  private readonly onPiecePlacedUpdatePocketCamera = () => this.updatePocketCameraButton();
  private readonly onPocketCameraBlocked = (payload?: { pocketIndex?: number }) => {
    if (!payload || payload.pocketIndex === undefined) return;
    if (payload.pocketIndex !== this.activePocketIdx) return;
    this.updatePocketCameraButton();
  };

  constructor() {
    super('UIScene');
  }

  create() {
    console.log('UIScene created');
    this.uiContainer = document.getElementById('ui-layer');
    
    if (!this.uiContainer) return;

    // Init counts from global service (ProgressService)
    const ps = ProgressService.getInstance();
    this.powerupCounts = ps.getPowerups();

    // Cleanup old listeners if any (though scene restart should clear them usually)
    this.events.on('shutdown', this.cleanup, this);

    // Build UI
    const topBar = document.createElement('div');
    topBar.className = 'hud-top';
    
    // Helper to prevent click-through to Phaser
    const preventProp = (btn: HTMLElement) => {
        const stop = (e: Event) => e.stopPropagation();
        btn.addEventListener('mousedown', stop);
        btn.addEventListener('touchstart', stop);
        btn.addEventListener('pointerdown', stop);
    };

    const backBtn = document.createElement('button');
    backBtn.className = 'btn';
    backBtn.textContent = 'Menu';
    preventProp(backBtn); // Fix click-through
    backBtn.onclick = (e) => {
        e.stopPropagation();
      // Cleanup and go back
      const gameScene = this.scene.get('GameScene');
      if (gameScene) {
        gameScene.events.emit('request-save');
      }
      const timerStore = TimerStore.getInstance();
      timerStore.persist(true);
      this.scene.stop('GameScene');
      this.scene.stop('UIScene'); // stop UIScene itself
      this.scene.start('MenuScene');
    };

    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-bar-container';
    this.progressBarFill = document.createElement('div');
    this.progressBarFill.className = 'progress-bar-fill';
    progressContainer.appendChild(this.progressBarFill);

    // Timer label next to progress
    const timerBox = document.createElement('div');
    timerBox.className = 'timer-label';
    timerBox.style.marginLeft = '10px';
    timerBox.style.minWidth = '70px';
    timerBox.style.textAlign = 'center';
    timerBox.style.color = '#ffe66d';
    timerBox.style.fontWeight = 'bold';
    this.timerLabel = timerBox;

    // Reveal countdown (for 20s power-up)
    const revealBox = document.createElement('div');
    revealBox.className = 'reveal-timer';
    revealBox.style.marginLeft = '10px';
    revealBox.style.minWidth = '50px';
    revealBox.style.textAlign = 'center';
    revealBox.style.color = '#ffe66d';
    revealBox.style.fontWeight = 'bold';
    revealBox.style.display = 'none';
    this.revealTimerEl = revealBox;

    const progressWrapper = document.createElement('div');
    progressWrapper.style.display = 'flex';
    progressWrapper.style.alignItems = 'center';
    progressWrapper.appendChild(progressContainer);
    progressWrapper.appendChild(timerBox);
    progressWrapper.appendChild(revealBox);

    topBar.appendChild(backBtn);
    topBar.appendChild(progressWrapper);

    // Pocket buttons (DOM) debajo de progreso/cronómetro
    this.createPocketButtons(topBar);
    // Pocket actions (DOM) visibles solo cuando el bolsillo está abierto (modo enfoque)
    this.createPocketActions(topBar);

    // EYE BUTTON (Hold to view)
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'btn btn-secondary';
    eyeBtn.textContent = '👁️ Ver';
    eyeBtn.style.marginLeft = '20px'; // Spacing
    
    // Mouse events for hold behavior
    const showGuide = (e: Event) => {
        e.stopPropagation();
        const gameScene = this.scene.get('GameScene');
        gameScene.events.emit('show-guide', true);
    };
    const hideGuide = (e: Event) => {
        e.stopPropagation();
        const gameScene = this.scene.get('GameScene');
        gameScene.events.emit('show-guide', false);
    };

    eyeBtn.onmousedown = showGuide;
    eyeBtn.onmouseup = hideGuide;
    eyeBtn.onmouseleave = hideGuide; 
    
    // Touch events for mobile
    eyeBtn.ontouchstart = (e) => { e.preventDefault(); e.stopPropagation(); showGuide(e); };
    eyeBtn.ontouchend = (e) => { e.preventDefault(); e.stopPropagation(); hideGuide(e); };

    topBar.appendChild(eyeBtn);

    const bottomBar = document.createElement('div');
    bottomBar.className = 'hud-bottom';
    this.bottomBarEl = bottomBar;

    // REVEAL BUTTON (Permanent)
    const revealBtn = this.createPowerupButton('🔓 Revelar ∞', 'reveal_perm', () => {
        const gameScene = this.scene.get('GameScene');
        gameScene.events.emit('toggle-reveal-permanent');
    });

    // REVEAL BUTTON (Temporary)
    const revealTempBtn = this.createPowerupButton('⏲️ Revelar 20s', 'reveal_temp', () => {
        const gameScene = this.scene.get('GameScene');
        if (!this.hasCharges('reveal_temp')) return;
        gameScene.events.emit('toggle-reveal-temp');
    });

    // AREA BUTTON (New)
    const areaBtn = this.createPowerupButton('🟥 Área', 'area', undefined, 'activate-area-drag', 'deactivate-area-drag');

    // SUPER AREA BUTTON (4x4)
    const sAreaBtn = this.createPowerupButton('⬛ sÁrea', 'sarea', undefined, 'activate-sarea-drag', 'deactivate-sarea-drag');

    const hintBtn = this.createPowerupButton('💡 Pista', 'hint', undefined, 'activate-hint-drag', 'deactivate-hint-drag');

    bottomBar.appendChild(revealBtn);
    bottomBar.appendChild(revealTempBtn);
    bottomBar.appendChild(areaBtn);
    bottomBar.appendChild(sAreaBtn);
    bottomBar.appendChild(hintBtn);
    // Reset powerups (visible)
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-secondary';
    resetBtn.textContent = 'Reset PUs';
    resetBtn.style.marginLeft = '10px';
    preventProp(resetBtn);
    resetBtn.onclick = (e) => {
        e.stopPropagation();
        const ps = ProgressService.getInstance();
        ps.resetPowerups();
        this.powerupCounts = ps.getPowerups();
        Object.keys(this.powerupCounts).forEach(k => this.updateBadge(k));
    };
    bottomBar.appendChild(resetBtn);

    // Drag-to-upgrade rules
    this.setupUpgrade(areaBtn, 'area', sAreaBtn, 'sarea', { area: 2 });
    this.setupUpgrade(revealTempBtn, 'reveal_temp', revealBtn, 'reveal_perm', { reveal_temp: 3 });

    this.uiContainer.appendChild(topBar);
    this.uiContainer.appendChild(bottomBar);

    // Listen to Game Events
    const gameScene = this.scene.get('GameScene') as any; 
    
    // Clear previous listeners to avoid stacking or zombie listeners
    gameScene.events.off('progress-sync');
    gameScene.events.off('game-started');
    
    // Initialize immediately if game is already running
    const existingPieces = gameScene.getPieces ? gameScene.getPieces() : gameScene.pieces;
    if (existingPieces && existingPieces.length > 0) {
        this.piecesTotal = existingPieces.length;
        this.piecesSolved = existingPieces.filter((p: any) => p.isSolved).length;
        this.updateProgress();
    }
    
    // Listen for Truth Sync instead of blind events
    gameScene.events.on('progress-sync', (count: number) => {
        this.piecesSolved = count;
        this.updateProgress();
    });

    // Reveal Temp countdown listener
    gameScene.events.on('reveal-temp-changed', (isActive: boolean) => {
        if (isActive) {
            this.startRevealCountdown(20);
        } else {
            this.stopRevealCountdown();
        }
    });

    // Timer updates
    gameScene.events.on('timer-updated', (elapsedMs: number) => {
        this.updateTimerLabel(elapsedMs);
    });

    // Power-up consumption
    gameScene.events.on('powerup-used', (type: string) => {
        this.consumePowerup(type);
    });

    // Foto bolsillo: refrescar disponibilidad cuando cambia el progreso/plantillas.
    // Ojo: nunca llamar off('piece-placed') sin callback, porque rompería el listener interno del GameScene.
    gameScene.events.off('piece-placed', this.onPiecePlacedUpdatePocketCamera);
    gameScene.events.on('piece-placed', this.onPiecePlacedUpdatePocketCamera);
    gameScene.events.off('pocket-camera-blocked', this.onPocketCameraBlocked);
    gameScene.events.on('pocket-camera-blocked', this.onPocketCameraBlocked);

    // Listen for Powerup State Changes
    gameScene.events.on('area-mode-changed', (isActive: boolean) => {
        if (isActive) {
            areaBtn.classList.add('active');
            areaBtn.style.background = '#ffe66d';
            areaBtn.style.color = '#333';
        } else {
            areaBtn.classList.remove('active');
            areaBtn.style.background = '';
            areaBtn.style.color = '';
        }
    });

    gameScene.events.on('sarea-mode-changed', (isActive: boolean) => {
        if (isActive) {
            sAreaBtn.classList.add('active');
            sAreaBtn.style.background = '#ffe66d';
            sAreaBtn.style.color = '#333';
        } else {
            sAreaBtn.classList.remove('active');
            sAreaBtn.style.background = '';
            sAreaBtn.style.color = '';
        }
    });

    gameScene.events.on('hint-mode-changed', (isActive: boolean) => {
        if (isActive) {
            hintBtn.classList.add('active');
            hintBtn.style.background = '#ffe66d';
            hintBtn.style.color = '#333';
        } else {
            hintBtn.classList.remove('active');
            hintBtn.style.background = '';
            hintBtn.style.color = '';
        }
    });
    
    // Also listen for restart/init events
    gameScene.events.on('game-started', (total: number) => {
        this.piecesTotal = total;
        this.piecesSolved = 0;
        this.updateProgress();
    });
  }

  private updatePocketCameraButton() {
    if (!this.pocketCameraBtnEl) return;
    const gameScene = this.scene.get('GameScene') as any;
    const canTake =
      typeof gameScene?.canTakePocketPhoto === 'function'
        ? !!gameScene.canTakePocketPhoto(this.activePocketIdx)
        : true;

    this.pocketCameraBtnEl.disabled = !canTake;
    this.pocketCameraBtnEl.style.opacity = canTake ? '1' : '0.55';
    this.pocketCameraBtnEl.style.cursor = canTake ? 'pointer' : 'not-allowed';
    this.pocketCameraBtnEl.textContent = canTake ? 'Tomar foto (4x4)' : 'Tomar foto (4x4) (resuelve la zona)';
  }

  private startPocketCameraHold(ev: MouseEvent) {
    ev.stopPropagation();
    ev.preventDefault?.();
    if (this.pocketCameraHoldActive) return;

    const gameScene = this.scene.get('GameScene');
    if (!gameScene) return;

    // Restricción: 1 foto por bolsillo hasta resolver completamente el área fotografiada.
    const canTake =
      typeof (gameScene as any)?.canTakePocketPhoto === 'function'
        ? !!(gameScene as any).canTakePocketPhoto(this.activePocketIdx)
        : true;
    if (!canTake) {
      this.updatePocketCameraButton();
      return;
    }

    this.pocketCameraHoldActive = true;
    this.pocketCapturePending = true;

    // Cierra el modo bolsillo pero mantiene el flujo para reabrir al capturar o cancelar
    this.closePocket(true);
    gameScene.events.emit('activate-pocket-camera');

    let finished = false;
    const cleanup = () => {
      window.removeEventListener('mouseup', onWindowMouseUp);
      gameScene.events.off('pocket-template-captured', onCaptured);
      gameScene.events.off('pocket-camera-cancelled', onCancelled);
      this.pocketCameraHoldActive = false;
    };

    const finish = () => {
      if (finished) return;
      finished = true;
      if (!this.pocketCapturePending) {
        cleanup();
        return;
      }
      this.pocketCapturePending = false;
      // Reabrir el bolsillo activo después de capturar o cancelar
      this.openPocket(this.activePocketIdx);
      gameScene.events.emit('cancel-pocket-camera');
      cleanup();
    };

    const onCaptured = () => finish();
    const onCancelled = () => finish();

    // Éxito: capturó (mouseup dentro del tablero)
    gameScene.events.once('pocket-template-captured', onCaptured);
    // Cancelación: mouseup fuera del tablero (emitido por CameraTool)
    gameScene.events.once('pocket-camera-cancelled', onCancelled);

    // Fallback: mouseup fuera del canvas (Phaser puede no recibir pointerup)
    const onWindowMouseUp = (e: MouseEvent) => {
      if (finished) return;
      const rect = this.game.canvas.getBoundingClientRect();
      const insideCanvas =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;
      if (insideCanvas) return; // Phaser manejará el pointerup
      gameScene.events.emit('pocket-camera-cancelled');
    };

    window.addEventListener('mouseup', onWindowMouseUp, { once: true });
  }

  updateProgress() {
    if (!this.progressBarFill || this.piecesTotal === 0) return;
    // Clamp percentage to 100% to avoid visual overflow
    const pct = Math.min(100, (this.piecesSolved / this.piecesTotal) * 100);
    this.progressBarFill.style.width = `${pct}%`;
  }

  cleanup() {
    this.clearUI();
    const gameScene = this.scene.get('GameScene');
    if (gameScene) {
      gameScene.events.off('progress-sync');
      gameScene.events.off('game-started');
      gameScene.events.off('area-mode-changed');
      gameScene.events.off('sarea-mode-changed');
      gameScene.events.off('reveal-temp-changed');
      gameScene.events.off('hint-mode-changed');
      gameScene.events.off('powerup-used');
      gameScene.events.off('timer-updated');
      gameScene.events.off('piece-placed', this.onPiecePlacedUpdatePocketCamera);
      gameScene.events.off('pocket-camera-blocked', this.onPocketCameraBlocked);
    }
    this.stopRevealCountdown();
    this.stopTimerInterval();
    this.pocketButtons = [];
    this.pocketCapturePending = false;
    this.pocketCameraHoldActive = false;
    this.pocketCameraBtnEl = null;
  }

  clearUI() {
    if (this.uiContainer) {
      this.uiContainer.innerHTML = '';
    }
  }

  private startRevealCountdown(seconds: number) {
    this.stopRevealCountdown(); // clear previous
    this.revealRemaining = seconds;
    if (!this.revealTimerEl) return;
    this.revealTimerEl.style.display = 'inline-block';
    this.revealTimerEl.textContent = `${this.revealRemaining}s`;

    this.revealIntervalId = window.setInterval(() => {
        this.revealRemaining -= 1;
        if (!this.revealTimerEl) return;
        if (this.revealRemaining <= 0) {
            this.revealTimerEl.textContent = '0s';
            this.stopRevealCountdown();
            return;
        }
        this.revealTimerEl.textContent = `${this.revealRemaining}s`;
    }, 1000);
  }

  private stopRevealCountdown() {
    if (this.revealIntervalId !== null) {
        window.clearInterval(this.revealIntervalId);
        this.revealIntervalId = null;
    }
    if (this.revealTimerEl) {
        this.revealTimerEl.style.display = 'none';
        this.revealTimerEl.textContent = '';
    }
    this.revealRemaining = 0;
  }

  // --- Power-up UI Helpers ---
  private createPowerupButton(label: string, key: string, onClick?: () => void, dragStartEvent?: string, dragStopEvent?: string) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.textContent = label;
    btn.style.marginRight = '10px';
    btn.style.position = 'relative';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';

    // Badge
    const badge = document.createElement('span');
    badge.style.position = 'absolute';
    badge.style.top = '4px';
    badge.style.right = '6px';
    badge.style.padding = '2px 4px';
    badge.style.borderRadius = '6px';
    badge.style.background = '#2f3542';
    badge.style.color = '#ffe66d';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = 'bold';
    badge.style.minWidth = '16px';
    badge.style.textAlign = 'center';
    badge.style.pointerEvents = 'none';
    btn.appendChild(badge);
    this.powerupBadges.set(key, badge);
    this.updateBadge(key);

    // Prevent propagation
    const stop = (e: Event) => e.stopPropagation();
    btn.addEventListener('mousedown', stop);
    btn.addEventListener('touchstart', stop);
    btn.addEventListener('pointerdown', stop);

    // Click logic
    if (onClick) {
      btn.onclick = (e) => {
        e.stopPropagation();
        if (!this.hasCharges(key)) return;
        onClick();
      };
    }

    // Drag logic for tools
    if (dragStartEvent && dragStopEvent) {
      const startDrag = (e: Event) => {
        e.stopPropagation();
        if (e.type === 'touchstart') (e as any).preventDefault();
        if (!this.hasCharges(key)) return;

        const gameScene = this.scene.get('GameScene');
        gameScene.events.emit(dragStartEvent);

        const stopDrag = () => {
          gameScene.events.emit(dragStopEvent);
          window.removeEventListener('mouseup', stopDrag);
          window.removeEventListener('touchend', stopDrag);
        };

        window.addEventListener('mouseup', stopDrag);
        window.addEventListener('touchend', stopDrag);
      };

      btn.addEventListener('mousedown', startDrag);
      btn.addEventListener('touchstart', startDrag);
    }

    return btn;
  }

  private hasCharges(key: string) {
    return (this.powerupCounts[key] ?? 0) > 0;
  }

  private updateBadge(key: string) {
    const badge = this.powerupBadges.get(key);
    if (!badge) return;
    const val = this.powerupCounts[key] ?? 0;
    badge.textContent = `${val}`;
    const parent = badge.parentElement as HTMLButtonElement | null;
    if (parent) {
      parent.style.opacity = val === 0 ? '0.5' : '1';
    }
  }

  private consumePowerup(key: string) {
    const ps = ProgressService.getInstance();
    const ok = ps.consumePowerup(key);
    if (ok) {
      this.powerupCounts = ps.getPowerups();
      this.updateBadge(key);
    }
  }

  // --- Upgrade via drag (convert base → premium) ---
  private setupUpgrade(sourceBtn: HTMLElement, sourceKey: string, targetBtn: HTMLElement, targetKey: string, cost: Record<string, number>) {
    const onPointerDown = (ev: PointerEvent) => {
      ev.stopPropagation();
      this.dragSource = { key: sourceKey, startX: ev.clientX, startY: ev.clientY };
      window.addEventListener('pointerup', onPointerUp, { once: true });
    };

    const onPointerUp = (ev: PointerEvent) => {
      const drag = this.dragSource;
      this.dragSource = null;
      if (!drag) return;

      // Only consider as drag if moved a bit
      const moved = Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) > 5;
      if (!moved) return;

      const rect = targetBtn.getBoundingClientRect();
      if (ev.clientX < rect.left || ev.clientX > rect.right || ev.clientY < rect.top || ev.clientY > rect.bottom) return;

      // Check costs
      const canPay = Object.entries(cost).every(([k, v]) => (this.powerupCounts[k] ?? 0) >= v);
      if (!canPay) return;

      // Pay and grant
      const ps = ProgressService.getInstance();
      const counts = ps.getPowerups();
      Object.entries(cost).forEach(([k, v]) => { counts[k] = Math.max(0, (counts[k] ?? 0) - v); });
      counts[targetKey] = (counts[targetKey] ?? 0) + 1;
      ps.setPowerups(counts);
      this.powerupCounts = ps.getPowerups();
      this.updateBadge(sourceKey);
      this.updateBadge(targetKey);
    };

    sourceBtn.addEventListener('pointerdown', onPointerDown);
  }

  // --- Timer UI ---
  private updateTimerLabel(elapsedMs: number) {
    if (!this.timerLabel) return;
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    const label = hrs > 0 ? `${hrs}:${two(mins)}:${two(secs)}` : `${mins}:${two(secs)}`;
    this.timerLabel.textContent = label;
  }

  private stopTimerInterval() {
    if (this.liveTimerInterval !== null) {
      window.clearInterval(this.liveTimerInterval);
      this.liveTimerInterval = null;
    }
  }

  // --- Pocket UI ---
  private createPocketButtons(topBar: HTMLElement) {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.marginTop = '6px';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'flex-start';
    const label = document.createElement('span');
    label.textContent = 'Bolsillos:';
    label.style.color = '#ffe66d';
    label.style.fontWeight = 'bold';
    row.appendChild(label);

    for (let i = 0; i < 3; i++) {
      const btn = document.createElement('button');
      btn.className = 'btn btn-secondary';
      btn.textContent = `B${i + 1}`;
      btn.style.padding = '6px 10px';
      btn.onclick = (e) => { e.stopPropagation(); this.openPocket(i); };
      row.appendChild(btn);
      this.pocketButtons.push({ btn, idx: i });
    }
    topBar.appendChild(row);
  }

  private createPocketActions(topBar: HTMLElement) {
    const row = document.createElement('div');
    row.style.display = 'none';
    row.style.gap = '8px';
    row.style.marginTop = '6px';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'flex-start';
    row.style.pointerEvents = 'auto';
    row.className = 'pocket-actions-top';

    const preventProp = (btn: HTMLElement) => {
      const stop = (e: Event) => e.stopPropagation();
      btn.addEventListener('mousedown', stop);
      btn.addEventListener('touchstart', stop);
      btn.addEventListener('pointerdown', stop);
    };

    const btnPuzzle = document.createElement('button');
    btnPuzzle.className = 'btn btn-secondary btn-compact';
    btnPuzzle.textContent = 'Puzzle';
    preventProp(btnPuzzle);
    btnPuzzle.onclick = (e) => {
      e.stopPropagation();
      // Intencionalmente no hace acción por click:
      // funciona como "destino de drop" para devolver UNA pieza al tablero principal.
    };
    this.pocketPuzzleBtnEl = btnPuzzle;

    const btnRetrieve = document.createElement('button');
    btnRetrieve.className = 'btn btn-secondary btn-compact';
    btnRetrieve.textContent = 'Sacar todo';
    preventProp(btnRetrieve);
    btnRetrieve.onclick = (e) => {
      e.stopPropagation();
      const gameScene = this.scene.get('GameScene');
      gameScene.events.emit('pocket-retrieve-all', this.activePocketIdx);
    };

    const btnCamera = document.createElement('button');
    btnCamera.className = 'btn btn-secondary btn-compact';
    btnCamera.textContent = 'Tomar foto (4x4)';
    preventProp(btnCamera);
    btnCamera.onmousedown = (e) => this.startPocketCameraHold(e);
    this.pocketCameraBtnEl = btnCamera;
    this.updatePocketCameraButton();

    row.append(btnPuzzle, btnRetrieve, btnCamera);
    topBar.appendChild(row);
    this.pocketActionsEl = row;
  }

  public isPointerOverPocket(pointer: Phaser.Input.Pointer): number | null {
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const screenX = canvasRect.left + pointer.x;
    const screenY = canvasRect.top + pointer.y;
    for (const { btn, idx } of this.pocketButtons) {
      const rect = btn.getBoundingClientRect();
      if (screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom) {
        return idx;
      }
    }
    return null;
  }

  public isPointerOverPuzzle(pointer: Phaser.Input.Pointer): boolean {
    if (!this.pocketPuzzleBtnEl) return false;
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const screenX = canvasRect.left + pointer.x;
    const screenY = canvasRect.top + pointer.y;
    const rect = this.pocketPuzzleBtnEl.getBoundingClientRect();
    return screenX >= rect.left && screenX <= rect.right && screenY >= rect.top && screenY <= rect.bottom;
  }

  private openPocket(idx: number) {
    // Toggle: si ya está abierto el mismo bolsillo, cerrar
    if (this.isPocketOpen && this.activePocketIdx === idx) {
      this.closePocket();
      return;
    }
    this.activePocketIdx = idx;
    const gameScene = this.scene.get('GameScene');
    gameScene.events.emit('pocket-open', idx);
    // El bolsillo vive en Phaser como modo de enfoque sobre el tablero (PocketFocusMode).
    this.isPocketOpen = true;
    this.updatePocketButtonHighlight();
    this.setPowerupsVisible(false);
    this.setPocketActionsVisible(true);
    this.updatePocketCameraButton();
  }

  private closePocket(keepCapture: boolean = false) {
    if (!keepCapture) {
      this.pocketCapturePending = false;
      const gameScene = this.scene.get('GameScene');
      gameScene.events.emit('cancel-pocket-camera');
    }
    // Cerrar overlay Phaser del bolsillo (interacción de piezas vive en canvas)
    const gameScene = this.scene.get('GameScene');
    gameScene.events.emit('pocket-close');
    this.isPocketOpen = false;
    this.updatePocketButtonHighlight();
    this.setPowerupsVisible(true);
    this.setPocketActionsVisible(false);
  }

  private updatePocketButtonHighlight() {
    for (const { btn, idx } of this.pocketButtons) {
      const isActive = this.isPocketOpen && idx === this.activePocketIdx;
      if (isActive) btn.classList.add('pocket-active');
      else btn.classList.remove('pocket-active');
    }
  }

  private setPowerupsVisible(visible: boolean) {
    if (!this.bottomBarEl) return;
    this.bottomBarEl.style.display = visible ? 'flex' : 'none';
  }

  private setPocketActionsVisible(visible: boolean) {
    if (!this.pocketActionsEl) return;
    this.pocketActionsEl.style.display = visible ? 'flex' : 'none';
  }
}
