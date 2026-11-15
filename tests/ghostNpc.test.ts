import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { AnimationController } from '../src/animation/core/AnimationController.ts';
import {
  ALL_GHOST_CLIP_IDS,
  clearGhostMotionCaches,
  GHOST_CLIP_SPECS,
  getGhostMotionCacheCounts,
  loadGhostRetargetedClip,
  validateGhostRigCompatibility,
  type GhostClipId,
} from '../src/animation/ghost/GhostMotionLibrary.ts';
import {
  GHOST_HAUNT_ZONE_IDS,
  buildDefaultWarehouseEnvironment,
  buildGhostHauntEnvironment,
  findWaypointPath,
  isGhostPointWalkable,
  isGhostSegmentWalkable,
  listGhostHauntZones,
  loadGhostWarehouseEnvironment,
  selectRandomGhostZones,
  worldToWarehouseLocal,
} from '../src/data/ghostWarehouseWaypoints.ts';
import {
  DEFAULT_GHOST_AI_CONFIG,
  DEFAULT_GHOST_COUNT,
  GHOST_MIN_ZONE_SEPARATION_M,
  GHOST_TARGET_HEIGHT_M,
  GHOST_WAREHOUSE_ANCHOR,
  clearGhostEncounterInteraction,
  getGhostEncounterInteraction,
  isGhostNightActive,
  isOtherGhostGrabbingPlayer,
  rollGhostChaseThreshold,
  setGhostDevForceActive,
  setGhostEncounterInteraction,
} from '../src/game/ghostConfig.ts';
import {
  GhostAiController,
  hasWarehouseLineOfSight,
  type GhostTrafficSample,
} from '../src/game/ghostAi.ts';

const ROOT = resolve(import.meta.dirname, '..');

async function parseGlbStripTextures(relPath: string): Promise<{ gltf: GLTF; json: Record<string, unknown> }> {
  const bytes = readFileSync(resolve(ROOT, relPath));
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8')) as Record<string, unknown>;
  const stripped = structuredClone(json) as {
    images?: unknown;
    textures?: unknown;
    samplers?: unknown;
    materials?: unknown;
    meshes?: { primitives?: { material?: unknown }[] }[];
  };
  delete stripped.images;
  delete stripped.textures;
  delete stripped.samplers;
  delete stripped.materials;
  for (const mesh of stripped.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) delete prim.material;
  }
  const rawJson = JSON.stringify(stripped);
  const encoded = Buffer.from(rawJson.padEnd(Math.ceil(rawJson.length / 4) * 4, ' '), 'utf8');
  const bin = bytes.subarray(20 + jsonLength);
  const rebuilt = Buffer.alloc(20 + encoded.length + bin.length);
  bytes.copy(rebuilt, 0, 0, 12);
  rebuilt.writeUInt32LE(rebuilt.length, 8);
  rebuilt.writeUInt32LE(encoded.length, 12);
  rebuilt.writeUInt32LE(0x4e4f534a, 16);
  encoded.copy(rebuilt, 20);
  bin.copy(rebuilt, 20 + encoded.length);
  const gltf = await new GLTFLoader().parseAsync(
    rebuilt.buffer.slice(rebuilt.byteOffset, rebuilt.byteOffset + rebuilt.byteLength),
    '',
  );
  return { gltf, json };
}

async function loadMotionOnlyFromDisk(url: string): Promise<{ scene: GLTF['scene']; animations: GLTF['animations'] }> {
  const bytes = readFileSync(resolve(ROOT, 'public', url.slice(1)));
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    '',
  );
  return { scene: gltf.scene, animations: gltf.animations };
}

afterEach(() => {
  clearGhostMotionCaches();
  setGhostDevForceActive(false, false);
});

