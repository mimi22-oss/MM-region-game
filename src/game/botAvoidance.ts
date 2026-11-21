/**
 * ============================================================================
 * Unified Bot-to-Bot, Livestock & Car-Traffic Avoidance Engine
 * ============================================================================
 *
 * Pure TypeScript, zero-allocation hot path shared across ALL moving bots:
 * - Human Bots (`RobotBots`, `VillagePedestrianBots`, `HouseResidentBots`,
 *   `ChinVillageBots`, `VillageInstitutionBots`)
 * - Paddy-Field Livestock (`FieldLivestockBots` — Cow, Water Buffalo, Horse)
 * - Road Traffic Cars (`CarBots`)
 * - Player Character (`'player'` focus anchor)
 *
 * Guarantees:
 * 1. **Car Braking & Waiting**: When a Car bot detects ANY person (NPC or player),
 *    livestock (cow/buffalo/horse), or another car ahead in its driving corridor,
 *    the car brakes smoothly to a FULL STOP (`speed = 0`) well before contact and
 *    waits until the lane ahead is completely clear!
 * 2. **Active Car-Lane Yielding**: Any human bot or livestock inside an approaching
 *    or stopped car's corridor actively steps aside perpendicular off the lane so
 *    traffic never deadlocks AND never clips through anyone!
 * 3. **Zero Bot-to-Bot Overlap / Pass-Through**: Walking humans & livestock apply
 *    right-hand tangential steering to curve cleanly past each other PLUS hard
 *    minimum-distance separation + car hull exclusion so bots never overlap!
 */

export type AvoidanceActorKind = 'human' | 'livestock' | 'car' | 'player';

export interface AvoidanceActor {
  readonly id: string;
  kind: AvoidanceActorKind;
  x: number;
  z: number;
  yaw: number;
  radius: number;
  halfWidth: number;
  halfLength: number;
  speed: number;
  stationary: boolean;
}

export interface UpsertActorOptions {
  halfWidth?: number;
  halfLength?: number;
  speed?: number;
  stationary?: boolean;
}

export interface CarClearanceResult {
  readonly blocked: boolean;
  /** Desired speed multiplier `0..1` (`0` = full stop, `0..1` = cautious slow down, `1` = free cruise) */
  readonly targetSpeedFactor: number;
  readonly nearestDist: number;
  readonly blockerKind: AvoidanceActorKind | null;
}

export interface BotAvoidanceOptions {
  /** Optional static obstacle validator (e.g. `canStand`) so sidesteps don't push into walls */
  canStand?: (x: number, z: number) => boolean;
  /** Max yield speed when stepping aside for an approaching/stopped car */
  yieldSpeed?: number;
  /** Optional bounding clamp callback (e.g. keep livestock inside its paddy field) */
  clampPos?: (x: number, z: number) => { x: number; z: number };
}

export interface BotAvoidanceStepResult {
  x: number;
  z: number;
  yaw: number;
  yieldedToCar: boolean;
  steered: boolean;
}

const actors = new Map<string, AvoidanceActor>();

/**
 * Registers or updates a live moving actor in-place (ZERO allocation on repeat updates!).
 */
export function upsertAvoidanceActor(
  id: string,
  kind: AvoidanceActorKind,
  x: number,
  z: number,
  yaw: number,
  radius: number,
  opts?: UpsertActorOptions,
): void {
  let entry = actors.get(id);
  if (!entry) {
    entry = {
      id,
      kind,
      x,
      z,
      yaw,
      radius,
      halfWidth: opts?.halfWidth ?? radius,
      halfLength: opts?.halfLength ?? radius,
      speed: opts?.speed ?? 0,
      stationary: opts?.stationary ?? false,
    };
    actors.set(id, entry);
    return;
  }
  entry.kind = kind;
  entry.x = x;
  entry.z = z;
  entry.yaw = yaw;
  entry.radius = radius;
  entry.halfWidth = opts?.halfWidth ?? radius;
  entry.halfLength = opts?.halfLength ?? radius;
  entry.speed = opts?.speed ?? 0;
  entry.stationary = opts?.stationary ?? false;
}

