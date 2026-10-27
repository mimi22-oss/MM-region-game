import { useSyncExternalStore } from 'react';

/**
 * Thadingyut Lighting Festival (သီတင်းကျွတ် မီးထွန်းပွဲတော်) Controller
 * 
 * Central controller to show or hide all Thadingyut festival elements:
 * 1. Candles (ဖယောင်းတိုင်များ: fence candles, porch candles, candle-in-holder)
 * 2. Hot-air fire balloons (မီးပုံးပျံများ: passenger balloon, night sky swarm)
 * 3. Festival illumination and animations
 * 
 * Default is FALSE (hidden, because Thadingyut festival is over).
 * Next year, calling `setThadingyutFestivalActive(true)` will instantly restore all candles and balloons.
 */

export const THADINGYUT_STORAGE_KEY = 'mm-thadingyut-festival-active';

type Listener = () => void;
const listeners = new Set<Listener>();

// Default is false (festival is over). Can be restored/persisted in localStorage.
let festivalActive: boolean = (() => {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(THADINGYUT_STORAGE_KEY);
      if (saved !== null) {
        return saved === 'true';
      }
    }
  } catch {}
  return false; // Default: hidden (festival is over)
})();

/**
 * Check whether Thadingyut festival elements are currently active.
 */
export function isThadingyutFestivalActive(): boolean {
  return festivalActive;
}

/**
 * Single function to show or hide Thadingyut festival elements (candles and fire balloons).
 * 
 * Usage:
 * - `setThadingyutFestivalActive(false)` -> Hide candles and balloons (Festival over)
 * - `setThadingyutFestivalActive(true)`  -> Show candles and balloons (Festival on)
 * 
 * @param active boolean
 */
export function setThadingyutFestivalActive(active: boolean): void {
  festivalActive = Boolean(active);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THADINGYUT_STORAGE_KEY, String(festivalActive));
    }
  } catch {}

  // Dispatch custom window event for non-React / Three.js scene graphs
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('thadingyut-festival-changed', {
        detail: { active: festivalActive },
      })
    );
  }

  // Notify all React subscribers
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {}
  });
}

/**
 * Convenience toggle function.
 */
export function toggleThadingyutFestival(): boolean {
  setThadingyutFestivalActive(!festivalActive);
  return festivalActive;
}

/**
 * Subscribe to festival state changes.
 */
export function subscribeThadingyutFestival(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * React hook to reactively read and re-render on festival active state changes.
 */
export function useThadingyutFestival(): boolean {
  return useSyncExternalStore(subscribeThadingyutFestival, isThadingyutFestivalActive);
}

// Expose on global window object for easy developer console / runtime control
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).isThadingyutFestivalActive = isThadingyutFestivalActive;
  (window as unknown as Record<string, unknown>).setThadingyutFestivalActive = setThadingyutFestivalActive;
  (window as unknown as Record<string, unknown>).toggleThadingyutFestival = toggleThadingyutFestival;
}
