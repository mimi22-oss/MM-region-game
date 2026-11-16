import { gameAudio } from '../gameAudio.ts';
import {
  acquireSharedGhostAudio,
  releaseSharedGhostAudio,
  type GhostHorrorAudio,
  type HorrorPreset,
} from '../ghostAudio.ts';
import { WarehouseAmbientBed } from './WarehouseAmbientBed.ts';
import {
  HORROR_AUDIO_DESCRIPTORS,
  type HorrorAudioBusId,
  type HorrorAudioId,
} from './HorrorAudioRegistry.ts';
import {
  sharedHorrorAssetLoader,
  type HorrorAudioAssetLoader,
} from './HorrorAudioAssetLoader.ts';
import {
  notifyHorrorAudioDiagnosticsChanged,
  registerHorrorAudioInspector,
  registerHorrorAudioTestRunner,
} from './horrorAudioDiagnostics.ts';

interface MixerVoice {
  readonly id: number;
  readonly assetId: HorrorAudioId;
  readonly bus: HorrorAudioBusId;
  readonly owner: string;
  readonly source: AudioBufferSourceNode;
  readonly gain: GainNode;
  stopping: boolean;
  done: boolean;
}

interface MixerEmitter {
  readonly panner: PannerNode;
  readonly filter: BiquadFilterNode;
  readonly gain: GainNode;
  currentBus: HorrorAudioBusId;
}

interface LoopChannel {
  readonly assetId: HorrorAudioId;
  readonly bus: HorrorAudioBusId;
  readonly gain: GainNode;
  source: AudioBufferSourceNode | null;
  targetLevel: number;
  disposed: boolean;
}

const MAX_MIXER_VOICES = 18;
const MAX_EMITTERS = 12;

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export interface PlayHorrorCueOptions {
  readonly assetId?: HorrorAudioId;
  readonly fallbackPreset?: HorrorPreset;
  readonly bus?: HorrorAudioBusId;
  readonly owner?: string;
  readonly position?: { readonly x: number; readonly y: number; readonly z: number };
  readonly volume?: number;
  readonly pitch?: number;
  readonly occluded?: boolean;
  readonly fallbackToProcedural?: boolean;
}

export interface UpdateAmbienceOptions {
  readonly active: boolean;
  readonly level: number;
  readonly isNight: boolean;
  readonly dt: number;
}

/**
 * Shared Horror Audio Mixer wired strictly onto gameAudio's single AudioContext:
 * Master -> Ambience / Ghost Effects / Horror Events / Chase Music.
 * Uses decoded Opus AudioBuffers when supported and cached, seamlessly falling
 * back to procedural synthesis when Opus is unavailable, decoding, or fails.
 */
export class HorrorAudioMixer {
  readonly loader: HorrorAudioAssetLoader;
  private synth: GhostHorrorAudio | null = null;
  private voices = new Set<MixerVoice>();
  private emitters = new Map<string, MixerEmitter>();
  private droneChannel: LoopChannel | null = null;
  private windChannel: LoopChannel | null = null;
  private proceduralBed: WarehouseAmbientBed | null = null;
  private chaseChannel: LoopChannel | null = null;
  private chaseOwners = new Map<string, number>();
  private proceduralChaseOwner: string | null = null;
  private ambienceSilentTime = 0;
  private chaseSilentTime = 0;
  private nextVoiceId = 1;
  private lastOpusPreloadRequest = 0;
  private muted = false;
  private detachPause: (() => void) | null = null;
  private detachResume: (() => void) | null = null;
  private refs = 0;
  private bedMode: 'opus' | 'procedural' | 'inactive' = 'inactive';

  constructor(loader: HorrorAudioAssetLoader = sharedHorrorAssetLoader) {
    this.loader = loader;
  }

