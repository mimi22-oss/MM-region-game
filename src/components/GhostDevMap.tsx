import { useEffect, useMemo, useState } from 'react';
import { area5 } from '../data/wards/myothar/area5';
import { useActiveGhostZones } from '../game/ghostConfig';
import { guardMissionActive, getGuardSummary, swordGuardClear } from '../game/missions/ghostGuardCoordinator';
import { GHOST_IDS, SWORD_PICKUP_RADIUS_M, useThreeGhostsMission } from '../game/missions/threeGhostsMission';
import type { GhostRuntimeEntry } from '../game/missions/ghostRuntimeRegistry';
import { devMapProjection, selectDevMarker } from '../game/missions/ghostDevMapModel';

type Snapshot = { player: { x: number; z: number; yaw?: number } | null; ghosts: Partial<GhostRuntimeEntry>[] };
const EMPTY: Snapshot = { player: null, ghosts: [] };
const COLORS = ['#c084fc', '#fbbf24', '#fb7185'];
const distance = (a: { x?: number; z?: number }, b: { x: number; z: number } | null) =>
  a.x === undefined || a.z === undefined || !b ? '—' : `${Math.hypot(a.x-b.x, a.z-b.z).toFixed(1)}m`;

/** Lazy imported by the HUD only in Vite DEV; the scene owns the single 4Hz publisher. */
export default function GhostDevMap() {
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const progress = useThreeGhostsMission();
  const zones = useActiveGhostZones();
  useEffect(() => {
    if (!open) return;
    setSnapshot(EMPTY);
    const receive = (event: Event) => setSnapshot((event as CustomEvent<Snapshot>).detail);
    window.addEventListener('mm-ghost-debug-positions', receive);
    return () => window.removeEventListener('mm-ghost-debug-positions', receive);
  }, [open]);
  // Freeze bounds to authored anchors, never refit when a ghost/player moves.
  const { x, y, scale } = useMemo(() => devMapProjection([
    ...zones, { x: area5.pitch.x-80, z: area5.pitch.z-80 },
    { x: area5.pitch.x+80, z: area5.pitch.z+80 },
  ]), [zones]);
  const guards = guardMissionActive() ? getGuardSummary() : [];
  const now = performance.now();
  const markers = GHOST_IDS.map(id => selectDevMarker(id, snapshot.ghosts.find(g => g.id === id),
    guards.find(g => g.id === id), zones.find(z => z.ghostId === id), now));
  const pickupAllowed = !progress.swordCollected && swordGuardClear(20);
  const field = area5.pitch;
  return <div style={{ position: 'relative', marginTop: 6, fontSize: 12 }}>
    <button type="button" onClick={() => setOpen(v => !v)} aria-expanded={open}>🗺 Ghost Dev Map {open ? '▲' : '▼'}</button>
    {open && <div style={{ marginTop: 6, padding: 9, border: '1px solid #3b536b', borderRadius: 10, background: '#091622', width: 'min(320px, 82vw)', color: '#fff' }}>
      <strong>GHOST DEV MAP — LIVE</strong>
      <div>World X/Z · 4 updates/sec · fixed world scale</div>
      <div>Player: {snapshot.player ? `X ${snapshot.player.x.toFixed(2)}, Z ${snapshot.player.z.toFixed(2)}` : 'UNAVAILABLE'}</div>
      <svg viewBox="0 0 320 240" width="100%" role="img" aria-label="Live ghost and player location map" style={{ background: '#17372e', borderRadius: 7, marginTop: 6 }}>
        <rect x={x(field.x)-field.width*scale/2} y={y(field.z)-field.depth*scale/2}
          width={field.width*scale} height={field.depth*scale}
          transform={`rotate(${-field.rotation*180/Math.PI} ${x(field.x)} ${y(field.z)})`} fill="none" stroke="#d1fae5" strokeDasharray="4 3" />
        <circle cx={x(field.x)} cy={y(field.z)} r={SWORD_PICKUP_RADIUS_M*scale} fill="none" stroke="#facc15" strokeDasharray="3 3" />
        <text x={x(field.x)} y={y(field.z)} fontSize="12" fill="#fde68a">⚔ Field</text>
        {markers.map((g, i) => g.x === undefined || g.z === undefined ? null : <g key={g.id}>
          <circle cx={x(g.x)} cy={y(g.z)} r="7" fill={COLORS[i]} stroke="white"
            strokeDasharray={g.source === 'spawn' || g.source === 'guard' ? '3 2' : undefined} />
          <text x={x(g.x)} y={y(g.z)+3} fontSize="9" fontWeight="bold" fill="#111" textAnchor="middle">{i+1}</text>
        </g>)}
        {snapshot.player && <g>
          {typeof snapshot.player.yaw === 'number' && (
            <polygon
              transform={`rotate(${(-snapshot.player.yaw * 180) / Math.PI} ${x(snapshot.player.x)} ${y(snapshot.player.z)})`}
              points={`${x(snapshot.player.x)},${y(snapshot.player.z) - 13} ${x(snapshot.player.x) - 4.5},${y(snapshot.player.z) - 3} ${x(snapshot.player.x) + 4.5},${y(snapshot.player.z) - 3}`}
              fill="#38bdf8"
              stroke="white"
              strokeWidth="0.8"
            />
          )}
          <circle cx={x(snapshot.player.x)} cy={y(snapshot.player.z)} r="6" fill="#38bdf8" stroke="white" />
          <text x={x(snapshot.player.x)+8} y={y(snapshot.player.z)-8} fill="white" fontSize="10">YOU</text>
        </g>}
      </svg>
      <div>Sword: X {field.x.toFixed(2)}, Z {field.z.toFixed(2)}</div>
      <div>Encounter: {progress.encountered.length}/3 · Sword Pickup: {pickupAllowed ? 'ALLOWED' : 'BLOCKED'}{progress.swordCollected ? ' (collected)' : ''}</div>
      {markers.map((g, i) => <div key={g.id} style={{ color: COLORS[i], marginTop: 6 }}>
        <strong>Ghost {i+1}: {g.status}</strong> · {g.state}
        <div>{g.x === undefined || g.z === undefined ? 'Position unavailable' : `X ${g.x.toFixed(2)}, Z ${g.z.toFixed(2)}`} · {g.source === 'spawn' ? 'APPROXIMATE SPAWN' : g.source === 'guard' ? 'GUARD ESTIMATE (no live entity)' : g.source}</div>
        <div>Player: {distance(g, snapshot.player)} · Sword: {distance(g, field)}{g.source === 'spawn' || g.source === 'guard' ? ' (approx.)' : ''}</div>
      </div>)}
      <div style={{ opacity: .7, marginTop: 6 }}>Dashed markers are fallback estimates, never LIVE. Pickup requires all ghosts beyond 20m, then E and a 2s hold within 3.2m on foot.</div>
    </div>}
  </div>;
}
