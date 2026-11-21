/**
 * Fixed-Pool Street & Neighbor-Visiting Villager Bots (လမ်းမကြီးနှင့် ရပ်ကွက်လမ်းသွယ် လူသွားလူလာ Bot များ).
 *
 * - Uses REAL connected road segments (`buildRoadGraph` from `robotRoutes.ts`) — never polygon bbox centers.
 * - Reuses the EXACT SAME singleton flyweight geometry & material cache (`getElderBotResourceCache`),
 *   `ElderBotRig`, and `KidBotRig` — ZERO new BufferGeometries, Textures, or Materials!
 * - Scales crowd count cleanly with time-of-day (`morning`/`day` = busy full crowd, `evening` = moderate,
 *   `night` = quiet few late walkers).
 * - Recycles distant slots smoothly around the player's current region so roads stay lively everywhere
 *   while strictly bounding GPU draw calls & memory (`<= 28` desktop / `<= 14` mobile).
 */

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useFrame } from '@react-three/fiber';
import { ward } from '../data/ward';
import { kalayVillages } from '../data/villages';
import { canStand } from '../game/collision';
import { buildRoadGraph, type RouteNode } from '../game/robotRoutes';
import { sceneGround } from '../game/groundSurface';
import { mobileQuality } from '../game/sceneBudget';
import { isChinVillageRegion } from '../game/chinVillages';
import { useQualityPreset } from '../game/qualityPreset';
import type { TimeMode } from '../game/environmentTime';
import {
  getStreamedChunkVersion,
  getStreamedRoadPlotsForRegion,
  subscribeStreamedChunks,
} from '../game/streamedChunkRegistry';
import {
  createStreetPedestrianProfiles,
  createStreetPedestrianStates,
  desiredPedestrianCount,
  pickNearbyRoadNode,
  placePedestrianOnGraph,
  stepStreetPedestrian,
  type StreetPedestrianState,
} from '../game/villageCrowd';
import {
  disengageBotFight,
  getBotCombatReaction,
  getBotFightingState,
  isBotInCombat,
} from '../game/botFighting';
import type { ResidentState } from '../game/residentBots';
import {
  ElderBotRig,
  applyElderBotPose,
  type ElderBotRigHandles,
} from './ElderBotRig';
import {
  KidBotRig,
  applyKidBotPose,
  createEmptyKidHandles,
  type KidBotRigHandles,
} from './KidBotRig';

const MAX_STREET_POOL_DESKTOP = 28;
const MAX_STREET_POOL_MOBILE = 14;
const RECYCLE_DIST_SQ = 128 * 128;
const GROUND_REFRESH_SEC = 0.25;
const REBALANCE_INTERVAL_SEC = 0.5;

const allRegions = [{ id: 'myothar', roads: ward.roads }, ...kalayVillages];
const clearPoint = (x: number, z: number) =>
  canStand(x, z) &&
  canStand(x + 0.08, z) &&
  canStand(x - 0.08, z) &&
  canStand(x, z + 0.08) &&
  canStand(x, z - 0.08);

const cachedRoadGraphs = new Map<string, { sig: string; graph: RouteNode[] }>();

function getRoadGraphForRegion(regionId: string): RouteNode[] {
  const region = allRegions.find((r) => r.id === regionId) as
    | ((typeof allRegions)[number] & { streamed?: boolean })
    | undefined;
  if (!region) return [];
  const isStreamed = Boolean(region.streamed);
  const roads = isStreamed ? getStreamedRoadPlotsForRegion(regionId) : region.roads;
  const sig = isStreamed ? roads.map((rd) => rd.id).sort().join('|') : 'static';
  const existing = cachedRoadGraphs.get(regionId);
  if (existing && existing.sig === sig) return existing.graph;
  const graph = roads.length ? buildRoadGraph(roads, clearPoint) : [];
  cachedRoadGraphs.set(regionId, { sig, graph });
  return graph;
}

function emptyElderHandles(): ElderBotRigHandles {
  return {
    root: null,
    pelvis: null,
    torso: null,
    head: null,
    leftArm: null,
    rightArm: null,
    leftForearm: null,
    rightForearm: null,
    leftFoot: null,
    rightFoot: null,
    standLongyi: null,
    sitLongyi: null,
  };
}

/** Reusable scratch ResidentState passed to shared `applyElderBotPose` / `applyKidBotPose`. */
function createPoseAdapter(): ResidentState {
  return {
    role: 'uncle',
    seatIndex: 0,
    phase: 'WALKING_TO_HOUSE',
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    sitBlend: 0,
    doorReachBlend: 0,
    phaseTimer: 0,
    phaseDuration: 1,
    waypointIndex: 0,
    visitRouteIndex: 0,
    visitPauseTimer: 0,
    visitPaused: false,
    outingPlanned: false,
    walkDistance: 0,
    speed: 0,
    visible: false,
    seed: 1,
    elapsed: 0,
    walkSpeed: 1,
    seatHeight: 0.42,
    sitMinSec: 10,
    sitSpanSec: 5,
    insideMinSec: 8,
    insideSpanSec: 4,
  };
}