  acquire(): this {
    if (this.refs++ === 0) {
      this.synth = acquireSharedGhostAudio();
      this.detachPause = gameAudio.onPause(() => this.handlePause());
      this.detachResume = gameAudio.onResume(() => {
        void this.handleResume();
      });
      registerHorrorAudioInspector(() => this.inspect());
      registerHorrorAudioTestRunner(() => this.runSelfTest());
    }
    return this;
  }

  release(): void {
    if (this.refs <= 0) return;
    if (--this.refs === 0) {
      this.dispose();
    }
  }

  private getBusDestination(bus: HorrorAudioBusId): AudioNode | null {
    switch (bus) {
      case 'ambience':
        return gameAudio.ambience ?? gameAudio.master;
      case 'ghostEffects':
        return gameAudio.ghost ?? gameAudio.master;
      case 'horrorEvents':
        return gameAudio.horrorEvents ?? gameAudio.ghost ?? gameAudio.master;
      case 'chaseMusic':
        return gameAudio.chaseMusic ?? gameAudio.ghost ?? gameAudio.master;
    }
  }

  private isAudioRunning(): boolean {
    return (
      !this.muted &&
      gameAudio.isActive() &&
      gameAudio.context?.state === 'running' &&
      (typeof document === 'undefined' || !document.hidden)
    );
  }

  setMuted(muted: boolean): void {
    if (this.muted === muted) return;
    this.muted = muted;
    if (muted) {
      this.stopAllLoopsImmediate();
      this.stopAllVoices();
      this.synth?.stopAll();
    }
    notifyHorrorAudioDiagnosticsChanged();
  }

  private handlePause(): void {
    this.stopAllLoopsImmediate();
    this.stopAllVoices();
    notifyHorrorAudioDiagnosticsChanged();
  }

  private async handleResume(): Promise<void> {
    await this.loader.decodeBufferedAssets();
    notifyHorrorAudioDiagnosticsChanged();
  }

  private getOrCreateEmitter(owner: string): MixerEmitter | null {
    const ctx = gameAudio.context;
    const dest = this.getBusDestination('ghostEffects');
    if (!ctx || !dest) return null;
    const existing = this.emitters.get(owner);
    if (existing) return existing;

    if (this.emitters.size >= MAX_EMITTERS) {
      for (const id of this.emitters.keys()) {
        if (!this.hasActiveVoice(id)) {
          this.releaseEmitter(id);
          break;
        }
      }
      if (this.emitters.size >= MAX_EMITTERS) {
        const oldest = this.emitters.keys().next().value;
        if (oldest) this.releaseEmitter(oldest);
      }
    }

    const panner = ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = owner.startsWith('warehouse-audio:') ? 12 : 3;
    panner.maxDistance = 65;
    panner.rolloffFactor = owner.startsWith('warehouse-audio:') ? 1.25 : 1.8;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 18000;

    const gain = ctx.createGain();
    gain.gain.value = 1;

    panner.connect(filter);
    filter.connect(gain);
    // Emitter gain connects per-voice to panner; bus routing occurs after emitter or direct.
    gain.connect(dest);

    const created: MixerEmitter = { panner, filter, gain, currentBus: 'ghostEffects' };
    this.emitters.set(owner, created);
    return created;
  }

  private releaseEmitter(owner: string): void {
    const e = this.emitters.get(owner);
    if (!e) return;
    e.panner.disconnect();
    e.filter.disconnect();
    e.gain.disconnect();
    this.emitters.delete(owner);
  }

  hasActiveVoice(owner: string): boolean {
    for (const v of this.voices) {
      if (v.owner === owner && !v.done) return true;
    }
    return this.synth?.hasVoice(owner) ?? false;
  }

