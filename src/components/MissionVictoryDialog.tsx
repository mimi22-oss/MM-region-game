import { useEffect, useRef, useState } from 'react';
import {
  GHOST_IDS,
  useThreeGhostsMission,
} from '../game/missions/threeGhostsMission';
import {
  ZOMBIE_COUNT,
  useZombieForestMission,
} from '../game/missions/zombieForestMission';
import { playSpecialAction } from '../game/specialActions';
import {
  detectMissionVictoryTransition,
  resetGhostMissionForReplay,
  resetZombieMissionForReplay,
  type VictoryMissionKind,
} from '../game/missions/missionVictory';

export { detectMissionVictoryTransition, type VictoryMissionKind };

const VICTORY_POPUP_DELAY_MS = 650;

/**
 * Celebratory Mission Victory Dialog shown automatically when:
 * 1) All 3 Ghosts are defeated (`Ghost Mission Victory`), or
 * 2) All 13 Zombies in the forest are defeated (`Zombie Mission Victory`).
 */
export function MissionVictoryDialog() {
  const ghostProgress = useThreeGhostsMission();
  const zombieMission = useZombieForestMission();

  const [activeVictory, setActiveVictory] = useState<VictoryMissionKind | null>(null);
  const prevGhostCompletedRef = useRef<boolean>(ghostProgress.completed);
  const prevZombieCompletedRef = useRef<boolean>(zombieMission.completed);
  const pendingTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const triggered = detectMissionVictoryTransition(
      prevGhostCompletedRef.current,
      ghostProgress.completed,
      prevZombieCompletedRef.current,
      zombieMission.completed,
    );
    prevGhostCompletedRef.current = ghostProgress.completed;
    prevZombieCompletedRef.current = zombieMission.completed;

    if (!triggered) return;

    if (pendingTimerRef.current !== null) {
      window.clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }

    // Play character victory animation briefly while the victory dialog appears
    try {
      playSpecialAction('victory', { loop: false, force: true, restart: true });
    } catch {
      // Non-GLB or non-browser environments safely ignore
    }

    pendingTimerRef.current = window.setTimeout(() => {
      pendingTimerRef.current = null;
      setActiveVictory(triggered);
    }, VICTORY_POPUP_DELAY_MS);
  }, [ghostProgress.completed, zombieMission.completed]);

  useEffect(
    () => () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    },
    [],
  );

  // Release pointer lock & support Escape to close
  useEffect(() => {
    if (!activeVictory) return;
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setActiveVictory(null);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [activeVictory]);

  if (!activeVictory) return null;

  const isZombie = activeVictory === 'zombie';
  const close = () => setActiveVictory(null);

  const badgeText = isZombie
    ? `ZOMBIE MISSION COMPLETE · ${ZOMBIE_COUNT} / ${ZOMBIE_COUNT}`
    : `GHOST MISSION COMPLETE · ${GHOST_IDS.length} / ${GHOST_IDS.length}`;

  const subtitle = isZombie
    ? `Zombie ${ZOMBIE_COUNT} ကောင်လုံး နှိမ်နင်းပြီးပါပြီ!`
    : 'သရဲ ၃ ကောင်လုံး နှိမ်နင်းပြီးပါပြီ!';

  const message = isZombie
    ? `သစ်တောအုပ်အတွင်းရှိ Zombie ${ZOMBIE_COUNT} ကောင်လုံးကို အောင်မြင်စွာ ရှင်းလင်းနိုင်ခဲ့ပါပြီ။ Zombie Gun သေနတ်လက်နက်ကို လွတ်လပ်စွာ အသုံးပြုနိုင်ပါပြီ။`
    : 'မြို့သာရပ်ကွက်မှ သရဲ ၃ ကောင်လုံးကို အောင်မြင်စွာ နှိမ်နင်းနိုင်ခဲ့ပါပြီ။ ကားစီးနင်းခွင့်၊ ဓားလက်နက် အမြဲသုံးခွင့်နှင့် Zombie Forest Mission တို့ ဖွင့်လှစ်ပြီးပါပြီ။';

  return (
    <div
      className={`mission-victory-overlay mission-victory-overlay--${activeVictory}`}
      role="dialog"
      aria-modal="true"
      aria-label={isZombie ? 'Zombie Mission Victory' : 'Ghost Mission Victory'}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) close();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="mission-victory-vignette" aria-hidden="true" />
      <section className="mission-victory-card">
        <div className="mission-victory-top-glow" aria-hidden="true" />

        <button
          type="button"
          className="mission-victory-close"
          aria-label="ပိတ်မည်"
          onClick={close}
        >
          ✕
        </button>

        {/* Celebratory Trophy Emblem */}
        <div className="mission-victory-emblem" aria-hidden="true">
          <div className="mission-victory-emblem-ring" />
          <span className="mission-victory-emblem-icon">🏆</span>
        </div>

        {/* Status Pill */}
        <div className="mission-victory-badge">{badgeText}</div>

        {/* Title & Subtitle */}
        <h1 className="mission-victory-title">VICTORY!</h1>
        <div className="mission-victory-subtitle">{subtitle}</div>

        <div className="mission-victory-divider" aria-hidden="true" />

        {/* Message */}
        <p className="mission-victory-message">{message}</p>

        {/* Rewards / Mission Summary */}
        <div className="mission-victory-stats" aria-label="Mission Rewards">
          {isZombie ? (
            <>
              <div className="mission-victory-stat">
                <span className="mission-victory-stat-label">နှိမ်နင်းပြီး</span>
                <strong className="mission-victory-stat-value is-gold">
                  🧟 {ZOMBIE_COUNT} / {ZOMBIE_COUNT}
                </strong>
              </div>
              <div className="mission-victory-stat">
                <span className="mission-victory-stat-label">ရရှိသည့် ဆု</span>
                <strong className="mission-victory-stat-value is-emerald">🔫 Zombie Gun</strong>
              </div>
              <div className="mission-victory-stat">
                <span className="mission-victory-stat-label">အဆင့်</span>
                <strong className="mission-victory-stat-value">⭐ Master</strong>
              </div>
            </>
          ) : (
            <>
              <div className="mission-victory-stat">
                <span className="mission-victory-stat-label">နှိမ်နင်းပြီး</span>
                <strong className="mission-victory-stat-value is-gold">
                  👻 {GHOST_IDS.length} / {GHOST_IDS.length}
                </strong>
              </div>
              <div className="mission-victory-stat">
                <span className="mission-victory-stat-label">ဖွင့်လှစ်ပြီး</span>
                <strong className="mission-victory-stat-value is-emerald">🚗 ကား · ⚔️ ဓား</strong>
              </div>
              <div className="mission-victory-stat">
                <span className="mission-victory-stat-label">နောက် Mission</span>
                <strong className="mission-victory-stat-value">🧟 Zombie Forest</strong>
              </div>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mission-victory-actions">
          <button
            type="button"
            className="mission-victory-primary-btn"
            onClick={close}
          >
            <span>{isZombie ? '🔫 ဆက်လက်ကစားမည် · Continue' : '✨ ဆက်လက်ကစားမည် · Continue'}</span>
          </button>

          {isZombie ? (
            <button
              type="button"
              className="mission-victory-secondary-btn"
              onClick={() => {
                resetZombieMissionForReplay();
                close();
              }}
            >
              🔄 Zombie Mission ပြန်စမည် (Reset)
            </button>
          ) : (
            <button
              type="button"
              className="mission-victory-secondary-btn"
              onClick={() => {
                resetGhostMissionForReplay();
                close();
              }}
            >
              🔄 Mission 1 ပြန်စမည် (Reset)
            </button>
          )}
        </div>

        <div className="mission-victory-footer-note">
          {isZombie
            ? 'Mission အားလုံး အောင်မြင်စွာ ပြီးဆုံးသွားပါပြီ — ဂုဏ်ယူပါတယ်!'
            : 'မြို့သာသစ်တောအုပ်တွင် Zombie Forest Mission ကို ဆက်လက်ကစားနိုင်ပါပြီ!'}
        </div>
      </section>
    </div>
  );
}
