import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { area5 } from '../data/wards/myothar/area5';
import { useActiveGhostZones } from '../game/ghostConfig';
import { guardMissionActive, getGuardSummary } from '../game/missions/ghostGuardCoordinator';
import {
  GHOST_IDS,
  SWORD_PICKUP_RADIUS_M,
  isGhostDefeated,
  useThreeGhostsMission,
} from '../game/missions/threeGhostsMission';
import type { GhostRuntimeEntry } from '../game/missions/ghostRuntimeRegistry';
import {
  circularRadarProjection,
  clampToRadarCircle,
  selectDevMarker,
} from '../game/missions/ghostDevMapModel';
import './GhostRadar.css';

type Snapshot = {
  player: { x: number; z: number; yaw?: number } | null;
  ghosts: Partial<GhostRuntimeEntry>[];
};

interface Position {
  x: number;
  y: number;
}

interface DragState {
  active: boolean;
  hasMoved: boolean;
  startX: number;
  startY: number;
  elemStartX: number;
  elemStartY: number;
  pointerId: number;
}

const EMPTY_SNAPSHOT: Snapshot = { player: null, ghosts: [] };
const GHOST_COLORS = ['#c084fc', '#fbbf24', '#fb7185'];
const STORAGE_SIZE_KEY = 'mm-ghost-radar-size-v1';
const STORAGE_POS_KEY = 'mm-ghost-radar-pos-v2';

export type RadarSizeMode = 'normal' | 'large' | 'minimized';

