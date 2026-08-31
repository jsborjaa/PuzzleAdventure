import { messages, type LocaleId, type Localized } from './messages';
import type { MessageKey, MessageVars } from './types';

export type { LocaleId, Localized } from './messages';
export type { MessageKey, MessageVars } from './types';

export const FALLBACK_LOCALE: LocaleId = 'en';

export const SUPPORTED_LOCALES: { id: LocaleId; nativeName: string }[] = [
  { id: 'en', nativeName: 'English' },
  { id: 'es', nativeName: 'Español' },
  { id: 'de', nativeName: 'Deutsch' },
  { id: 'fr', nativeName: 'Français' },
  { id: 'pt', nativeName: 'Português' },
];

let current: LocaleId = FALLBACK_LOCALE;

export function isLocaleId(value: string): value is LocaleId {
  return SUPPORTED_LOCALES.some((l) => l.id === value);
}

/** Map `pt-BR`, `es-MX`, `en-US` → shipped locale, or null. */
export function resolveLocaleTag(tag: string): LocaleId | null {
  const normalized = tag.trim().toLowerCase().replace('_', '-');
  if (!normalized) return null;
  if (isLocaleId(normalized)) return normalized;
  const base = normalized.split('-')[0] ?? '';
  return isLocaleId(base) ? base : null;
}

export function pickDeviceLocale(langs: readonly string[]): LocaleId {
  for (const tag of langs) {
    const id = resolveLocaleTag(tag);
    if (id) return id;
  }
  return FALLBACK_LOCALE;
}

export function applyDocumentLang(id: LocaleId) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = id;
}

export function initI18n(opts: { saved?: string | null; languages?: readonly string[] } = {}) {
  const saved = opts.saved && isLocaleId(opts.saved) ? opts.saved : null;
  const langs =
    opts.languages ??
    (typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []);
  current = saved ?? pickDeviceLocale(langs);
  applyDocumentLang(current);
}

export function getLocale(): LocaleId {
  return current;
}

export function setLocale(id: LocaleId) {
  current = isLocaleId(id) ? id : FALLBACK_LOCALE;
  applyDocumentLang(current);
}

function lookupLeaf(key: string): Localized | undefined {
  const parts = key.split('.');
  let cur: unknown = messages;
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  if (typeof cur !== 'object' || cur === null || !('en' in cur)) return undefined;
  return cur as Localized;
}

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    vars[name] !== undefined ? String(vars[name]) : whole,
  );
}

export function t(key: MessageKey, vars?: MessageVars): string {
  const leaf = lookupLeaf(key);
  const raw = (leaf?.[current] || leaf?.[FALLBACK_LOCALE]) ?? key;
  return interpolate(raw, vars);
}
