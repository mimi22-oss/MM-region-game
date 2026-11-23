import {
  WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES,
  WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES,
  WEAPON_KNIFE_DRAW_AUDIO_FILES,
  WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES,
  WEAPON_KNIFE_HIT_AUDIO_FILES,
  WEAPON_KNIFE_SLICE_AUDIO_FILES,
  loadSfxBuffer,
  pickCachedSfxBuffer,
  preloadSfxBuffers,
} from '../audio/sfxBufferCache.ts';
import { gameAudio } from '../gameAudio.ts';

/**
 * Sword / Knife & Enemy Impact Combat SFX Player
 * (`လက်ဗလာမှ ဓားထုတ်သံ ၊ ဓားခုတ်သံ ၊ အားပြင်းမြေကျသံ ၊ ဓားထိသံ နှင့် Ghost/Zombie ရိုက်ထိသံ`)
 * Uses the anti-IDM `.mta` Singleton buffer cache + shared `gameAudio.master` bus.
 */

const ALL_SWORD_SFX = [
  ...WEAPON_KNIFE_DRAW_AUDIO_FILES,
  ...WEAPON_KNIFE_SLICE_AUDIO_FILES,
  ...WEAPON_KNIFE_HIT_AUDIO_FILES,
  ...WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES,
  ...WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES,
  ...WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES,
] as const;

export function preloadSwordAudio(): void {
  preloadSfxBuffers(gameAudio.context, ALL_SWORD_SFX);
}

function playSwordSample(
  files: readonly string[],
  volume: number,
  pitchMin: number,
  pitchMax: number,
): void {
  if (typeof window === 'undefined') return;
  if (!gameAudio.isActive()) return;

  const ctx = gameAudio.context;
  const out = gameAudio.master;
  if (!ctx || !out) {
    preloadSfxBuffers(null, files);
    return;
  }

  const startBuffer = (buffer: AudioBuffer) => {
    if (!gameAudio.isActive() || ctx.state !== 'running') return;
    try {
      const now = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = pitchMin + Math.random() * (pitchMax - pitchMin);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, now);
      src.connect(gain).connect(out);
      src.onended = () => {
        try {
          src.disconnect();
          gain.disconnect();
        } catch {}
      };
      src.start(now);
    } catch {
      // Ignore audio errors so combat remains uninterrupted
    }
  };

  if (ctx.state !== 'running') {
    preloadSfxBuffers(ctx, files);
    return;
  }

  const cached = pickCachedSfxBuffer(ctx, files);
  if (cached) {
    startBuffer(cached);
    return;
  }

  // First-time cold play: load & play once decoded if fast enough
  const firstFile = files[0];
  if (firstFile) {
    void loadSfxBuffer(ctx, firstFile).then((buf) => {
      if (buf) startBuffer(buf);
    });
  }
}

/** လက်ဗလာကနေ ဓားထုတ်သံ (`oxidvideos-pulling-out-a-knife-sfx-472241`) */
export function playKnifeDrawSound(): void {
  playSwordSample(WEAPON_KNIFE_DRAW_AUDIO_FILES, 0.85, 0.98, 1.04);
}

/** ဓားနဲ့ခုတ်သံ (`freesound_community-knife-slice-41231`) */
export function playKnifeSliceSound(): void {
  playSwordSample(WEAPON_KNIFE_SLICE_AUDIO_FILES, 0.82, 0.95, 1.07);
}

/** Ghost / Zombie တို့ကို ဓားဖြင့်ခုတ်မိသံ (`freesound_community-slashkut-108175`) */
export function playKnifeHitSound(): void {
  playSwordSample(WEAPON_KNIFE_HIT_AUDIO_FILES, 0.92, 0.96, 1.06);
}

/** အားပြင်းခုတ် (`Heavy_Slash`) မြေကြီးပေါ်ကျသည့်အချိန် အသံ (`olivia_parker-knife-demo-309903`) */
export function playHeavySlashGroundSound(): void {
  playSwordSample(WEAPON_KNIFE_HEAVY_SLAM_AUDIO_FILES, 0.92, 0.97, 1.03);
}

/** Zombie တို့က Player Character ကို ရိုက်မိသည့်အချိန် အသံ (`universfield-cinematic-impact-hit-02-454665`) */
export function playEnemyHitPlayerSound(): void {
  playSwordSample(WEAPON_ENEMY_HIT_PLAYER_AUDIO_FILES, 0.95, 0.97, 1.04);
}

/** Ghost / Zombie ရိုက်ထိလိုက်သည့်အချိန် အသံ (`universfield-punch-03-352040`) */
export function playGhostHitPlayerSound(): void {
  playSwordSample(WEAPON_GHOST_HIT_PLAYER_AUDIO_FILES, 0.98, 0.97, 1.04);
}
