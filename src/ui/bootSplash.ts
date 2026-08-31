import { t } from '../i18n';

export function showBootSplash() {
  const host = document.getElementById('ui-layer');
  if (!host) return;
  host.innerHTML = '';
  const root = document.createElement('div');
  root.className = 'boot-splash';
  root.id = 'boot-splash';
  const logo = document.createElement('div');
  logo.className = 'hub-logo';
  logo.innerHTML = `<span class="brand-top">${t('menu.brandPuzzle')}</span><span class="brand-bottom">${t('menu.brandAdventure')}</span>`;
  const label = document.createElement('p');
  label.id = 'boot-splash-label';
  label.textContent = t('boot.loading');
  const bar = document.createElement('div');
  bar.className = 'boot-bar';
  const fill = document.createElement('div');
  fill.className = 'boot-bar-fill';
  fill.id = 'boot-splash-fill';
  bar.appendChild(fill);
  root.append(logo, label, bar);
  host.appendChild(root);
}

export function setBootProgress(ratio: number) {
  const fill = document.getElementById('boot-splash-fill');
  if (fill) fill.style.width = `${Math.max(8, Math.min(100, Math.round(ratio * 100)))}%`;
}

export function setBootError() {
  const label = document.getElementById('boot-splash-label');
  if (label) label.textContent = t('boot.error');
}
