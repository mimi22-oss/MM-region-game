import { gameAudio } from '../gameAudio.ts';
import type { TimeMode } from '../environmentTime.ts';
import { isGhostNightActive } from '../ghostConfig.ts';
import {
  WAREHOUSE_HORROR_LOOP_AUDIO_FILE,
  SFX_RETRY_COOLDOWN_MS,
  getCachedSfxBuffer,
  loadSfxBuffer,
  preloadSfxBuffers,
} from './sfxBufferCache.ts';

/**
 * Warehouse horror loop plays ONLY during active ghost hours (night `[18:00, 05:00)`
 * or manual night / dev forceActive) AND while at least one ghost is still undefeated.
 */
export function isWarehouseHorrorAudioActive(params: {
  enabled: boolean;
  minute: number;
  timeMode: TimeMode;
  soundEnabled: boolean;
  soundVolume: number;
  paused: boolean;
  forceActive?: boolean;
  hasLivingGhosts: boolean;
}): boolean {
  if (!params.enabled || !params.soundEnabled || params.soundVolume <= 0 || params.paused) {
    return false;
  }
  if (!params.hasLivingGhosts) {
    return false;
  }
  return isGhostNightActive(params.minute, {
    timeMode: params.timeMode,
    forceActive: params.forceActive,
  });
}

/**
 * Dedicated Sampled Warehouse Horror Loop Player
 * (`ဂိုဒေါင်ထဲ စဝင်သည်နှင့် arctsound-horror-576085 loop ဖွင့်ပေးခြင်း`)
 *
 * Replaces procedural warehouse synth beds/events with a single seamless
 * Web Audio loop backed by the anti-IDM `.mta` Singleton buffer cache.
 */
export class WarehouseHorrorLoopPlayer {
  private ctx: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private preloaded = false;
  private loading = false;
  private nextLoadAttemptAt = 0;
  private active = false;
  private targetLevel = 0;
  private silentSec = 0;
  private disposed = false;

  private readonly detachPause: () => void;
  private readonly detachResume: () => void;

  constructor() {
    this.detachPause = gameAudio.onPause(() => {
      this.stopSourceImmediate();
    });
    this.detachResume = gameAudio.onResume(() => {
      if (!this.disposed && this.active && this.targetLevel > 0.001) {
        this.ensureLoopRunning();
      }
    });
  }

  get isPreloaded(): boolean {
    return this.preloaded;
  }

  preload(): void {
    if (this.disposed || this.preloaded) return;
    this.preloaded = true;
    preloadSfxBuffers(gameAudio.context, [WAREHOUSE_HORROR_LOOP_AUDIO_FILE]);
  }

  private ensureLoopRunning(): boolean {
    if (this.disposed) return false;
    const ctx = gameAudio.context;
    const dest = gameAudio.ambience ?? gameAudio.master;
    if (!ctx || !dest || ctx.state !== 'running') return false;

    if (this.source && this.ctx === ctx && this.gain) {
      return true;
    }

    const buffer = getCachedSfxBuffer(ctx, WAREHOUSE_HORROR_LOOP_AUDIO_FILE);
    if (!buffer) {
      if (!this.loading && Date.now() >= this.nextLoadAttemptAt) {
        this.loading = true;
        this.preloaded = true;
        void loadSfxBuffer(ctx, WAREHOUSE_HORROR_LOOP_AUDIO_FILE).then((loaded) => {
          this.loading = false;
          if (!loaded) {
            this.nextLoadAttemptAt = Date.now() + SFX_RETRY_COOLDOWN_MS;
            return;
          }
          if (!this.disposed && this.active && this.targetLevel > 0.001) {
            this.ensureLoopRunning();
            this.applyGain();
          }
        });
      }
      return false;
    }

    this.stopSourceImmediate();
    try {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(dest);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.onended = () => {
        if (this.source === src) {
          this.source = null;
          try {
            gain.disconnect();
          } catch {}
          if (this.gain === gain) this.gain = null;
        }
      };
      src.start(ctx.currentTime);

      this.ctx = ctx;
      this.source = src;
      this.gain = gain;
      return true;
    } catch {
      return false;
    }
  }

  private applyGain(): void {
    if (!this.ctx || !this.gain) return;
    const running =
      !this.disposed &&
      this.active &&
      gameAudio.isActive() &&
      this.ctx.state === 'running';
    const next = running ? Math.max(0, Math.min(1, this.targetLevel)) : 0;
    this.gain.gain.setTargetAtTime(next, this.ctx.currentTime, next > 0 ? 0.35 : 0.45);
  }

  update(active: boolean, level: number, dt: number): {
    sources: number;
    nodes: number;
    disposed: boolean;
    bedMode: 'opus' | 'inactive';
  } {
    if (this.disposed) {
      return { sources: 0, nodes: 0, disposed: true, bedMode: 'inactive' };
    }
    const cleanLevel = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
    const shouldPlay =
      active &&
      cleanLevel > 0.001 &&
      gameAudio.isActive() &&
      gameAudio.context?.state === 'running' &&
      (typeof document === 'undefined' || !document.hidden);

    this.active = shouldPlay;
    this.targetLevel = shouldPlay ? cleanLevel : 0;

    if (shouldPlay) {
      this.silentSec = 0;
      if (this.ensureLoopRunning()) {
        this.applyGain();
        return { sources: 1, nodes: 2, disposed: false, bedMode: 'opus' };
      }
      return { sources: 0, nodes: 0, disposed: false, bedMode: 'inactive' };
    }

    this.applyGain();
    this.silentSec += Math.max(0, Math.min(dt, 0.5));
    if (this.silentSec > 1.8 && this.source) {
      this.stopSourceImmediate();
    }

    return this.source
      ? { sources: 1, nodes: 2, disposed: false, bedMode: 'opus' }
      : { sources: 0, nodes: 0, disposed: true, bedMode: 'inactive' };
  }

  stop(): void {
    this.active = false;
    this.targetLevel = 0;
    this.stopSourceImmediate();
  }

  private stopSourceImmediate(): void {
    const src = this.source;
    const gain = this.gain;
    this.source = null;
    this.gain = null;
    this.ctx = null;
    if (src) {
      try {
        src.onended = null;
        src.stop();
        src.disconnect();
      } catch {}
    }
    if (gain) {
      try {
        gain.disconnect();
      } catch {}
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachPause();
    this.detachResume();
    this.stopSourceImmediate();
  }
}
