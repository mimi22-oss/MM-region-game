import { normalizeAssetPath } from '../game/otaCompatibility.ts';
import type { AssetCacheManager } from './assetCacheManager.ts';

const OFFLINE_ASSET_PREFIXES = [
  'models/',
  'motions/',
  'map/',
  'assets/',
];

const OFFLINE_ROOT_FILES = new Set([
  'app-icon.webp',
  'favicon.ico',
  'favicon.png',
  'favicon.jpg',
  'ogp.png',
  'kalay_sign_face.png',
  'burmese_lion_emblem.png',
  'burmese_lion_transparent.png',
]);

export function isOfflineManagedAssetPath(pathname: string): boolean {
  try {
    const clean = normalizeAssetPath(pathname).toLowerCase();
    if (!clean || clean.startsWith('ota/')) return false;
    if (OFFLINE_ROOT_FILES.has(clean)) return true;
    return OFFLINE_ASSET_PREFIXES.some((prefix) => clean.startsWith(prefix));
  } catch {
    return false;
  }
}

let interceptorInstalled = false;

/**
 * Intercepts same-origin GET fetches for game assets (`/models/`, `/motions/`, `/map/`, `/assets/`, icons/textures)
 * so Three.js loaders and `fetchMapJson` transparently read the active atomic OTA asset generation when synced,
 * or fall through directly to the offline APK builtin bundle when no OTA asset override is active.
 */
export function installOfflineAssetInterceptor(cacheManager: AssetCacheManager, getCodeVersion?: () => string): () => void {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function' || interceptorInstalled) {
    return () => {};
  }

  const originalFetch = window.fetch.bind(window);
  interceptorInstalled = true;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET') {
      return originalFetch(input, init);
    }

    let requestUrl: URL | null = null;
    try {
      const rawUrl =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      requestUrl = new URL(rawUrl, window.location.href);
    } catch {
      return originalFetch(input, init);
    }

    if (requestUrl.origin !== window.location.origin) {
      return originalFetch(input, init);
    }

    if (!isOfflineManagedAssetPath(requestUrl.pathname)) {
      return originalFetch(input, init);
    }

    // Bypass cache only when an explicit cache-busting OTA probe is issued.
    if (requestUrl.searchParams.get('ota-bypass') === '1') {
      return originalFetch(input, init);
    }

    try {
      const cached = await cacheManager.resolveActiveAsset(requestUrl.pathname, getCodeVersion?.());
      if (cached) {
        const body = new Uint8Array(cached.bytes.byteLength);
        body.set(cached.bytes);
        return new Response(body.buffer, {
          status: 200,
          statusText: 'OK (OTA Offline Asset Cache)',
          headers: {
            'Content-Type': cached.contentType,
            'Content-Length': String(cached.bytes.byteLength),
            'X-MM-Asset-Source': 'ota-cache',
            'X-MM-Asset-SHA256': cached.sha256,
          },
        });
      }
    } catch {
      // Fall back safely to builtin bundled WebView/static origin on unexpected cache errors
    }

    return originalFetch(input, init);
  };

  return () => {
    window.fetch = originalFetch;
    interceptorInstalled = false;
  };
}
