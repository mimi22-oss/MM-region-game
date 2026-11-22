import { cemeteryToWorld, CEMETERY_PATROL_ROW_Z, MYOTHAR_CEMETERY_LAYOUT } from '../game/cemeteryLayout.ts';
import { area5, angle as AREA5_ANGLE, toWorld } from './wards/myothar/area5.ts';
import {
  shweMyanmarFuelStation,
  shweMyanmarResidential,
  shweMyanmarRiceMill,
  shweMyanmarVacantLot,
} from './wards/myothar/shweMyanmarArea.ts';
import { canStand, treeBlocks } from '../game/collision.ts';
import { warehouseZoneDistance } from '../game/audio/warehouseSoundOrigins.ts';
import {
  DEFAULT_GHOST_COUNT,
  GHOST_MIN_ZONE_SEPARATION_M,
  GHOST_WAREHOUSE_ANCHOR,
} from '../game/ghostConfig.ts';
import { sourceIsEdited } from '../game/worldEdits.ts';

export const GHOST_WAYPOINTS_STORAGE_KEY = 'mm-ghost-warehouse-waypoints-v1';

export type GhostWaypointRole = 'hiding' | 'patrol' | 'road-curb' | 'dark-corner';

export interface GhostWaypoint {
  readonly id: string;
  readonly role: GhostWaypointRole;
  readonly x: number;
  readonly z: number;
  readonly localU: number;
  readonly localV: number;
  readonly links: readonly string[];
  readonly preferredClip?: 'depressed' | 'dig';
  readonly side?: -1 | 0 | 1;
}

export interface GhostRoadCrossingPair {
  readonly id: string;
  readonly roadId: string;
  readonly westCurbId: string;
  readonly eastCurbId: string;
  readonly midX: number;
  readonly midZ: number;
  readonly roadHalfWidth: number;
}

export interface GhostObstacleBox {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly halfW: number;
  readonly halfD: number;
  readonly rotation: number;
  readonly blocksSight: boolean;
}

export interface GhostTreeCollider {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly radius: number;
}

export interface GhostWarehouseEnvironment {
  readonly zoneId?: GhostHauntZoneId;
  readonly zoneName?: string;
  readonly regionId?: string;
  readonly anchor: { x: number; z: number; localU: number; localV: number };
  readonly waypoints: readonly GhostWaypoint[];
  readonly waypointById: ReadonlyMap<string, GhostWaypoint>;
  readonly hidingIds: readonly string[];
  readonly patrolIds: readonly string[];
  readonly roadCrossings: readonly GhostRoadCrossingPair[];
  readonly obstacleBoxes: readonly GhostObstacleBox[];
  readonly treeColliders: readonly GhostTreeCollider[];
  readonly measureDistanceFromZone?: (x: number, z: number) => number;
}

export type GhostHauntZoneId =
  | 'warehouse-row'
  | 'old-west-lanes'
  | 'monastery-pitch-edge'
  | 'west-residential-lanes'
  | 'east-pitch-residential'
  | 'rice-mill-south'
  | 'shwe-myanmar-north'
  | 'myothar-cemetery';

export const GHOST_HAUNT_ZONE_IDS: readonly GhostHauntZoneId[] = [
  'warehouse-row',
  'old-west-lanes',
  'monastery-pitch-edge',
  'west-residential-lanes',
  'east-pitch-residential',
  'rice-mill-south',
  'shwe-myanmar-north',
  'myothar-cemetery',
];

export interface GhostHauntZoneInfo {
  readonly zoneId: GhostHauntZoneId;
  readonly zoneName: string;
  readonly regionId: string;
  readonly anchor: { x: number; z: number; localU: number; localV: number };
  readonly waypointCount: number;
  readonly hidingCount: number;
  readonly patrolCount: number;
}

export interface GhostWaypointOverridePayload {
  waypoints?: GhostWaypoint[];
  roadCrossings?: GhostRoadCrossingPair[];
}

const COS_A = Math.cos(AREA5_ANGLE);
const SIN_A = Math.sin(AREA5_ANGLE);

export function worldToWarehouseLocal(x: number, z: number): { u: number; v: number } {
  return {
    u: x * COS_A - z * SIN_A,
    v: x * SIN_A + z * COS_A,
  };
}

export function warehouseLocalToWorld(u: number, v: number): { x: number; z: number } {
  return toWorld(u, v);
}

/** Checks both `canStand` and four 0.52m perimeter samples (~0.92m combined capsule clearance for the 3.6m ghost). */
export function isGhostPointWalkable(x: number, z: number): boolean {
  const r = 0.52;
  if (!canStand(x, z, 0, false) || treeBlocks(x, z)) return false;
  return (
    canStand(x + r, z, 0, false) &&
    canStand(x - r, z, 0, false) &&
    canStand(x, z + r, 0, false) &&
    canStand(x, z - r, 0, false) &&
    !treeBlocks(x + r, z) &&
    !treeBlocks(x - r, z) &&
    !treeBlocks(x, z + r) &&
    !treeBlocks(x, z - r)
  );
}

export function isGhostSegmentWalkable(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  stepM = 0.75,
): boolean {
  const dist = Math.hypot(bx - ax, bz - az);
  const steps = Math.max(1, Math.ceil(dist / stepM));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    if (!isGhostPointWalkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
  }
  return true;
}

interface DraftNode {
  id: string;
  role: GhostWaypointRole;
  localU: number;
  localV: number;
  x?: number;
  z?: number;
  links: string[];
  preferredClip?: 'depressed' | 'dig';
  side?: -1 | 0 | 1;
}

interface CrossingCandidateSpec {
  id: string;
  roadId: string;
  westCurbId: string;
  eastCurbId: string;
  roadHalfWidth: number;
}

const SHWE_MYANMAR_OBSTACLE_BUILDINGS = [
  shweMyanmarFuelStation.office,
  shweMyanmarRiceMill.mainBuilding,
  shweMyanmarRiceMill.storageBuilding,
  shweMyanmarRiceMill.gateOffice,
  shweMyanmarVacantLot.shed,
  shweMyanmarResidential.store,
  ...shweMyanmarResidential.houses,
];

