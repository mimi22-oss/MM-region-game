import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyBotAvoidanceStep,
  clearAvoidanceActors,
  evaluateCarForwardClearance,
  stepCarTrafficSpeed,
  upsertAvoidanceActor,
} from '../src/game/botAvoidance.ts';

test('Head-on human bots steer smoothly around each other without ever overlapping', () => {
  clearAvoidanceActors();
  try {
    let ax = 0, az = -4, aYaw = 0;
    let bx = 0, bz = 4, bYaw = Math.PI;
    const r = 0.48;
    const dt = 0.05;
    let minObservedDist = Infinity;

    for (let step = 0; step < 160; step++) {
      upsertAvoidanceActor('bot-a', 'human', ax, az, aYaw, r);
      upsertAvoidanceActor('bot-b', 'human', bx, bz, bYaw, r);

      const resA = applyBotAvoidanceStep('bot-a', 'human', ax, az, ax, az + 1.1 * dt, aYaw, r, dt);
      ax = resA.x;
      az = resA.z;
      aYaw = resA.yaw;
      upsertAvoidanceActor('bot-a', 'human', ax, az, aYaw, r);

      const resB = applyBotAvoidanceStep('bot-b', 'human', bx, bz, bx, bz - 1.1 * dt, bYaw, r, dt);
      bx = resB.x;
      bz = resB.z;
      bYaw = resB.yaw;
      upsertAvoidanceActor('bot-b', 'human', bx, bz, bYaw, r);

      const dist = Math.hypot(ax - bx, az - bz);
      if (dist < minObservedDist) minObservedDist = dist;
    }

    assert.ok(
      minObservedDist >= r * 2,
      `Bots must NEVER overlap when passing head-on (minObservedDist=${minObservedDist.toFixed(3)}m)`,
    );
    assert.ok(az > 1 && bz < -1, 'Both bots successfully passed each other along the road');
  } finally {
    clearAvoidanceActors();
  }
});

test('Car bot brakes to a complete STOP when a person is ahead, waits until the person steps aside, then resumes driving', () => {
  clearAvoidanceActors();
  try {
    let carZ = 0;
    let carSpeed = 8.0;
    let humanX = 0.1;
    let humanZ = 12.0;
    let humanYaw = 0;
    const dt = 0.05;

    let carStoppedForHuman = false;
    let humanYielded = false;
    let carResumedAfterClear = false;
    let minBumperGap = Infinity;

    for (let step = 0; step < 180; step++) {
      upsertAvoidanceActor('car-1', 'car', 0, carZ, 0, 2.1, {
        halfWidth: 1.05,
        halfLength: 2.05,
        speed: carSpeed,
      });
      upsertAvoidanceActor('ped-1', 'human', humanX, humanZ, humanYaw, 0.48);

      const clearance = evaluateCarForwardClearance('car-1', 0, carZ, 0, 1.05, 2.05);
      carSpeed = stepCarTrafficSpeed(carSpeed, 8.0, clearance, dt);
      carZ += carSpeed * dt;

      if (clearance.blocked && carSpeed === 0) carStoppedForHuman = true;
      if (carStoppedForHuman && !clearance.blocked && carSpeed > 1.5) carResumedAfterClear = true;

      // Measure actual front-bumper to human distance while human is still in lane
      if (Math.abs(humanX) < 1.5) {
        const gap = humanZ - (carZ + 2.05 + 0.48);
        if (gap < minBumperGap) minBumperGap = gap;
      }

      // Person yields aside off the car lane
      const hRes = applyBotAvoidanceStep(
        'ped-1',
        'human',
        humanX,
        humanZ,
        humanX,
        humanZ + 0.3 * dt,
        humanYaw,
        0.48,
        dt,
      );
      if (hRes.yieldedToCar) humanYielded = true;
      humanX = hRes.x;
      humanZ = hRes.z;
      humanYaw = hRes.yaw;
    }

    assert.equal(carStoppedForHuman, true, 'Car must brake to a full stop for person ahead');
    assert.equal(humanYielded, true, 'Person actively steps aside off the car lane');
    assert.equal(carResumedAfterClear, true, 'Car resumes driving once person clears the lane');
    assert.ok(minBumperGap > 1.0, `Car bumper stayed safely clear of person (minGap=${minBumperGap.toFixed(2)}m)`);
  } finally {
    clearAvoidanceActors();
  }
});