test('bundled ghost character GLB and 7 extracted motion GLBs are valid, compatible, and duplicate-free', async () => {
  const { gltf: modelGltf } = await parseGlbStripTextures('public/models/ghost-woman.glb');
  let skinnedCount = 0;
  modelGltf.scene.traverse((obj) => {
    if ((obj as { isSkinnedMesh?: boolean }).isSkinnedMesh) skinnedCount++;
  });
  assert.equal(skinnedCount, 1, 'Ghost model contains single SkinnedMesh');
  assert.equal(modelGltf.animations.length, 0, 'Ghost model carries zero bundled duplicate clips');

  // Ghost rendered height is scaled ~1x larger (+100%, 2x) than Boy (1.80m) and Girl (1.692m)
  const { gltf: boyGltf } = await parseGlbStripTextures('src/assets/boy.glb');
  const boyBox = new Box3().setFromObject(boyGltf.scene);
  const ghostBox = new Box3().setFromObject(modelGltf.scene);
  const boyRenderedH = (boyBox.max.y - boyBox.min.y) * (1.8 / Math.max(0.05, boyBox.max.y - boyBox.min.y));
  const ghostRenderedH =
    (ghostBox.max.y - ghostBox.min.y) * (GHOST_TARGET_HEIGHT_M / Math.max(0.05, ghostBox.max.y - ghostBox.min.y));
  assert.equal(GHOST_TARGET_HEIGHT_M, 3.6);
  assert.ok(Math.abs(ghostRenderedH / boyRenderedH - 2.0) < 0.02, 'Ghost renders at 2x Boy height');

  const compat = validateGhostRigCompatibility(modelGltf.scene);
  assert.equal(compat.compatible, true, `Ghost rig compatible (missing: ${compat.missingCoreJoints.join(',')})`);

  let fetchCount = 0;
  const loaderFn = async (url: string) => {
    fetchCount++;
    return loadMotionOnlyFromDisk(url);
  };

  for (const id of ALL_GHOST_CLIP_IDS) {
    const spec = GHOST_CLIP_SPECS[id];
    const bytes = readFileSync(resolve(ROOT, 'public', spec.assetUrl.slice(1)));
    const jsonLen = bytes.readUInt32LE(12);
    const json = JSON.parse(bytes.subarray(20, 20 + jsonLen).toString('utf8')) as Record<string, unknown>;
    assert.equal(json.meshes, undefined, `${id} motion GLB strips meshes`);
    assert.equal(json.images, undefined, `${id} motion GLB strips duplicate textures`);
    assert.equal(json.materials, undefined, `${id} motion GLB strips materials`);
    assert.equal(json.skins, undefined, `${id} motion GLB strips skins`);

    const clip = await loadGhostRetargetedClip(id, modelGltf.scene, { loaderFn });
    assert.ok(clip.tracks.length > 0, `${id} retargeted clip has animation tracks`);
    assert.ok(Math.abs(clip.duration - spec.durationSec) < 0.05, `${id} preserves expected duration`);
  }

  assert.equal(fetchCount, ALL_GHOST_CLIP_IDS.length);
  assert.equal(getGhostMotionCacheCounts().rawCount, 7);
  assert.equal(getGhostMotionCacheCounts().clipCount, 7);

  // Repeat load hits cache (no extra fetch)
  await loadGhostRetargetedClip('freaky', modelGltf.scene, { loaderFn });
  assert.equal(fetchCount, ALL_GHOST_CLIP_IDS.length);

  // Single AnimationMixer + AnimationController drives retargeted clips cleanly without NaN bone positions
  const rigged = clone(modelGltf.scene);
  const mixer = new AnimationMixer(rigged);
  const controller = new AnimationController(mixer, rigged);
  for (const id of ['depressed', 'freaky', 'flee_01', 'fall'] as GhostClipId[]) {
    const clip = await loadGhostRetargetedClip(id, rigged, { loaderFn });
    controller.play(clip, { loop: GHOST_CLIP_SPECS[id].defaultLoop, crossFadeSec: 0.2 });
    controller.stepBlend(false, false, 0.25);
    mixer.update(0.25);
    rigged.updateMatrixWorld(true);
    const head = rigged.getObjectByName('mixamorigHead') ?? rigged.getObjectByName('mixamorig:Head');
    assert.ok(head, 'Head bone found');
    const wp = head.getWorldPosition(new Vector3());
    assert.ok(Number.isFinite(wp.x) && Number.isFinite(wp.y) && Number.isFinite(wp.z));
  }
  controller.dispose();
});

test('isGhostNightActive enforces 18:00-05:00 schedule plus manual night and dev force overrides', () => {
  // Daytime bounds outside [18:00, 05:00)
  assert.equal(isGhostNightActive(300), false, '05:00 exact is inactive');
  assert.equal(isGhostNightActive(780), false, '13:00 day is inactive');
  assert.equal(isGhostNightActive(1079), false, '17:59 is inactive');

  // Nighttime bounds inside [18:00, 05:00)
  assert.equal(isGhostNightActive(1080), true, '18:00 exact is active');
  assert.equal(isGhostNightActive(1260), true, '21:00 night is active');
  assert.equal(isGhostNightActive(0), true, '00:00 midnight is active');
  assert.equal(isGhostNightActive(299), true, '04:59 is active');

  // Manual day/night override + dev override
  assert.equal(isGhostNightActive(780, { timeMode: 'night' }), true, 'Manual night activates ghost');
  assert.equal(isGhostNightActive(780, { timeMode: 'day' }), false, 'Manual day keeps ghost inactive');
  assert.equal(isGhostNightActive(780, { forceActive: true }), true, 'Dev override activates ghost during day');
});