function collectAreaObstaclesAndTrees(
  anchorX: number,
  anchorZ: number,
  extraObstacles: readonly GhostObstacleBox[] = [],
): { obstacleBoxes: GhostObstacleBox[]; treeColliders: GhostTreeCollider[] } {
  const maxDist = 135;
  const obstacleBoxes: GhostObstacleBox[] = [...extraObstacles];

  const pushRect = (
    id: string,
    x: number,
    z: number,
    width: number,
    depth: number,
    rotation: number,
    pad: number,
  ) => {
    if (Math.hypot(x - anchorX, z - anchorZ) > maxDist) return;
    obstacleBoxes.push({
      id,
      x,
      z,
      halfW: width * 0.5 + pad,
      halfD: depth * 0.5 + pad,
      rotation,
      blocksSight: true,
    });
  };

  for (const w of area5.warehouses) {
    if (!sourceIsEdited(w.id)) pushRect(w.id, w.x, w.z, w.width, w.depth, w.rotation, 0.55);
  }
  for (const h of area5.houses) {
    if (!sourceIsEdited(h.id)) pushRect(h.id, h.x, h.z, h.width, h.depth, h.rotation, 0.45);
  }
  for (const b of area5.riceMill.buildings) {
    pushRect(b.id, b.x, b.z, b.width, b.depth, area5.pitch.rotation, 0.55);
  }
  for (const s of SHWE_MYANMAR_OBSTACLE_BUILDINGS) {
    pushRect(s.id, s.x, s.z, s.width, s.depth, s.rotation, 0.45);
  }

  const treeCandidates: { id: string; x: number; z: number; radius?: number }[] = [
    ...area5.trees,
    ...area5.largeTrees,
    ...area5.farmTrees,
    ...shweMyanmarResidential.trees.map((t, i) => ({
      id: `shwe-myanmar-tree-${i}`,
      x: t.x,
      z: t.z,
      radius: t.radius,
    })),
  ];

  const treeColliders: GhostTreeCollider[] = treeCandidates
    .filter((t) => !sourceIsEdited(t.id))
    .filter((t) => Math.hypot(t.x - anchorX, t.z - anchorZ) <= maxDist)
    .map((t) => ({
      id: t.id,
      x: t.x,
      z: t.z,
      radius: t.radius ?? 0.55,
    }));

  return { obstacleBoxes, treeColliders };
}

function finalizeEnvironmentFromDrafts(opts: {
  zoneId: GhostHauntZoneId;
  zoneName: string;
  regionId: string;
  anchor: { x: number; z: number; localU: number; localV: number };
  drafts: readonly DraftNode[];
  crossingCandidates: readonly CrossingCandidateSpec[];
  extraObstacles?: readonly GhostObstacleBox[];
}): GhostWarehouseEnvironment {
  const worldNodes: GhostWaypoint[] = [];
  for (const d of opts.drafts) {
    const worldPt =
      typeof d.x === 'number' && typeof d.z === 'number'
        ? { x: d.x, z: d.z }
        : warehouseLocalToWorld(d.localU, d.localV);
    if (!isGhostPointWalkable(worldPt.x, worldPt.z)) continue;
    const uv =
      typeof d.x === 'number' && typeof d.z === 'number'
        ? worldToWarehouseLocal(worldPt.x, worldPt.z)
        : { u: d.localU, v: d.localV };
    worldNodes.push({
      id: d.id,
      role: d.role,
      x: Number(worldPt.x.toFixed(3)),
      z: Number(worldPt.z.toFixed(3)),
      localU: Number(uv.u.toFixed(3)),
      localV: Number(uv.v.toFixed(3)),
      links: d.links,
      preferredClip: d.preferredClip,
      side: d.side,
    });
  }

  const rawMap = new Map(worldNodes.map((n) => [n.id, n]));
  const waypoints: GhostWaypoint[] = worldNodes.map((node) => ({
    ...node,
    links: node.links.filter((targetId) => {
      const dst = rawMap.get(targetId);
      if (!dst) return false;
      return isGhostSegmentWalkable(node.x, node.z, dst.x, dst.z);
    }),
  }));

  const waypointById = new Map(waypoints.map((w) => [w.id, w]));

  const roadCrossings: GhostRoadCrossingPair[] = [];
  for (const pair of opts.crossingCandidates) {
    const west = waypointById.get(pair.westCurbId);
    const east = waypointById.get(pair.eastCurbId);
    if (!west || !east) continue;
    if (!west.links.includes(east.id) || !east.links.includes(west.id)) continue;
    roadCrossings.push({
      id: pair.id,
      roadId: pair.roadId,
      westCurbId: west.id,
      eastCurbId: east.id,
      midX: Number(((west.x + east.x) * 0.5).toFixed(3)),
      midZ: Number(((west.z + east.z) * 0.5).toFixed(3)),
      roadHalfWidth: pair.roadHalfWidth,
    });
  }

  const { obstacleBoxes, treeColliders } = collectAreaObstaclesAndTrees(
    opts.anchor.x,
    opts.anchor.z,
    opts.extraObstacles,
  );

  const hidingIds = waypoints
    .filter((w) => w.role === 'hiding' || w.role === 'dark-corner')
    .map((w) => w.id);
  const patrolIds = waypoints
    .filter((w) => w.role === 'patrol' || w.role === 'hiding')
    .map((w) => w.id);

  return {
    zoneId: opts.zoneId,
    zoneName: opts.zoneName,
    regionId: opts.regionId,
    anchor: opts.anchor,
    waypoints,
    waypointById,
    hidingIds,
    patrolIds,
    roadCrossings,
    obstacleBoxes,
    treeColliders,
  };
}

/**
 * Computes actual warehouse buildings, main AH1 corridor, and roadside trees from `area5`
 * (without hardcoded arbitrary world coordinates) to produce collision-clear ghost waypoints.
 */
