import { useSyncExternalStore } from 'react';
import { Network, type ConnectionStatus } from '@capacitor/network';
import { isNativeApp } from './platform.ts';

export type NetworkConnectionType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface NetworkState {
  connected: boolean;
  connectionType: NetworkConnectionType;
  source: 'capacitor' | 'browser';
  checkedAt: number;
}

function readBrowserOnline(fallback = true): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return fallback;
  return navigator.onLine !== false;
}

function mapConnectionType(raw: string | undefined, connected: boolean): NetworkConnectionType {
  if (!connected || raw === 'none') return 'none';
  if (raw === 'wifi' || raw === 'cellular') return raw;
  return 'unknown';
}

const initialOnline = readBrowserOnline(true);
let state: NetworkState = {
  connected: initialOnline,
  connectionType: initialOnline ? 'unknown' : 'none',
  source: 'browser',
  checkedAt: Date.now(),
};

const listeners = new Set<() => void>();
let initialized = false;

function publish(next: NetworkState) {
  if (
    state.connected === next.connected &&
    state.connectionType === next.connectionType &&
    state.source === next.source
  ) {
    return;
  }
  state = next;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // Isolate listener errors
    }
  });
}

function applyCapacitorStatus(status: ConnectionStatus) {
  publish({
    connected: Boolean(status.connected),
    connectionType: mapConnectionType(status.connectionType, Boolean(status.connected)),
    source: 'capacitor',
    checkedAt: Date.now(),
  });
}

function initListeners() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  const onBrowserChange = () => {
    const connected = readBrowserOnline();
    publish({
      connected,
      connectionType: connected ? 'unknown' : 'none',
      source: isNativeApp() ? state.source : 'browser',
      checkedAt: Date.now(),
    });
    if (isNativeApp()) {
      void refreshNetworkState();
    }
  };

  window.addEventListener('online', onBrowserChange);
  window.addEventListener('offline', onBrowserChange);

  if (isNativeApp()) {
    void refreshNetworkState();
    void Network.addListener('networkStatusChange', applyCapacitorStatus).catch(() => {
      // Ignore listener setup failures in non-native environments
    });
  }
}

/** Synchronously checks the latest known connectivity state. */
export function getNetworkState(): NetworkState {
  initListeners();
  return state;
}

export function isNetworkOnline(): boolean {
  return getNetworkState().connected;
}

/** Queries native Capacitor Network (when available) or browser navigator.onLine. */
export async function refreshNetworkState(): Promise<NetworkState> {
  initListeners();
  if (isNativeApp()) {
    try {
      const nativeStatus = await Network.getStatus();
      applyCapacitorStatus(nativeStatus);
      return state;
    } catch {
      // Fall through to browser connectivity check
    }
  }
  const connected = readBrowserOnline(state.connected);
  publish({
    connected,
    connectionType: connected ? state.connectionType : 'none',
    source: 'browser',
    checkedAt: Date.now(),
  });
  return state;
}

export function subscribeNetworkState(listener: () => void): () => void {
  initListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNetworkState(): NetworkState {
  return useSyncExternalStore(subscribeNetworkState, getNetworkState, getNetworkState);
}

/** Exposed primarily for unit tests to simulate transitions cleanly. */
export function setNetworkStateForTest(next: Partial<NetworkState>) {
  publish({
    ...state,
    ...next,
    checkedAt: Date.now(),
  });
}
