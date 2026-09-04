/** Google sample app id. Swap via `VITE_ADMOB_APP_ID` + Android `admob_app_id` for production. */
export const ADMOB_TEST_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
/** Google sample rewarded unit. Swap via `VITE_ADMOB_REWARDED_UNIT_ID` for production. */
export const ADMOB_TEST_REWARDED_ID = 'ca-app-pub-3940256099942544/5224354917';

export function getAdmobAppId(): string {
  return import.meta.env.VITE_ADMOB_APP_ID || ADMOB_TEST_APP_ID;
}

export function getAdmobRewardedUnitId(): string {
  return import.meta.env.VITE_ADMOB_REWARDED_UNIT_ID || ADMOB_TEST_REWARDED_ID;
}

export function isAdmobTestIds(): boolean {
  return getAdmobAppId() === ADMOB_TEST_APP_ID || getAdmobRewardedUnitId() === ADMOB_TEST_REWARDED_ID;
}
