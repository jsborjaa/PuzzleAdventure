import { AdMob, AdmobConsentStatus } from '@capacitor-community/admob';
import { getAdmobRewardedUnitId, isAdmobTestIds } from '../../domain/ads';
import type { AdsPort, AdWatchResult } from './types';

export class AdMobAds implements AdsPort {
  readonly simulated = false;
  readonly available = true;
  private ready: Promise<void> | null = null;

  async ensureReady(): Promise<void> {
    if (!this.ready) this.ready = this.start();
    await this.ready;
  }

  async watchRewarded(): Promise<AdWatchResult> {
    await this.ensureReady();
    try {
      await AdMob.prepareRewardVideoAd({
        adId: getAdmobRewardedUnitId(),
        isTesting: isAdmobTestIds(),
      });
      const reward = await AdMob.showRewardVideoAd();
      if (reward && reward.amount > 0) return { status: 'rewarded' };
      return { status: 'cancelled' };
    } catch (err) {
      const message = errorMessage(err);
      if (/cancel|closed|dismiss/i.test(message)) return { status: 'cancelled' };
      return { status: 'error', message: message || 'error' };
    }
  }

  private async start(): Promise<void> {
    await AdMob.initialize({ initializeForTesting: isAdmobTestIds() });
    try {
      const consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        await AdMob.showConsentForm();
      }
    } catch {
      // Test ads still work without a published UMP message.
    }
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}
