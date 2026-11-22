/**
 * ============================================================================
 * Shared Live Spatial Avoidance Registry for Mountain Wildlife
 * (`တောင်ပေါ် ယုန် ၊ သမင် နှင့် ကျား တစ်ကောင်နှင့်တစ်ကောင် မတိုက်မိအောင် ရှောင်ခြင်း`)
 * ============================================================================
 * Tracks active pooled rabbits, deer, and tigers in-place with ZERO per-frame
 * allocations so every animal smoothly steers around other animals (same &
 * cross-species) and the player instead of passing through them.
 */

export type WildlifeActorKind = 'rabbit' | 'deer' | 'tiger';

export interface ActiveWildlifeActor {
  readonly id: string;
  readonly kind: WildlifeActorKind;
  x: number;
  z: number;
  radius: number;
}

const activeActors = new Map<string, ActiveWildlifeActor>();

export function upsertWildlifeActor(
  id: string,
  kind: WildlifeActorKind,
  x: number,
  z: number,
  radius: number,
): void {
  const existing = activeActors.get(id);
  if (existing) {
    existing.x = x;
    existing.z = z;
    existing.radius = radius;
    return;
  }
  activeActors.set(id, { id, kind, x, z, radius });
}

export function removeWildlifeActor(id: string): void {
  activeActors.delete(id);
}

export function clearWildlifeActors(kind?: WildlifeActorKind): void {
  if (!kind) {
    activeActors.clear();
    return;
  }
  for (const [id, actor] of activeActors) {
    if (actor.kind === kind) activeActors.delete(id);
  }
}

export function getActiveWildlifeActorCount(): number {
  return activeActors.size;
}

export interface AvoidanceOut {
  steerX: number;
  steerZ: number;
  blocked: boolean;
}

/**
 * Computes a smooth repulsive steering vector away from nearby active wildlife
 * (rabbits, deer, tigers) AND the player so animals gracefully curve around
 * each other before contact.
 */
export function computeWildlifeAvoidance(
  selfId: string,
  x: number,
  z: number,
  selfRadius: number,
  playerX: number,
  playerZ: number,
  out: AvoidanceOut,
): AvoidanceOut {
  let sx = 0;
  let sz = 0;
  let blocked = false;

  // 1. Avoid all other active wildlife actors (same & cross-species)
  for (const other of activeActors.values()) {
    if (other.id === selfId) continue;
    const dx = x - other.x;
    const dz = z - other.z;
    const minSep = selfRadius + other.radius;
    const avoidRange = minSep + 1.45;
    const distSq = dx * dx + dz * dz;
    if (distSq >= avoidRange * avoidRange) continue;

    if (distSq < 1e-6) {
      // Deterministic tie-breaker push when two actors share exact coordinates
      const hash = selfId.length * 1.7 + other.id.length * 2.3;
      sx += Math.cos(hash) * 2.0;
      sz += Math.sin(hash) * 2.0;
      blocked = true;
      continue;
    }

    const dist = Math.sqrt(distSq);
    const weight = (avoidRange - dist) / avoidRange;
    const strength = dist < minSep ? 3.2 : 1.45;
    sx += (dx / dist) * weight * strength;
    sz += (dz / dist) * weight * strength;
    if (dist < minSep) blocked = true;
  }

  // 2. Also gently steer around the player so animals never clip through the character
  if (Number.isFinite(playerX) && Number.isFinite(playerZ)) {
    const dx = x - playerX;
    const dz = z - playerZ;
    const minPlayerSep = selfRadius + 0.72;
    const playerAvoidRange = minPlayerSep + 1.4;
    const distSq = dx * dx + dz * dz;
    if (distSq > 1e-6 && distSq < playerAvoidRange * playerAvoidRange) {
      const dist = Math.sqrt(distSq);
      const weight = (playerAvoidRange - dist) / playerAvoidRange;
      sx += (dx / dist) * weight * (dist < minPlayerSep ? 3.0 : 1.5);
      sz += (dz / dist) * weight * (dist < minPlayerSep ? 3.0 : 1.5);
      if (dist < minPlayerSep) blocked = true;
    }
  }

  out.steerX = sx;
  out.steerZ = sz;
  out.blocked = blocked;
  return out;
}

/**
 * Hard non-overlap guard verifying candidate step `(nx, nz)` does NOT enter
 * another active animal's body or the player's body.
 */
export function isWildlifeStepClear(
  selfId: string,
  nx: number,
  nz: number,
  selfRadius: number,
  playerX: number,
  playerZ: number,
): boolean {
  for (const other of activeActors.values()) {
    if (other.id === selfId) continue;
    const minSep = selfRadius + other.radius;
    const dx = nx - other.x;
    const dz = nz - other.z;
    if (dx * dx + dz * dz < minSep * minSep) return false;
  }
  if (Number.isFinite(playerX) && Number.isFinite(playerZ)) {
    const minPlayerSep = selfRadius + 0.65;
    const dx = nx - playerX;
    const dz = nz - playerZ;
    if (dx * dx + dz * dz < minPlayerSep * minPlayerSep) return false;
  }
  return true;
}
