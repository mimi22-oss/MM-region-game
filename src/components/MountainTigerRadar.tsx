import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { clampToRadarCircle } from '../game/missions/ghostDevMapModel';
import {
  getMountainTigerMapSnapshot,
  subscribeMountainTigerCombat,
  type MountainTigerMapSnapshot,
} from '../game/mountainTigerCombat';
import './GhostRadar.css';

const RADAR_RANGE_M = 300;
const RADAR_MAX_RADIUS = 86;
const STORAGE_SIZE_KEY = 'mm-tiger-radar-size-v1';
const STORAGE_POS_KEY = 'mm-tiger-radar-pos-v1';

type RadarSizeMode = 'normal' | 'large' | 'minimized';
interface Position {
  x: number;
  y: number;
}

/**
 * GhostRadar-style live circular radar for Mountain Tigers (`တောင်ပေါ်ကျား ရေဒါ`).
 * Centers on the player (`300m` radar range), shows nearby tiger territories in realtime,
 * pins the nearest tiger's direction & meter distance even when farther than 300m,
 * and supports drag, resize, minimize, and double-tap fullscreen view.
 */
export function MountainTigerRadar({
  playerPosRef,
  playerYawRef,
}: {
  playerPosRef: { current: { x: number; z: number } };
  playerYawRef: { current: number };
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    active: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    pointerId: -1,
  });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });

  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sizeMode, setSizeMode] = useState<RadarSizeMode>(() => {
    if (typeof window === 'undefined') return 'normal';
    try {
      const s = localStorage.getItem(STORAGE_SIZE_KEY);
      if (s === 'large' || s === 'minimized' || s === 'normal') return s;
    } catch {}
    return 'normal';
  });
  const [position, setPosition] = useState<Position | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = localStorage.getItem(STORAGE_POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as Position;
        if (Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
      }
    } catch {}
    return null;
  });

  const [radarState, setRadarState] = useState<{
    px: number;
    pz: number;
    yaw: number;
    map: MountainTigerMapSnapshot;
  }>(() => ({
    px: playerPosRef.current.x,
    pz: playerPosRef.current.z,
    yaw: playerYawRef.current,
    map: getMountainTigerMapSnapshot(playerPosRef.current.x, playerPosRef.current.z),
  }));

  useEffect(() => {
    const tick = () => {
      const px = playerPosRef.current.x;
      const pz = playerPosRef.current.z;
      const yaw = playerYawRef.current;
      const map = getMountainTigerMapSnapshot(px, pz);
      setRadarState({ px, pz, yaw, map });
    };
    tick();
    const unsub = subscribeMountainTigerCombat(tick);
    const interval = window.setInterval(tick, 180);
    return () => {
      unsub();
      window.clearInterval(interval);
    };
  }, [playerPosRef, playerYawRef]);

  const handleSetSizeMode = (mode: RadarSizeMode) => {
    setSizeMode(mode);
    try {
      localStorage.setItem(STORAGE_SIZE_KEY, mode);
    } catch {}
  };

  const clampPosition = useCallback((x: number, y: number): Position => {
    if (typeof window === 'undefined') return { x, y };
    const margin = 8;
    const w = containerRef.current?.offsetWidth ?? 112;
    const h = containerRef.current?.offsetHeight ?? 112;
    return {
      x: Math.min(Math.max(margin, x), Math.max(margin, window.innerWidth - w - margin)),
      y: Math.min(Math.max(margin, y), Math.max(margin, window.innerHeight - h - margin)),
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      active: true,
      hasMoved: false,
      startX: e.clientX,
      startY: e.clientY,
      elemStartX: rect.left,
      elemStartY: rect.top,
      pointerId: e.pointerId,
    };
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.hasMoved && Math.hypot(dx, dy) > 6) d.hasMoved = true;
    if (d.hasMoved) setPosition(clampPosition(d.elemStartX + dx, d.elemStartY + dy));
  };

  const handlePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || d.pointerId !== e.pointerId) return;
    d.active = false;
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}

    if (d.hasMoved) {
      const next = clampPosition(d.elemStartX + (e.clientX - d.startX), d.elemStartY + (e.clientY - d.startY));
      setPosition(next);
      try {
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(next));
      } catch {}
    } else if (sizeMode === 'minimized') {
      handleSetSizeMode('normal');
    } else {
      const now = Date.now();
      const prev = lastTapRef.current;
      if (now - prev.time < 340 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 36) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        if (document.pointerLockElement) document.exitPointerLock();
        setIsFullscreen(true);
      } else {
        lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
      }
    }
  };

  const { map, px, pz, yaw } = radarState;
  if (map.totalCount === 0) return null;

  const inlineStyle: React.CSSProperties = position
    ? { left: `${position.x}px`, top: `${position.y}px`, right: 'auto' }
    : {};
  const widgetClass = `ghost-radar-widget ${position ? '' : 'ghost-radar-default-pos'} ${
    isDragging ? 'ghost-radar-dragging' : ''
  }`.trim();

  if (sizeMode === 'minimized') {
    return (
      <div
        ref={containerRef}
        className={widgetClass}
        style={inlineStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="ghost-radar-minimized"
          role="button"
          tabIndex={0}
          title="Tiger Radar (နှိပ်လျှင် ပွင့်မည်)"
          aria-label="Open Mountain Tiger Radar"
        >
          <span aria-hidden="true">🐯</span>
          {map.remainingCount > 0 && <span className="ghost-radar-badge">{map.remainingCount}</span>}
        </div>
      </div>
    );
  }

  const fullscreenModal =
    isFullscreen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="ghost-radar-fullscreen-backdrop"
            role="presentation"
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) setIsFullscreen(false);
            }}
          >
            <div
              className="ghost-radar-fullscreen-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Tiger Radar Fullscreen Dialog"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsFullscreen(false);
              }}
            >
              <div className="ghost-radar-fullscreen-header">
                <div className="ghost-radar-fullscreen-title-group">
                  <span className="ghost-radar-fullscreen-icon" aria-hidden="true">
                    🐯
                  </span>
                  <div>
                    <h2 className="ghost-radar-fullscreen-title">Tiger Radar · တောင်ပေါ်ကျား ရေဒါ</h2>
                    <span className="ghost-radar-fullscreen-subtitle">
                      {map.remainingCount > 0
                        ? `တောင်ပေါ်ကျား ${map.remainingCount}/${map.totalCount} ကောင် ကျန်ရှိနေသည်`
                        : 'တောင်ပေါ်ကျားအားလုံး နှိမ်နင်းပြီးပါပြီ 🥕'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="ghost-radar-fullscreen-close"
                  onClick={() => setIsFullscreen(false)}
                  aria-label="Close Tiger Radar"
                >
                  ✕
                </button>
              </div>
              <div className="ghost-radar-fullscreen-body">
                <div className="ghost-radar-fullscreen-circle-wrap">
                  <TigerRadarSvg px={px} pz={pz} yaw={yaw} map={map} />
                </div>
                <div className="ghost-radar-fullscreen-stats">
                  {map.nearestTigers.map((t, idx) => (
                    <div key={t.id} className="ghost-radar-stat-card">
                      <span className="ghost-radar-stat-name" style={{ color: idx === 0 ? '#fb923c' : '#fde68a' }}>
                        🐯 ကျား-{idx + 1}
                      </span>
                      <span className="ghost-radar-stat-dist">{Math.round(t.distanceM)}m</span>
                    </div>
                  ))}
                  {map.nearestTigers.length === 0 && (
                    <div className="ghost-radar-stat-card" style={{ width: '100%' }}>
                      <span className="ghost-radar-stat-name" style={{ color: '#4ade80' }}>
                        🥕 ယုန်လေးများအတွက် ခါကျက်ဥနီ ရရှိပြီး!
                      </span>
                    </div>
                  )}
                </div>
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
        className={widgetClass}
        style={inlineStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        title="တောင်ပေါ်ကျား ရေဒါ (2-ချက်နှိပ်လျှင် မျက်နှာပြင်အပြည့် ကြည့်မည်)"
      >
        <div className={`ghost-radar-circle-container ghost-radar-size-${sizeMode}`}>
          <div className="ghost-radar-controls" onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="ghost-radar-ctrl-btn"
              title="မျက်နှာပြင်အပြည့် ကြည့်မည်"
              aria-label="Fullscreen Tiger Radar"
              onClick={() => {
                if (document.pointerLockElement) document.exitPointerLock();
                setIsFullscreen(true);
              }}
            >
              ⛶
            </button>
            <button
              type="button"
              className="ghost-radar-ctrl-btn"
              title={sizeMode === 'large' ? 'ပုံမှန်အရွယ် ပြန်ချုံ့မည်' : 'ပိုကြီးအောင် ချဲ့မည်'}
              aria-label="Toggle Tiger Radar size"
              onClick={() => handleSetSizeMode(sizeMode === 'large' ? 'normal' : 'large')}
            >
              {sizeMode === 'large' ? '↙' : '↗'}
            </button>
            <button
              type="button"
              className="ghost-radar-ctrl-btn"
              title="အသေးလေး သိမ်းမည်"
              aria-label="Minimize Tiger Radar"
              onClick={() => handleSetSizeMode('minimized')}
            >
              −
            </button>
          </div>
          <TigerRadarSvg px={px} pz={pz} yaw={yaw} map={map} />
        </div>
      </div>
      {fullscreenModal}
    </>
  );
}

