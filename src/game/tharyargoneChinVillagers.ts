import { angle, toWorld } from '../data/ward.ts';
import {
  tharYarGoneCrossLanes,
  tharYarGoneLanes,
} from '../data/villages/tharyargone/index.ts';
import type {
  WeipulaVillagerDescriptor,
  WeipulaVillagerKind,
  WeipulaVillagerRuntime,
} from './weipulaVillagers.ts';

/**
 * သာယာကုန်းကျေးရွာ ချင်းလူမျိုးစု ရွာသူရွာသားများ
 * (Thar Yar Gone Village — Chin Ethnic Residents)
 *
 * Strictly reuses `getWeipulaVillagerCache()` & `WeipulaVillagerRig` (Singleton GPU cache,
 * zero duplicate geometries/textures/materials!) while keeping every villager walking
 * cleanly along Tharyargone's real village lanes, St. Assumption Church plaza,
 * Kingdom Hall plaza, and Chin house front gates.
 */

export const THARYARGONE_VILLAGE_CENTER = toWorld(-133, 2700);

function deterministicFrac(seed: number): number {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

const CHIN_ROLES: readonly WeipulaVillagerKind[] = [
  'chin-woman',
  'chin-man',
  'chin-elder',
  'chin-woman',
  'chin-kid',
  'chin-man',
];

function labelForChinKind(kind: WeipulaVillagerKind): string {
  switch (kind) {
    case 'chin-woman':
      return 'သာယာကုန်း ချင်းရိုးရာ အမျိုးသမီး';
    case 'chin-man':
      return 'သာယာကုန်း ချင်းရိုးရာ အမျိုးသား';
    case 'chin-elder':
      return 'သာယာကုန်း ချင်းရွာလူကြီး';
    case 'chin-kid':
      return 'သာယာကုန်း ချင်းကလေးငယ်';
    default:
      return 'သာယာကုန်း ချင်းရွာသား';
  }
}

/**
 * Generates a rich, lively deterministic roster of 60 Chin ethnic villagers across
 * Tharyargone Village:
 *  - 28 walking along the Main Village Avenue (v = 2700) & East-West village lanes
 *  - 18 walking along the North-South cross lanes between Chin Hornbill compounds
 *  - 14 gathering & greeting around St. Assumption Catholic Church plaza & Kingdom Hall yard
 */
export function createTharyargoneChinRoster(): WeipulaVillagerDescriptor[] {
  const roster: WeipulaVillagerDescriptor[] = [];
  let seq = 0;

  const pushVillager = (
    zoneId: string,
    homeU: number,
    homeV: number,
    minU: number,
    maxU: number,
    minV: number,
    maxV: number,
    walkSpeed: number,
  ) => {
    seq++;
    const f1 = deterministicFrac(seq * 1.91 + 13.7);
    const f2 = deterministicFrac(seq * 3.17 + 7.3);
    const kind = CHIN_ROLES[(seq - 1) % CHIN_ROLES.length];
    const scale =
      kind === 'chin-kid'
        ? 0.72 + f2 * 0.1
        : kind === 'chin-woman'
          ? 0.94 + f2 * 0.06
          : 1.0 + f2 * 0.07;

    roster.push({
      id: `tharyargone-chin-${seq}`,
      houseId: zoneId,
      houseTitle: 'သာယာကုန်းကျေးရွာ',
      tierIndex: 0,
      kind,
      label: labelForChinKind(kind),
      zone: 'street',
      outfitIndex: (seq - 1) % 6,
      skinIndex: seq % 3,
      scale,
      homeU,
      homeV,
      minU,
      maxU,
      minV,
      maxV,
      yOffset: 0.04,
      walkSpeed,
      idleYawOffset: f1 * Math.PI * 2,
      phaseOffset: f2 * Math.PI * 2,
    });
  };

  // 1. Main Avenue (v = 2700, wide 7m road right north of St. Assumption Church) — 10 Chin villagers
  for (let i = 0; i < 10; i++) {
    const segU = -246 + i * 24;
    const laneOffset = i % 2 === 0 ? -1.4 : 1.4;
    pushVillager(
      'tyg-main-avenue',
      segU,
      2700 + laneOffset,
      Math.max(-254, segU - 26),
      Math.min(-18, segU + 26),
      2700 - 2.0,
      2700 + 2.0,
      0.72 + deterministicFrac(i * 4.3) * 0.35,
    );
  }

  // 2. East-West Village Lanes between Chin Hornbill compound rows — 18 Chin villagers (2 per lane)
  const ewLanes = tharYarGoneLanes.filter(v => v !== 2700 && v >= 2572 && v <= 2828);
  for (let li = 0; li < ewLanes.length; li++) {
    const laneV = ewLanes[li];
    for (let k = 0; k < 2; k++) {
      const startU = k === 0 ? -195 + (li % 3) * 18 : -88 + (li % 3) * 14;
      pushVillager(
        `tyg-ew-lane-${laneV}`,
        startU,
        laneV + (k === 0 ? -0.7 : 0.7),
        Math.max(-250, startU - 30),
        Math.min(-16, startU + 30),
        laneV - 1.1,
        laneV + 1.1,
        0.65 + deterministicFrac((li * 7 + k) * 2.1) * 0.34,
      );
    }
  }

  // 3. North-South Cross Lanes (u = -40, -84, -128, -172, -216, -260) — 18 Chin villagers (3 per lane)
  for (let ci = 0; ci < tharYarGoneCrossLanes.length; ci++) {
    const laneU = tharYarGoneCrossLanes[ci];
    for (let k = 0; k < 3; k++) {
      const startV = 2595 + k * 92 + (ci % 2) * 14;
      pushVillager(
        `tyg-ns-lane-${Math.abs(laneU)}`,
        laneU + (k % 2 === 0 ? -0.8 : 0.8),
        startV,
        laneU - 1.15,
        laneU + 1.15,
        Math.max(2555, startV - 34),
        Math.min(2850, startV + 34),
        0.68 + deterministicFrac((ci * 5 + k) * 3.1) * 0.32,
      );
    }
  }

  // 4. St. Assumption Catholic Church Plaza (u = -134..-160, v = 2705..2726 — clear of sanctuary & bell tower)
  const churchSpots: [number, number, number, number, number, number][] = [
    [-136, 2707, -141, -132, 2704, 2714],
    [-135, 2718, -140, -132, 2713, 2726],
    [-158, 2708, -162, -154, 2704, 2716],
    [-158, 2720, -162, -154, 2715, 2726],
    [-138, 2703, -156, -134, 2701, 2704],
    [-151, 2703, -158, -136, 2701, 2704],
    [-134, 2713, -139, -132, 2706, 2724],
    [-160, 2714, -162, -155, 2706, 2724],
    [-147, 2702, -155, -139, 2700.5, 2703.5],
    [-133, 2722, -138, -132, 2718, 2726],
  ];
  for (let i = 0; i < churchSpots.length; i++) {
    const [hu, hv, minU, maxU, minV, maxV] = churchSpots[i];
    pushVillager(
      'tyg-church-plaza',
      hu,
      hv,
      minU,
      maxU,
      minV,
      maxV,
      0.48 + deterministicFrac(i * 5.7) * 0.25,
    );
  }

  // 5. Kingdom Hall Courtyard perimeter (u = -225..-245, v = 2706..2724 — clear of hall footprint)
  const hallSpots: [number, number, number, number, number, number][] = [
    [-226, 2710, -227, -224, 2706, 2722],
    [-226, 2720, -227, -224, 2710, 2724],
    [-235, 2707, -244, -226, 2706, 2708.5],
    [-244, 2716, -245.5, -243, 2708, 2724],
  ];
  for (let i = 0; i < hallSpots.length; i++) {
    const [hu, hv, minU, maxU, minV, maxV] = hallSpots[i];
    pushVillager(
      'tyg-kingdom-hall-yard',
      hu,
      hv,
      minU,
      maxU,
      minV,
      maxV,
      0.46 + deterministicFrac(i * 6.3) * 0.22,
    );
  }

  return roster;
}

export function createTharyargoneChinRuntime(
  desc: WeipulaVillagerDescriptor,
): WeipulaVillagerRuntime {
  const pos = toWorld(desc.homeU, desc.homeV);
  return {
    desc,
    u: desc.homeU,
    v: desc.homeV,
    targetU: desc.homeU,
    targetV: desc.homeV,
    x: pos.x,
    z: pos.z,
    yaw: angle + desc.idleYawOffset,
    speed: 0,
    walkDist: 0,
    pauseTimer: 0.4 + deterministicFrac(desc.phaseOffset * 13.1) * 1.8,
    elapsed: desc.phaseOffset,
    seed: desc.phaseOffset * 100 + 37,
  };
}

export function stepTharyargoneChinVillager(rt: WeipulaVillagerRuntime, dt: number): void {
  const clampedDt = Math.min(0.1, Math.max(0, dt));
  rt.elapsed += clampedDt;
  const d = rt.desc;

  if (rt.pauseTimer > 0) {
    rt.pauseTimer -= clampedDt;
    rt.speed = 0;
    if (rt.pauseTimer <= 0) {
      rt.seed += 1.618;
      const fu = deterministicFrac(rt.seed * 19.3 + d.phaseOffset);
      const fv = deterministicFrac(rt.seed * 31.7 + d.phaseOffset * 2.1);
      rt.targetU = d.minU + fu * Math.max(0.2, d.maxU - d.minU);
      rt.targetV = d.minV + fv * Math.max(0.2, d.maxV - d.minV);
    }
    return;
  }

  const du = rt.targetU - rt.u;
  const dv = rt.targetV - rt.v;
  const dist = Math.hypot(du, dv);
  if (dist < 0.35) {
    rt.speed = 0;
    rt.seed += 1.13;
    rt.pauseTimer = 1.4 + deterministicFrac(rt.seed * 11.7) * 2.6;
    return;
  }

  const step = Math.min(dist, d.walkSpeed * clampedDt);
  rt.u += (du / dist) * step;
  rt.v += (dv / dist) * step;
  rt.u = Math.max(d.minU, Math.min(d.maxU, rt.u));
  rt.v = Math.max(d.minV, Math.min(d.maxV, rt.v));

  const world = toWorld(rt.u, rt.v);
  rt.x = world.x;
  rt.z = world.z;
  rt.yaw = angle + Math.atan2(du, dv);
  rt.speed = d.walkSpeed;
  rt.walkDist += step;
}
