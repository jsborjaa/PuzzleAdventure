import { GameConfig } from './GameConfig';
import { initBackButton } from './backButton';
import { getPreviewSize, mountDevicePreview, onPreviewChange } from '../ui/devicePreview';

export function boot() {
  void applyNativeChrome();
  void initBackButton();
  mountDevicePreview();
  const game = new Phaser.Game(GameConfig);

  let rafId: number | null = null;
  let timeoutId: number | null = null;

  const getViewportSize = () => {
    const preview = getPreviewSize();
    if (preview) return preview;
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    return { w, h };
  };

  const getPhaserSize = (app: HTMLElement | null, view: { w: number; h: number }) => {
    if (!app?.classList.contains('play-active')) return view;
    const gc = document.getElementById('game-container');
    if (!gc) return view;
    const r = gc.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return view;
    return { w: Math.round(r.width), h: Math.round(r.height) };
  };

  const doResize = () => {
    const view = getViewportSize();
    if (view.w < 2 || view.h < 2) return;
    const app = document.getElementById('app');
    if (app) {
      app.style.width = `${view.w}px`;
      app.style.height = `${view.h}px`;
      if (app.classList.contains('play-active')) {
        app.classList.toggle('is-landscape', view.w > view.h);
        app.classList.toggle('is-portrait', view.w <= view.h);
      }
    }
    const { w, h } = getPhaserSize(app, view);
    game.scale.resize(w, h);
    for (const scene of game.scene.getScenes(true)) {
      scene.cameras.main.setSize(w, h);
    }
  };

  const scheduleResize = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);
    rafId = requestAnimationFrame(() => {
      doResize();
      rafId = null;
    });
    timeoutId = window.setTimeout(() => {
      doResize();
      timeoutId = null;
    }, 80);
  };

  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener(
    'orientationchange',
    () => {
      scheduleResize();
      window.setTimeout(scheduleResize, 200);
      window.setTimeout(scheduleResize, 450);
    },
    { passive: true },
  );
  window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });
  if (import.meta.env.DEV) {
    mountDevicePreview();
    onPreviewChange(scheduleResize);
  }
  scheduleResize();
}

async function applyNativeChrome() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#6ec8ff' });
  } catch {
    // Web, or plugin unavailable.
  }
}
