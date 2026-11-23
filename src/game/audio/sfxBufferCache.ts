/**
 * ============================================================================
 * Singleton Game Audio Buffer Cache & Asset Registry (Anti-IDM `.mta` Container)
 * (`public/assets/audio/wildlife/...` & `public/assets/audio/weapons/...`)
 * ============================================================================
 * - Audio files are packaged in `.mta` (`MTGA` v1 XOR-masked container) and served
 *   as `application/x-mmregion-sfx` (`nosniff`), preventing browser download
 *   managers (IDM, FDM, XDM, etc.) from popping up auto-download dialogs while
 *   still decoding natively inside Web Audio `AudioContext.decodeAudioData()`.
 * - Deduplicates network fetches and `decodeAudioData` per AudioContext.
 * - Zero audio buffer duplication across calls; O(1) synchronous lookup at playback.
 */

export const GAME_AUDIO_MAGIC = [0x4d, 0x54, 0x47, 0x41] as const; // "MTGA"
export const GAME_AUDIO_HEADER_BYTES = 6;

export const WILDLIFE_TIGER_AUDIO_FILES = [
  'assets/audio/wildlife/tiger/wings_of_freedom-tiger-roar-399277.mta',
  'assets/audio/wildlife/tiger/mightuser-tiger-roar-strong-hd-267360.mta',
  'assets/audio/wildlife/tiger/virtualzero-tiger-roar-cinematic-growling-hd-375395.mta',
] as const;

export const WILDLIFE_DEER_BABY_AUDIO_FILES = [
  'assets/audio/wildlife/deer/l3hrja-deer-baby-calling-for-mama-233035-call.mta',
] as const;

export const WILDLIFE_DEER_STAG_AUDIO_FILES = [
  'assets/audio/wildlife/deer/nickype-the-call-of-red-stag_animal-sound-145885.mta',
] as const;

export const WEAPON_GUNSHOT_AUDIO_FILES = [
  'assets/audio/weapons/freesound_community-9mm-pistol-shot-6349.mta',
  'assets/audio/weapons/freesound_community-shoot-1-81135.mta',
] as const;

export const WEAPON_KNIFE_DRAW_AUDIO_FILES = [
  'assets/audio/weapons/oxidvideos-pulling-out-a-knife-sfx-472241.mta',
] as const;

export const WEAPON_KNIFE_SLICE_AUDIO_FILES = [
  'assets/audio/weapons/freesound_community-knife-slice-41231.mta',
] as const;

export const WEAPON_KNIFE_HIT_AUDIO_FILES = [
  'assets/audio/weapons/freesound_community-slashkut-108175.mta',
] as const;

export const WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES = [
  'assets/audio/weapons/olivia_parker-knife-demo-309903.mta',
] as const;

export const WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES = [
  'assets/audio/weapons/universfield-cinematic-impact-hit-02-454665.mta',
] as const;

export const WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES = [
  'assets/audio/weapons/universfield-punch-03-352040.mta',
] as const;

export const WAREHOUSE_HORROR_LOOP_AUDIO_FILE =
  'assets/audio/warehouse/arctsound-horror-576085.mta' as const;

export const ALL_MP3_SFX_FILES = [
  ...WILDLIFE_TIGER_AUDIO_FILES,
  ...WILDLIFE_DEER_BABY_AUDIO_FILES,
  ...WILDLIFE_DEER_STAG_AUDIO_FILES,
  ...WEAPON_GUNSHOT_AUDIO_FILES,
  ...WEAPON_KNIFE_DRAW_AUDIO_FILES,
  ...WEAPON_KNIFE_SLICE_AUDIO_FILES,
  ...WEAPON_KNIFE_HIT_AUDIO_FILES,
  ...WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES,
  ...WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES,
  ...WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES,
  WAREHOUSE_HORROR_LOOP_AUDIO_FILE,
] as const;

/**
 * Unwraps an `MTGA` v1 `.mta` binary game audio container back into raw MP3
 * bytes in memory for `AudioContext.decodeAudioData()`.
 * Passes through plain unmasked buffers safely as a fresh copy.
 */
export function unwrapGameAudioContainer(bytes: ArrayBuffer | Uint8Array): ArrayBuffer {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (
    view.byteLength > GAME_AUDIO_HEADER_BYTES &&
    view[0] === GAME_AUDIO_MAGIC[0] &&
    view[1] === GAME_AUDIO_MAGIC[1] &&
    view[2] === GAME_AUDIO_MAGIC[2] &&
    view[3] === GAME_AUDIO_MAGIC[3] &&
    view[4] === 0x01
  ) {
    const xorKey = view[5];
    const payloadLen = view.byteLength - GAME_AUDIO_HEADER_BYTES;
    const out = new Uint8Array(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      out[i] = view[GAME_AUDIO_HEADER_BYTES + i] ^ xorKey;
    }
    return out.buffer;
  }
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy.buffer;
}