  positionOwner(
    owner: string,
    x: number,
    y: number,
    z: number,
    enabled = true,
    level = 1,
    occluded = false,
  ): void {
    this.synth?.position(owner, x, y, z, enabled, level, occluded);
    const ctx = gameAudio.context;
    const e = this.emitters.get(owner);
    if (!ctx || !e) return;
    const t = ctx.currentTime;
    e.panner.positionX.value = x;
    e.panner.positionY.value = y;
    e.panner.positionZ.value = z;
    e.gain.gain.setTargetAtTime(enabled ? clamp01(level) : 0, t, 0.12);
    e.filter.frequency.setTargetAtTime(occluded ? 950 : 18000, t, 0.12);
    if (!enabled) {
      this.stopOwner(owner);
    }
  }

  private cleanupVoice(v: MixerVoice): void {
    if (v.done) return;
    v.done = true;
    this.voices.delete(v);
    v.source.onended = null;
    try {
      v.source.stop();
    } catch {
      // already ended
    }
    v.source.disconnect();
    v.gain.disconnect();
    notifyHorrorAudioDiagnosticsChanged();
  }

  /**
   * Plays an Opus buffer from the audio pack if cached & supported, automatically falling back
   * to procedural synthesis if Opus is unsupported, failed to decode, or not yet downloaded.
   */
  playCue(options: PlayHorrorCueOptions): 'opus' | 'procedural' | 'skipped' {
    if (!this.isAudioRunning()) return 'skipped';

    const volume = clamp01(options.volume ?? 1);
    if (volume <= 0) return 'skipped';

    const assetId = options.assetId;
    const descriptor = assetId ? HORROR_AUDIO_DESCRIPTORS[assetId] : undefined;
    const bus = options.bus ?? descriptor?.bus ?? 'horrorEvents';
    const owner = options.owner ?? 'default';
    const pitch = Number.isFinite(options.pitch) ? Math.max(0.65, Math.min(1.5, options.pitch!)) : 1;
    const fallbackPreset = options.fallbackPreset ?? descriptor?.fallbackPreset;

    if (assetId && descriptor) {
      const buffer = this.loader.getCachedBuffer(assetId);
      if (buffer && this.voices.size < MAX_MIXER_VOICES) {
        const ctx = gameAudio.context;
        const busDest = this.getBusDestination(bus);
        if (ctx && busDest) {
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = pitch;

          const voiceGain = ctx.createGain();
          const now = ctx.currentTime;
          const peak = volume * descriptor.baseGain;
          voiceGain.gain.setValueAtTime(0.0001, now);
          voiceGain.gain.linearRampToValueAtTime(peak, now + 0.015);

          if (descriptor.spatial && options.position) {
            const emitter = this.getOrCreateEmitter(owner);
            if (emitter) {
              emitter.panner.positionX.value = options.position.x;
              emitter.panner.positionY.value = options.position.y;
              emitter.panner.positionZ.value = options.position.z;
              emitter.filter.frequency.value = options.occluded ? 950 : 18000;
              emitter.gain.gain.value = 1;
              if (emitter.currentBus !== bus) {
                emitter.gain.disconnect();
                emitter.gain.connect(busDest);
                emitter.currentBus = bus;
              }
              source.connect(voiceGain).connect(emitter.panner);
            } else {
              source.connect(voiceGain).connect(busDest);
            }
          } else {
            source.connect(voiceGain).connect(busDest);
          }

          const voice: MixerVoice = {
            id: this.nextVoiceId++,
            assetId,
            bus,
            owner,
            source,
            gain: voiceGain,
            stopping: false,
            done: false,
          };
          this.voices.add(voice);
          source.onended = () => this.cleanupVoice(voice);
          source.start(now);

          this.loader.recordPlaybackFile(descriptor.file);
          notifyHorrorAudioDiagnosticsChanged();
          return 'opus';
        }
      } else if (this.loader.getOpusSupport().supported && Date.now() - this.lastOpusPreloadRequest > 250) {
        // Trigger non-blocking lazy fetch+decode for future plays while falling back immediately now.
        this.lastOpusPreloadRequest = Date.now();
        void this.loader.loadBuffer(assetId);
      }
    }

    if ((options.fallbackToProcedural ?? true) && fallbackPreset && this.synth) {
      if (options.position) {
        this.synth.position(owner, options.position.x, options.position.y, options.position.z, true, 1, options.occluded ?? false);
      }
      this.synth.play(fallbackPreset, volume, owner, pitch);
      this.loader.recordPlaybackFile(`procedural:${fallbackPreset}`);
      notifyHorrorAudioDiagnosticsChanged();
      return 'procedural';
    }

    return 'skipped';
  }