export function buildDefaultWarehouseEnvironment(): GhostWarehouseEnvironment {
  const activeWarehouses = area5.warehouses.filter((w) => !sourceIsEdited(w.id));
  const ah1 = area5.roads.find((r) => r.id === 'ah1');
  const ah1Local = ah1 ? worldToWarehouseLocal(ah1.x, ah1.z) : { u: 0, v: 0 };
  const roadCenterU = ah1Local.u;
  const roadHalfWidth = (ah1?.width ?? 12) / 2;

  // Derive tree gap midpoints along the roadside rows (-14 / +14) inside [-60, 95] V bounds.
  const westTreeVs = area5.trees
    .filter((t) => !sourceIsEdited(t.id))
    .map((t) => ({ ...t, uv: worldToWarehouseLocal(t.x, t.z) }))
    .filter((t) => t.uv.u < roadCenterU && t.uv.v >= -65 && t.uv.v <= 105)
    .map((t) => t.uv.v)
    .sort((a, b) => a - b);

  function nearestTreeGapV(targetV: number): number {
    let bestV = targetV;
    let bestScore = Infinity;
    for (let i = 1; i < westTreeVs.length; i++) {
      const gap = westTreeVs[i] - westTreeVs[i - 1];
      if (gap < 4.5) continue;
      const mid = (westTreeVs[i - 1] + westTreeVs[i]) * 0.5;
      const d = Math.abs(mid - targetV);
      if (d < bestScore) {
        bestScore = d;
        bestV = mid;
      }
    }
    return bestV;
  }

  // Derive alley center Vs between adjacent warehouses on the west side.
  const westVs = activeWarehouses
    .map((w) => ({ w, uv: worldToWarehouseLocal(w.x, w.z) }))
    .filter((item) => item.uv.u < roadCenterU)
    .sort((a, b) => a.uv.v - b.uv.v);

  const alleyVs: number[] = [];
  for (let i = 1; i < westVs.length; i++) {
    const gapCenter = (westVs[i - 1].uv.v + westVs[i].uv.v) * 0.5;
    if (gapCenter >= -60 && gapCenter <= 85) alleyVs.push(gapCenter);
  }
  const vNorthAlley = alleyVs[0] ?? -50;
  const vSouthAlley = alleyVs[1] ?? 0;
  const vMainAlley = alleyVs[2] ?? 50;

  // Align road crossings cleanly to tree gaps nearest the anchor V (50.434) and flanking corridors.
  const anchorGapV = nearestTreeGapV(GHOST_WAREHOUSE_ANCHOR.localV);
  const midGapV = nearestTreeGapV(14.5);
  const northGapV = nearestTreeGapV(-46.5);

  const curbOffsetU = roadHalfWidth + 1.6;
  const vergeOffsetU = 18.2; // Safely between tree row (u=±14) and warehouse wall (u=±23.5)
  const alleyDeepU = 33.0;
  const rearShadowU = -48.0; // Between rear warehouse wall (-44.5) and canal (-52)

  const drafts: DraftNode[] = [
    // West dark alleys & rear hiding spots
    { id: 'hide-west-main-alley', role: 'hiding', localU: -alleyDeepU, localV: vMainAlley, links: ['patrol-west-main-mouth', 'hide-west-rear-main'], preferredClip: 'dig', side: -1 },
    { id: 'hide-west-rear-main', role: 'dark-corner', localU: rearShadowU, localV: vMainAlley, links: ['hide-west-main-alley', 'hide-west-rear-south'], preferredClip: 'depressed', side: -1 },
    { id: 'hide-west-rear-south', role: 'dark-corner', localU: rearShadowU, localV: vSouthAlley, links: ['hide-west-rear-main', 'hide-west-south-alley'], preferredClip: 'dig', side: -1 },
    { id: 'hide-west-south-alley', role: 'hiding', localU: -alleyDeepU, localV: vSouthAlley, links: ['hide-west-rear-south', 'patrol-west-south-mouth'], preferredClip: 'depressed', side: -1 },
    { id: 'hide-west-north-alley', role: 'hiding', localU: -alleyDeepU, localV: vNorthAlley, links: ['patrol-west-north-mouth'], preferredClip: 'dig', side: -1 },

    // West shadowy veranda / tree-row corridor
    { id: 'patrol-west-north-mouth', role: 'patrol', localU: -vergeOffsetU, localV: northGapV, links: ['hide-west-north-alley', 'patrol-west-mid', 'curb-west-north'], side: -1 },
    { id: 'patrol-west-south-mouth', role: 'hiding', localU: -vergeOffsetU, localV: vSouthAlley, links: ['hide-west-south-alley', 'patrol-west-mid', 'patrol-west-north-mouth'], preferredClip: 'depressed', side: -1 },
    { id: 'patrol-west-mid', role: 'patrol', localU: -vergeOffsetU, localV: midGapV, links: ['patrol-west-south-mouth', 'patrol-west-north-mouth', 'patrol-west-main-mouth', 'curb-west-mid'], side: -1 },
    { id: 'patrol-west-main-mouth', role: 'hiding', localU: -vergeOffsetU, localV: anchorGapV, links: ['hide-west-main-alley', 'patrol-west-mid', 'patrol-west-upper', 'curb-west-main'], preferredClip: 'depressed', side: -1 },
    { id: 'patrol-west-upper', role: 'dark-corner', localU: -vergeOffsetU, localV: 84, links: ['patrol-west-main-mouth'], preferredClip: 'dig', side: -1 },

    // East dark alleys & shadowy tree corridor
    { id: 'hide-east-main-alley', role: 'hiding', localU: alleyDeepU, localV: vMainAlley, links: ['patrol-east-main-mouth'], preferredClip: 'dig', side: 1 },
    { id: 'hide-east-south-alley', role: 'hiding', localU: alleyDeepU, localV: vSouthAlley, links: ['patrol-east-south-mouth'], preferredClip: 'depressed', side: 1 },
    { id: 'hide-east-north-alley', role: 'hiding', localU: alleyDeepU, localV: vNorthAlley, links: ['patrol-east-north-mouth'], preferredClip: 'dig', side: 1 },

    { id: 'patrol-east-north-mouth', role: 'patrol', localU: vergeOffsetU, localV: northGapV, links: ['hide-east-north-alley', 'patrol-east-mid', 'curb-east-north'], side: 1 },
    { id: 'patrol-east-south-mouth', role: 'hiding', localU: vergeOffsetU, localV: vSouthAlley, links: ['hide-east-south-alley', 'patrol-east-mid', 'patrol-east-north-mouth'], preferredClip: 'depressed', side: 1 },
    { id: 'patrol-east-mid', role: 'patrol', localU: vergeOffsetU, localV: midGapV, links: ['patrol-east-south-mouth', 'patrol-east-north-mouth', 'patrol-east-main-mouth', 'curb-east-mid'], side: 1 },
    { id: 'patrol-east-main-mouth', role: 'hiding', localU: vergeOffsetU, localV: anchorGapV, links: ['hide-east-main-alley', 'patrol-east-mid', 'patrol-east-upper', 'curb-east-main'], preferredClip: 'depressed', side: 1 },
    { id: 'patrol-east-upper', role: 'dark-corner', localU: vergeOffsetU, localV: 84, links: ['patrol-east-main-mouth'], preferredClip: 'dig', side: 1 },

    // Main AH1 Road curb pairs (connected across road + directly back to adjacent verge mouths)
    { id: 'curb-west-north', role: 'road-curb', localU: roadCenterU - curbOffsetU, localV: northGapV, links: ['patrol-west-north-mouth', 'curb-east-north'], side: -1 },
    { id: 'curb-east-north', role: 'road-curb', localU: roadCenterU + curbOffsetU, localV: northGapV, links: ['patrol-east-north-mouth', 'curb-west-north'], side: 1 },

    { id: 'curb-west-mid', role: 'road-curb', localU: roadCenterU - curbOffsetU, localV: midGapV, links: ['patrol-west-mid', 'curb-east-mid'], side: -1 },
    { id: 'curb-east-mid', role: 'road-curb', localU: roadCenterU + curbOffsetU, localV: midGapV, links: ['patrol-east-mid', 'curb-west-mid'], side: 1 },

    { id: 'curb-west-main', role: 'road-curb', localU: roadCenterU - curbOffsetU, localV: anchorGapV, links: ['patrol-west-main-mouth', 'curb-east-main'], side: -1 },
    { id: 'curb-east-main', role: 'road-curb', localU: roadCenterU + curbOffsetU, localV: anchorGapV, links: ['patrol-east-main-mouth', 'curb-west-main'], side: 1 },
  ];

  const crossingCandidates: CrossingCandidateSpec[] = [
    { id: 'ah1-cross-main', roadId: ah1?.id ?? 'ah1', westCurbId: 'curb-west-main', eastCurbId: 'curb-east-main', roadHalfWidth },
    { id: 'ah1-cross-mid', roadId: ah1?.id ?? 'ah1', westCurbId: 'curb-west-mid', eastCurbId: 'curb-east-mid', roadHalfWidth },
    { id: 'ah1-cross-north', roadId: ah1?.id ?? 'ah1', westCurbId: 'curb-west-north', eastCurbId: 'curb-east-north', roadHalfWidth },
  ];

  const anchor = {
    x: GHOST_WAREHOUSE_ANCHOR.x,
    z: GHOST_WAREHOUSE_ANCHOR.z,
    localU: GHOST_WAREHOUSE_ANCHOR.localU,
    localV: GHOST_WAREHOUSE_ANCHOR.localV,
  };
  const env = finalizeEnvironmentFromDrafts({
    zoneId: 'warehouse-row',
    zoneName: GHOST_WAREHOUSE_ANCHOR.areaName,
    regionId: GHOST_WAREHOUSE_ANCHOR.regionId,
    anchor,
    drafts,
    crossingCandidates,
  });
  return {
    ...env,
    measureDistanceFromZone: (x: number, z: number) =>
      warehouseZoneDistance(x, z, anchor, activeWarehouses),
  };
}

