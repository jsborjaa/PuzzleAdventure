import { iconHtml, type IconName } from './icons';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export function tap(btn: HTMLButtonElement, onClick: () => void) {
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

export function button(label: string, className: string, onClick?: () => void) {
  const btn = el('button', className);
  btn.type = 'button';
  btn.textContent = label;
  if (onClick) tap(btn, onClick);
  return btn;
}

export function roundButton(icon: IconName, label: string, tone: string, onClick?: () => void) {
  const btn = el('button', `btn ${tone} hud-round`);
  btn.type = 'button';
  btn.innerHTML = iconHtml(icon);
  btn.title = label;
  btn.setAttribute('aria-label', label);
  if (onClick) tap(btn, onClick);
  return btn;
}

export function pagePoint(ev: Event): { x: number; y: number } {
  const pt = ev as PointerEvent;
  if (typeof pt.pageX === 'number') return { x: pt.pageX, y: pt.pageY };
  const touch = (ev as TouchEvent).changedTouches?.[0];
  return { x: touch?.pageX ?? 0, y: touch?.pageY ?? 0 };
}

export function preventCanvasSteal(root: HTMLElement, signal: AbortSignal) {
  const stop = (e: Event) => e.stopPropagation();
  root.addEventListener('mousedown', stop, { signal });
  root.addEventListener('touchstart', stop, { passive: true, signal });
  root.addEventListener('pointerdown', stop, { signal });
}
