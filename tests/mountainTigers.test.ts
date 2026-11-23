import assert from 'node:assert/strict';
import test from 'node:test';
import { toWorld, ward } from '../src/data/ward.ts';
import { getAssetDefinition } from '../src/game/assetRegistry.ts';
import { canStand } from '../src/game/collision.ts';
import { buildMountainDeerSpawns } from '../src/game/mountainDeerPool.ts';
import { buildMountainRabbitSpawns } from '../src/game/mountainRabbitPool.ts';
import {
  disposeMountainTigerAssetCache,
  getMountainTigerAssetCache,
  getMountainTigerAssetCacheStats,
} from '../src/game/mountainTigerAssets.ts';
import {
  MountainTigerFixedPool,
  TIGER_PAIR_MAX_DIST_M,
  TIGER_PAIR_MIN_DIST_M,
  TIGER_PREY_MIN_SEPARATION_M,
  buildMountainTigerSpawns,
} from '../src/game/mountainTigerPool.ts';
import {
  applyTigerAttackToPlayer,
  clearMountainTigerCombatRegistry,
  damageMountainTiger,
  getMountainTigerCombatSnapshot,
  registerMountainTigerSpawns,
  resetMountainTigerCombat,
} from '../src/game/mountainTigerCombat.ts';
import {
  RABBIT_CARROT_CINEMATIC_DURATION_SEC,
  isRabbitCarrotCinematicActive,
  resetRabbitCarrotCinematic,
  stepRabbitCarrotCamera,
} from '../src/game/rabbitCarrotCinematic.ts';
import {
  isPlayerKnockbackActive,
  isPlayerKnockbackCameraActive,
  resetPlayerKnockback,
  stepPlayerKnockback,
} from '../src/game/combat/playerKnockback.ts';
import { GHOST_IDS, collectGhostSword, markGhostEncounter, resetThreeGhostsMission, selectMissionWeapon } from '../src/game/missions/threeGhostsMission.ts';
import { completePlayerRespawn, getPlayerDeathState, requestPlayerRespawn, stepPlayerRespawnGrace } from '../src/game/playerDeath.ts';
import { rideLife } from '../src/game/rideLife.ts';
import { resolveGunAimTarget } from '../src/game/combat/gunCombatRuntime.ts';
import { markCombatTigerSlotActive } from '../src/game/mountainTigerCombat.ts';

const allPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Mountain tigers spawn as both 2-tiger pairs and 1-tiger solitary territories strictly FAR from rabbits and deer', () => {
  const rabbits = buildMountainRabbitSpawns(allPeaks);
  const deer = buildMountainDeerSpawns(allPeaks);
  const tigers = buildMountainTigerSpawns(allPeaks, rabbits, deer);

  assert.ok(tigers.length >= 24, `Expected 24+ wild mountain tigers (got ${tigers.length})`);

  // Group by territoryId -> verify BOTH pairs (count === 2) AND solitary (count === 1) exist!
  const byTerritory = new Map<string, typeof tigers>();
  for (const t of tigers) {
    const arr = byTerritory.get(t.territoryId) ?? [];
    arr.push(t);
    byTerritory.set(t.territoryId, arr);
  }
  const pairTerritories = [...byTerritory.values()].filter((g) => g.length === 2);
  const soloTerritories = [...byTerritory.values()].filter((g) => g.length === 1);
  assert.ok(pairTerritories.length >= 6, `Multiple 2-tiger paired territories exist (got ${pairTerritories.length})`);
  assert.ok(soloTerritories.length >= 6, `Multiple 1-tiger solitary territories exist (got ${soloTerritories.length})`);

  assert.equal(TIGER_PREY_MIN_SEPARATION_M, 20);
  assert.equal(TIGER_PAIR_MIN_DIST_M, 3.5);
  assert.equal(TIGER_PAIR_MAX_DIST_M, 5.0);

  // Verify every pair sits strictly within 3.5m..5.0m
  for (const [a, b] of pairTerritories) {
    const d = Math.hypot(a.homeX - b.homeX, a.homeZ - b.homeZ);
    assert.ok(
      d >= TIGER_PAIR_MIN_DIST_M - 0.01 && d <= TIGER_PAIR_MAX_DIST_M + 0.01,
      `Paired tigers stay within 3.5–5.0m in same territory (dist=${d.toFixed(2)}m)`,
    );
  }

  // CRITICAL: Every single tiger MUST be strictly >= 20m away from EVERY rabbit AND EVERY deer!
  for (const t of tigers) {
    assert.ok(t.homeY >= 14, `${t.id} stands on elevated secluded mountain terrain`);
    assert.equal(canStand(t.homeX, t.homeZ), true, `${t.id} stands on clear walkable terrain`);

    for (const r of rabbits) {
      const d = Math.hypot(t.homeX - r.homeX, t.homeZ - r.homeZ);
      assert.ok(
        d >= TIGER_PREY_MIN_SEPARATION_M - 0.01,
        `${t.id} must stay >= ${TIGER_PREY_MIN_SEPARATION_M}m away from rabbit ${r.id} (got ${d.toFixed(1)}m)`,
      );
    }
    for (const dr of deer) {
      const d = Math.hypot(t.homeX - dr.homeX, t.homeZ - dr.homeZ);
      assert.ok(
        d >= TIGER_PREY_MIN_SEPARATION_M - 0.01,
        `${t.id} must stay >= ${TIGER_PREY_MIN_SEPARATION_M}m away from deer ${dr.id} (got ${d.toFixed(1)}m)`,
      );
    }
  }

  const def = getAssetDefinition('nature:mountain-tiger');
  assert.ok(def && def.nameMm.includes('ကျား'));
});

