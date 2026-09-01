const STORAGE_KEY = 'puzzle-adventure-device-preview';

export type PreviewId = 'desktop' | 'iphone' | 'pixel';

const PRESETS: Record<Exclude<PreviewId, 'desktop'>, { w: number; h: number }> = {
  iphone: { w: 390, h: 844 },
  pixel: { w: 412, h: 915 },
};

interface PreviewState {
  id: PreviewId;
  rotated: boolean;
}

const listeners = new Set<() => void>();
let state: PreviewState = { id: 'desktop', rotated: false };
let bar: HTMLDivElement | null = null;

function loadState(): PreviewState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { id: 'desktop', rotated: false };
    const parsed = JSON.parse(raw) as PreviewState;
    if (parsed.id !== 'desktop' && parsed.id !== 'iphone' && parsed.id !== 'pixel') {
      return { id: 'desktop', rotated: false };
    }
    return { id: parsed.id, rotated: !!parsed.rotated };
  } catch {
    return { id: 'desktop', rotated: false };
  }
}

function saveState() {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function notify() {
  document.documentElement.classList.toggle('dev-preview', state.id !== 'desktop');
  if (bar) {
    bar.classList.add('is-on');
    bar.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.classList.toggle('is-active', btn.getAttribute('data-id') === state.id);
    });
    const rotate = bar.querySelector('[data-rotate]');
    rotate?.classList.toggle('is-active', state.rotated);
  }
  listeners.forEach((fn) => fn());
}

export function getPreviewSize(): { w: number; h: number } | null {
  if (!import.meta.env.DEV || state.id === 'desktop') return null;
  const preset = PRESETS[state.id];
  const w = state.rotated ? preset.h : preset.w;
  const h = state.rotated ? preset.w : preset.h;
  const maxW = Math.max(160, window.innerWidth - 24);
  const maxH = Math.max(160, window.innerHeight - 64);
  const scale = Math.min(1, maxW / w, maxH / h);
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

export function onPreviewChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function mountDevicePreview() {
  if (!import.meta.env.DEV || bar) return;
  state = loadState();
  bar = document.createElement('div');
  bar.className = 'dev-device-bar is-on';
  const makeBtn = (id: PreviewId, label: string) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.dataset.id = id;
    btn.addEventListener('click', () => {
      state = { id, rotated: id === 'desktop' ? false : state.rotated };
      saveState();
      notify();
    });
    return btn;
  };
  const rotate = document.createElement('button');
  rotate.type = 'button';
  rotate.textContent = 'Rotate';
  rotate.dataset.rotate = '1';
  rotate.addEventListener('click', () => {
    if (state.id === 'desktop') return;
    state = { ...state, rotated: !state.rotated };
    saveState();
    notify();
  });
  bar.append(makeBtn('desktop', 'Desktop'), makeBtn('iphone', 'iPhone'), makeBtn('pixel', 'Pixel'), rotate);
  document.body.appendChild(bar);
  notify();
}
