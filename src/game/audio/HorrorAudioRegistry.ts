import type { HorrorPreset } from '../ghostAudio.ts';

export type HorrorAudioCategory = 'ambience' | 'ghost' | 'environment' | 'events';
export type HorrorAudioBusId = 'ambience' | 'ghostEffects' | 'horrorEvents' | 'chaseMusic';

export type HorrorAudioId =
  | 'warehouse-drone'
  | 'eerie-wind'
  | 'chase-tension'
  | 'spectral-cackle'
  | 'spectral-shriek'
  | 'ghost-whisper'
  | 'rusted-door-creak'
  | 'wood-cracks'
  | 'distant-footsteps'
  | 'horror-sting'
  | 'ghost-grab-impact';

export interface HorrorAudioAssetDescriptor {
  readonly id: HorrorAudioId;
  readonly category: HorrorAudioCategory;
  readonly file: string;
  readonly bus: HorrorAudioBusId;
  readonly loop: boolean;
  readonly spatial: boolean;
  readonly baseGain: number;
  readonly fallbackPreset: HorrorPreset;
}

export interface HorrorAudioAssetEntry {
  readonly id: HorrorAudioId;
  readonly category: HorrorAudioCategory;
  readonly file: string;
  readonly durationSeconds: number;
  readonly loop: boolean;
  readonly bitrateKbps: number;
  readonly sha256: string;
}

export interface HorrorAudioManifest {
  readonly pack: string;
  readonly version: string;
  readonly codec: string;
  readonly sampleRateHz: number;
  readonly channels: number;
  readonly notes?: string;
  readonly assets: readonly HorrorAudioAssetEntry[];
}

export interface OpusSupportStatus {
  readonly supported: boolean;
  readonly oggOpus: string;
  readonly rawOpus: string;
  readonly mediaSourceOpus: boolean;
  readonly runtimeDecodeOk: boolean | null;
  readonly method: 'dom-audio' | 'mediasource' | 'non-browser' | 'decode-verified' | 'decode-failed';
  readonly detail: string;
}

export const HORROR_AUDIO_DESCRIPTORS: Readonly<Record<HorrorAudioId, HorrorAudioAssetDescriptor>> = {
  'warehouse-drone': {
    id: 'warehouse-drone',
    category: 'ambience',
    file: 'ambience/warehouse-drone.opus',
    bus: 'ambience',
    loop: true,
    spatial: false,
    baseGain: 0.72,
    fallbackPreset: 'horror_drone',
  },
  'eerie-wind': {
    id: 'eerie-wind',
    category: 'ambience',
    file: 'ambience/eerie-wind.opus',
    bus: 'ambience',
    loop: true,
    spatial: false,
    baseGain: 0.68,
    fallbackPreset: 'ghost_fade_ambient',
  },
  'chase-tension': {
    id: 'chase-tension',
    category: 'ambience',
    file: 'ambience/chase-tension.opus',
    bus: 'chaseMusic',
    loop: true,
    spatial: false,
    baseGain: 0.78,
    fallbackPreset: 'ghost_chase_tension',
  },
  'spectral-cackle': {
    id: 'spectral-cackle',
    category: 'ghost',
    file: 'ghost/spectral-cackle.opus',
    bus: 'ghostEffects',
    loop: false,
    spatial: true,
    baseGain: 0.85,
    fallbackPreset: 'ghost_evil_laugh',
  },
  'spectral-shriek': {
    id: 'spectral-shriek',
    category: 'ghost',
    file: 'ghost/spectral-shriek.opus',
    bus: 'ghostEffects',
    loop: false,
    spatial: true,
    baseGain: 0.88,
    fallbackPreset: 'ghost_scream',
  },
  'ghost-whisper': {
    id: 'ghost-whisper',
    category: 'ghost',
    file: 'ghost/ghost-whisper.opus',
    bus: 'ghostEffects',
    loop: false,
    spatial: true,
    baseGain: 0.82,
    fallbackPreset: 'ghost_whisper',
  },
  'rusted-door-creak': {
    id: 'rusted-door-creak',
    category: 'environment',
    file: 'environment/rusted-door-creak.opus',
    bus: 'horrorEvents',
    loop: false,
    spatial: true,
    baseGain: 0.82,
    fallbackPreset: 'warehouse_creak',
  },
  'wood-cracks': {
    id: 'wood-cracks',
    category: 'environment',
    file: 'environment/wood-cracks.opus',
    bus: 'horrorEvents',
    loop: false,
    spatial: true,
    baseGain: 0.84,
    fallbackPreset: 'wood_crack',
  },
  'distant-footsteps': {
    id: 'distant-footsteps',
    category: 'environment',
    file: 'environment/distant-footsteps.opus',
    bus: 'horrorEvents',
    loop: false,
    spatial: true,
    baseGain: 0.78,
    fallbackPreset: 'ghost_footsteps',
  },
  'horror-sting': {
    id: 'horror-sting',
    category: 'events',
    file: 'events/horror-sting.opus',
    bus: 'horrorEvents',
    loop: false,
    spatial: false,
    baseGain: 0.82,
    fallbackPreset: 'ghost_warning',
  },
  'ghost-grab-impact': {
    id: 'ghost-grab-impact',
    category: 'events',
    file: 'events/ghost-grab-impact.opus',
    bus: 'ghostEffects',
    loop: false,
    spatial: true,
    baseGain: 0.92,
    fallbackPreset: 'ghost_grab',
  },
} as const;

