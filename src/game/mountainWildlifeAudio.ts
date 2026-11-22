import { angle } from '../data/ward.ts';
import {
  WILDLIFE_DEER_BABY_AUDIO_FILES,
  WILDLIFE_DEER_STAG_AUDIO_FILES,
  WILDLIFE_TIGER_AUDIO_FILES,
  pickCachedSfxBuffer,
  preloadSfxBuffers,
} from './audio/sfxBufferCache.ts';
import { gameAudio } from './gameAudio.ts';
import { mountainHeight, type TerrainPeak } from './mountainTerrain.ts';

/**
 * ============================================================================
 * Mountain Wildlife Procedural Audio Engine
 * (`တောင်ပေါ် ကျားဟိန်းသံ နှင့် သမင်/ဒရယ် ဟောက်သံများ`)
 * ============================================================================
 * - Connects exclusively to the shared `gameAudio.ambience` bus (respects user
 *   master volume, mute toggle, compressor, safety limiter, and tab visibility).
 * - Zero downloaded audio files; pure Web Audio synthesis with a Singleton-cached
 *   noise buffer per AudioContext and a strict bounded voice cap.
 * - Activates ONLY when the player/camera is on elevated mountain terrain
 *   (`mountainWeight > 0`); completely silent in town/plains!
 * - Plays ONLY animal calls (`tiger-roar`, `barking-deer`, `deer-bellow`) with
 *   stereo panning toward the nearest live mountain tiger or deer herd.
 */

export type MountainWildlifeEventKind =
  | 'tiger-roar'
  | 'barking-deer'
  | 'deer-bellow';

export interface WildlifePoint {
  readonly homeX: number;
  readonly homeZ: number;
}

export interface MountainAudioFocusState {
  readonly x: number;
  readonly z: number;
  readonly forwardX: number;
  readonly forwardZ: number;
  readonly mountainWeight: number;
  readonly nearestTigerDist: number;
  readonly nearestTigerPan: number;
  readonly nearestDeerDist: number;
  readonly nearestDeerPan: number;
}

export const MOUNTAIN_AUDIO_MIN_ELEVATION_M = 3.5;
export const MOUNTAIN_AUDIO_FULL_ELEVATION_M = 18.0;
export const TIGER_CALL_MAX_RANGE_M = 420;
export const DEER_CALL_MAX_RANGE_M = 360;
/** Minimum & maximum quiet gap (seconds) AFTER one wildlife call finishes before the next random call. */
export const WILDLIFE_CALL_MIN_GAP_SEC = 12;
export const WILDLIFE_CALL_MAX_GAP_SEC = 24;
/** Initial delay (seconds) after entering the mountain before the first wildlife call. */
export const WILDLIFE_INITIAL_DELAY_MIN_SEC = 4;
export const WILDLIFE_INITIAL_DELAY_MAX_SEC = 8;
/** Caps very long source recordings to a brief natural call with smooth fade-out. */
export const MAX_WILDLIFE_CLIP_DURATION_SEC = 4.8;
const MAX_ACTIVE_VOICES = 24;

export function computeNextWildlifeGapSec(rng: () => number = Math.random): number {
  return (
    WILDLIFE_CALL_MIN_GAP_SEC +
    rng() * (WILDLIFE_CALL_MAX_GAP_SEC - WILDLIFE_CALL_MIN_GAP_SEC)
  );
}

const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

const noiseBufferCache = new WeakMap<AudioContext, AudioBuffer>();
const distortionCurveCache = new WeakMap<AudioContext, Float32Array<ArrayBuffer>>();

function getSharedNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseBufferCache.get(ctx);
  if (cached) return cached;
  const length = Math.max(ctx.sampleRate * 2, 44100 * 2);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // Warm pink-tinted noise used strictly for roar exhale & barking-deer rasp
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.997 * b0 + white * 0.029;
    b1 = 0.985 * b1 + white * 0.032;
    b2 = 0.95 * b2 + white * 0.048;
    data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.14) * 1.45));
  }
  noiseBufferCache.set(ctx, buffer);
  return buffer;
}