test('warehouse waypoint graph aligns with Area 5 geometry, LOS wall blocking, and editor overrides', () => {
  const anchorUv = worldToWarehouseLocal(GHOST_WAREHOUSE_ANCHOR.x, GHOST_WAREHOUSE_ANCHOR.z);
  assert.ok(Math.abs(anchorUv.u - GHOST_WAREHOUSE_ANCHOR.localU) < 0.01);
  assert.ok(Math.abs(anchorUv.v - GHOST_WAREHOUSE_ANCHOR.localV) < 0.01);

  const env = buildDefaultWarehouseEnvironment();
  assert.ok(env.waypoints.length >= 20, 'Warehouse patrol graph built');
  assert.ok(env.hidingIds.length >= 8, 'Multiple warehouse/tree hiding nodes built');
  assert.ok(env.roadCrossings.length >= 2, 'Main road AH1 crossing pairs derived from scene data');

  for (const wp of env.waypoints) {
    assert.ok(isGhostPointWalkable(wp.x, wp.z), `Waypoint ${wp.id} is collision-clear`);
    assert.ok(wp.links.length >= 1, `Waypoint ${wp.id} is connected`);
    for (const dstId of wp.links) {
      const dst = env.waypointById.get(dstId);
      assert.ok(dst, `Link target ${dstId} exists`);
      assert.ok(
        isGhostSegmentWalkable(wp.x, wp.z, dst.x, dst.z),
        `Edge ${wp.id} -> ${dstId} does not pass through warehouse walls or trees`,
      );
    }
  }

  const pathAcross = findWaypointPath(env, 'hide-west-main-alley', 'hide-east-main-alley');
  assert.ok(pathAcross.includes('curb-west-main') && pathAcross.includes('curb-east-main'));

  // Warehouse building blocks line of sight between rear hiding alley and south-verge / south alley
  const rearAlley = env.waypointById.get('hide-west-rear-main')!;
  const westSouthVerge = env.waypointById.get('patrol-west-south-mouth')!;
  const westSouthAlley = env.waypointById.get('hide-west-south-alley')!;
  const westAlley = env.waypointById.get('hide-west-main-alley')!;
  assert.equal(
    hasWarehouseLineOfSight(rearAlley.x, rearAlley.z, westSouthVerge.x, westSouthVerge.z, env.obstacleBoxes),
    false,
    'Warehouse wall blocks LOS between rear alley and south verge',
  );
  assert.equal(
    hasWarehouseLineOfSight(westAlley.x, westAlley.z, westSouthAlley.x, westSouthAlley.z, env.obstacleBoxes),
    false,
    'Warehouse wall blocks LOS straight across the warehouse block',
  );
  // Open road across AH1 has clear LOS
  const westCurb = env.waypointById.get('curb-west-main')!;
  const eastCurb = env.waypointById.get('curb-east-main')!;
  assert.equal(
    hasWarehouseLineOfSight(westCurb.x, westCurb.z, eastCurb.x, eastCurb.z, env.obstacleBoxes),
    true,
    'Open road segment across AH1 has clear LOS',
  );

  // Editor custom override payload
  const customEnv = loadGhostWarehouseEnvironment({
    waypoints: [
      { id: 'custom-a', role: 'hiding', x: 32, z: 43, localU: -7.8, localV: 53, links: ['custom-b'] },
      { id: 'custom-b', role: 'patrol', x: 43, z: 32, localU: 7.8, localV: 53, links: ['custom-a'] },
    ],
  });
  assert.equal(customEnv.waypoints.length, 2);
  assert.equal(customEnv.hidingIds[0], 'custom-a');
});

