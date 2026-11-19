import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Vector3 } from 'three';
import { angle, farmhouse } from '../src/data/ward.ts';
import { nankaleinTeaShopData } from '../src/data/wards/kalayArea1/kalayArea1TeaShop.ts';
import { canStand } from '../src/game/collision.ts';
import {
  getAllChairSpots,
  findNearbyChair,
  stepChairSitting,
  sitOnChair,
  resetChairSitting,
  getChairSittingState,
  isChairSittingMotionId,
  computeSeatedAvatarY,
  resolveStandUpExitSpot,
  STAND_UP_TOTAL_DURATION_SEC,
} from '../src/game/chairSitting.ts';
import { getMotion } from '../src/animation/core/MotionRegistry.ts';

test('MotionRegistry has sitting-idle and sit-to-stand configured correctly', () => {
  const sitIdle = getMotion('sitting-idle');
  assert.ok(sitIdle, 'sitting-idle should be registered');
  assert.equal(sitIdle.category, 'interactions');
  assert.equal(sitIdle.defaultLoop, true);
  assert.equal(sitIdle.autoTriggeredOnly, true);
  assert.equal(sitIdle.assetUrl, '/motions/interactions/sitting-idle.glb');

  const sitStand = getMotion('sit-to-stand');
  assert.ok(sitStand, 'sit-to-stand should be registered');
  assert.equal(sitStand.category, 'interactions');
  assert.equal(sitStand.defaultLoop, false);
  assert.equal(sitStand.autoTriggeredOnly, true);
  assert.equal(sitStand.assetUrl, '/motions/interactions/sit-to-stand.glb');
});

test('isChairSittingMotionId identifies sitting motion IDs', () => {
  assert.equal(isChairSittingMotionId('sitting-idle'), true);
  assert.equal(isChairSittingMotionId('sit_idle'), true);
  assert.equal(isChairSittingMotionId('sit-to-stand'), true);
  assert.equal(isChairSittingMotionId('sit_stand'), true);
  assert.equal(isChairSittingMotionId('vehicle-wait'), false);
  assert.equal(isChairSittingMotionId('dance_01'), false);
});