function getRoarSaturationCurve(ctx: AudioContext): Float32Array<ArrayBuffer> {
  const cached = distortionCurveCache.get(ctx);
  if (cached) return cached;
  const curve = new Float32Array(new ArrayBuffer(512 * 4));
  for (let i = 0; i < 512; i++) {
    const x = i / 255.5 - 1;
    curve[i] = Math.tanh(x * 3.4);
  }
  distortionCurveCache.set(ctx, curve);
  return curve;
}

/**
 * Computes smooth [0..1] mountain immersion factor from world (x, z) elevation.
 * Returns 0 on flat town/village plains and ramps smoothly to 1 on mountain slopes & plateaus.
 */
export function computeMountainAudioWeight(
  worldX: number,
  worldZ: number,
  peaks: readonly TerrainPeak[],
): number {
  const u = worldX * cosA - worldZ * sinA;
  const v = worldX * sinA + worldZ * cosA;
  const h = mountainHeight(u, v, peaks);
  if (h <= MOUNTAIN_AUDIO_MIN_ELEVATION_M) return 0;
  if (h >= MOUNTAIN_AUDIO_FULL_ELEVATION_M) return 1;
  const t =
    (h - MOUNTAIN_AUDIO_MIN_ELEVATION_M) /
    (MOUNTAIN_AUDIO_FULL_ELEVATION_M - MOUNTAIN_AUDIO_MIN_ELEVATION_M);
  return t * t * (3 - 2 * t);
}

/**
 * Computes stereo pan [-0.85..+0.85] for a world sound source relative to a
 * camera facing (forwardX, forwardZ) in Three.js (+Y up) coordinates.
 * Right vector = forward × up = (-forwardZ, forwardX).
 */
export function computeStereoPan(
  listenerX: number,
  listenerZ: number,
  forwardX: number,
  forwardZ: number,
  sourceX: number,
  sourceZ: number,
): number {
  const dx = sourceX - listenerX;
  const dz = sourceZ - listenerZ;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.001) return 0;
  const fLen = Math.hypot(forwardX, forwardZ);
  if (fLen < 0.001) return 0;
  const fx = forwardX / fLen;
  const fz = forwardZ / fLen;
  const rightX = -fz;
  const rightZ = fx;
  const dot = (dx * rightX + dz * rightZ) / dist;
  return Math.max(-0.85, Math.min(0.85, dot * 0.85));
}

export function findNearestWildlifePoint(
  x: number,
  z: number,
  points: readonly WildlifePoint[],
): { dist: number; point: WildlifePoint | null } {
  let bestSq = Number.POSITIVE_INFINITY;
  let best: WildlifePoint | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const dx = p.homeX - x;
    const dz = p.homeZ - z;
    const dSq = dx * dx + dz * dz;
    if (dSq < bestSq) {
      bestSq = dSq;
      best = p;
    }
  }
  return {
    dist: best ? Math.sqrt(bestSq) : Number.POSITIVE_INFINITY,
    point: best,
  };
}

/**
 * Chooses the next mountain animal call using proximity weighting and
 * anti-repetition (`tiger-roar`, `barking-deer`, `deer-bellow`).
 * Returns `null` when outside both tiger and deer audible ranges.
 */
export function selectNextWildlifeEvent(
  rng: () => number,
  state: Pick<MountainAudioFocusState, 'mountainWeight' | 'nearestTigerDist' | 'nearestDeerDist'>,
  lastEvent: MountainWildlifeEventKind | null,
): MountainWildlifeEventKind | null {
  const weights: Array<[MountainWildlifeEventKind, number]> = [];

  if (state.nearestTigerDist <= TIGER_CALL_MAX_RANGE_M) {
    const tigerNear = state.nearestTigerDist < 150 ? 1.9 : state.nearestTigerDist < 340 ? 1.25 : 0.9;
    weights.push(['tiger-roar', 0.38 * tigerNear]);
  }
  if (state.nearestDeerDist <= DEER_CALL_MAX_RANGE_M) {
    const deerNear = state.nearestDeerDist < 140 ? 1.85 : state.nearestDeerDist < 320 ? 1.25 : 0.95;
    weights.push(['barking-deer', 0.36 * deerNear]);
    weights.push(['deer-bellow', 0.26 * deerNear]);
  }

  if (weights.length === 0) return null;

  // Discourage immediate repeats for natural variety
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i][0] === lastEvent) weights[i][1] *= 0.28;
    total += weights[i][1];
  }

  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i][1];
    if (roll <= 0) return weights[i][0];
  }
  return weights[weights.length - 1][0];
}

