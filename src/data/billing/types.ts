import type { IapSkuId } from '../../domain/powerups';

export interface CatalogProduct {
  id: IapSkuId;
  /** Localized Play price, or null when simulating / unknown. */
  priceLabel: string | null;
}

export type PurchaseResult =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface BillingPort {
  readonly simulated: boolean;
  ensureReady(): Promise<void>;
  getProducts(): CatalogProduct[];
  purchase(id: IapSkuId): Promise<PurchaseResult>;
  restore(): Promise<void>;
  /** Acknowledge a granted purchase with the store. No-op when simulating. */
  finish(id: IapSkuId): Promise<void>;
  /** Purchases approved while the store UI was not waiting (crash after pay). */
  drainQueued(): IapSkuId[];
}