function TigerRadarSvg({
  px,
  pz,
  yaw,
  map,
}: {
  px: number;
  pz: number;
  yaw: number;
  map: MountainTigerMapSnapshot;
}) {
  const scale = RADAR_MAX_RADIUS / RADAR_RANGE_M;
  const project = (tx: number, tz: number) => {
    const rawX = 100 + (tx - px) * scale;
    const rawY = 100 + (tz - pz) * scale;
    return clampToRadarCircle(rawX, rawY, 100, 100, RADAR_MAX_RADIUS);
  };

  const nearestPt = map.nearest ? project(map.nearest.x, map.nearest.z) : null;

  return (
    <svg
      viewBox="0 0 200 200"
      className="ghost-radar-svg"
      role="img"
      aria-label="Mountain tiger live radar"
    >
      <defs>
        <clipPath id="tigerRadarClip">
          <circle cx="100" cy="100" r="97" />
        </clipPath>
      </defs>

      <g clipPath="url(#tigerRadarClip)">
        <circle cx="100" cy="100" r="98" fill="#13110c" />
        {/* Distance rings: 100m, 200m, 300m */}
        <circle cx="100" cy="100" r="29" fill="none" stroke="#7c2d12" strokeWidth="0.75" strokeDasharray="3 3" />
        <circle cx="100" cy="100" r="58" fill="none" stroke="#7c2d12" strokeWidth="0.75" strokeDasharray="3 3" />
        <circle cx="100" cy="100" r="88" fill="none" stroke="#9a3412" strokeWidth="1" />
        <line x1="100" y1="8" x2="100" y2="192" stroke="#7c2d12" strokeWidth="0.6" strokeDasharray="3 4" opacity="0.6" />
        <line x1="8" y1="100" x2="192" y2="100" stroke="#7c2d12" strokeWidth="0.6" strokeDasharray="3 4" opacity="0.6" />
        <text x="100" y="16" fill="#fed7aa" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.85">
          N
        </text>

        {/* Nearby tiger territories within 300m */}
        {map.territories.map((t) => {
          if (t.isNearest || t.distanceM > RADAR_RANGE_M) return null;
          const pt = project(t.x, t.z);
          return (
            <g key={t.territoryId}>
              <circle cx={pt.x} cy={pt.y} r="7.5" fill="rgba(249, 115, 22, 0.28)" />
              <circle cx={pt.x} cy={pt.y} r="4.5" fill="#f97316" stroke="#fff7ed" strokeWidth="1" />
              {t.aliveCount >= 2 && (
                <text x={pt.x} y={pt.y + 2.3} fontSize="6.5" fontWeight="bold" fill="#111827" textAnchor="middle">
                  {t.aliveCount}
                </text>
              )}
            </g>
          );
        })}

        {/* Nearest living tiger (always shown — clamped to radar edge with guide line if > 300m) */}
        {map.nearest && nearestPt && (
          <g>
            <line
              x1="100"
              y1="100"
              x2={nearestPt.x}
              y2={nearestPt.y}
              stroke="#fb923c"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.85"
            />
            <circle cx={nearestPt.x} cy={nearestPt.y} r="10" fill="#ef4444" className="ghost-blip-pulse" />
            <circle cx={nearestPt.x} cy={nearestPt.y} r="6" fill="#ea580c" stroke="#fef08a" strokeWidth="1.4" />
            <text x={nearestPt.x} y={nearestPt.y + 2.8} fontSize="8" textAnchor="middle">
              🐯
            </text>
          </g>
        )}

        {/* Centered Player Marker with Live Head Direction Cone */}
        <g>
          <g transform={`rotate(${(-yaw * 180) / Math.PI} 100 100)`}>
            <path
              d="M 100 100 L 88 75 A 28 28 0 0 1 112 75 Z"
              fill="rgba(56, 189, 248, 0.3)"
            />
            <polygon
              points="100,86 95.5,96 100,94 104.5,96"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="0.8"
            />
          </g>
          <circle cx="100" cy="100" r="6.5" fill="#38bdf8" className="player-blip-pulse" />
          <circle cx="100" cy="100" r="4" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.4" />
        </g>

        {/* Bottom live distance pill inside radar */}
        <rect x="48" y="172" width="104" height="17" rx="8.5" fill="rgba(15, 23, 42, 0.86)" stroke="#f97316" strokeWidth="0.9" />
        <text x="100" y="183.5" fill="#fed7aa" fontSize="9.5" fontWeight="bold" textAnchor="middle">
          {map.nearest ? `🐯 ${Math.round(map.nearest.distanceM)}m` : '🥕 ပြီးပြီ'}
        </text>
      </g>

      <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(251, 146, 60, 0.55)" strokeWidth="2" />
    </svg>
  );
}