export class MountainWildlifeAudioController {
  private ctx: AudioContext | null = null;
  private busGain: GainNode | null = null;
  private activeNodes = new Set<AudioScheduledSourceNode>();

  private mountainWeight = 0;
  private wasOnMountain = false;
  private callCooldown = WILDLIFE_INITIAL_DELAY_MIN_SEC + Math.random() * (WILDLIFE_INITIAL_DELAY_MAX_SEC - WILDLIFE_INITIAL_DELAY_MIN_SEC);
  private callPlayingUntilSec = 0;
  private lastEvent: MountainWildlifeEventKind | null = null;
  private disposed = false;

  private readonly detachPause: () => void;
  private readonly detachResume: () => void;

  private focusState: MountainAudioFocusState = {
    x: 0,
    z: 0,
    forwardX: 0,
    forwardZ: -1,
    mountainWeight: 0,
    nearestTigerDist: Number.POSITIVE_INFINITY,
    nearestTigerPan: 0,
    nearestDeerDist: Number.POSITIVE_INFINITY,
    nearestDeerPan: 0,
  };

  constructor() {
    this.detachPause = gameAudio.onPause(() => {
      this.fadeOutImmediate();
    });
    this.detachResume = gameAudio.onResume(() => {
      if (!this.disposed && this.mountainWeight > 0.01) {
        this.ensureGraph();
        this.applyBusLevel();
      }
    });
  }

  private ensureGraph(): boolean {
    if (this.disposed) return false;
    const ctx = gameAudio.context;
    const ambience = gameAudio.ambience;
    if (!ctx || !ambience || ctx.state !== 'running') return false;
    if (this.ctx === ctx && this.busGain) return true;

    this.teardownGraph();
    this.ctx = ctx;

    const bus = ctx.createGain();
    bus.gain.value = 0;
    bus.connect(ambience);
    this.busGain = bus;

    // Lazily preload real MP3 wildlife calls once AudioContext is running
    preloadSfxBuffers(ctx, [
      ...WILDLIFE_TIGER_AUDIO_FILES,
      ...WILDLIFE_DEER_BABY_AUDIO_FILES,
      ...WILDLIFE_DEER_STAG_AUDIO_FILES,
    ]);
    return true;
  }

