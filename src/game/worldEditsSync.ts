import { kalayVillages } from '../data/villages/index.ts';
import { loadLayout, validLayout, type WorldLayout } from './worldLayout.ts';
import { publishWorldEdits } from './worldEdits.ts';

export const REGION_STORAGE_KEY_PREFIX = 'mm-editor-region-v1:';
export const CUSTOM_LAYOUT_STORAGE_KEY = 'myanmar-town-world-layout-v1';

/** UI aliases never become runtime source identities. */
export function normalizeAuthoredRegionId(id: string): string {
  return id === 'myotha' ? 'myothar' : id === 'sitha' ? 'sithar' : id;
}

export function getAuthoredRegionIds(): string[] {
  return ['myothar', 'kalay-area-1', ...kalayVillages.map((v) => v.id)];
}

export function getEditableRegionIds(): string[] {
  return ['custom', 'myothar', 'kalay-area-1', ...kalayVillages.map((v) => v.id), 'natchaung'];
}

/** Reads only persisted localStorage edits (never bundles bulk authored TS tables into main chunk). */
export function loadStoredRegionLayout(id: string): WorldLayout | null {
  if (id === 'custom') return loadLayout();
  const normId = normalizeAuthoredRegionId(id);
  try {
    const raw =
      localStorage.getItem(`${REGION_STORAGE_KEY_PREFIX}${id}`) ||
      localStorage.getItem(`${REGION_STORAGE_KEY_PREFIX}${normId}`);
    if (raw) {
      const data: unknown = JSON.parse(raw);
      if (validLayout(data)) return data;
    }
  } catch {
    // Ignore corrupt or blocked localStorage
  }
  return null;
}

export function syncAllWorldEdits(): WorldLayout[] {
  const layouts: WorldLayout[] = [];
  for (const id of getEditableRegionIds()) {
    try {
      if (id === 'custom') {
        const raw = localStorage.getItem(CUSTOM_LAYOUT_STORAGE_KEY);
        if (raw) layouts.push(loadLayout());
        continue;
      }
      const normId = normalizeAuthoredRegionId(id);
      const raw =
        localStorage.getItem(`${REGION_STORAGE_KEY_PREFIX}${id}`) ||
        localStorage.getItem(`${REGION_STORAGE_KEY_PREFIX}${normId}`);
      if (raw) {
        const l = loadStoredRegionLayout(id);
        if (l && Array.isArray(l.features)) layouts.push(l);
      }
    } catch {
      // Ignore blocked storage
    }
  }
  publishWorldEdits(layouts);
  return layouts;
}
