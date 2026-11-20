/**
 * Daytime Street & Neighbor-Visiting Villager Crowd Engine (လမ်းမကြီးနှင့် ရပ်ကွက်လမ်းသွယ် လူသွားလူလာ Bot များ).
 *
 * Pure TypeScript (zero Three.js/DOM imports):
 * - Drives a bounded fixed pool of street pedestrians along REAL connected road segments
 *   (`RouteNode[]` from `buildRoadGraph`), offset naturally onto left/right road shoulders.
 * - Scales crowd density & house-gate outings cleanly with game time-of-day (`morning` / `day` / `evening` / `night`).
 * - Includes friendly roadside neighbor-visit pauses and smooth camera-proximity slot recycling.
 */

import { periodAtMinute, type TimeMode, type TimePeriod } from './environmentTime.ts';
import { nextRoadNode, type RouteNode } from './robotRoutes.ts';
import {
  AUNTIE_OUTFIT_COUNT,
  BOY_OUTFIT_COUNT,
  GIRL_OUTFIT_COUNT,
  HAIR_TONE_COUNT,
  SKIN_TONE_COUNT,
  UNCLE_OUTFIT_COUNT,
} from './houseResidentPool.ts';
import { shortestAngleDelta, type ResidentRole } from './residentBots.ts';

export interface StreetPedestrianProfile {
  readonly slotIndex: number;
  readonly role: ResidentRole;
  readonly youthful: boolean;
  readonly bottomStyle: 'longyi' | 'trousers';
  readonly outfitIndex: number;
  readonly skinIndex: number;
  readonly hairIndex: number;
  readonly heightScale: number;
  readonly walkSpeed: number;
  /** Signed lateral shoulder offset (m) so walkers stay naturally along road sides. */
  readonly sideOffset: number;
}

export interface StreetPedestrianState {
  readonly slotIndex: number;
  active: boolean;
  regionId: string | null;
  x: number;
  y: number;
  z: number;
  yaw: number;
  fromNode: number;
  toNode: number;
  walkDistance: number;
  speed: number;
  elapsed: number;
  /** Pause countdown (seconds) when stopping briefly to greet/visit a roadside house or neighbor. */
  pauseTimer: number;
  /** Segments walked since last neighbor-visit pause. */
  segmentsSincePause: number;
  seed: number;
}

/** Resolves effective time-of-day period from `(minute, timeMode)`. */
export function resolveTimePeriod(minute: number, timeMode?: TimeMode): TimePeriod {
  if (timeMode && timeMode !== 'auto') return timeMode;
  return periodAtMinute(minute);
}

/** True during morning, daytime, and evening when villagers open gates and stroll/visit outside. */
export function isDaytimeLivingHours(minute: number, timeMode?: TimeMode): boolean {
  const period = resolveTimePeriod(minute, timeMode);
  return period === 'morning' || period === 'day' || period === 'evening';
}

/**
 * Computes active street pedestrian count based on time-of-day:
 * - Morning & Day: 100% bustling town & village crowd
 * - Evening: ~65% strolling before sunset
 * - Night: ~14% quiet late-night walkers (min 2)
 */
export function desiredPedestrianCount(
  minute: number,
  timeMode: TimeMode | undefined,
  maxPool: number,
): number {
  const period = resolveTimePeriod(minute, timeMode);
  if (period === 'morning' || period === 'day') return maxPool;
  if (period === 'evening') return Math.max(4, Math.round(maxPool * 0.65));
  return Math.min(maxPool, Math.max(2, Math.round(maxPool * 0.14)));
}

function lcg(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return [next, next / 4294967296];
}

