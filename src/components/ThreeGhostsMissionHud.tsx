import { lazy, Suspense, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { GHOST_IDS, GHOST_STATS, useThreeGhostsMission } from '../game/missions/threeGhostsMission';
import { ghostMissionProximity, requestThreeGhostsAction } from './ThreeGhostsMissionScene';
import { CombatControls } from './combat/CombatControls';
import './ThreeGhostsMissionHud.css';

const GhostDevMap = import.meta.env.DEV ? lazy(() => import('./GhostDevMap')) : null;

const STORAGE_COLLAPSED_KEY = 'mm-ghost-hud-collapsed-v2';
const STORAGE_POS_KEY = 'mm-ghost-hud-pos-v2';

interface Position {
  x: number;
  y: number;
}

export function ThreeGhostsMissionHud() {
  const progress = useThreeGhostsMission();
  const [pickup, setPickup] = useState({ near: false, ready: false, progress: 0 });
  const [message, setMessage] = useState('');

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
    const elemWidth = containerRef.current?.offsetWidth ?? 280;
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
    // Only drag with primary pointer (left click or single touch)
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
      // It was a tap/click, not a drag! Toggle open/collapsed
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

  // Status helper strings & colors
  const totalEncountered = progress.encountered.length;
  const isAllEncountered = totalEncountered === 3;
  const isCombatActive = progress.swordCollected && !progress.completed;

  // Inline positioning style
  const style: React.CSSProperties = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
      }
    : {
        left: 'max(12px, calc(env(safe-area-inset-left, 0px) + 12px))',
        top: 'max(64px, calc(env(safe-area-inset-top, 0px) + 16px))',
      };

  return (
    <div
      ref={containerRef}
      className="ghost-hud-container"
      style={style}
      aria-label="Ghost Mission HUD"
    >
      {collapsed ? (
        isMobile ? (
          /* ===================================================================
             COLLAPSED PILL: Minimal Floating Gaming Badge with 👻 & Down Arrow (Mobile)
             =================================================================== */
          <div
            className="ghost-hud-pill"
            role="button"
            tabIndex={0}
            aria-expanded={false}
            aria-label="Ghost Mission toggle - Click or drag anywhere"
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
            {/* Ghost emoji + Down chevron toggle right beside it */}
            <div className="ghost-hud-pill-icon-group" title="ဖွင့်ရန် နှိပ်ပါ / နေရာရွှေ့ရန် ဖိဆွဲပါ">
              <span className="ghost-hud-ghost-emoji" role="img" aria-hidden="true">
                👻
              </span>
              <span className="ghost-hud-chevron-btn" aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </div>

            <span className="ghost-hud-pill-label">Mission</span>

            {/* Quick status badge */}
            {progress.completed ? (
              <span className="ghost-hud-pill-badge completed">✓ ပြီးပြီ</span>
            ) : isCombatActive ? (
              <span className="ghost-hud-pill-badge combat">⚔️ Combat</span>
            ) : (
              <span className="ghost-hud-pill-badge">{totalEncountered}/3</span>
            )}
          </div>
        ) : (
          /* ===================================================================
             COLLAPSED CARD: Minimal Header Card without ghost-hud-body (Desktop)
             =================================================================== */
          <div
            className="ghost-hud-card ghost-hud-card-collapsed"
            role="region"
            aria-label="Ghost Mission Details"
            onClick={toggleCollapse}
          >
            {/* Draggable Header */}
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
                    👻
                  </span>
                  {/* Down chevron toggle right beside ghost icon for fast expanding */}
                  <span className="ghost-hud-chevron-btn" aria-hidden="true">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                  <span className="ghost-hud-title">Ghost Mission</span>
                </div>
              </div>

              <div className="ghost-hud-header-actions" onPointerDown={e => e.stopPropagation()}>
                {progress.completed ? (
                  <span className="ghost-hud-badge-tag" style={{ background: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                    ✓ Completed
                  </span>
                ) : isCombatActive ? (
                  <span className="ghost-hud-badge-tag" style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                    ⚔️ Combat
                  </span>
                ) : (
                  <span className="ghost-hud-badge-tag">
                    {totalEncountered}/3 ရှာပြီး
                  </span>
                )}

                <button
                  type="button"
                  className="ghost-hud-collapse-btn"
                  onClick={e => {
                    e.stopPropagation();
                    toggleCollapse();
                  }}
                  title="Mission panel ဖွင့်မည် (Expand)"
                  aria-label="Expand Ghost Mission HUD"
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
           EXPANDED VIEW: Full Gaming Mission Tracker Card
           =================================================================== */
        <div className="ghost-hud-card" role="region" aria-label="Ghost Mission Details">
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
                  👻
                </span>
                {/* Up chevron toggle right beside ghost icon for fast folding on mobile/desktop */}
                <span className="ghost-hud-chevron-btn" aria-hidden="true">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                </span>
                <span className="ghost-hud-title">Ghost Mission</span>
              </div>
            </div>

            <div className="ghost-hud-header-actions" onPointerDown={e => e.stopPropagation()}>
              {progress.completed ? (
                <span className="ghost-hud-badge-tag" style={{ background: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
                  ✓ Completed
                </span>
              ) : isCombatActive ? (
                <span className="ghost-hud-badge-tag" style={{ background: 'rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  ⚔️ Combat
                </span>
              ) : (
                <span className="ghost-hud-badge-tag">
                  {totalEncountered}/3 ရှာပြီး
                </span>
              )}

              <button
                type="button"
                className="ghost-hud-collapse-btn"
                onClick={toggleCollapse}
                title="Mission panel ပိတ်မည် (Collapse)"
                aria-label="Collapse Ghost Mission HUD"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Interactive Card Body */}
          <div
            className="ghost-hud-body"
            onPointerDown={e => e.stopPropagation()}
            onWheel={e => e.stopPropagation()}
          >
            {/* STAGE 1: Ghost Encounter Checklist */}
            <div className="ghost-hud-section">
              <div className="ghost-hud-section-header">
                <span>၁။ သရဲ ၃ ကောင် ရှာဖွေတွေ့ဆုံခြင်း</span>
                <span className="ghost-hud-badge-tag">{totalEncountered} / 3</span>
              </div>
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
                <span>၂။ ဘောလုံးကွင်းရှိ သန့်စင်သောဓား</span>
              </div>
              <div className="ghost-hud-sword-row">
                <span className="ghost-hud-sword-icon" role="img" aria-hidden="true">
                  ⚔️
                </span>
                <div className="ghost-hud-sword-info">
                  {progress.swordCollected ? (
                    <>
                      <span className="ghost-hud-sword-state collected">✓ ဓားရရှိပြီးဖြစ်သည်</span>
                      <span className="ghost-hud-sword-hint">F နှိပ်၍ သရဲများကို တိုက်ခိုက်နှိမ်နင်းပါ</span>
                    </>
                  ) : isAllEncountered ? (
                    <>
                      <span className="ghost-hud-sword-state ready">ဘောလုံးကွင်းတွင် ဓားသွားယူပါ</span>
                      <span className="ghost-hud-sword-hint">ဓားနားသွားပြီး E ခလုတ်ကို 2s ဖိထားပါ</span>
                    </>
                  ) : (
                    <>
                      <span className="ghost-hud-sword-state locked">🔒 သော့ခတ်ထားသည်</span>
                      <span className="ghost-hud-sword-hint">သရဲ ၃ ကောင်လုံး အရင်ရှာဖွေတွေ့ဆုံရပါမည်</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* STAGE 3: Ghost Boss HP Bars */}
            <div className="ghost-hud-section">
              <div className="ghost-hud-section-header">
                <span>၃။ သရဲ ၃ ကောင်၏ သွေးပမာဏ (HP)</span>
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

            {/* STAGE 4: Rewards / Vehicle Unlocks */}
            <div className={`ghost-hud-reward-box ${progress.completed ? 'completed' : 'locked'}`}>
              <span role="img" aria-hidden="true">
                {progress.completed ? '🏆' : '🚗'}
              </span>
              <span>
                {progress.completed
                  ? 'ကားနှင့် မိုးပျံပူပေါင်း စီးနိုင်ပါပြီ။ ဓားကို Menu → Weapon မှ ရွေးနိုင်ပါပြီ။'
                  : 'ကားနှင့် မိုးပျံပူပေါင်းကို Mission အောင်မြင်မှ စီးနိုင်မည်။'}
              </span>
            </div>

            {/* Notification / Message Toast */}
            {message && (
              <div className="ghost-hud-message" role="status" aria-live="polite">
                💬 {message}
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

            {/* Combat Controls Bar (when sword is collected) */}
            {progress.equippedWeapon === 'ghost-sword' && <CombatControls />}

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
  );
}
