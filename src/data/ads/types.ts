export type AdWatchResult =
  | { status: 'rewarded' }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

export interface AdsPort {
  readonly simulated: boolean;
  readonly available: boolean;
  ensureReady(): Promise<void>;
  watchRewarded(): Promise<AdWatchResult>;
}
