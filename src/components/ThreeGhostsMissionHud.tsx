import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  GHOST_IDS,
  GHOST_STATS,
  getActiveMissionWeapon,
  selectMissionWeapon,
  setZombieForestSwordActive,
  useThreeGhostsMission,
} from '../game/missions/threeGhostsMission';
import {
  ZOMBIE_COUNT,
  rerollZombieForestWave,
  useZombieForestMission,
} from '../game/missions/zombieForestMission';
import {
  resetGhostMissionForReplay,
  resetZombieMissionForReplay,
} from '../game/missions/missionVictory';
import { requestGunShot } from '../game/combat/gunCombatRuntime';
import { ghostMissionProximity, requestThreeGhostsAction } from './ThreeGhostsMissionScene';
import { CombatControls } from './combat/CombatControls';
import './ThreeGhostsMissionHud.css';

const GhostDevMap = import.meta.env.DEV ? lazy(() => import('./GhostDevMap')) : null;

const STORAGE_COLLAPSED_KEY = 'mm-ghost-hud-collapsed-v2';
const STORAGE_POS_KEY = 'mm-ghost-hud-pos-v3';

type MissionModalId = 'ghost' | 'zombie' | null;

interface Position {
  x: number;
  y: number;
}

export function ThreeGhostsMissionHud() {
  const progress = useThreeGhostsMission();
  const zombieMission = useZombieForestMission();
  const activeWeapon = getActiveMissionWeapon();
  const [pickup, setPickup] = useState({ near: false, ready: false, progress: 0 });
  const [message, setMessage] = useState('');
  const [activeModal, setActiveModal] = useState<MissionModalId>(null);

  // Initial collapsed state: default collapsed (ghost-hud-body hidden until clicked)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      const stored = localStorage.getItem(STORAGE_COLLAPSED_KEY);
      if (stored !== null) return stored === 'true';
      return true;
    } catch {
      return true;
    }
  });
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth <= 768);

  // Draggable positioning state
  const [position, setPosition] = useState<Position | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_POS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Position;
        if (Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) {
          return parsed;
        }
      }
    } catch {
      // storage disabled/restricted
    }
    return null;
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    active: boolean;
    hasMoved: boolean;
    startX: number;
    startY: number;
    elemStartX: number;
    elemStartY: number;
    pointerId: number;
  }>({
    active: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    pointerId: -1,
  });

  // Periodically sync proximity & messages
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPickup(previous =>
        previous.near === ghostMissionProximity.nearSword &&
        previous.ready === ghostMissionProximity.pickupReady &&
        previous.progress === ghostMissionProximity.pickupProgress
          ? previous
          : {
              near: ghostMissionProximity.nearSword,
              ready: ghostMissionProximity.pickupReady,
              progress: ghostMissionProximity.pickupProgress,
            }
      );
      setMessage(ghostMissionProximity.lastMessage);
    }, 250);
    return () => window.clearInterval(timer);
  }, []);

  // Close mission detail dialog on Escape
  useEffect(() => {
    if (!activeModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setActiveModal(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal]);

  const openMissionModal = useCallback((id: Exclude<MissionModalId, null>) => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    setActiveModal(id);
  }, []);

  // Save collapsed preference
  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next));
      } catch {
        // storage quota/privacy fail
      }
      return next;
    });
  }, []);

  // Clamping helper to prevent dragging off-screen
  const clampPosition = useCallback((x: number, y: number): Position => {
    if (typeof window === 'undefined') return { x, y };
    const margin = 8;
    const elemWidth = containerRef.current?.offsetWidth ?? 288;
    const elemHeight = containerRef.current?.offsetHeight ?? 60;
    const maxX = Math.max(margin, window.innerWidth - elemWidth - margin);
    const maxY = Math.max(margin, window.innerHeight - elemHeight - margin);
    return {
      x: Math.min(Math.max(margin, x), maxX),
      y: Math.min(Math.max(margin, y), maxY),
    };
  }, []);

  // Keep within bounds on window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
      setPosition(prev => (prev ? clampPosition(prev.x, prev.y) : null));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Pointer drag event handlers
  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragRef.current = {
      active: true,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: rect.left,
      elemStartY: rect.top,
      pointerId: e.pointerId,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore capture failures
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.hasMoved && Math.hypot(dx, dy) > 5) {
      drag.hasMoved = true;
    }

    if (drag.hasMoved) {
      const nextX = drag.elemStartX + dx;
      const nextY = drag.elemStartY + dy;
      setPosition(clampPosition(nextX, nextY));
    }
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag.active || drag.pointerId !== e.pointerId) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (!drag.hasMoved) {
      toggleCollapse();
    } else if (position) {
      try {
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(position));
      } catch {
        // ignore
      }
    }

    drag.active = false;
    drag.hasMoved = false;
  };

  const handlePointerCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.active && drag.pointerId === e.pointerId) {
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      drag.active = false;
      drag.hasMoved = false;
    }
  };

  // Derived mission metrics
  const totalEncountered = progress.encountered.length;
  const isAllEncountered = totalEncountered === 3;
  const isCombatActive = progress.swordCollected && !progress.completed;
  const ghostsDefeatedCount = GHOST_IDS.filter(id => progress.hp[id] === 0).length;
  const ghostProgressPct = progress.completed
    ? 100
    : progress.swordCollected
      ? Math.round(50 + (ghostsDefeatedCount / 3) * 50)
      : Math.round((totalEncountered / 3) * 45);
  const zombieUnlocked = progress.completed;
  const zombieCompleted = zombieUnlocked && zombieMission.gunUnlocked;
  const zombieProgressPct = zombieUnlocked
    ? Math.round((zombieMission.defeatedCount / ZOMBIE_COUNT) * 100)
    : 0;
  const completedMissionsCount = (progress.completed ? 1 : 0) + (zombieCompleted ? 1 : 0);

  // Inline positioning style (positioned above location-toast at left: 25px, top: 12px)
  const style: React.CSSProperties = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : {
        left: 'max(25px, calc(env(safe-area-inset-left, 0px) + 25px))',
        top: 'max(12px, calc(env(safe-area-inset-top, 0px) + 12px))',
      };

  const modalPortal =
    activeModal && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="mission-modal-backdrop"
            role="presentation"
            onPointerDown={e => {
              e.stopPropagation();
              if (e.target === e.currentTarget) {
                setActiveModal(null);
              }
            }}
            onWheel={e => e.stopPropagation()}
          >
            <div
              className={`mission-modal-dialog mission-modal-${activeModal}`}
              role="dialog"
              aria-modal="true"
              aria-labelledby="mission-modal-title"
              onPointerDown={e => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="mission-modal-header">
                <div className="mission-modal-title-group">
                  <span className="mission-modal-icon" aria-hidden="true">
                    {activeModal === 'ghost' ? '👻' : '🧟'}
                  </span>
                  <div>
                    <h2 id="mission-modal-title" className="mission-modal-title">
                      {activeModal === 'ghost' ? 'Ghost Mission' : 'Zombie Mission'}
                    </h2>
                    <span className="mission-modal-subtitle">
                      {activeModal === 'ghost'
                        ? 'သရဲ ၃ ကောင် ရှာဖွေနှိမ်နင်းရေး လမ်းညွှန်'
                        : 'သစ်တောအုပ် Zombie ၁၃ ကောင် နှိမ်နင်းရေး လမ်းညွှန်'}
                    </span>
                  </div>
                </div>

                <div className="mission-modal-header-right">
                  {activeModal === 'ghost' ? (
                    <span
                      className={`mission-status-chip ${
                        progress.completed ? 'completed' : isCombatActive ? 'combat' : 'active'
                      }`}
                    >
                      {progress.completed ? '✓ ပြီးဆုံးပြီ' : isCombatActive ? '⚔️ Combat' : `${totalEncountered}/3 ရှာပြီး`}
                    </span>
                  ) : (
                    <span
                      className={`mission-status-chip ${
                        zombieCompleted ? 'completed' : zombieUnlocked ? 'active' : 'locked'
                      }`}
                    >
                      {zombieCompleted
                        ? '✓ ပြီးဆုံးပြီ'
                        : zombieUnlocked
                          ? `${zombieMission.defeatedCount}/${ZOMBIE_COUNT}`
                          : '🔒 Locked'}
                    </span>
                  )}

                  <button
                    type="button"
                    className="mission-modal-close"
                    onClick={() => setActiveModal(null)}
                    aria-label="Mission dialog ပိတ်မည်"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="mission-modal-body">
                {activeModal === 'ghost' ? (
                  <>
                    <div className="mission-guide-banner">
                      <strong>လုပ်ဆောင်ရမည့် အဆင့်များ (How to Complete)</strong>
                      <p>
                        သရဲ ၃ ကောင်လုံးကို ရှာဖွေတွေ့ဆုံပြီး ဘောလုံးကွင်းရှိ သန့်စင်သောဓားကို ကောက်ယူကာ
                        သရဲ ၃ ကောင်လုံးကို နှိမ်နင်းပါ။
                      </p>
                    </div>

                    {/* STAGE 1: Ghost Encounter Checklist */}
                    <div className="ghost-hud-section">
                      <div className="ghost-hud-section-header">
                        <span>အဆင့် ၁ · သရဲ ၃ ကောင် ရှာဖွေတွေ့ဆုံခြင်း</span>
                        <span className="ghost-hud-badge-tag">{totalEncountered} / 3</span>
                      </div>
                      <p className="mission-step-desc">
                        မြို့ထဲရှိ သရဲ ၃ ကောင်အနားသို့ လမ်းလျှောက်သွား၍ တစ်ကောင်ချင်းစီ တွေ့ဆုံပါ။
                      </p>
                      <div className="ghost-hud-encounter-grid">
                        {GHOST_IDS.map(id => {
                          const encountered = progress.encountered.includes(id);
                          const scale = GHOST_STATS[id].scale;
                          return (
                            <div
                              key={id}
                              className={`ghost-hud-encounter-node${encountered ? ' encountered' : ''}`}
                            >
                              <span className="node-id">{id}</span>
                              <span className="node-scale">({scale}× အရွယ်)</span>
                              <span className="node-status">{encountered ? '✓ တွေ့ပြီ' : 'မတွေ့သေး'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* STAGE 2: Holy Sword Objective */}
                    <div className="ghost-hud-section">
                      <div className="ghost-hud-section-header">
                        <span>အဆင့် ၂ · ဘောလုံးကွင်းရှိ သန့်စင်သောဓား ကောက်ယူခြင်း</span>
                      </div>
                      <div className="ghost-hud-sword-row">
                        <span className="ghost-hud-sword-icon" role="img" aria-hidden="true">
                          ⚔️
                        </span>
                        <div className="ghost-hud-sword-info">
                          {progress.swordCollected ? (
                            <>
                              <span className="ghost-hud-sword-state collected">✓ ဓားရရှိပြီးဖြစ်သည်</span>
                              <span className="ghost-hud-sword-hint">
                                F နှိပ်၍ သရဲများကို ဓားခုတ်တိုက်ခိုက်ပါ (G / B ဖြင့် ကာကွယ်ပါ)
                              </span>
                            </>
                          ) : isAllEncountered ? (
                            <>
                              <span className="ghost-hud-sword-state ready">ဘောလုံးကွင်းတွင် ဓားသွားယူပါ</span>
                              <span className="ghost-hud-sword-hint">
                                ဘောလုံးကွင်းရှိ ဓားအနားသွား၍ ကောက်ယူပါ (သို့) E နှိပ်ပါ
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="ghost-hud-sword-state locked">🔒 သော့ခတ်ထားသည်</span>
                              <span className="ghost-hud-sword-hint">
                                သရဲ ၃ ကောင်လုံး အရင်ရှာဖွေတွေ့ဆုံရပါမည်
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STAGE 3: Ghost Boss HP Bars */}
                    <div className="ghost-hud-section">
                      <div className="ghost-hud-section-header">
                        <span>အဆင့် ၃ · သရဲ ၃ ကောင်လုံး နှိမ်နင်းခြင်း (HP)</span>
                        <span className="ghost-hud-badge-tag">{ghostsDefeatedCount} / 3</span>
                      </div>
                      <div className="ghost-hud-boss-list">
                        {GHOST_IDS.map(id => {
                          const hp = progress.hp[id];
                          const maxHp = GHOST_STATS[id].maxHp;
                          const scale = GHOST_STATS[id].scale;
                          const isDead = hp === 0;
                          const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));

                          return (
                            <div key={id} className="ghost-hud-boss-item">
                              <div className="ghost-hud-boss-meta">
                                <span className="ghost-hud-boss-name">
                                  {id === 'ghost-3' ? '👻 Ghost 3 (4× Boss)' : `👻 Ghost ${id.slice(-1)} (${scale}×)`}
                                </span>
                                <span className={`ghost-hud-boss-hp-text${isDead ? ' dead' : ''}`}>
                                  {isDead ? '💀 Defeated' : `${hp} / ${maxHp} HP`}
                                </span>
                              </div>
                              <div className="ghost-hud-hp-bar-track">
                                <div
                                  className={`ghost-hud-hp-bar-fill${isDead ? ' dead' : id === 'ghost-3' ? ' boss3' : ''}`}
                                  style={{ width: isDead ? '100%' : `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Rewards */}
                    <div className={`ghost-hud-reward-box ${progress.completed ? 'completed' : 'locked'}`}>
                      <span role="img" aria-hidden="true">
                        {progress.completed ? '🏆' : '🎁'}
                      </span>
                      <span>
                        {progress.completed
                          ? 'ဆုလာဘ် ရရှိပြီး! သရဲဓား (Knife), ကား/မိုးပျံပူပေါင်း နှင့် Zombie Mission ဖွင့်ပြီးပါပြီ။'
                          : 'ဆုလာဘ်: သရဲဓား (Knife) အသုံးပြုခွင့်၊ ကား/မိုးပျံပူပေါင်း စီးခွင့် နှင့် Zombie Mission ဖွင့်ခွင့်။'}
                      </span>
                    </div>

                    {/* Mission 1 Reset / Replay Action (works even after ✓ ပြီးဆုံးပြီ!) */}
                    {(progress.completed || totalEncountered > 0 || progress.swordCollected || ghostsDefeatedCount > 0) && (
                      <div className="ghost-hud-combat-actions" style={{ marginTop: 6 }}>
                        <button
                          type="button"
                          className="ghost-hud-combat-btn defend"
                          style={{ width: '100%', justifyContent: 'center' }}
                          onClick={() => {
                            resetGhostMissionForReplay();
                            ghostMissionProximity.lastMessage = '🔄 Mission 1 (Ghost Mission) ကို အစမှ ပြန်စလိုက်ပါပြီ!';
                            setActiveModal(null);
                          }}
                        >
                          🔄 Mission 1 ပြန်စမည် (Reset)
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {!zombieUnlocked ? (
                      <div className="mission-locked-callout">
                        <div className="mission-locked-callout-head">
                          <span aria-hidden="true">🔒</span>
                          <strong>Ghost Mission အရင်ပြီးဆုံးရန် လိုအပ်ပါသည်</strong>
                        </div>
                        <p>
                          Ghost Mission ပြီးဆုံးမှသာ Character သည် ဓား (Knife) အသုံးပြုခွင့် ရရှိပြီး
                          Zombie Mission ကို စတင်ကစားနိုင်ပါမည်။
                        </p>
                        <button
                          type="button"
                          className="mission-switch-btn"
                          onClick={() => setActiveModal('ghost')}
                        >
                          👻 Ghost Mission လမ်းညွှန်ကြည့်ရန် →
                        </button>
                      </div>
                    ) : (
                      <div className="mission-guide-banner mission-guide-banner-zombie">
                        <strong>လုပ်ဆောင်ရမည့် အဆင့်များ (How to Complete)</strong>
                        <p>
                          သရဲဓား (Knife) ကို ကိုင်ဆောင်၍ သစ်တောအုပ်ထဲရှိ Zombie ၁၃ ကောင်လုံးကို နှိမ်နင်းပါ။
                          အောင်မြင်ပါက သေနတ် (Tactical Gun) ဆုလာဘ် ရရှိမည်ဖြစ်ပါသည်။
                        </p>
                      </div>
                    )}

                    {/* Zombie Step 1 */}
                    <div className="ghost-hud-section">
                      <div className="ghost-hud-section-header">
                        <span>အဆင့် ၁ · သစ်တောအုပ်သို့ သွားရောက်ခြင်း</span>
                        <span className="ghost-hud-badge-tag">
                          {zombieMission.inForest ? '🌲 သစ်တောထဲရောက်နေ' : 'Area 5 / သာစည်'}
                        </span>
                      </div>
                      <p className="mission-step-desc">
                        မြို့သာ Area 5 နှင့် သာစည်ကြားရှိ သစ်တောအုပ် (Zombie Forest) အတွင်းသို့ ဓားကိုင်ဆောင်၍ ဝင်ရောက်ပါ။
                      </p>
                    </div>

                    {/* Zombie Step 2 */}
                    <div className="ghost-hud-section">
                      <div className="ghost-hud-section-header">
                        <span>အဆင့် ၂ · Zombie ၁၃ ကောင်လုံး နှိမ်နင်းခြင်း</span>
                        <span className="ghost-hud-badge-tag">
                          {zombieMission.defeatedCount} / {ZOMBIE_COUNT}
                        </span>
                      </div>
                      <p className="mission-step-desc">
                        🧟 2-ချက်သေ Zombie: <strong>{zombieMission.twoHitCount}</strong> ကောင် · 3-ချက်သေ Zombie:{' '}
                        <strong>{ZOMBIE_COUNT - zombieMission.twoHitCount}</strong> ကောင်။ F ဖြင့် ခုတ်ပြီး G/B (ကာ) ဖြင့်
                        Heart Life (၃ ခု) မလျော့အောင် ကာကွယ်ပါ။
                      </p>
                      <div className="ghost-hud-hp-bar-track">
                        <div
                          className="ghost-hud-hp-bar-fill"
                          style={{
                            width: `${zombieProgressPct}%`,
                            background: zombieCompleted
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : 'linear-gradient(90deg, #f59e0b, #ef4444)',
                          }}
                        />
                      </div>
                    </div>

                    {/* Zombie Reward */}
                    <div className={`ghost-hud-reward-box ${zombieCompleted ? 'completed' : 'locked'}`}>
                      <span role="img" aria-hidden="true">
                        {zombieCompleted ? '🔫' : '🎁'}
                      </span>
                      <span>
                        {zombieCompleted
                          ? 'ဆုလာဘ် သေနတ် (Tactical Gun) ရရှိပြီး! Menu → Weapon မှ ရွေးချယ်၍ F ဖြင့် ပစ်ခတ်နိုင်ပါပြီ။'
                          : 'ဆုလာဘ်: Zombie ၁၃ ကောင်လုံး နှိမ်နင်းအောင်မြင်ပါက သေနတ် (Tactical Gun) ရရှိမည်။'}
                      </span>
                    </div>

                    {/* Interactive Actions (only when Ghost Mission is completed) */}
                    {zombieUnlocked && (
                      <div className="ghost-hud-combat-actions" style={{ marginTop: 2 }}>
                        {zombieCompleted && (
                          <button
                            type="button"
                            className="ghost-hud-combat-btn"
                            onClick={() => selectMissionWeapon('zombie-gun')}
                          >
                            🔫 {activeWeapon === 'zombie-gun' ? 'သေနတ်ကိုင်ထားသည်' : 'သေနတ်ကိုင်မည်'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ghost-hud-combat-btn"
                          onClick={() => {
                            setZombieForestSwordActive(true);
                            selectMissionWeapon('ghost-sword');
                          }}
                        >
                          ⚔️ {activeWeapon === 'ghost-sword' ? 'ဓားကိုင်ထားသည်' : 'ဓားထုတ်ကိုင်မည်'}
                        </button>
                        <button
                          type="button"
                          className="ghost-hud-combat-btn defend"
                          onClick={() => {
                            if (zombieCompleted) {
                              resetZombieMissionForReplay();
                            } else {
                              rerollZombieForestWave();
                            }
                            setActiveModal(null);
                          }}
                        >
                          {zombieCompleted ? '🔄 Mission 2 ပြန်စမည် (Reset)' : '🔄 Zombie အသစ် (13)'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={containerRef}
        className="ghost-hud-container"
        style={style}
        aria-label="Mission HUD"
      >
        {collapsed ? (
          isMobile ? (
            /* ===================================================================
               COLLAPSED PILL: Minimal Floating Gaming Badge (Mobile)
               =================================================================== */
            <div
              className="ghost-hud-pill"
              role="button"
              tabIndex={0}
              aria-expanded={false}
              aria-label="Mission toggle - Click or drag anywhere"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  toggleCollapse();
                }
              }}
            >
              <div className="ghost-hud-pill-icon-group" title="ဖွင့်ရန် နှိပ်ပါ / နေရာရွှေ့ရန် ဖိဆွဲပါ">
                <span className="ghost-hud-ghost-emoji" role="img" aria-hidden="true">
                  🎯
                </span>
                <span className="ghost-hud-chevron-btn" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </div>

              <span className="ghost-hud-pill-label">Mission</span>

              {completedMissionsCount === 2 ? (
                <span className="ghost-hud-pill-badge completed">✓ 2/2</span>
              ) : isCombatActive ? (
                <span className="ghost-hud-pill-badge combat">⚔️ Active</span>
              ) : (
                <span className="ghost-hud-pill-badge">{completedMissionsCount}/2</span>
              )}
            </div>
          ) : (
            /* ===================================================================
               COLLAPSED CARD: Compact Header Card (Desktop)
               =================================================================== */
            <div
              className="ghost-hud-card ghost-hud-card-collapsed"
              role="region"
              aria-label="Mission Summary"
              onClick={toggleCollapse}
            >
              <div
                className="ghost-hud-header"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                title="ဖွင့်ရန် နှိပ်ပါ / နေရာရွှေ့ရန် ဖိဆွဲပါ"
              >
                <div className="ghost-hud-header-left">
                  <span className="ghost-hud-drag-grip" aria-hidden="true">
                    ⠿
                  </span>
                  <div className="ghost-hud-title-wrap">
                    <span className="ghost-hud-ghost-emoji" role="img" aria-hidden="true">
                      🎯
                    </span>
                    <span className="ghost-hud-chevron-btn" aria-hidden="true">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </span>
                    <span className="ghost-hud-title">Mission</span>
                  </div>
                </div>

                <div className="ghost-hud-header-actions" onPointerDown={e => e.stopPropagation()}>
                  {completedMissionsCount === 2 ? (
                    <span className="ghost-hud-badge-tag mission-badge-done">✓ 2/2 ပြီးပြီ</span>
                  ) : isCombatActive ? (
                    <span className="ghost-hud-badge-tag mission-badge-combat">⚔️ Combat</span>
                  ) : (
                    <span className="ghost-hud-badge-tag">{completedMissionsCount}/2 ပြီး</span>
                  )}

                  <button
                    type="button"
                    className="ghost-hud-collapse-btn"
                    onClick={e => {
                      e.stopPropagation();
                      toggleCollapse();
                    }}
                    title="Mission panel ဖွင့်မည် (Expand)"
                    aria-label="Expand Mission HUD"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          )
        ) : (
          /* ===================================================================
             EXPANDED VIEW: Redesigned Mission Hub with Clickable Mission Cards
             =================================================================== */
          <div className="ghost-hud-card" role="region" aria-label="Mission Hub">
            {/* Draggable Header */}
            <div
              className="ghost-hud-header"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
              title="နေရာရွှေ့ရန် ဖိဆွဲပါ / ပိတ်ရန် နှိပ်ပါ"
            >
              <div className="ghost-hud-header-left">
                <span className="ghost-hud-drag-grip" aria-hidden="true">
                  ⠿
                </span>
                <div className="ghost-hud-title-wrap">
                  <span className="ghost-hud-ghost-emoji" role="img" aria-hidden="true">
                    🎯
                  </span>
                  <span className="ghost-hud-chevron-btn" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 15l-6-6-6 6" />
                    </svg>
                  </span>
                  <span className="ghost-hud-title">Mission</span>
                </div>
              </div>

              <div className="ghost-hud-header-actions" onPointerDown={e => e.stopPropagation()}>
                {completedMissionsCount === 2 ? (
                  <span className="ghost-hud-badge-tag mission-badge-done">✓ 2/2 ပြီးပြီ</span>
                ) : (
                  <span className="ghost-hud-badge-tag">{completedMissionsCount}/2 ပြီး</span>
                )}

                <button
                  type="button"
                  className="ghost-hud-collapse-btn"
                  onClick={toggleCollapse}
                  title="Mission panel ပိတ်မည် (Collapse)"
                  aria-label="Collapse Mission HUD"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mission Cards Body */}
            <div
              className="ghost-hud-body"
              onPointerDown={e => e.stopPropagation()}
              onWheel={e => e.stopPropagation()}
            >
              <div className="mission-card-list" role="list" aria-label="Mission list">
                {/* Mission Card 1: Ghost Mission */}
                <button
                  type="button"
                  role="listitem"
                  className={`mission-item-card mission-item-ghost${progress.completed ? ' is-completed' : isCombatActive ? ' is-combat' : ''}`}
                  onClick={() => openMissionModal('ghost')}
                >
                  <div className="mission-item-top">
                    <div className="mission-item-identity">
                      <span className="mission-item-icon" aria-hidden="true">
                        👻
                      </span>
                      <div className="mission-item-titles">
                        <strong className="mission-item-name">Ghost Mission</strong>
                        <span className="mission-item-sub">
                          {progress.completed
                            ? 'သရဲ ၃ ကောင် နှိမ်နင်းပြီး · ဓားရရှိပြီး'
                            : progress.swordCollected
                              ? `သရဲများ နှိမ်နင်းရန် (${ghostsDefeatedCount}/3)`
                              : isAllEncountered
                                ? 'ဘောလုံးကွင်းတွင် ဓားသွားယူပါ'
                                : `သရဲ ၃ ကောင် ရှာဖွေပါ (${totalEncountered}/3)`}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`mission-status-chip ${
                        progress.completed ? 'completed' : isCombatActive ? 'combat' : 'active'
                      }`}
                    >
                      {progress.completed ? '✓ ပြီး' : isCombatActive ? '⚔️ ခုတ်' : `${totalEncountered}/3`}
                    </span>
                  </div>

                  <div className="mission-item-progress-row">
                    <div className="ghost-hud-hp-bar-track">
                      <div
                        className="ghost-hud-hp-bar-fill mission-bar-ghost"
                        style={{ width: `${ghostProgressPct}%` }}
                      />
                    </div>
                    <span className="mission-item-cta">လမ်းညွှန်ကြည့်ရန် →</span>
                  </div>
                </button>

                {/* Mission Card 2: Zombie Mission */}
                <button
                  type="button"
                  role="listitem"
                  className={`mission-item-card mission-item-zombie${
                    zombieCompleted ? ' is-completed' : !zombieUnlocked ? ' is-locked' : ''
                  }`}
                  onClick={() => openMissionModal('zombie')}
                >
                  <div className="mission-item-top">
                    <div className="mission-item-identity">
                      <span className="mission-item-icon" aria-hidden="true">
                        {zombieUnlocked ? '🧟' : '🔒'}
                      </span>
                      <div className="mission-item-titles">
                        <strong className="mission-item-name">Zombie Mission</strong>
                        <span className="mission-item-sub">
                          {zombieCompleted
                            ? 'Zombie ၁၃ ကောင် နှိမ်နင်းပြီး · သေနတ်ရရှိပြီး'
                            : zombieUnlocked
                              ? `သစ်တောအုပ် Zombie (${zombieMission.defeatedCount}/${ZOMBIE_COUNT})`
                              : 'Ghost Mission ပြီးဆုံးမှ ဖွင့်လှစ်မည်'}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`mission-status-chip ${
                        zombieCompleted ? 'completed' : zombieUnlocked ? 'active' : 'locked'
                      }`}
                    >
                      {zombieCompleted
                        ? '✓ ပြီး'
                        : zombieUnlocked
                          ? `${zombieMission.defeatedCount}/${ZOMBIE_COUNT}`
                          : 'Locked'}
                    </span>
                  </div>

                  <div className="mission-item-progress-row">
                    <div className="ghost-hud-hp-bar-track">
                      <div
                        className="ghost-hud-hp-bar-fill mission-bar-zombie"
                        style={{ width: `${zombieProgressPct}%` }}
                      />
                    </div>
                    <span className="mission-item-cta">လမ်းညွှန်ကြည့်ရန် →</span>
                  </div>
                </button>
              </div>

              {/* Notification / Message Toast */}
              {(message || zombieMission.lastMessage) && (
                <div className="ghost-hud-message" role="status" aria-live="polite">
                  💬 {message || zombieMission.lastMessage}
                </div>
              )}

              {/* Sword Pickup Interactive Action Card */}
              {pickup.near && !progress.swordCollected && (
                <div className="ghost-hud-pickup-box" role="region" aria-label="Sword Pickup Action">
                  {!pickup.ready ? (
                    <div style={{ color: '#fca5a5', fontSize: '11.5px', lineHeight: 1.35 }}>
                      ⚠️ သတိ: Ghost ၃ ကောင်လုံး ဓားနှင့် 20m ကျော် ဝေးကွာရပါမည်။
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="ghost-hud-pickup-btn"
                        onClick={() => requestThreeGhostsAction('interact')}
                      >
                        <span>⚔️ ဓားကောက်ယူမည် (Pick up - E)</span>
                        {pickup.progress > 0 && (
                          <span>{Math.round(pickup.progress * 100)}%</span>
                        )}
                      </button>
                      {pickup.progress > 0 && (
                        <div className="ghost-hud-pickup-progress-track">
                          <div
                            className="ghost-hud-pickup-progress-bar"
                            style={{ width: `${Math.round(pickup.progress * 100)}%` }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Active Weapon Quick Controls */}
              {activeWeapon === 'ghost-sword' && <CombatControls />}
              {activeWeapon === 'zombie-gun' && (
                <div className="ghost-hud-combat-actions">
                  <button
                    type="button"
                    className="ghost-hud-combat-btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => requestGunShot()}
                  >
                    🔫 သေနတ်ပစ်မည် (Shoot - F)
                  </button>
                </div>
              )}

              {/* Dev Map (Development only) */}
              {GhostDevMap && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 4 }}>
                  <Suspense fallback={null}>
                    <GhostDevMap />
                  </Suspense>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Always-visible Floating Sword Pickup Button when near the unlocked sword */}
      {pickup.near && !progress.swordCollected && (
        <div
          className="ghost-sword-floating-pickup"
          role="region"
          aria-label="Sword Pickup Floating Action"
          onPointerDown={e => e.stopPropagation()}
        >
          {pickup.ready ? (
            <button
              type="button"
              className="ghost-sword-floating-btn"
              onPointerDown={e => {
                e.preventDefault();
                e.stopPropagation();
                requestThreeGhostsAction('interact');
              }}
              onClick={e => {
                if (e.detail === 0) requestThreeGhostsAction('interact');
              }}
            >
              <span className="ghost-sword-floating-icon" aria-hidden="true">⚔️</span>
              <span className="ghost-sword-floating-text">
                <strong>ဓားကောက်ယူမည်</strong>
                <small>နှိပ်ပါ သို့မဟုတ် E နှိပ်ပါ</small>
              </span>
            </button>
          ) : (
            <div className="ghost-sword-floating-warn">
              ⚠️ Ghost ၃ ကောင်လုံး ဓားနှင့် 20m ကျော် ဝေးကွာရပါမည်
            </div>
          )}
        </div>
      )}

      {modalPortal}
    </>
  );
}