/** Deterministically creates a diverse cast of Myanmar townsfolk & kids for the fixed street pool. */
export function createStreetPedestrianProfiles(poolSize: number): StreetPedestrianProfile[] {
  const profiles: StreetPedestrianProfile[] = [];
  for (let i = 0; i < poolSize; i++) {
    let seed = (Math.imul(i + 17, 2654435761) ^ 0x51a7c3) >>> 0;
    let r: number;

    // Diverse mix: 25% elder uncle, 25% elder auntie, 18% young man in trousers, 17% young woman, 15% kids
    [seed, r] = lcg(seed);
    let role: ResidentRole;
    let youthful = false;
    let bottomStyle: 'longyi' | 'trousers' = 'longyi';
    if (r < 0.25) {
      role = 'uncle';
    } else if (r < 0.5) {
      role = 'auntie';
    } else if (r < 0.68) {
      role = 'uncle';
      youthful = true;
      bottomStyle = 'trousers';
    } else if (r < 0.85) {
      role = 'auntie';
      youthful = true;
    } else if (r < 0.925) {
      role = 'boy';
      youthful = true;
    } else {
      role = 'girl';
      youthful = true;
    }

    const outfitMax =
      role === 'uncle'
        ? UNCLE_OUTFIT_COUNT
        : role === 'auntie'
          ? AUNTIE_OUTFIT_COUNT
          : role === 'boy'
            ? BOY_OUTFIT_COUNT
            : GIRL_OUTFIT_COUNT;

    [seed, r] = lcg(seed);
    const outfitIndex = Math.floor(r * outfitMax);

    [seed, r] = lcg(seed);
    const skinIndex = Math.floor(r * SKIN_TONE_COUNT);

    [seed, r] = lcg(seed);
    const hairIndex = youthful ? 0 : Math.floor(r * HAIR_TONE_COUNT);

    [seed, r] = lcg(seed);
    let heightScale: number;
    if (role === 'uncle') heightScale = +(0.95 + r * 0.12).toFixed(3);
    else if (role === 'auntie') heightScale = +(0.87 + r * 0.12).toFixed(3);
    else if (role === 'boy') heightScale = +(0.58 + r * 0.1).toFixed(3);
    else heightScale = +(0.56 + r * 0.1).toFixed(3);

    [seed, r] = lcg(seed);
    const baseSpeed = role === 'boy' || role === 'girl' ? 1.28 : youthful ? 1.12 : 0.94;
    const walkSpeed = +(baseSpeed + r * 0.22).toFixed(3);

    // Sidewalk/shoulder offset alternating left & right sides of the road
    [seed, r] = lcg(seed);
    const sideSign = i % 2 === 0 ? 1 : -1;
    const sideOffset = +(sideSign * (0.95 + r * 0.65)).toFixed(2);

    profiles.push({
      slotIndex: i,
      role,
      youthful,
      bottomStyle,
      outfitIndex,
      skinIndex,
      hairIndex,
      heightScale,
      walkSpeed,
      sideOffset,
    });
  }
  return profiles;
}

export function createStreetPedestrianStates(poolSize: number): StreetPedestrianState[] {
  return Array.from({ length: poolSize }, (_, slotIndex) => ({
    slotIndex,
    active: false,
    regionId: null,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    fromNode: 0,
    toNode: 0,
    walkDistance: 0,
    speed: 0,
    elapsed: slotIndex * 0.73,
    pauseTimer: 0,
    segmentsSincePause: 0,
    seed: (Math.imul(slotIndex + 1, 1597334677) ^ 0x20261120) >>> 0,
  }));
}

/**
 * Picks a well-spread road node near `(focusX, focusZ)` within `[minRadius, maxRadius]`
 * so recycled pedestrians appear naturally along nearby roads & residential lanes.
 */
export function pickNearbyRoadNode(
  graph: readonly RouteNode[],
  focusX: number,
  focusZ: number,
  minRadius: number,
  maxRadius: number,
  seed: number,
): number {
  const minSq = minRadius * minRadius;
  const maxSq = maxRadius * maxRadius;
  const candidates: number[] = [];
  let closestIdx = -1;
  let closestSq = Infinity;

  for (let i = 0; i < graph.length; i++) {
    const n = graph[i];
    if (n.links.length === 0) continue;
    const dx = n.x - focusX;
    const dz = n.z - focusZ;
    const d2 = dx * dx + dz * dz;
    if (d2 < closestSq) {
      closestSq = d2;
      closestIdx = i;
    }
    if (d2 >= minSq && d2 <= maxSq) {
      candidates.push(i);
    }
  }

  if (candidates.length > 0) {
    return candidates[seed % candidates.length];
  }
  return closestIdx;
}

