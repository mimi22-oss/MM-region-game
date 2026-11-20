import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DOOR_OPEN_PASS_THRESHOLD,
  HOUSE_INTERIOR_FLOOR_Y,
  PATH_TO_CHAIR,
  PATH_TO_HOUSE,
  U_SHWE_COUPLE_CHAIRS,
  U_SHWE_DOOR_LOCAL,
  VERANDA_FLOOR_Y,
  computeDoorTargetOpen,
  createCoupleBotState,
  stepCoupleBot,
  stepDoorOpen,
  uShweLocalFloorY,
  type CoupleBotPhase,
} from '../src/game/uShweCoupleBot.ts';

test('U Shwe couple bots wait for front door to swing open before entering or exiting the house', () => {
  const uncle = createCoupleBotState('uncle');
  const auntie = createCoupleBotState('auntie');
  let doorOpen = 0;

  assert.equal(uncle.phase, 'SITTING');
  assert.equal(auntie.phase, 'SITTING');
  assert.equal(computeDoorTargetOpen(uncle, auntie), 0, 'Door starts closed while both sit');

  const unclePhases = new Set<CoupleBotPhase>([uncle.phase]);
  const auntiePhases = new Set<CoupleBotPhase>([auntie.phase]);
  let sawUncleReturnToSit = false;
  let uncleLeftSit = false;

  // Simulate 100 seconds in 0.05s steps with coupled door openness
  for (let i = 0; i < 2000; i++) {
    const targetOpen = computeDoorTargetOpen(uncle, auntie);
    doorOpen = stepDoorOpen(doorOpen, targetOpen, 0.05);
    stepCoupleBot(uncle, 0.05, doorOpen);
    stepCoupleBot(auntie, 0.05, doorOpen);

    unclePhases.add(uncle.phase);
    auntiePhases.add(auntie.phase);
    if (uncle.phase !== 'SITTING') uncleLeftSit = true;
    if (uncleLeftSit && uncle.phase === 'SITTING') sawUncleReturnToSit = true;

    // STRICT INVARIANT: Neither bot may ever cross the doorway plane while the door is closed!
    for (const bot of [uncle, auntie]) {
      const crossingDoorway = bot.z > 3.9 && bot.z < 5.0;
      if (crossingDoorway) {
        assert.ok(
          doorOpen >= DOOR_OPEN_PASS_THRESHOLD - 0.01,
          `${bot.role} crossed doorway at z=${bot.z.toFixed(2)} while doorOpen=${doorOpen.toFixed(2)} (< ${DOOR_OPEN_PASS_THRESHOLD})`,
        );
      }
    }
  }

  const expectedPhases: CoupleBotPhase[] = [
    'SITTING',
    'STANDING_UP',
    'WALKING_TO_HOUSE',
    'OPENING_DOOR_ENTER',
    'ENTERING_HOUSE',
    'INSIDE_HOUSE',
    'OPENING_DOOR_EXIT',
    'WALKING_TO_CHAIR',
    'SITTING_DOWN',
  ];
  for (const phase of expectedPhases) {
    assert.ok(unclePhases.has(phase), `Uncle must visit phase ${phase}`);
    assert.ok(auntiePhases.has(phase), `Auntie must visit phase ${phase}`);
  }
  assert.ok(sawUncleReturnToSit, 'Uncle must complete a full cycle back to sitting on his chair');
});