  private ensureLoopChannel(assetId: HorrorAudioId, bus: HorrorAudioBusId): LoopChannel | null {
    const ctx = gameAudio.context;
    const dest = this.getBusDestination(bus);
    const seamless = this.loader.getSeamlessLoopBuffer(assetId);
    if (!ctx || !dest || !seamless) return null;

    const existing =
      assetId === 'warehouse-drone'
        ? this.droneChannel
        : assetId === 'eerie-wind'
          ? this.windChannel
          : assetId === 'chase-tension'
            ? this.chaseChannel
            : null;
    if (existing && !existing.disposed && existing.source) {
      return existing;
    }

    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(dest);

    const source = ctx.createBufferSource();
    source.buffer = seamless.buffer;
    source.loop = true;
    source.loopStart = seamless.loopStartSec;
    source.loopEnd = seamless.loopEndSec;
    source.connect(gain);
    source.start(ctx.currentTime);

    const channel: LoopChannel = { assetId, bus, gain, source, targetLevel: 0, disposed: false };
    if (assetId === 'warehouse-drone') this.droneChannel = channel;
    else if (assetId === 'eerie-wind') this.windChannel = channel;
    else if (assetId === 'chase-tension') this.chaseChannel = channel;
    this.loader.recordPlaybackFile(HORROR_AUDIO_DESCRIPTORS[assetId].file);
    return channel;
  }

  private setLoopChannelLevel(channel: LoopChannel | null, target: number, fadeSec: number): void {
    const ctx = gameAudio.context;
    if (!channel || channel.disposed || !ctx) return;
    channel.targetLevel = clamp01(target);
    channel.gain.gain.setTargetAtTime(channel.targetLevel, ctx.currentTime, fadeSec);
  }

  private disposeLoopChannel(channel: LoopChannel | null): null {
    if (!channel || channel.disposed) return null;
    channel.disposed = true;
    try {
      channel.source?.stop();
    } catch {
      // ignored
    }
    channel.source?.disconnect();
    channel.gain.disconnect();
    channel.source = null;
    return null;
  }

  private stopAllLoopsImmediate(): void {
    this.droneChannel = this.disposeLoopChannel(this.droneChannel);
    this.windChannel = this.disposeLoopChannel(this.windChannel);
    this.chaseChannel = this.disposeLoopChannel(this.chaseChannel);
    this.proceduralBed?.dispose();
    this.proceduralBed = null;
    if (this.proceduralChaseOwner && this.synth) {
      this.synth.stop(this.proceduralChaseOwner, 'ghost_chase_tension');
    }
    this.proceduralChaseOwner = null;
    this.bedMode = 'inactive';
  }