test('GhostAiController transitions deterministically across spawn, hide, observe, scare, flee, cooldown, road crossing, and despawn', () => {
  const env = buildDefaultWarehouseEnvironment();
  const ai = new GhostAiController(env, {
    ...DEFAULT_GHOST_AI_CONFIG,
    spawnDurationSec: 0.4,
    despawnDurationSec: 0.4,
    hideDurationRangeSec: [1.0, 1.2],
    observeDurationRangeSec: [0.8, 0.9],
    scareDurationSec: 0.7,
    laughDurationSec: 0.6,
    scareFollowupLaughChance: 1.0,
    fleeDurationSec: 1.5,
    fallTriggerChance: 0,
    cooldownDurationSec: 5.0,
    roadCrossCooldownRangeSec: [2.0, 2.5],
  });

  // 1. Remains DORMANT during day
  let snap = ai.step({
    dt: 0.05,
    activeBySchedule: false,
    playerX: GHOST_WAREHOUSE_ANCHOR.x,
    playerZ: GHOST_WAREHOUSE_ANCHOR.z,
  });
  assert.equal(snap.state, 'DORMANT');
  assert.equal(snap.visible, false);

  // 2. Spawns into cover (away from direct player pop) when night active & within Warehouse zone
  const approachX = GHOST_WAREHOUSE_ANCHOR.x + 22;
  const approachZ = GHOST_WAREHOUSE_ANCHOR.z + 22;
  for (let i = 0; i < 12; i++) {
    snap = ai.step({
      dt: 0.05,
      activeBySchedule: true,
      playerX: approachX,
      playerZ: approachZ,
    });
  }
  assert.equal(snap.state, 'HIDING');
  assert.equal(snap.visible, true);
  assert.ok(snap.distToPlayerM >= DEFAULT_GHOST_AI_CONFIG.minSpawnPlayerClearanceM - 0.5);

  // 3. Player separated by warehouse wall (no LOS): ghost must stay hidden / not jump to SCARING
  const westAlley = env.waypointById.get('hide-west-main-alley')!;
  const westSouthAlley = env.waypointById.get('hide-west-south-alley')!;
  (ai as unknown as { x: number; z: number }).x = westAlley.x;
  (ai as unknown as { x: number; z: number }).z = westAlley.z;
  ai.forceStateForTest('HIDING');
  const blockedSnap = ai.step({
    dt: 0.05,
    activeBySchedule: true,
    playerX: westSouthAlley.x,
    playerZ: westSouthAlley.z,
  });
  assert.equal(blockedSnap.hasLineOfSight, false, 'Warehouse block obstructs LOS');
  assert.notEqual(blockedSnap.state, 'SCARING');

  // 4. First valid encounter (1 < chaseThreshold >= 2): reacts with flee-scare audio + flees to hiding without chasing
  const westCurb = env.waypointById.get('curb-west-main')!;
  const eastCurbMain = env.waypointById.get('curb-east-main')!;
  const playerOpenX = (westCurb.x + eastCurbMain.x) * 0.5;
  const playerOpenZ = (westCurb.z + eastCurbMain.z) * 0.5;
  assert.ok(Math.hypot(playerOpenX - westCurb.x, playerOpenZ - westCurb.z) > 6);

  // Place ghost cleanly on curb-west-main for deterministic LOS interaction
  (ai as unknown as { x: number; z: number }).x = westCurb.x;
  (ai as unknown as { x: number; z: number }).z = westCurb.z;
  ai.forceStateForTest('HIDING');

  const seenStates = new Set<string>();
  const seenClips = new Set<string>();
  const seenCues = new Set<string>();
  for (let i = 0; i < 120; i++) {
    snap = ai.step({
      dt: 0.05,
      activeBySchedule: true,
      playerX: playerOpenX,
      playerZ: playerOpenZ,
    });
    seenStates.add(snap.state);
    seenClips.add(snap.activeClip.clipId);
    if (snap.audioCue) seenCues.add(snap.audioCue.cue);
  }

  assert.equal(snap.encounterCount, 1, 'Stationary player inside zone increments encounterCount once');
  assert.ok(snap.chaseThreshold >= 2 && snap.chaseThreshold <= 6, 'Threshold stays within 2..6');
  assert.ok(seenStates.has('FLEEING'), 'Early encounter flees to hiding');
  assert.ok(seenCues.has('flee-scare'), 'Early encounter emits procedural flee-scare audio cue');
  assert.ok(seenClips.has('flee_01') || seenClips.has('flee_02'), 'Flee clip played while escaping');
  assert.equal(snap.chaseTriggerCount, 0, 'First encounter does not trigger threshold chase');

  // 5. Road Crossing with incoming vehicle wait + alignment check
  (ai as unknown as { x: number; z: number }).x = westCurb.x;
  (ai as unknown as { x: number; z: number }).z = westCurb.z;
  ai.forceStateForTest('ROAD_CROSSING');
  // Blocking car positioned right on AH1 approaching curb-west-main
  const car: GhostTrafficSample = {
    x: playerOpenX - 2,
    z: playerOpenZ - 2,
    yaw: -Math.PI * 0.75,
    halfWidth: 1.0,
    halfDepth: 2.0,
  };
  for (let i = 0; i < 6; i++) {
    snap = ai.step({
      dt: 0.05,
      activeBySchedule: true,
      playerX: GHOST_WAREHOUSE_ANCHOR.x + 80,
      playerZ: GHOST_WAREHOUSE_ANCHOR.z + 80,
      traffic: [car],
    });
  }
  assert.equal(snap.crossingCount, 0, 'Ghost waited at curb while incoming car occupied safety zone');

  // Car clears road: ghost starts crossing with flee_01 or flee_02 and aligned facing yaw
  const crossedStartX = snap.x;
  const crossedStartZ = snap.z;
  for (let i = 0; i < 40; i++) {
    snap = ai.step({
      dt: 0.05,
      activeBySchedule: true,
      playerX: GHOST_WAREHOUSE_ANCHOR.x + 80,
      playerZ: GHOST_WAREHOUSE_ANCHOR.z + 80,
      traffic: [],
    });
  }
  assert.ok(snap.crossingCount >= 1, 'Ghost crossed once road cleared');
  assert.ok(Math.hypot(snap.x - crossedStartX, snap.z - crossedStartZ) > 3, 'Ghost physically crossed AH1');

  // 6. Schedule turns off -> DESPAWNING -> DORMANT
  for (let i = 0; i < 20; i++) {
    snap = ai.step({
      dt: 0.05,
      activeBySchedule: false,
      playerX: GHOST_WAREHOUSE_ANCHOR.x,
      playerZ: GHOST_WAREHOUSE_ANCHOR.z,
    });
  }
  assert.equal(snap.state, 'DORMANT');
  assert.equal(snap.visible, false);
  assert.equal(snap.opacity, 0);
});

