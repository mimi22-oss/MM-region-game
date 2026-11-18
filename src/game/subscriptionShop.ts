import { useSyncExternalStore } from 'react';
import {
  DEFAULT_SUBSCRIPTION_BILLBOARD,
  SUBSCRIPTION_WEBSITE_URL,
  type SubscriptionBillboardConfig,
} from '../data/subscriptionBillboard.ts';

export type SubscriptionTriggerSource =
  | 'billboard-click'
  | 'crosshair-click'
  | 'mobile-tap'
  | 'proximity-action'
  | 'keyboard';

export interface SubscriptionShopState {
  isOpen: boolean;
  url: string;
  title: string;
  lastTriggerSource: SubscriptionTriggerSource | null;
  playerDistanceM: number | null;
  isNearBillboard: boolean;
  openCount: number;
}

const initialState = (): SubscriptionShopState => ({
  isOpen: false,
  url: SUBSCRIPTION_WEBSITE_URL,
  title: DEFAULT_SUBSCRIPTION_BILLBOARD.title,
  lastTriggerSource: null,
  playerDistanceM: null,
  isNearBillboard: false,
  openCount: 0,
});

let state: SubscriptionShopState = initialState();
const listeners = new Set<() => void>();
let lastBillboardClickAtMs = -Infinity;

export type SceneTapHandler = (
  clientX: number,
  clientY: number,
  isCenterCrosshair?: boolean,
  sourceOverride?: SubscriptionTriggerSource,
) => boolean;
const registeredTapHandlers = new Set<SceneTapHandler>();

function emit() {
  for (const fn of listeners) fn();
}

export function subscribeSubscriptionShop(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSubscriptionShopState(): SubscriptionShopState {
  return state;
}

export function useSubscriptionShop(): SubscriptionShopState {
  return useSyncExternalStore(subscribeSubscriptionShop, getSubscriptionShopState, getSubscriptionShopState);
}

/** Validates whether an external/local shop URL is safe to load in dialog/browser links. */
export function isAllowedShopUrl(candidate: string): boolean {
  try {
    const base = typeof window !== 'undefined' ? window.location.href : SUBSCRIPTION_WEBSITE_URL;
    const parsed = new URL(candidate, base);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function distanceToBillboardXZ(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  return Math.hypot(ax - bx, az - bz);
}

export function canInteractAtDistance(
  distanceM: number | null,
  config: Pick<SubscriptionBillboardConfig, 'interactionDistanceM' | 'maxClickDistanceM' | 'enforceDistance'> = DEFAULT_SUBSCRIPTION_BILLBOARD,
): boolean {
  if (distanceM === null || !Number.isFinite(distanceM)) return true;
  if (config.enforceDistance) {
    return distanceM <= config.interactionDistanceM + 0.05;
  }
  return distanceM <= config.maxClickDistanceM;
}

/**
 * Opens the Subscription Shop fullscreen website dialog.
 * Guards against duplicate modal stacking while already open.
 */
export function openSubscriptionShop(
  source: SubscriptionTriggerSource,
  urlOverride?: string,
  titleOverride?: string,
): boolean {
  if (state.isOpen) return false;
  const candidateUrl = urlOverride ?? state.url;
  if (!isAllowedShopUrl(candidateUrl)) return false;

  if (typeof document !== 'undefined' && document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch {
      // Ignore if pointer lock exit fails in headless contexts
    }
  }

  state = {
    ...state,
    isOpen: true,
    url: candidateUrl,
    title: titleOverride ?? state.title,
    lastTriggerSource: source,
    openCount: state.openCount + 1,
  };
  emit();
  return true;
}

export function closeSubscriptionShop(): boolean {
  if (!state.isOpen) return false;
  state = {
    ...state,
    isOpen: false,
  };
  emit();
  return true;
}

export function setSubscriptionShopUrl(url: string): void {
  if (!isAllowedShopUrl(url) || state.url === url) return;
  state = { ...state, url };
  emit();
}

const activeScreenDistances = new Map<string, { dist: number; threshold: number }>();

export function setSubscriptionPlayerDistance(
  distanceM: number | null,
  thresholdM = DEFAULT_SUBSCRIPTION_BILLBOARD.interactionDistanceM,
): void {
  const near = distanceM !== null && Number.isFinite(distanceM) && distanceM <= thresholdM;
  const rounded = distanceM === null || !Number.isFinite(distanceM) ? null : Math.round(distanceM * 10) / 10;
  if (state.isNearBillboard === near && state.playerDistanceM === rounded) return;
  state = {
    ...state,
    playerDistanceM: rounded,
    isNearBillboard: near,
  };
  emit();
}

/**
 * Reports distance for a specific subscription display screen (Smart TV, Computer monitor, Wall billboard)
 * and resolves the minimum distance across all active screens so proximity prompt stays active wherever player stands.
 */
export function reportSubscriptionScreenDistance(
  screenId: string,
  distanceM: number | null,
  thresholdM = DEFAULT_SUBSCRIPTION_BILLBOARD.interactionDistanceM,
): void {
  if (distanceM === null || !Number.isFinite(distanceM)) {
    activeScreenDistances.delete(screenId);
  } else {
    activeScreenDistances.set(screenId, { dist: distanceM, threshold: thresholdM });
  }

  if (activeScreenDistances.size === 0) {
    setSubscriptionPlayerDistance(null, thresholdM);
    return;
  }

  let minDist: number | null = null;
  let minThreshold = thresholdM;
  for (const { dist, threshold } of activeScreenDistances.values()) {
    if (dist !== null && Number.isFinite(dist)) {
      if (minDist === null || dist < minDist) {
        minDist = dist;
        minThreshold = threshold;
      }
    }
  }

  setSubscriptionPlayerDistance(minDist, minThreshold);
}

/** Marks the current click as handled by the 3D billboard so Canvas pointer lock stays suppressed. */
export function markBillboardPointerConsumed(nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now()): void {
  lastBillboardClickAtMs = nowMs;
}

export function wasBillboardClickRecentlyConsumed(
  windowMs = 150,
  nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now(),
): boolean {
  return nowMs - lastBillboardClickAtMs <= windowMs;
}

export function registerBillboardTapHandler(handler: SceneTapHandler): () => void {
  registeredTapHandlers.add(handler);
  return () => {
    registeredTapHandlers.delete(handler);
  };
}

export function tryTapSubscriptionBillboard(
  clientX: number,
  clientY: number,
  sourceOverride: SubscriptionTriggerSource = 'mobile-tap',
): boolean {
  if (state.isOpen) return false;
  for (const handler of registeredTapHandlers) {
    if (handler(clientX, clientY, false, sourceOverride)) {
      markBillboardPointerConsumed();
      return true;
    }
  }
  return false;
}

export function tryCenterClickSubscriptionBillboard(): boolean {
  if (state.isOpen) return false;
  for (const handler of registeredTapHandlers) {
    if (handler(0, 0, true)) {
      markBillboardPointerConsumed();
      return true;
    }
  }
  return false;
}

export function resetSubscriptionShopForTests(): void {
  state = initialState();
  lastBillboardClickAtMs = -Infinity;
  registeredTapHandlers.clear();
  activeScreenDistances.clear();
  emit();
}