function readStoredWaypointOverrides(): GhostWaypointOverridePayload | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(GHOST_WAYPOINTS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhostWaypointOverridePayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadGhostWarehouseEnvironment(
  overridePayload?: GhostWaypointOverridePayload | null,
): GhostWarehouseEnvironment {
  const base = buildDefaultWarehouseEnvironment();
  const payload = overridePayload ?? readStoredWaypointOverrides();
  if (!payload?.waypoints || !Array.isArray(payload.waypoints) || payload.waypoints.length === 0) {
    return base;
  }
  const byId = new Map(payload.waypoints.map((w) => [w.id, w]));
  return {
    ...base,
    waypoints: payload.waypoints,
    waypointById: byId,
    hidingIds: payload.waypoints
      .filter((w) => w.role === 'hiding' || w.role === 'dark-corner')
      .map((w) => w.id),
    patrolIds: payload.waypoints
      .filter((w) => w.role === 'patrol' || w.role === 'hiding')
      .map((w) => w.id),
    roadCrossings: payload.roadCrossings ?? base.roadCrossings,
  };
}

export function saveGhostWaypointOverrides(payload: GhostWaypointOverridePayload): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(GHOST_WAYPOINTS_STORAGE_KEY, JSON.stringify(payload));
}

export function clearGhostWaypointOverrides(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(GHOST_WAYPOINTS_STORAGE_KEY);
}

/** Breadth-first pathfinder on the ghost warehouse waypoint graph (returns array of node IDs from start to goal). */
export function findWaypointPath(
  env: GhostWarehouseEnvironment,
  startId: string,
  goalId: string,
): string[] {
  if (startId === goalId) return [startId];
  const queue: string[] = [startId];
  const parent = new Map<string, string | null>([[startId, null]]);
  let head = 0;

  while (head < queue.length) {
    const curId = queue[head++];
    if (curId === goalId) break;
    const node = env.waypointById.get(curId);
    if (!node) continue;
    for (const nextId of node.links) {
      if (!parent.has(nextId)) {
        parent.set(nextId, curId);
        queue.push(nextId);
      }
    }
  }

  if (!parent.has(goalId)) return [startId];
  const path: string[] = [];
  let cursor: string | null = goalId;
  while (cursor !== null) {
    path.push(cursor);
    cursor = parent.get(cursor) ?? null;
  }
  path.reverse();
  return path;
}

type NodeSeed = {
  id: string;
  role: GhostWaypointRole;
  u: number;
  v: number;
  preferredClip?: 'depressed' | 'dig';
  side?: -1 | 0 | 1;
};