test('rollGhostChaseThreshold covers 2..6 inclusive and persists unchanged during an active cycle', () => {
  const rngInputs = [0, 0.199, 0.2, 0.399, 0.4, 0.599, 0.6, 0.799, 0.8, 0.9999];
  const rolled = rngInputs.map((v) => rollGhostChaseThreshold(() => v));
  assert.deepEqual(rolled, [2, 2, 3, 3, 4, 4, 5, 5, 6, 6]);

  for (let i = 0; i < 200; i++) {
    const val = rollGhostChaseThreshold();
    assert.ok(Number.isInteger(val) && val >= 2 && val <= 6);
  }

  // Ensure RNG is queried only once on initialization and not on repeated ticks / proximity checks
  let rngCalls = 0;
  const env = buildDefaultWarehouseEnvironment();
  const ai = new GhostAiController(env, DEFAULT_GHOST_AI_CONFIG, 42, () => {
    rngCalls++;
    return 0.65; // threshold 5
  });
  assert.equal(rngCalls, 1, 'Threshold rolled once on controller creation');

  const cur = ai.getSnapshot();
  assert.equal(cur.chaseThreshold, 5);

  const farX = GHOST_WAREHOUSE_ANCHOR.x + 80;
  const farZ = GHOST_WAREHOUSE_ANCHOR.z + 80;
  for (let i = 0; i < 50; i++) {
    const next = ai.step({
      dt: 0.05,
      activeBySchedule: true,
      playerX: farX,
      playerZ: farZ,
    });
    assert.equal(next.chaseThreshold, 5, 'Threshold must stay constant across ticks');
  }
  assert.equal(rngCalls, 1, 'No extra RNG threshold rolls occur mid-cycle');
});

