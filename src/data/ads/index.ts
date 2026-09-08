import { Capacitor } from '@capacitor/core';
import type { AdsPort } from './types';
import { SimulateAds } from './simulate';

export type { AdsPort, AdWatchResult } from './types';

/** Vite DEV: local grant. Native production: AdMob. Web production: unavailable. */
export function isSimulatedAds(): boolean {
  return import.meta.env.DEV;
}

class UnavailableAds implements AdsPort {
  readonly simulated = false;
  readonly available = false;

  async ensureReady(): Promise<void> {
    return;
  }

  async watchRewarded() {
    return { status: 'error' as const, message: 'unavailable' };
  }
}

let instance: AdsPort | null = null;

/** Resolve simulate vs AdMob. Safe to call more than once. */
export async function ensureAds(): Promise<AdsPort> {
  if (isSimulatedAds()) {
    instance = instance instanceof SimulateAds ? instance : new SimulateAds();
    await instance.ensureReady();
    return instance;
  }
  if (!Capacitor.isNativePlatform()) {
    instance = new UnavailableAds();
    await instance.ensureReady();
    return instance;
  }
  if (instance && !(instance instanceof SimulateAds) && !(instance instanceof UnavailableAds)) {
    await instance.ensureReady();
    return instance;
  }
  try {
    const { AdMobAds } = await import('./admob');
    instance = new AdMobAds();
    await instance.ensureReady();
    return instance;
  } catch {
    instance = new UnavailableAds();
    await instance.ensureReady();
    return instance;
  }
}
