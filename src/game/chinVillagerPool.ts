import { setChinHouseDoorOpen, clearChinHouseDoors } from './chinVillages.ts';
import type { WeipulaVillagerKind } from './weipulaVillagers.ts';

/**
 * ============================================================================
 * Chin Village Household Population Engine
 * (Singleton Memory Reference Cache + Fixed Object Pool Architecture)
 * ============================================================================
 *
 * Pure TypeScript simulation layer:
 * - Every Chin house receives a deterministic pseudo-random resident count between
 *   1 and 10 inclusive (some houses have 1 solo resident, some have 10 extended-family
 *   Chin members!).
 * - 100% Chin ethnic roles (`chin-woman`, `chin-man`, `chin-elder`, `chin-kid`) —
 *   no non-Chin bots ever spawn inside a Chin village.
 * - Pre-allocated Fixed Object Pool (`capacity = mobile ? 40 : 72`) dynamically recycles
 *   GPU character slots around the player/camera focus with ZERO allocation or GC churn.
 * - Smoothly opens/closes each house's OWN attached double front door via `chinVillages.ts`
 *   whenever a Chin resident exits/enters OR when the player walks up to the front doorway.
 */

export const CHIN_HOUSE_MIN_RESIDENTS = 1;
export const CHIN_HOUSE_MAX_RESIDENTS = 10;

export interface ChinCompoundBounds {
  readonly sideHalf: number;
  readonly backHalf: number;
  readonly frontHalf: number;
}

export function defaultChinCompoundBounds(width: number, depth: number): ChinCompoundBounds {
  return {
    sideHalf: width / 2 + 2.45,
    backHalf: depth / 2 + 2.55,
    frontHalf: depth / 2 + 6.45,
  };
}

export interface ChinHouseholdHouseInput {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly baseY: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
  readonly compound?: ChinCompoundBounds;
}

export type ChinResidentActivity = 'yard' | 'porch' | 'door-cycle' | 'lane';

export interface ChinHouseholdMemberState {
  readonly id: string;
  readonly houseId: string;
  readonly houseIndex: number;
  readonly memberIndex: number;
  readonly kind: Exclude<WeipulaVillagerKind, 'nurse'>;
  readonly outfitIndex: number;
  readonly skinIndex: number;
  readonly scale: number;
  readonly activity: ChinResidentActivity;
  readonly walkSpeed: number;
  readonly phaseOffset: number;
  // Local coordinates in the house's frame (front = +Z)
  lx: number;
  lz: number;
  targetLx: number;
  targetLz: number;
  localY: number;
  // World coordinates updated when active in pool
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
  speed: number;
  walkDist: number;
  elapsed: number;
  pauseTimer: number;
  /** True when inside house behind closed door (door-cycle members emerge & re-enter). */
  insideHouse: boolean;
  /** True while actively stepping across the attached front doorway threshold. */
  passingDoor: boolean;
  seed: number;
}

export interface ChinHouseholdSummary {
  readonly houseId: string;
  readonly houseIndex: number;
  readonly residentCount: number;
  readonly memberStart: number;
  readonly memberEnd: number;
}

export interface ChinVillageRoster {
  readonly households: readonly ChinHouseholdSummary[];
  readonly members: ChinHouseholdMemberState[];
  readonly totalResidents: number;
  readonly minPerHouse: number;
  readonly maxPerHouse: number;
}

