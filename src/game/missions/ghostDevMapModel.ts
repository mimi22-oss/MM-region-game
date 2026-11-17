import type { GhostRuntimeEntry } from './ghostRuntimeRegistry';

export type DevMarker = {
  id: string; x?: number; z?: number; state: string;
  status: 'LIVE' | 'INACTIVE' | 'UNAVAILABLE';
  source: 'entity' | 'ai' | 'guard' | 'spawn' | 'unavailable';
};
export function selectDevMarker(id: string, runtime: Partial<GhostRuntimeEntry> | undefined,
  guard: { x: number; z: number; mode: string; initialized: boolean; updatedAt?: number } | undefined,
  spawn: { x: number; z: number } | undefined, now: number): DevMarker {
  if (runtime && runtime.updatedAt !== undefined && now - runtime.updatedAt >= 0 && now - runtime.updatedAt < 1000 &&
      Number.isFinite(runtime.x) && Number.isFinite(runtime.z) && (runtime.source === 'entity' || runtime.source === 'ai')) {
    return { id, x: runtime.x, z: runtime.z, state: runtime.state ?? 'UNKNOWN',
      status: runtime.active ? 'LIVE' : 'INACTIVE', source: runtime.source };
  }
  if (guard?.initialized && guard.updatedAt !== undefined && now - guard.updatedAt >= 0 && now - guard.updatedAt < 1000 &&
      Number.isFinite(guard.x) && Number.isFinite(guard.z)) {
    return { id, x: guard.x, z: guard.z, state: guard.mode, source: 'guard', status: 'INACTIVE' };
  }
  if (spawn && Number.isFinite(spawn.x) && Number.isFinite(spawn.z)) {
    return { id, ...spawn, state: 'UNKNOWN', source: 'spawn', status: 'UNAVAILABLE' };
  }
  return { id, state: 'UNKNOWN', source: 'unavailable', status: 'UNAVAILABLE' };
}
/** Uniform world scale, independent of the SVG's CSS dimensions. */
export function devMapProjection(points: ReadonlyArray<{ x: number; z: number }>) {
  const minX = Math.min(...points.map(p => p.x)) - 35;
  const maxX = Math.max(...points.map(p => p.x)) + 35;
  const minZ = Math.min(...points.map(p => p.z)) - 35;
  const maxZ = Math.max(...points.map(p => p.z)) + 35;
  const scale = Math.min(290 / (maxX - minX), 210 / (maxZ - minZ));
  return { x: (x: number) => 160 + (x - (minX + maxX) / 2) * scale,
    y: (z: number) => 120 + (z - (minZ + maxZ) / 2) * scale, scale };
}

/**
 * Uniform world scale for circular radar (square viewBox e.g. 200x200 with center at (100, 100)).
 * Preserves exact X/Z aspect ratio with no stretching or distortion.
 */
export function circularRadarProjection(
  points: ReadonlyArray<{ x: number; z: number }>,
  size = 200,
  padding = 24
) {
  const minX = Math.min(...points.map(p => p.x)) - padding;
  const maxX = Math.max(...points.map(p => p.x)) + padding;
  const minZ = Math.min(...points.map(p => p.z)) - padding;
  const maxZ = Math.max(...points.map(p => p.z)) + padding;
  const spanX = maxX - minX || 1;
  const spanZ = maxZ - minZ || 1;
  const maxSpan = Math.max(spanX, spanZ);
  const scale = (size - padding * 2) / maxSpan;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const cx = size / 2;
  const cy = size / 2;
  return {
    x: (xVal: number) => cx + (xVal - centerX) * scale,
    y: (zVal: number) => cy + (zVal - centerZ) * scale,
    scale,
    radius: (size / 2) - 4,
    cx,
    cy,
    centerX,
    centerZ,
  };
}

/**
 * Clamps coordinates to stay within the radar circular boundary with an indication if clamped.
 */
export function clampToRadarCircle(
  x: number,
  y: number,
  cx = 100,
  cy = 100,
  maxRadius = 88
): { x: number; y: number; clamped: boolean; angleRad: number } {
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const angleRad = Math.atan2(dy, dx);
  if (dist <= maxRadius) {
    return { x, y, clamped: false, angleRad };
  }
  const factor = maxRadius / dist;
  return { x: cx + dx * factor, y: cy + dy * factor, clamped: true, angleRad };
}
