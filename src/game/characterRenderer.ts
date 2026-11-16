import { useSyncExternalStore } from 'react';
import type { HumanPreset } from '../data/appearance';

export type CharacterRendererMode = 'glb' | 'code' | 'canolia';

/**
 * Easy character renderer switch:
 * - `'glb'`: uses boy.glb / girl.glb (`GlbHuman`) for boy & girl presets
 * - `'code'`: disables GLB loading and uses `ProceduralHuman` for every preset
 */
export const DEFAULT_CHARACTER_RENDERER: CharacterRendererMode = 'glb';

const STORAGE_KEY = 'characterRendererMode';
const listeners = new Set<() => void>();

function readStoredRendererMode(): CharacterRendererMode | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'glb' || saved === 'code' || saved === 'canolia' ? saved : null;
  } catch {
    return null;
  }
}

let currentMode: CharacterRendererMode = readStoredRendererMode() ?? DEFAULT_CHARACTER_RENDERER;

/** Returns the active character renderer mode (`'glb'` or `'code'`). */
export function getCharacterRendererMode(): CharacterRendererMode {
  return currentMode;
}

/** Switches between `'glb'` (GLB models) and `'code'` (ProceduralHuman) at runtime. */
export function setCharacterRendererMode(mode: CharacterRendererMode): CharacterRendererMode {
  if (mode !== 'glb' && mode !== 'code' && mode !== 'canolia') return currentMode;
  if (currentMode === mode) return currentMode;
  currentMode = mode;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore private-browsing storage quota/access errors.
    }
  }
  for (const listener of listeners) listener();
  return currentMode;
}

/** Convenience toggle helper flipping between `'glb'` and `'code'`. */
export function toggleCharacterRendererMode(): CharacterRendererMode {
  return setCharacterRendererMode(currentMode === 'glb' ? 'code' : 'glb');
}

/** Returns true when the given appearance preset should render with `GlbHuman`. */
export function shouldUseGlbCharacter(
  preset: HumanPreset | string | undefined,
  mode: CharacterRendererMode = currentMode
): boolean {
  return mode === 'glb' && (preset === 'boy' || preset === 'girl');
}

export function subscribeCharacterRendererMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Subscribes a React component to live GLB vs code-character mode changes. */
export function useCharacterRendererMode(): CharacterRendererMode {
  return useSyncExternalStore(
    subscribeCharacterRendererMode,
    getCharacterRendererMode,
    () => DEFAULT_CHARACTER_RENDERER
  );
}
