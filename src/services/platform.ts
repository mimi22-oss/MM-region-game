import { Capacitor } from '@capacitor/core';

export type RuntimePlatform = 'android' | 'ios' | 'web';

/** Returns the active Capacitor platform without throwing in Node/SSR contexts. */
export function getRuntimePlatform(): RuntimePlatform {
  if (typeof window === 'undefined') return 'web';
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return platform;
  } catch {
    // Fallback to web when Capacitor bridge is unavailable.
  }
  return 'web';
}

/** True when packaged inside a native Capacitor container (Android/iOS). */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

/** True when running inside the native Android Capacitor shell. */
export function isNativeAndroid(): boolean {
  return isNativeApp() && getRuntimePlatform() === 'android';
}
