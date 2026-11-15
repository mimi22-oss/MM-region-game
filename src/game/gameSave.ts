export const GAME_SAVE_STORAGE_KEY = 'mm-region-game-save-v1';

export interface GameSaveData {
  version: 1;
  x: number;
  z: number;
  yaw: number;
  pitch: number;
  zoom: number;
  topDown: boolean;
  first: boolean;
  areaId?: string;
  savedAt: string;
}

export interface SaveBounds {
  halfWorldSize: number;
  minZoom: number;
  maxZoom: number;
}

const DEFAULT_BOUNDS: SaveBounds = {
  halfWorldSize: 16000,
  minZoom: 2,
  maxZoom: 3600,
};

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function validateGameSave(
  raw: unknown,
  bounds: SaveBounds = DEFAULT_BOUNDS,
): GameSaveData | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  const { x, z, yaw, pitch, zoom, topDown, first, areaId, savedAt } = obj;
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof z !== 'number' ||
    !Number.isFinite(z) ||
    typeof yaw !== 'number' ||
    !Number.isFinite(yaw) ||
    typeof zoom !== 'number' ||
    !Number.isFinite(zoom)
  ) {
    return null;
  }
  const safePitch =
    typeof pitch === 'number' && Number.isFinite(pitch)
      ? clamp(pitch, -Math.PI / 2, Math.PI / 2)
      : -0.12;
  return {
    version: 1,
    x: clamp(x, -bounds.halfWorldSize, bounds.halfWorldSize),
    z: clamp(z, -bounds.halfWorldSize, bounds.halfWorldSize),
    yaw,
    pitch: safePitch,
    zoom: clamp(zoom, bounds.minZoom, bounds.maxZoom),
    topDown: Boolean(topDown),
    first: Boolean(first) && !topDown,
    areaId: typeof areaId === 'string' && areaId.length <= 80 ? areaId : undefined,
    savedAt: typeof savedAt === 'string' ? savedAt : new Date().toISOString(),
  };
}

function getStorage(storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  if (storage) return storage;
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  return null;
}

export function loadGameSave(
  bounds?: SaveBounds,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): GameSaveData | null {
  const store = getStorage(storage);
  if (!store) return null;
  try {
    const raw = store.getItem(GAME_SAVE_STORAGE_KEY);
    if (!raw) return null;
    return validateGameSave(JSON.parse(raw), bounds);
  } catch {
    return null;
  }
}

export function writeGameSave(
  input: Omit<GameSaveData, 'version' | 'savedAt'>,
  bounds?: SaveBounds,
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): GameSaveData | null {
  const validated = validateGameSave(
    {
      ...input,
      version: 1,
      savedAt: new Date().toISOString(),
    },
    bounds,
  );
  if (!validated) return null;
  const store = getStorage(storage);
  if (!store) return validated;
  try {
    store.setItem(GAME_SAVE_STORAGE_KEY, JSON.stringify(validated));
  } catch {
    // Ignore storage quota errors
  }
  return validated;
}

export function clearGameSave(
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): void {
  const store = getStorage(storage);
  if (!store) return;
  try {
    store.removeItem(GAME_SAVE_STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}

let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let latestPendingInput: {
  data: Omit<GameSaveData, 'version' | 'savedAt'>;
  bounds?: SaveBounds;
} | null = null;

export function scheduleGameSave(
  data: Omit<GameSaveData, 'version' | 'savedAt'>,
  bounds?: SaveBounds,
  delayMs = 750,
): void {
  latestPendingInput = { data, bounds };
  if (pendingTimer !== null) return;
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    const item = latestPendingInput;
    latestPendingInput = null;
    if (item) {
      writeGameSave(item.data, item.bounds);
    }
  }, delayMs);
}

export function flushGameSave(
  override?: Omit<GameSaveData, 'version' | 'savedAt'>,
  bounds?: SaveBounds,
): GameSaveData | null {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
  const target = override
    ? { data: override, bounds }
    : latestPendingInput;
  latestPendingInput = null;
  if (!target) return null;
  return writeGameSave(target.data, target.bounds);
}
