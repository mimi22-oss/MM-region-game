import { WALKIN_SCHOOL_HALLS, type SchoolHallSpec } from './schoolClassrooms.ts';

/**
 * ============================================================================
 * All-Schools Fixed Object Pool Controller (Singleton Cache + Fixed Slot Pool)
 * ============================================================================
 *
 * Manages ALL 10 village/ward schools (32 distinct multi-classroom halls with
 * unique designs, layouts, storeys, stairs, colours, and orientations) through
 * ONE bounded Fixed Object Pool (`12` slots desktop / `8` slots mobile).
 *
 * - Pre-allocates `capacity` reusable slots ONCE (ZERO dynamic pool growth).
 * - Sticky slot assignment: halls staying in range retain their exact slot index
 *   (no flicker / no unnecessary remounts).
 * - As the player travels between Myothar, Thar Si, Kanbale, Htomar, Htauk Kyant,
 *   Kyar Inn, and Nat Myaung, distant halls release their slots and nearby halls
 *   recycle those exact slots while sharing 100% Singleton `SchoolBuildingAssetCache`
 *   GPU geometries and materials.
 */

export interface PooledSchoolHallSlot {
  readonly slotIndex: number;
  hall: SchoolHallSpec | null;
}

export const SCHOOL_HALL_POOL_DESKTOP = 12;
export const SCHOOL_HALL_POOL_MOBILE = 8;

export class SchoolHallFixedPoolController {
  readonly halls: readonly SchoolHallSpec[];
  readonly capacity: number;
  readonly activeRadius: number;
  readonly slots: PooledSchoolHallSlot[];

  private assigned = new Map<string, number>();

  constructor(
    capacity: number = SCHOOL_HALL_POOL_DESKTOP,
    activeRadius = 260,
    halls: readonly SchoolHallSpec[] = WALKIN_SCHOOL_HALLS,
  ) {
    this.halls = halls;
    this.capacity = Math.max(1, capacity);
    this.activeRadius = activeRadius;
    this.slots = Array.from({ length: this.capacity }, (_, slotIndex) => ({
      slotIndex,
      hall: null,
    }));
  }

  /**
   * Rebalances the fixed pool slots around `(focusX, focusZ)` for `activeRegions`.
   * Returns `changed = true` only when at least one slot's bound hall changed.
   */
  rebalance(
    focusX: number,
    focusZ: number,
    activeRegions: readonly string[],
  ): { changed: boolean; activeCount: number } {
    const activeSet = new Set(activeRegions);
    const maxDistSq = this.activeRadius * this.activeRadius;

    const candidates: { hall: SchoolHallSpec; distSq: number }[] = [];
    for (let i = 0; i < this.halls.length; i++) {
      const hall = this.halls[i];
      if (!activeSet.has(hall.regionId)) continue;
      const dx = hall.x - focusX;
      const dz = hall.z - focusZ;
      const distSq = dx * dx + dz * dz;
      if (distSq <= maxDistSq) {
        candidates.push({ hall, distSq });
      }
    }
    candidates.sort((a, b) => a.distSq - b.distSq);

    const desired: SchoolHallSpec[] = [];
    const desiredIds = new Set<string>();
    for (let i = 0; i < candidates.length && desired.length < this.capacity; i++) {
      desired.push(candidates[i].hall);
      desiredIds.add(candidates[i].hall.id);
    }

    let changed = false;

    // 1. Release slots whose halls are no longer in the desired set
    for (let si = 0; si < this.slots.length; si++) {
      const slot = this.slots[si];
      if (!slot.hall) continue;
      if (!desiredIds.has(slot.hall.id)) {
        this.assigned.delete(slot.hall.id);
        slot.hall = null;
        changed = true;
      }
    }

    // 2. Bind newly entering nearby halls into freed fixed slots (preserving sticky slots)
    let nextIdx = 0;
    for (let si = 0; si < this.slots.length && nextIdx < desired.length; si++) {
      if (this.slots[si].hall !== null) continue;
      while (nextIdx < desired.length && this.assigned.has(desired[nextIdx].id)) {
        nextIdx++;
      }
      if (nextIdx >= desired.length) break;
      const hall = desired[nextIdx++];
      this.slots[si].hall = hall;
      this.assigned.set(hall.id, si);
      changed = true;
    }

    return { changed, activeCount: this.assigned.size };
  }

  dispose(): void {
    this.assigned.clear();
    for (let si = 0; si < this.slots.length; si++) {
      this.slots[si].hall = null;
    }
  }
}