export function VillagePedestrianBots({
  activeRegions = [],
  minute = 780,
  timeMode = 'auto',
}: {
  activeRegions?: string[];
  minute?: number;
  timeMode?: TimeMode;
}) {
  const preset = useQualityPreset();
  const chunkVersion = useSyncExternalStore(subscribeStreamedChunks, getStreamedChunkVersion);

  const maxPool =
    mobileQuality || preset.id === 'mobile' || preset.id === 'low'
      ? MAX_STREET_POOL_MOBILE
      : MAX_STREET_POOL_DESKTOP;
  const targetActiveCount = desiredPedestrianCount(minute, timeMode, maxPool);

  const profiles = useMemo(() => createStreetPedestrianProfiles(MAX_STREET_POOL_DESKTOP), []);
  const statesRef = useRef<StreetPedestrianState[]>(
    createStreetPedestrianStates(MAX_STREET_POOL_DESKTOP),
  );
  const [activeMaskRev, setActiveMaskRev] = useState(0);
  const rebalanceTimerRef = useRef(REBALANCE_INTERVAL_SEC);
  const groundTimerRef = useRef(GROUND_REFRESH_SEC);
  const poseAdapterRef = useRef<ResidentState>(createPoseAdapter());

  const elderHandles = useMemo(
    () => Array.from({ length: MAX_STREET_POOL_DESKTOP }, () => ({ current: emptyElderHandles() })),
    [],
  );
  const kidHandles = useMemo(
    () => Array.from({ length: MAX_STREET_POOL_DESKTOP }, () => ({ current: createEmptyKidHandles() })),
    [],
  );

  // Build / reuse connected road graphs for active non-Chin regions
  // (Chin villages use dedicated Chin ethnic villagers exclusively via `<ChinVillagePopulation>`!)
  const regionGraphs = useMemo(() => {
    const map = new Map<string, RouteNode[]>();
    for (const id of activeRegions) {
      if (isChinVillageRegion(id)) continue;
      const g = getRoadGraphForRegion(id);
      if (g.length > 1) map.set(id, g);
    }
    return map;
  }, [activeRegions, chunkVersion]);

  useFrame(({ camera, scene, clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const states = statesRef.current;
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };

    // 0. Nighttime fast-clear: ZERO human street bots remain on roads at night!
    if (targetActiveCount === 0) {
      let clearedAny = false;
      for (let i = 0; i < MAX_STREET_POOL_DESKTOP; i++) {
        const st = states[i];
        const prof = profiles[i];
        const isKid = prof.role === 'boy' || prof.role === 'girl';
        if (st.active) {
          st.active = false;
          st.regionId = null;
          st.speed = 0;
          clearedAny = true;
        }
        if (isKid) applyKidBotPose(kidHandles[i].current, null);
        else applyElderBotPose(elderHandles[i].current, null);
      }
      const bf = getBotFightingState();
      if (
        bf.active &&
        bf.targetBotId &&
        (bf.targetBotId.startsWith('street-villager-') || bf.targetBotId.startsWith('street-kid-'))
      ) {
        disengageBotFight();
      }
      if (clearedAny) setActiveMaskRev((r) => r + 1);
      return;
    }

    // 1. Periodically assign/recycle slots around the player's current region & crowd target
    rebalanceTimerRef.current += dt;
    if (rebalanceTimerRef.current >= REBALANCE_INTERVAL_SEC) {
      rebalanceTimerRef.current = 0;
      const availableRegions = Array.from(regionGraphs.keys());
      let maskChanged = false;

      for (let i = 0; i < MAX_STREET_POOL_DESKTOP; i++) {
        const st = states[i];
        const shouldBeActive = i < targetActiveCount && availableRegions.length > 0;

        if (!shouldBeActive) {
          if (st.active) {
            st.active = false;
            st.regionId = null;
            maskChanged = true;
          }
          continue;
        }

        const graph = st.regionId ? regionGraphs.get(st.regionId) : undefined;
        const isKidSlot = profiles[i].role === 'boy' || profiles[i].role === 'girl';
        const slotBotName = isKidSlot ? `street-kid-${i}` : `street-villager-${i}`;
        const dx = st.x - focus.x;
        const dz = st.z - focus.z;
        const needsPlacement =
          !isBotInCombat(slotBotName) &&
          (!st.active || !graph || graph.length < 2 || dx * dx + dz * dz > RECYCLE_DIST_SQ);

        if (needsPlacement) {
          // Pick closest active region with valid road nodes near focus
          let bestRegion = availableRegions[i % availableRegions.length];
          let bestNode = -1;
          let bestDistSq = Infinity;
          for (const rid of availableRegions) {
            const g = regionGraphs.get(rid)!;
            const nodeIdx = pickNearbyRoadNode(
              g,
              focus.x,
              focus.z,
              14,
              92,
              (st.seed + i * 31) >>> 0,
            );
            if (nodeIdx >= 0) {
              const n = g[nodeIdx];
              const d2 = (n.x - focus.x) ** 2 + (n.z - focus.z) ** 2;
              if (d2 < bestDistSq) {
                bestDistSq = d2;
                bestRegion = rid;
                bestNode = nodeIdx;
              }
            }
          }
          if (bestNode >= 0) {
            const placed = placePedestrianOnGraph(
              st,
              bestRegion,
              regionGraphs.get(bestRegion)!,
              bestNode,
              profiles[i].sideOffset,
            );
            if (placed) maskChanged = true;
          }
        }
      }
      if (maskChanged) setActiveMaskRev((r) => r + 1);
    }

    // 2. Sample ground height periodically & step all active pedestrians
    groundTimerRef.current += dt;
    const refreshGround = groundTimerRef.current >= GROUND_REFRESH_SEC;
    if (refreshGround) groundTimerRef.current = 0;
    const ground = refreshGround ? sceneGround(scene, clock.elapsedTime) : null;

    const adapter = poseAdapterRef.current;
    for (let i = 0; i < MAX_STREET_POOL_DESKTOP; i++) {
      const st = states[i];
      const prof = profiles[i];
      const isKid = prof.role === 'boy' || prof.role === 'girl';

      if (!st.active || i >= targetActiveCount) {
        if (isKid) applyKidBotPose(kidHandles[i].current, null);
        else applyElderBotPose(elderHandles[i].current, null);
        continue;
      }

      const graph = st.regionId ? regionGraphs.get(st.regionId) : undefined;
      if (!graph) continue;

      const botName = isKid ? `street-kid-${i}` : `street-villager-${i}`;
      if (isBotInCombat(botName)) {
        const combat = getBotCombatReaction(botName);
        if (combat && combat.hasWorldPos) {
          st.x = combat.worldX;
          st.z = combat.worldZ;
        }
        st.speed = combat?.chasing ? combat.chaseSpeed : 0;
        st.elapsed += dt;
      } else {
        stepStreetPedestrian(st, prof, graph, dt);
      }
      if (ground) {
        st.y = ground.height(st.x, st.z);
      }

      (adapter as { role: typeof prof.role }).role = prof.role;
      adapter.x = st.x;
      adapter.y = st.y;
      adapter.z = st.z;
      adapter.yaw = st.yaw;
      adapter.walkDistance = st.walkDistance;
      adapter.speed = st.speed;
      adapter.elapsed = st.elapsed;
      adapter.sitBlend = 0;
      adapter.doorReachBlend = 0;
      adapter.visible = true;

      if (isKid) {
        applyKidBotPose(kidHandles[i].current, adapter);
      } else {
        applyElderBotPose(elderHandles[i].current, adapter);
      }
    }
  });

  // Read revision so colliders stay synchronized when slots activate/deactivate
  void activeMaskRev;

  return (
    <group name="village-street-pedestrian-bots">
      {profiles.slice(0, maxPool).map((prof) => {
        const isSlotActive =
          prof.slotIndex < targetActiveCount && Boolean(statesRef.current[prof.slotIndex]?.active);
        if (prof.role === 'boy' || prof.role === 'girl') {
          return (
            <KidBotRig
              key={prof.slotIndex}
              role={prof.role}
              outfitIndex={prof.outfitIndex}
              skinIndex={prof.skinIndex}
              heightScale={prof.heightScale}
              active={isSlotActive}
              name={`street-kid-${prof.slotIndex}`}
              handlesRef={kidHandles[prof.slotIndex]}
            />
          );
        }
        return (
          <ElderBotRig
            key={prof.slotIndex}
            role={prof.role}
            youthful={prof.youthful}
            bottomStyle={prof.bottomStyle}
            outfitIndex={prof.outfitIndex}
            skinIndex={prof.skinIndex}
            hairIndex={prof.hairIndex}
            heightScale={prof.heightScale}
            active={isSlotActive}
            name={`street-villager-${prof.slotIndex}`}
            handlesRef={elderHandles[prof.slotIndex]}
          />
        );
      })}
    </group>
  );
}