export const HORROR_AUDIO_IDS = Object.keys(HORROR_AUDIO_DESCRIPTORS) as readonly HorrorAudioId[];

const VALID_CATEGORIES = new Set<HorrorAudioCategory>(['ambience', 'ghost', 'environment', 'events']);
const SAFE_RELATIVE_FILE_RE = /^(ambience|ghost|environment|events)\/[a-z0-9][a-z0-9._-]*\.opus$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

export function isHorrorAudioId(value: string): value is HorrorAudioId {
  return Object.prototype.hasOwnProperty.call(HORROR_AUDIO_DESCRIPTORS, value);
}

/**
 * Resolves the Vite base URL safely across Vite browser builds, Capacitor WebView, and Node test runs.
 */
export function resolveHorrorAudioBaseUrl(viteBaseUrl?: string): string {
  let rawBase = viteBaseUrl;
  if (rawBase === undefined) {
    try {
      rawBase = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL;
    } catch {
      rawBase = '/';
    }
  }
  const normalized = (rawBase || '/').trim().replace(/\\/g, '/');
  const withTrailing = normalized === '' ? '/' : normalized.endsWith('/') ? normalized : `${normalized}/`;
  return `${withTrailing}assets/audio/horror/`;
}

export function isSafeHorrorRelativePath(relativeFile: string): boolean {
  if (typeof relativeFile !== 'string') return false;
  const trimmed = relativeFile.trim();
  if (!trimmed || trimmed.includes('..') || trimmed.includes('\\') || trimmed.startsWith('/')) {
    return false;
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) || trimmed.includes('?') || trimmed.includes('#')) {
    return false;
  }
  return SAFE_RELATIVE_FILE_RE.test(trimmed);
}

export function resolveHorrorAudioUrl(relativeFile: string, viteBaseUrl?: string): string {
  const clean = relativeFile.trim();
  if (clean === 'manifest.json') {
    return `${resolveHorrorAudioBaseUrl(viteBaseUrl)}manifest.json`;
  }
  if (!isSafeHorrorRelativePath(clean)) {
    throw new Error(`Unsafe horror audio relative path: "${relativeFile}"`);
  }
  return `${resolveHorrorAudioBaseUrl(viteBaseUrl)}${clean}`;
}

