import {
  BALLOON_PALETTE,
  MYOTHAR_CONVERGENCE_TARGET,
  type VillageLaunchHub,
} from '../game/fireBalloonModel.ts';

export interface DeterministicBalloonDescriptor {
  id: number;
  zoneId: string;
  originX: number;
  originY: number;
  originZ: number;
  targetX: number;
  targetZ: number;
  ceilingY: number;
  cycleDuration: number;
  phaseOffset: number;
  swayFreq: number;
  swayPhase: number;
  swayAmp: number;
  baseScale: number;
  baseYaw: number;
  colorHex: string;
}

export interface SampledBalloonPose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  scale: number;
  progress: number;
}

export interface LanternPostPlacement {
  zoneId: string;
  x: number;
  y: number;
  z: number;
  colorHex: string;
}

export interface GroundDisplayBalloonPlacement {
  zoneId: string;
  x: number;
  y: number;
  z: number;
  scale: number;
}

/**
  * Pure deterministic Mulberry32 PRNG.
  */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable per-zone seed: nearby-zone selection/order must not change a trajectory. */
export function festivalZoneSeed(seed: number, zoneId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < zoneId.length; i++) hash = Math.imul(hash ^ zoneId.charCodeAt(i), 16777619);
  return (seed ^ hash) >>> 0;
}

/**
 * Generates deterministic decorative balloon descriptors for the configured festival zones.
 */
export function buildBalloonShowDescriptors(
  zones: VillageLaunchHub[],
  balloonsPerZone: number,
  seed: number = 20261115,
  ceiling: number = 520,
  minAltitude: number = 18,
): DeterministicBalloonDescriptor[] {
  const safePerZone = Math.max(1, Math.min(400, Math.floor(balloonsPerZone)));
  const descriptors: DeterministicBalloonDescriptor[] = [];
  let globalId = 0;

  for (let zIdx = 0; zIdx < zones.length; zIdx++) {
    const hub = zones[zIdx];
    const rand = createSeededRandom(festivalZoneSeed(seed, hub.id));

    for (let i = 0; i < safePerZone; i++) {
      // Avoid spawning directly inside the 6m rideable PassengerBalloon launch ring at (123.79, -37.02)
      const minRadius = hub.id === 'myothar' ? 18 : 6;
      const maxRadius = Math.max(minRadius + 20, hub.spreadRadius);
      const angle = rand() * Math.PI * 2;
      const dist = minRadius + Math.sqrt(rand()) * (maxRadius - minRadius);

      const originX = hub.x + Math.cos(angle) * dist;
      const originZ = hub.z + Math.sin(angle) * dist;
      const originY = hub.groundY + minAltitude;

      // Target convergence point with deterministic fan-out dispersion
      const isLocalMyothar =
        hub.id === 'myothar' ||
        Math.hypot(hub.x - MYOTHAR_CONVERGENCE_TARGET.x, hub.z - MYOTHAR_CONVERGENCE_TARGET.z) < 420;
      const targetX = isLocalMyothar
        ? originX + (rand() - 0.5) * 260
        : MYOTHAR_CONVERGENCE_TARGET.x + (rand() - 0.5) * MYOTHAR_CONVERGENCE_TARGET.fanSpread * 2;
      const targetZ = isLocalMyothar
        ? originZ - 80 + (rand() - 0.5) * 260
        : MYOTHAR_CONVERGENCE_TARGET.z + (rand() - 0.5) * MYOTHAR_CONVERGENCE_TARGET.fanSpread * 2;

      const isLeader = i % 24 === 0;
      const baseScale = isLeader ? 1.75 + rand() * 0.65 : 0.85 + rand() * 0.7;
      const cycleDuration = 150 + rand() * 140; // 150s..290s full ascent cycle
      const phaseOffset = rand();
      const swayFreq = 0.35 + rand() * 0.45;
      const swayPhase = rand() * Math.PI * 2;
      const swayAmp = 2.2 + rand() * 3.8;
      const dx = targetX - originX;
      const dz = targetZ - originZ;
      const baseYaw = Math.atan2(dx, dz) + (rand() - 0.5) * 0.25;
      const palette = hub.palette.length > 0 ? hub.palette : ['#ff9d2b'];
      const colorHex = palette[i % palette.length];

      descriptors.push({
        id: globalId++,
        zoneId: hub.id,
        originX,
        originY,
        originZ,
        targetX,
        targetZ,
        ceilingY: Math.max(originY + 80, ceiling - rand() * 60),
        cycleDuration,
        phaseOffset,
        swayFreq,
        swayPhase,
        swayAmp,
        baseScale,
        baseYaw,
        colorHex,
      });
    }
  }

  return descriptors;
}

/**
 * Selects up to `maxZones` festival zones nearest to `(focusX, focusZ)` within `maxRadius`
 * (including each zone's spreadRadius) so distant village hubs (>1-4 km away) are not simulated.
 */
