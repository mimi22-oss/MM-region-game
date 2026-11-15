import { CatmullRomCurve3, MathUtils, Vector3 } from 'three';
import type { IntroTarget } from './IntroStateMachine.ts';

export type SurfaceHeightSampler = (x: number, z: number) => number;

export type IntroObstacleBox = {
  x: number;
  z: number;
  halfWidth: number;
  halfDepth: number;
  topY: number;
  rotation?: number;
};

export type IntroCameraPathOptions = {
  townCenter?: { x: number; z: number };
  origin?: { x: number; z: number } | null;
  sampleSurfaceHeight?: SurfaceHeightSampler;
  obstacles?: readonly IntroObstacleBox[];
  mobile?: boolean;
  reducedMotion?: boolean;
};

export type IntroCameraSample = {
  position: Vector3;
  lookAt: Vector3;
  viewFocus: { x: number; z: number };
};

export type IntroCameraPath = {
  target: IntroTarget;
  reducedMotion: boolean;
  waypoints: Vector3[];
  lookTargets: Vector3[];
  terminalPosition: Vector3;
  terminalLookAt: Vector3;
  positionCurve: CatmullRomCurve3;
  lookAtCurve: CatmullRomCurve3;
  evaluate: (
    progress: number,
    outPosition: Vector3,
    outLookAt: Vector3,
    outViewFocus?: { x: number; z: number },
    liveSurfaceHeight?: SurfaceHeightSampler,
  ) => IntroCameraSample;
};

/** Exact match to third-person camera formula in `src/components/Player.tsx`. */
export function computeThirdPersonCameraPose(
  target: Pick<IntroTarget, 'x' | 'z' | 'yaw' | 'pitch' | 'distance' | 'bodyScale'>,
  groundY: number,
  outPosition = new Vector3(),
  outLookAt = new Vector3(),
): { position: Vector3; lookAt: Vector3 } {
  const scale = target.bodyScale ?? 1;
  outLookAt.set(target.x, groundY + 1.65 * scale, target.z);
  const sinYaw = Math.sin(target.yaw);
  const cosYaw = Math.cos(target.yaw);
  const cosPitch = Math.cos(target.pitch);
  const sinPitch = Math.sin(target.pitch);

  outPosition.set(
    outLookAt.x + sinYaw * cosPitch * target.distance,
    Math.max(0.6, outLookAt.y - sinPitch * target.distance + 1.5),
    outLookAt.z + cosYaw * cosPitch * target.distance,
  );
  return { position: outPosition, lookAt: outLookAt };
}