test('Chair database matches Three.js world transforms and faces away from chair backrests', () => {
  const chairs = getAllChairSpots();
  assert.ok(chairs.length >= 60, `Expected at least 60 chairs, found ${chairs.length}`);

  const fhRot =
    angle + (farmhouse.x * Math.cos(angle) - farmhouse.z * Math.sin(angle) > 0 ? -Math.PI / 2 : Math.PI / 2);
  const fhGroup = new Group();
  fhGroup.position.set(farmhouse.x, 0, farmhouse.z);
  fhGroup.rotation.set(0, fhRot, 0);
  fhGroup.updateMatrixWorld(true);

  const farmhouseChecks: Array<[string, Vector3, Vector3, number]> = [
    ['farmhouse-dining-s-0', new Vector3(0, 0, -0.85), new Vector3(0, 0, -1.04), 0.485],
    ['farmhouse-dining-n-0', new Vector3(0, 0, 0.85), new Vector3(0, 0, 1.04), 0.485],
    ['farmhouse-sofa', new Vector3(2.6, 0, -2.56), new Vector3(2.6, 0, -2.02), 0.7],
    ['farmhouse-desk-chair', new Vector3(-3.12, 0, 2.2), new Vector3(-2.91, 0, 2.2), 0.52],
    ['farmhouse-kitchen-stool--0.7--1', new Vector3(9.8, 0, -1.0), new Vector3(9.8, 0, -1.5), 0.485],
  ];

  for (const [id, lSeat, lBack, expectedTopY] of farmhouseChecks) {
    const chair = chairs.find((c) => c.id === id);
    assert.ok(chair, `Chair ${id} should exist`);
    assert.equal(chair.seatTopY, expectedTopY);

    const wSeat = lSeat.clone().applyMatrix4(fhGroup.matrixWorld);
    const wBack = lBack.clone().applyMatrix4(fhGroup.matrixWorld);
    assert.ok(Math.hypot(chair.x - wSeat.x, chair.z - wSeat.z) < 1e-4, `${id} position mismatch`);

    // Avatar back points along (+sin(yaw), +cos(yaw)) and must align with vector from seat to backrest
    assert.ok(chair.yaw !== undefined);
    const backX = Math.sin(chair.yaw);
    const backZ = Math.cos(chair.yaw);
    const toBackX = wBack.x - wSeat.x;
    const toBackZ = wBack.z - wSeat.z;
    const dot = (backX * toBackX + backZ * toBackZ) / Math.hypot(toBackX, toBackZ);
    assert.ok(dot > 0.999, `${id} back should align with backrest (got dot=${dot})`);
  }

  // Tea shop stools match Three.js group transform and face inward toward table center
  const tsGroup = new Group();
  tsGroup.position.set(nankaleinTeaShopData.x, 0, nankaleinTeaShopData.z);
  tsGroup.rotation.set(0, nankaleinTeaShopData.rotation, 0);
  tsGroup.updateMatrixWorld(true);
  const t0 = nankaleinTeaShopData.tables[0];
  const s0 = chairs.find((c) => c.id === `tea-stool-${t0.id}-0`);
  assert.ok(s0, 'Tea shop stool 0 should exist');
  const wTable = new Vector3(t0.du, 0, t0.dv).applyMatrix4(tsGroup.matrixWorld);
  const wStool = new Vector3(t0.du + 0.95, 0, t0.dv).applyMatrix4(tsGroup.matrixWorld);
  assert.ok(Math.hypot(s0.x - wStool.x, s0.z - wStool.z) < 1e-4);
  const frontX = -Math.sin(s0.yaw!);
  const frontZ = -Math.cos(s0.yaw!);
  const toTableX = wTable.x - wStool.x;
  const toTableZ = wTable.z - wStool.z;
  const frontDot = (frontX * toTableX + frontZ * toTableZ) / Math.hypot(toTableX, toTableZ);
  assert.ok(frontDot > 0.999, `Tea stool should face inward toward table (got dot=${frontDot})`);
});

test('Seated avatar Y adapts precisely to every chair height and character preset/scale', () => {
  const chairs = getAllChairSpots();
  const dining = chairs.find((c) => c.id === 'farmhouse-dining-s-0')!;
  const sofa = chairs.find((c) => c.id === 'farmhouse-sofa')!;
  const bench = chairs.find((c) => c.id.startsWith('cemetery-bench'))!;

  // Boy butt underside is at +0.345 * bodyScale; Girl is at +0.295 * bodyScale
  assert.ok(Math.abs(computeSeatedAvatarY(dining, 0.18, 1.0, 'boy') + 0.345 - dining.seatTopY!) < 1e-5);
  assert.ok(Math.abs(computeSeatedAvatarY(sofa, 0.1845, 1.0, 'boy') + 0.345 - sofa.seatTopY!) < 1e-5);
  assert.ok(Math.abs(computeSeatedAvatarY(bench, 0.44, 1.1, 'girl') + 0.295 * 1.1 - bench.seatTopY!) < 1e-5);

  // Higher seat produces higher avatar Y
  assert.ok(
    computeSeatedAvatarY(sofa, 0.18, 1.0, 'boy') > computeSeatedAvatarY(dining, 0.18, 1.0, 'boy'),
    'Higher sofa seat must place character higher than lower dining chair',
  );
});

test('Every static chair resolves to a collision-free stand-up exit spot', () => {
  const chairs = getAllChairSpots();
  for (const chair of chairs) {
    const exit = resolveStandUpExitSpot(chair, null, canStand);
    assert.equal(canStand(exit.x, exit.z), true, `Chair ${chair.id} exit must be walkable`);
  }
});

