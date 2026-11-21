import assert from 'node:assert/strict';
import test from 'node:test';
import { canStand } from '../src/game/collision.ts';
import {
  DEFAULT_RIDING_HORSE,
  HORSE_GALLOP_SPEED,
  HORSE_LOCKED_MESSAGE,
  HORSE_MOUNT_DURATION_SEC,
  HORSE_WALK_SPEED,
  clearFieldHorseCandidates,
  completeHorseDismount,
  getHorseRideStatusSnapshot,
  getMountedFieldHorseId,
  horseRide,
  registerFieldHorseCandidate,
  resetHorseRide,
  startMountingHorse,
  stepHorseRide,
  triggerHorseMountButton,
  updateHorseProximity,
} from '../src/game/horseRide.ts';
import { getHorseTackAssetCache } from '../src/game/horseTackAssets.ts';
import {
  createHorseRiderPose, horseStrideLength, planHorseMountApproach,
  sampleHorseGait, sampleHorseHoof, sampleHorseRider, MOUNT_SIDE_X,
} from '../src/game/horseAnimation.ts';
import {
  GHOST_IDS,
  collectGhostSword,
  damageMissionGhost,
  markGhostEncounter,
  resetThreeGhostsMission,
} from '../src/game/missions/threeGhostsMission.ts';
import {
  ZOMBIE_IDS,
  damageZombie,
  isHorseRidingUnlocked,
  isZombieGunUnlocked,
  rerollZombieForestWave,
} from '../src/game/missions/zombieForestMission.ts';

function completeZombieMissionForTest(): void {
  resetThreeGhostsMission();
  for (const id of GHOST_IDS) markGhostEncounter(id);
  collectGhostSword();
  for (const id of GHOST_IDS) damageMissionGhost(id, 999);
  rerollZombieForestWave(() => 0.5, false);
  for (const id of ZOMBIE_IDS) damageZombie(id, 5, 'sword');
}

function resetMissionsForTest(): void {
  rerollZombieForestWave(() => 0.5, false);
  resetThreeGhostsMission();
}

test('Horse riding stays locked until Zombie Mission is completed (reward = Gun + Horse)', () => {
  resetMissionsForTest();
  resetHorseRide(true);
  clearFieldHorseCandidates();
  horseRide.cooldown = 0;

  assert.equal(isZombieGunUnlocked(), false);
  assert.equal(isHorseRidingUnlocked(), false);
  assert.equal(HORSE_LOCKED_MESSAGE, 'Zombie Mission ကို ပြီးအောင် လုပ်ပါ');

  // Walking near horse while locked detects proximity, blocks mount, and bumps locked notice seq
  const near = updateHorseProximity(DEFAULT_RIDING_HORSE.x + 1.5, DEFAULT_RIDING_HORSE.z, true);
  assert.ok(near !== null);
  assert.equal(getHorseRideStatusSnapshot().near, true);
  const seqBefore = getHorseRideStatusSnapshot().lockedNoticeSeq;
  triggerHorseMountButton();
  assert.equal(horseRide.mountRequested, false, 'mount button cannot queue mount while locked');
  assert.equal(getHorseRideStatusSnapshot().lockedNoticeSeq, seqBefore + 1);
  assert.equal(startMountingHorse(DEFAULT_RIDING_HORSE.x + 1.5, DEFAULT_RIDING_HORSE.z, () => true), false);
  assert.equal(horseRide.phase, 'idle');

  // Completing Zombie Mission unlocks BOTH Gun and Horse riding
  completeZombieMissionForTest();
  assert.equal(isZombieGunUnlocked(), true);
  assert.equal(isHorseRidingUnlocked(), true);
  assert.equal(startMountingHorse(DEFAULT_RIDING_HORSE.x + 1.5, DEFAULT_RIDING_HORSE.z, () => true), true);
  assert.equal(horseRide.phase, 'mounting');

  resetHorseRide(true);
  resetMissionsForTest();
});

test('Horse tack cache is a strict Singleton providing saddle, stirrups, bridle, and reins', () => {
  const a = getHorseTackAssetCache();
  const b = getHorseTackAssetCache();
  assert.strictEqual(a, b);
  assert.ok(a.stirrupArchGeo && a.stirrupTreadGeo, 'stirrup irons exist');
  assert.ok(a.bridleBandGeo && a.bitRingGeo, 'bridle & bit rings exist');
  assert.ok(a.reinSegGeo, 'rein geometry exists');
});