test('MountainTigerAssetCache is a strict Singleton and MountainTigerFixedPool animates & recycles bounded slots', () => {
  const a = getMountainTigerAssetCache();
  const b = getMountainTigerAssetCache();
  assert.strictEqual(a, b, 'Strict Singleton reference cache (zero duplication)');
  assert.equal(getMountainTigerAssetCacheStats().initialized, true);

  const tigers = buildMountainTigerSpawns(allPeaks);
  const pool = new MountainTigerFixedPool(tigers, { capacity: 12, syncMoveThreshold: 16 });

  const westAlpine = toWorld(-2680, 6200);
  assert.equal(pool.syncToFocus(westAlpine.x, westAlpine.z, true), true);
  assert.equal(pool.metrics().activeCount, 12, 'Bounded strictly at 12 fixed GPU slots');

  for (let i = 0; i < 40; i++) {
    pool.step(0.05, westAlpine.x, westAlpine.z, allPeaks);
  }
  assert.equal(pool.metrics().activeCount, 12);

  // Move camera to East Chin Range -> recycles fixed slots in O(1)!
  const eastRange = toWorld(1100, 5300);
  pool.step(0.05, eastRange.x, eastRange.z, allPeaks);
  assert.equal(pool.metrics().activeCount, 12);
  assert.ok(pool.metrics().totalRecycles > 0, 'Distant tiger slots recycled cleanly in O(1)');

  pool.disposePool();
  assert.equal(pool.metrics().activeCount, 0);
  disposeMountainTigerAssetCache();
});

