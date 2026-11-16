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
