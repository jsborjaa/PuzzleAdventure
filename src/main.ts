import './style.css';
import 'phaser';
import { GameConfig } from './core/GameConfig';

window.addEventListener('load', () => {
  const game = new Phaser.Game(GameConfig);

  let rafId: number | null = null;
  let timeoutId: number | null = null;

  const getViewportSize = () => {
    const vv = window.visualViewport;
    // visualViewport es más confiable en móviles (especialmente al rotar) que innerWidth/innerHeight
    const w = Math.round(vv?.width ?? window.innerWidth);
    const h = Math.round(vv?.height ?? window.innerHeight);
    return { w, h };
  };

  const doResize = () => {
    const { w, h } = getViewportSize();
    // Phaser Scale RESIZE: forzamos el canvas/renderer a coincidir con el viewport visible
    game.scale.resize(w, h);
  };

  const scheduleResize = () => {
    if (rafId !== null) cancelAnimationFrame(rafId);
    if (timeoutId !== null) window.clearTimeout(timeoutId);

    // Primer ajuste ASAP en el siguiente frame
    rafId = requestAnimationFrame(() => {
      doResize();
      rafId = null;
    });

    // Segundo ajuste corto: Chrome Android puede tardar un poco en estabilizar el viewport tras rotar
    timeoutId = window.setTimeout(() => {
      doResize();
      timeoutId = null;
    }, 80);
  };

  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('orientationchange', scheduleResize, { passive: true });
  window.visualViewport?.addEventListener('resize', scheduleResize, { passive: true });

  scheduleResize();
});