  /**
   * Dual-layer warehouse ambient bed:
   * - Daytime: subtle wind & low drone.
   * - Nighttime: deeper resonant tension.
   * Prefers decoded Opus loops; gracefully falls back to WarehouseAmbientBed while loading or when unsupported.
   */
  updateWarehouseAmbience({ active, level, isNight, dt }: UpdateAmbienceOptions): {
    sources: number;
    nodes: number;
    disposed: boolean;
    bedMode: 'opus' | 'procedural' | 'inactive';
  } {
    const cleanLevel = clamp01(level);
    const shouldPlay = active && cleanLevel > 0.001 && this.isAudioRunning();

    if (shouldPlay) {
      this.ambienceSilentTime = 0;
      const droneReady = this.loader.getCachedBuffer('warehouse-drone');
      const windReady = this.loader.getCachedBuffer('eerie-wind');

      if (droneReady && windReady) {
        const drone = this.ensureLoopChannel('warehouse-drone', 'ambience');
        const wind = this.ensureLoopChannel('eerie-wind', 'ambience');
        if (drone && wind) {
          // Crossfade out procedural fallback cleanly once Opus stems are live.
          if (this.proceduralBed) {
            this.proceduralBed.setLevel(0);
            this.proceduralBed.dispose();
            this.proceduralBed = null;
          }
          // Subtle by day, ominous & full by night
          const dayNightScale = isNight ? 1.0 : 0.28;
          const droneGain = cleanLevel * dayNightScale * (isNight ? 0.52 : 0.18);
          const windGain = cleanLevel * dayNightScale * (isNight ? 0.56 : 0.34);
          this.setLoopChannelLevel(drone, droneGain, 0.45);
          this.setLoopChannelLevel(wind, windGain, 0.45);
          this.bedMode = 'opus';
          return { sources: 2, nodes: 4, disposed: false, bedMode: 'opus' };
        }
      }

      // Trigger non-blocking preload if Opus is supported and buffers aren't decoded yet.
      if (this.loader.getOpusSupport().supported && !droneReady && !windReady) {
        void this.loader.preload(['warehouse-drone', 'eerie-wind']);
      }

      // Immediate procedural fallback so there is never an awkward silence window.
      try {
        this.proceduralBed ??= new WarehouseAmbientBed();
        const proceduralScale = cleanLevel * (isNight ? 1.0 : 0.32);
        this.proceduralBed.setLevel(proceduralScale);
        this.bedMode = 'procedural';
        return { ...this.proceduralBed.diagnostics, bedMode: 'procedural' };
      } catch {
        this.bedMode = 'inactive';
        return { sources: 0, nodes: 0, disposed: true, bedMode: 'inactive' };
      }
    }

    // Smooth fade out on leaving zone / mute / pause, then dispose after fade tail settles.
    this.setLoopChannelLevel(this.droneChannel, 0, 0.55);
    this.setLoopChannelLevel(this.windChannel, 0, 0.55);
    this.proceduralBed?.setLevel(0);
    this.ambienceSilentTime += Math.max(0, Math.min(dt, 0.5));

    if (this.ambienceSilentTime > 2.2) {
      this.droneChannel = this.disposeLoopChannel(this.droneChannel);
      this.windChannel = this.disposeLoopChannel(this.windChannel);
      this.proceduralBed?.dispose();
      this.proceduralBed = null;
      this.bedMode = 'inactive';
    }

    if (this.droneChannel || this.windChannel) {
      return { sources: 2, nodes: 4, disposed: false, bedMode: 'opus' };
    }
    if (this.proceduralBed) {
      return { ...this.proceduralBed.diagnostics, bedMode: 'procedural' };
    }
    return { sources: 0, nodes: 0, disposed: true, bedMode: 'inactive' };
  }

  /**
   * Chase tension loop keyed by ghost owner. Multiple ghosts converge on a single continuous
   * loop without restarting per frame; intensity scales smoothly as distance shrinks.
   */
  setChaseTension(owner: string, active: boolean, intensity = 0.65, dt = 0.05): void {
    if (active && this.isAudioRunning() && intensity > 0) {
      this.chaseOwners.set(owner, clamp01(intensity));
    } else {
      this.chaseOwners.delete(owner);
    }

    let peak = 0;
    for (const val of this.chaseOwners.values()) {
      if (val > peak) peak = val;
    }

    if (peak > 0 && this.isAudioRunning()) {
      this.chaseSilentTime = 0;
      if (this.loader.getCachedBuffer('chase-tension')) {
        const ch = this.ensureLoopChannel('chase-tension', 'chaseMusic');
        if (ch) {
          if (this.proceduralChaseOwner && this.synth) {
            this.synth.stop(this.proceduralChaseOwner, 'ghost_chase_tension');
            this.proceduralChaseOwner = null;
          }
          this.setLoopChannelLevel(ch, 0.22 + peak * 0.68, 0.28);
          return;
        }
      } else if (this.loader.getOpusSupport().supported) {
        void this.loader.loadBuffer('chase-tension');
      }

      if (this.synth) {
        this.proceduralChaseOwner = owner;
        this.synth.sustain(owner, 'ghost_chase_tension', true);
      }
      return;
    }

    this.setLoopChannelLevel(this.chaseChannel, 0, 0.45);
    if (this.proceduralChaseOwner && this.synth) {
      this.synth.stop(this.proceduralChaseOwner, 'ghost_chase_tension');
      this.proceduralChaseOwner = null;
    }
    this.chaseSilentTime += Math.max(0, Math.min(dt, 0.5));
    if (this.chaseSilentTime > 2.0 && this.chaseChannel) {
      this.chaseChannel = this.disposeLoopChannel(this.chaseChannel);
    }
  }

