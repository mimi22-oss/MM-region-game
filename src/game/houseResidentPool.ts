/**
 * Memory-cached object pool & deterministic household profile generator for all
 * residential houses across Myothar wards and Kalay villages.
 *
 * Each house deterministically gets:
 * - Adults: 1 solo elder (uncle or auntie) or 2 elders (uncle + auntie couple)
 * - Kids: 1 girl, 1 boy, or 2 kids (boy + girl), with randomized clothes palettes & heights
 *
 * Pure TypeScript (no Three.js or DOM imports) so it can be thoroughly unit-tested.
 */

import {
  buildPathsToSeat,
  createResidentState,
  smoothstep01,
  type LocalPoint2D,
  type ResidentLayout,
  type ResidentRole,
  type ResidentSeat,
  type ResidentState,
} from './residentBots.ts';

export const UNCLE_OUTFIT_COUNT = 8;
export const AUNTIE_OUTFIT_COUNT = 8;
export const BOY_OUTFIT_COUNT = 8;
export const GIRL_OUTFIT_COUNT = 8;
export const SKIN_TONE_COUNT = 4;
export const HAIR_TONE_COUNT = 3;

export interface ResidentHouseRecord {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  /** World Y rotation matching the rendered building group (+Z faces front porch & door). */
  readonly rotation: number;
  /** Porch surface height above world y=0 (standard House/SiThar/Natmyaung = 0.355m). */
  readonly porchY: number;
  /** True for standard House compounds with a wide front yard (fence at front + 2.6m). */
  readonly hasWideYard?: boolean;
}

export interface ResidentMemberProfile {
  readonly role: ResidentRole;
  readonly seatIndex: number;
  readonly outfitIndex: number;
  readonly skinIndex: number;
  readonly hairIndex: number;
  readonly heightScale: number;
  readonly initialSitSec: number;
  readonly seed: number;
  readonly elapsedOffset: number;
}

export type KidComposition = 'girl-only' | 'boy-only' | 'boy-and-girl';

export interface HouseholdProfile {
  readonly houseId: string;
  /** 1 resident (solo Uncle or Auntie) or 2 residents (Uncle + Auntie couple). */
  readonly residentCount: 1 | 2;
  readonly members: readonly ResidentMemberProfile[];
  /** 1 kid (girl-only or boy-only) or 2 kids (boy + girl). */
  readonly kidCount: 1 | 2;
  readonly kidComposition: KidComposition;
  readonly kids: readonly ResidentMemberProfile[];
}

export interface PooledHouseholdSlotState {
  readonly slotIndex: number;
  house: ResidentHouseRecord | null;
  profile: HouseholdProfile | null;
  layout: ResidentLayout | null;
  residents: ResidentState[];
  kids: ResidentState[];
  doorOpen: number;
  gateOpen: number;
}

