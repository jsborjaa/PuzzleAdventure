import { GameConfig } from './GameConfig';
import { getPreviewSize, mountDevicePreview, onPreviewChange } from '../ui/devicePreview';

export function boot() {
  void applyNativeChrome();
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

  const doResize = () => {
    const { w, h } = getViewportSize();
    const app = document.getElementById('app');
    if (app) {
      app.style.width = `${w}px`;
      app.style.height = `${h}px`;
    }
    game.scale.resize(w, h);
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
  window.addEventListener('orientationchange', scheduleResize, { passive: true });
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