const decodedByContext = new WeakMap<AudioContext, Map<string, AudioBuffer>>();
const inFlightByContext = new WeakMap<AudioContext, Map<string, Promise<AudioBuffer | null>>>();
const rawBytesCache = new Map<string, ArrayBuffer>();
const rawInFlight = new Map<string, Promise<ArrayBuffer | null>>();
const failedRetryUntil = new Map<string, number>();

export const SFX_RETRY_COOLDOWN_MS = 15_000;

export function resolvePublicAudioUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '');
  const base =
    typeof import.meta !== 'undefined' &&
    typeof (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL === 'string'
      ? (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL
      : '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${clean}`;
}

function getContextMap(ctx: AudioContext): Map<string, AudioBuffer> {
  let map = decodedByContext.get(ctx);
  if (!map) {
    map = new Map<string, AudioBuffer>();
    decodedByContext.set(ctx, map);
  }
  return map;
}

function getContextInFlight(ctx: AudioContext): Map<string, Promise<AudioBuffer | null>> {
  let map = inFlightByContext.get(ctx);
  if (!map) {
    map = new Map<string, Promise<AudioBuffer | null>>();
    inFlightByContext.set(ctx, map);
  }
  return map;
}

async function fetchAudioBytes(relativePath: string): Promise<ArrayBuffer | null> {
  const cached = rawBytesCache.get(relativePath);
  if (cached) return cached;

  const pending = rawInFlight.get(relativePath);
  if (pending) return pending;

  const retryUntil = failedRetryUntil.get(relativePath) ?? 0;
  if (Date.now() < retryUntil) return null;
  if (typeof fetch !== 'function') return null;

  const promise = (async () => {
    try {
      const res = await fetch(resolvePublicAudioUrl(relativePath), {
        credentials: 'same-origin',
        cache: 'force-cache',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const bytes = await res.arrayBuffer();
      if (!bytes || bytes.byteLength === 0) throw new Error('Empty audio file');
      rawBytesCache.set(relativePath, bytes);
      failedRetryUntil.delete(relativePath);
      return bytes;
    } catch {
      failedRetryUntil.set(relativePath, Date.now() + SFX_RETRY_COOLDOWN_MS);
      return null;
    } finally {
      rawInFlight.delete(relativePath);
    }
  })();

  rawInFlight.set(relativePath, promise);
  return promise;
}

export function getCachedSfxBuffer(ctx: AudioContext, relativePath: string): AudioBuffer | null {
  return decodedByContext.get(ctx)?.get(relativePath) ?? null;
}

export async function loadSfxBuffer(
  ctx: AudioContext,
  relativePath: string,
): Promise<AudioBuffer | null> {
  const map = getContextMap(ctx);
  const existing = map.get(relativePath);
  if (existing) return existing;

  const inFlight = getContextInFlight(ctx);
  const pending = inFlight.get(relativePath);
  if (pending) return pending;
  if (Date.now() < (failedRetryUntil.get(relativePath) ?? 0)) return null;

  const promise = (async () => {
    try {
      const bytes = await fetchAudioBytes(relativePath);
      if (!bytes) return null;
      // Unwrap MTGA container into a fresh ArrayBuffer for decodeAudioData()
      const unwrapped = unwrapGameAudioContainer(bytes);
      const decoded = await ctx.decodeAudioData(unwrapped);
      if (!decoded || decoded.length === 0) throw new Error('Empty decoded audio');
      map.set(relativePath, decoded);
      return decoded;
    } catch {
      failedRetryUntil.set(relativePath, Date.now() + SFX_RETRY_COOLDOWN_MS);
      return null;
    } finally {
      inFlight.delete(relativePath);
    }
  })();

  inFlight.set(relativePath, promise);
  return promise;
}

export function preloadSfxBuffers(
  ctx: AudioContext | null,
  relativePaths: readonly string[],
): void {
  for (let i = 0; i < relativePaths.length; i++) {
    const p = relativePaths[i];
    if (ctx) {
      void loadSfxBuffer(ctx, p);
    } else {
      void fetchAudioBytes(p);
    }
  }
}

/**
 * Picks a random decoded `AudioBuffer` from `relativePaths` (O(1) synchronous),
 * kicking off background loading for any variants not yet decoded.
 */
export function pickCachedSfxBuffer(
  ctx: AudioContext,
  relativePaths: readonly string[],
  rng: () => number = Math.random,
): AudioBuffer | null {
  const ready: AudioBuffer[] = [];
  for (let i = 0; i < relativePaths.length; i++) {
    const p = relativePaths[i];
    const buf = getCachedSfxBuffer(ctx, p);
    if (buf) {
      ready.push(buf);
    } else {
      void loadSfxBuffer(ctx, p);
    }
  }
  if (ready.length === 0) return null;
  return ready[Math.floor(rng() * ready.length)];
}
