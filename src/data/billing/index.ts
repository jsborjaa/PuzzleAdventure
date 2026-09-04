import { SIMULATE_IAP } from '../../domain/product';
import { IAP_SKU_IDS, type IapSkuId } from '../../domain/powerups';
import type { BillingPort, CatalogProduct, PurchaseResult } from './types';
import { SimulateBilling } from './simulate';

export type { BillingPort, CatalogProduct, PurchaseResult };

/** `SIMULATE_IAP` or Vite DEV: local grants. Native production: Play Billing. Web production: unavailable. */
export function isSimulatedIap(): boolean {
  if (SIMULATE_IAP) return true;
  return import.meta.env.DEV;
}

class UnavailableBilling implements BillingPort {
  readonly simulated = false;

  async ensureReady(): Promise<void> {
    return;
  }

  getProducts(): CatalogProduct[] {
    return IAP_SKU_IDS.map((id) => ({ id, priceLabel: null }));
  }

  async purchase(_id: IapSkuId): Promise<PurchaseResult> {
    return { status: 'error', message: 'unavailable' };
  }

  async restore(): Promise<void> {
    return;
  }

  drainQueued(): IapSkuId[] {
    return [];
  }
}

let instance: BillingPort | null = null;

export function getBilling(): BillingPort {
  if (!instance) instance = new SimulateBilling();
  return instance;
}

/** Resolve simulate vs Play. Safe to call more than once. */
export async function ensureBilling(): Promise<BillingPort> {
  if (isSimulatedIap()) {
    instance = instance instanceof SimulateBilling ? instance : new SimulateBilling();
    await instance.ensureReady();
    return instance;
  }
  if (instance && !(instance instanceof SimulateBilling) && !(instance instanceof UnavailableBilling)) {
    await instance.ensureReady();
    return instance;
  }
  try {
    const { PlayBilling } = await import('./play');
    instance = new PlayBilling();
    await instance.ensureReady();
    return instance;
  } catch {
    instance = new UnavailableBilling();
    await instance.ensureReady();
    return instance;
  }
}