function makeZoneDrafts(
  nodes: readonly NodeSeed[],
  edges: readonly (readonly [string, string])[],
): DraftNode[] {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const [a, b] of edges) {
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  }
  return nodes.map((n) => ({
    id: n.id,
    role: n.role,
    localU: n.u,
    localV: n.v,
    links: Array.from(adj.get(n.id) ?? []),
    preferredClip: n.preferredClip,
    side: n.side,
  }));
}

function buildWorldNodeZone(
  zoneId: GhostHauntZoneId,
  zoneName: string,
  anchorX: number,
  anchorZ: number,
  nodes: readonly {
    id: string;
    role: GhostWaypointRole;
    x: number;
    z: number;
    preferredClip?: 'depressed' | 'dig';
    side?: -1 | 0 | 1;
  }[],
  edges: readonly (readonly [string, string])[],
  extraObstacles: readonly GhostObstacleBox[] = [],
): GhostWarehouseEnvironment {
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const [a, b] of edges) {
    adj.get(a)?.add(b);
    adj.get(b)?.add(a);
  }
  const anchorUv = worldToWarehouseLocal(anchorX, anchorZ);
  return finalizeEnvironmentFromDrafts({
    zoneId,
    zoneName,
    regionId: 'myothar',
    anchor: {
      x: Number(anchorX.toFixed(3)),
      z: Number(anchorZ.toFixed(3)),
      localU: Number(anchorUv.u.toFixed(3)),
      localV: Number(anchorUv.v.toFixed(3)),
    },
    drafts: nodes.map((n) => {
      const uv = worldToWarehouseLocal(n.x, n.z);
      return {
        id: n.id,
        role: n.role,
        localU: uv.u,
        localV: uv.v,
        x: n.x,
        z: n.z,
        links: Array.from(adj.get(n.id) ?? []),
        preferredClip: n.preferredClip,
        side: n.side,
      };
    }),
    crossingCandidates: [],
    extraObstacles,
  });
}

function buildLocalUvZone(opts: {
  zoneId: GhostHauntZoneId;
  zoneName: string;
  anchorU: number;
  anchorV: number;
  nodes: readonly NodeSeed[];
  edges: readonly (readonly [string, string])[];
  crossingPairs?: readonly { id: string; westCurbId: string; eastCurbId: string }[];
}): GhostWarehouseEnvironment {
  const anchorWorld = warehouseLocalToWorld(opts.anchorU, opts.anchorV);
  const ah1 = area5.roads.find((r) => r.id === 'ah1');
  const roadHalfWidth = (ah1?.width ?? 12) / 2;
  return finalizeEnvironmentFromDrafts({
    zoneId: opts.zoneId,
    zoneName: opts.zoneName,
    regionId: 'myothar',
    anchor: {
      x: Number(anchorWorld.x.toFixed(3)),
      z: Number(anchorWorld.z.toFixed(3)),
      localU: opts.anchorU,
      localV: opts.anchorV,
    },
    drafts: makeZoneDrafts(opts.nodes, opts.edges),
    crossingCandidates: (opts.crossingPairs ?? []).map((p) => ({
      ...p,
      roadId: ah1?.id ?? 'ah1',
      roadHalfWidth,
    })),
  });
}

function buildCemeteryHauntEnvironment(): GhostWarehouseEnvironment {
  const layout = MYOTHAR_CEMETERY_LAYOUT;
  const wallBoxes: GhostObstacleBox[] = layout.walls.map(wall => ({
    id: `cem-${wall.key}`, x: wall.x, z: wall.z, halfW: wall.length / 2, halfD: .28, rotation: -wall.rot, blocksSight: true,
  }));

  const defs: { id: string; role: GhostWaypointRole; lx: number; lz: number; preferredClip?: 'depressed' | 'dig' }[] = [
    { id: 'cem-ext-n', role: 'dark-corner', lx: -102, lz: -10, preferredClip: 'dig' },
    { id: 'cem-ext-mid', role: 'patrol', lx: -102, lz: 0 },
    { id: 'cem-ext-s', role: 'dark-corner', lx: -102, lz: 10, preferredClip: 'depressed' },
    { id: 'cem-gate', role: 'patrol', lx: -91, lz: 0 },
    { id: 'cem-w', role: 'patrol', lx: -65, lz: 0 },
    { id: 'cem-w-mid', role: 'patrol', lx: -42, lz: 0 },
    { id: 'cem-center', role: 'hiding', lx: 0, lz: 0, preferredClip: 'depressed' },
    { id: 'cem-e-mid', role: 'patrol', lx: 42, lz: 0 },
    { id: 'cem-e', role: 'hiding', lx: 65, lz: 0, preferredClip: 'dig' },
    { id: 'cem-wn', role: 'dark-corner', lx: -42, lz: -CEMETERY_PATROL_ROW_Z, preferredClip: 'dig' },
    { id: 'cem-cn', role: 'hiding', lx: 0, lz: -CEMETERY_PATROL_ROW_Z, preferredClip: 'depressed' },
    { id: 'cem-en', role: 'dark-corner', lx: 42, lz: -CEMETERY_PATROL_ROW_Z, preferredClip: 'dig' },
    { id: 'cem-ws', role: 'dark-corner', lx: -42, lz: CEMETERY_PATROL_ROW_Z, preferredClip: 'depressed' },
    { id: 'cem-cs', role: 'hiding', lx: 0, lz: CEMETERY_PATROL_ROW_Z, preferredClip: 'dig' },
    { id: 'cem-es', role: 'dark-corner', lx: 42, lz: CEMETERY_PATROL_ROW_Z, preferredClip: 'depressed' },
  ];

  const nodes = defs.map((d) => ({
    id: d.id,
    role: d.role,
    preferredClip: d.preferredClip,
    ...(d.id === 'cem-gate' ? { x: layout.entrance.x, z: layout.entrance.z } : cemeteryToWorld(layout, d.lx, d.lz)),
  }));

  const edges: [string, string][] = [
    ['cem-ext-n', 'cem-ext-mid'],
    ['cem-ext-mid', 'cem-ext-s'],
    ['cem-ext-mid', 'cem-gate'],
    ['cem-gate', 'cem-w'],
    ['cem-w', 'cem-w-mid'],
    ['cem-w-mid', 'cem-center'],
    ['cem-center', 'cem-e-mid'],
    ['cem-e-mid', 'cem-e'],
    ['cem-w-mid', 'cem-wn'],
    ['cem-w-mid', 'cem-ws'],
    ['cem-wn', 'cem-cn'],
    ['cem-cn', 'cem-en'],
    ['cem-cn', 'cem-center'],
    ['cem-ws', 'cem-cs'],
    ['cem-cs', 'cem-es'],
    ['cem-cs', 'cem-center'],
    ['cem-e-mid', 'cem-en'],
    ['cem-e-mid', 'cem-es'],
  ];

  return buildWorldNodeZone(
    'myothar-cemetery',
    'သင်္ချိုင်း (ကံပုလဲ) · သုသာန်',
    layout.cx,
    layout.cz,
    nodes,
    edges,
    wallBoxes,
  );
}