  stopOwner(owner: string): void {
    this.chaseOwners.delete(owner);
    this.synth?.stop(owner);
    const ctx = gameAudio.context;
    if (ctx) {
      const t = ctx.currentTime;
      for (const v of this.voices) {
        if (v.owner === owner && !v.stopping) {
          v.stopping = true;
          v.gain.gain.cancelScheduledValues(t);
          v.gain.gain.setTargetAtTime(0, t, 0.02);
          try {
            v.source.stop(t + 0.08);
          } catch {
            // ignored
          }
        }
      }
    }
    if (this.chaseOwners.size === 0) {
      this.setLoopChannelLevel(this.chaseChannel, 0, 0.35);
      if (this.proceduralChaseOwner === owner && this.synth) {
        this.synth.stop(owner, 'ghost_chase_tension');
        this.proceduralChaseOwner = null;
      }
    }
  }

  releaseOwner(owner: string): void {
    this.stopOwner(owner);
    this.synth?.release(owner);
    this.releaseEmitter(owner);
  }

  stopAllVoices(): void {
    const ctx = gameAudio.context;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const v of [...this.voices]) {
      if (!v.stopping) {
        v.stopping = true;
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setTargetAtTime(0, t, 0.015);
        try {
          v.source.stop(t + 0.06);
        } catch {
          this.cleanupVoice(v);
        }
      }
    }
  }

  activeVoiceCount(bus?: HorrorAudioBusId): number {
    let count = 0;
    for (const v of this.voices) {
      if (!v.done && (!bus || v.bus === bus)) count++;
    }
    if (!bus || bus === 'ghostEffects') {
      count += this.synth?.diagnostics.voices ?? 0;
    }
    return count;
  }

  activeVoiceCountForPrefix(prefix = ''): number {
    let count = 0;
    for (const v of this.voices) {
      if (!v.done && v.owner.startsWith(prefix)) count++;
    }
    count += this.synth?.activeVoiceCount(prefix) ?? 0;
    return count;
  }

  get encounterBusy(): boolean {
    if (this.chaseOwners.size > 0) return true;
    for (const v of this.voices) {
      if (
        !v.done &&
        !v.owner.startsWith('warehouse-audio:') &&
        (v.assetId === 'spectral-shriek' ||
          v.assetId === 'spectral-cackle' ||
          v.assetId === 'ghost-grab-impact' ||
          v.assetId === 'chase-tension')
      ) {
        return true;
      }
    }
    return this.synth?.encounterBusy ?? false;
  }

  getBedDiagnostics(): { sources: number; nodes: number; disposed: boolean; bedMode: 'opus' | 'procedural' | 'inactive' } {
    if (this.droneChannel || this.windChannel) {
      return {
        sources: (this.droneChannel ? 1 : 0) + (this.windChannel ? 1 : 0),
        nodes: (this.droneChannel ? 2 : 0) + (this.windChannel ? 2 : 0),
        disposed: false,
        bedMode: 'opus',
      };
    }
    if (this.proceduralBed) {
      return { ...this.proceduralBed.diagnostics, bedMode: 'procedural' };
    }
    return { sources: 0, nodes: 0, disposed: true, bedMode: this.bedMode };
  }

  inspect() {
    const levels = gameAudio.getLevels();
    const loaderDiag = this.loader.getDiagnostics();
    const synthVoices = this.synth?.diagnostics.voices ?? 0;
    let ambienceVoices = (this.droneChannel ? 1 : 0) + (this.windChannel ? 1 : 0) + (this.proceduralBed ? 1 : 0);
    let ghostVoices = synthVoices;
    let horrorVoices = 0;
    let chaseVoices = (this.chaseChannel ? 1 : 0) + (this.proceduralChaseOwner ? 1 : 0);

    for (const v of this.voices) {
      if (v.done) continue;
      if (v.bus === 'ambience') ambienceVoices++;
      else if (v.bus === 'ghostEffects') ghostVoices++;
      else if (v.bus === 'horrorEvents') horrorVoices++;
      else if (v.bus === 'chaseMusic') chaseVoices++;
    }

    return {
      buses: {
        ambience: { gain: levels.ambience, activeVoices: ambienceVoices },
        ghostEffects: { gain: levels.ghost, activeVoices: ghostVoices },
        horrorEvents: { gain: levels.horrorEvents, activeVoices: horrorVoices },
        chaseMusic: { gain: levels.chaseMusic, activeVoices: chaseVoices },
      } as const,
      currentAudioFile: loaderDiag.currentFile,
      lastPlaybackError: loaderDiag.lastError,
      opusSupport: loaderDiag.opusSupport,
    };
  }

  /** User-triggered audio test for development diagnostics (unlocks + loads + plays sting or fallback). */
  async runSelfTest(): Promise<void> {
    if (!gameAudio.isActive()) {
      gameAudio.setActive(true);
    }
    gameAudio.unlock();
    const ctx = gameAudio.context;
    if (!ctx) {
      this.loader.recordError('AudioContext unavailable in this environment');
      notifyHorrorAudioDiagnosticsChanged();
      return;
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        // continue to error capture if still suspended
      }
    }
    const levels = gameAudio.getLevels();
    const prevMaster = levels.master;
    if (prevMaster <= 0 && gameAudio.master) {
      gameAudio.master.gain.setTargetAtTime(0.25, ctx.currentTime, 0.02);
    }
    await this.loader.preload(['horror-sting']);
    await this.loader.loadBuffer('horror-sting');
    const mode = this.playCue({
      assetId: 'horror-sting',
      fallbackPreset: 'ghost_warning',
      bus: 'horrorEvents',
      owner: 'diag-test',
      volume: 0.75,
    });
    if (mode === 'skipped') {
      this.loader.recordError(`Test audio skipped (AudioContext state=${gameAudio.context?.state ?? 'locked'}, muted=${this.muted}, active=${gameAudio.isActive()})`);
    }
    notifyHorrorAudioDiagnosticsChanged();
  }

  dispose(): void {
    this.detachPause?.();
    this.detachPause = null;
    this.detachResume?.();
    this.detachResume = null;
    registerHorrorAudioInspector(null);
    registerHorrorAudioTestRunner(null);
    this.stopAllLoopsImmediate();
    for (const v of [...this.voices]) {
      this.cleanupVoice(v);
    }
    for (const owner of [...this.emitters.keys()]) {
      this.releaseEmitter(owner);
    }
    this.chaseOwners.clear();
    if (this.synth) {
      releaseSharedGhostAudio();
      this.synth = null;
    }
    notifyHorrorAudioDiagnosticsChanged();
  }
}

const sharedMixer = new HorrorAudioMixer();
export function acquireSharedHorrorMixer(): HorrorAudioMixer {
  return sharedMixer.acquire();
}
export function releaseSharedHorrorMixer(): void {
  sharedMixer.release();
}
