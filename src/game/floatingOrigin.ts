/**
 * Quantized Floating-Origin coordinate utilities.
 * All streaming chunk vertex/instance transforms compute offsets relative to a chunk/origin anchor
 * in IEEE-754 Float64 before writing Float32 GPU buffers so large Myanmar-wide worlds preserve
 * sub-millimetre precision far from (0, 0).
 */

export type WorldOrigin = { x: number; y: number; z: number };

export const DEFAULT_FLOATING_ORIGIN_STEP_M = 512;

export function quantizeFloatingOrigin(
  worldX: number,
  worldZ: number,
  stepMeters = DEFAULT_FLOATING_ORIGIN_STEP_M,
  worldY = 0,
): WorldOrigin {
  if (!Number.isFinite(worldX) || !Number.isFinite(worldZ) || !Number.isFinite(worldY) || stepMeters <= 0) {
    return { x: 0, y: 0, z: 0 };
  }
  return {
    x: Math.round(worldX / stepMeters) * stepMeters,
    y: worldY,
    z: Math.round(worldZ / stepMeters) * stepMeters,
  };
}

/** Shifts active floating origin only when camera/actor leaves hysteresis threshold. */
export function updateFloatingOrigin(
  current: WorldOrigin,
  worldX: number,
  worldZ: number,
  stepMeters = DEFAULT_FLOATING_ORIGIN_STEP_M,
  hysteresisFactor = 0.75,
): { origin: WorldOrigin; shifted: boolean } {
  const threshold = stepMeters * Math.max(0.5, hysteresisFactor);
  if (Math.hypot(worldX - current.x, worldZ - current.z) < threshold) {
    return { origin: current, shifted: false };
  }
  const next = quantizeFloatingOrigin(worldX, worldZ, stepMeters, current.y);
  const shifted = next.x !== current.x || next.z !== current.z || next.y !== current.y;
  return { origin: next, shifted };
}

/** Float64 subtraction before narrowing to GPU Float32 attributes/matrices. */
export function worldToOriginLocal(
  worldX: number,
  worldZ: number,
  origin: WorldOrigin,
  worldY = 0,
): { x: number; y: number; z: number } {
  return {
    x: worldX - origin.x,
    y: worldY - origin.y,
    z: worldZ - origin.z,
  };
}

export function originLocalToWorld(
  localX: number,
  localZ: number,
  origin: WorldOrigin,
  localY = 0,
): { x: number; y: number; z: number } {
  return {
    x: localX + origin.x,
    y: localY + origin.y,
    z: localZ + origin.z,
  };
}

/** Computes a Float64 center anchor from a projected chunk bbox to keep instance transforms near (0,0). */
export function computeChunkOrigin(
  minX: number,
  maxX: number,
  minZ: number,
  maxZ: number,
): WorldOrigin {
  return {
    x: Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) / 2 : 0,
    y: 0,
    z: Number.isFinite(minZ) && Number.isFinite(maxZ) ? (minZ + maxZ) / 2 : 0,
  };
}
