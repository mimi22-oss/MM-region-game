import { useEffect } from 'react';
import { requestPlayerRespawn, usePlayerDeathState } from '../game/playerDeath';
import { getBotFightingState } from '../game/botFighting';

export function GhostGameOver() {
  const state = usePlayerDeathState();

  // Release pointer lock cleanly when Game Over opens so the user can immediately click Restart
  useEffect(() => {
    if (state.phase !== 'alive' && typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [state.phase]);

  if (state.phase === 'alive') return null;

  const isZombie = Boolean(state.ghostId?.startsWith('zombie-'));
  const isBotFight = Boolean(state.ghostId?.startsWith('bot-fight:'));
  const isBridgeFall = Boolean(state.ghostId?.startsWith('bridge-fall:'));
  const isRespawning = state.phase === 'respawning';
  const fight = isBotFight ? getBotFightingState() : null;
  const fallMeta = isBridgeFall ? state.fallMeta : null;
  const fallModeLabel =
    fallMeta?.mode === 'motorcycle'
      ? '🏍️ ဆိုင်ကယ်'
      : fallMeta?.mode === 'horse'
        ? '🐎 မြင်းစီး'
        : fallMeta?.mode === 'car'
          ? '🚗 ကား'
          : '🚶 လမ်းလျှောက်';

  const variant = isBridgeFall
    ? 'bridge-fall'
    : isBotFight
      ? 'bot-fight'
      : isZombie
        ? 'zombie'
        : 'ghost';

  const badgeText = isBridgeFall
    ? 'BRIDGE FALL · တံတားပေါ်မှ ပြုတ်ကျခြင်း'
    : isBotFight
      ? 'KNOCKOUT · HP 0 / 100'
      : isZombie
        ? 'ZOMBIE OVERRUN'
        : 'GHOST CAPTURED';

  const subtitle = isBridgeFall
    ? 'တံတားကနေ တောင်အောက်သို့ ပြုတ်ကျသွားပါပြီ'
    : isBotFight
      ? 'တိုက်ပွဲ ရှုံးနိမ့်သွားပါပြီ'
      : isZombie
        ? 'Zombie တိုက်ခိုက်ခံရပါပြီ'
        : 'သရဲဖမ်းမိသွားပါပြီ';

  const message = isBridgeFall
    ? 'တောင်တက်တံတားပေါ်မှ တောင်အောက်သို့ ပြုတ်ကျသွားသဖြင့် ဂိမ်းပြီးဆုံးသွားပါပြီ။ အိမ် Safe Zone မှ ပြန်လည်စတင်နိုင်ပါသည်။'
    : isBotFight
      ? 'Bot နှင့် တိုက်ခိုက်ရာတွင် HP 100 မှ 0 သို့ ကုန်သွားပြီး လဲကျသွားပါပြီ။ အိမ် Safe Zone မှ ပြန်လည်စတင်နိုင်ပါသည်။'
      : isZombie
        ? 'Zombie တိုက်ခိုက်ခံရသဖြင့် Heart Life ၃ ခုလုံး ကုန်သွားပါပြီ။ အိမ် Safe Zone တွင် မူလကနေ ပြန်စနိုင်ပါတယ်။'
        : 'သရဲဖမ်းမိသွားပါပြီ။ အိမ် Safe Zone တွင် ပြန်လည်စတင်နိုင်ပါသည်။';

  const btnLabel = isRespawning
    ? 'ပြန်လည်စတင်နေသည်…'
    : isBotFight || isBridgeFall
      ? 'အစမှ ပြန်စမည် · Restart'
      : 'အိမ်တွင် ပြန်စမည် · Respawn';

  return (
    <div
      className={`game-over-overlay game-over-overlay--${variant}`}
      role="dialog"
      aria-modal="true"
      aria-label="Game Over"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="game-over-vignette" aria-hidden="true" />
      <section className="game-over-card">
        <div className="game-over-top-glow" aria-hidden="true" />

        <div className="game-over-hero">
          {/* Contextual Emblem */}
          <div className="game-over-emblem" aria-hidden="true">
            <div className="game-over-emblem-ring" />
            <span className="game-over-emblem-icon">
              {isBridgeFall ? '⛰️' : isBotFight ? '🥊' : isZombie ? '☣️' : '👻'}
            </span>
          </div>

          {/* Status Pill */}
          <div className="game-over-badge">{badgeText}</div>

          {/* Title & Subtitle */}
          <h1 className="game-over-title">GAME OVER</h1>
          <div className="game-over-subtitle">{subtitle}</div>
        </div>

        <div className="game-over-divider" aria-hidden="true" />

        <div className="game-over-body">
          {/* Message */}
          <p className="game-over-message">{message}</p>

          {/* Contextual Summary Stats */}
          <div className="game-over-stats" aria-label="Battle Summary">
            {isBridgeFall ? (
              <>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">ပြုတ်ကျအမြင့်</span>
                  <strong className="game-over-stat-value is-danger">
                    {fallMeta ? `${fallMeta.dropMeters} m` : 'တောင်အောက်'}
                  </strong>
                </div>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">သွားလာမှု</span>
                  <strong className="game-over-stat-value">{fallModeLabel}</strong>
                </div>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">ပြန်စမည့်နေရာ</span>
                  <strong className="game-over-stat-value">🏡 အိမ် Safe Zone</strong>
                </div>
              </>
            ) : isBotFight && fight ? (
              <>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">ပြိုင်ဘက်</span>
                  <strong className="game-over-stat-value">{fight.targetLabel}</strong>
                </div>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">မိမိ HP</span>
                  <strong className="game-over-stat-value is-danger">0 / {fight.playerMaxHp}</strong>
                </div>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">ထိချက်</span>
                  <strong className="game-over-stat-value">{fight.hitCount} ချက်</strong>
                </div>
              </>
            ) : (
              <>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">အခြေအနေ</span>
                  <strong className="game-over-stat-value is-danger">
                    {isZombie ? 'Life 0 / 3' : 'Caught'}
                  </strong>
                </div>
                <div className="game-over-stat">
                  <span className="game-over-stat-label">ပြန်စမည့်နေရာ</span>
                  <strong className="game-over-stat-value">🏡 အိမ် Safe Zone</strong>
                </div>
              </>
            )}
          </div>

          {/* Primary Action CTA */}
          <button
            type="button"
            className="game-over-restart-btn"
            disabled={isRespawning}
            onClick={requestPlayerRespawn}
          >
            {isRespawning ? (
              <span className="game-over-spinner" aria-hidden="true" />
            ) : (
              <svg
                className="game-over-btn-icon"
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            )}
            <span>{btnLabel}</span>
          </button>

          <div className="game-over-footer-note">
            HP နှင့် Life အပြည့်ဖြင့် အိမ်အစနေရာမှ ပြန်လည်စတင်ပါမည်
          </div>
        </div>
      </section>
    </div>
  );
}
