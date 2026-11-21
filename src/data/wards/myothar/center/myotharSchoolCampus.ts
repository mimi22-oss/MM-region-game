import { angle, toWorld } from '../area5.ts';
import type { MyotharCenterBuildingData } from './myotharCenterBuildings.ts';
import type { MyotharCenterRoad } from './myotharCenterRoads.ts';

export interface SchoolCampusRestPavilion {
  readonly id: string;
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
}

export interface SchoolCampusCompoundSpec {
  readonly id: string;
  readonly name: string;
  readonly u: number;
  readonly v: number;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly rotation: number;
  readonly gateSide: 'north' | 'south' | 'east' | 'west';
  readonly walkway: {
    readonly localX: number;
    readonly localZ: number;
    readonly width: number;
    readonly depth: number;
  };
  readonly flagpole: {
    readonly u: number;
    readonly v: number;
    readonly x: number;
    readonly z: number;
    readonly plinthSize: number;
    readonly rotation: number;
  };
  readonly assemblyPlaza: {
    readonly u: number;
    readonly v: number;
    readonly x: number;
    readonly z: number;
    readonly width: number;
    readonly depth: number;
    readonly rotation: number;
  };
  readonly entranceGate: {
    readonly u: number;
    readonly v: number;
    readonly x: number;
    readonly z: number;
    readonly gateWidth: number;
    readonly rotation: number;
  };
  readonly hallIds: readonly string[];
  readonly restPavilions: readonly SchoolCampusRestPavilion[];
}

/**
 * Authored road-extension target connecting `way/239609161` (`မြို့သာ ရပ်ကွက်လယ်လမ်း (1)`,
 * originally ending at u=-58.73, v=-928.39) straight west into the Myothar School East Gate
 * (`u = -103.247, v = -926.546`).
 */
export const MYOTHAR_SCHOOL_CONNECTING_ROAD_ID = 'way/239609161';
export const MYOTHAR_SCHOOL_GATE_UV = { u: -103.247, v: -926.546 } as const;
export const MYOTHAR_SCHOOL_ROAD_JOIN_UV = { u: -58.455, v: -928.088 } as const;

/**
 * Authored house relocations clearing the Myothar School East access road corridor
 * (`u = -103..-58, v ≈ -927.3`) WITHOUT deleting any homes (separate from generated OSM source).
 */
export const MYOTHAR_SCHOOL_HOUSE_RELOCATIONS: Readonly<
  Record<string, { readonly u: number; readonly v: number }>
> = {
  // Originally at u=-79.6, v=-923.8 (directly on the school access road) -> relocated south to open plot
  'way/403019921': { u: -82.0, v: -911.0 },
  // Originally at u=-95.0, v=-935.0 (tight against north road shoulder) -> nudged 3m north clear of shoulder
  'way/403019913': { u: -95.0, v: -938.0 },
};

/** Applies authored house relocations cleanly without mutating generated OSM source arrays. */
export function applyMyotharCenterBuildingOverrides(
  buildings: readonly MyotharCenterBuildingData[],
): MyotharCenterBuildingData[] {
  return buildings.map(b => {
    const move = MYOTHAR_SCHOOL_HOUSE_RELOCATIONS[b.id];
    if (!move) return b;
    const nextWorld = toWorld(move.u, move.v);
    const dx = nextWorld.x - b.x;
    const dz = nextWorld.z - b.z;
    return {
      ...b,
      u: move.u,
      v: move.v,
      x: Number(nextWorld.x.toFixed(2)),
      z: Number(nextWorld.z.toFixed(2)),
      polygonPoints: b.polygonPoints.map(
        ([px, pz]) => [Number((px + dx).toFixed(2)), Number((pz + dz).toFixed(2))] as [number, number],
      ),
    };
  });
}

/** Extends `way/239609161` straight into the Myothar School East entrance gate (`u = -103.247, v = -926.546`). */
export function applyMyotharCenterRoadOverrides(
  roads: readonly MyotharCenterRoad[],
): MyotharCenterRoad[] {
  const gateW = toWorld(MYOTHAR_SCHOOL_GATE_UV.u, MYOTHAR_SCHOOL_GATE_UV.v);
  const gatePt: [number, number] = [Number(gateW.x.toFixed(2)), Number(gateW.z.toFixed(2))];
  return roads.map(r => {
    if (r.id !== MYOTHAR_SCHOOL_CONNECTING_ROAD_ID) return r;
    const last = r.worldPoints[r.worldPoints.length - 1];
    if (last && Math.hypot(last[0] - gatePt[0], last[1] - gatePt[1]) < 1.0) return r;
    return {
      ...r,
      worldPoints: [...r.worldPoints, gatePt],
    };
  });
}