test('findNearbyChair detects closest chair within radius', () => {
  const chairs = getAllChairSpots();
  const first = chairs[0];

  const found = findNearbyChair(first.x + 0.5, first.z + 0.3, 1.25);
  assert.ok(found, 'Should find nearby chair');
  assert.equal(found.id, first.id);

  const farAway = findNearbyChair(99999, 99999, 1.25);
  assert.equal(farAway, null, 'Should return null when no chair is near');
});

test('Chair proximity timer accumulates 2 seconds before sitting', () => {
  resetChairSitting();
  const chairs = getAllChairSpots();
  const chair = chairs[0];

  let s = stepChairSitting(0.5, {
    playerX: chair.x + 0.2,
    playerZ: chair.z + 0.2,
    playerMoving: false,
    canSit: true,
    canStand,
  });
  assert.equal(s.status, 'IDLE');
  assert.ok(Math.abs(s.nearTime - 0.5) < 1e-4);

  // Moving resets timer
  s = stepChairSitting(0.1, {
    playerX: chair.x + 0.2,
    playerZ: chair.z + 0.2,
    playerMoving: true,
    canSit: true,
    canStand,
  });
  assert.equal(s.nearTime, 0, 'Moving should reset nearTime');

  // 1.5s still not sitting
  stepChairSitting(1.5, {
    playerX: chair.x + 0.1,
    playerZ: chair.z + 0.1,
    playerMoving: false,
    canSit: true,
    canStand,
  });
  assert.equal(getChairSittingState().status, 'IDLE');

  // Total 2.1s >= 2.0s -> SITTING!
  s = stepChairSitting(0.6, {
    playerX: chair.x + 0.1,
    playerZ: chair.z + 0.1,
    playerMoving: false,
    canSit: true,
    canStand,
  });
  assert.equal(s.status, 'SITTING');
  assert.equal(s.activeChair?.id, chair.id);
  assert.equal(s.standBlend, 0);
  assert.ok(s.seatPos && Math.hypot(s.seatPos.x - chair.x, s.seatPos.z - chair.z) < 1e-5);
});

test('Standing up from dining chair plays Sit To Stand, glides to walkable exit spot, and does not trap player', () => {
  resetChairSitting();
  const dining = getAllChairSpots().find((c) => c.id === 'farmhouse-dining-s-0')!;
  assert.ok(dining);

  // Dining chair seat itself is inside table collider, while exit spot is walkable
  assert.equal(canStand(dining.x, dining.z), false);
  assert.equal(canStand(dining.exitX!, dining.exitZ!), true);

  sitOnChair(dining);
  assert.equal(getChairSittingState().status, 'SITTING');

  // Player presses move -> transitions to STANDING_UP
  let state = stepChairSitting(0.1, {
    playerX: dining.x,
    playerZ: dining.z,
    playerMoving: true,
    canSit: true,
    canStand,
  });
  assert.equal(state.status, 'STANDING_UP');
  assert.equal(state.standBlend, 0);

  // Mid-rise (~1.1s): standBlend is halfway and position glides toward exit
  state = stepChairSitting(1.0, {
    playerX: dining.x,
    playerZ: dining.z,
    playerMoving: false,
    canSit: true,
    canStand,
  });
  assert.equal(state.status, 'STANDING_UP');
  assert.ok(state.standBlend > 0.1 && state.standBlend < 0.9);

  // Finish stand-up -> transitions to IDLE and hands off guaranteed walkable exit spot
  state = stepChairSitting(STAND_UP_TOTAL_DURATION_SEC, {
    playerX: dining.x,
    playerZ: dining.z,
    playerMoving: false,
    canSit: true,
    canStand,
  });
  assert.equal(state.status, 'IDLE');
  assert.equal(state.activeChair, null);
  assert.ok(state.seatPos, 'Handoff frame should supply walkable exit position');
  assert.equal(canStand(state.seatPos.x, state.seatPos.z), true, 'Stand-up exit position must be walkable');
});
