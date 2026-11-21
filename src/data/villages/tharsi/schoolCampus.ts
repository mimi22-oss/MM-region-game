import { angle, toWorld } from '../../wards/myothar/area5.ts';

export interface TharSiRestPavilion {
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

/**
 * သာစည်ကျောင်း (Thar Si Basic Education School) — Authored Campus Geometry
 *
 * Placed right around the user's requested Ward 6 spot (Local U/V: -268.683, 868.643)
 * by expanding Ward 6's 48 residential houses cleanly westward by 104m (ZERO houses removed!).
 *
 * Campus bounds in Thar Si local U/V:
 * - East border: u = -225 (clear of cross-lane u = -218)
 * - West border: u = -317 (clear of cross-lane u = -322)
 * - North gate : v = 829  (facing Thar Si Main Road v = 824!)
 * - South edge : v = 931  (clear of southern lane v = 936)
 */
export const THARSI_SCHOOL_COMPOUND = {
  id: 'tharsi-school-compound',
  name: 'သာစည် အခြေခံပညာကျောင်း',
  u: -271,
  v: 880,
  ...toWorld(-271, 880),
  width: 92,
  depth: 102,
  rotation: angle,
  gateSide: 'north' as const,
  walkway: {
    localX: 0,
    localZ: -28,
    width: 6.5,
    depth: 42,
  },
  flagpole: {
    u: -271,
    v: 870,
    ...toWorld(-271, 870),
    plinthSize: 3.2,
    rotation: angle,
  },
  assemblyPlaza: {
    u: -271,
    v: 874,
    ...toWorld(-271, 874),
    width: 28,
    depth: 24,
    rotation: angle,
  },
  entranceGate: {
    u: -271,
    v: 830,
    ...toWorld(-271, 830),
    gateWidth: 10,
    rotation: angle,
  },
  hallIds: [
    'tharsi-school-main-hall',
    'tharsi-school-west-hall',
    'tharsi-school-east-hall',
  ] as const,
  restPavilions: [
    {
      id: 'tharsi-school-rest-west',
      name: 'သာစည်ကျောင်း · အနောက် နားနေဆောင်',
      u: -290,
      v: 842,
      ...toWorld(-290, 842),
      width: 10,
      depth: 6.5,
      rotation: angle,
    },
    {
      id: 'tharsi-school-rest-east',
      name: 'သာစည်ကျောင်း · အရှေ့ နားနေဆောင်',
      u: -252,
      v: 842,
      ...toWorld(-252, 842),
      width: 10,
      depth: 6.5,
      rotation: angle,
    },
    {
      id: 'tharsi-school-rest-south',
      name: 'သာစည်ကျောင်း · တောင်ဘက် နားနေဆောင်',
      u: -271,
      v: 922,
      ...toWorld(-271, 922),
      width: 11,
      depth: 6.0,
      rotation: angle,
    },
  ] as readonly TharSiRestPavilion[],
} as const;

const CAMPUS_COS = Math.cos(angle);
const CAMPUS_SIN = Math.sin(angle);

// Solid obstacles inside Thar Si School courtyard (flagpole 3-tier plinth + north gate archway pillars).
// All resting pavilions, walkways, assembly plaza, and classroom doorways stay 100% walkable!
const CAMPUS_SOLID_BOXES: readonly {
  readonly minU: number;
  readonly maxU: number;
  readonly minV: number;
  readonly maxV: number;
}[] = [
  // Flagpole stepped red/white concrete podium at (-271, 870), 3.2m x 3.2m
  { minU: -272.6, maxU: -269.4, minV: 868.4, maxV: 871.6 },
  // North entrance gate masonry pillars flanking the 10m wide open gate on Thar Si Main Road
  { minU: -276.8, maxU: -275.4, minV: 829.3, maxV: 830.7 },
  { minU: -266.6, maxU: -265.2, minV: 829.3, maxV: 830.7 },
];

export function canStandTharSiSchoolCampus(
  x: number,
  z: number,
  playerRadius = 0.4,
): boolean {
  const dx = x - THARSI_SCHOOL_COMPOUND.x;
  const dz = z - THARSI_SCHOOL_COMPOUND.z;
  if (dx * dx + dz * dz > 72 * 72) return true;

  const u = x * CAMPUS_COS - z * CAMPUS_SIN;
  const v = x * CAMPUS_SIN + z * CAMPUS_COS;
  for (let i = 0; i < CAMPUS_SOLID_BOXES.length; i++) {
    const b = CAMPUS_SOLID_BOXES[i];
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
