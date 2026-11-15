import { App } from '@capacitor/app';
import { isNativeApp } from './platform.ts';

export interface AndroidLifecycleHandlers {
  onActiveChange: (isActive: boolean) => void;
  onBackgroundFlush: () => void;
  onBackButton: () => boolean;
}

/**
 * Connects native Android/Capacitor lifecycle (`appStateChange`, `pause`, `resume`, `backButton`)
 * cleanly while remaining a safe no-op in Web / SSR / test environments.
 */
export function registerAndroidLifecycle(handlers: AndroidLifecycleHandlers): () => void {
  if (!isNativeApp()) {
    return () => {};
  }

  let disposed = false;
  const handles: Array<{ remove: () => Promise<void> }> = [];

  const track = (promise: Promise<{ remove: () => Promise<void> }>) => {
    void promise
      .then((handle) => {
        if (disposed) {
          void handle.remove().catch(() => {});
        } else {
          handles.push(handle);
        }
      })
      .catch(() => {
        // Ignore plugin listener registration errors
      });
  };

  track(
    App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) {
        handlers.onBackgroundFlush();
      }
      handlers.onActiveChange(isActive);
    }),
  );

  track(
    App.addListener('pause', () => {
      handlers.onBackgroundFlush();
      handlers.onActiveChange(false);
    }),
  );

  track(
    App.addListener('resume', () => {
      handlers.onActiveChange(true);
    }),
  );

  track(
    App.addListener('backButton', () => {
      const handled = handlers.onBackButton();
      if (!handled) {
        handlers.onBackgroundFlush();
        void App.minimizeApp().catch(() => {});
      }
    }),
  );

  return () => {
    disposed = true;
    for (const handle of handles) {
      void handle.remove().catch(() => {});
    }
    handles.length = 0;
  };
}