export function selectFestivalZonesNearFocus(
  zones: readonly VillageLaunchHub[],
  focusX: number,
  focusZ: number,
  maxZones: number,
  maxRadius: number,
): VillageLaunchHub[] {
  if (zones.length === 0 || maxZones <= 0) return [];
  const scored: { zone: VillageLaunchHub; distSq: number }[] = [];
  for (let i = 0; i < zones.length; i++) {
    const zone = zones[i];
    const dx = zone.x - focusX;
    const dz = zone.z - focusZ;
    const distSq = dx * dx + dz * dz;
    const limit = maxRadius + (zone.spreadRadius ?? 120);
    if (distSq <= limit * limit) {
      scored.push({ zone, distSq });
    }
  }
  scored.sort((a, b) => a.distSq - b.distSq);
  const count = Math.min(maxZones, scored.length);
  const out = new Array<VillageLaunchHub>(count);
  for (let i = 0; i < count; i++) out[i] = scored[i].zone;
  return out;
}

/**
 * Zero-allocation trajectory evaluator writing into a caller-supplied `SampledBalloonPose`.
 */
export function evaluateBalloonTransformInto(
  d: DeterministicBalloonDescriptor,
  timeSeconds: number,
  out: SampledBalloonPose,
): SampledBalloonPose {
  const rawPhase = (timeSeconds / d.cycleDuration + d.phaseOffset) % 1;
  const progress = rawPhase < 0 ? rawPhase + 1 : rawPhase;

  // Smooth ease-out vertical climb and horizontal drift
  const verticalEase = progress * (1.15 - 0.15 * progress);
  const y = d.originY + (d.ceilingY - d.originY) * verticalEase;

  const dx = d.targetX - d.originX;
  const dz = d.targetZ - d.originZ;
  const dist = Math.max(1, Math.sqrt(dx * dx + dz * dz));
  const nx = -dz / dist;
  const nz = dx / dist;

  const swayWave =
    Math.sin(timeSeconds * d.swayFreq + d.swayPhase) * d.swayAmp * Math.sin(progress * Math.PI);
  const x = d.originX + dx * progress + nx * swayWave;
  const z = d.originZ + dz * progress + nz * swayWave;

  // Smooth fade-in scale at launch and gentle shrink near ceiling recycling
  const launchEnvelope =
    progress < 0.04
      ? 0.35 + (progress / 0.04) * 0.65
      : progress > 0.96
        ? (1 - progress) / 0.04
        : 1;
  const scale = Math.max(0.15, d.baseScale * launchEnvelope);

  out.x = x;
  out.y = y;
  out.z = z;
  out.rx = 0.024 * Math.cos(timeSeconds * 0.6 + d.swayPhase);
  out.ry = d.baseYaw + 0.06 * Math.sin(timeSeconds * 0.25 + d.swayPhase);
  out.rz = 0.028 * Math.sin(timeSeconds * 0.7 + d.swayPhase);
  out.scale = scale;
  out.progress = progress;
  return out;
}

/**
 * Pure deterministic trajectory evaluator: given a balloon descriptor and simulation time `t`,
 * returns the exact world position, rotation, and scale without mutating state.
 */
export function evaluateBalloonTransform(
  d: DeterministicBalloonDescriptor,
  timeSeconds: number,
): SampledBalloonPose {
  const out: SampledBalloonPose = {
    x: 0,
    y: 0,
    z: 0,
    rx: 0,
    ry: 0,
    rz: 0,
    scale: 1,
    progress: 0,
  };
  return evaluateBalloonTransformInto(d, timeSeconds, out);
}

/**
 * Generates deterministic ground lantern post and ceremonial display balloon placements
 * around each active festival zone perimeter (keeping a 22m+ clearance from zone centers
 * so rideable balloon launch pads and road corridors remain completely clear).
 */
export function buildFestivalDecorationPlacements(
  zones: VillageLaunchHub[],
  mobile: boolean = false,
): {
  posts: LanternPostPlacement[];
  displayBalloons: GroundDisplayBalloonPlacement[];
} {
  const posts: LanternPostPlacement[] = [];
  const displayBalloons: GroundDisplayBalloonPlacement[] = [];
  const postsPerZone = mobile ? 8 : 16;
  const balloonsPerZone = mobile ? 1 : 2;

  for (let zIdx = 0; zIdx < zones.length; zIdx++) {
    const zone = zones[zIdx];
    const palette = zone.palette.length > 0 ? zone.palette : BALLOON_PALETTE;
    const ringRadius = zone.id === 'myothar' ? 24 : 28;

    for (let i = 0; i < postsPerZone; i++) {
      const angle = (i / postsPerZone) * Math.PI * 2 + zIdx * 0.35;
      posts.push({
        zoneId: zone.id,
        x: zone.x + Math.cos(angle) * ringRadius,
        y: zone.groundY,
        z: zone.z + Math.sin(angle) * ringRadius,
        colorHex: palette[i % palette.length],
      });
    }

    for (let b = 0; b < balloonsPerZone; b++) {
      const angle = (b / balloonsPerZone) * Math.PI * 2 + Math.PI * 0.25;
      const r = ringRadius + 5;
      displayBalloons.push({
        zoneId: zone.id,
        x: zone.x + Math.cos(angle) * r,
        y: zone.groundY + 0.6,
        z: zone.z + Math.sin(angle) * r,
        scale: 0.9,
      });
    }
  }

  return { posts, displayBalloons };
}