/** Places a pedestrian cleanly onto a connected road segment starting at `startNode`. */
export function placePedestrianOnGraph(
  state: StreetPedestrianState,
  regionId: string,
  graph: readonly RouteNode[],
  startNode: number,
  sideOffset: number,
): boolean {
  const n = graph[startNode];
  if (!n || n.links.length === 0) {
    state.active = false;
    return false;
  }
  const [nextSeed, rand] = lcg(state.seed);
  state.seed = nextSeed;
  const toNode = n.links[Math.floor(rand * n.links.length) % n.links.length];
  const target = graph[toNode];
  const dx = target.x - n.x;
  const dz = target.z - n.z;
  const len = Math.hypot(dx, dz) || 1;
  // Lateral shoulder offset perpendicular to road direction
  const shoulder = n.lane ? sideOffset * 0.65 : sideOffset * 1.45;
  const nx = -dz / len;
  const nz = dx / len;

  state.active = true;
  state.regionId = regionId;
  state.fromNode = startNode;
  state.toNode = toNode;
  state.x = n.x + nx * shoulder;
  state.z = n.z + nz * shoulder;
  state.yaw = Math.atan2(dx, dz);
  state.speed = 0;
  state.pauseTimer = 0;
  state.segmentsSincePause = 0;
  return true;
}

/**
 * Advances one street pedestrian along connected road segments, with natural shoulder
 * offset and periodic roadside neighbor-visiting pauses.
 */
export function stepStreetPedestrian(
  state: StreetPedestrianState,
  profile: StreetPedestrianProfile,
  graph: readonly RouteNode[],
  rawDt: number,
): void {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (!state.active || dt <= 0) return;

  state.elapsed += dt;

  // Roadside neighbor-visit / chatting pause
  if (state.pauseTimer > 0) {
    state.pauseTimer = Math.max(0, state.pauseTimer - dt);
    state.speed = 0;
    return;
  }

  const from = graph[state.fromNode];
  const to = graph[state.toNode];
  if (!from || !to) {
    state.active = false;
    return;
  }

  const segDx = to.x - from.x;
  const segDz = to.z - from.z;
  const segLen = Math.hypot(segDx, segDz) || 1;
  const shoulder = to.lane ? profile.sideOffset * 0.65 : profile.sideOffset * 1.45;
  const targetX = to.x + (-segDz / segLen) * shoulder;
  const targetZ = to.z + (segDx / segLen) * shoulder;

  const dx = targetX - state.x;
  const dz = targetZ - state.z;
  const dist = Math.hypot(dx, dz);
  const maxStep = profile.walkSpeed * dt;

  if (dist > 0.001) {
    const step = Math.min(dist, maxStep);
    state.x += (dx / dist) * step;
    state.z += (dz / dist) * step;
    state.walkDistance += step;
    state.speed = step / dt;
    state.yaw += shortestAngleDelta(state.yaw, Math.atan2(dx, dz)) * (1 - Math.exp(-dt * 8));
  }

  if (dist <= maxStep + 0.12) {
    const prev = state.fromNode;
    state.fromNode = state.toNode;
    let rand: number;
    [state.seed, rand] = lcg(state.seed);
    state.toNode = nextRoadNode(graph as RouteNode[], state.fromNode, prev, rand);
    state.segmentsSincePause += 1;

    // Occasionally stop beside a residential lane to greet/visit a neighboring house!
    if (to.lane && state.segmentsSincePause >= 3) {
      [state.seed, rand] = lcg(state.seed);
      if (rand < 0.32) {
        state.segmentsSincePause = 0;
        [state.seed, rand] = lcg(state.seed);
        state.pauseTimer = 2.8 + rand * 4.2;
        state.speed = 0;
        // Turn slightly toward the roadside houses while chatting
        state.yaw += (profile.sideOffset > 0 ? 1 : -1) * 1.15;
      }
    }
  }
}