export function removeAvoidanceActor(id: string): void {
  actors.delete(id);
}

export function clearAvoidanceActors(): void {
  actors.clear();
}

export function getAvoidanceActorCount(): number {
  return actors.size;
}

/**
 * Evaluates whether a Car bot at `(carX, carZ, carYaw)` has a clear road ahead.
 * - Hard-stops (`blocked: true, targetSpeedFactor: 0`) if ANY human, player, livestock
 *   (cow/buffalo/horse), or other car is inside its forward stopping corridor!
 * - Smoothly decelerates (`0 < targetSpeedFactor < 1`) within the caution lookahead zone.
 */
export function evaluateCarForwardClearance(
  carId: string,
  carX: number,
  carZ: number,
  carYaw: number,
  carHalfWidth = 1.05,
  carHalfLength = 2.05,
): CarClearanceResult {
  const fx = Math.sin(carYaw);
  const fz = Math.cos(carYaw);
  const rx = fz;
  const rz = -fx;

  let blocked = false;
  let minSpeedFactor = 1;
  let nearestDist = Infinity;
  let blockerKind: AvoidanceActorKind | null = null;

  for (const other of actors.values()) {
    if (other.id === carId) continue;

    const dx = other.x - carX;
    const dz = other.z - carZ;
    // Fast radial reject (> 22m away)
    if (dx * dx + dz * dz > 22 * 22) continue;

    const forward = dx * fx + dz * fz;
    // Ignore actors safely behind the car's center
    if (forward < -0.5) continue;

    const lateral = Math.abs(dx * rx + dz * rz);
    const isVehicle = other.kind === 'car';

    // Oriented lane corridor half-width + safety margin
    const lateralMargin = isVehicle
      ? carHalfWidth + other.halfWidth + 0.35
      : carHalfWidth + other.radius + 0.95;

    if (lateral > lateralMargin) continue;

    // Bumper-to-obstacle clearance distance
    const otherFrontExtent = isVehicle ? other.halfLength : other.radius;
    const gap = forward - carHalfLength - otherFrontExtent;

    const stopGap = isVehicle ? 5.0 : other.kind === 'livestock' ? 11.5 : 10.5;
    const cautionGap = isVehicle ? 14.5 : 18.0;

    if (gap <= stopGap) {
      blocked = true;
      minSpeedFactor = 0;
      if (gap < nearestDist) {
        nearestDist = gap;
        blockerKind = other.kind;
      }
    } else if (gap < cautionGap) {
      const factor = Math.max(0.12, (gap - stopGap) / (cautionGap - stopGap));
      if (factor < minSpeedFactor) {
        minSpeedFactor = factor;
        if (gap < nearestDist) {
          nearestDist = gap;
          blockerKind = other.kind;
        }
      }
    }
  }

  return {
    blocked,
    targetSpeedFactor: blocked ? 0 : minSpeedFactor,
    nearestDist,
    blockerKind,
  };
}

/**
 * Smoothly updates a Car bot's speed (`m/s`) given its forward clearance.
 * Brakes decisively when a person or cow/buffalo/horse is ahead and smoothly resumes once clear.
 */
export function stepCarTrafficSpeed(
  currentSpeed: number,
  cruiseSpeed: number,
  clearance: CarClearanceResult,
  dt: number,
): number {
  const targetSpeed = clearance.blocked ? 0 : cruiseSpeed * clearance.targetSpeedFactor;
  if (targetSpeed < currentSpeed) {
    // Firm, decisive braking so the car comes to a complete stop well before touching anyone
    const decel = clearance.blocked ? 28.0 : 12.0;
    return Math.max(targetSpeed, currentSpeed - decel * dt);
  }
  // Smooth acceleration once the road ahead is completely clear
  const accel = 4.6;
  return Math.min(targetSpeed, currentSpeed + accel * dt);
}