  /**
   * Plays a real decoded MP3 wildlife AudioBuffer with distance attenuation,
   * gentle distance low-pass filtering, subtle pitch variation, and stereo panning.
   * Returns `true` if a decoded MP3 buffer was available and played.
   */
  private playSampledCall(
    files: readonly string[],
    distanceMeters: number,
    maxRangeMeters: number,
    pan: number,
    baseGain: number,
  ): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.busGain || this.activeNodes.size >= MAX_ACTIVE_VOICES - 2) return false;

    const buffer = pickCachedSfxBuffer(ctx, files);
    if (!buffer) return false;

    const now = ctx.currentTime + 0.015;
    const closeness = Math.max(
      0.22,
      Math.min(1.0, 1 - Math.max(0, distanceMeters - 25) / maxRangeMeters),
    );
    const level = baseGain * (0.35 + closeness * 0.65) * this.mountainWeight;

    const rate = 0.96 + Math.random() * 0.08;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;

    // Prevent very long MP3 files from looping/running for tens of seconds continuously
    const maxSourceDuration = MAX_WILDLIFE_CLIP_DURATION_SEC * rate;
    const isLongClip = buffer.duration > maxSourceDuration + 1.0;
    const playSourceDuration = isLongClip ? maxSourceDuration : buffer.duration;
    const startOffset = isLongClip
      ? Math.random() * Math.max(0, Math.min(buffer.duration - playSourceDuration, buffer.duration * 0.5))
      : 0;
    const playWallDuration = playSourceDuration / rate;

    const distanceFilter = ctx.createBiquadFilter();
    distanceFilter.type = 'lowpass';
    distanceFilter.frequency.value = 1800 + closeness * 14000;

    const gain = ctx.createGain();
    if (isLongClip) {
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.14);
      gain.gain.setValueAtTime(level, now + Math.max(0.2, playWallDuration - 0.5));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + playWallDuration);
    } else {
      gain.gain.setValueAtTime(level, now);
    }

    const out = this.createPanner(ctx, pan);
    src.connect(distanceFilter).connect(gain).connect(out);

    this.callPlayingUntilSec = Math.max(this.callPlayingUntilSec, now + playWallDuration + 0.15);

    this.trackSource(src, () => {
      try {
        src.disconnect();
        distanceFilter.disconnect();
        gain.disconnect();
        if (out !== this.busGain) out.disconnect();
      } catch {}
    });

    if (isLongClip) {
      src.start(now, startOffset, playSourceDuration);
    } else {
      src.start(now);
    }
    return true;
  }

  private applyBusLevel(): void {
    if (!this.ctx || !this.busGain) return;
    const active = gameAudio.isActive() && this.ctx.state === 'running';
    const target = active ? this.mountainWeight * 0.85 : 0;
    this.busGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.25);
  }

  private fadeOutImmediate(): void {
    if (!this.ctx || !this.busGain) return;
    this.busGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    this.stopTransientVoices();
  }

  private createPanner(ctx: AudioContext, pan: number): AudioNode {
    if (typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-0.9, Math.min(0.9, pan));
      p.connect(this.busGain!);
      return p;
    }
    return this.busGain!;
  }

  private trackSource(src: AudioScheduledSourceNode, cleanup: () => void): void {
    this.activeNodes.add(src);
    src.onended = () => {
      this.activeNodes.delete(src);
      cleanup();
    };
  }

  /**
   * ၁။ ကျားဟိန်းသံ (Real MP3 Tiger Roar Variants + Procedural Fallback)
   */
  private playTigerRoar(distanceMeters: number, pan: number): void {
    if (
      this.playSampledCall(
        WILDLIFE_TIGER_AUDIO_FILES,
        distanceMeters,
        TIGER_CALL_MAX_RANGE_M,
        pan,
        0.72,
      )
    ) {
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.busGain || this.activeNodes.size >= MAX_ACTIVE_VOICES - 6) return;

    const now = ctx.currentTime + 0.02;
    const closeness = Math.max(0.28, Math.min(1.0, 1 - (distanceMeters - 35) / 420));
    const level = (0.28 + closeness * 0.34) * this.mountainWeight;
    const duration = 1.65 + Math.random() * 0.65;
    const baseFreq = 68 + Math.random() * 18;

    const out = this.createPanner(ctx, pan);
    const roarGain = ctx.createGain();
    roarGain.gain.setValueAtTime(0.0001, now);
    roarGain.gain.linearRampToValueAtTime(level, now + 0.22);
    roarGain.gain.setValueAtTime(level * 0.92, now + duration * 0.48);
    roarGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const shaper = ctx.createWaveShaper();
    shaper.curve = getRoarSaturationCurve(ctx);

    const throatFormant = ctx.createBiquadFilter();
    throatFormant.type = 'bandpass';
    throatFormant.frequency.setValueAtTime(340 + closeness * 130, now);
    throatFormant.frequency.exponentialRampToValueAtTime(175, now + duration);
    throatFormant.Q.value = 1.65;

    const distanceLp = ctx.createBiquadFilter();
    distanceLp.type = 'lowpass';
    distanceLp.frequency.value = 620 + closeness * 1100;

    const echoDelay = ctx.createDelay(1.0);
    echoDelay.delayTime.value = 0.36;
    const echoFilter = ctx.createBiquadFilter();
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = 520;
    const echoGain = ctx.createGain();
    echoGain.gain.value = 0.28;

    shaper.connect(throatFormant).connect(distanceLp).connect(roarGain).connect(out);
    roarGain.connect(echoDelay).connect(echoFilter).connect(echoGain).connect(out);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(baseFreq * 1.18, now);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.96, now + 0.32);
    osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + duration);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(baseFreq * 0.56, now);
    osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.42, now + duration);

    const raspLfo = ctx.createOscillator();
    raspLfo.type = 'sawtooth';
    raspLfo.frequency.setValueAtTime(27 + Math.random() * 5, now);
    raspLfo.frequency.linearRampToValueAtTime(18, now + duration);
    const raspDepth = ctx.createGain();
    raspDepth.gain.value = 26;
    raspLfo.connect(raspDepth).connect(osc1.frequency);

    const snarl = ctx.createBufferSource();
    snarl.buffer = getSharedNoiseBuffer(ctx);
    snarl.loop = true;
    const snarlFilter = ctx.createBiquadFilter();
    snarlFilter.type = 'bandpass';
    snarlFilter.frequency.setValueAtTime(680, now);
    snarlFilter.frequency.exponentialRampToValueAtTime(280, now + duration);
    snarlFilter.Q.value = 1.9;
    const snarlGain = ctx.createGain();
    snarlGain.gain.setValueAtTime(0.0001, now);
    snarlGain.gain.linearRampToValueAtTime(0.45, now + 0.18);
    snarlGain.gain.exponentialRampToValueAtTime(0.0001, now + duration * 0.92);

    osc1.connect(shaper);
    osc2.connect(shaper);
    snarl.connect(snarlFilter).connect(snarlGain).connect(shaper);

    const stopAt = now + duration + 0.06;
    const echoReleaseMs = Math.ceil((duration + 0.55) * 1000);
    const disconnectAll = () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        raspLfo.disconnect();
        raspDepth.disconnect();
        snarl.disconnect();
        snarlFilter.disconnect();
        snarlGain.disconnect();
        shaper.disconnect();
        throatFormant.disconnect();
        distanceLp.disconnect();
      } catch {}
    };

    this.trackSource(osc1, disconnectAll);
    this.trackSource(osc2, () => {});
    this.trackSource(raspLfo, () => {});
    this.trackSource(snarl, () => {});

    osc1.start(now);
    osc2.start(now);
    raspLfo.start(now);
    snarl.start(now);
    osc1.stop(stopAt);
    osc2.stop(stopAt);
    raspLfo.stop(stopAt);
    snarl.stop(stopAt);

    setTimeout(() => {
      try {
        roarGain.disconnect();
        echoDelay.disconnect();
        echoFilter.disconnect();
        echoGain.disconnect();
        if (out !== this.busGain) out.disconnect();
      } catch {}
    }, echoReleaseMs);
  }

  /**
   * ၂။ ဒရယ် / သမင်ငယ် ဟောက်သံ (Real MP3 Deer Call + Procedural Fallback)
   */
  private playBarkingDeerCall(distanceMeters: number, pan: number): void {
    if (
      this.playSampledCall(
        WILDLIFE_DEER_BABY_AUDIO_FILES,
        distanceMeters,
        DEER_CALL_MAX_RANGE_M,
        pan,
        0.65,
      )
    ) {
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.busGain || this.activeNodes.size >= MAX_ACTIVE_VOICES - 6) return;

    const closeness = Math.max(0.24, Math.min(1.0, 1 - (distanceMeters - 25) / 360));
    const level = (0.18 + closeness * 0.24) * this.mountainWeight;
    const barks = Math.random() < 0.65 ? 2 : 3;
    const basePitch = 370 + Math.random() * 85;

    const out = this.createPanner(ctx, pan);
    const now = ctx.currentTime + 0.02;

    for (let i = 0; i < barks; i++) {
      const start = now + i * (0.58 + Math.random() * 0.22);
      const dur = 0.21 + Math.random() * 0.05;

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(basePitch * 0.92, start);
      osc.frequency.exponentialRampToValueAtTime(basePitch * 1.48, start + 0.045);
      osc.frequency.exponentialRampToValueAtTime(basePitch * 0.56, start + dur);

      const barkNoise = ctx.createBufferSource();
      barkNoise.buffer = getSharedNoiseBuffer(ctx);
      barkNoise.loop = true;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = 1150;
      noiseFilter.Q.value = 2.0;

      const noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.35;

      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(860 + closeness * 240, start);
      formant.frequency.exponentialRampToValueAtTime(520, start + dur);
      formant.Q.value = 2.6;

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(level * (1 - i * 0.1), start + 0.028);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(formant);
      barkNoise.connect(noiseFilter).connect(noiseGain).connect(formant);
      formant.connect(env).connect(out);

      const echo = ctx.createDelay(0.6);
      echo.delayTime.value = 0.26;
      const echoLp = ctx.createBiquadFilter();
      echoLp.type = 'lowpass';
      echoLp.frequency.value = 820;
      const echoGain = ctx.createGain();
      echoGain.gain.value = 0.24;
      env.connect(echo).connect(echoLp).connect(echoGain).connect(out);

      const cleanup = () => {
        try {
          osc.disconnect();
          barkNoise.disconnect();
          noiseFilter.disconnect();
          noiseGain.disconnect();
          formant.disconnect();
        } catch {}
      };
      this.trackSource(osc, cleanup);
      this.trackSource(barkNoise, () => {});

      osc.start(start);
      barkNoise.start(start);
      osc.stop(start + dur + 0.03);
      barkNoise.stop(start + dur + 0.03);

      setTimeout(() => {
        try {
          env.disconnect();
          echo.disconnect();
          echoLp.disconnect();
          echoGain.disconnect();
        } catch {}
      }, Math.ceil((i * 0.85 + dur + 0.5) * 1000));
    }

    setTimeout(() => {
      try {
        if (out !== this.busGain) out.disconnect();
      } catch {}
    }, Math.ceil((barks * 0.9 + 0.7) * 1000));
  }

  /**
   * ၃။ သမင်ကြီး ဟောက်သံ / အော်သံ (Real MP3 Red Stag Call + Procedural Fallback)
   */
  private playDeerBellow(distanceMeters: number, pan: number): void {
    if (
      this.playSampledCall(
        WILDLIFE_DEER_STAG_AUDIO_FILES,
        distanceMeters,
        DEER_CALL_MAX_RANGE_M,
        pan,
        0.68,
      )
    ) {
      return;
    }
    const ctx = this.ctx;
    if (!ctx || !this.busGain || this.activeNodes.size >= MAX_ACTIVE_VOICES - 5) return;

    const now = ctx.currentTime + 0.02;
    const closeness = Math.max(0.24, Math.min(1.0, 1 - (distanceMeters - 30) / 380));
    const level = (0.17 + closeness * 0.22) * this.mountainWeight;
    const dur = 0.62 + Math.random() * 0.28;
    const startFreq = 250 + Math.random() * 55;

    const out = this.createPanner(ctx, pan);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(startFreq, now);
    osc1.frequency.exponentialRampToValueAtTime(startFreq * 1.16, now + 0.12);
    osc1.frequency.exponentialRampToValueAtTime(startFreq * 0.72, now + dur);

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(startFreq * 2.0, now);
    osc2.frequency.exponentialRampToValueAtTime(startFreq * 1.44, now + dur);

    const vib = ctx.createOscillator();
    vib.frequency.value = 14;
    const vibGain = ctx.createGain();
    vibGain.gain.value = 8;
    vib.connect(vibGain).connect(osc1.frequency);

    const chestFormant = ctx.createBiquadFilter();
    chestFormant.type = 'bandpass';
    chestFormant.frequency.setValueAtTime(640, now);
    chestFormant.frequency.linearRampToValueAtTime(430, now + dur);
    chestFormant.Q.value = 2.4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(level, now + 0.08);
    env.gain.setValueAtTime(level * 0.82, now + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc1.connect(chestFormant);
    osc2.connect(chestFormant);
    chestFormant.connect(env).connect(out);

    const echo = ctx.createDelay(0.6);
    echo.delayTime.value = 0.31;
    const echoGain = ctx.createGain();
    echoGain.gain.value = 0.24;
    env.connect(echo).connect(echoGain).connect(out);

    this.trackSource(osc1, () => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        vib.disconnect();
        vibGain.disconnect();
        chestFormant.disconnect();
      } catch {}
    });
    this.trackSource(osc2, () => {});
    this.trackSource(vib, () => {});

    osc1.start(now);
    osc2.start(now);
    vib.start(now);
    osc1.stop(now + dur + 0.04);
    osc2.stop(now + dur + 0.04);
    vib.stop(now + dur + 0.04);

    setTimeout(() => {
      try {
        env.disconnect();
        echo.disconnect();
        echoGain.disconnect();
        if (out !== this.busGain) out.disconnect();
      } catch {}
    }, Math.ceil((dur + 0.6) * 1000));
  }

  /**
   * Advances mountain wildlife audio based on current player/camera position,
   * orientation, mountain elevation, and nearest tiger/deer locations.
   */
  step(
    rawDt: number,
    worldX: number,
    worldZ: number,
    forwardX: number,
    forwardZ: number,
    peaks: readonly TerrainPeak[],
    tigers: readonly WildlifePoint[],
    deer: readonly WildlifePoint[],
  ): MountainAudioFocusState {
    const dt = Math.min(0.25, Math.max(0, rawDt));
    const weight = computeMountainAudioWeight(worldX, worldZ, peaks);
    this.mountainWeight = weight;

    let nearestTigerDist = Number.POSITIVE_INFINITY;
    let nearestTigerPan = 0;
    let nearestDeerDist = Number.POSITIVE_INFINITY;
    let nearestDeerPan = 0;

    if (weight > 0.02) {
      const nt = findNearestWildlifePoint(worldX, worldZ, tigers);
      nearestTigerDist = nt.dist;
      if (nt.point) {
        nearestTigerPan = computeStereoPan(
          worldX,
          worldZ,
          forwardX,
          forwardZ,
          nt.point.homeX,
          nt.point.homeZ,
        );
      }
      const nd = findNearestWildlifePoint(worldX, worldZ, deer);
      nearestDeerDist = nd.dist;
      if (nd.point) {
        nearestDeerPan = computeStereoPan(
          worldX,
          worldZ,
          forwardX,
          forwardZ,
          nd.point.homeX,
          nd.point.homeZ,
        );
      }
    }

    this.focusState = {
      x: worldX,
      z: worldZ,
      forwardX,
      forwardZ,
      mountainWeight: weight,
      nearestTigerDist,
      nearestTigerPan,
      nearestDeerDist,
      nearestDeerPan,
    };

    if (this.disposed) return this.focusState;

    const onMountainNow = weight > 0.12;
    if (onMountainNow && !this.wasOnMountain) {
      this.callCooldown = Math.max(
        this.callCooldown,
        WILDLIFE_INITIAL_DELAY_MIN_SEC +
          Math.random() * (WILDLIFE_INITIAL_DELAY_MAX_SEC - WILDLIFE_INITIAL_DELAY_MIN_SEC),
      );
    }
    this.wasOnMountain = onMountainNow;

    if (!onMountainNow) {
      this.applyBusLevel();
      return this.focusState;
    }

    if (!gameAudio.isActive() || !this.ensureGraph()) {
      return this.focusState;
    }

    this.applyBusLevel();

    // Strictly wait until any currently playing animal call has completely finished
    // before counting down the quiet random gap — zero overlapping calls!
    const ctxNow = this.ctx?.currentTime ?? 0;
    if (this.activeNodes.size > 0 || ctxNow < this.callPlayingUntilSec) {
      return this.focusState;
    }

    this.callCooldown -= dt;
    if (this.callCooldown <= 0) {
      const event = selectNextWildlifeEvent(Math.random, this.focusState, this.lastEvent);
      if (event) {
        this.lastEvent = event;
        const randomPan = (Math.random() * 2 - 1) * 0.72;

        switch (event) {
          case 'tiger-roar':
            this.playTigerRoar(
              Number.isFinite(nearestTigerDist) ? nearestTigerDist : 280,
              Number.isFinite(nearestTigerDist) ? nearestTigerPan : randomPan,
            );
            break;
          case 'barking-deer':
            this.playBarkingDeerCall(
              Number.isFinite(nearestDeerDist) ? nearestDeerDist : 220,
              Number.isFinite(nearestDeerDist) ? nearestDeerPan : randomPan,
            );
            break;
          case 'deer-bellow':
            this.playDeerBellow(
              Number.isFinite(nearestDeerDist) ? nearestDeerDist : 240,
              Number.isFinite(nearestDeerDist) ? nearestDeerPan : randomPan,
            );
            break;
        }
      }

      // Wait a calm random 12–24s AFTER the call finishes before the next call
      this.callCooldown = computeNextWildlifeGapSec(Math.random);
    }

    return this.focusState;
  }

  getState(): Readonly<MountainAudioFocusState> {
    return this.focusState;
  }

  private stopTransientVoices(): void {
    for (const node of this.activeNodes) {
      try {
        node.stop();
        node.disconnect();
      } catch {}
    }
    this.activeNodes.clear();
    this.callPlayingUntilSec = 0;
  }

  private teardownGraph(): void {
    this.stopTransientVoices();
    try {
      this.busGain?.disconnect();
    } catch {}
    this.busGain = null;
    this.ctx = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachPause();
    this.detachResume();
    this.teardownGraph();
  }
}