test('U Shwe couple chairs and walking waypoints clear dining table, stools, counter, posts and fences', () => {
  const tableCenter = { x: 2.2, z: 5.85 };
  const stools = [
    { x: 2.2, z: 6.57 },
    { x: 2.2, z: 5.13 },
    { x: 1.48, z: 5.85 },
    { x: 2.92, z: 5.85 },
  ];
  const frontPosts = [-4.4, -1.4, 1.4, 4.4].map((x) => ({ x, z: 7.18 }));

  for (const chair of Object.values(U_SHWE_COUPLE_CHAIRS)) {
    assert.ok(chair.x > 3.5 && chair.x < 4.45, `${chair.id} x must stay inside right veranda`);
    assert.ok(chair.z > 4.85 && chair.z < 6.7, `${chair.id} z must stay inside veranda depth`);
    for (const stool of stools) {
      assert.ok(
        Math.hypot(chair.x - stool.x, chair.z - stool.z) > 1.0,
        `${chair.id} must clear dining stool at (${stool.x}, ${stool.z})`,
      );
    }
  }

  for (const role of ['uncle', 'auntie'] as const) {
    const route = PATH_TO_HOUSE[role];
    assert.equal(PATH_TO_CHAIR[role].length, route.length);
    for (let i = 0; i < route.length - 1; i++) {
      const a = route[i];
      const b = route[i + 1];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;

        assert.ok(
          Math.hypot(x - tableCenter.x, z - tableCenter.z) > 0.9,
          `${role} segment ${i} must clear dining table`,
        );
        for (const stool of stools) {
          assert.ok(
            Math.hypot(x - stool.x, z - stool.z) > 0.48,
            `${role} segment ${i} must clear stool at (${stool.x}, ${stool.z})`,
          );
        }
        const inCounter = x > -3.95 && x < -0.85 && z > 5.25 && z < 6.25;
        assert.equal(inCounter, false, `${role} segment ${i} must clear snack counter`);
        for (const post of frontPosts) {
          assert.ok(
            Math.hypot(x - post.x, z - post.z) > 0.35,
            `${role} segment ${i} must clear front post at (${post.x}, ${post.z})`,
          );
        }
      }
    }
    const last = route[route.length - 1];
    assert.ok(last.z < U_SHWE_DOOR_LOCAL.z - 0.5, `${role} destination must be inside the house`);
  }
});

test('uShweLocalFloorY smoothly matches front ground, veranda platform, and interior floor', () => {
  assert.equal(uShweLocalFloorY(7.6), 0);
  assert.equal(uShweLocalFloorY(6.0), VERANDA_FLOOR_Y);
  assert.equal(uShweLocalFloorY(3.8), HOUSE_INTERIOR_FLOOR_Y);
  const midStepOut = uShweLocalFloorY(7.225);
  assert.ok(midStepOut > 0 && midStepOut < VERANDA_FLOOR_Y);
  const midDoorStep = uShweLocalFloorY(4.525);
  assert.ok(midDoorStep > VERANDA_FLOOR_Y && midDoorStep < HOUSE_INTERIOR_FLOOR_Y);
});

test('UShweCoupleBots uses shared covered longyi, tailored Taikpon clothes, and Farmhouse-style dynamic double doors', () => {
  const houseTsx = readFileSync('src/components/ushwehouse.tsx', 'utf-8');
  const botsTsx = readFileSync('src/components/UShweCoupleBots.tsx', 'utf-8');
  const rigTsx = readFileSync('src/components/ElderBotRig.tsx', 'utf-8');
  const resourcesTs = readFileSync('src/game/elderBotResources.ts', 'utf-8');

  assert.ok(houseTsx.includes('UShweCoupleBots'), 'UShweHouse must render UShweCoupleBots');
  assert.ok(houseTsx.includes('leftDoorRef') && houseTsx.includes('rightDoorRef'), 'UShweHouse must wire double door refs like Farmhouse HomeGate');
  assert.ok(
    houseTsx.includes('userData={{ dynamic: true }} name="u-shwe-front-double-door"'),
    'Double door group MUST opt out of StaticBatch via userData={{ dynamic: true }} so it physically swings open',
  );
  assert.ok(botsTsx.includes('useRegionFrame'), 'Bots & door controller must use useRegionFrame');
  assert.ok(botsTsx.includes('ElderBotRig'), 'UShweCoupleBots must reuse shared flyweight ElderBotRig');
  assert.ok(resourcesTs.includes("garmentGeometry('longyi')"), 'Shared cache must use opaque longyi garment shell');
  assert.ok(resourcesTs.includes('createPasoTexture'), 'Shared cache must build woven Myanmar Paso textures');
  assert.ok(rigTsx.includes('coveredStride'), 'Shared rig must use coveredStride so legs stay inside longyi');
  assert.ok(rigTsx.includes('uncle-taikpon-clothes'), 'Shared rig must render tailored Taikpon clothes');
  assert.ok(rigTsx.includes('trafficColliders'), 'Shared rig must register/unregister traffic colliders');
  assert.ok(botsTsx.includes('stepDoorOpen'), 'Must synchronize bot entry/exit with door openness');
});
