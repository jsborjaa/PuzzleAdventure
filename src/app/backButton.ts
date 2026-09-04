/** Stack of Android hardware-back handlers. Last registered runs first. Return true to consume. */
type BackHandler = () => boolean;

const handlers: BackHandler[] = [];
let started = false;

export function pushBackHandler(handler: BackHandler): () => void {
  handlers.push(handler);
  return () => {
    const i = handlers.lastIndexOf(handler);
    if (i >= 0) handlers.splice(i, 1);
  };
}

export async function initBackButton(): Promise<void> {
  if (started) return;
  started = true;
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (!Capacitor.isNativePlatform()) return;
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', () => {
      for (let i = handlers.length - 1; i >= 0; i--) {
        if (handlers[i]!()) return;
      }
      void App.exitApp();
    });
  } catch {
    // Web, or plugin unavailable.
  }
}
