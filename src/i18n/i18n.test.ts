import { describe, expect, it } from 'vitest';
import { MemoryStorage, ProgressStore } from '../data/ProgressStore';
import {
  getLocale,
  initI18n,
  interpolate,
  pickDeviceLocale,
  resolveLocaleTag,
  setLocale,
  t,
} from './index';

describe('i18n', () => {
  it('interpolates {name} placeholders', () => {
    expect(interpolate('Best {time}', { time: '1:02' })).toBe('Best 1:02');
    expect(interpolate('Keep {missing}', {})).toBe('Keep {missing}');
  });

  it('maps regional tags to shipped locales', () => {
    expect(resolveLocaleTag('pt-BR')).toBe('pt');
    expect(resolveLocaleTag('es-MX')).toBe('es');
    expect(resolveLocaleTag('en-US')).toBe('en');
    expect(resolveLocaleTag('de')).toBe('de');
    expect(resolveLocaleTag('zh-CN')).toBeNull();
  });

  it('picks the first supported device language, else English', () => {
    expect(pickDeviceLocale(['pt-BR', 'en'])).toBe('pt');
    expect(pickDeviceLocale(['zh-CN', 'fr-FR'])).toBe('fr');
    expect(pickDeviceLocale(['zh-CN', 'ja'])).toBe('en');
  });

  it('uses a saved locale over the device language', () => {
    initI18n({ saved: 'de', languages: ['es-ES'] });
    expect(getLocale()).toBe('de');
    expect(t('hud.menu')).toBe('Menü');
  });

  it('falls back to English when saved locale is unknown', () => {
    initI18n({ saved: 'zz', languages: ['ja'] });
    expect(getLocale()).toBe('en');
    expect(t('boot.loading')).toBe('Loading...');
  });

  it('setLocale switches catalogs immediately', () => {
    initI18n({ saved: 'en', languages: [] });
    setLocale('es');
    expect(t('hud.replay')).toBe('Desarmar y jugar');
    expect(t('hud.back')).toBe('Atrás');
    setLocale('fr');
    expect(t('event.daily')).toBe('Quotidien');
  });

  it('persists locale through ProgressStore', () => {
    const store = new ProgressStore(new MemoryStorage());
    expect(store.getLocale()).toBeNull();
    store.setLocale('pt');
    expect(store.getLocale()).toBe('pt');
  });
});