function smoothstep(x: number, edge0: number, edge1: number): number {
  const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function softMaxFloor(value: number, floor: number, softness: number): number {
  if (softness <= 1e-4) return Math.max(value, floor);
  const diff = value - floor;
  return floor + 0.5 * (diff + Math.sqrt(diff * diff + softness * softness));
}

function sampleObstaclesCeiling(
  x: number,
  z: number,
  padRadius: number,
  obstacles?: readonly IntroObstacleBox[],
): number {
  if (!obstacles || obstacles.length === 0) return -Infinity;
  let maxTop = -Infinity;
  for (let i = 0; i < obstacles.length; i++) {
    const obs = obstacles[i];
    const rot = obs.rotation ?? 0;
    const dx = x - obs.x;
    const dz = z - obs.z;
    const maxBound = obs.halfWidth + obs.halfDepth + padRadius;
    if (Math.abs(dx) > maxBound && Math.abs(dz) > maxBound) continue;
    let lx = dx;
    let lz = dz;
    if (rot !== 0) {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      lx = dx * c - dz * s;
      lz = dx * s + dz * c;
    }
    if (Math.abs(lx) <= obs.halfWidth + padRadius && Math.abs(lz) <= obs.halfDepth + padRadius) {
      if (obs.topY > maxTop) maxTop = obs.topY;
    }
  }
  return maxTop;
}

export function sampleClearanceCeiling(
  x: number,
  z: number,
  radius: number,
  sampleSurfaceHeight: SurfaceHeightSampler,
  obstacles?: readonly IntroObstacleBox[],
): number {
  let maxH = sampleSurfaceHeight(x, z);
  if (radius > 0.25) {
    const diag = radius * 0.7071;
    const hN = sampleSurfaceHeight(x, z - radius);
    const hS = sampleSurfaceHeight(x, z + radius);
    const hE = sampleSurfaceHeight(x + radius, z);
    const hW = sampleSurfaceHeight(x - radius, z);
    const hNE = sampleSurfaceHeight(x + diag, z - diag);
    const hSW = sampleSurfaceHeight(x - diag, z + diag);
    if (hN > maxH) maxH = hN;
    if (hS > maxH) maxH = hS;
    if (hE > maxH) maxH = hE;
    if (hW > maxH) maxH = hW;
    if (hNE > maxH) maxH = hNE;
    if (hSW > maxH) maxH = hSW;
  }
  const obsTop = sampleObstaclesCeiling(x, z, Math.max(2, radius * 0.65), obstacles);
  if (obsTop > maxH) maxH = obsTop;
  return Number.isFinite(maxH) ? maxH : 0;
}

function clearanceEnvelope(progress: number): { radius: number; clearance: number; softness: number } {
  if (progress >= 0.92) {
    const t = smoothstep(progress, 0.92, 1.0);
    return {
      radius: MathUtils.lerp(2.0, 0.5, t),
      clearance: MathUtils.lerp(1.4, 0.25, t),
      softness: MathUtils.lerp(1.5, 0.05, t),
    };
  }
  if (progress >= 0.72) {
    const t = smoothstep(progress, 0.72, 0.92);
    return {
      radius: MathUtils.lerp(9.0, 2.0, t),
      clearance: MathUtils.lerp(14.0, 1.4, t),
      softness: MathUtils.lerp(5.0, 1.5, t),
    };
  }
  if (progress >= 0.44) {
    const t = smoothstep(progress, 0.44, 0.72);
    return {
      radius: MathUtils.lerp(18.0, 9.0, t),
      clearance: MathUtils.lerp(34.0, 14.0, t),
      softness: MathUtils.lerp(12.0, 5.0, t),
    };
  }
  return { radius: 22.0, clearance: 42.0, softness: 16.0 };
}

function normalize2D(x: number, z: number, fallbackX: number, fallbackZ: number): [number, number] {
  const len = Math.hypot(x, z);
  if (len > 1e-4) return [x / len, z / len];
  const fLen = Math.hypot(fallbackX, fallbackZ);
  return fLen > 1e-4 ? [fallbackX / fLen, fallbackZ / fLen] : [0, 1];
}

function rotate2D(x: number, z: number, angleRad: number): [number, number] {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return [x * c - z * s, x * s + z * c];
}

export function warpIntroProgress(progress: number, reducedMotion = false): number {
  const t = MathUtils.clamp(progress, 0, 1);
  if (reducedMotion) {
    return t * t * (3 - 2 * t);
  }
  // Smooth cosine ease blended with linear preserves steady aerial momentum and gentle arrival deceleration.
  const cosineEase = 0.5 - 0.5 * Math.cos(Math.PI * t);
  return 0.55 * t + 0.45 * cosineEase;
}

export function createIntroCameraPath(
  target: IntroTarget,
  options: IntroCameraPathOptions = {},
): IntroCameraPath {
  const sampleSurfaceHeight = options.sampleSurfaceHeight ?? (() => 0);
  const obstacles = options.obstacles;
  const mobile = Boolean(options.mobile);
  const reducedMotion = Boolean(options.reducedMotion);
  const townCenter = options.townCenter ?? { x: 0, z: 0 };

  const targetGroundY = sampleSurfaceHeight(target.x, target.z);
  const safeTargetGroundY = Number.isFinite(targetGroundY) ? targetGroundY : 0;
  const { position: terminalPosition, lookAt: terminalLookAt } = computeThirdPersonCameraPose(
    target,
    safeTargetGroundY,
  );

  // Player-relative planar basis (matches Player.tsx camera vector conventions).
  const behindX = Math.sin(target.yaw);
  const behindZ = Math.cos(target.yaw);
  const forwardX = -behindX;
  const forwardZ = -behindZ;
  const rightX = Math.cos(target.yaw);
  const rightZ = -Math.sin(target.yaw);

  if (reducedMotion) {
    const startOffsetDist = Math.min(3.5, Math.max(1.2, target.distance * 0.45));
    const pStart = new Vector3(
      terminalPosition.x + behindX * startOffsetDist,
      terminalPosition.y + 1.1,
      terminalPosition.z + behindZ * startOffsetDist,
    );
    const pMid = new Vector3().lerpVectors(pStart, terminalPosition, 0.55);
    pMid.y += 0.25;
    const waypoints = [pStart, pMid, terminalPosition.clone()];

    const lStart = new Vector3(
      terminalLookAt.x + forwardX * 1.2,
      terminalLookAt.y + 0.6,
      terminalLookAt.z + forwardZ * 1.2,
    );
    const lookTargets = [lStart, terminalLookAt.clone(), terminalLookAt.clone()];

    const positionCurve = new CatmullRomCurve3(waypoints, false, 'centripetal', 0.5);
    const lookAtCurve = new CatmullRomCurve3(lookTargets, false, 'centripetal', 0.5);
    const tmpFloor = new Vector3();

    return {
      target: { ...target },
      reducedMotion: true,
      waypoints,
      lookTargets,
      terminalPosition,
      terminalLookAt,
      positionCurve,
      lookAtCurve,
      evaluate(progress, outPosition, outLookAt, outViewFocus, liveSurfaceHeight) {
        const u = warpIntroProgress(progress, true);
        positionCurve.getPoint(u, outPosition);
        lookAtCurve.getPoint(u, outLookAt);
        const sampler = liveSurfaceHeight ?? sampleSurfaceHeight;
        const floorY = sampleClearanceCeiling(outPosition.x, outPosition.z, 0.8, sampler, obstacles) + 0.35;
        if (outPosition.y < floorY) outPosition.y = floorY;
        const blend = smoothstep(progress, 0.82, 1.0);
        if (blend > 0) {
          tmpFloor.copy(terminalPosition);
          outPosition.lerp(tmpFloor, blend);
          outLookAt.lerp(terminalLookAt, blend);
        }
        const focus = outViewFocus ?? { x: target.x, z: target.z };
        focus.x = target.x;
        focus.z = target.z;
        return { position: outPosition, lookAt: outLookAt, viewFocus: focus };
      },
    };
  }

  // Choose scenic overview approach direction pointing toward the wider town or prior travel origin.
  const toTownX = townCenter.x - target.x;
  const toTownZ = townCenter.z - target.z;
  const townDist = Math.hypot(toTownX, toTownZ);

  const hasOrigin =
    options.origin != null &&
    Number.isFinite(options.origin.x) &&
    Number.isFinite(options.origin.z) &&
    Math.hypot(options.origin.x - target.x, options.origin.z - target.z) > 140;

  let dirRefX = behindX;
  let dirRefZ = behindZ;
  if (hasOrigin && options.origin) {
    const toOrigX = options.origin.x - target.x;
    const toOrigZ = options.origin.z - target.z;
    const [ox, oz] = normalize2D(toOrigX, toOrigZ, behindX, behindZ);
    const [tx, tz] = normalize2D(toTownX, toTownZ, behindX, behindZ);
    dirRefX = ox * 0.65 + tx * 0.35;
    dirRefZ = oz * 0.65 + tz * 0.35;
  } else if (townDist > 120) {
    dirRefX = toTownX;
    dirRefZ = toTownZ;
  } else {
    // At town spawn, rotate ~52 degrees across the main avenue for a sweeping diagonal overview.
    [dirRefX, dirRefZ] = rotate2D(behindX, behindZ, 0.92);
  }

  const [panX, panZ] = normalize2D(dirRefX, dirRefZ, behindX, behindZ);
  // Choose consistent lateral curvature side (clockwise or counter-clockwise) toward behindDir.
  const cross = panX * behindZ - panZ * behindX;
  const curveSign = cross >= 0 ? 1 : -1;

  const altScale = mobile ? 0.78 : 1.0;
  const distScale = mobile ? 0.8 : 1.0;

  const [arc0X, arc0Z] = rotate2D(panX, panZ, curveSign * 0.32);
  const [arc1X, arc1Z] = rotate2D(panX, panZ, curveSign * 0.14);
  const [arc2X, arc2Z] = normalize2D(panX * 0.45 + behindX * 0.55, panZ * 0.45 + behindZ * 0.55, behindX, behindZ);

  const rawWaypoints: Array<{ x: number; z: number; baseY: number; progressHint: number }> = [
    // 1. High-altitude regional overview (~620m desktop / ~480m mobile)
    {
      x: target.x + arc0X * 820 * distScale,
      z: target.z + arc0Z * 820 * distScale,
      baseY: safeTargetGroundY + 620 * altScale,
      progressHint: 0.0,
    },
    // 2. Town approach (~360m desktop / ~280m mobile)
    {
      x: target.x + arc1X * 430 * distScale,
      z: target.z + arc1Z * 430 * distScale,
      baseY: safeTargetGroundY + 350 * altScale,
      progressHint: 0.22,
    },
    // 3. Ward/village descent (~145m desktop / ~115m mobile)
    {
      x: target.x + arc2X * 175 * distScale + rightX * curveSign * 42 * distScale,
      z: target.z + arc2Z * 175 * distScale + rightZ * curveSign * 42 * distScale,
      baseY: safeTargetGroundY + 145 * altScale,
      progressHint: 0.48,
    },
    // 4. Neighborhood flyover (~36m height over local avenue/trees)
    {
      x: target.x + behindX * 56 * distScale + rightX * curveSign * 24 * distScale,
      z: target.z + behindZ * 56 * distScale + rightZ * curveSign * 24 * distScale,
      baseY: safeTargetGroundY + 36,
      progressHint: 0.72,
    },
    // 5. Player reveal entry (~3.5x follow distance)
    {
      x: target.x + behindX * Math.max(12, target.distance * 2.3) + rightX * curveSign * Math.max(4, target.distance * 0.65),
      z: target.z + behindZ * Math.max(12, target.distance * 2.3) + rightZ * curveSign * Math.max(4, target.distance * 0.65),
      baseY: Math.max(terminalPosition.y + 5.2, safeTargetGroundY + 8.5),
      progressHint: 0.88,
    },
    // 6. Aligned trailing shoulder directly behind player vector
    {
      x:
        terminalLookAt.x +
        behindX * Math.max(target.distance + 1.8, target.distance * 1.28) * Math.cos(target.pitch),
      z:
        terminalLookAt.z +
        behindZ * Math.max(target.distance + 1.8, target.distance * 1.28) * Math.cos(target.pitch),
      baseY: terminalPosition.y + 0.75,
      progressHint: 0.96,
    },
    // 7. Exact Player third-person handoff pose
    {
      x: terminalPosition.x,
      z: terminalPosition.z,
      baseY: terminalPosition.y,
      progressHint: 1.0,
    },
  ];

  // Enforce terrain + building roof clearance on every control waypoint before spline generation.
  const waypoints = rawWaypoints.map((wp, index) => {
    if (index === rawWaypoints.length - 1) {
      return terminalPosition.clone();
    }
    const env = clearanceEnvelope(wp.progressHint);
    const ceiling = sampleClearanceCeiling(wp.x, wp.z, env.radius, sampleSurfaceHeight, obstacles);
    const safeY = Math.max(wp.baseY, ceiling + env.clearance);
    return new Vector3(wp.x, safeY, wp.z);
  });

  // Corresponding lookAt targets smoothly pan from wider town overview down onto avatar torso/eyes.
  const corridorCenterX = MathUtils.lerp(target.x, townCenter.x, townDist > 120 ? 0.35 : 0.0);
  const corridorCenterZ = MathUtils.lerp(target.z, townCenter.z, townDist > 120 ? 0.35 : 0.0);
  const corridorGround = sampleSurfaceHeight(corridorCenterX, corridorCenterZ);
  const safeCorridorY = Number.isFinite(corridorGround) ? corridorGround : safeTargetGroundY;

  const lookTargets = [
    new Vector3(corridorCenterX, safeCorridorY + 26, corridorCenterZ),
    new Vector3(
      MathUtils.lerp(corridorCenterX, target.x, 0.55),
      MathUtils.lerp(safeCorridorY + 18, safeTargetGroundY + 18, 0.55),
      MathUtils.lerp(corridorCenterZ, target.z, 0.55),
    ),
    new Vector3(target.x + forwardX * 20, safeTargetGroundY + 12, target.z + forwardZ * 20),
    new Vector3(target.x + forwardX * 8, safeTargetGroundY + 5, target.z + forwardZ * 8),
    new Vector3(target.x + forwardX * 2.2, terminalLookAt.y + 1.2, target.z + forwardZ * 2.2),
    terminalLookAt.clone(),
    terminalLookAt.clone(),
  ];

  const positionCurve = new CatmullRomCurve3(waypoints, false, 'centripetal', 0.5);
  const lookAtCurve = new CatmullRomCurve3(lookTargets, false, 'centripetal', 0.5);

  const tmpLiveTermPos = new Vector3();
  const tmpLiveTermLook = new Vector3();

  return {
    target: { ...target },
    reducedMotion: false,
    waypoints,
    lookTargets,
    terminalPosition,
    terminalLookAt,
    positionCurve,
    lookAtCurve,
    evaluate(progress, outPosition, outLookAt, outViewFocus, liveSurfaceHeight) {
      const t = MathUtils.clamp(progress, 0, 1);
      const u = warpIntroProgress(t, false);

      positionCurve.getPoint(u, outPosition);
      lookAtCurve.getPoint(u, outLookAt);

      const sampler = liveSurfaceHeight ?? sampleSurfaceHeight;
      const liveGround = sampler(target.x, target.z);
      const effectiveGroundY = Number.isFinite(liveGround) ? liveGround : safeTargetGroundY;
      computeThirdPersonCameraPose(target, effectiveGroundY, tmpLiveTermPos, tmpLiveTermLook);

      if (t < 0.96) {
        const env = clearanceEnvelope(t);
        const ceiling = sampleClearanceCeiling(
          outPosition.x,
          outPosition.z,
          env.radius,
          sampler,
          obstacles,
        );
        const minSafeY = ceiling + env.clearance;
        outPosition.y = softMaxFloor(outPosition.y, minSafeY, env.softness);
      }

      // Guarantee zero discontinuity on handoff to Player.tsx camera controller.
      const handoffBlend = smoothstep(t, 0.90, 1.0);
      if (handoffBlend > 0) {
        outPosition.lerp(tmpLiveTermPos, handoffBlend);
        outLookAt.lerp(tmpLiveTermLook, handoffBlend);
      }

      const focus = outViewFocus ?? { x: target.x, z: target.z };
      const focusToTargetBlend = smoothstep(t, 0.12, 0.45);
      focus.x = MathUtils.lerp(outLookAt.x, target.x, focusToTargetBlend);
      focus.z = MathUtils.lerp(outLookAt.z, target.z, focusToTargetBlend);

      return {
        position: outPosition,
        lookAt: outLookAt,
        viewFocus: focus,
      };
    },
  };
}
