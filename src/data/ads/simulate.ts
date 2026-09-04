import type { AdsPort, AdWatchResult } from './types';

export class SimulateAds implements AdsPort {
  readonly simulated = true;
  readonly available = true;

  async ensureReady(): Promise<void> {
    return;
  }

  async watchRewarded(): Promise<AdWatchResult> {
    return { status: 'rewarded' };
  }
}
