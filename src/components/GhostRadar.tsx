import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
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

  const [isDragging, setIsDragging] = useState(false);

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
  const progress = useThreeGhostsMission();
  const zones = useActiveGhostZones();

  const handleSetSizeMode = (mode: RadarSizeMode) => {
    setSizeMode(mode);
    try {
      localStorage.setItem(STORAGE_SIZE_KEY, mode);
    } catch {
      // ignore
    }
  };

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

  // Pointer drag event handlers (identical robust pattern to ghost-hud-pill)
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
      // Tap/click without dragging: if minimized, expand to normal!
      if (sizeMode === 'minimized') {
        handleSetSizeMode('normal');
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

  // Double-click resets back to default position under life hearts
  const handleDoubleClick = () => {
    setPosition(null);
    try {
      localStorage.removeItem(STORAGE_POS_KEY);
    } catch {
      // ignore
    }
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

  // Process live markers for each ghost
  const markers = GHOST_IDS.map((id, index) => {
    const marker = selectDevMarker(
      id,
      snapshot.ghosts.find(g => g.id === id),
      guards.find(g => g.id === id),
      zones.find(z => z.ghostId === id),
      now
    );
    const defeated = isGhostDefeated(id);
    return {
      ...marker,
      index,
      defeated,
      color: GHOST_COLORS[index] || '#c084fc',
    };
  });

  const activeGhostsCount = markers.filter(m => !m.defeated).length;

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
        onDoubleClick={handleDoubleClick}
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

  return (
    <div
      ref={containerRef}
      className={widgetClassName}
      style={inlineStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className={`ghost-radar-circle ghost-radar-size-${sizeMode}`}
        title="နေရာရွှေ့ရန် ဖိဆွဲပါ / မူလနေရာသို့ ပြန်ထားရန် နှစ်ချက်နှိပ်ပါ"
      >
        {/* Enlarge and Minimize Overlay Buttons */}
        <div
          className="ghost-radar-controls"
          onPointerDown={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="ghost-radar-btn"
            title={sizeMode === 'normal' ? 'ကြီးရန် (Enlarge)' : 'မူလအရွယ် (Normal)'}
            aria-label={sizeMode === 'normal' ? 'Enlarge Radar' : 'Normal Size Radar'}
            onClick={() => handleSetSizeMode(sizeMode === 'normal' ? 'large' : 'normal')}
          >
            {sizeMode === 'normal' ? '⛶' : '❐'}
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

        {/* Circular Radar Visual (Clean gaming HUD, zero extraneous debug text) */}
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
      </div>
    </div>
  );
}