export function GhostRadar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>({
    active: false,
    hasMoved: false,
    startX: 0,
    startY: 0,
    elemStartX: 0,
    elemStartY: 0,
    pointerId: -1,
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({
    time: 0,
    x: 0,
    y: 0,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Size mode: normal (112px/96px), large (200px/175px), or minimized (38px/35px floating circle)
  const [sizeMode, setSizeMode] = useState<RadarSizeMode>(() => {
    if (typeof window === 'undefined') return 'normal';
    try {
      const stored = localStorage.getItem(STORAGE_SIZE_KEY);
      if (stored === 'large' || stored === 'minimized' || stored === 'normal') {
        return stored;
      }
    } catch {
      // storage disabled
    }
    return 'normal';
  });

  // Draggable position state, persisted in localStorage
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
      // storage disabled
    }
    return null;
  });

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY_SNAPSHOT);
  useThreeGhostsMission();
  const zones = useActiveGhostZones();

  const handleSetSizeMode = (mode: RadarSizeMode) => {
    setSizeMode(mode);
    try {
      localStorage.setItem(STORAGE_SIZE_KEY, mode);
    } catch {
      // ignore
    }
  };

  const openFullscreenDialog = useCallback(() => {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
    setIsFullscreen(true);
  }, []);

  const closeFullscreenDialog = useCallback(() => {
    setIsFullscreen(false);
  }, []);

  // Clamping helper to prevent dragging off-screen
  const clampPosition = useCallback((x: number, y: number): Position => {
    if (typeof window === 'undefined') return { x, y };
    const margin = 8;
    const elemWidth = containerRef.current?.offsetWidth ?? 112;
    const elemHeight = containerRef.current?.offsetHeight ?? 112;
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
      setPosition(prev => (prev ? clampPosition(prev.x, prev.y) : null));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition]);

  // Re-clamp position when size mode changes
  useEffect(() => {
    if (position) {
      const raf = requestAnimationFrame(() => {
        setPosition(prev => (prev ? clampPosition(prev.x, prev.y) : null));
      });
      return () => cancelAnimationFrame(raf);
    }
  }, [sizeMode, clampPosition]);

  // Handle Escape key to close fullscreen dialog
  useEffect(() => {
    if (!isFullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullscreenDialog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFullscreen, closeFullscreenDialog]);

  // Pointer drag and double-tap detection event handlers
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
    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
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
      // Tap/click without dragging
      if (sizeMode === 'minimized') {
        handleSetSizeMode('normal');
      } else {
        // Double-tap detection for touch/pen/mouse
        const now = performance.now();
        const timeSinceLast = now - lastTapRef.current.time;
        const distSinceLast = Math.hypot(
          e.clientX - lastTapRef.current.x,
          e.clientY - lastTapRef.current.y
        );

        if (timeSinceLast < 400 && distSinceLast < 28) {
          openFullscreenDialog();
          lastTapRef.current = { time: 0, x: 0, y: 0 };
        } else {
          lastTapRef.current = { time: now, x: e.clientX, y: e.clientY };
        }
      }
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const finalPos = clampPosition(rect.left, rect.top);
      setPosition(finalPos);
      try {
        localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(finalPos));
      } catch {
        // ignore
      }
    }

    drag.active = false;
    drag.hasMoved = false;
    setIsDragging(false);
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
      setIsDragging(false);
    }
  };

  const handleCircleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    openFullscreenDialog();
  };

  useEffect(() => {
    // Listen for live 4Hz positions published by ThreeGhostsMissionScene
    const receive = (event: Event) => {
      setSnapshot((event as CustomEvent<Snapshot>).detail);
    };
    window.addEventListener('mm-ghost-debug-positions', receive);
    return () => window.removeEventListener('mm-ghost-debug-positions', receive);
  }, []);

  // Fixed world coordinate projection centered on football pitch and ghost zones
  const proj = useMemo(() => {
    return circularRadarProjection(
      [
        ...zones,
        { x: area5.pitch.x - 75, z: area5.pitch.z - 75 },
        { x: area5.pitch.x + 75, z: area5.pitch.z + 75 },
      ],
      200,
      20
    );
  }, [zones]);

  const guards = guardMissionActive() ? getGuardSummary() : [];
  const now = performance.now();
  const field = area5.pitch;

  // Process live markers for each ghost with live distance calculation
  const markers = GHOST_IDS.map((id, index) => {
    const marker = selectDevMarker(
      id,
      snapshot.ghosts.find(g => g.id === id),
      guards.find(g => g.id === id),
      zones.find(z => z.ghostId === id),
      now
    );
    const defeated = isGhostDefeated(id);
    const distanceM =
      snapshot.player && marker.x !== undefined && marker.z !== undefined
        ? Math.round(Math.hypot(snapshot.player.x - marker.x, snapshot.player.z - marker.z))
        : null;
    return {
      ...marker,
      index,
      defeated,
      distanceM,
      color: GHOST_COLORS[index] || '#c084fc',
    };
  });

  const activeGhostsCount = markers.filter(m => !m.defeated).length;
  const swordDistanceM = snapshot.player
    ? Math.round(Math.hypot(snapshot.player.x - field.x, snapshot.player.z - field.z))
    : null;

  const inlineStyle: React.CSSProperties = position
    ? {
        left: `${position.x}px`,
        top: `${position.y}px`,
        right: 'auto',
      }
    : {};

  const widgetClassName = `ghost-radar-widget ${position ? '' : 'ghost-radar-default-pos'} ${
    isDragging ? 'ghost-radar-dragging' : ''
  }`.trim();

  // Minimized state: sleek circular floating icon with ghost count badge (fully draggable)
  if (sizeMode === 'minimized') {
    return (
      <div
        ref={containerRef}
        className={widgetClassName}
        style={inlineStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className="ghost-radar-minimized"
          role="button"
          tabIndex={0}
          title="Ghost Radar (နှိပ်လျှင် ပွင့်မည် / ဖိဆွဲလျှင် နေရာရွှေ့မည်)"
          aria-label="Open Ghost Radar"
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleSetSizeMode('normal');
            }
          }}
        >
          <span aria-hidden="true">👻</span>
          {activeGhostsCount > 0 && (
            <span className="ghost-radar-badge">{activeGhostsCount}</span>
          )}
        </div>
      </div>
    );
  }

  // Clamped player position
  const playerClamped = snapshot.player
    ? clampToRadarCircle(proj.x(snapshot.player.x), proj.y(snapshot.player.z), 100, 100, 86)
    : null;

  const fullscreenModal =
    isFullscreen && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="ghost-radar-fullscreen-backdrop"
            role="presentation"
            onPointerDown={e => {
              if (e.target === e.currentTarget) {
                closeFullscreenDialog();
              }
            }}
          >
            <div
              className="ghost-radar-fullscreen-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Ghost Radar Fullscreen Dialog"
              onDoubleClick={e => {
                e.stopPropagation();
                closeFullscreenDialog();
              }}
            >
              <div className="ghost-radar-fullscreen-header">
                <div className="ghost-radar-fullscreen-title-group">
                  <span className="ghost-radar-fullscreen-icon" aria-hidden="true">
                    👻
                  </span>
                  <div>
                    <h2 className="ghost-radar-fullscreen-title">Ghost Radar · ရေဒါ မြင်ကွင်းကျယ်</h2>
                    <span className="ghost-radar-fullscreen-subtitle">
                      {activeGhostsCount > 0
                        ? `သရဲ ${activeGhostsCount} ကောင် ကျန်ရှိနေသည်`
                        : 'သရဲ ၃ ကောင်လုံး နှိမ်နင်းပြီးပါပြီ'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="ghost-radar-fullscreen-close"
                  onClick={closeFullscreenDialog}
                  aria-label="Close Fullscreen Radar"
                  title="ပိတ်မည် (Close · Esc)"
                >
                  ✕
                </button>
              </div>

              <div className="ghost-radar-fullscreen-body">
                <div className="ghost-radar-fullscreen-circle-wrap">
                  <RadarSvgContent
                    snapshot={snapshot}
                    markers={markers}
                    playerClamped={playerClamped}
                    proj={proj}
                    field={field}
                  />
                </div>

                <div className="ghost-radar-fullscreen-stats">
                  {markers.map(m => (
                    <div key={m.id} className="ghost-radar-stat-card">
                      <span className="ghost-radar-stat-name" style={{ color: m.color }}>
                        👻 Ghost {m.index + 1}
                      </span>
                      <span className={`ghost-radar-stat-dist${m.defeated ? ' defeated' : ''}`}>
                        {m.defeated
                          ? '💀 Defeated'
                          : m.distanceM !== null
                            ? `${m.distanceM}m`
                            : 'Detecting...'}
                      </span>
                    </div>
                  ))}
                </div>

                {swordDistanceM !== null && (
                  <div className="ghost-radar-stat-card" style={{ width: '100%' }}>
                    <span className="ghost-radar-stat-name" style={{ color: '#facc15' }}>
                      ⚔️ ဘောလုံးကွင်း ဓားစင် (Sword Shrine)
                    </span>
                    <span className="ghost-radar-stat-dist">{swordDistanceM}m အကွာတွင် ရှိသည်</span>
                  </div>
                )}

                <span className="ghost-radar-fullscreen-hint">
                  💡 Double-click / Double-tap သို့မဟုတ် ✕ နှိပ်၍ မူလအဝိုင်းသို့ ပြန်သွားနိုင်ပါသည်
                </span>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div
        ref={containerRef}
        className={widgetClassName}
        style={inlineStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <div
          className={`ghost-radar-circle ghost-radar-size-${sizeMode}`}
          title="နေရာရွှေ့ရန် ဖိဆွဲပါ / မျက်နှာပြင်ပြည့် ဖွင့်ရန် နှစ်ချက်နှိပ်ပါ (Double click/tap for fullscreen)"
          onDoubleClick={handleCircleDoubleClick}
        >
          {/* Enlarge, Minimize and Fullscreen Overlay Buttons */}
          <div
            className="ghost-radar-controls"
            onPointerDown={e => e.stopPropagation()}
          >
            <button
              type="button"
              className="ghost-radar-btn"
              title="မျက်နှာပြင်ပြည့် ဖွင့်မည် (Fullscreen)"
              aria-label="Open Fullscreen Radar"
              onClick={openFullscreenDialog}
            >
              ⛶
            </button>
            <button
              type="button"
              className="ghost-radar-btn"
              title={sizeMode === 'normal' ? 'ကြီးရန် (Enlarge)' : 'မူလအရွယ် (Normal)'}
              aria-label={sizeMode === 'normal' ? 'Enlarge Radar' : 'Normal Size Radar'}
              onClick={() => handleSetSizeMode(sizeMode === 'normal' ? 'large' : 'normal')}
            >
              {sizeMode === 'normal' ? '⌕' : '❐'}
            </button>
            <button
              type="button"
              className="ghost-radar-btn"
              title="သေးရန် / ဖျောက်ထားရန် (Minimize)"
              aria-label="Minimize Radar"
              onClick={() => handleSetSizeMode('minimized')}
            >
              −
            </button>
          </div>

          {/* Circular Radar Visual */}
          <RadarSvgContent
            snapshot={snapshot}
            markers={markers}
            playerClamped={playerClamped}
            proj={proj}
            field={field}
          />
        </div>
      </div>

      {fullscreenModal}
    </>
  );
}

