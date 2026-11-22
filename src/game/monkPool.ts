import { ward } from '../data/ward.ts';
import type { TimeMode } from './environmentTime.ts';
import { resolveTimePeriod } from './villageCrowd.ts';
import {
  MYOTHAR_MONASTERY_BUILDINGS,
  computeMonasteryBuildingLayout,
} from './monasteryLayout.ts';

/**
 * ============================================================================
 * Myanmar Theravada Buddhist Monks — Fixed Object Pool Simulation Engine
 * (Singleton Memory Reference Cache + Fixed Object Pool)
 * ============================================================================
 *
 * Pure TypeScript pool controller managing Buddhist monks (`ဆရာတော်`,
 * `ဦးပဉ္စင်း`, `ကိုရင်`) across Myothar Area 5 Monastery AND any future
 * monastery registered via `registerMonasteryMonkZone`.
 *
 * Memory & Allocation Guarantees:
 * - Pre-allocates `capacity` fixed slot records ONCE (`24` desktop / `14` mobile).
 * - ZERO dynamic array growth or per-frame heap allocations during `step()`.
 * - Sticky slot assignment prevents flicker/remounting while exploring.
 * - Supports courtyard (`y = 0`), 1st-floor interiors (`floor1Y`), and
 *   walkable 2nd-floor monastery galleries (`floor2Y`)!
 */

export type MonkRole = 'abbot' | 'senior-monk' | 'monk' | 'novice';
export type MonkActivity =
  | 'courtyard-walk'
  | 'alms-walk'
  | 'meditating'
  | 'preaching'
  | 'dining'
  | 'upper-gallery';

export interface MonkSpawnAnchor {
  readonly id: string;
  readonly role: MonkRole;
  readonly activity: MonkActivity;
  /** Local rectangle in compound coordinates `(mu, mv)` around zone anchor */
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
  readonly worldY: number;
  readonly facingLocalYaw: number;
  readonly robeVariant: 0 | 1 | 2; // 0 = deep maroon, 1 = burgundy, 2 = saffron
  readonly skinIndex: number;
  readonly scale: number;
  readonly walkSpeed: number;
  readonly carriesAlmsBowl: boolean;
  readonly carriesFan: boolean;
  readonly carriesBeads: boolean;
}

export interface MonasteryMonkZoneSpec {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly originX: number;
  readonly originZ: number;
  readonly rotation: number;
  readonly monks: readonly MonkSpawnAnchor[];
}

export interface MonkMemberState {
  readonly id: string;
  readonly zoneId: string;
  readonly regionId: string;
  readonly role: MonkRole;
  readonly activity: MonkActivity;
  readonly robeVariant: 0 | 1 | 2;
  readonly skinIndex: number;
  readonly scale: number;
  readonly carriesAlmsBowl: boolean;
  readonly carriesFan: boolean;
  readonly carriesBeads: boolean;

  // Compound-local transform & movement bounds
  readonly originX: number;
  readonly originZ: number;
  readonly cosR: number;
  readonly sinR: number;
  readonly rotation: number;
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
  readonly walkSpeed: number;
  readonly baseFacingYaw: number;

  // Live mutable state updated in-place (ZERO per-frame allocation)
  u: number;
  v: number;
  targetU: number;
  targetV: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  walkPhase: number;
  pauseTimer: number;
  seed: number;
  active: boolean;
}

export interface MonkPoolSlot {
  readonly slotIndex: number;
  member: MonkMemberState | null;
}

export const MONK_POOL_DESKTOP = 24;
export const MONK_POOL_MOBILE = 14;