test('Car bot brakes to a STOP for a Water Buffalo / Cow on the road and waits until the livestock yields aside', () => {
  clearAvoidanceActors();
  try {
    let carZ = 0;
    let carSpeed = 8.0;
    let buffX = -0.2;
    let buffZ = 14.0;
    let buffYaw = 0;
    const buffR = 1.15;
    const dt = 0.05;

    let carStoppedForBuffalo = false;
    let buffaloYielded = false;
    let carResumedAfterBuffaloCleared = false;
    let minGap = Infinity;

    for (let step = 0; step < 220; step++) {
      upsertAvoidanceActor('car-2', 'car', 0, carZ, 0, 2.1, {
        halfWidth: 1.05,
        halfLength: 2.05,
        speed: carSpeed,
      });
      upsertAvoidanceActor('buffalo-1', 'livestock', buffX, buffZ, buffYaw, buffR);

      const clearance = evaluateCarForwardClearance('car-2', 0, carZ, 0, 1.05, 2.05);
      carSpeed = stepCarTrafficSpeed(carSpeed, 8.0, clearance, dt);
      carZ += carSpeed * dt;

      if (clearance.blocked && clearance.blockerKind === 'livestock' && carSpeed === 0) {
        carStoppedForBuffalo = true;
      }
      if (carStoppedForBuffalo && !clearance.blocked && carSpeed > 1.5) {
        carResumedAfterBuffaloCleared = true;
      }
      if (Math.abs(buffX) < 2.2) {
        const gap = buffZ - (carZ + 2.05 + buffR);
        if (gap < minGap) minGap = gap;
      }

      const bRes = applyBotAvoidanceStep(
        'buffalo-1',
        'livestock',
        buffX,
        buffZ,
        buffX,
        buffZ,
        buffYaw,
        buffR,
        dt,
      );
      if (bRes.yieldedToCar) buffaloYielded = true;
      buffX = bRes.x;
      buffZ = bRes.z;
      buffYaw = bRes.yaw;
    }

    assert.equal(carStoppedForBuffalo, true, 'Car must stop completely when buffalo/cow is ahead');
    assert.equal(buffaloYielded, true, 'Buffalo/cow yields sideways off the lane');
    assert.equal(carResumedAfterBuffaloCleared, true, 'Car resumes once livestock clears the road');
    assert.ok(minGap > 1.0, `Car never clips into livestock (minGap=${minGap.toFixed(2)}m)`);
  } finally {
    clearAvoidanceActors();
  }
});

test('Livestock never overlap each other and trailing Car bots keep safe following distance', () => {
  clearAvoidanceActors();
  try {
    // 1. Two buffaloes starting slightly close separate cleanly
    let x1 = 0, z1 = 0, x2 = 0.8, z2 = 0;
    for (let step = 0; step < 60; step++) {
      upsertAvoidanceActor('b1', 'livestock', x1, z1, 0, 1.15);
      upsertAvoidanceActor('b2', 'livestock', x2, z2, Math.PI, 1.15);
      const r1 = applyBotAvoidanceStep('b1', 'livestock', x1, z1, x1, z1, 0, 1.15, 0.05);
      x1 = r1.x; z1 = r1.z;
      upsertAvoidanceActor('b1', 'livestock', x1, z1, 0, 1.15);
      const r2 = applyBotAvoidanceStep('b2', 'livestock', x2, z2, x2, z2, Math.PI, 1.15, 0.05);
      x2 = r2.x; z2 = r2.z;
    }
    assert.ok(Math.hypot(x1 - x2, z1 - z2) >= 2.3, 'Buffaloes separate beyond combined radii');

    // 2. Trailing car stops cleanly behind stopped lead car
    clearAvoidanceActors();
    upsertAvoidanceActor('lead-car', 'car', 0, 8, 0, 2.1, { halfWidth: 1.05, halfLength: 2.05, speed: 0 });
    const c = evaluateCarForwardClearance('trail-car', 0, 0, 0, 1.05, 2.05);
    assert.equal(c.blocked, true, 'Trailing car stops behind stopped lead car');
    assert.equal(c.blockerKind, 'car');
  } finally {
    clearAvoidanceActors();
  }

  // Verify live wiring across ALL bot components
  for (const file of [
    'src/components/CarBots.tsx',
    'src/components/RobotBots.tsx',
    'src/components/VillagePedestrianBots.tsx',
    'src/components/ChinVillageBots.tsx',
    'src/components/VillageInstitutionBots.tsx',
    'src/components/FieldLivestockBots.tsx',
  ]) {
    const src = readFileSync(file, 'utf8');
    assert.ok(src.includes('botAvoidance'), `${file} integrates unified botAvoidance engine`);
  }
});