/**
 * မြို့သာ အခြေခံပညာကျောင်း (Myothar Basic Education School) — Authored East-Facing Campus Geometry
 *
 * - East Entrance Gate & Signboard at exact user location (`u = -103.247, v = -926.546`), facing East
 *   directly into extended `way/239609161` (`u = -58.455, v = -928.088`).
 * - Main 2-Storey Classroom Hall on West side facing East across the Flagpole Assembly Plaza.
 * - North & South Classroom Wings framing the quadrangle + 2 Shaded Resting Pavilions flanking the East walkway.
 */
export const MYOTHAR_SCHOOL_COMPOUND: SchoolCampusCompoundSpec = {
  id: 'myothar-school-compound',
  name: 'မြို့သာ အခြေခံပညာကျောင်း',
  u: -134,
  v: -924,
  ...toWorld(-134, -924),
  width: 62,
  depth: 60,
  rotation: angle,
  gateSide: 'east',
  walkway: {
    localX: 16,
    localZ: -2.5,
    width: 30,
    depth: 5.8,
  },
  flagpole: {
    u: -134,
    v: -926.5,
    ...toWorld(-134, -926.5),
    plinthSize: 3.2,
    rotation: angle + Math.PI / 2,
  },
  assemblyPlaza: {
    u: -132,
    v: -926.5,
    ...toWorld(-132, -926.5),
    width: 20,
    depth: 20,
    rotation: angle,
  },
  entranceGate: {
    u: MYOTHAR_SCHOOL_GATE_UV.u,
    v: MYOTHAR_SCHOOL_GATE_UV.v,
    ...toWorld(MYOTHAR_SCHOOL_GATE_UV.u, MYOTHAR_SCHOOL_GATE_UV.v),
    gateWidth: 9.5,
    rotation: angle + Math.PI / 2,
  },
  hallIds: [
    'myothar-school-main-hall',
    'myothar-school-west-hall',
    'myothar-school-east-hall',
  ],
  restPavilions: [
    {
      id: 'myothar-school-rest-west',
      name: 'မြို့သာကျောင်း · မြောက်ဘက် နားနေဆောင်',
      u: -111,
      v: -939,
      ...toWorld(-111, -939),
      width: 6.0,
      depth: 8.5,
      rotation: angle,
    },
    {
      id: 'myothar-school-rest-east',
      name: 'မြို့သာကျောင်း · တောင်ဘက် နားနေဆောင်',
      u: -111,
      v: -913,
      ...toWorld(-111, -913),
      width: 6.0,
      depth: 8.5,
      rotation: angle,
    },
  ],
};

const CAMPUS_COS = Math.cos(angle);
const CAMPUS_SIN = Math.sin(angle);

const MYOTHAR_SCHOOL_SOLID_BOXES: readonly {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
}[] = [
  // Flagpole 3-tier concrete podium at (-134, -926.5), 3.2m x 3.2m
  { minU: -135.6, maxU: -132.4, minV: -928.1, maxV: -924.9 },
  // East entrance gate masonry pillars at u=-103.25 flanking the 9.5m open gate (v=-926.55 ± 4.85)
  { minU: -103.95, maxU: -102.55, minV: -932.1, maxV: -930.7 },
  { minU: -103.95, maxU: -102.55, minV: -922.4, maxV: -921.0 },
];

export function canStandMyotharSchoolCampus(
  x: number,
  z: number,
  playerRadius = 0.4,
): boolean {
  const dx = x - MYOTHAR_SCHOOL_COMPOUND.x;
  const dz = z - MYOTHAR_SCHOOL_COMPOUND.z;
  if (dx * dx + dz * dz > 58 * 58) return true;

  const u = x * CAMPUS_COS - z * CAMPUS_SIN;
  const v = x * CAMPUS_SIN + z * CAMPUS_COS;
  for (let i = 0; i < MYOTHAR_SCHOOL_SOLID_BOXES.length; i++) {
    const b = MYOTHAR_SCHOOL_SOLID_BOXES[i];
    const nu = Math.max(b.minU, Math.min(u, b.maxU));
    const nv = Math.max(b.minV, Math.min(v, b.maxV));
    const du = u - nu;
    const dv = v - nv;
    if (du * du + dv * dv < playerRadius * playerRadius) {
      return false;
    }
  }
  return true;
}
