import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AnimationMixer,
  Group,
  Quaternion,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { canStand } from '../src/game/collision.ts';
import {
  ZOMBIE_ALL_CLIPS,
  ZOMBIE_AMBIENT_CLIPS,
  ZOMBIE_ATTACK_RANGE_M,
  ZOMBIE_COUNT,
  ZOMBIE_DEFEAT_CLIPS,
  ZOMBIE_IDS,
  ZOMBIE_STAND_ATTACK_DELAY_MAX_SEC,
  ZOMBIE_STAND_ATTACK_DELAY_MIN_SEC,
  ZOMBIE_TWO_HIT_MAX,
  ZOMBIE_TWO_HIT_MIN,
  activateKnifeGuard,
  applyZombieAttackToPlayer,
  clearKnifeGuard,
  createRandomZombieWave,
  damageZombie,
  getZombieForestProgress,
  isPointInZombieForest,
  prepareZombieDefeatClip,
  prepareZombieMotionClip,
  rerollZombieForestWave,
  stepZombieForestAi,
} from '../src/game/missions/zombieForestMission.ts';
import { requestSwordAttack } from '../src/game/combat/combatInput.ts';
import {
  completePlayerRespawn,
  getPlayerDeathState,
  requestPlayerRespawn,
  stepPlayerRespawnGrace,
} from '../src/game/playerDeath.ts';
import {
  isPlayerKnockbackActive,
  isPlayerKnockbackCameraActive,
  resetPlayerKnockback,
  stepPlayerKnockback,
} from '../src/game/combat/playerKnockback.ts';
import { rideLife } from '../src/game/rideLife.ts';
import {
  GHOST_IDS,
  GHOST_STATS,
  collectGhostSword,
  damageMissionGhost,
  getActiveMissionWeapon,
  getQuickToggleWeapon,
  getThreeGhostsProgress,
  hasCompletedThreeGhostsMission,
  markGhostEncounter,
  resetThreeGhostsMission,
  selectMissionWeapon,
  setZombieForestSwordActive,
  setZombieGunUnlockedState,
  toggleQuickWeapon,
} from '../src/game/missions/threeGhostsMission.ts';
import {
  createProceduralGunModel,
  findSwordHand,
  fitSupportHandToGun,
  gunGripRotation,
} from '../src/game/missions/gunAttachment.ts';
import {
  GUN_SHOOTING_MOTION_ID,
  gunEffects,
  registerCombatGun,
  requestGunShot,
  resolveGunAimTarget,
} from '../src/game/combat/gunCombatRuntime.ts';
import { getMotion } from '../src/animation/core/MotionRegistry.ts';
import {
  getSpecialActionState,
  stopSpecialAction,
} from '../src/animation/actions/SpecialActionManager.ts';
import {
  playerCombat,
  registerCombatTarget,
  registerCombatWeapon,
  sampleCombatBlade,
} from '../src/game/combat/combatRuntime.ts';

function makeSeededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function strippedGlb(path: string): ArrayBuffer {
  const bytes = readFileSync(path);
  const length = bytes.readUInt32LE(12);
  const j = JSON.parse(bytes.subarray(20, 20 + length).toString('utf8'));
  delete j.images;
  delete j.textures;
  delete j.materials;
  if (j.meshes) {
    for (const mesh of j.meshes) {
      for (const primitive of mesh.primitives) {
        delete primitive.material;
      }
    }
  }
  const json = Buffer.from(JSON.stringify(j));
  const pad = (4 - (json.length % 4)) % 4;
  const body = Buffer.concat([json, Buffer.alloc(pad, 32)]);
  const bin = bytes.subarray(20 + length);
  const out = Buffer.alloc(20 + body.length + bin.length);
  bytes.copy(out, 0, 0, 12);
  out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(body.length, 12);
  out.writeUInt32LE(0x4e4f534a, 16);
  body.copy(out, 20);
  bin.copy(out, 20 + body.length);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

test('spawns 13 random zombies in the 4 forest quadrants on walkable ground with non-repeating locations across runs', () => {
  const waveA = createRandomZombieWave(makeSeededRng(101));
  const waveB = createRandomZombieWave(makeSeededRng(202));

  assert.equal(waveA.zombies.length, ZOMBIE_COUNT);
  assert.equal(waveB.zombies.length, ZOMBIE_COUNT);

  const quadrantsSeen = new Set<string>();
  const clipsSeen = new Set<string>();

  for (const z of waveA.zombies) {
    quadrantsSeen.add(z.quadrant);
    clipsSeen.add(z.clip);
    assert.equal(isPointInZombieForest(z.x, z.z, 5), true, `${z.id} must be inside forest bounds`);
    assert.ok(Math.abs(z.u) >= 19, `${z.id} must stay clear of AH1 highway`);
    assert.ok(Math.abs(z.v - 658) >= 7.5, `${z.id} must stay clear of canal water`);
    assert.equal(canStand(z.x, z.z), true, `${z.id} must spawn on walkable ground`);
  }

  assert.equal(quadrantsSeen.size, 4, 'all 4 forest quadrants receive zombies');
  for (const ambient of ZOMBIE_AMBIENT_CLIPS) {
    assert.equal(clipsSeen.has(ambient), true, `ambient clip ${ambient} should be used`);
  }

  // Verify locations differ between runs
  const differed = waveA.zombies.filter(
    (z, idx) =>
      Math.hypot(z.x - waveB.zombies[idx].x, z.z - waveB.zombies[idx].z) > 1.5,
  );
  assert.ok(
    differed.length >= 10,
    `expected randomized positions across runs, got ${differed.length}/13 different`,
  );
});

test('assigns 4 to 8 zombies to die in 2 hits and the remainder in 3 hits (shorter lifetime than ghosts)', () => {
  const minGhostHp = Math.min(
    GHOST_STATS['ghost-1'].maxHp,
    GHOST_STATS['ghost-2'].maxHp,
    GHOST_STATS['ghost-3'].maxHp,
  );

  const seenTwoHitCounts = new Set<number>();
  for (let seed = 1; seed <= 45; seed++) {
    const wave = createRandomZombieWave(makeSeededRng(seed * 7919));
    const twoHitZombies = wave.zombies.filter(z => z.maxHits === 2);
    const threeHitZombies = wave.zombies.filter(z => z.maxHits === 3);

    assert.equal(twoHitZombies.length, wave.twoHitCount);
    assert.ok(
      wave.twoHitCount >= ZOMBIE_TWO_HIT_MIN &&
        wave.twoHitCount <= ZOMBIE_TWO_HIT_MAX,
      `twoHitCount ${wave.twoHitCount} must be in 4..8`,
    );
    assert.equal(twoHitZombies.length + threeHitZombies.length, ZOMBIE_COUNT);
    seenTwoHitCounts.add(wave.twoHitCount);

    for (const z of wave.zombies) {
      assert.ok(
        z.maxHp < minGhostHp,
        `zombie maxHp (${z.maxHp}) must be shorter than ghost maxHp (${minGhostHp})`,
      );
    }
  }
  assert.ok(seenTwoHitCounts.size >= 4, 'random 2-hit counts span across 4..8');
});

test('zombie.glb and attack, crawl, idle, scream motion GLBs load and bind cleanly with in-place root stabilization', async () => {
  const loader = new GLTFLoader();
  const zombieGltf = await loader.parseAsync(
    strippedGlb('public/models/enemies/zombie.glb'),
    '',
  );
  const hips = zombieGltf.scene.getObjectByName('mixamorigHips');
  assert.ok(hips, 'zombie.glb must contain mixamorigHips bone');

  const expectedDurations: Record<string, number> = {
    attack: 2.667,
    crawl: 5.167,
    scream: 2.833,
    idle: 4.367,
  };

  for (const clipId of ZOMBIE_ALL_CLIPS) {
    const motionGltf = await loader.parseAsync(
      strippedGlb(`public/motions/zombie/${clipId}.glb`),
      '',
    );
    const clip = prepareZombieMotionClip(motionGltf, clipId);
    assert.equal(clip.name, clipId);
    assert.ok(
      Math.abs(clip.duration - expectedDurations[clipId]) < 0.05,
      `${clipId} duration ${clip.duration} should match ${expectedDurations[clipId]}`,
    );

    const mixer = new AnimationMixer(zombieGltf.scene);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(clip.duration * 0.5);
    zombieGltf.scene.updateMatrixWorld(true);

    const worldPos = new Vector3();
    hips!.getWorldPosition(worldPos);
    assert.ok(Number.isFinite(worldPos.x) && Number.isFinite(worldPos.y) && Number.isFinite(worldPos.z));

    if (clipId === 'crawl') {
      assert.ok(worldPos.y < 0.45, `crawl clip should lower hips near ground, got y=${worldPos.y}`);
      assert.ok(Math.abs(worldPos.z) < 0.05, `crawl clip horizontal drift must be stabilized, got z=${worldPos.z}`);
    } else {
      assert.ok(worldPos.y > 0.65, `${clipId} clip should keep zombie upright, got y=${worldPos.y}`);
    }
    mixer.stopAllAction();
  }

  for (const defId of ZOMBIE_DEFEAT_CLIPS) {
    const defGltf = await loader.parseAsync(
      strippedGlb(`public/motions/reactions/${defId}.glb`),
      '',
    );
    const defClip = prepareZombieDefeatClip(defGltf, zombieGltf.scene, defId);
    assert.equal(defClip.name, defId);
    assert.ok(defClip.duration > 5.0);
    assert.ok(defClip.tracks.length >= 40);
  }
});

test('AI waits 3 to 6 random seconds after crawling up and rising before playing attack.glb, and cycles crawl/idle/scream at ambient range', () => {
  const rng = makeSeededRng(4242);
  const progress = rerollZombieForestWave(rng, false);
  const z0 = progress.zombies[0];

  // 1. Place player right next to z0 (within ZOMBIE_ATTACK_RANGE_M):
  // Immediately upon rising at close range, zombie must NOT attack for 3..6 random seconds.
  const firstStep = stepZombieForestAi(
    0.05,
    z0.x + 1.1,
    z0.z + 0.5,
    true,
    true,
    false,
    rng,
  );
  assert.equal(z0.standingNearPlayer, true);
  assert.notEqual(
    z0.clip,
    'attack',
    'zombie must not attack immediately upon standing up near the player',
  );
  assert.equal(firstStep.activeAttacks.includes(z0.id), false);
  assert.equal(firstStep.strikeZombieId, null);
  assert.equal(ZOMBIE_STAND_ATTACK_DELAY_MIN_SEC, 2.0);
  assert.equal(ZOMBIE_STAND_ATTACK_DELAY_MAX_SEC, 5.0);
  assert.ok(
    z0.standAttackDelay >= ZOMBIE_STAND_ATTACK_DELAY_MIN_SEC - 0.1 &&
      z0.standAttackDelay <= ZOMBIE_STAND_ATTACK_DELAY_MAX_SEC,
    `standAttackDelay (${z0.standAttackDelay}s) must be in 2..5s range`,
  );

  // Even after ~1.7 seconds of standing near the player (< 2.0s minimum), still no attack!
  for (let i = 0; i < 7; i++) {
    const waitStep = stepZombieForestAi(
      0.24,
      z0.x + 1.1,
      z0.z + 0.5,
      true,
      true,
      false,
      rng,
    );
    assert.notEqual(z0.clip, 'attack');
    assert.equal(waitStep.strikeZombieId, null);
  }

  // Advance remaining time up to 5s + 1.2s strike window -> transitions to attack.glb and strikes once
  let sawAttackClip = false;
  let struckBy: string | null = null;
  for (let i = 0; i < 24; i++) {
    const strikeStep = stepZombieForestAi(
      0.25,
      z0.x + 1.1,
      z0.z + 0.5,
      true,
      true,
      false,
      rng,
    );
    if (z0.clip === 'attack') sawAttackClip = true;
    if (strikeStep.strikeZombieId) struckBy = strikeStep.strikeZombieId;
  }
  assert.equal(sawAttackClip, true, 'zombie plays attack.glb after 2..5s stand-up delay expires');
  assert.equal(struckBy, z0.id);

  // 2. Move player far away -> zombie returns to cycling ambient clips ('idle' | 'crawl' | 'scream')
  const ambientSeen = new Set<string>();
  for (let i = 0; i < 25; i++) {
    stepZombieForestAi(0.25, -500, -500, true, true, false, rng);
    stepZombieForestAi(0.25, -500, -500, true, true, false, rng);
    for (const z of getZombieForestProgress().zombies) {
      assert.notEqual(z.clip, 'attack');
      ambientSeen.add(z.clip);
    }
  }
  assert.equal(ambientSeen.has('idle'), true);
  assert.equal(ambientSeen.has('crawl'), true);
  assert.equal(ambientSeen.has('scream'), true);
});

function completeGhostMissionForTest() {
  resetThreeGhostsMission();
  for (const id of GHOST_IDS) {
    markGhostEncounter(id);
  }
  collectGhostSword();
  for (const id of GHOST_IDS) {
    damageMissionGhost(id, GHOST_STATS[id].maxHp);
  }
  assert.equal(hasCompletedThreeGhostsMission(), true);
}

test('knife and zombie mission are locked until Ghost Mission is completed, and Gun is locked until Zombie Mission is completed', () => {
  resetThreeGhostsMission();
  const rng = makeSeededRng(1234);
  rerollZombieForestWave(rng, false);

  // 1. Before Ghost Mission is completed: no knife access, no zombie damage, no gun access
  assert.equal(hasCompletedThreeGhostsMission(), false);
  assert.equal(getActiveMissionWeapon(), null);
  assert.equal(selectMissionWeapon('ghost-sword'), false);
  assert.equal(selectMissionWeapon('zombie-gun'), false);
  setZombieForestSwordActive(true);
  assert.equal(getActiveMissionWeapon(), null, 'knife cannot be activated before Ghost Mission completion');
  setZombieGunUnlockedState(true, true);
  assert.equal(getActiveMissionWeapon(), null, 'gun cannot be unlocked before Ghost Mission completion');
  assert.equal(
    damageZombie('zombie-1', 1, 'sword'),
    null,
    'Zombie Mission cannot be played before Ghost Mission completion',
  );

  // 2. Complete Ghost Mission -> knife becomes accessible, Zombie Mission can start, but Gun is still locked
  completeGhostMissionForTest();
  assert.equal(selectMissionWeapon('ghost-sword'), true);
  assert.equal(getActiveMissionWeapon(), 'ghost-sword');
  assert.equal(
    selectMissionWeapon('zombie-gun'),
    false,
    'Gun must remain locked until Zombie Mission (13/13) is completed',
  );
  assert.notEqual(
    damageZombie('zombie-1', 1, 'sword'),
    null,
    'Zombie Mission is unlocked after Ghost Mission completion',
  );
});

test('sword hits kill 2-hit zombies in 2 slashes and 3-hit zombies in 3 slashes, unlocking procedural Gun reward on 13/13', () => {
  completeGhostMissionForTest();
  const rng = makeSeededRng(9001);
  rerollZombieForestWave(rng, false);
  setZombieForestSwordActive(true);
  assert.equal(getActiveMissionWeapon(), 'ghost-sword');

  const zombies = getZombieForestProgress().zombies;
  const twoHitZombie = zombies.find(z => z.maxHits === 2)!;
  const threeHitZombie = zombies.find(z => z.maxHits === 3)!;
  assert.ok(twoHitZombie && threeHitZombie);

  // Test real sword blade sweep against twoHitZombie
  playerCombat.capable = true;
  playerCombat.context(true, true);
  playerCombat.cancel();

  const avatar = new Group();
  const weapon = new Group();
  const base = new Group();
  const tip = new Group();
  const zTarget = new Group();
  avatar.position.set(twoHitZombie.x, 0, twoHitZombie.z + 1.2);
  weapon.position.set(twoHitZombie.x, 0, twoHitZombie.z);
  zTarget.position.set(twoHitZombie.x, 0, twoHitZombie.z);
  base.name = 'sword-blade-base';
  tip.name = 'sword-blade-tip';
  base.position.y = 0.5;
  tip.position.y = 1.2;
  weapon.add(base, tip);

  const releaseWeapon = registerCombatWeapon(weapon, avatar);
  const releaseTarget = registerCombatTarget(twoHitZombie.id, {
    root: zTarget,
    height: 1.85,
    radius: 0.48,
  });

  // Slash 1 -> 1 hit remaining
  playerCombat.request('combo');
  playerCombat.sample(0.4);
  sampleCombatBlade(true);
  assert.equal(twoHitZombie.hitsRemaining, 1);
  assert.equal(twoHitZombie.alive, true);

  // Slash 2 -> 2-hit zombie dies!
  playerCombat.finish(playerCombat.sequence);
  playerCombat.request('combo');
  playerCombat.sample(0.4);
  sampleCombatBlade(true);
  assert.equal(twoHitZombie.hitsRemaining, 0);
  assert.equal(twoHitZombie.alive, false);

  releaseWeapon();
  releaseTarget();
  playerCombat.context(false, false);

  // Verify 3-hit zombie takes 3 hits
  assert.equal(damageZombie(threeHitZombie.id, 1, 'sword')?.defeated, false);
  assert.equal(threeHitZombie.hitsRemaining, 2);
  assert.equal(damageZombie(threeHitZombie.id, 1, 'sword')?.defeated, false);
  assert.equal(threeHitZombie.hitsRemaining, 1);
  assert.equal(damageZombie(threeHitZombie.id, 1, 'sword')?.defeated, true);
  assert.equal(threeHitZombie.alive, false);

  // Defeat remaining 11 zombies -> unlocks and equips procedural Gun reward!
  for (const id of ZOMBIE_IDS) {
    while (getZombieForestProgress().zombies.find(z => z.id === id)?.alive) {
      damageZombie(id, 1, 'sword');
    }
  }

  const finalState = getZombieForestProgress();
  assert.equal(finalState.defeatedCount, ZOMBIE_COUNT);
  assert.equal(finalState.completed, true);
  assert.equal(finalState.gunUnlocked, true);
  assert.equal(getThreeGhostsProgress().equippedWeapon, 'zombie-gun');
  assert.equal(getActiveMissionWeapon(), 'zombie-gun');
});

test('procedural 3D Gun model attaches to character hand and shoots enemies to death in 2 or 3 shots', () => {
  // 1. Verify procedural 3D Gun hierarchy and hand attachment orientation
  const gun = createProceduralGunModel(true);
  assert.ok(gun.getObjectByName('gun-grip'));
  assert.ok(gun.getObjectByName('gun-receiver'));
  assert.ok(gun.getObjectByName('gun-slide'));
  assert.ok(gun.getObjectByName('gun-barrel'));
  assert.ok(gun.getObjectByName('gun-foregrip-hold'));
  assert.ok(gun.getObjectByName('gun-muzzle-tip'));

  const avatar = new Group();
  const hand = new Group();
  hand.name = 'mixamorigRightHand';
  avatar.rotation.y = 0.65;
  hand.rotation.set(0.3, -0.2, 0.4);
  avatar.add(hand);
  hand.add(gun);
  assert.equal(findSwordHand(avatar), hand);

  gun.quaternion.copy(gunGripRotation(hand, avatar));
  const gunForward = new Vector3(0, 0, -1).applyQuaternion(
    gun.getWorldQuaternion(new Quaternion()),
  );
  const avatarForward = new Vector3(0, 0, -1).applyQuaternion(
    avatar.getWorldQuaternion(new Quaternion()),
  );
  assert.ok(gunForward.distanceTo(avatarForward) < 1e-6);

  // 2. Respawn a fresh wave of 13 zombies while keeping the Gun unlocked & equipped
  const wave = rerollZombieForestWave(makeSeededRng(777), true);
  assert.equal(wave.gunUnlocked, true);
  selectMissionWeapon('zombie-gun');
  assert.equal(getActiveMissionWeapon(), 'zombie-gun');

  const targetZombie = wave.zombies.find(z => z.maxHits === 2)!;
  avatar.position.set(targetZombie.x, 0, targetZombie.z + 6);
  avatar.rotation.set(0, 0, 0); // faces -Z toward targetZombie
  avatar.updateMatrixWorld(true);

  const releaseGun = registerCombatGun(gun, avatar);
  const prevShots = gunEffects.shotsFired;

  // Shot 0 (Off-target PUBG aim test): aiming 35° away from targetZombie MUST NOT hit it!
  const offAngle = (35 * Math.PI) / 180;
  const offAimTarget = resolveGunAimTarget(
    targetZombie.x,
    targetZombie.z + 6,
    Math.sin(offAngle),
    -Math.cos(offAngle),
  );
  assert.equal(offAimTarget, null, 'PUBG aim pointer does not lock when aiming off-target');
  const offShot = requestGunShot({
    playerX: targetZombie.x,
    playerZ: targetZombie.z + 6,
    forwardX: Math.sin(offAngle),
    forwardZ: -Math.cos(offAngle),
    nowSec: 9,
    ignoreCooldown: true,
  });
  assert.equal(offShot.fired, true);
  assert.equal(offShot.hitId, null, 'shooting off-target must not magically hit zombie');
  assert.equal(targetZombie.hitsRemaining, 2);

  // On-target aim pointer locks directly onto targetZombie
  const onAimTarget = resolveGunAimTarget(targetZombie.x, targetZombie.z + 6, 0, -1);
  assert.equal(onAimTarget?.id, targetZombie.id);
  assert.equal(onAimTarget?.kind, 'zombie');

  // Shot 1 -> hits targetZombie, 1 hit remaining, and triggers shooting.glb motion
  const shot1 = requestGunShot({ nowSec: 10, ignoreCooldown: true });
  assert.equal(shot1.fired, true);
  assert.equal(shot1.hitId, targetZombie.id);
  assert.equal(shot1.hitKind, 'zombie');
  assert.equal(shot1.defeated, false);
  assert.equal(targetZombie.hitsRemaining, 1);
  assert.equal(getMotion(GUN_SHOOTING_MOTION_ID)?.assetUrl, '/motions/interactions/shooting.glb');
  assert.equal(getMotion('gun-idle')?.assetUrl, '/motions/interactions/gun-idle.glb');
  assert.equal(getMotion('gun-idle')?.clipName, 'mixamo.com.001');
  assert.equal(getMotion('gun-idle')?.defaultLoop, true);
  assert.equal(getMotion('gun-hold-walking')?.assetUrl, '/motions/interactions/gun-hold-walking.glb');
  assert.equal(getMotion('gun-hold-walking')?.clipName, 'mixamo.com.002');
  assert.equal(getMotion('gun-hold-walking')?.defaultLoop, true);
  assert.equal(getMotion('gun-hold-walking')?.allowWhileMoving, true);
  assert.equal(getMotion('gun-idle')?.allowWhileMoving, true);
  assert.equal(getMotion(GUN_SHOOTING_MOTION_ID)?.allowWhileMoving, true);
  assert.equal(getSpecialActionState().activeActionId, GUN_SHOOTING_MOTION_ID);

  // Shot 2 -> kills 2-hit targetZombie and records impact fire burst at targetZombie!
  const prevImpacts = gunEffects.impactHead;
  const shot2 = requestGunShot({ nowSec: 11, ignoreCooldown: true });
  assert.equal(shot2.fired, true);
  assert.equal(shot2.hitId, targetZombie.id);
  assert.equal(shot2.defeated, true);
  assert.equal(targetZombie.alive, false);
  assert.equal(gunEffects.shotsFired, prevShots + 3);
  assert.equal(gunEffects.impactHead, prevImpacts + 1);
  const zombieImpact =
    gunEffects.impacts[(gunEffects.impactHead - 1) % gunEffects.impacts.length];
  assert.equal(zombieImpact.kind, 'zombie');
  assert.ok(Math.hypot(zombieImpact.position.x - targetZombie.x, zombieImpact.position.z - targetZombie.z) < 0.01);

  // Shot 3 -> aiming at a solid building/tree spawns an impact fire burst at the obstacle hit point
  const shot3 = requestGunShot({
    playerX: 143.769,
    playerZ: 246.5,
    forwardX: 0,
    forwardZ: -1,
    nowSec: 12,
    ignoreCooldown: true,
  });
  assert.equal(shot3.fired, true);
  assert.ok(
    shot3.hitKind === 'building' || shot3.hitKind === 'tree',
    `expected building or tree impact fire burst, got ${shot3.hitKind}`,
  );
  assert.equal(gunEffects.impactHead, prevImpacts + 2);

  stopSpecialAction(true);
  releaseGun();

  // Verify Gun & Knife quick toggle buttons switch cleanly between equipped <-> empty hands while retaining slot
  selectMissionWeapon('zombie-gun');
  assert.equal(getQuickToggleWeapon(), 'zombie-gun');
  assert.equal(toggleQuickWeapon('zombie-gun'), null, 'gun toggle holsters gun to empty hands');
  assert.equal(getActiveMissionWeapon(), null);
  assert.equal(getQuickToggleWeapon(), 'zombie-gun', 'gun toggle button stays available while holstered');
  assert.equal(toggleQuickWeapon('zombie-gun'), 'zombie-gun', 'gun toggle re-draws gun');

  selectMissionWeapon('ghost-sword');
  assert.equal(getQuickToggleWeapon(), 'ghost-sword');
  assert.equal(toggleQuickWeapon('ghost-sword'), null, 'knife toggle holsters sword to empty hands');
  assert.equal(getActiveMissionWeapon(), null);
  assert.equal(getQuickToggleWeapon(), 'ghost-sword', 'knife toggle button stays available while holstered');
  assert.equal(toggleQuickWeapon('ghost-sword'), 'ghost-sword', 'knife toggle re-draws sword');

  selectMissionWeapon(null);
});

test('each zombie attack deducts 1 heart from the 3 heart lives; using ကာ with knife blocks without reducing heart life; losing all 3 hearts triggers defeat_02/defeat_03 and restarts from the beginning', () => {
  Object.assign(rideLife, {
    lives: 3,
    crashTime: 0,
    invulnerable: 0,
    contact: false,
    damage: 0,
  });
  clearKnifeGuard();
  stepPlayerRespawnGrace(10);
  const rng = makeSeededRng(333);
  const initialWave = rerollZombieForestWave(rng, false);
  const z0 = initialWave.zombies[0];
  damageZombie(z0.id, z0.maxHits, 'sword');
  assert.equal(getZombieForestProgress().defeatedCount, 1);

  // Using 'ကာ' (Sword_Block) with the knife must NOT reduce heart life
  setZombieForestSwordActive(true);
  playerCombat.capable = true;
  playerCombat.context(true, true);
  requestSwordAttack('Sword_Block');
  const blockedHit = applyZombieAttackToPlayer('zombie-2', 410, 410, rng);
  assert.equal(blockedHit.blocked, true);
  assert.equal(blockedHit.applied, false);
  assert.equal(blockedHit.livesRemaining, 3);
  assert.equal(rideLife.lives, 3, 'heart life must not decrease when using ကာ with knife');

  // Clear guard to test unblocked attacks
  clearKnifeGuard();
  playerCombat.cancel();
  playerCombat.context(false, false);

  // 1st unblocked zombie attack -> 3 hearts becomes 2 hearts + launches 4m airborne knockback (0.80s, 0.70m lift) + drone view
  resetPlayerKnockback();
  const hit1 = applyZombieAttackToPlayer('zombie-2', 410, 410, rng);
  assert.equal(hit1.applied, true);
  assert.equal(hit1.blocked, false);
  assert.equal(hit1.livesRemaining, 2);
  assert.equal(rideLife.lives, 2);
  assert.equal(hit1.playerDied, false);
  assert.equal(getPlayerDeathState().phase, 'alive');
  assert.equal(isPlayerKnockbackActive(), true, 'Zombie hit must launch player knockback');
  assert.equal(isPlayerKnockbackCameraActive(), true, 'Zombie hit must activate knockback drone view');
  const kbPos = { x: 410, z: 410 };
  let maxZombieLift = 0;
  for (let i = 0; i < 20; i++) {
    const s = stepPlayerKnockback(0.05, kbPos, () => true);
    maxZombieLift = Math.max(maxZombieLift, s.liftY);
  }
  assert.equal(isPlayerKnockbackActive(), false, 'Zombie knockback finishes within 0.80s');
  assert.ok(Math.abs(Math.hypot(kbPos.x - 410, kbPos.z - 410) - 4.0) < 0.08, 'Zombie hit launches player 4m');
  assert.ok(Math.abs(maxZombieLift - 0.7) < 0.06, `Zombie knockback peaks near 0.70m lift (got ${maxZombieLift.toFixed(3)}m)`);
  resetPlayerKnockback();

  // 2nd unblocked zombie attack -> 2 hearts becomes 1 heart
  const hit2 = applyZombieAttackToPlayer('zombie-2', 410, 410, rng);
  assert.equal(hit2.applied, true);
  assert.equal(hit2.livesRemaining, 1);
  assert.equal(rideLife.lives, 1);
  assert.equal(hit2.playerDied, false);
  assert.equal(getPlayerDeathState().phase, 'alive');

  // 3rd unblocked zombie attack -> 1 heart becomes 0 hearts; plays defeat_02/defeat_03, dies & resets wave to 0/13
  const hit3 = applyZombieAttackToPlayer('zombie-2', 410, 410, rng);
  assert.equal(hit3.applied, true);
  assert.equal(hit3.livesRemaining, 0);
  assert.equal(rideLife.lives, 0);
  assert.equal(hit3.playerDied, true);
  assert.ok(
    hit3.defeatMotionId === 'defeat_02' || hit3.defeatMotionId === 'defeat_03',
  );
  assert.equal(getPlayerDeathState().phase, 'dead');
  assert.equal(getPlayerDeathState().ghostId, 'zombie-2');
  assert.equal(getZombieForestProgress().defeatedCount, 0);

  // Respawn restores all 3 hearts and returns player to alive state
  requestPlayerRespawn();
  assert.equal(getPlayerDeathState().phase, 'respawning');
  assert.equal(rideLife.lives, 3);
  completePlayerRespawn();
  assert.equal(getPlayerDeathState().phase, 'alive');
  assert.equal(rideLife.lives, 3);
  stepPlayerRespawnGrace(10);
});