test('Open-world tiger combat kills unarmed players, allows armed combat + 4m knockback, and unlocks carrots + 5s Auto-Bot rabbit feeding cinematic when all tigers fall', () => {
  clearMountainTigerCombatRegistry();
  resetRabbitCarrotCinematic();
  resetPlayerKnockback();
  stepPlayerRespawnGrace(10);
  Object.assign(rideLife, { lives: 3, crashTime: 0, invulnerable: 0, contact: false, damage: 0 });

  // Register a small 2-tiger open-world test group on walkable mountain ground
  const sampleTigers = buildMountainTigerSpawns(allPeaks).slice(0, 2);
  registerMountainTigerSpawns(sampleTigers);
  resetMountainTigerCombat(true);
  const t0 = sampleTigers[0];
  const t1 = sampleTigers[1];
  markCombatTigerSlotActive(t0.id, t0.homeX, t0.homeY, t0.homeZ, 0);
  markCombatTigerSlotActive(t1.id, t1.homeX, t1.homeY, t1.homeZ, 0);

  // 1. Unarmed player (Mission 1/2 not done / no weapon) entering tiger territory dies on tiger pounce
  selectMissionWeapon(null);
  const unarmedHit = applyTigerAttackToPlayer({
    tigerId: t0.id,
    tigerX: t0.homeX,
    tigerZ: t0.homeZ,
    playerX: t0.homeX,
    playerZ: t0.homeZ + 1.5,
  });
  assert.equal(unarmedHit.applied, true);
  assert.equal(unarmedHit.fatalUnarmed, true);
  assert.equal(unarmedHit.playerDied, true);
  assert.equal(rideLife.lives, 0);
  assert.equal(getPlayerDeathState().phase, 'dead');

  // Respawn player & equip sword
  requestPlayerRespawn();
  completePlayerRespawn();
  stepPlayerRespawnGrace(10);
  resetPlayerKnockback();
  Object.assign(rideLife, { lives: 3, crashTime: 0, invulnerable: 0, contact: false, damage: 0 });

  // 2. Armed player (has sword) takes -1 Heart + 4m airborne knockback (0.80s, 0.70m lift) + drone view
  GHOST_IDS.forEach(markGhostEncounter);
  collectGhostSword();
  selectMissionWeapon('ghost-sword');
  const armedHit = applyTigerAttackToPlayer({
    tigerId: t0.id,
    tigerX: t0.homeX,
    tigerZ: t0.homeZ,
    playerX: t0.homeX,
    playerZ: t0.homeZ + 1.5,
  });
  assert.equal(armedHit.applied, true);
  assert.equal(armedHit.fatalUnarmed, false);
  assert.equal(armedHit.playerDied, false);
  assert.equal(rideLife.lives, 2);
  assert.equal(isPlayerKnockbackActive(), true);
  assert.equal(isPlayerKnockbackCameraActive(), true);
  const kbPos = { x: t0.homeX, z: t0.homeZ + 1.5 };
  let maxLift = 0;
  for (let i = 0; i < 20; i++) {
    maxLift = Math.max(maxLift, stepPlayerKnockback(0.05, kbPos, () => true).liftY);
  }
  assert.equal(isPlayerKnockbackActive(), false);
  assert.ok(Math.abs(maxLift - 0.7) < 0.06, `Tiger knockback lifts 0.70m (got ${maxLift.toFixed(2)}m)`);
  resetPlayerKnockback();

  // 3. Gun aim raycast locks cleanly onto active mountain tiger
  const aim = resolveGunAimTarget(t0.homeX, t0.homeZ + 8, 0, -1, 32, null);
  assert.ok(aim && aim.kind === 'tiger' && aim.id === t0.id, 'Gun raycast targets active mountain tigers');

  // 4. Defeating ALL mountain tigers unlocks Carrots & triggers 5-second Auto-Bot Rabbit Feeding Cinematic
  const kill1 = damageMountainTiger(t0.id, 100, 'sword', t0.homeX, t0.homeZ + 2, t0.homeY, 0);
  assert.equal(kill1?.defeated, true);
  assert.equal(kill1?.allDefeated, false);
  assert.equal(isRabbitCarrotCinematicActive(), false);

  const kill2 = damageMountainTiger(t1.id, 100, 'gun', t1.homeX, t1.homeZ + 2, t1.homeY, 0);
  assert.equal(kill2?.defeated, true);
  assert.equal(kill2?.allDefeated, true);
  assert.equal(getMountainTigerCombatSnapshot().carrotsUnlocked, true, 'All tigers defeated unlocks carrots reward');
  assert.equal(isRabbitCarrotCinematicActive(), true, '5s Auto-Bot rabbit carrot-feeding cinematic triggers automatically');

  // Step through 5.0s showcase + 0.75s smooth return
  let sawShowcasePose = false;
  for (let i = 0; i < Math.ceil(RABBIT_CARROT_CINEMATIC_DURATION_SEC / 0.05) - 2; i++) {
    const pose = stepRabbitCarrotCamera(0.05, () => t1.homeY);
    if (pose && pose.lockingMovement) sawShowcasePose = true;
  }
  assert.equal(sawShowcasePose, true, 'Cinematic camera smoothly showcases Auto-Bot & rabbits for 5 seconds');
  for (let i = 0; i < 30; i++) {
    stepRabbitCarrotCamera(0.05, () => t1.homeY);
  }
  assert.equal(isRabbitCarrotCinematicActive(), false, 'Cinematic camera returns cleanly to player after 5s + return');

  // Cleanup
  selectMissionWeapon(null);
  resetThreeGhostsMission();
  resetMountainTigerCombat(true);
  resetRabbitCarrotCinematic();
  resetPlayerKnockback();
});