/** Deterministic FNV-1a 32-bit string hash. */
export function hashHouseId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function lcgNext(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

function buildMemberProfile(
  role: ResidentRole,
  seatIndex: number,
  seedIn: number,
  staggerIndex: number,
): [number, ResidentMemberProfile] {
  let seed = seedIn;
  let r: number;

  const outfitCount =
    role === 'uncle'
      ? UNCLE_OUTFIT_COUNT
      : role === 'auntie'
        ? AUNTIE_OUTFIT_COUNT
        : role === 'boy'
          ? BOY_OUTFIT_COUNT
          : GIRL_OUTFIT_COUNT;

  [seed, r] = lcgNext(seed);
  const outfitIndex = Math.floor(r * outfitCount);

  [seed, r] = lcgNext(seed);
  const skinIndex = Math.floor(r * SKIN_TONE_COUNT);

  [seed, r] = lcgNext(seed);
  // Kids mostly have youthful dark hair (index 0)
  const hairIndex = role === 'boy' || role === 'girl' ? 0 : Math.floor(r * HAIR_TONE_COUNT);

  [seed, r] = lcgNext(seed);
  let heightScale: number;
  if (role === 'uncle') {
    heightScale = +(0.94 + r * 0.14).toFixed(3);
  } else if (role === 'auntie') {
    heightScale = +(0.86 + r * 0.14).toFixed(3);
  } else if (role === 'boy') {
    heightScale = +(0.56 + r * 0.12).toFixed(3);
  } else {
    heightScale = +(0.54 + r * 0.12).toFixed(3);
  }

  [seed, r] = lcgNext(seed);
  const isKid = role === 'boy' || role === 'girl';
  // Stagger initial sit durations across adults & kids so they naturally take turns at the door
  const initialSitSec = isKid
    ? 6.0 + staggerIndex * 7.5 + r * 7.0
    : staggerIndex === 0
      ? 4.5 + r * 9.5
      : 13.5 + r * 10.0;

  [seed, r] = lcgNext(seed);
  const elapsedOffset = r * 6.28;

  [seed, r] = lcgNext(seed);
  const memberSeed = (seed ^ ((staggerIndex + 1) * 0x9e3779b9)) >>> 0;

  return [
    seed,
    {
      role,
      seatIndex,
      outfitIndex,
      skinIndex,
      hairIndex,
      heightScale,
      initialSitSec,
      seed: memberSeed,
      elapsedOffset,
    },
  ];
}

/**
 * Deterministically derives a household's adults (1 or 2) AND kids (1 girl, 1 boy, or 2 kids:
 * boy + girl), clothes palette indices, skin/hair tones, and height scales from `houseId`.
 * Same house always produces the exact same family even after pool eviction and re-entry.
 */
export function deriveHouseholdProfile(houseId: string): HouseholdProfile {
  let seed = hashHouseId(houseId) || 1;
  let r: number;

  // --- Adults: ~55% couple (2), ~45% solo (1) ---
  [seed, r] = lcgNext(seed);
  const residentCount: 1 | 2 = r < 0.55 ? 2 : 1;

  [seed, r] = lcgNext(seed);
  const soloRole: ResidentRole = r < 0.5 ? 'uncle' : 'auntie';
  [seed, r] = lcgNext(seed);
  const soloSeat = r < 0.5 ? 0 : 1;

  const adultRoles: { role: ResidentRole; seatIndex: number }[] =
    residentCount === 2
      ? [
          { role: 'uncle', seatIndex: 0 },
          { role: 'auntie', seatIndex: 1 },
        ]
      : [{ role: soloRole, seatIndex: soloSeat }];

  const members: ResidentMemberProfile[] = [];
  for (let i = 0; i < adultRoles.length; i++) {
    let profile: ResidentMemberProfile;
    [seed, profile] = buildMemberProfile(adultRoles[i].role, adultRoles[i].seatIndex, seed, i);
    members.push(profile);
  }

  // --- Kids: balanced 3-way split across houses (girl-only ~33%, boy-only ~33%, boy+girl ~34%) ---
  [seed, r] = lcgNext(seed);
  const kidComposition: KidComposition =
    r < 0.33 ? 'girl-only' : r < 0.66 ? 'boy-only' : 'boy-and-girl';
  const kidCount: 1 | 2 = kidComposition === 'boy-and-girl' ? 2 : 1;

  [seed, r] = lcgNext(seed);
  const soloKidSeat = r < 0.5 ? 2 : 3;

  const kidRoles: { role: ResidentRole; seatIndex: number }[] =
    kidComposition === 'boy-and-girl'
      ? [
          { role: 'boy', seatIndex: 2 },
          { role: 'girl', seatIndex: 3 },
        ]
      : kidComposition === 'boy-only'
        ? [{ role: 'boy', seatIndex: soloKidSeat }]
        : [{ role: 'girl', seatIndex: soloKidSeat }];

  const kids: ResidentMemberProfile[] = [];
  for (let i = 0; i < kidRoles.length; i++) {
    let profile: ResidentMemberProfile;
    [seed, profile] = buildMemberProfile(kidRoles[i].role, kidRoles[i].seatIndex, seed, i);
    kids.push(profile);
  }

  return { houseId, residentCount, members, kidCount, kidComposition, kids };
}

/**
 * Shared porch + front-yard layout cache keyed by rounded (width, depth, porchY, hasWideYard).
 * Seats 0 & 1 = porch armchairs for adults; Seats 2 & 3 = low kid stools for boys & girls.
 * Hundreds of houses with identical footprints share a single layout object by reference.
 */
const porchLayoutCache = new Map<string, ResidentLayout>();

export function getHousePorchLayout(
  width: number,
  depth: number,
  porchY = 0.355,
  hasWideYard = true,
): ResidentLayout {
  const bw = Math.max(5.5, Math.round(width * 2) / 2);
  const bd = Math.max(4.5, Math.round(depth * 2) / 2);
  const py = Math.round(porchY * 1000) / 1000;
  const key = `${bw}|${bd}|${py}|${hasWideYard ? 1 : 0}`;

  const cached = porchLayoutCache.get(key);
  if (cached) return cached;

  const front = bd / 2;
  const balconyW = Math.max(3.6, bw * 0.65);
  // Adult armchairs between 1.4m doorway (±0.70) and outer porch pillars
  const seatX = Math.min(1.72, Math.max(1.16, balconyW * 0.3));
  const seatZ = front + 0.62;
  const standZ = front + 1.18;

  // Kid stools: in the front yard beside the steps for wide-yard House compounds,
  // or on the front porch apron corners for tighter-fence village compounds.
  const kidX = hasWideYard
    ? Math.min(2.05, Math.max(1.52, bw * 0.25))
    : Math.min(1.45, Math.max(1.06, balconyW * 0.26));
  const kidSeatZ = hasWideYard ? front + 1.98 : front + 1.24;
  const kidStandZ = hasWideYard ? front + 2.28 : front + 1.46;
  const kidFloorY = hasWideYard ? 0 : py;

  const seats: ResidentSeat[] = [
    // Adult Seat 0 (Left porch armchair)
    {
      id: 'porch-seat-left',
      x: -seatX,
      z: seatZ,
      floorY: py,
      seatHeight: 0.43,
      yaw: 0.28,
      standSpot: { x: -(seatX - 0.16), z: standZ },
    },
    // Adult Seat 1 (Right porch armchair)
    {
      id: 'porch-seat-right',
      x: seatX,
      z: seatZ,
      floorY: py,
      seatHeight: 0.41,
      yaw: -0.28,
      standSpot: { x: seatX - 0.16, z: standZ },
    },
    // Kid Seat 2 (Left low kid stool)
    {
      id: 'kid-seat-left',
      x: -kidX,
      z: kidSeatZ,
      floorY: kidFloorY,
      seatHeight: 0.26,
      yaw: 0.42,
      standSpot: { x: -(kidX - 0.14), z: kidStandZ },
    },
    // Kid Seat 3 (Right low kid stool)
    {
      id: 'kid-seat-right',
      x: kidX,
      z: kidSeatZ,
      floorY: kidFloorY,
      seatHeight: 0.26,
      yaw: -0.42,
      standSpot: { x: kidX - 0.14, z: kidStandZ },
    },
  ];

  // Wait spot clears the outward-swinging double door leaves (hinged at front+0.19, leaf 0.64m => max front+0.83)
  const doorOutside: LocalPoint2D = { x: 0, z: front + 1.16 };
  const doorInside: LocalPoint2D = { x: 0, z: front + 0.24 };
  const stepBase: LocalPoint2D = { x: 0, z: front + 2.24 };

  const pathToDoor: readonly (readonly LocalPoint2D[])[] = hasWideYard
    ? [
        [seats[0].standSpot, doorOutside],
        [seats[1].standSpot, doorOutside],
        [seats[2].standSpot, stepBase, doorOutside],
        [seats[3].standSpot, stepBase, doorOutside],
      ]
    : [
        [seats[0].standSpot, doorOutside],
        [seats[1].standSpot, doorOutside],
        [seats[2].standSpot, doorOutside],
        [seats[3].standSpot, doorOutside],
      ];

  // Smooth ground/step/porch elevation so kids & outing residents climb front steps cleanly
  const floorY = hasWideYard
    ? (z: number) => {
        if (z <= front + 1.55) return py;
        if (z >= front + 2.18) return 0;
        return py * (1 - smoothstep01((z - (front + 1.55)) / 0.63));
      }
    : () => py;

  // Compound blue front gate (z = front + 2.6) & roadside neighbor-visiting routes for wide-yard houses
  const gateZ = hasWideYard ? front + 2.6 : undefined;
  const gateInside: LocalPoint2D | undefined = hasWideYard
    ? { x: 0, z: front + 2.22 }
    : undefined;
  const gateOutside: LocalPoint2D | undefined = hasWideYard
    ? { x: 0, z: front + 3.45 }
    : undefined;

  const pathSeatToGate: readonly (readonly LocalPoint2D[])[] | undefined =
    hasWideYard && gateInside
      ? [
          [seats[0].standSpot, doorOutside, gateInside],
          [seats[1].standSpot, doorOutside, gateInside],
          [seats[2].standSpot, gateInside],
          [seats[3].standSpot, gateInside],
        ]
      : undefined;

  // Left & right roadside stroll/neighbor-visiting loops outside the compound gate
  const streetZ = front + 4.1;
  const visitRoutes: readonly (readonly LocalPoint2D[])[] | undefined =
    hasWideYard && gateOutside
      ? [
          // Stroll left along the lane to visit the next-door neighbor, then return to gate
          [
            gateOutside,
            { x: -3.5, z: streetZ },
            { x: -7.5, z: streetZ - 0.35 },
            { x: -3.5, z: streetZ },
            gateOutside,
          ],
          // Stroll right along the lane to visit the neighbor on the other side, then return
          [
            gateOutside,
            { x: 3.5, z: streetZ },
            { x: 7.5, z: streetZ - 0.35 },
            { x: 3.5, z: streetZ },
            gateOutside,
          ],
        ]
      : undefined;

  const layout: ResidentLayout = {
    seats,
    doorOutside,
    doorInside,
    pathToDoor,
    pathToSeat: buildPathsToSeat(pathToDoor, doorInside),
    floorY,
    passThreshold: 0.9,
    revealInsideWhileOpening: false,
    doorClearZ: front + 1.05,
    gateZ,
    gateInside,
    gateOutside,
    pathSeatToGate,
    visitRoutes,
  };

  porchLayoutCache.set(key, layout);
  return layout;
}

export function getPorchLayoutCacheSize(): number {
  return porchLayoutCache.size;
}

/** Creates a fixed-size pool of empty household slots. */
export function createHouseholdPool(slotCount: number): PooledHouseholdSlotState[] {
  return Array.from({ length: slotCount }, (_, slotIndex) => ({
    slotIndex,
    house: null,
    profile: null,
    layout: null,
    residents: [],
    kids: [],
    doorOpen: 0,
    gateOpen: 0,
  }));
}

/**
 * Sticky LRU slot assignment:
 * - Keeps already-assigned houses inside `keepRadius` in their exact slot (no flicker/reset).
 * - Releases slots whose house moved beyond `keepRadius` or disappeared from `candidates`.
 * - Reuses released/free slots in-place for the nearest unassigned houses within `activeRadius`.
 *
 * Returns `true` if any slot's assigned house changed.
 */
export function assignResidentPoolSlots(
  slots: PooledHouseholdSlotState[],
  candidates: readonly ResidentHouseRecord[],
  focusX: number,
  focusZ: number,
  activeRadius: number,
  keepRadius = activeRadius + 14,
): boolean {
  const activeSq = activeRadius * activeRadius;
  const keepSq = keepRadius * keepRadius;

  const candidateById = new Map<string, ResidentHouseRecord>();
  for (let i = 0; i < candidates.length; i++) {
    candidateById.set(candidates[i].id, candidates[i]);
  }

  let changed = false;
  const assignedIds = new Set<string>();

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    if (!slot.house) continue;
    const dx = slot.house.x - focusX;
    const dz = slot.house.z - focusZ;
    if (!candidateById.has(slot.house.id) || dx * dx + dz * dz > keepSq) {
      slot.house = null;
      slot.profile = null;
      slot.layout = null;
      slot.residents = [];
      slot.kids = [];
      slot.doorOpen = 0;
      slot.gateOpen = 0;
      changed = true;
    } else {
      assignedIds.add(slot.house.id);
    }
  }

  const freeSlotIndices: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (!slots[i].house) freeSlotIndices.push(i);
  }
  if (freeSlotIndices.length === 0) return changed;

  const nearby: { house: ResidentHouseRecord; distSq: number }[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const h = candidates[i];
    if (assignedIds.has(h.id)) continue;
    const dx = h.x - focusX;
    const dz = h.z - focusZ;
    const d2 = dx * dx + dz * dz;
    if (d2 <= activeSq) {
      nearby.push({ house: h, distSq: d2 });
    }
  }
  if (nearby.length === 0) return changed;

  nearby.sort((a, b) => a.distSq - b.distSq);

  const assignCount = Math.min(freeSlotIndices.length, nearby.length);
  for (let k = 0; k < assignCount; k++) {
    const slot = slots[freeSlotIndices[k]];
    const house = nearby[k].house;
    const profile = deriveHouseholdProfile(house.id);
    const layout = getHousePorchLayout(
      house.width,
      house.depth,
      house.porchY,
      house.hasWideYard ?? true,
    );

    slot.house = house;
    slot.profile = profile;
    slot.layout = layout;
    slot.doorOpen = 0;
    slot.gateOpen = 0;
    slot.residents = profile.members.map((m) =>
      createResidentState(layout, m.seatIndex, m.role, {
        initialSitSec: m.initialSitSec,
        seed: m.seed,
        elapsedOffset: m.elapsedOffset,
      }),
    );
    slot.kids = profile.kids.map((kid) =>
      createResidentState(layout, kid.seatIndex, kid.role, {
        initialSitSec: kid.initialSitSec,
        seed: kid.seed,
        elapsedOffset: kid.elapsedOffset,
        sitMinSec: 8.5,
        sitSpanSec: 7.0,
        insideMinSec: 6.0,
        insideSpanSec: 5.0,
      }),
    );
    changed = true;
  }

  return changed;
}