function RadarSvgContent({
  snapshot,
  markers,
  playerClamped,
  proj,
  field,
}: {
  snapshot: Snapshot;
  markers: Array<{
    id: string;
    index: number;
    color: string;
    defeated: boolean;
    x?: number;
    z?: number;
    source?: string;
  }>;
  playerClamped: { x: number; y: number; clamped: boolean } | null;
  proj: { x: (v: number) => number; y: (v: number) => number; scale: number };
  field: { x: number; z: number; width: number; depth: number; rotation: number };
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      className="ghost-radar-svg"
      role="img"
      aria-label="Ghost and player location radar"
    >
      <defs>
        <clipPath id="ghostRadarClip">
          <circle cx="100" cy="100" r="97" />
        </clipPath>
      </defs>

      <g clipPath="url(#ghostRadarClip)">
        {/* Background circular radar screen */}
        <circle cx="100" cy="100" r="98" fill="#08171f" />

        {/* Range distance rings */}
        <circle cx="100" cy="100" r="32" fill="none" stroke="#164e63" strokeWidth="0.75" strokeDasharray="3 3" />
        <circle cx="100" cy="100" r="64" fill="none" stroke="#164e63" strokeWidth="0.75" strokeDasharray="3 3" />
        <circle cx="100" cy="100" r="94" fill="none" stroke="#334155" strokeWidth="1" />

        {/* Crosshair grid lines */}
        <line x1="100" y1="8" x2="100" y2="192" stroke="#164e63" strokeWidth="0.6" strokeDasharray="3 4" opacity="0.6" />
        <line x1="8" y1="100" x2="192" y2="100" stroke="#164e63" strokeWidth="0.6" strokeDasharray="3 4" opacity="0.6" />

        {/* Cardinal North indicator */}
        <text x="100" y="16" fill="#f6ce67" fontSize="8" fontWeight="bold" textAnchor="middle" opacity="0.8">
          N
        </text>

        {/* Football pitch boundary & Sword shrine */}
        <rect
          x={proj.x(field.x) - (field.width * proj.scale) / 2}
          y={proj.y(field.z) - (field.depth * proj.scale) / 2}
          width={field.width * proj.scale}
          height={field.depth * proj.scale}
          transform={`rotate(${(-field.rotation * 180) / Math.PI} ${proj.x(field.x)} ${proj.y(field.z)})`}
          fill="rgba(16, 185, 129, 0.05)"
          stroke="#10b981"
          strokeWidth="0.9"
          strokeDasharray="4 3"
          opacity="0.55"
        />
        <circle
          cx={proj.x(field.x)}
          cy={proj.y(field.z)}
          r={Math.max(4, SWORD_PICKUP_RADIUS_M * proj.scale)}
          fill="rgba(250, 204, 21, 0.15)"
          stroke="#facc15"
          strokeWidth="0.9"
          strokeDasharray="3 2"
        />
        <text
          x={proj.x(field.x)}
          y={proj.y(field.z) + 3}
          fontSize="8"
          fill="#fde68a"
          textAnchor="middle"
        >
          ⚔
        </text>

        {/* Ghost markers */}
        {markers.map((g, i) => {
          if (g.x === undefined || g.z === undefined || g.defeated) return null;
          const clamped = clampToRadarCircle(proj.x(g.x), proj.y(g.z), 100, 100, 86);
          return (
            <g key={g.id}>
              {/* Subtle pulse aura */}
              <circle
                cx={clamped.x}
                cy={clamped.y}
                r="8"
                fill={g.color}
                className="ghost-blip-pulse"
              />
              {/* Ghost blip dot */}
              <circle
                cx={clamped.x}
                cy={clamped.y}
                r="5"
                fill={g.color}
                stroke="#ffffff"
                strokeWidth="1.2"
                strokeDasharray={g.source === 'spawn' || g.source === 'guard' ? '2 1.5' : undefined}
              />
              {/* Ghost number badge */}
              <text
                x={clamped.x}
                y={clamped.y + 2.5}
                fontSize="7"
                fontWeight="bold"
                fill="#111827"
                textAnchor="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}

        {/* Player marker with head direction pointer */}
        {playerClamped && (
          <g>
            {/* Vision cone & direction pointer rotated by character head orientation */}
            {typeof snapshot.player?.yaw === 'number' && (
              <g transform={`rotate(${(-snapshot.player.yaw * 180) / Math.PI} ${playerClamped.x} ${playerClamped.y})`}>
                {/* Vision cone arc */}
                <path
                  d={`M ${playerClamped.x} ${playerClamped.y} L ${playerClamped.x - 12} ${playerClamped.y - 25} A 28 28 0 0 1 ${playerClamped.x + 12} ${playerClamped.y - 25} Z`}
                  fill="rgba(56, 189, 248, 0.3)"
                />
                {/* Head direction pointer triangle */}
                <polygon
                  points={`${playerClamped.x},${playerClamped.y - 14} ${playerClamped.x - 4.5},${playerClamped.y - 4} ${playerClamped.x},${playerClamped.y - 6} ${playerClamped.x + 4.5},${playerClamped.y - 4}`}
                  fill="#38bdf8"
                  stroke="#ffffff"
                  strokeWidth="0.8"
                />
              </g>
            )}
            <circle
              cx={playerClamped.x}
              cy={playerClamped.y}
              r="7"
              fill="#38bdf8"
              className="player-blip-pulse"
            />
            <circle
              cx={playerClamped.x}
              cy={playerClamped.y}
              r="4.5"
              fill="#38bdf8"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={playerClamped.x}
              y={playerClamped.y + 11}
              fill="#38bdf8"
              fontSize="7"
              fontWeight="bold"
              textAnchor="middle"
            >
              YOU
            </text>
          </g>
        )}
      </g>

      {/* Outer radar metallic ring */}
      <circle
        cx="100"
        cy="100"
        r="98"
        fill="none"
        stroke="rgba(246, 206, 108, 0.45)"
        strokeWidth="2"
      />
    </svg>
  );
}