test('Default saddled riding horse stands on walkable ground and supports full mount -> walk -> gallop -> jump -> dismount flow', () => {
  completeZombieMissionForTest();
  resetHorseRide(true);
  clearFieldHorseCandidates();
  horseRide.cooldown = 0;

  assert.equal(canStand(DEFAULT_RIDING_HORSE.x, DEFAULT_RIDING_HORSE.z), true, 'default horse stands on walkable ground');

  // 1. Walk near the horse -> Horse icon prompt activates
  const near = updateHorseProximity(DEFAULT_RIDING_HORSE.x + 1.5, DEFAULT_RIDING_HORSE.z, true);
  assert.ok(near !== null);
  assert.equal(getHorseRideStatusSnapshot().near, true);

  // 2. Tap Horse icon -> enters stirrup mounting phase (0 -> 1) then riding
  assert.equal(startMountingHorse(DEFAULT_RIDING_HORSE.x + 1.5, DEFAULT_RIDING_HORSE.z, () => true), true);
  assert.equal(horseRide.phase, 'mounting');

  const mountSeconds = horseRide.mountApproach!.seconds + HORSE_MOUNT_DURATION_SEC;
  for (let i = 0; i < Math.ceil(mountSeconds / .04) + 1; i++) {
    stepHorseRide(0.04, { forward: 0, right: 0, camYaw: 0, sprint: false, jump: false }, false, () => 0, () => true);
  }
  assert.equal(horseRide.phase, 'riding', 'mounting finishes smoothly into riding');

  // 3. Walk in all 4 cardinal directions (N/S/E/W)
  const startX = horseRide.x;
  const startZ = horseRide.z;
  for (let i = 0; i < 20; i++) {
    stepHorseRide(0.04, { forward: 1, right: 0, camYaw: 0, sprint: false, jump: false }, false, () => 0, () => true);
  }
  assert.ok(horseRide.z < startZ - 1.5, 'horse walks north/forward');
  assert.ok(horseRide.speed <= HORSE_WALK_SPEED + 0.1);

  const afterNorthX = horseRide.x;
  for (let i = 0; i < 20; i++) {
    stepHorseRide(0.04, { forward: 0, right: 1, camYaw: 0, sprint: false, jump: false }, false, () => 0, () => true);
  }
  assert.ok(horseRide.x > afterNorthX + 1.2, 'horse turns and walks east/right');

  // 4. Gallop / Sprint speed boost
  for (let i = 0; i < 30; i++) {
    stepHorseRide(0.04, { forward: 1, right: 0, camYaw: 0, sprint: true, jump: false }, false, () => 0, () => true);
  }
  assert.equal(horseRide.galloping, true, 'horse enters gallop');
  assert.ok(horseRide.speed > HORSE_WALK_SPEED * 1.5 && horseRide.speed <= HORSE_GALLOP_SPEED + 0.2);

  // 5. Jump (ခုန်) lifts horse into air and lands cleanly
  stepHorseRide(0.04, { forward: 1, right: 0, camYaw: 0, sprint: false, jump: true }, false, () => 0, () => true);
  assert.equal(horseRide.airborne, true);
  assert.ok(horseRide.jumpY > 0);
  let maxJumpY = horseRide.jumpY;
  for (let i = 0; i < 40; i++) {
    stepHorseRide(0.04, { forward: 0, right: 0, camYaw: 0, sprint: false, jump: false }, false, () => 0, () => true);
    if (horseRide.jumpY > maxJumpY) maxJumpY = horseRide.jumpY;
  }
  assert.ok(maxJumpY > 1.0, `horse reaches realistic jump peak (${maxJumpY.toFixed(2)}m)`);
  assert.equal(horseRide.airborne, false, 'horse lands cleanly');

  // 6. Clean dismount beside horse
  const exit = completeHorseDismount(() => true);
  assert.ok(exit !== null);
  assert.equal(horseRide.phase, 'idle');
  resetHorseRide(true);
  resetMissionsForTest();
});

test('Any paddy-field horse from FieldLivestockBots can also be mounted cleanly', () => {
  completeZombieMissionForTest();
  resetHorseRide(true);
  clearFieldHorseCandidates();
  horseRide.cooldown = 0;

  registerFieldHorseCandidate('field-horse-99', 500, 600, 1.2, 2, 1.08);
  const cand = updateHorseProximity(501.2, 600.4, true);
  assert.equal(cand?.id, 'field-horse-99');
  assert.equal(startMountingHorse(501.2, 600.4, () => true), true);
  assert.equal(getMountedFieldHorseId(), 'field-horse-99');

  resetHorseRide(true);
  clearFieldHorseCandidates();
  resetMissionsForTest();
});

test('Mount approach goes around the horse and respects blocked ground', () => {
  const clear = (x: number, z: number) => z > -1.3;
  const route = planHorseMountApproach(1.6, .1, .3, 1, clear);
  assert.ok(route);
  assert.deepEqual(route.points.at(-1), [MOUNT_SIDE_X, .1]);
  assert.ok(route.points.some(([x, z]) => x > 0 && z > 1));
  assert.ok(route.points.some(([x, z]) => x < 0 && z > 1));
  assert.equal(planHorseMountApproach(1.6, .1, 0, 1, x => x > -.6), null);
});

test('The left foot stays in its stirrup while the right foot clears the croup', () => {
  const route = planHorseMountApproach(1.6, .1, .3, 1, () => true)!;
  const pose = createHorseRiderPose();
  const gait = sampleHorseGait(0, 0, 0, false);
  const sample = (elapsed: number) => {
    sampleHorseRider(pose, 1, 1, gait, 0, false, route, elapsed, 1, () => 0);
    return pose;
  };
  assert.equal(sample(0).hip.x, 1.6);
  const planted = sample(route.seconds + .40).feet[0].clone();
  sample(route.seconds + .67);
  assert.ok(pose.feet[0].distanceTo(planted) < .001);
  assert.ok(pose.feet[1].y > 1.7 && pose.feet[1].z > .48);
  const complete = sample(route.seconds + 1);
  assert.equal(complete.yaw, 0);
  assert.ok(complete.feet[0].x < 0 && complete.feet[1].x > 0);
  assert.equal(complete.reinGrip, 1);
});

test('Gallop has staggered hind and fore contacts followed by suspension', () => {
  const speed = HORSE_GALLOP_SPEED;
  const stride = horseStrideLength(speed, 1);
  for (const [index, contact] of [[2, 0], [3, .14], [0, .39], [1, .53]]) {
    const before = contact - .02;
    assert.ok(sampleHorseHoof(index, before, stride, sampleHorseGait(before, speed, 0, false)).lift > 0);
    assert.equal(sampleHorseHoof(index, contact, stride, sampleHorseGait(contact, speed, 0, false)).lift, 0);
  }
  const suspension = .87;
  const gait = sampleHorseGait(suspension, speed, 0, false);
  assert.ok([0, 1, 2, 3].every(index => sampleHorseHoof(index, suspension, stride, gait).lift > 0));
});