test('Ghost encounter escalation works for thresholds 2..6 with hysteresis, chase, neck-grab, fall, recovery, and reset', () => {
  const env = buildDefaultWarehouseEnvironment();
  clearGhostEncounterInteraction();

  // Map exact threshold [2..6] -> deterministic unit float input for Math.floor(r * 5) + 2
  const rngValueFor = (threshold: number): number => (threshold - 2 + 0.35) / 5;

  for (const targetThreshold of [2, 3, 4, 5, 6]) {
    const nextCycleThreshold = targetThreshold === 6 ? 2 : targetThreshold + 1;
    const rngSeq = [rngValueFor(targetThreshold), rngValueFor(nextCycleThreshold), 0.5];
    let rngIndex = 0;

    const ai = new GhostAiController(
      env,
      {
        ...DEFAULT_GHOST_AI_CONFIG,
        spawnDurationSec: 0.25,
        despawnDurationSec: 0.25,
        hideDurationRangeSec: [0.5, 0.6],
        observeDurationRangeSec: [0.3, 0.4],
        scareDurationSec: 0.35,
        laughDurationSec: 0.35,
        scareFollowupLaughChance: 1.0,
        fleeDurationSec: 0.7,
        returnSpeedMps: 6.5,
        cooldownDurationSec: 0.6,
        encounterCooldownSec: 0.6,
        encounterEntryRadiusM: 14,
        encounterExitRadiusM: 22,
        chaseSpeedMps: 8.5,
        grabRangeM: 2.3,
        grabHoldDurationSec: 0.3,
        playerFallDurationSec: 0.45,
        recoverDurationSec: 0.35,
      },
      100 + targetThreshold,
      () => rngSeq[Math.min(rngIndex++, rngSeq.length - 1)],
    );

    const westCurb = env.waypointById.get('curb-west-main')!;
    // Outside encounterExitRadiusM (22m) of every warehouse node, yet well inside AI active district zone
    const farX = GHOST_WAREHOUSE_ANCHOR.x + 35;
    const farZ = GHOST_WAREHOUSE_ANCHOR.z + 35;

    // Spawn at night while player is in Warehouse district (> exit radius)
    let snap = ai.getSnapshot();
    for (let i = 0; i < 20; i++) {
      snap = ai.step({
        dt: 0.05,
        activeBySchedule: true,
        playerX: farX,
        playerZ: farZ,
      });
    }
    assert.equal(snap.chaseThreshold, targetThreshold, `Cycle starts with threshold=${targetThreshold}`);
    assert.equal(rngIndex, 1, 'Threshold rolled once at cycle start');

    let lastAudioSeq = snap.audioCue?.seq ?? 0;
    const collectAudioCue = (cues: string[], s: typeof snap) => {
      if (s.audioCue && s.audioCue.seq > lastAudioSeq) {
        lastAudioSeq = s.audioCue.seq;
        cues.push(s.audioCue.cue);
      }
    };

    // Perform encounters 1 .. targetThreshold - 1 (flee & hide)
    for (let enc = 1; enc < targetThreshold; enc++) {
      // Exit zone cleanly and wait until previous encounter + cooldown complete and zone re-arms
      for (let i = 0; i < 300; i++) {
        snap = ai.step({ dt: 0.05, activeBySchedule: true, playerX: farX, playerZ: farZ });
        if (
          !snap.playerInsideEncounterZone &&
          (snap.state === 'HIDING' || snap.state === 'WANDERING' || snap.state === 'OBSERVING_PLAYER')
        ) {
          break;
        }
      }
      assert.equal(snap.playerInsideEncounterZone, false, 'Player exited zone cleanly after cooldown');

      const internal = ai as unknown as { x: number; z: number };
      internal.x = westCurb.x;
      internal.z = westCurb.z;
      ai.forceStateForTest('HIDING');

      const encStates = new Set<string>();
      const encClips = new Set<string>();
      const encCues: string[] = [];

      // Approach within encounterEntryRadiusM (10m away) and stay inside gap (17m < exitRadiusM 22m)
      for (let i = 0; i < 45; i++) {
        const curSnap = ai.getSnapshot();
        const distOffset = i < 20 ? 8 : 17; // stays inside exitRadiusM=22 after stepping back slightly
        snap = ai.step({
          dt: 0.05,
          activeBySchedule: true,
          playerX: curSnap.x + distOffset,
          playerZ: curSnap.z,
        });
        encStates.add(snap.state);
        encClips.add(snap.activeClip.clipId);
        collectAudioCue(encCues, snap);
      }

      assert.equal(
        snap.encounterCount,
        enc,
        `Threshold ${targetThreshold}: encounter ${enc} incremented exactly once without hysteresis bypass`,
      );
      assert.equal(snap.chaseThreshold, targetThreshold, 'Threshold unchanged mid-cycle');
      assert.ok(encStates.has('FLEEING'), `Encounter ${enc} triggered FLEEING`);
      assert.ok(encCues.includes('flee-scare'), `Encounter ${enc} emitted flee-scare procedural audio cue`);
      assert.ok(
        encClips.has('flee_01') || encClips.has('flee_02'),
        `Encounter ${enc} played flee animation while escaping`,
      );
      assert.equal(snap.chaseTriggerCount, 0, 'Pre-threshold encounter must not trigger chase');
      assert.equal(snap.grabCount, 0, 'Pre-threshold encounter must not grab player');
    }

    // Leave proximity beyond exit radius and wait until flee/return/cooldown ends before threshold encounter
    for (let i = 0; i < 300; i++) {
      snap = ai.step({ dt: 0.05, activeBySchedule: true, playerX: farX, playerZ: farZ });
      if (
        !snap.playerInsideEncounterZone &&
        (snap.state === 'HIDING' || snap.state === 'WANDERING' || snap.state === 'OBSERVING_PLAYER')
      ) {
        break;
      }
    }
    assert.equal(snap.playerInsideEncounterZone, false, 'Zone re-armed after exiting past exitRadiusM');

    // Final encounter === targetThreshold: confront -> chase -> grab -> fall -> recover -> cooldown -> cycle reset
    const eastCurb = env.waypointById.get('curb-east-main')!;
    (ai as unknown as { x: number; z: number }).x = westCurb.x;
    (ai as unknown as { x: number; z: number }).z = westCurb.z;
    ai.forceStateForTest('HIDING');

    const finalStates: string[] = [];
    const finalClips: string[] = [];
    const finalCues: string[] = [];
    const grabPhases: string[] = [];

    // Approach at clear open road spot 8m east so SCARING completes into CHASING, then hold player near ghost to allow catch/grab/fall/recover/reset
    let px = (westCurb.x + eastCurb.x) * 0.5;
    let pz = (westCurb.z + eastCurb.z) * 0.5;
    for (let i = 0; i < 160; i++) {
      snap = ai.step({
        dt: 0.05,
        activeBySchedule: true,
        playerX: px,
        playerZ: pz,
      });
      setGhostEncounterInteraction(snap.grabInteraction);
      if (snap.grabInteraction.active) {
        assert.equal(getGhostEncounterInteraction().phase, snap.grabInteraction.phase);
      }
      if (finalStates[finalStates.length - 1] !== snap.state) finalStates.push(snap.state);
      if (finalClips[finalClips.length - 1] !== snap.activeClip.clipId) finalClips.push(snap.activeClip.clipId);
      collectAudioCue(finalCues, snap);
      if (snap.grabInteraction.active && grabPhases[grabPhases.length - 1] !== snap.grabInteraction.phase) {
        grabPhases.push(snap.grabInteraction.phase);
      }
      // Once recovery/cooldown completes and cycle resets (encounterCount resets to 0), stop early once we observed reset
      if (snap.encounterCycleCount >= 1 && snap.state === 'HIDING') {
        break;
      }
      // Keep player reachable on open road during SCARING/CHASING so catch reliably triggers
      if (snap.state === 'SCARING' || snap.state === 'CHASING') {
        assert.equal(
          snap.encounterCount,
          targetThreshold,
          'No duplicate encounter increment during SCARING or CHASING',
        );
      }
      if (snap.state === 'GRABBING' || snap.state === 'RECOVERING') {
        assert.equal(
          snap.encounterCount,
          targetThreshold,
          'No duplicate encounter increment during GRABBING or RECOVERING',
        );
      }
    }
    clearGhostEncounterInteraction();
    assert.equal(getGhostEncounterInteraction().active, false);

    assert.ok(finalStates.includes('SCARING'), `Threshold ${targetThreshold}: entered SCARING`);
    assert.ok(finalStates.includes('CHASING'), `Threshold ${targetThreshold}: entered CHASING`);
    assert.ok(finalStates.includes('GRABBING'), `Threshold ${targetThreshold}: caught player into GRABBING`);
    assert.ok(finalStates.includes('RECOVERING'), `Threshold ${targetThreshold}: entered RECOVERING`);
    assert.ok(finalStates.includes('COOLDOWN'), `Threshold ${targetThreshold}: entered COOLDOWN`);

    assert.ok(finalClips.includes('freaky'), `Threshold ${targetThreshold}: played freaky.001`);
    assert.ok(finalClips.includes('laugh_01'), `Threshold ${targetThreshold}: played laugh_01.001`);
    assert.ok(
      finalClips.includes('flee_01') || finalClips.includes('flee_02'),
      `Threshold ${targetThreshold}: chased with flee animation`,
    );

    assert.ok(finalCues.includes('scream'), `Threshold ${targetThreshold}: synthesized scream cue`);
    assert.ok(finalCues.includes('evil-laugh'), `Threshold ${targetThreshold}: synthesized evil-laugh cue`);
    assert.ok(finalCues.includes('grab-impact'), `Threshold ${targetThreshold}: synthesized grab-impact cue`);

    assert.deepEqual(
      grabPhases,
      ['neck-grab', 'player-fall'],
      `Threshold ${targetThreshold}: ran neck-grab then player-fall sequence`,
    );
    assert.equal(snap.chaseTriggerCount, 1);
    assert.equal(snap.grabCount, 1);
    assert.ok(snap.encounterCycleCount >= 1, 'Completed encounter cycle');
    assert.equal(snap.encounterCount, 0, 'Encounter count reset for next cycle');
    assert.equal(
      snap.chaseThreshold,
      nextCycleThreshold,
      'Next cycle generated a fresh threshold in 2..6 after reset',
    );
  }
});