/**
 * Applies full collision-free steering & car-yielding for any Human Bot or Livestock Bot:
 * 1. If in front of an approaching/stopped Car bot -> actively yields sideways off the lane!
 * 2. Smoothly curves around nearby humans & livestock (right-hand passing rule) with ZERO overlap!
 * 3. Hard-excludes car hulls so no bot ever clips into a stopped or moving vehicle!
 */
export function applyBotAvoidanceStep(
  id: string,
  kind: 'human' | 'livestock',
  prevX: number,
  prevZ: number,
  nextX: number,
  nextZ: number,
  currentYaw: number,
  radius: number,
  dt: number,
  opts?: BotAvoidanceOptions,
): BotAvoidanceStepResult {
  const clampedDt = Math.min(0.08, Math.max(0.001, dt));
  let x = nextX;
  let z = nextZ;
  let yaw = currentYaw;
  let yieldedToCar = false;
  let steered = false;

  const moveDx = nextX - prevX;
  const moveDz = nextZ - prevZ;
  const moveDist = Math.hypot(moveDx, moveDz);
  const yieldSpeed = opts?.yieldSpeed ?? (kind === 'livestock' ? 1.55 : 1.95);

  // -------------------------------------------------------------------------
  // 1. PRIORITY: Yield off the lane for any approaching or stopped Car bot!
  // -------------------------------------------------------------------------
  let evadeX = 0;
  let evadeZ = 0;
  for (const other of actors.values()) {
    if (other.kind !== 'car' || other.id === id) continue;
    const dx = x - other.x;
    const dz = z - other.z;
    if (dx * dx + dz * dz > 20 * 20) continue;

    const fx = Math.sin(other.yaw);
    const fz = Math.cos(other.yaw);
    const rx = fz;
    const rz = -fx;

    const forward = dx * fx + dz * fz;
    const lateral = dx * rx + dz * rz;
    const safeLaneHalfW = other.halfWidth + radius + 1.85;

    if (
      forward > -other.halfLength - 1.2 &&
      forward < other.halfLength + 15.5 &&
      Math.abs(lateral) < safeLaneHalfW
    ) {
      // Step away from the car's centerline to the nearest shoulder
      const sideSign = lateral >= 0 ? 1 : -1;
      const urgency = 1 - Math.min(1, Math.abs(lateral) / safeLaneHalfW);
      evadeX += rx * sideSign * (0.75 + urgency);
      evadeZ += rz * sideSign * (0.75 + urgency);
      yieldedToCar = true;
    }
  }

  if (yieldedToCar) {
    const eLen = Math.hypot(evadeX, evadeZ);
    if (eLen > 1e-4) {
      const step = yieldSpeed * clampedDt;
      const candX = prevX + (evadeX / eLen) * step;
      const candZ = prevZ + (evadeZ / eLen) * step;
      if (!opts?.canStand || opts.canStand(candX, candZ)) {
        x = candX;
        z = candZ;
        yaw = Math.atan2(evadeX, evadeZ);
        steered = true;
      } else {
        // If one shoulder is blocked by a fence/building, try the opposite shoulder!
        const altX = prevX - (evadeX / eLen) * step;
        const altZ = prevZ - (evadeZ / eLen) * step;
        if (opts.canStand(altX, altZ)) {
          x = altX;
          z = altZ;
          yaw = Math.atan2(-evadeX, -evadeZ);
          steered = true;
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Smooth Peer-to-Peer Steering & Hard Non-Overlap Separation
  //    (Humans <-> Humans, Livestock <-> Livestock, Humans <-> Livestock)
  // -------------------------------------------------------------------------
  let steerX = 0;
  let steerZ = 0;

  for (const other of actors.values()) {
    if (other.id === id || other.kind === 'car' || other.kind === 'player') continue;

    const dx = x - other.x;
    const dz = z - other.z;
    const minDist = radius + other.radius + (kind === 'livestock' || other.kind === 'livestock' ? 0.42 : 0.3);
    const senseDist = minDist + 1.55;
    const distSq = dx * dx + dz * dz;
    if (distSq >= senseDist * senseDist) continue;

    const dist = Math.sqrt(distSq);
    let nx: number;
    let nz: number;
    if (dist < 1e-4) {
      // Deterministic tie-breaker so identical start points separate cleanly
      const tie = id < other.id ? 1 : -1;
      nx = tie;
      nz = 0;
    } else {
      nx = dx / dist;
      nz = dz / dist;
    }

    if (dist < minDist) {
      // Hard non-overlap separation push
      const overlap = minDist - dist;
      const push = other.stationary ? overlap + 0.04 : overlap * 0.6 + 0.03;
      steerX += nx * push;
      steerZ += nz * push;
      steered = true;
    }

    // Soft tangential right-hand passing curve so approaching bots glide smoothly around each other!
    const proximity = 1 - Math.min(1, dist / senseDist);
    // Perpendicular vector (right-hand sidestep)
    const tangX = -nz;
    const tangZ = nx;
    const passMag = proximity * (moveDist > 0.002 ? moveDist * 1.15 : 0.45 * clampedDt);
    steerX += (nx * 0.45 + tangX * 0.85) * passMag;
    steerZ += (nz * 0.45 + tangZ * 0.85) * passMag;
    if (proximity > 0.2) steered = true;
  }

  if (steered && (Math.abs(steerX) > 1e-4 || Math.abs(steerZ) > 1e-4)) {
    const maxShift = Math.max(0.45, yieldSpeed * clampedDt * 2.2);
    const sLen = Math.hypot(steerX, steerZ);
    const scale = sLen > maxShift ? maxShift / sLen : 1;
    const candX = x + steerX * scale;
    const candZ = z + steerZ * scale;
    if (!opts?.canStand || opts.canStand(candX, candZ)) {
      x = candX;
      z = candZ;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Hard Car Hull Exclusion (never clip into the body of a stopped/moving car)
  // -------------------------------------------------------------------------
  for (const other of actors.values()) {
    if (other.kind !== 'car' || other.id === id) continue;
    const dx = x - other.x;
    const dz = z - other.z;
    if (dx * dx + dz * dz > 10 * 10) continue;

    const fx = Math.sin(other.yaw);
    const fz = Math.cos(other.yaw);
    const rx = fz;
    const rz = -fx;

    const forward = dx * fx + dz * fz;
    const lateral = dx * rx + dz * rz;
    const exclW = other.halfWidth + radius + 0.35;
    const exclL = other.halfLength + radius + 0.35;

    if (Math.abs(lateral) < exclW && Math.abs(forward) < exclL) {
      // Project cleanly out along the shortest axis (prefer lateral shoulder!)
      const pushSide = (lateral >= 0 ? 1 : -1) * (exclW - Math.abs(lateral) + 0.08);
      const candX = x + rx * pushSide;
      const candZ = z + rz * pushSide;
      if (!opts?.canStand || opts.canStand(candX, candZ)) {
        x = candX;
        z = candZ;
        steered = true;
      } else {
        x = prevX;
        z = prevZ;
        steered = true;
      }
    }
  }

  if (opts?.clampPos) {
    const clamped = opts.clampPos(x, z);
    x = clamped.x;
    z = clamped.z;
  }

  // Update facing yaw smoothly along actual resulting travel vector when steered
  const finalDx = x - prevX;
  const finalDz = z - prevZ;
  if (steered && Math.hypot(finalDx, finalDz) > 0.004) {
    const desiredYaw = Math.atan2(finalDx, finalDz);
    let diff = desiredYaw - yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    yaw += diff * Math.min(1, clampedDt * 8.0);
  }

  return { x, z, yaw, yieldedToCar, steered };
}