function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function nextLcg(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

const CHIN_KINDS: readonly Exclude<WeipulaVillagerKind, 'nurse'>[] = [
  'chin-woman',
  'chin-man',
  'chin-elder',
  'chin-kid',
];

function houseLocalToWorld(
  h: ChinHouseholdHouseInput,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(h.rotation);
  const s = Math.sin(h.rotation);
  return {
    x: h.x + lx * c + lz * s,
    z: h.z - lx * s + lz * c,
  };
}

/**
 * Deterministically generates 1..10 random Chin ethnic residents for every Chin house.
 * Distribution explicitly produces both solo 1-person households and full 10-person households.
 */
export function buildChinVillageHouseholdRoster(
  houses: readonly ChinHouseholdHouseInput[],
  villageSeed = 20261121,
): ChinVillageRoster {
  const households: ChinHouseholdSummary[] = [];
  const members: ChinHouseholdMemberState[] = [];
  let minPerHouse = Infinity;
  let maxPerHouse = 0;

  for (let hi = 0; hi < houses.length; hi++) {
    const h = houses[hi];
    let seed = (hashString(h.id) ^ Math.imul(hi + 1, 2654435761) ^ villageSeed) >>> 0;
    let r: number;
    [seed, r] = nextLcg(seed);

    // Uniform 1..10 inclusive across houses so some have 1 person and some have 10 people
    const residentCount =
      CHIN_HOUSE_MIN_RESIDENTS +
      Math.floor(r * (CHIN_HOUSE_MAX_RESIDENTS - CHIN_HOUSE_MIN_RESIDENTS + 1));

    if (residentCount < minPerHouse) minPerHouse = residentCount;
    if (residentCount > maxPerHouse) maxPerHouse = residentCount;

    const memberStart = members.length;
    const bounds = h.compound ?? defaultChinCompoundBounds(h.width, h.depth);
    const halfW = h.width / 2;
    const halfD = h.depth / 2;
    const frontWallZ = -0.6 + (h.depth - 2.4) / 2;
    const yardMinZ = halfD + 1.2;
    const yardMaxZ = Math.max(yardMinZ + 0.8, bounds.frontHalf - 0.85);

    for (let mi = 0; mi < residentCount; mi++) {
      let rKind: number;
      let rPos1: number;
      let rPos2: number;
      let rStyle: number;
      [seed, rKind] = nextLcg(seed);
      [seed, rPos1] = nextLcg(seed);
      [seed, rPos2] = nextLcg(seed);
      [seed, rStyle] = nextLcg(seed);

      // Authentic Chin household composition:
      // Solo houses (1 resident) are always adult/elder; larger families mix women, men, elders & kids.
      let kind: Exclude<WeipulaVillagerKind, 'nurse'>;
      if (residentCount === 1) {
        kind = rKind < 0.38 ? 'chin-elder' : rKind < 0.7 ? 'chin-woman' : 'chin-man';
      } else if (mi === 0) {
        kind = rKind < 0.5 ? 'chin-woman' : 'chin-man';
      } else if (mi === 1) {
        kind = rKind < 0.5 ? 'chin-man' : 'chin-woman';
      } else if (mi === 2 && residentCount >= 4) {
        kind = 'chin-elder';
      } else {
        kind = CHIN_KINDS[Math.floor(rKind * CHIN_KINDS.length)];
      }

      const scale =
        kind === 'chin-kid'
          ? 0.72 + rStyle * 0.1
          : kind === 'chin-woman'
            ? 0.94 + rStyle * 0.06
            : 1.0 + rStyle * 0.07;

      // Distribute household members cleanly across attached-door entry/exit, veranda, spacious yard, and front gate lane
      let activity: ChinResidentActivity;
      if (mi === 0) {
        activity = 'door-cycle';
      } else if (mi === 1 && residentCount >= 2) {
        activity = 'porch';
      } else if (mi % 3 === 2) {
        activity = 'lane';
      } else {
        activity = 'yard';
      }

      let lx = 0;
      let lz = yardMinZ + rPos2 * (yardMaxZ - yardMinZ);
      let localY = 0.04;
      let insideHouse = false;

      if (activity === 'porch') {
        lx = (rPos1 - 0.5) * Math.max(1.8, h.width - 2.4);
        lz = halfD - 1.1;
        localY = 0.85;
      } else if (activity === 'door-cycle') {
        // Starts outside on the front yard or veranda, cycling smoothly through the attached double door
        lx = (rPos1 - 0.5) * 2.2;
        lz = rPos2 < 0.5 ? halfD - 0.95 : yardMinZ + 0.9;
        localY = lz < halfD + 0.2 ? 0.85 : 0.04;
        insideHouse = false;
      } else if (activity === 'lane') {
        lx = (rPos1 - 0.5) * (bounds.sideHalf * 1.6);
        lz = bounds.frontHalf + 1.05 + rPos2 * 0.9;
        localY = 0.04;
      } else {
        // Spacious compound front yard
        lx = (rPos1 - 0.5) * Math.max(2.4, bounds.sideHalf * 1.72);
        lz = yardMinZ + rPos2 * (yardMaxZ - yardMinZ);
        localY = 0.04;
      }

      // Guard against spawning inside the house walls
      if (activity !== 'porch' && activity !== 'door-cycle' && Math.abs(lx) < halfW + 0.5 && lz < halfD + 0.6) {
        lz = yardMinZ + 0.5;
      }

      const world = houseLocalToWorld(h, lx, lz);
      const walkSpeed =
        activity === 'porch'
          ? 0.32 + rStyle * 0.14
          : kind === 'chin-kid'
            ? 0.95 + rStyle * 0.25
            : 0.62 + rStyle * 0.34;

      members.push({
        id: `${h.id}-chin-${mi + 1}`,
        houseId: h.id,
        houseIndex: hi,
        memberIndex: mi,
        kind,
        outfitIndex: (hi * 3 + mi) % 4,
        skinIndex: (hi + mi) % 3,
        scale: Number(scale.toFixed(3)),
        activity,
        walkSpeed: Number(walkSpeed.toFixed(3)),
        phaseOffset: rPos1 * Math.PI * 2,
        lx,
        lz,
        targetLx: lx,
        targetLz: lz,
        localY,
        worldX: world.x,
        worldY: h.baseY + localY,
        worldZ: world.z,
        yaw: h.rotation + (rPos2 - 0.5) * Math.PI,
        speed: 0,
        walkDist: 0,
        elapsed: rPos1 * 6.0,
        pauseTimer: 0.5 + rPos2 * 2.5,
        insideHouse,
        passingDoor: false,
        seed: (seed ^ (mi * 9973 + 17)) >>> 0,
      });

      // Suppress unused warning while documenting frontWallZ relation
      void frontWallZ;
    }

    households.push({
      houseId: h.id,
      houseIndex: hi,
      residentCount,
      memberStart,
      memberEnd: members.length,
    });
  }

  return {
    households,
    members,
    totalResidents: members.length,
    minPerHouse: houses.length > 0 ? minPerHouse : 0,
    maxPerHouse,
  };
}

export interface PooledChinVillagerSlot {
  readonly slotIndex: number;
  member: ChinHouseholdMemberState | null;
}

export interface PooledChinDoorSlot {
  readonly slotIndex: number;
  house: ChinHouseholdHouseInput | null;
  open: number;
}

/**
 * Fixed Object Pool controller for Chin Village residents & attached doors.
 * - Pre-allocates `capacity` villager slots & `doorCapacity` attached-door slots ONCE.
 * - Dynamically assigns the nearest Chin houses' 1..10 household members around `(focusX, focusZ)`.
 * - Follows Myothar Area 5 daytime/nighttime rhythm:
 *   - Daytime (`morning` / `day` / `evening`): Chin residents walk in & out of their attached
 *     front doors, relax on verandas, stroll spacious yards, and visit neighbors on lanes.
 *   - Nighttime: residents step back inside their homes and doors close smoothly.
 */
export class ChinVillagerFixedPoolController {
  readonly houses: readonly ChinHouseholdHouseInput[];
  readonly roster: ChinVillageRoster;
  readonly capacity: number;
  readonly doorCapacity: number;
  readonly activeRadius: number;
  readonly slots: PooledChinVillagerSlot[];
  readonly doorSlots: PooledChinDoorSlot[];

  private assignedMembers = new Set<ChinHouseholdMemberState>();
  private houseDoorTargets = new Map<string, number>();
  private houseDoorCurrent = new Map<string, number>();
  private nearbyHouseIndices: number[] = [];
  private rebalanceTimer = 0;

  constructor(
    houses: readonly ChinHouseholdHouseInput[],
    capacity: number,
    activeRadius = 115,
    villageSeed = 20261121,
    doorCapacity = 36,
  ) {
    this.houses = houses;
    this.roster = buildChinVillageHouseholdRoster(houses, villageSeed);
    this.capacity = Math.max(1, capacity);
    this.doorCapacity = Math.max(1, doorCapacity);
    this.activeRadius = activeRadius;
    this.slots = Array.from({ length: this.capacity }, (_, slotIndex) => ({
      slotIndex,
      member: null,
    }));
    this.doorSlots = Array.from({ length: this.doorCapacity }, (_, slotIndex) => ({
      slotIndex,
      house: null,
      open: 0,
    }));
  }

  /**
   * Re-evaluates which Chin houses are closest to `(focusX, focusZ)` and assigns their
   * 1..10 residents & attached swinging doors into the fixed pool slots.
   * Slots locked in active combat (`isSlotLocked`) are never evicted mid-fight!
   */
  rebalance(focusX: number, focusZ: number, isSlotLocked?: (slotIndex: number) => boolean): void {
    const maxDistSq = this.activeRadius * this.activeRadius;
    const candidates: { hi: number; distSq: number }[] = [];

    for (let hi = 0; hi < this.houses.length; hi++) {
      const h = this.houses[hi];
      const dx = h.x - focusX;
      const dz = h.z - focusZ;
      const dSq = dx * dx + dz * dz;
      if (dSq <= maxDistSq) {
        candidates.push({ hi, distSq: dSq });
      }
    }
    candidates.sort((a, b) => a.distSq - b.distSq);

    this.nearbyHouseIndices.length = 0;
    const desiredMembers: ChinHouseholdMemberState[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const hi = candidates[i].hi;
      this.nearbyHouseIndices.push(hi);
      if (desiredMembers.length >= this.capacity) continue;
      const hh = this.roster.households[hi];
      for (let m = hh.memberStart; m < hh.memberEnd && desiredMembers.length < this.capacity; m++) {
        desiredMembers.push(this.roster.members[m]);
      }
    }

    // Bind nearest Chin houses to the fixed attached-door pool (always 1 attached door per house)
    for (let di = 0; di < this.doorSlots.length; di++) {
      const slot = this.doorSlots[di];
      if (di < candidates.length) {
        const h = this.houses[candidates[di].hi];
        slot.house = h;
        slot.open = this.houseDoorCurrent.get(h.id) ?? 0;
      } else {
        slot.house = null;
        slot.open = 0;
      }
    }

    const desiredSet = new Set(desiredMembers);

    // 1. Release unlocked slots whose assigned resident is no longer in the nearest set
    for (let si = 0; si < this.slots.length; si++) {
      if (isSlotLocked && isSlotLocked(si)) continue;
      const slot = this.slots[si];
      if (slot.member && !desiredSet.has(slot.member)) {
        this.assignedMembers.delete(slot.member);
        slot.member = null;
      }
    }

    // 2. Fill free slots with newly-nearby Chin residents
    let nextIdx = 0;
    for (let si = 0; si < this.slots.length && nextIdx < desiredMembers.length; si++) {
      if (this.slots[si].member !== null) continue;
      while (nextIdx < desiredMembers.length && this.assignedMembers.has(desiredMembers[nextIdx])) {
        nextIdx++;
      }
      if (nextIdx >= desiredMembers.length) break;
      const m = desiredMembers[nextIdx++];
      this.slots[si].member = m;
      this.assignedMembers.add(m);
    }
  }

  private stepMember(m: ChinHouseholdMemberState, dt: number, daytime: boolean): void {
    const h = this.houses[m.houseIndex];
    const bounds = h.compound ?? defaultChinCompoundBounds(h.width, h.depth);
    const halfD = h.depth / 2;
    const frontWallZ = -0.6 + (h.depth - 2.4) / 2;
    const porchZ = halfD - 1.05;
    const yardMinZ = halfD + 1.25;
    const yardMaxZ = Math.max(yardMinZ + 0.8, bounds.frontHalf - 0.85);

    m.elapsed += dt;
    m.passingDoor = false;

    // Nighttime living-hours behavior (matches Myothar Area 5): residents stay indoors at night
    if (!daytime) {
      if (!m.insideHouse) {
        m.insideHouse = true;
        m.lx = 0;
        m.lz = frontWallZ - 0.4;
        m.speed = 0;
        m.pauseTimer = 1.5;
      }
      return;
    }

    // Daytime resume: if a resident was inside for the night, emerge back out through the attached front door
    if (m.insideHouse && m.activity !== 'door-cycle') {
      m.insideHouse = false;
      m.lx = 0;
      m.lz = frontWallZ - 0.25;
      m.targetLx = (m.memberIndex % 2 === 0 ? -1 : 1) * 1.4;
      m.targetLz = yardMinZ + 1.0;
      m.pauseTimer = 0;
    }

    if (m.pauseTimer > 0) {
      m.pauseTimer -= dt;
      m.speed = 0;
      if (m.pauseTimer <= 0) {
        let r1: number;
        let r2: number;
        [m.seed, r1] = nextLcg(m.seed);
        [m.seed, r2] = nextLcg(m.seed);

        if (m.activity === 'porch') {
          m.targetLx = (r1 - 0.5) * Math.max(1.8, h.width - 2.4);
          m.targetLz = porchZ + (r2 - 0.5) * 0.45;
        } else if (m.activity === 'door-cycle') {
          if (m.insideHouse) {
            // Emerge smoothly through the attached double front door onto veranda / front yard
            m.insideHouse = false;
            m.lx = 0;
            m.lz = frontWallZ - 0.35;
            m.targetLx = (r1 - 0.5) * 2.0;
            m.targetLz = r2 < 0.45 ? porchZ + 0.25 : yardMinZ + 1.4;
          } else if (r2 < 0.36) {
            // Walk back toward the attached front doorway to step inside
            m.targetLx = 0;
            m.targetLz = frontWallZ - 0.4;
          } else if (r2 > 0.76) {
            // Walk out through the open front gate onto the adjacent village lane
            m.targetLx = (r1 - 0.5) * 2.0;
            m.targetLz = bounds.frontHalf + 1.2;
          } else {
            // Stroll across veranda or spacious front yard
            m.targetLx = (r1 - 0.5) * Math.max(2.2, bounds.sideHalf * 1.45);
            m.targetLz = yardMinZ + r2 * (yardMaxZ - yardMinZ);
          }
        } else if (m.activity === 'lane') {
          m.targetLx = (r1 - 0.5) * (bounds.sideHalf * 1.9);
          m.targetLz = bounds.frontHalf + 1.0 + r2 * 0.9;
        } else {
          // Yard residents occasionally also step through the attached front door or out the gate
          if (r2 < 0.16) {
            m.targetLx = 0;
            m.targetLz = porchZ;
          } else {
            m.targetLx = (r1 - 0.5) * Math.max(2.6, bounds.sideHalf * 1.72);
            m.targetLz = yardMinZ + r2 * (yardMaxZ - yardMinZ);
          }
        }
      }
    } else if (!m.insideHouse) {
      const dx = m.targetLx - m.lx;
      const dz = m.targetLz - m.lz;
      const dist = Math.hypot(dx, dz);

      if (dist < 0.22) {
        m.speed = 0;
        let rWait: number;
        [m.seed, rWait] = nextLcg(m.seed);
        if (m.activity === 'door-cycle' && m.targetLz < frontWallZ + 0.1) {
          // Stepped cleanly inside through the attached front door
          m.insideHouse = true;
          m.pauseTimer = 3.0 + rWait * 4.0;
        } else {
          m.pauseTimer = 1.4 + rWait * 3.0;
        }
      } else {
        const step = Math.min(dist, m.walkSpeed * dt);
        const nx = dx / dist;
        const nz = dz / dist;
        m.lx += nx * step;
        m.lz += nz * step;
        m.speed = step / Math.max(0.001, dt);
        m.walkDist += step;

        const targetYaw = h.rotation + Math.atan2(nx, nz);
        let diff = targetYaw - m.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        m.yaw += diff * Math.min(1, dt * 6.5);
      }
    }

    // Smooth vertical elevation transition between veranda (0.85m), approach steps, and ground yard (0.04m)
    if (m.lz <= halfD + 0.15) {
      m.localY = 0.85;
    } else if (m.lz < halfD + 0.95) {
      const t = (m.lz - (halfD + 0.15)) / 0.8;
      m.localY = 0.85 + (0.04 - 0.85) * t;
    } else {
      m.localY = 0.04;
    }

    // Trigger the house's OWN attached front door whenever a resident is crossing the threshold!
    if (
      !m.insideHouse &&
      Math.abs(m.lx) < 1.35 &&
      m.lz >= frontWallZ - 0.7 &&
      m.lz <= frontWallZ + 1.35
    ) {
      m.passingDoor = true;
    }

    const w = houseLocalToWorld(h, m.lx, m.lz);
    m.worldX = w.x;
    m.worldY = h.baseY + m.localY;
    m.worldZ = w.z;
  }

  /**
   * Advances active pooled Chin villagers & updates each nearby Chin house's OWN
   * attached front double door open state (`0..1`).
   */
  update(
    focusX: number,
    focusZ: number,
    dt: number,
    forceRebalance = false,
    daytime = true,
    isSlotLocked?: (slotIndex: number) => boolean,
  ): void {
    const clampedDt = Math.min(0.08, Math.max(0, dt));
    this.rebalanceTimer -= clampedDt;
    if (forceRebalance || this.rebalanceTimer <= 0) {
      this.rebalance(focusX, focusZ, isSlotLocked);
      this.rebalanceTimer = 0.35;
    }

    this.houseDoorTargets.clear();

    // 1. Step all active pooled Chin residents (skip normal walking for slots currently in combat)
    for (let si = 0; si < this.slots.length; si++) {
      const m = this.slots[si].member;
      if (!m) continue;
      if (isSlotLocked && isSlotLocked(si)) {
        m.elapsed += clampedDt;
        continue;
      }
      this.stepMember(m, clampedDt, daytime);
      if (m.passingDoor) {
        this.houseDoorTargets.set(m.houseId, 1);
      }
    }

    // 2. Also open the attached front door smoothly when the player/focus stands right in front of a Chin house door!
    if (daytime) {
      for (let i = 0; i < this.nearbyHouseIndices.length; i++) {
        const h = this.houses[this.nearbyHouseIndices[i]];
        const dx = focusX - h.x;
        const dz = focusZ - h.z;
        if (dx * dx + dz * dz > 144) continue;
        const c = Math.cos(h.rotation);
        const s = Math.sin(h.rotation);
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        const frontWallZ = -0.6 + (h.depth - 2.4) / 2;
        if (Math.abs(lx) < 2.2 && lz >= frontWallZ - 0.5 && lz <= frontWallZ + 3.2) {
          this.houseDoorTargets.set(h.id, 1);
        }
      }
    }

    // 3. Smoothly interpolate every active house door open fraction & sync doorSlots + chinVillages.ts
    for (const [id, target] of this.houseDoorTargets) {
      const cur = this.houseDoorCurrent.get(id) ?? 0;
      const next = cur + (target - cur) * Math.min(1, clampedDt * 6.0);
      this.houseDoorCurrent.set(id, next);
      setChinHouseDoorOpen(id, next);
    }
    for (const [id, cur] of [...this.houseDoorCurrent.entries()]) {
      if (this.houseDoorTargets.has(id)) continue;
      const next = cur - clampedDt * 2.2;
      if (next <= 0.002) {
        this.houseDoorCurrent.delete(id);
        setChinHouseDoorOpen(id, 0);
      } else {
        this.houseDoorCurrent.set(id, next);
        setChinHouseDoorOpen(id, next);
      }
    }

    for (let di = 0; di < this.doorSlots.length; di++) {
      const ds = this.doorSlots[di];
      ds.open = ds.house ? (this.houseDoorCurrent.get(ds.house.id) ?? 0) : 0;
    }
  }

  dispose(): void {
    clearChinHouseDoors(this.houseDoorCurrent.keys());
    this.houseDoorCurrent.clear();
    this.houseDoorTargets.clear();
    this.assignedMembers.clear();
    for (const s of this.slots) s.member = null;
    for (const ds of this.doorSlots) {
      ds.house = null;
      ds.open = 0;
    }
  }
}