const cachedHauntEnvs = new Map<GhostHauntZoneId, GhostWarehouseEnvironment>();

export function buildGhostHauntEnvironment(zoneId: GhostHauntZoneId): GhostWarehouseEnvironment {
  if (zoneId === 'warehouse-row') {
    return loadGhostWarehouseEnvironment();
  }
  const existing = cachedHauntEnvs.get(zoneId);
  if (existing) return existing;

  let env: GhostWarehouseEnvironment;
  switch (zoneId) {
    case 'old-west-lanes':
      env = buildLocalUvZone({
        zoneId,
        zoneName: 'မြို့သာ မြောက်ပိုင်း လမ်းသွယ်များ · နယ်မြေ (၅)',
        anchorU: -88,
        anchorV: -47,
        nodes: [
          { id: 'ow-nw', role: 'dark-corner', u: -99, v: -112, preferredClip: 'dig', side: -1 },
          { id: 'ow-ne', role: 'hiding', u: -77, v: -112, preferredClip: 'depressed', side: -1 },
          { id: 'ow-far-w', role: 'dark-corner', u: -120, v: -47, preferredClip: 'dig', side: -1 },
          { id: 'ow-mid-w', role: 'patrol', u: -99, v: -47, side: -1 },
          { id: 'ow-mid-e', role: 'patrol', u: -77, v: -47, side: -1 },
          { id: 'ow-c2-w', role: 'hiding', u: -99, v: 0, preferredClip: 'depressed', side: -1 },
          { id: 'ow-c2-e', role: 'hiding', u: -77, v: 0, preferredClip: 'dig', side: -1 },
          { id: 'ow-sw', role: 'dark-corner', u: -99, v: 40, preferredClip: 'depressed', side: -1 },
          { id: 'ow-se', role: 'patrol', u: -77, v: 40, side: -1 },
          { id: 'ow-curb-w', role: 'road-curb', u: -18, v: -47, side: -1 },
          { id: 'ow-curb-e', role: 'road-curb', u: 14, v: -47, side: 1 },
        ],
        edges: [
          ['ow-nw', 'ow-ne'],
          ['ow-nw', 'ow-mid-w'],
          ['ow-ne', 'ow-mid-e'],
          ['ow-far-w', 'ow-mid-w'],
          ['ow-mid-w', 'ow-mid-e'],
          ['ow-mid-w', 'ow-c2-w'],
          ['ow-mid-e', 'ow-c2-e'],
          ['ow-c2-w', 'ow-sw'],
          ['ow-c2-e', 'ow-se'],
          ['ow-sw', 'ow-se'],
          ['ow-mid-e', 'ow-curb-w'],
          ['ow-curb-w', 'ow-curb-e'],
        ],
        crossingPairs: [{ id: 'ah1-cross-oldwest', westCurbId: 'ow-curb-w', eastCurbId: 'ow-curb-e' }],
      });
      break;

    case 'monastery-pitch-edge':
      env = buildLocalUvZone({
        zoneId,
        zoneName: 'ဘုန်းကြီးကျောင်းနှင့် ဘောလုံးကွင်းဘေး · နယ်မြေ (၅)',
        anchorU: 150,
        anchorV: 50,
        nodes: [
          { id: 'mp-og-nw', role: 'dark-corner', u: 95, v: -75, preferredClip: 'dig', side: 1 },
          { id: 'mp-og-w', role: 'hiding', u: 110, v: -45, preferredClip: 'depressed', side: 1 },
          { id: 'mp-og-e', role: 'patrol', u: 135, v: -45, side: 1 },
          { id: 'mp-lane-n', role: 'patrol', u: 150, v: -20, side: 1 },
          { id: 'mp-lane-m1', role: 'hiding', u: 150, v: 20, preferredClip: 'depressed', side: 1 },
          { id: 'mp-lane-m2', role: 'patrol', u: 150, v: 68, side: 1 },
          { id: 'mp-lane-s', role: 'hiding', u: 150, v: 124, preferredClip: 'dig', side: 1 },
          { id: 'mp-corner-e', role: 'dark-corner', u: 170, v: 124, preferredClip: 'depressed', side: 1 },
        ],
        edges: [
          ['mp-og-nw', 'mp-og-w'],
          ['mp-og-w', 'mp-og-e'],
          ['mp-og-e', 'mp-lane-n'],
          ['mp-lane-n', 'mp-lane-m1'],
          ['mp-lane-m1', 'mp-lane-m2'],
          ['mp-lane-m2', 'mp-lane-s'],
          ['mp-lane-s', 'mp-corner-e'],
        ],
      });
      break;

    case 'west-residential-lanes':
      env = buildLocalUvZone({
        zoneId,
        zoneName: 'နယ်မြေ (၅) အနောက်ဘက် ရပ်ကွက်လမ်းများ',
        anchorU: -22,
        anchorV: 175,
        nodes: [
          { id: 'wr-l1-c', role: 'road-curb', u: -10, v: 128, side: -1 },
          { id: 'wr-l1-ec', role: 'road-curb', u: 12, v: 128, side: 1 },
          { id: 'wr-l1-w', role: 'dark-corner', u: -48, v: 128, preferredClip: 'dig', side: -1 },
          { id: 'wr-158-ec', role: 'road-curb', u: 12, v: 158, side: 1 },
          { id: 'wr-158-wc', role: 'road-curb', u: -10, v: 158, side: -1 },
          { id: 'wr-158-m', role: 'hiding', u: -45, v: 158, preferredClip: 'depressed', side: -1 },
          { id: 'wr-158-w', role: 'dark-corner', u: -95, v: 158, preferredClip: 'dig', side: -1 },
          { id: 'wr-192-c', role: 'patrol', u: -15, v: 192, side: -1 },
          { id: 'wr-192-m', role: 'hiding', u: -48, v: 192, preferredClip: 'depressed', side: -1 },
          { id: 'wr-192-w', role: 'dark-corner', u: -95, v: 192, preferredClip: 'dig', side: -1 },
          { id: 'wr-222', role: 'patrol', u: -10, v: 222, side: -1 },
          { id: 'wr-245', role: 'hiding', u: -10, v: 245, preferredClip: 'depressed', side: -1 },
        ],
        edges: [
          ['wr-l1-w', 'wr-l1-c'],
          ['wr-l1-c', 'wr-l1-ec'],
          ['wr-l1-c', 'wr-158-wc'],
          ['wr-158-w', 'wr-158-m'],
          ['wr-158-m', 'wr-158-wc'],
          ['wr-158-wc', 'wr-158-ec'],
          ['wr-158-wc', 'wr-192-c'],
          ['wr-158-m', 'wr-192-m'],
          ['wr-158-w', 'wr-192-w'],
          ['wr-192-w', 'wr-192-m'],
          ['wr-192-m', 'wr-192-c'],
          ['wr-192-c', 'wr-222'],
          ['wr-222', 'wr-245'],
        ],
        crossingPairs: [
          { id: 'ah1-cross-wr-128', westCurbId: 'wr-l1-c', eastCurbId: 'wr-l1-ec' },
          { id: 'ah1-cross-wr-158', westCurbId: 'wr-158-wc', eastCurbId: 'wr-158-ec' },
        ],
      });
      break;

    case 'east-pitch-residential':
      env = buildLocalUvZone({
        zoneId,
        zoneName: 'ကွင်းဘေး အရှေ့ရပ်ကွက် · နယ်မြေ (၅)',
        anchorU: 95,
        anchorV: 203,
        nodes: [
          { id: 'ep-158-w', role: 'patrol', u: 16, v: 158, side: 1 },
          { id: 'ep-158-m', role: 'hiding', u: 95, v: 158, preferredClip: 'depressed', side: 1 },
          { id: 'ep-158-e', role: 'dark-corner', u: 152, v: 158, preferredClip: 'dig', side: 1 },
          { id: 'ep-188-w', role: 'patrol', u: 16, v: 188, side: 1 },
          { id: 'ep-188-m', role: 'patrol', u: 95, v: 188, side: 1 },
          { id: 'ep-188-e', role: 'hiding', u: 152, v: 188, preferredClip: 'depressed', side: 1 },
          { id: 'ep-218-w', role: 'hiding', u: 16, v: 218, preferredClip: 'dig', side: 1 },
          { id: 'ep-218-m', role: 'patrol', u: 95, v: 218, side: 1 },
          { id: 'ep-218-e', role: 'dark-corner', u: 152, v: 218, preferredClip: 'dig', side: 1 },
          { id: 'ep-248-w', role: 'patrol', u: 16, v: 248, side: 1 },
          { id: 'ep-248-m', role: 'hiding', u: 95, v: 248, preferredClip: 'depressed', side: 1 },
          { id: 'ep-248-e', role: 'dark-corner', u: 152, v: 248, preferredClip: 'dig', side: 1 },
        ],
        edges: [
          ['ep-158-w', 'ep-158-m'],
          ['ep-158-m', 'ep-158-e'],
          ['ep-188-w', 'ep-188-m'],
          ['ep-188-m', 'ep-188-e'],
          ['ep-218-w', 'ep-218-m'],
          ['ep-218-m', 'ep-218-e'],
          ['ep-248-w', 'ep-248-m'],
          ['ep-248-m', 'ep-248-e'],
          ['ep-158-w', 'ep-188-w'],
          ['ep-188-w', 'ep-218-w'],
          ['ep-218-w', 'ep-248-w'],
          ['ep-158-e', 'ep-188-e'],
          ['ep-188-e', 'ep-218-e'],
          ['ep-218-e', 'ep-248-e'],
        ],
      });
      break;

    case 'rice-mill-south':
      env = buildLocalUvZone({
        zoneId,
        zoneName: 'ဆန်စက်ရုံဝင်းနှင့် တောင်ဘက်လမ်း · နယ်မြေ (၅)',
        anchorU: 55,
        anchorV: 316,
        nodes: [
          { id: 'rm-302-w', role: 'patrol', u: 12, v: 302, side: 1 },
          { id: 'rm-302-m', role: 'hiding', u: 44, v: 302, preferredClip: 'depressed', side: 1 },
          { id: 'rm-302-e', role: 'patrol', u: 106, v: 302, side: 1 },
          { id: 'rm-302-c', role: 'patrol', u: 126, v: 302, side: 1 },
          { id: 'rm-lane-n', role: 'hiding', u: 126, v: 315, preferredClip: 'dig', side: 1 },
          { id: 'rm-lane-s', role: 'dark-corner', u: 126, v: 348, preferredClip: 'depressed', side: 1 },
          { id: 'rm-yard', role: 'dark-corner', u: 44, v: 325, preferredClip: 'dig', side: 1 },
          { id: 'rm-310-ec', role: 'road-curb', u: 8, v: 310, side: 1 },
          { id: 'rm-310-wc', role: 'road-curb', u: -12, v: 310, side: -1 },
          { id: 'rm-350-e', role: 'hiding', u: 8, v: 350, preferredClip: 'depressed', side: 1 },
          { id: 'rm-382-ec', role: 'road-curb', u: 8, v: 382, side: 1 },
          { id: 'rm-382-wc', role: 'road-curb', u: -12, v: 382, side: -1 },
        ],
        edges: [
          ['rm-302-w', 'rm-302-m'],
          ['rm-302-m', 'rm-302-e'],
          ['rm-302-m', 'rm-yard'],
          ['rm-302-e', 'rm-302-c'],
          ['rm-302-c', 'rm-lane-n'],
          ['rm-lane-n', 'rm-lane-s'],
          ['rm-302-w', 'rm-310-ec'],
          ['rm-310-ec', 'rm-310-wc'],
          ['rm-310-ec', 'rm-350-e'],
          ['rm-350-e', 'rm-382-ec'],
          ['rm-382-ec', 'rm-382-wc'],
        ],
        crossingPairs: [
          { id: 'ah1-cross-rm-310', westCurbId: 'rm-310-wc', eastCurbId: 'rm-310-ec' },
          { id: 'ah1-cross-rm-382', westCurbId: 'rm-382-wc', eastCurbId: 'rm-382-ec' },
        ],
      });
      break;

    case 'shwe-myanmar-north':
      env = buildLocalUvZone({
        zoneId,
        zoneName: 'ရွှေမြန်မာ နှင့် မြောက်ဘက် AH1 · မြို့သာ',
        anchorU: 5,
        anchorV: -255,
        nodes: [
          { id: 'sm-285-e', role: 'dark-corner', u: 10, v: -285, preferredClip: 'dig', side: 1 },
          { id: 'sm-280-e', role: 'hiding', u: 22, v: -280, preferredClip: 'depressed', side: 1 },
          { id: 'sm-255-wc', role: 'road-curb', u: -10, v: -255, side: -1 },
          { id: 'sm-255-ec', role: 'road-curb', u: 10, v: -255, side: 1 },
          { id: 'sm-258-e', role: 'patrol', u: 22, v: -258, side: 1 },
          { id: 'sm-258-far', role: 'dark-corner', u: 45, v: -258, preferredClip: 'dig', side: 1 },
          { id: 'sm-240-w', role: 'hiding', u: -22, v: -240, preferredClip: 'depressed', side: -1 },
          { id: 'sm-240-e', role: 'patrol', u: 10, v: -240, side: 1 },
          { id: 'sm-225-wc', role: 'road-curb', u: -10, v: -225, side: -1 },
          { id: 'sm-225-ec', role: 'road-curb', u: 10, v: -225, side: 1 },
        ],
        edges: [
          ['sm-285-e', 'sm-280-e'],
          ['sm-280-e', 'sm-258-e'],
          ['sm-258-e', 'sm-258-far'],
          ['sm-255-ec', 'sm-258-e'],
          ['sm-255-wc', 'sm-255-ec'],
          ['sm-255-wc', 'sm-240-w'],
          ['sm-240-w', 'sm-225-wc'],
          ['sm-255-ec', 'sm-240-e'],
          ['sm-240-e', 'sm-225-ec'],
          ['sm-225-wc', 'sm-225-ec'],
        ],
        crossingPairs: [
          { id: 'ah1-cross-sm-255', westCurbId: 'sm-255-wc', eastCurbId: 'sm-255-ec' },
          { id: 'ah1-cross-sm-225', westCurbId: 'sm-225-wc', eastCurbId: 'sm-225-ec' },
        ],
      });
      break;

    case 'myothar-cemetery':
      env = buildCemeteryHauntEnvironment();
      break;
  }

  cachedHauntEnvs.set(zoneId, env);
  return env;
}

