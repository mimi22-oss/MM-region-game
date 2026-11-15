import { Browser } from '@capacitor/browser';
import { SUBSCRIPTION_WEBSITE_URL } from '../data/subscriptionBillboard.ts';
import { isAllowedShopUrl } from '../game/subscriptionShop.ts';
import { getNetworkState, refreshNetworkState } from './networkStatus.ts';
import { isNativeApp } from './platform.ts';

export type OnlineOpenResult =
  | { opened: true; mode: 'capacitor-browser' | 'web-tab' }
  | { opened: false; reason: 'offline' | 'invalid-url' | 'failed'; message: string };

export interface OnlineServiceDescriptor {
  id: 'subscription-shop' | 'multiplayer-presence' | 'gemini-asset-studio' | 'future-cloud-sync';
  requiresInternet: true;
  offlineCachePolicy: 'never-cache-sensitive-data';
  endpoint?: string;
}

export const ONLINE_SERVICES: readonly OnlineServiceDescriptor[] = [
  {
    id: 'subscription-shop',
    requiresInternet: true,
    offlineCachePolicy: 'never-cache-sensitive-data',
    endpoint: SUBSCRIPTION_WEBSITE_URL,
  },
  {
    id: 'multiplayer-presence',
    requiresInternet: true,
    offlineCachePolicy: 'never-cache-sensitive-data',
  },
  {
    id: 'gemini-asset-studio',
    requiresInternet: true,
    offlineCachePolicy: 'never-cache-sensitive-data',
  },
  {
    id: 'future-cloud-sync',
    requiresInternet: true,
    offlineCachePolicy: 'never-cache-sensitive-data',
  },
];

export interface OnlineSyncAdapter {
  readonly enabled: boolean;
  syncProfileSummary: (summary: { areaId?: string; savedAt: string }) => Promise<{ synced: boolean; reason?: string }>;
}

/** Future online synchronization hook kept cleanly separate from offline core gameplay. */
export function createOnlineSyncAdapter(): OnlineSyncAdapter {
  return {
    enabled: false,
    async syncProfileSummary() {
      if (!getNetworkState().connected) {
        return { synced: false, reason: 'offline' };
      }
      return { synced: false, reason: 'not-configured' };
    },
  };
}

/**
 * Opens an allowlisted HTTPS Subscription Shop page safely without bypassing CSP/WebView policies:
 * - Native Android: uses Chrome Custom Tabs (`@capacitor/browser`) for full login/checkout session support
 *   and returns directly to the paused game when closed.
 * - Web: opens a safe `noopener,noreferrer` browser tab.
 */
function isSafeExternalStoreUrl(candidate: string): boolean {
  if (!isAllowedShopUrl(candidate)) return false;
  try {
    const parsed = new URL(candidate);
    return (
      parsed.protocol === 'https:' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === 'localhost'
    );
  } catch {
    return false;
  }
}

export async function openOnlineSubscriptionStore(
  candidateUrl: string,
  options?: { onNativeBrowserFinished?: () => void },
): Promise<OnlineOpenResult> {
  if (!isSafeExternalStoreUrl(candidateUrl)) {
    return {
      opened: false,
      reason: 'invalid-url',
      message: 'Blocked disallowed or non-HTTPS shop URL.',
    };
  }

  const net = await refreshNetworkState();
  if (!net.connected) {
    return {
      opened: false,
      reason: 'offline',
      message: 'No internet connection. Reconnect to open the online Subscription Shop.',
    };
  }

  if (isNativeApp()) {
    let listenerHandle: { remove: () => Promise<void> } | null = null;
    try {
      listenerHandle = await Browser.addListener('browserFinished', () => {
        void listenerHandle?.remove().catch(() => {});
        listenerHandle = null;
        options?.onNativeBrowserFinished?.();
      });
      await Browser.open({
        url: candidateUrl,
        toolbarColor: '#0f172a',
        presentationStyle: 'fullscreen',
      });
      return { opened: true, mode: 'capacitor-browser' };
    } catch (error) {
      void listenerHandle?.remove().catch(() => {});
      return {
        opened: false,
        reason: 'failed',
        message: error instanceof Error ? error.message : 'Unable to open in-app browser.',
      };
    }
  }

  if (typeof window !== 'undefined') {
    window.open(candidateUrl, '_blank', 'noopener,noreferrer');
    return { opened: true, mode: 'web-tab' };
  }

  return {
    opened: false,
    reason: 'failed',
    message: 'Window unavailable.',
  };
}
