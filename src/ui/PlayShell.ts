import { t } from '../i18n';
import { el } from './dom';

export interface PlayShell {
  chrome: HTMLElement;
  status: HTMLElement;
  tray: HTMLElement;
  destroy(): void;
}

export function syncPlayOrientation(app: HTMLElement = document.getElementById('app')!) {
  if (!app) return;
  const landscape = app.clientWidth > app.clientHeight;
  app.classList.toggle('is-landscape', landscape);
  app.classList.toggle('is-portrait', !landscape);
}

export function mountPlayShell(): PlayShell {
  const app = document.getElementById('app');
  const game = document.getElementById('game-container');
  const ui = document.getElementById('ui-layer');
  if (!app || !game || !ui) throw new Error('Play shell: missing #app, #game-container, or #ui-layer');

  const chrome = el('div', 'play-chrome');
  const status = el('div', 'play-status');
  const tray = el('div', 'play-tray');
  chrome.setAttribute('role', 'toolbar');
  chrome.setAttribute('aria-label', t('hud.chrome'));
  tray.setAttribute('role', 'list');
  tray.setAttribute('aria-label', t('hud.tray'));

  app.insertBefore(chrome, game);
  app.insertBefore(status, game);
  app.insertBefore(tray, ui);
  app.classList.add('play-active');
  syncPlayOrientation(app);

  const onResize = () => syncPlayOrientation(app);
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  return {
    chrome,
    status,
    tray,
    destroy() {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      chrome.remove();
      status.remove();
      tray.remove();
      app.classList.remove('play-active', 'is-landscape', 'is-portrait');
    },
  };
}
