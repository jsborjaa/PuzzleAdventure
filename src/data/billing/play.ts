import { ErrorCode, Platform, ProductType, store, type IError, type Transaction } from 'capacitor-plugin-cdv-purchase';
import { IAP_SKU_IDS, isIapSkuId, type IapSkuId } from '../../domain/powerups';
import type { BillingPort, CatalogProduct, PurchaseResult } from './types';

type Resolver = (result: PurchaseResult) => void;

export class PlayBilling implements BillingPort {
  readonly simulated = false;
  private ready: Promise<void> | null = null;
  private inflight = new Map<IapSkuId, Resolver[]>();
  private queued: IapSkuId[] = [];
  private hooked = false;

  async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.start();
    await this.ready;
  }

  getProducts(): CatalogProduct[] {
    return IAP_SKU_IDS.map((id) => {
      const product = store.get(id, Platform.GOOGLE_PLAY) ?? store.get(id);
      const price = product?.pricing?.price ?? product?.getOffer()?.pricingPhases[0]?.price ?? null;
      return { id, priceLabel: price };
    });
  }

  async purchase(id: IapSkuId): Promise<PurchaseResult> {
    await this.ensureReady();
    const product = store.get(id, Platform.GOOGLE_PLAY) ?? store.get(id);
    const offer = product?.getOffer();
    if (!product || !offer) {
      return { status: 'error', message: 'unavailable' };
    }
    const result = await new Promise<PurchaseResult>((resolve) => {
      const list = this.inflight.get(id) ?? [];
      list.push(resolve);
      this.inflight.set(id, list);
      void store.order(offer).then((err) => {
        if (!err) return;
        this.takeResolvers(id).forEach((fn) => fn(mapError(err)));
      });
    });
    return result;
  }

  async restore(): Promise<void> {
    return;
  }

  drainQueued(): IapSkuId[] {
    const next = this.queued;
    this.queued = [];
    return next;
  }

  private async start(): Promise<void> {
    this.hookOnce();
    store.register(
      IAP_SKU_IDS.map((id) => ({
        id,
        type: ProductType.CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      })),
    );
    await store.initialize([Platform.GOOGLE_PLAY]);
    await store.update();
  }

  private hookOnce() {
    if (this.hooked) return;
    this.hooked = true;
    store.when().approved((transaction) => {
      void this.onApproved(transaction);
    });
    store.error((err) => {
      const id = err.productId && isIapSkuId(err.productId) ? err.productId : undefined;
      const result = mapError(err);
      if (id) {
        const waiters = this.takeResolvers(id);
        if (waiters.length > 0) {
          waiters.forEach((fn) => fn(result));
          return;
        }
      }
      if (result.status === 'cancelled') {
        for (const sku of IAP_SKU_IDS) {
          this.takeResolvers(sku).forEach((fn) => fn(result));
        }
      }
    });
  }

  private async onApproved(transaction: Transaction) {
    const ids = transaction.products.map((row) => row.id).filter(isIapSkuId);
    try {
      await transaction.finish();
    } catch {
      // still deliver if Play already charged
    }
    for (const id of ids) {
      const waiters = this.takeResolvers(id);
      if (waiters.length > 0) waiters.forEach((fn) => fn({ status: 'purchased' }));
      else this.queued.push(id);
    }
  }

  private takeResolvers(id: IapSkuId): Resolver[] {
    const list = this.inflight.get(id) ?? [];
    this.inflight.delete(id);
    return list;
  }
}

function mapError(err: IError): PurchaseResult {
  if (err.code === ErrorCode.PAYMENT_CANCELLED) return { status: 'cancelled' };
  return { status: 'error', message: err.message || 'error' };
}
