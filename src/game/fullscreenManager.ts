/**
 * Cross-browser Fullscreen & PWA Display Manager.
 *
 * Supports standard Fullscreen API, WebKit vendor prefixes (Safari/iOS iPadOS),
 * and handles PWA standalone/fullscreen display mode detection.
 */

export interface FullscreenState {
  supported: boolean;
  active: boolean;
  standalone: boolean;
}

type FullscreenListener = (state: FullscreenState) => void;

const listeners = new Set<FullscreenListener>();

/** True if the browser supports DOM element Fullscreen requests. */
export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    webkitFullscreenEnabled?: boolean;
    mozFullScreenEnabled?: boolean;
    msFullscreenEnabled?: boolean;
  };
  return Boolean(
    doc.fullscreenEnabled ||
    doc.webkitFullscreenEnabled ||
    doc.mozFullScreenEnabled ||
    doc.msFullscreenEnabled
  );
}

/** True if the document is currently rendered in DOM fullscreen mode. */
export function isFullscreenActive(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
    msFullscreenElement?: Element | null;
  };
  return Boolean(
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement
  );
}

/** True if the app is launched as an installed PWA in standalone or fullscreen display mode. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
    const isFullscreenMedia = window.matchMedia('(display-mode: fullscreen)').matches;
    const isIosStandalone = Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
    return isStandaloneMedia || isFullscreenMedia || isIosStandalone;
  } catch {
    return false;
  }
}

/** Returns the current snapshot of fullscreen capabilities and states. */
export function getFullscreenState(): FullscreenState {
  return {
    supported: isFullscreenSupported(),
    active: isFullscreenActive(),
    standalone: isStandaloneDisplay(),
  };
}

function notifyListeners(): void {
  const state = getFullscreenState();
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err) {
      console.warn('[fullscreenManager] Listener error:', err);
    }
  });
}

if (typeof document !== 'undefined') {
  const events = [
    'fullscreenchange',
    'webkitfullscreenchange',
    'mozfullscreenchange',
    'MSFullscreenChange',
  ];
  events.forEach((evt) => {
    document.addEventListener(evt, notifyListeners, { passive: true });
  });
}

/**
 * Requests entering immersive fullscreen on the document root element.
 * Must be initiated by direct user gesture (e.g. click/touch).
 */
export async function requestFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
    mozRequestFullScreen?: () => Promise<void> | void;
    msRequestFullscreen?: () => Promise<void> | void;
  };

  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
      return true;
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
      return true;
    } else if (el.mozRequestFullScreen) {
      await el.mozRequestFullScreen();
      return true;
    } else if (el.msRequestFullscreen) {
      await el.msRequestFullscreen();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[fullscreenManager] requestFullscreen rejected or failed:', err);
    return false;
  } finally {
    notifyListeners();
  }
}

/**
 * Exits immersive fullscreen mode.
 */
export async function exitFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    mozCancelFullScreen?: () => Promise<void> | void;
    msExitFullscreen?: () => Promise<void> | void;
  };

  try {
    if (doc.exitFullscreen) {
      await doc.exitFullscreen();
      return true;
    } else if (doc.webkitExitFullscreen) {
      await doc.webkitExitFullscreen();
      return true;
    } else if (doc.mozCancelFullScreen) {
      await doc.mozCancelFullScreen();
      return true;
    } else if (doc.msExitFullscreen) {
      await doc.msExitFullscreen();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[fullscreenManager] exitFullscreen rejected or failed:', err);
    return false;
  } finally {
    notifyListeners();
  }
}

/**
 * Toggles fullscreen mode between active and normal viewports.
 */
export async function toggleFullscreen(): Promise<boolean> {
  if (isFullscreenActive()) {
    return exitFullscreen();
  } else {
    return requestFullscreen();
  }
}

/**
 * Subscribes to changes in fullscreen state.
 */
export function subscribeFullscreen(listener: FullscreenListener): () => void {
  listeners.add(listener);
  listener(getFullscreenState());
  return () => {
    listeners.delete(listener);
  };
}
