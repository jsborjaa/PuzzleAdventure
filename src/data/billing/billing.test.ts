import { describe, expect, it } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { SIMULATE_IAP } from '../../domain/product';
import { IAP_SKU_IDS, getIapSku, isIapSkuId } from '../../domain/powerups';
import { SimulateBilling } from './simulate';
import { isSimulatedIap } from './index';

describe('billing', () => {
  it('maps Play product ids to the two IAP packs', () => {
    expect(IAP_SKU_IDS).toEqual(['pack_handy', 'pack_rare']);
    expect(isIapSkuId('pack_handy')).toBe(true);
    expect(isIapSkuId('ad_common')).toBe(false);
    expect(getIapSku('pack_handy')?.pack).toEqual({ hint: 10, lucky: 10, reveal_temp: 10 });
    expect(getIapSku('pack_rare')?.pack).toEqual({ area: 2, sarea: 3, reveal_perm: 2, solver: 1 });
  });

  it('simulate purchase does not touch inventory by itself', async () => {
    const billing = new SimulateBilling();
    await billing.ensureReady();
    expect(billing.simulated).toBe(true);
    expect(billing.getProducts()).toEqual([
      { id: 'pack_handy', priceLabel: null },
      { id: 'pack_rare', priceLabel: null },
    ]);
    expect(await billing.purchase('pack_handy')).toEqual({ status: 'purchased' });
    expect(billing.drainQueued()).toEqual([]);
  });

  it('simulates IAP in Vitest (Vite DEV, not native production)', () => {
    expect(Capacitor.isNativePlatform()).toBe(false);
    expect(isSimulatedIap()).toBe(true);
    expect(SIMULATE_IAP).toBe(false);
  });
});
