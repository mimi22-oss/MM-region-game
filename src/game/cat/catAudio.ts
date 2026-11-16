/**
 * Procedural Web Audio Sound Synthesizer for Cat Vocalizations.
 *
 * Generates realistic, authentic domestic cat meows, chirps, trills, and continuous motor purring
 * without requiring any external audio files.
 */

let catAudioCtx: AudioContext | null = null;
let activePurrGain: GainNode | null = null;
let activePurrOsc: OscillatorNode | null = null;
let activePurrLfo: OscillatorNode | null = null;

function getCatAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!catAudioCtx || catAudioCtx.state === 'closed') {
    catAudioCtx = new AudioContextClass();
  }
  if (catAudioCtx.state === 'suspended') {
    catAudioCtx.resume().catch(() => {});
  }
  return catAudioCtx;
}

export type CatVocalType = 'greeting' | 'soft' | 'curious' | 'chirp' | 'purr_trill';

/**
 * Synthesizes a lifelike cat vocalization using dual-formant filtered waveforms.
 */
export function playCatMeow(type: CatVocalType = 'greeting', volume = 0.6): void {
  const ctx = getCatAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const masterGain = ctx.createGain();
  masterGain.connect(ctx.destination);

  let duration = 0.45;
  let startFreq = 480;
  let peakFreq = 820;
  let endFreq = 420;

  switch (type) {
    case 'soft':
      duration = 0.35;
      startFreq = 540;
      peakFreq = 720;
      endFreq = 500;
      break;
    case 'curious':
      duration = 0.4;
      startFreq = 420;
      peakFreq = 780;
      endFreq = 860; // rising questioning inflection
      break;
    case 'chirp':
      duration = 0.18;
      startFreq = 700;
      peakFreq = 950;
      endFreq = 880;
      break;
    case 'purr_trill':
      duration = 0.3;
      startFreq = 400;
      peakFreq = 620;
      endFreq = 480;
      break;
    case 'greeting':
    default:
      duration = 0.48;
      startFreq = 460;
      peakFreq = 840;
      endFreq = 430;
      break;
  }

  // Dual tone generator (vocal cords harmonic richness)
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  osc1.type = 'triangle';
  osc2.type = 'sawtooth';

  // Pitch envelope
  const pTime = now + duration * 0.32;
  osc1.frequency.setValueAtTime(startFreq, now);
  osc1.frequency.exponentialRampToValueAtTime(peakFreq, pTime);
  osc1.frequency.exponentialRampToValueAtTime(endFreq, now + duration);

  osc2.frequency.setValueAtTime(startFreq * 2.01, now);
  osc2.frequency.exponentialRampToValueAtTime(peakFreq * 1.98, pTime);
  osc2.frequency.exponentialRampToValueAtTime(endFreq * 2.01, now + duration);

  // Formant bandpass filters mimicking feline oral cavity
  const formant = ctx.createBiquadFilter();
  formant.type = 'bandpass';
  formant.frequency.setValueAtTime(1450, now);
  formant.frequency.linearRampToValueAtTime(1850, pTime);
  formant.frequency.linearRampToValueAtTime(1200, now + duration);
  formant.Q.setValueAtTime(3.2, now);

  const gain = ctx.createGain();
  // Amplitude envelope (gentle attack, sustained vowel, soft decay)
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(volume * 0.45, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(volume * 0.35, pTime);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc1.connect(formant);
  osc2.connect(formant);
  formant.connect(gain);
  gain.connect(masterGain);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + duration);
  osc2.stop(now + duration);
}

/**
 * Starts continuous soothing cat purring (low-frequency rhythmic modulation).
 */
export function startCatPurr(volume = 0.35): void {
  if (activePurrGain) return; // already purring
  const ctx = getCatAudioContext();
  if (!ctx || ctx.state !== 'running') return;

  const now = ctx.currentTime;
  const purrGain = ctx.createGain();
  purrGain.gain.setValueAtTime(0.001, now);
  purrGain.gain.linearRampToValueAtTime(volume * 0.4, now + 0.3);
  purrGain.connect(ctx.destination);

  // Base low frequency tone (~72 Hz)
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(74, now);

  // LFO for rhythmic purr fluttering (~26 Hz modulation)
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.setValueAtTime(26, now);
  lfoGain.gain.setValueAtTime(0.7, now);

  lfo.connect(lfoGain.gain);
  osc.connect(purrGain);

  osc.start(now);
  lfo.start(now);

  activePurrOsc = osc;
  activePurrLfo = lfo;
  activePurrGain = purrGain;
}

/**
 * Smoothly fades out and stops active purring.
 */
export function stopCatPurr(): void {
  if (!activePurrGain || !catAudioCtx) return;
  const now = catAudioCtx.currentTime;
  const gain = activePurrGain;
  const osc = activePurrOsc;
  const lfo = activePurrLfo;

  activePurrGain = null;
  activePurrOsc = null;
  activePurrLfo = null;

  try {
    gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
    setTimeout(() => {
      try {
        osc?.stop();
        lfo?.stop();
        gain.disconnect();
      } catch {}
    }, 350);
  } catch {}
}
