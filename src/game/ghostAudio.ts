export type GhostAudioCue = 'flee-scare' | 'scream' | 'evil-laugh' | 'grab-impact';

/**
 * Procedural Web Audio synthesizer for Night Ghost encounters.
 * Zero external MP3/WAV files; safe when muted, offline, or in environments without AudioContext.
 */
export class GhostHorrorAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeVoices = new Set<AudioScheduledSourceNode>();
  private disposed = false;

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof AudioContext === 'undefined') return null;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.context.destination);

      // Build reusable 1.2s pink-tinted noise buffer for breath/screech layers (no per-cue allocation).
      const sampleRate = this.context.sampleRate;
      const buf = this.context.createBuffer(1, Math.floor(sampleRate * 1.2), sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = (b0 + white * 0.08) / 1.08;
        data[i] = Math.max(-1, Math.min(1, b0 * 2.4 + white * 0.18));
      }
      this.noiseBuffer = buf;
    }
    return this.context;
  }

  private trackSource<T extends AudioScheduledSourceNode>(src: T, onCleanup?: () => void): T {
    this.activeVoices.add(src);
    src.onended = () => {
      this.activeVoices.delete(src);
      try {
        src.disconnect();
      } catch {
        // Ignore already disconnected nodes
      }
      onCleanup?.();
    };
    return src;
  }

  private scheduleTone(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      startTime: number;
      duration: number;
      startFreq: number;
      endFreq: number;
      peakGain: number;
      type?: OscillatorType;
      vibratoHz?: number;
      vibratoDepth?: number;
    },
  ): void {
    if (this.disposed || this.activeVoices.size >= 36) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(Math.max(20, opts.startFreq), opts.startTime);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(20, opts.endFreq),
      opts.startTime + opts.duration,
    );

    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (opts.vibratoHz && opts.vibratoDepth) {
      lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(opts.vibratoHz, opts.startTime);
      lfoGain.gain.setValueAtTime(opts.vibratoDepth, opts.startTime);
      lfo.connect(lfoGain).connect(osc.frequency);
    }

    gain.gain.setValueAtTime(0.0001, opts.startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, opts.peakGain),
      opts.startTime + Math.min(0.04, opts.duration * 0.25),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);

    osc.connect(gain).connect(dest);
    this.trackSource(osc, () => {
      gain.disconnect();
      lfoGain?.disconnect();
    });

    if (lfo) {
      this.trackSource(lfo);
      lfo.start(opts.startTime);
      lfo.stop(opts.startTime + opts.duration + 0.03);
    }
    osc.start(opts.startTime);
    osc.stop(opts.startTime + opts.duration + 0.03);
  }

  private scheduleNoiseBurst(
    ctx: AudioContext,
    dest: AudioNode,
    opts: {
      startTime: number;
      duration: number;
      filterType: BiquadFilterType;
      startFreq: number;
      endFreq: number;
      q: number;
      peakGain: number;
    },
  ): void {
    if (this.disposed || !this.noiseBuffer || this.activeVoices.size >= 36) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType;
    filter.Q.setValueAtTime(opts.q, opts.startTime);
    filter.frequency.setValueAtTime(opts.startFreq, opts.startTime);
    filter.frequency.exponentialRampToValueAtTime(opts.endFreq, opts.startTime + opts.duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, opts.startTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, opts.peakGain),
      opts.startTime + Math.min(0.04, opts.duration * 0.2),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, opts.startTime + opts.duration);

    src.connect(filter).connect(gain).connect(dest);
    this.trackSource(src, () => {
      filter.disconnect();
      gain.disconnect();
    });
    src.start(opts.startTime);
    src.stop(opts.startTime + opts.duration + 0.03);
  }

  public unlock(): void {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => {});
    }
  }

  public play(cue: GhostAudioCue, volume: number): void {
    const clampedVol = Math.max(0, Math.min(1, volume));
    if (this.disposed || clampedVol <= 0.01) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx || !this.master) return;
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      const level = Math.min(0.24, clampedVol * 0.32);

      switch (cue) {
        case 'flee-scare': {
          // Cold breath hiss + startled dissonant drop when fleeing before threshold
          this.scheduleNoiseBurst(ctx, this.master, {
            startTime: now,
            duration: 0.55,
            filterType: 'bandpass',
            startFreq: 1100,
            endFreq: 380,
            q: 2.2,
            peakGain: level * 0.48,
          });
          this.scheduleTone(ctx, this.master, {
            startTime: now,
            duration: 0.55,
            startFreq: 560,
            endFreq: 190,
            peakGain: level * 0.36,
            type: 'sine',
          });
          this.scheduleTone(ctx, this.master, {
            startTime: now + 0.03,
            duration: 0.5,
            startFreq: 790,
            endFreq: 268,
            peakGain: level * 0.22,
            type: 'triangle',
          });
          break;
        }

        case 'scream': {
          // Shrill multi-harmonic horror shriek paired with freaky.001 confrontation
          this.scheduleNoiseBurst(ctx, this.master, {
            startTime: now,
            duration: 0.95,
            filterType: 'bandpass',
            startFreq: 1650,
            endFreq: 780,
            q: 3.4,
            peakGain: level * 0.42,
          });
          this.scheduleTone(ctx, this.master, {
            startTime: now,
            duration: 0.92,
            startFreq: 860,
            endFreq: 490,
            peakGain: level * 0.4,
            type: 'sawtooth',
            vibratoHz: 18,
            vibratoDepth: 34,
          });
          this.scheduleTone(ctx, this.master, {
            startTime: now + 0.04,
            duration: 0.85,
            startFreq: 1215,
            endFreq: 695,
            peakGain: level * 0.26,
            type: 'triangle',
            vibratoHz: 21,
            vibratoDepth: 42,
          });
          this.scheduleTone(ctx, this.master, {
            startTime: now,
            duration: 0.78,
            startFreq: 165,
            endFreq: 92,
            peakGain: level * 0.32,
            type: 'triangle',
          });
          break;
        }

        case 'evil-laugh': {
          // Sinister rhythmic cackle bursts synchronized with laugh_01.001
          const cadence = [
            { delay: 0.0, start: 435, end: 335, dur: 0.17 },
            { delay: 0.23, start: 395, end: 295, dur: 0.17 },
            { delay: 0.46, start: 350, end: 255, dur: 0.18 },
            { delay: 0.71, start: 310, end: 215, dur: 0.19 },
            { delay: 0.98, start: 270, end: 158, dur: 0.28 },
          ];
          for (const syllable of cadence) {
            const t = now + syllable.delay;
            this.scheduleTone(ctx, this.master, {
              startTime: t,
              duration: syllable.dur,
              startFreq: syllable.start,
              endFreq: syllable.end,
              peakGain: level * 0.38,
              type: 'sawtooth',
              vibratoHz: 14,
              vibratoDepth: 16,
            });
            this.scheduleTone(ctx, this.master, {
              startTime: t,
              duration: syllable.dur,
              startFreq: syllable.start * 1.49,
              endFreq: syllable.end * 1.42,
              peakGain: level * 0.2,
              type: 'triangle',
            });
          }
          break;
        }

        case 'grab-impact': {
          // Sub-bass neck-grab thud + dissonant scare sting
          this.scheduleTone(ctx, this.master, {
            startTime: now,
            duration: 0.42,
            startFreq: 145,
            endFreq: 44,
            peakGain: level * 0.65,
            type: 'sine',
          });
          this.scheduleNoiseBurst(ctx, this.master, {
            startTime: now,
            duration: 0.38,
            filterType: 'lowpass',
            startFreq: 950,
            endFreq: 220,
            q: 1.5,
            peakGain: level * 0.45,
          });
          this.scheduleTone(ctx, this.master, {
            startTime: now + 0.02,
            duration: 0.72,
            startFreq: 466,
            endFreq: 311,
            peakGain: level * 0.28,
            type: 'triangle',
          });
          break;
        }
      }
    } catch {
      // Ignore Web Audio restriction errors cleanly
    }
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const v of this.activeVoices) {
      try {
        v.stop();
        v.disconnect();
      } catch {
        // Ignore stopped voice errors
      }
    }
    this.activeVoices.clear();
    try {
      this.master?.disconnect();
    } catch {
      // Ignore disconnect errors
    }
    if (this.context) {
      void this.context.close().catch(() => {});
    }
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
  }
}

let sharedGhostAudio: GhostHorrorAudio | null = null;
let sharedGhostAudioRefCount = 0;

/** Shares a single Web Audio context across simultaneous Ghost NPCs within browser AudioContext limits. */
export function acquireSharedGhostAudio(): GhostHorrorAudio {
  if (!sharedGhostAudio) {
    sharedGhostAudio = new GhostHorrorAudio();
  }
  sharedGhostAudioRefCount += 1;
  return sharedGhostAudio;
}

export function releaseSharedGhostAudio(): void {
  if (sharedGhostAudioRefCount <= 0) return;
  sharedGhostAudioRefCount -= 1;
  if (sharedGhostAudioRefCount === 0 && sharedGhostAudio) {
    sharedGhostAudio.dispose();
    sharedGhostAudio = null;
  }
}
