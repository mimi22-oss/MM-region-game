import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import {
  BOT_FIGHT_LONG_PRESS_MS,
  BOT_FIGHT_MOVE_META,
  BOX_MOVES,
  KICK_MOVES,
  disengageBotFight,
  getBotFightingState,
  subscribeBotFighting,
  triggerBotFightMove,
  type BotFightKind,
  type BotFightMoveId,
} from '../game/botFighting';
import { playSpecialAction } from '../game/specialActions';
import { usePlayerDeathState } from '../game/playerDeath';

export interface BotFightControlsProps {
  disabled?: boolean;
  onInteract?: () => void;
}

/**
 * Floating Fight Box & Kick action icons shown immediately when the player bumps into a bot.
 * - Default moves: Box 01 (`box_01`) & Kick 01 (`front_kick_01`).
 * - Short tap/click executes the active move right away.
 * - Long press (>= 420ms) opens the 01 / 02 move picker (`box_02`, `front_kick_02`, etc.)
 *   so the player can switch variants and fight immediately.
 */
export function BotFightControls({ disabled = false, onInteract }: BotFightControlsProps) {
  const fight = useSyncExternalStore(
    subscribeBotFighting,
    getBotFightingState,
    getBotFightingState,
  );
  const playerDeath = usePlayerDeathState();
  const [openMenu, setOpenMenu] = useState<BotFightKind | null>(null);
  const [holdingKind, setHoldingKind] = useState<BotFightKind | null>(null);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const activePointerRef = useRef<number | null>(null);

  const clearHold = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    activePointerRef.current = null;
    setHoldingKind(null);
  }, []);

  // Close picker cleanly if fighting disengages or HUD becomes disabled
  useEffect(() => {
    if (!fight.active || disabled) {
      clearHold();
      setOpenMenu(null);
    }
  }, [fight.active, disabled, clearHold]);

  useEffect(() => () => clearHold(), [clearHold]);

  const executeMove = useCallback(
    (kind: BotFightKind, overrideMove?: BotFightMoveId) => {
      const result = triggerBotFightMove(kind, overrideMove);
      if (result.ok) {
        playSpecialAction(result.moveId, { loop: false, force: true, restart: true });
      }
      setOpenMenu(null);
      onInteract?.();
    },
    [onInteract],
  );

  const handleButtonPointerDown = (kind: BotFightKind) => (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    clearHold();

    longPressTriggeredRef.current = false;
    activePointerRef.current = e.pointerId;
    setHoldingKind(kind);

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore pointer capture errors on unsupported devices
    }

    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      longPressTriggeredRef.current = true;
      setHoldingKind(null);
      setOpenMenu((prev) => (prev === kind ? null : kind));
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(25);
        } catch {
          // Ignore vibration permission errors
        }
      }
    }, BOT_FIGHT_LONG_PRESS_MS);
  };

  const handleButtonPointerUp = (kind: BotFightKind) => (e: PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();
    const wasLongPress = longPressTriggeredRef.current;
    clearHold();
    if (!wasLongPress) {
      executeMove(kind);
    }
  };

  const handleButtonCancel = (e: PointerEvent<HTMLButtonElement>) => {
    if (activePointerRef.current === e.pointerId) {
      clearHold();
    }
  };

  if (disabled || !fight.active || playerDeath.phase !== 'alive') return null;

  const boxMeta = BOT_FIGHT_MOVE_META[fight.selectedBox];
  const kickMeta = BOT_FIGHT_MOVE_META[fight.selectedKick];
  const hpPct = Math.max(0, Math.min(100, Math.round((fight.targetHp / fight.targetMaxHp) * 100)));
  const playerHpPct = Math.max(
    0,
    Math.min(100, Math.round((fight.playerHp / fight.playerMaxHp) * 100)),
  );

  return (
    <>
      {/* Status HUD Card positioned directly below .location-toast */}
      <div
        className="bot-fight-hud"
        role="region"
        aria-label="Bot Fighting Status"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="bot-fight-target-pill">
          <div className="bot-fight-target-top">
            <span className="bot-fight-target-name">🥊 {fight.targetLabel}</span>
            <span className="bot-fight-target-hp-text">
              {fight.targetKnockedOut ? 'KO!' : `${fight.targetHp}/${fight.targetMaxHp}`}
            </span>
            <button
              type="button"
              className="bot-fight-close-btn"
              aria-label="Fighting ပိတ်မည်"
              title="ပိတ်မည်"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpenMenu(null);
                disengageBotFight();
              }}
              onClick={(e) => {
                if (e.detail === 0) {
                  setOpenMenu(null);
                  disengageBotFight();
                }
              }}
            >
              ✕
            </button>
          </div>
          <div className="bot-fight-hp-track" aria-hidden="true">
            <div
              className={`bot-fight-hp-fill${fight.targetKnockedOut ? ' is-ko' : ''}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>

          {/* Player HP Row (Bot fights back at 2x speed!) */}
          <div className="bot-fight-player-row">
            <span className="bot-fight-player-label">🧑 မိမိ</span>
            {fight.botActiveMoveLabel && (
              <span className="bot-fight-bot-move-pill">{fight.botActiveMoveLabel}</span>
            )}
            <span className="bot-fight-player-hp-text">
              {fight.playerKnockedOut ? 'KO!' : `${fight.playerHp}/${fight.playerMaxHp}`}
            </span>
          </div>
          <div className="bot-fight-hp-track" aria-hidden="true">
            <div
              className={`bot-fight-hp-fill is-player${fight.playerKnockedOut ? ' is-ko' : ''}`}
              style={{ width: `${playerHpPct}%` }}
            />
          </div>

          {fight.defenderCount > 0 && (
            <div className="bot-fight-defender-alert" role="status">
              🛡️ ကလေးငယ်ကို ကူညီရန် Bot {fight.defenderCount} ဦး ဝိုင်းတိုက်နေသည်
            </div>
          )}

          {fight.lastHitText && (
            <div key={`p-${fight.comboFlashSeq}`} className="bot-fight-hit-toast" role="status">
              {fight.lastHitText}
            </div>
          )}
          {fight.lastBotHitText && (
            <div
              key={`b-${fight.playerHitSeq}`}
              className="bot-fight-hit-toast is-bot-hit"
              role="status"
            >
              {fight.lastBotHitText}
            </div>
          )}
        </div>
      </div>

      {/* Fight Box & Kick Action Buttons Dock positioned beside .mobile-sprint-btn on the right */}
      <div
        className="bot-fight-action-dock"
        role="region"
        aria-label="Bot Fighting Controls"
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/* Long-Press Variant Picker Popover (Box 01/02 or Kick 01/02) */}
        {openMenu && (
          <div
            className="bot-fight-variant-menu"
            role="menu"
            aria-label={openMenu === 'box' ? 'Box move variant picker' : 'Kick move variant picker'}
          >
            <div className="bot-fight-variant-title">
              {openMenu === 'box' ? '🥊 လက်သီးပုံစံ ရွေးပါ' : '🦵 ကန်ချက်ပုံစံ ရွေးပါ'}
            </div>
            <div className="bot-fight-variant-list">
              {(openMenu === 'box' ? BOX_MOVES : KICK_MOVES).map((moveId) => {
                const meta = BOT_FIGHT_MOVE_META[moveId];
                const isSelected =
                  openMenu === 'box' ? fight.selectedBox === moveId : fight.selectedKick === moveId;
                return (
                  <button
                    key={moveId}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isSelected}
                    className={`bot-fight-variant-option${isSelected ? ' is-selected' : ''}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      executeMove(openMenu, moveId);
                    }}
                    onClick={(e) => {
                      if (e.detail === 0) executeMove(openMenu, moveId);
                    }}
                  >
                    <span className="bot-fight-variant-code">{meta.shortLabel}</span>
                    <span className="bot-fight-variant-mm">{meta.myanmarLabel}</span>
                    <span className="bot-fight-variant-dmg">-{meta.damage}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Fight Box & Kick Action Icons */}
        <div className="bot-fight-buttons">
          {/* Fight Box Icon */}
          <button
            type="button"
            className={`bot-fight-btn bot-fight-btn-box${
              fight.activeMove === 'box_01' || fight.activeMove === 'box_02' ? ' is-striking' : ''
            }${holdingKind === 'box' ? ' is-holding' : ''}${openMenu === 'box' ? ' is-menu-open' : ''}`}
            aria-label={`Fight ${boxMeta.shortLabel} (${boxMeta.myanmarLabel}) — ဖိထားပါက Box 01/02 ရွေးနိုင်သည်`}
            title="နှိပ်: Box ထိုးမည် · ဖိထား (Long Press): Box 01 / Box 02 ရွေးမည်"
            onPointerDown={handleButtonPointerDown('box')}
            onPointerUp={handleButtonPointerUp('box')}
            onPointerCancel={handleButtonCancel}
            onLostPointerCapture={handleButtonCancel}
            onClick={(e) => {
              if (e.detail === 0) executeMove('box');
            }}
          >
            <span className="bot-fight-btn-badge">{boxMeta.badge}</span>
            <span className="bot-fight-btn-icon" aria-hidden="true">
              🥊
            </span>
            <span className="bot-fight-btn-label">{boxMeta.shortLabel}</span>
          </button>

          {/* Fight Kick Icon */}
          <button
            type="button"
            className={`bot-fight-btn bot-fight-btn-kick${
              fight.activeMove === 'front_kick_01' || fight.activeMove === 'front_kick_02'
                ? ' is-striking'
                : ''
            }${holdingKind === 'kick' ? ' is-holding' : ''}${openMenu === 'kick' ? ' is-menu-open' : ''}`}
            aria-label={`Fight ${kickMeta.shortLabel} (${kickMeta.myanmarLabel}) — ဖိထားပါက Kick 01/02 ရွေးနိုင်သည်`}
            title="နှိပ်: Kick ကန်မည် · ဖိထား (Long Press): Kick 01 / Kick 02 ရွေးမည်"
            onPointerDown={handleButtonPointerDown('kick')}
            onPointerUp={handleButtonPointerUp('kick')}
            onPointerCancel={handleButtonCancel}
            onLostPointerCapture={handleButtonCancel}
            onClick={(e) => {
              if (e.detail === 0) executeMove('kick');
            }}
          >
            <span className="bot-fight-btn-badge">{kickMeta.badge}</span>
            <span className="bot-fight-btn-icon" aria-hidden="true">
              🦵
            </span>
            <span className="bot-fight-btn-label">{kickMeta.shortLabel}</span>
          </button>
        </div>

        <div className="bot-fight-hint">နှိပ်: တိုက် · ဖိထား: 01 / 02 ရွေး</div>
      </div>
    </>
  );
}
