import { describe, expect, it } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { ADMOB_TEST_APP_ID, ADMOB_TEST_REWARDED_ID, getAdmobRewardedUnitId, isAdmobTestIds } from '../../domain/ads';
import { SimulateAds } from './simulate';
import { isSimulatedAds } from './index';

describe('ads', () => {
  it('defaults to Google sample rewarded ids', () => {
    expect(getAdmobRewardedUnitId()).toBe(ADMOB_TEST_REWARDED_ID);
    expect(ADMOB_TEST_APP_ID).toContain('ca-app-pub-');
    expect(isAdmobTestIds()).toBe(true);
  });

  it('simulate watch does not touch inventory by itself', async () => {
    const ads = new SimulateAds();
    await ads.ensureReady();
    expect(ads.simulated).toBe(true);
    expect(ads.available).toBe(true);
    expect(await ads.watchRewarded()).toEqual({ status: 'rewarded' });
  });

  it('simulates ads in Vitest (Vite DEV, not native production)', () => {
    expect(Capacitor.isNativePlatform()).toBe(false);
    expect(isSimulatedAds()).toBe(true);
  });
});
