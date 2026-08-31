import { GameConfig } from './GameConfig';

export function boot() {
  void applyNativeChrome();
  const game = new Phaser.Game(GameConfig);

  let rafId: number | null = null;
  let timeoutId: number | null = null;

  const getViewportSize = () => {
    const vv = window.visualViewport;
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    return { w, h };
  };

  const doResize = () => {
    const { w, h } = getViewportSize();
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
  scheduleResize();
}

async function applyNativeChrome() {
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#2f3542' });
  } catch {
    // Web, or plugin unavailable.
  }
}