function buildMyotharMonkZone(): MonasteryMonkZoneSpec {
  const m = ward.monastery;
  const dhamma = MYOTHAR_MONASTERY_BUILDINGS.find((b) => b.kind === 'dhamma');
  const quarters = MYOTHAR_MONASTERY_BUILDINGS.find((b) => b.kind === 'quarters');
  const mandap = MYOTHAR_MONASTERY_BUILDINGS.find((b) => b.kind === 'mandap');
  const refectory = MYOTHAR_MONASTERY_BUILDINGS.find((b) => b.kind === 'refectory');

  const dLayout = dhamma ? computeMonasteryBuildingLayout(dhamma) : null;
  const qLayout = quarters ? computeMonasteryBuildingLayout(quarters) : null;
  const mLayout = mandap ? computeMonasteryBuildingLayout(mandap) : null;
  const rLayout = refectory ? computeMonasteryBuildingLayout(refectory) : null;

  const dhammaF1 = dLayout?.floor1Y ?? 0.88;
  const dhammaF2 = dLayout?.floor2Y ?? 4.43;
  const quartersF1 = qLayout?.floor1Y ?? 0.66;
  const quartersF2 = qLayout?.floor2Y ?? 4.11;
  const mandapF1 = mLayout?.floor1Y ?? 0.88;
  const mandapF2 = mLayout?.floor2Y ?? 4.43;
  const refectoryF1 = rLayout?.floor1Y ?? 0.66;
  const refectoryF2 = rLayout?.floor2Y ?? 4.11;

  const monks: MonkSpawnAnchor[] = [
    // 1. Senior Abbot (`ကျောင်းထိုင်ဆရာတော်`) inside Dhamma Hall 1F in front of Buddha altar
    {
      id: 'myothar-monk-abbot-dhamma',
      role: 'abbot',
      activity: 'preaching',
      minU: -1.8,
      maxU: 1.8,
      minV: 3 + 1.2,
      maxV: 3 + 3.2,
      worldY: dhammaF1,
      facingLocalYaw: Math.PI,
      robeVariant: 0,
      skinIndex: 2,
      scale: 1.04,
      walkSpeed: 0.72,
      carriesAlmsBowl: false,
      carriesFan: true,
      carriesBeads: true,
    },
    // 2. Monk meditating / walking quietly on Dhamma Hall 1F West aisle
    {
      id: 'myothar-monk-dhamma-1f',
      role: 'senior-monk',
      activity: 'meditating',
      minU: -8.5,
      maxU: -3.5,
      minV: 3 - 4.0,
      maxV: 3 + 4.0,
      worldY: dhammaF1,
      facingLocalYaw: 0,
      robeVariant: 1,
      skinIndex: 1,
      scale: 1.0,
      walkSpeed: 0.82,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 3. Monk on Dhamma Hall 2nd Floor Gallery (`အပေါ်ထပ် တရားထိုင်ဆောင်`)
    {
      id: 'myothar-monk-dhamma-2f',
      role: 'senior-monk',
      activity: 'upper-gallery',
      minU: -8.0,
      maxU: 3.5,
      minV: 3 - 4.5,
      maxV: 3 + 3.5,
      worldY: dhammaF2,
      facingLocalYaw: Math.PI,
      robeVariant: 0,
      skinIndex: 0,
      scale: 1.0,
      walkSpeed: 0.8,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 4. Monk walking serenely in front courtyard near Dhamma Hall with alms bowl (`သပိတ်`)
    {
      id: 'myothar-monk-courtyard-1',
      role: 'monk',
      activity: 'alms-walk',
      minU: -14.0,
      maxU: 12.0,
      minV: -18.5,
      maxV: -11.5,
      worldY: 0.08,
      facingLocalYaw: 0,
      robeVariant: 0,
      skinIndex: 1,
      scale: 0.99,
      walkSpeed: 0.96,
      carriesAlmsBowl: true,
      carriesFan: false,
      carriesBeads: false,
    },
    // 5. Novice (`ကိုရင်`) walking in courtyard between Mandap & Dhamma Hall with alms bowl
    {
      id: 'myothar-monk-courtyard-novice',
      role: 'novice',
      activity: 'alms-walk',
      minU: -20.5,
      maxU: -14.5,
      minV: -12.0,
      maxV: 12.0,
      worldY: 0.06,
      facingLocalYaw: Math.PI / 2,
      robeVariant: 2,
      skinIndex: 0,
      scale: 0.84,
      walkSpeed: 1.05,
      carriesAlmsBowl: true,
      carriesFan: false,
      carriesBeads: false,
    },
    // 6. Monk walking near the Golden Stupas (`စေတီတော်ဝင်း`)
    {
      id: 'myothar-monk-stupa-walk',
      role: 'monk',
      activity: 'courtyard-walk',
      minU: 15.0,
      maxU: 23.0,
      minV: -6.0,
      maxV: 12.0,
      worldY: 0.06,
      facingLocalYaw: 0,
      robeVariant: 1,
      skinIndex: 2,
      scale: 0.98,
      walkSpeed: 0.9,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 7. Monk inside Monks' Kyaung (`ဘုန်းကြီးကျောင်းဆောင်`) 1st Floor
    {
      id: 'myothar-monk-kyaung-1f',
      role: 'senior-monk',
      activity: 'courtyard-walk',
      minU: -5.0,
      maxU: 3.0,
      minV: 23 - 3.6,
      maxV: 23 + 1.4,
      worldY: quartersF1,
      facingLocalYaw: Math.PI,
      robeVariant: 0,
      skinIndex: 1,
      scale: 1.01,
      walkSpeed: 0.85,
      carriesAlmsBowl: false,
      carriesFan: true,
      carriesBeads: false,
    },
    // 8. Monk on Monks' Kyaung 2nd Floor (`အပေါ်ထပ် ကျောင်းဆောင်`)
    {
      id: 'myothar-monk-kyaung-2f',
      role: 'monk',
      activity: 'upper-gallery',
      minU: -8.5,
      maxU: 2.5,
      minV: 23 - 3.6,
      maxV: 23 + 1.8,
      worldY: quartersF2,
      facingLocalYaw: Math.PI,
      robeVariant: 1,
      skinIndex: 0,
      scale: 0.98,
      walkSpeed: 0.84,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 9. Monk inside Ceremonial Mandap (`သိမ်မဏ္ဍပ် · ဇရပ်`) 1st Floor
    {
      id: 'myothar-monk-mandap-1f',
      role: 'monk',
      activity: 'meditating',
      minU: -32 - 3.2,
      maxU: -32 + 5.2,
      minV: 7 - 5.5,
      maxV: 7 + 3.0,
      worldY: mandapF1,
      facingLocalYaw: Math.PI,
      robeVariant: 0,
      skinIndex: 2,
      scale: 1.0,
      walkSpeed: 0.82,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 10. Novice on Ceremonial Mandap 2nd Floor Open Gallery
    {
      id: 'myothar-monk-mandap-2f',
      role: 'novice',
      activity: 'upper-gallery',
      minU: -32 - 2.0,
      maxU: -32 + 5.8,
      minV: 7 - 5.5,
      maxV: 7 + 3.0,
      worldY: mandapF2,
      facingLocalYaw: Math.PI / 2,
      robeVariant: 2,
      skinIndex: 1,
      scale: 0.86,
      walkSpeed: 0.9,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 11. Monk inside Refectory Dining Hall (`ဆွမ်းစားဆောင်`) 1st Floor
    {
      id: 'myothar-monk-refectory-dining-1',
      role: 'monk',
      activity: 'dining',
      minU: -32 + 1.8,
      maxU: -32 + 7.6,
      minV: 29 - 0.8,
      maxV: 29 + 1.8,
      worldY: refectoryF1,
      facingLocalYaw: Math.PI,
      robeVariant: 0,
      skinIndex: 0,
      scale: 0.99,
      walkSpeed: 0.82,
      carriesAlmsBowl: true,
      carriesFan: false,
      carriesBeads: false,
    },
    // 12. Novice tending Alms Supplies Storage Room (`ဆွမ်းပစ္စည်းသိုလှောင်ခန်း`) 1st Floor
    {
      id: 'myothar-monk-refectory-storage',
      role: 'novice',
      activity: 'dining',
      minU: -32 - 7.6,
      maxU: -32 - 4.2,
      minV: 29 - 3.6,
      maxV: 29 + 2.4,
      worldY: refectoryF1,
      facingLocalYaw: 0,
      robeVariant: 2,
      skinIndex: 1,
      scale: 0.85,
      walkSpeed: 0.92,
      carriesAlmsBowl: true,
      carriesFan: false,
      carriesBeads: false,
    },
    // 13. Monk on Refectory 2nd Floor Alms Loft (`အပေါ်ထပ် ဆွမ်းပစ္စည်းခန်း`)
    {
      id: 'myothar-monk-refectory-2f',
      role: 'monk',
      activity: 'upper-gallery',
      minU: -32 - 7.5,
      maxU: -32 + 2.0,
      minV: 29 - 3.2,
      maxV: 29 + 2.5,
      worldY: refectoryF2,
      facingLocalYaw: Math.PI,
      robeVariant: 1,
      skinIndex: 2,
      scale: 0.98,
      walkSpeed: 0.84,
      carriesAlmsBowl: false,
      carriesFan: false,
      carriesBeads: true,
    },
    // 14. Walkway monk between Mandap, Refectory & Monks' Quarters
    {
      id: 'myothar-monk-walkway-south',
      role: 'monk',
      activity: 'alms-walk',
      minU: -20.0,
      maxU: -15.5,
      minV: 18.0,
      maxV: 28.5,
      worldY: 0.06,
      facingLocalYaw: 0,
      robeVariant: 0,
      skinIndex: 0,
      scale: 1.0,
      walkSpeed: 0.94,
      carriesAlmsBowl: true,
      carriesFan: false,
      carriesBeads: false,
    },
  ];

  return {
    id: 'myothar-area-5-monastery-monks',
    regionId: 'myothar',
    name: 'မြို့သာ နယ်မြေ(၅)ရပ်ကွက် ဘုန်းတော်ကြီးကျောင်း',
    originX: m.x,
    originZ: m.z,
    rotation: m.rotation,
    monks,
  };
}

export const MYOTHAR_MONASTERY_MONK_ZONE: MonasteryMonkZoneSpec = buildMyotharMonkZone();

const registeredZones: MonasteryMonkZoneSpec[] = [MYOTHAR_MONASTERY_MONK_ZONE];

/** Register an additional monastery's monks into the shared global Fixed Object Pool. */
export function registerMonasteryMonkZone(zone: MonasteryMonkZoneSpec): void {
  const idx = registeredZones.findIndex((z) => z.id === zone.id);
  if (idx >= 0) registeredZones[idx] = zone;
  else registeredZones.push(zone);
}

/** Unregister a monastery monk zone when its streamed region unloads. */
export function unregisterMonasteryMonkZone(zoneId: string): void {
  const idx = registeredZones.findIndex((z) => z.id === zoneId);
  if (idx >= 0) registeredZones.splice(idx, 1);
}

export function getRegisteredMonasteryMonkZones(): readonly MonasteryMonkZoneSpec[] {
  return registeredZones;
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1;
}

function nextRand(m: MonkMemberState): number {
  m.seed = (Math.imul(m.seed, 1664525) + 1013904223) >>> 0;
  return m.seed / 4294967296;
}

function createMemberState(zone: MonasteryMonkZoneSpec, anchor: MonkSpawnAnchor): MonkMemberState {
  const cosR = Math.cos(zone.rotation);
  const sinR = Math.sin(zone.rotation);
  const u = (anchor.minU + anchor.maxU) * 0.5;
  const v = (anchor.minV + anchor.maxV) * 0.5;
  const seed = hashSeed(`${zone.id}:${anchor.id}`);
  return {
    id: anchor.id,
    zoneId: zone.id,
    regionId: zone.regionId,
    role: anchor.role,
    activity: anchor.activity,
    robeVariant: anchor.robeVariant,
    skinIndex: anchor.skinIndex,
    scale: anchor.scale,
    carriesAlmsBowl: anchor.carriesAlmsBowl,
    carriesFan: anchor.carriesFan,
    carriesBeads: anchor.carriesBeads,
    originX: zone.originX,
    originZ: zone.originZ,
    cosR,
    sinR,
    rotation: zone.rotation,
    minU: anchor.minU,
    maxU: anchor.maxU,
    minV: anchor.minV,
    maxV: anchor.maxV,
    walkSpeed: anchor.walkSpeed,
    baseFacingYaw: zone.rotation + anchor.facingLocalYaw,
    u,
    v,
    targetU: u,
    targetV: v,
    x: zone.originX + u * cosR + v * sinR,
    y: anchor.worldY,
    z: zone.originZ - u * sinR + v * cosR,
    yaw: zone.rotation + anchor.facingLocalYaw,
    speed: 0,
    walkPhase: (seed % 628) / 100,
    pauseTimer: 0.8 + ((seed >>> 8) % 300) / 100,
    seed,
    active: false,
  };
}

/**
 * Fixed-Capacity Object Pool Controller for Theravada Buddhist Monks.
 * Never allocates new slots after construction; recycles exact slot indices
 * smoothly across all registered monasteries on the map.
 */
export class MonkFixedPoolController {
  readonly capacity: number;
  readonly activeRadius: number;
  readonly slots: MonkPoolSlot[];

  private readonly memberCache = new Map<string, MonkMemberState>();
  private readonly assignedSlot = new Map<string, number>();
  private readonly candidateBuf: { member: MonkMemberState; distSq: number }[] = [];
  private readonly desiredIds = new Set<string>();
  private readonly activeRegionSet = new Set<string>();

  constructor(capacity: number = MONK_POOL_DESKTOP, activeRadius = 210) {
    this.capacity = Math.max(1, capacity);
    this.activeRadius = activeRadius;
    this.slots = Array.from({ length: this.capacity }, (_, slotIndex) => ({
      slotIndex,
      member: null,
    }));
  }

  private getOrCreateMember(zone: MonasteryMonkZoneSpec, anchor: MonkSpawnAnchor): MonkMemberState {
    const key = `${zone.id}:${anchor.id}`;
    let m = this.memberCache.get(key);
    if (!m) {
      m = createMemberState(zone, anchor);
      this.memberCache.set(key, m);
    }
    return m;
  }

  /**
   * Rebalances fixed pool slots around `(focusX, focusZ)` for `activeRegions`.
   * During late night (`night`), courtyard monks rest indoors while indoor
   * meditating/evening-chanting monks remain serenely visible.
   */
  rebalance(
    focusX: number,
    focusZ: number,
    activeRegions: readonly string[],
    minute: number,
    timeMode?: TimeMode,
  ): number {
    this.activeRegionSet.clear();
    for (let i = 0; i < activeRegions.length; i++) {
      this.activeRegionSet.add(activeRegions[i]);
    }

    const period = resolveTimePeriod(minute, timeMode);
    const isNight = period === 'night';
    const maxDistSq = this.activeRadius * this.activeRadius;

    this.candidateBuf.length = 0;
    const zones = getRegisteredMonasteryMonkZones();
    for (let zi = 0; zi < zones.length; zi++) {
      const zone = zones[zi];
      if (!this.activeRegionSet.has(zone.regionId)) continue;
      for (let mi = 0; mi < zone.monks.length; mi++) {
        const anchor = zone.monks[mi];
        // At night, outdoor courtyard alms-walkers rest inside; indoor chanting/meditation monks stay active
        if (isNight && anchor.worldY < 0.25) continue;
        const member = this.getOrCreateMember(zone, anchor);
        const dx = member.x - focusX;
        const dz = member.z - focusZ;
        const distSq = dx * dx + dz * dz;
        if (distSq <= maxDistSq) {
          this.candidateBuf.push({ member, distSq });
        }
      }
    }

    this.candidateBuf.sort((a, b) => a.distSq - b.distSq);

    this.desiredIds.clear();
    const limit = Math.min(this.capacity, this.candidateBuf.length);
    for (let i = 0; i < limit; i++) {
      this.desiredIds.add(this.candidateBuf[i].member.id);
    }

    // 1. Release slots no longer in range
    for (let si = 0; si < this.slots.length; si++) {
      const slot = this.slots[si];
      if (!slot.member) continue;
      if (!this.desiredIds.has(slot.member.id)) {
        slot.member.active = false;
        this.assignedSlot.delete(slot.member.id);
        slot.member = null;
      }
    }

    // 2. Bind entering monks into freed slots (preserving sticky indices for existing monks)
    let ci = 0;
    for (let si = 0; si < this.slots.length && ci < limit; si++) {
      if (this.slots[si].member !== null) continue;
      while (ci < limit && this.assignedSlot.has(this.candidateBuf[ci].member.id)) {
        ci++;
      }
      if (ci >= limit) break;
      const member = this.candidateBuf[ci++].member;
      member.active = true;
      this.slots[si].member = member;
      this.assignedSlot.set(member.id, si);
    }

    return this.assignedSlot.size;
  }

  /** Pure in-place serene movement update for every active pooled monk (ZERO allocations). */
  step(dt: number): void {
    const clampedDt = Math.min(0.1, Math.max(0, dt));
    for (let si = 0; si < this.slots.length; si++) {
      const m = this.slots[si].member;
      if (!m || !m.active) continue;

      if (m.pauseTimer > 0) {
        m.pauseTimer -= clampedDt;
        m.speed = 0;
        // Gentle mindful turning toward base facing while paused
        let diff = m.baseFacingYaw - m.yaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        m.yaw += diff * Math.min(1, clampedDt * 2.2);

        if (m.pauseTimer <= 0) {
          const spanU = m.maxU - m.minU;
          const spanV = m.maxV - m.minV;
          m.targetU = m.minU + nextRand(m) * Math.max(0.2, spanU);
          m.targetV = m.minV + nextRand(m) * Math.max(0.2, spanV);
        }
        continue;
      }

      const du = m.targetU - m.u;
      const dv = m.targetV - m.v;
      const dist = Math.hypot(du, dv);
      if (dist < 0.22) {
        m.speed = 0;
        m.pauseTimer =
          m.activity === 'meditating' || m.activity === 'preaching'
            ? 4.2 + nextRand(m) * 4.5
            : 2.2 + nextRand(m) * 3.4;
        continue;
      }

      const step = Math.min(dist, m.walkSpeed * clampedDt);
      const nu = du / dist;
      const nv = dv / dist;
      m.u = Math.max(m.minU, Math.min(m.maxU, m.u + nu * step));
      m.v = Math.max(m.minV, Math.min(m.maxV, m.v + nv * step));
      m.speed = step / Math.max(0.001, clampedDt);
      m.walkPhase += step * 3.1;

      m.x = m.originX + m.u * m.cosR + m.v * m.sinR;
      m.z = m.originZ - m.u * m.sinR + m.v * m.cosR;

      const targetYaw = m.rotation + Math.atan2(nu, nv);
      let diff = targetYaw - m.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      m.yaw += diff * Math.min(1, clampedDt * 5.0);
    }
  }

  dispose(): void {
    for (let si = 0; si < this.slots.length; si++) {
      if (this.slots[si].member) {
        this.slots[si].member!.active = false;
        this.slots[si].member = null;
      }
    }
    this.assignedSlot.clear();
    this.desiredIds.clear();
    this.candidateBuf.length = 0;
  }
}