export function listGhostHauntZones(): GhostHauntZoneInfo[] {
  return GHOST_HAUNT_ZONE_IDS.map((zoneId) => {
    const env = buildGhostHauntEnvironment(zoneId);
    return {
      zoneId,
      zoneName: env.zoneName ?? zoneId,
      regionId: env.regionId ?? 'myothar',
      anchor: env.anchor,
      waypointCount: env.waypoints.length,
      hidingCount: env.hidingIds.length,
      patrolCount: env.patrolIds.length,
    };
  });
}

/**
 * Randomly selects `count` distinct haunt zones using Fisher-Yates shuffle while enforcing
 * minimum spatial separation so simultaneous ghosts spread across distinct town neighborhoods.
 */
export function selectRandomGhostZones(
  count: number = DEFAULT_GHOST_COUNT,
  randomFn: () => number = Math.random,
  minSeparationM: number = GHOST_MIN_ZONE_SEPARATION_M,
  requiredZones: readonly GhostHauntZoneId[] = [],
): GhostHauntZoneId[] {
  const valid = GHOST_HAUNT_ZONE_IDS.map((id) => ({
    id,
    env: buildGhostHauntEnvironment(id),
  })).filter((entry) => entry.env.hidingIds.length >= 2 && entry.env.waypoints.length >= 4);

  if (valid.length === 0) return [];
  const targetCount = Math.max(0, Math.min(count, valid.length));
  if (targetCount === 0) return [];

  const validById = new Map(valid.map((entry) => [entry.id, entry]));
  const picked: typeof valid = [];
  const pickedIds = new Set<GhostHauntZoneId>();
  for (const requiredId of requiredZones) {
    if (picked.length >= targetCount) break;
    if (pickedIds.has(requiredId)) continue;
    const entry = validById.get(requiredId);
    if (entry) {
      picked.push(entry);
      pickedIds.add(requiredId);
    }
  }

  const shuffled = valid.filter((entry) => !pickedIds.has(entry.id));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  for (const cand of shuffled) {
    if (picked.length >= targetCount) break;
    const wellSeparated = picked.every(
      (p) => Math.hypot(cand.env.anchor.x - p.env.anchor.x, cand.env.anchor.z - p.env.anchor.z) >= minSeparationM,
    );
    if (wellSeparated) {
      picked.push(cand);
      pickedIds.add(cand.id);
    }
  }

  if (picked.length < targetCount) {
    for (const cand of shuffled) {
      if (picked.length >= targetCount) break;
      if (!pickedIds.has(cand.id)) {
        picked.push(cand);
        pickedIds.add(cand.id);
      }
    }
  }

  return picked.map((p) => p.id);
}

/**
 * Picks runtime ghost haunt zones while guaranteeing `warehouse-row` hosts the primary hunter
 * and distributing additional ghosts across spatially separated town zones.
 */
export function selectActiveGhostZones(
  count: number = DEFAULT_GHOST_COUNT,
  randomFn: () => number = Math.random,
  minSeparationM: number = GHOST_MIN_ZONE_SEPARATION_M,
): GhostHauntZoneId[] {
  return selectRandomGhostZones(
    count,
    randomFn,
    minSeparationM,
    count >= 1 ? ['warehouse-row'] : [],
  );
}
