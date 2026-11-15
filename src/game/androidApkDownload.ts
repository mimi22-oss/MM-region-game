import { isNativeApp } from '../services/platform.ts';

export const TELEGRAM_CHANNEL_URL = 'https://t.me/mmregiongame';
export const TELEGRAM_CHANNEL_SHORT_LINK = 't.me/mmregiongame';
export const TELEGRAM_CHANNEL_HANDLE = '@MMREGIONGAME';
export const TELEGRAM_QR_IMAGE_URL = '/telegram-qr.jpg';
export const ANDROID_APK_PROMPT_DISMISSED_KEY = 'mm-android-apk-prompt-dismissed-v1';

export interface AndroidBrowserCheckInput {
  readonly userAgent?: string;
  readonly platform?: string;
  readonly nativeApp?: boolean;
}

const EXCLUDED_ANDROID_HOSTS_RE = /\b(?:android tv|googletv|smarttv|smart-tv|crkey|wear os|aftb|aftm|afts)\b/i;

/**
 * Returns true for Android phone/mobile web browsers while returning false for
 * desktop browsers, iOS devices, smart TVs, and already-installed native APK containers.
 */
export function isAndroidPhoneUserAgent(
  userAgent: string,
  platform?: string,
): boolean {
  const ua = userAgent.trim();
  const plat = (platform ?? '').trim().toLowerCase();
  if (EXCLUDED_ANDROID_HOSTS_RE.test(ua)) return false;
  return /\bandroid\b/i.test(ua) || plat === 'android';
}

export function isAndroidBrowserEligible(input?: AndroidBrowserCheckInput): boolean {
  const native = input?.nativeApp ?? isNativeApp();
  if (native) return false;

  if (input?.userAgent !== undefined || input?.platform !== undefined) {
    return isAndroidPhoneUserAgent(input.userAgent ?? '', input.platform);
  }

  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  const uaDataPlatform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform;
  return isAndroidPhoneUserAgent(ua, uaDataPlatform ?? navigator.platform);
}

export function readAndroidApkPromptDismissed(storage?: Pick<Storage, 'getItem'> | null): boolean {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    return store?.getItem(ANDROID_APK_PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAndroidApkPromptDismissed(
  dismissed: boolean,
  storage?: Pick<Storage, 'setItem' | 'removeItem'> | null,
): void {
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!store) return;
    if (dismissed) {
      store.setItem(ANDROID_APK_PROMPT_DISMISSED_KEY, '1');
    } else {
      store.removeItem(ANDROID_APK_PROMPT_DISMISSED_KEY);
    }
  } catch {
    // Ignore storage quota / restricted WebView storage errors
  }
}

export function shouldShowAndroidApkAutoPrompt(
  input?: AndroidBrowserCheckInput & {
    readonly storage?: Pick<Storage, 'getItem'> | null;
  },
): boolean {
  if (!isAndroidBrowserEligible(input)) return false;
  return !readAndroidApkPromptDismissed(input?.storage);
}
