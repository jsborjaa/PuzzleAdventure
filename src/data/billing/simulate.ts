import { IAP_SKU_IDS, type IapSkuId } from '../../domain/powerups';
import type { BillingPort, CatalogProduct, PurchaseResult } from './types';

export class SimulateBilling implements BillingPort {
  readonly simulated = true;

  async ensureReady(): Promise<void> {
    return;
  }

  getProducts(): CatalogProduct[] {
    return IAP_SKU_IDS.map((id) => ({ id, priceLabel: null }));
  }

  async purchase(_id: IapSkuId): Promise<PurchaseResult> {
    return { status: 'purchased' };
  }

  async restore(): Promise<void> {
    return;
  }

  async finish(_id: IapSkuId): Promise<void> {
    return;
  }

  drainQueued(): IapSkuId[] {
    return [];
  }
}