test('all 8 haunt zones build connected, obstacle-clear waypoint graphs across myothar', () => {
  assert.equal(GHOST_HAUNT_ZONE_IDS.length, 8);
  const zones = listGhostHauntZones();
  assert.equal(zones.length, 8);

  for (const zoneId of GHOST_HAUNT_ZONE_IDS) {
    const env = buildGhostHauntEnvironment(zoneId);
    assert.ok(env.waypoints.length >= 8, `Zone ${zoneId} has >= 8 waypoints`);
    assert.ok(env.hidingIds.length >= 4, `Zone ${zoneId} has >= 4 hiding waypoints`);
    assert.ok(env.patrolIds.length >= 4, `Zone ${zoneId} has >= 4 patrol waypoints`);

    const startId = env.waypoints[0].id;
    for (const wp of env.waypoints) {
      assert.ok(isGhostPointWalkable(wp.x, wp.z), `${zoneId} waypoint ${wp.id} is obstacle-clear`);
      assert.ok(wp.links.length >= 1, `${zoneId} waypoint ${wp.id} has links`);
      for (const dstId of wp.links) {
        const dst = env.waypointById.get(dstId);
        assert.ok(dst, `${zoneId} link target ${dstId} exists`);
        assert.ok(
          isGhostSegmentWalkable(wp.x, wp.z, dst.x, dst.z),
          `${zoneId} edge ${wp.id} -> ${dstId} avoids buildings, trees, and cemetery walls`,
        );
      }
      const path = findWaypointPath(env, startId, wp.id);
      assert.ok(path.length > 0, `${zoneId} waypoint ${wp.id} is reachable from ${startId}`);
    }
  }
});

