/**
 * Smooth collision-safe knockback trajectory for Ghost strikes using `flying-back-away.glb`.
 *
 * Exact knockback distances per Ghost tier:
 * - `ghost-1`: 0.5m
 * - `ghost-2`: 1.0m
 * - `ghost-3`: 2.0m
 */

export const GHOST_KNOCKBACK_DIST_M: Readonly<Record<string, number>> = {
  'ghost-1': 0.5,
  'ghost-2': 1.0,
  'ghost-3': 2.0,
};

export function getGhostKnockbackDistance(ghostId: string): number {
  return GHOST_KNOCKBACK_DIST_M[ghostId] ?? 0.5;
}

export interface PlayerKnockbackLaunch {
  readonly distance: number;
  readonly durationSec: number;
  readonly playbackSpeed: number;
}

interface InternalKnockbackState {
  active: boolean;
  dirX: number;
  dirZ: number;
  faceYaw: number;
  totalDist: number;
  movedDist: number;
  elapsed: number;
  durationSec: number;
  seq: number;
}

const kb: InternalKnockbackState = {
  active: false,
  dirX: 0,
  dirZ: 1,
  faceYaw: 0,
  totalDist: 0,
  movedDist: 0,
  elapsed: 0,
  durationSec: 0.5,
  seq: 0,
};

/** Launches the player flying backward away from a striking ghost. */
export function triggerPlayerKnockback(opts: {
  ghostId: string;
  ghostX: number;
  ghostZ: number;
  playerX: number;
  playerZ: number;
}): PlayerKnockbackLaunch {
  const distance = getGhostKnockbackDistance(opts.ghostId);
  const dx = opts.playerX - opts.ghostX;
  const dz = opts.playerZ - opts.ghostZ;
  const len = Math.hypot(dx, dz);
  const dirX = len > 0.001 ? dx / len : 0;
  const dirZ = len > 0.001 ? dz / len : 1;

  // Duration & animation speed scale proportionally to knockback distance (0.5m / 1.0m / 2.0m)
  const durationSec = distance >= 1.8 ? 0.85 : distance >= 0.9 ? 0.62 : 0.46;
  const playbackSpeed = distance >= 1.8 ? 1.55 : distance >= 0.9 ? 1.85 : 2.25;

  kb.active = true;
  kb.dirX = dirX;
  kb.dirZ = dirZ;
  // Keep avatar facing the ghost while flying backward away from it (-Z forward convention in Player.tsx)
  kb.faceYaw = Math.atan2(dirX, dirZ);
  kb.totalDist = distance;
  kb.movedDist = 0;
  kb.elapsed = 0;
  kb.durationSec = durationSec;
  kb.seq += 1;

  return { distance, durationSec, playbackSpeed };
}

export function isPlayerKnockbackActive(): boolean {
  return kb.active;
}

export function resetPlayerKnockback(): void {
  kb.active = false;
  kb.movedDist = 0;
  kb.elapsed = 0;
  kb.totalDist = 0;
}

/**
 * Advances active knockback displacement along an ease-out trajectory (`1 - (1 - t)^2`)
 * while respecting world wall/fence collision via `canMoveTo`.
 */
export function stepPlayerKnockback(
  rawDt: number,
  pos: { x: number; z: number },
  canMoveTo?: (x: number, z: number) => boolean,
): { active: boolean; moved: number; faceYaw: number | null } {
  if (!kb.active) return { active: false, moved: 0, faceYaw: null };
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return { active: true, moved: 0, faceYaw: kb.faceYaw };

  kb.elapsed = Math.min(kb.durationSec, kb.elapsed + dt);
  const t = kb.durationSec > 0 ? kb.elapsed / kb.durationSec : 1;
  const eased = 1 - (1 - t) * (1 - t);
  const targetDist = kb.totalDist * eased;
  const deltaDist = Math.max(0, targetDist - kb.movedDist);

  let moved = 0;
  if (deltaDist > 0.0001) {
    const nx = pos.x + kb.dirX * deltaDist;
    const nz = pos.z + kb.dirZ * deltaDist;
    if (!canMoveTo || canMoveTo(nx, nz)) {
      pos.x = nx;
      pos.z = nz;
      moved = deltaDist;
    } else if (canMoveTo(nx, pos.z)) {
      moved = Math.abs(nx - pos.x);
      pos.x = nx;
    } else if (canMoveTo(pos.x, nz)) {
      moved = Math.abs(nz - pos.z);
      pos.z = nz;
    }
    kb.movedDist = targetDist;
  }

  const faceYaw = kb.faceYaw;
  if (kb.elapsed >= kb.durationSec) {
    kb.active = false;
  }
  return { active: kb.active || moved > 0, moved, faceYaw };
}