export function validateHorrorAudioManifest(raw: unknown): HorrorAudioManifest {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Horror audio manifest must be a JSON object');
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.pack !== 'string' || !obj.pack.trim()) {
    throw new Error('Horror audio manifest missing "pack" name');
  }
  if (typeof obj.version !== 'string' || !obj.version.trim()) {
    throw new Error('Horror audio manifest missing "version"');
  }
  if (typeof obj.codec !== 'string' || !obj.codec.trim()) {
    throw new Error('Horror audio manifest missing "codec"');
  }
  if (typeof obj.sampleRateHz !== 'number' || !Number.isFinite(obj.sampleRateHz) || obj.sampleRateHz <= 0) {
    throw new Error('Horror audio manifest has invalid "sampleRateHz"');
  }
  if (typeof obj.channels !== 'number' || !Number.isInteger(obj.channels) || obj.channels < 1) {
    throw new Error('Horror audio manifest has invalid "channels"');
  }
  if (!Array.isArray(obj.assets) || obj.assets.length === 0) {
    throw new Error('Horror audio manifest must include a non-empty "assets" array');
  }

  const seenIds = new Set<string>();
  const assets: HorrorAudioAssetEntry[] = [];

  for (const item of obj.assets) {
    if (!item || typeof item !== 'object') {
      throw new Error('Horror audio manifest entry must be an object');
    }
    const entry = item as Record<string, unknown>;
    if (typeof entry.id !== 'string' || !isHorrorAudioId(entry.id)) {
      throw new Error(`Unknown horror audio asset id: "${String(entry.id)}"`);
    }
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate horror audio asset id: "${entry.id}"`);
    }
    seenIds.add(entry.id);

    if (typeof entry.category !== 'string' || !VALID_CATEGORIES.has(entry.category as HorrorAudioCategory)) {
      throw new Error(`Invalid category "${String(entry.category)}" for horror asset "${entry.id}"`);
    }
    if (typeof entry.file !== 'string' || !isSafeHorrorRelativePath(entry.file)) {
      throw new Error(`Unsafe or invalid file "${String(entry.file)}" for horror asset "${entry.id}"`);
    }
    if (!entry.file.startsWith(`${entry.category}/`)) {
      throw new Error(`Asset "${entry.id}" file "${entry.file}" does not match category "${entry.category}"`);
    }
    if (typeof entry.durationSeconds !== 'number' || !Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0) {
      throw new Error(`Invalid durationSeconds for horror asset "${entry.id}"`);
    }
    if (typeof entry.loop !== 'boolean') {
      throw new Error(`Invalid loop flag for horror asset "${entry.id}"`);
    }
    if (typeof entry.bitrateKbps !== 'number' || !Number.isFinite(entry.bitrateKbps) || entry.bitrateKbps <= 0) {
      throw new Error(`Invalid bitrateKbps for horror asset "${entry.id}"`);
    }
    if (typeof entry.sha256 !== 'string' || !SHA256_RE.test(entry.sha256)) {
      throw new Error(`Invalid sha256 checksum for horror asset "${entry.id}"`);
    }

    assets.push({
      id: entry.id,
      category: entry.category as HorrorAudioCategory,
      file: entry.file,
      durationSeconds: entry.durationSeconds,
      loop: entry.loop,
      bitrateKbps: entry.bitrateKbps,
      sha256: entry.sha256.toLowerCase(),
    });
  }

  return {
    pack: obj.pack,
    version: obj.version,
    codec: obj.codec,
    sampleRateHz: obj.sampleRateHz,
    channels: obj.channels,
    ...(typeof obj.notes === 'string' ? { notes: obj.notes } : {}),
    assets,
  };
}

/**
 * Checks container + Opus codec support at runtime without assuming filename extension changes codec compatibility.
 */
export function detectOpusPlaybackSupport(): OpusSupportStatus {
  if (typeof document === 'undefined') {
    return {
      supported: false,
      oggOpus: '',
      rawOpus: '',
      mediaSourceOpus: false,
      runtimeDecodeOk: null,
      method: 'non-browser',
      detail: 'DOM Audio element unavailable outside browser context',
    };
  }

  let oggOpus = '';
  let rawOpus = '';
  let mediaSourceOpus = false;

  try {
    const audioEl = document.createElement('audio');
    if (typeof audioEl?.canPlayType === 'function') {
      oggOpus = audioEl.canPlayType('audio/ogg; codecs="opus"') || '';
      rawOpus = audioEl.canPlayType('audio/opus') || '';
    }
  } catch {
    // Keep conservative probe result
  }

  try {
    if (typeof MediaSource !== 'undefined' && typeof MediaSource.isTypeSupported === 'function') {
      mediaSourceOpus =
        MediaSource.isTypeSupported('audio/webm; codecs="opus"') ||
        MediaSource.isTypeSupported('audio/ogg; codecs="opus"');
    }
  } catch {
    mediaSourceOpus = false;
  }

  const supported = Boolean(oggOpus || rawOpus);
  const method = oggOpus || rawOpus ? 'dom-audio' : mediaSourceOpus ? 'mediasource' : 'dom-audio';
  const detail = supported
    ? `Supported (ogg/opus="${oggOpus || 'none'}", audio/opus="${rawOpus || 'none'}")`
    : 'Opus in Ogg container reported unsupported by browser/WebView; using procedural fallback';

  return {
    supported,
    oggOpus,
    rawOpus,
    mediaSourceOpus,
    runtimeDecodeOk: null,
    method,
    detail,
  };
}