test('selectRandomGhostZones distributes 3 ghosts cleanly and non-warehouse anchors run independently', () => {
  assert.equal(DEFAULT_GHOST_COUNT, 3);
  const zones = listGhostHauntZones();
  const anchorById = new Map(zones.map((z) => [z.zoneId, z.anchor]));

  const makeRng = (seedStart: number) => {
    let s = seedStart >>> 0;
    return () => {
      s = (1664525 * s + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  };

  const pickA = selectRandomGhostZones(DEFAULT_GHOST_COUNT, makeRng(17));
  const pickB = selectRandomGhostZones(DEFAULT_GHOST_COUNT, makeRng(9941));
  assert.equal(pickA.length, 3);
  assert.equal(new Set(pickA).size, 3, 'Picked zones are unique');
  assert.equal(pickB.length, 3);
  assert.equal(new Set(pickB).size, 3);
  assert.notDeepEqual(pickA, pickB, 'Different RNG seeds vary randomized haunt locations');

  for (let i = 0; i < pickA.length; i++) {
    for (let j = i + 1; j < pickA.length; j++) {
      const a = anchorById.get(pickA[i])!;
      const b = anchorById.get(pickA[j])!;
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      assert.ok(
        dist >= GHOST_MIN_ZONE_SEPARATION_M,
        `${pickA[i]} and ${pickA[j]} separation ${dist.toFixed(1)}m >= ${GHOST_MIN_ZONE_SEPARATION_M}m`,
      );
    }
  }

  // Spawn 3 independent controllers in distinct non-warehouse zones
  const targetZones = ['myothar-cemetery', 'shwe-myanmar-north', 'west-residential-lanes'] as const;
  for (let idx = 0; idx < targetZones.length; idx++) {
    const zoneId = targetZones[idx];
    const env = buildGhostHauntEnvironment(zoneId);
    const ai = new GhostAiController(
      env,
      {
        ...DEFAULT_GHOST_AI_CONFIG,
        spawnDurationSec: 0.3,
        hideDurationRangeSec: [0.6, 0.8],
      },
      1000 + idx * 77,
    );
    const playerX = env.anchor.x + 28;
    const playerZ = env.anchor.z + 28;
    let snap = ai.getSnapshot();
    for (let stepIdx = 0; stepIdx < 12; stepIdx++) {
      snap = ai.step({
        dt: 0.05,
        activeBySchedule: true,
        playerX,
        playerZ,
      });
    }
    assert.equal(snap.state, 'HIDING', `${zoneId} ghost spawns and settles into HIDING`);
    assert.equal(snap.visible, true);
    const distFromZoneAnchor = Math.hypot(snap.x - env.anchor.x, snap.z - env.anchor.z);
    const distFromWarehouse = Math.hypot(
      snap.x - GHOST_WAREHOUSE_ANCHOR.x,
      snap.z - GHOST_WAREHOUSE_ANCHOR.z,
    );
    assert.ok(distFromZoneAnchor < 100, `${zoneId} stays centered on its own haunt anchor`);
    assert.ok(distFromWarehouse > 80, `${zoneId} did not snap back to Warehouse anchor`);
  }
});

test('multi-owner ghost grab interaction preserves active grab when idle ghosts publish state', () => {
  clearGhostEncounterInteraction();
  try {
    setGhostEncounterInteraction(
      {
        active: true,
        phase: 'neck-grab',
        seq: 4,
        ghostX: 60.3,
        ghostZ: -410.1,
        fallProgress: 0,
      },
      'ghost-1',
    );
    // Second idle ghost updating every frame must NOT wipe ghost-1 active grab
    setGhostEncounterInteraction(
      {
        active: false,
        phase: 'none',
        seq: 0,
        ghostX: -176.7,
        ghostZ: -183.8,
        fallProgress: 0,
      },
      'ghost-2',
    );

    const activeView = getGhostEncounterInteraction();
    assert.equal(activeView.active, true);
    assert.equal(activeView.phase, 'neck-grab');
    assert.equal(activeView.ghostX, 60.3);
    assert.equal(isOtherGhostGrabbingPlayer('ghost-2'), true);
    assert.equal(isOtherGhostGrabbingPlayer('ghost-1'), false);

    // Clearing ghost-1 does not clear ghost-3 if ghost-3 is actively grabbing
    setGhostEncounterInteraction(
      {
        active: true,
        phase: 'player-fall',
        seq: 2,
        ghostX: 108.2,
        ghostZ: 139.3,
        fallProgress: 0.65,
      },
      'ghost-3',
    );
    clearGhostEncounterInteraction('ghost-1');
    const stillActive = getGhostEncounterInteraction();
    assert.equal(stillActive.active, true);
    assert.equal(stillActive.phase, 'player-fall');
    assert.equal(isOtherGhostGrabbingPlayer('ghost-1'), true);

    clearGhostEncounterInteraction('ghost-3');
    assert.equal(getGhostEncounterInteraction().active, false);
    assert.equal(isOtherGhostGrabbingPlayer('ghost-2'), false);
  } finally {
    clearGhostEncounterInteraction();
  }
});
