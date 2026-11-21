import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  disposeChristianChurchAssetCache,
  getChristianChurchAssetCache,
} from '../src/game/christianChurchAssets.ts';
import {
  disposeChinHouseAssetCache,
  getChinHouseAssetCache,
} from '../src/game/chinHouseAssets.ts';
import {
  tharYarGoneLandmarkBuildings,
  tharYarGoneVillage,
} from '../src/data/villages/tharyargone/index.ts';
import {
  kyarInnCrossLanes,
  kyarInnLakePonds,
  kyarInnLandmarkBuildings,
  kyarInnLandmarks,
  kyarInnLanes,
  kyarInnVillage,
} from '../src/data/villages/kyarinn/index.ts';
import {
  clearChinHouseDoors,
  getChinHouseDoorOpen,
  isChinVillageRegion,
} from '../src/game/chinVillages.ts';
import {
  CHIN_HOUSE_MAX_RESIDENTS,
  CHIN_HOUSE_MIN_RESIDENTS,
  ChinVillagerFixedPoolController,
  buildChinVillageHouseholdRoster,
  defaultChinCompoundBounds,
} from '../src/game/chinVillagerPool.ts';
import {
  engageBotFight,
  formatBotTargetLabel,
  getBotFightingState,
  isBotInCombat,
  isChildBotTarget,
  resetBotFighting,
} from '../src/game/botFighting.ts';
import { chinKindToNpcRole } from '../src/game/chinCombatPose.ts';
import { angle } from '../src/data/ward.ts';

test('ChristianChurch provides a strict Singleton GPU asset cache separate from Chin houses', () => {
  const c1 = getChristianChurchAssetCache();
  const c2 = getChristianChurchAssetCache();
  assert.strictEqual(c1, c2, 'ChristianChurch cache returns the exact same singleton reference');
  assert.ok(c1.unitBoxGeo && c1.pyramidSpireGeo && c1.gothicSpireGeo);
  assert.ok(c1.crossGoldMat && c1.sanctuaryWindowMat && c1.sanctuaryDoorMat);

  disposeChristianChurchAssetCache();
  const c3 = getChristianChurchAssetCache();
  assert.notStrictEqual(c3, c1, 'Re-creates cleanly after explicit disposal');
  disposeChristianChurchAssetCache();
});

test('Chin village ethnicity guard excludes non-Chin HouseResidentBots & VillagePedestrianBots (fixing floating duplicate doors)', () => {
  assert.equal(isChinVillageRegion('tharyargone'), true);
  assert.equal(isChinVillageRegion('kyarinn'), true);
  assert.equal(isChinVillageRegion('weipula-village'), true);
  assert.equal(isChinVillageRegion('weipula-chin-village'), true);
  assert.equal(isChinVillageRegion('myothar'), false);
  assert.equal(isChinVillageRegion('tharsi'), false);

  const residentBotsSrc = readFileSync('src/components/HouseResidentBots.tsx', 'utf8');
  assert.ok(
    residentBotsSrc.includes('isChinVillageRegion(regionId)'),
    'HouseResidentBots skips Chin villages so no floating detached doors or non-Chin bots spawn',
  );

  const pedBotsSrc = readFileSync('src/components/VillagePedestrianBots.tsx', 'utf8');
  assert.ok(
    pedBotsSrc.includes('isChinVillageRegion(id)'),
    'VillagePedestrianBots skips Chin villages so only Chin ethnic people populate Chin villages',
  );
});

test('Tharyargone converts residential homes to spacious Chin Hornbill compounds while preserving Christian churches', () => {
  const residential = tharYarGoneVillage.houses.filter(h => !h.id.startsWith('tyg-landmark-'));
  const churchLandmarks = tharYarGoneLandmarkBuildings.filter(
    b => b.kind === 'church' || b.kind === 'tower' || b.kind === 'hall',
  );

  assert.ok(residential.length >= 160, `Expected spacious Chin homes in Tharyargone, got ${residential.length}`);
  assert.equal(churchLandmarks.length, 3, 'St. Assumption Church, Bell Tower, and Kingdom Hall remain intact');

  // Verify spacious Chin compounds do NOT overlap each other or intrude on road centers
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const toUV = (x: number, z: number) => ({ u: x * cosA - z * sinA, v: x * sinA + z * cosA });

  for (let i = 0; i < residential.length; i++) {
    const a = residential[i];
    const uvA = toUV(a.x, a.z);
    const bA = defaultChinCompoundBounds(a.width, a.depth);
    // Wide yard check
    assert.ok(bA.sideHalf * 2 >= 12.0, 'Compound width >= 12m');
    assert.ok(bA.backHalf + bA.frontHalf >= 15.0, 'Compound depth >= 15m');

    for (let j = i + 1; j < residential.length; j++) {
      const b = residential[j];
      const uvB = toUV(b.x, b.z);
      const du = Math.abs(uvA.u - uvB.u);
      const dv = Math.abs(uvA.v - uvB.v);
      const overlapU = du < bA.backHalf + bA.frontHalf - 0.05;
      const overlapV = dv < bA.sideHalf * 2 - 0.05;
      assert.equal(
        overlapU && overlapV,
        false,
        `Spacious compounds ${a.id} and ${b.id} must not overlap (du=${du.toFixed(2)}, dv=${dv.toFixed(2)})`,
      );
    }
  }

  const tygSrc = readFileSync('src/components/villages/tharyargone/index.tsx', 'utf8');
  assert.ok(tygSrc.includes('<ChinTraditionalHouseBatch'), 'Renders Chin Hornbill houses');
  assert.ok(tygSrc.includes('showCompoundFence'), 'Enables spacious Farmhouse-style compound fences');
  assert.ok(tygSrc.includes('omitStaticDoorLeaves'), 'Delegates hinged door leaves to live ChinVillageBots so strictly 1 attached door exists');
  assert.ok(tygSrc.includes('registerGroundRegion'), 'Handles walkable village ground registration & release');
  assert.ok(tygSrc.includes('<ChristianChurch'), 'Preserves Christian churches via ChristianChurch component');
  assert.equal(tygSrc.includes('<House '), false, 'No legacy generic <House />');

  const streamedWorldSrc = readFileSync('src/components/StreamedWorld.tsx', 'utf8');
  assert.ok(
    streamedWorldSrc.includes('<ChinVillageBots'),
    'StreamedWorld mounts live ChinVillageBots alongside HouseResidentBots & VillagePedestrianBots so NPCs & doors animate live',
  );
});

test('ChinVillagerFixedPool assigns 1..10 random Chin residents per house, recycles fixed slots, and animates attached front doors', () => {
  const c = getChinHouseAssetCache();
  assert.ok(c.doorLeafMat && c.doorFrameMat && c.blueFenceMat && c.wireMeshMat && c.yardLawnMat);
  disposeChinHouseAssetCache();

  const residential = tharYarGoneVillage.houses.filter(h => !h.id.startsWith('tyg-landmark-'));
  const houseInputs = residential.map(h => ({
    id: h.id,
    x: h.x,
    z: h.z,
    baseY: 0,
    width: h.width,
    depth: h.depth,
    rotation: angle + Math.PI / 2,
    compound: defaultChinCompoundBounds(h.width, h.depth),
  }));

  const roster = buildChinVillageHouseholdRoster(houseInputs);
  assert.equal(roster.households.length, houseInputs.length);
  assert.equal(roster.minPerHouse, CHIN_HOUSE_MIN_RESIDENTS, 'Some Chin houses have exactly 1 solo resident');
  assert.equal(roster.maxPerHouse, CHIN_HOUSE_MAX_RESIDENTS, 'Some Chin houses have up to 10 family members');

  for (const hh of roster.households) {
    assert.ok(
      hh.residentCount >= 1 && hh.residentCount <= 10,
      `House ${hh.houseId} residentCount ${hh.residentCount} must be in 1..10`,
    );
  }
  for (const m of roster.members) {
    assert.ok(
      m.kind === 'chin-woman' || m.kind === 'chin-man' || m.kind === 'chin-elder' || m.kind === 'chin-kid',
      `Only Chin ethnic villagers allowed, got ${m.kind}`,
    );
  }

  // Verify Fixed Object Pool capacity & attached front door proximity opening
  clearChinHouseDoors();
  const pool = new ChinVillagerFixedPoolController(houseInputs, 48, 115);
  try {
    const first = houseInputs[0];
    // Stand directly in front of the first house's attached front door (frontWallZ = +1.45 -> world offset along rot)
    const frontWallZ = -0.6 + (first.depth - 2.4) / 2;
    const doorOffsetZ = frontWallZ + 1.0;
    const focusX = first.x + doorOffsetZ * Math.sin(first.rotation);
    const focusZ = first.z + doorOffsetZ * Math.cos(first.rotation);

    for (let step = 0; step < 20; step++) {
      pool.update(focusX, focusZ, 0.05, step === 0, true);
    }

    assert.equal(pool.slots.length, 48, 'Pool maintains strictly fixed slot count');
    const activeCount = pool.slots.filter(s => s.member !== null).length;
    assert.ok(activeCount > 0 && activeCount <= 48, `Active pooled Chin residents=${activeCount}`);
    assert.ok(
      pool.doorSlots.some(d => d.house?.id === first.id && d.open > 0.5),
      `Live attached door slot for ${first.id} opens cleanly when standing at doorway`,
    );
    assert.ok(
      getChinHouseDoorOpen(first.id) > 0.5,
      `Attached front door of ${first.id} should smoothly swing open when standing at doorway`,
    );

    // Nighttime living-hours check: residents return indoors and doors close smoothly
    for (let step = 0; step < 30; step++) {
      pool.update(focusX, focusZ, 0.05, false, false);
    }
    const outsideAtNight = pool.slots.filter(s => s.member && !s.member.insideHouse).length;
    assert.equal(outsideAtNight, 0, 'At night, Chin household residents stay safely indoors');
    assert.equal(getChinHouseDoorOpen(first.id), 0, 'At night, attached front doors close smoothly');
  } finally {
    pool.dispose();
  }
  assert.equal(getChinHouseDoorOpen(houseInputs[0].id), 0, 'Disposing pool clears door state cleanly');
});

test('Chin villagers reuse the existing botFighting & trafficColliders bump-to-fight system with zero duplication', () => {
  assert.equal(chinKindToNpcRole('chin-kid', 0), 'boy');
  assert.equal(chinKindToNpcRole('chin-kid', 1), 'girl');
  assert.equal(chinKindToNpcRole('chin-woman', 0), 'auntie');
  assert.equal(chinKindToNpcRole('chin-man', 0), 'uncle');
  assert.equal(formatBotTargetLabel('chin-house-bot-0', 'auntie'), 'ချင်းရိုးရာ အမျိုးသမီး');
  assert.equal(formatBotTargetLabel('chin-street-bot-2', 'uncle'), 'ချင်းရိုးရာ အမျိုးသား');
  assert.equal(formatBotTargetLabel('chin-house-bot-4', 'boy'), 'ချင်းကလေးငယ်');
  assert.equal(isChildBotTarget('chin-house-bot-4', 'boy'), true);

  // Engage the existing botFighting engine directly with a Chin villager + verify combat slot lock
  resetBotFighting();
  try {
    const engaged = engageBotFight({
      id: 'chin-house-bot-0',
      label: formatBotTargetLabel('chin-house-bot-0', 'uncle'),
      x: 1810,
      z: 2005,
      npcRole: 'uncle',
      playerX: 1809,
      playerZ: 2005,
    });
    assert.equal(engaged, true);
    assert.equal(isBotInCombat('chin-house-bot-0'), true);
    assert.equal(getBotFightingState().targetLabel, 'ချင်းရိုးရာ အမျိုးသား');

    // Verify ChinVillagerFixedPoolController does NOT evict a combat-locked slot when focus moves far away
    const residential = tharYarGoneVillage.houses.filter(h => !h.id.startsWith('tyg-landmark-'));
    const houseInputs = residential.slice(0, 6).map(h => ({
      id: h.id,
      x: h.x,
      z: h.z,
      baseY: 0,
      width: h.width,
      depth: h.depth,
      rotation: angle + Math.PI / 2,
      compound: defaultChinCompoundBounds(h.width, h.depth),
    }));
    const pool = new ChinVillagerFixedPoolController(houseInputs, 8, 120);
    pool.rebalance(houseInputs[0].x, houseInputs[0].z);
    const fighter = pool.slots[0].member;
    assert.ok(fighter);
    pool.rebalance(houseInputs[0].x + 500, houseInputs[0].z + 500, si => isBotInCombat(`chin-house-bot-${si}`));
    assert.strictEqual(pool.slots[0].member, fighter, 'Combat-locked Chin villager slot is preserved while chasing/fighting');
    pool.dispose();
  } finally {
    resetBotFighting();
  }

  const botsSrc = readFileSync('src/components/ChinVillageBots.tsx', 'utf8');
  assert.ok(botsSrc.includes('trafficColliders.set('), 'Registers Chin villagers in shared trafficColliders for Player bump detection');
  assert.ok(botsSrc.includes('isBotInCombat(') && botsSrc.includes('applyChinBotCombatPose('), 'Reuses existing botFighting & shared combat pose helper');
  assert.equal(/\bengageBotFight\(/.test(botsSrc), false, 'Does NOT duplicate Player bump/fight engagement logic');
});

test('Kyar Inn converts residential homes to spacious Chin Hornbill compounds clear of roads, churches, school & lake, with live Chin population', () => {
  const residential = kyarInnVillage.houses.filter(h => !h.id.startsWith('ki-'));
  const churches = kyarInnLandmarkBuildings.filter(b => b.kind.startsWith('church-'));
  assert.ok(residential.length >= 220, `Expected spacious Chin homes in Kyar Inn, got ${residential.length}`);
  assert.equal(churches.length, 4, 'All 4 Kyar Inn Christian churches remain intact');

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const toUV = (x: number, z: number) => ({ u: x * cosA - z * sinA, v: x * sinA + z * cosA });

  const boxes = residential.map(h => {
    const { u, v } = toUV(h.x, h.z);
    const b = defaultChinCompoundBounds(h.width, h.depth);
    const uMin = u < 0 ? u - b.backHalf : u - b.frontHalf;
    const uMax = u < 0 ? u + b.frontHalf : u + b.backHalf;
    return {
      id: h.id,
      u,
      v,
      uMin,
      uMax,
      vMin: v - b.sideHalf,
      vMax: v + b.sideHalf,
    };
  });

  // 1. No two Chin compounds overlap each other
  for (let i = 0; i < boxes.length; i++) {
    const a = boxes[i];
    // Clear of AH1 main road (u ∈ [-5, +5])
    assert.ok(a.uMax < -5 || a.uMin > 5, `${a.id} must clear AH1 main road`);
    // Clear of all 9 N-S cross lanes (width 4.5 -> ±2.25)
    for (const laneU of kyarInnCrossLanes) {
      assert.ok(
        a.uMax <= laneU - 2.25 + 0.01 || a.uMin >= laneU + 2.25 - 0.01,
        `${a.id} [${a.uMin.toFixed(2)}, ${a.uMax.toFixed(2)}] must clear cross lane u=${laneU}`,
      );
    }
    // Clear of all 11 E-W lanes (depth 4 -> ±2.0)
    for (const laneV of kyarInnLanes) {
      assert.ok(
        a.vMax <= laneV - 2.0 + 0.01 || a.vMin >= laneV + 2.0 - 0.01,
        `${a.id} [${a.vMin.toFixed(2)}, ${a.vMax.toFixed(2)}] must clear E-W lane v=${laneV}`,
      );
    }
    // Clear of all churches, school buildings, school field, and lake ponds
    for (const b of kyarInnLandmarkBuildings) {
      const uv = toUV(b.x, b.z);
      const overlap =
        a.uMax > uv.u - b.width / 2 &&
        a.uMin < uv.u + b.width / 2 &&
        a.vMax > uv.v - b.depth / 2 &&
        a.vMin < uv.v + b.depth / 2;
      assert.equal(overlap, false, `${a.id} must not overlap landmark ${b.id}`);
    }
    for (const m of kyarInnLandmarks) {
      const uv = toUV(m.x, m.z);
      const overlap =
        a.uMax > uv.u - m.width / 2 &&
        a.uMin < uv.u + m.width / 2 &&
        a.vMax > uv.v - m.depth / 2 &&
        a.vMin < uv.v + m.depth / 2;
      assert.equal(overlap, false, `${a.id} must not overlap school ground ${m.id}`);
    }
    for (const p of kyarInnLakePonds) {
      const overlap =
        a.uMax > p.u - p.width / 2 &&
        a.uMin < p.u + p.width / 2 &&
        a.vMax > p.v - p.depth / 2 &&
        a.vMin < p.v + p.depth / 2;
      assert.equal(overlap, false, `${a.id} must not overlap lake pond ${p.id}`);
    }

    for (let j = i + 1; j < boxes.length; j++) {
      const b = boxes[j];
      const overlap =
        a.uMax > b.uMin + 0.05 &&
        a.uMin < b.uMax - 0.05 &&
        a.vMax > b.vMin + 0.05 &&
        a.vMin < b.vMax - 0.05;
      assert.equal(overlap, false, `Kyar Inn compounds ${a.id} and ${b.id} must not overlap`);
    }
  }

  // 2. Roster & attached door animation work on both West-facing and East-facing Kyar Inn homes
  const kyarInnInputs = residential.map(h => {
    const { u } = toUV(h.x, h.z);
    return {
      id: h.id,
      x: h.x,
      z: h.z,
      baseY: 0,
      width: h.width,
      depth: h.depth,
      rotation: angle + (u > 0 ? -Math.PI / 2 : Math.PI / 2),
      compound: defaultChinCompoundBounds(h.width, h.depth),
    };
  });
  const roster = buildChinVillageHouseholdRoster(kyarInnInputs);
  assert.equal(roster.minPerHouse, CHIN_HOUSE_MIN_RESIDENTS);
  assert.equal(roster.maxPerHouse, CHIN_HOUSE_MAX_RESIDENTS);

  const eastHouse = kyarInnInputs.find(h => toUV(h.x, h.z).u > 0)!;
  assert.ok(eastHouse, 'Kyar Inn includes East-of-AH1 Chin houses');
  clearChinHouseDoors();
  const pool = new ChinVillagerFixedPoolController(kyarInnInputs, 48, 120);
  try {
    const frontWallZ = -0.6 + (eastHouse.depth - 2.4) / 2;
    const doorOffsetZ = frontWallZ + 1.0;
    const focusX = eastHouse.x + doorOffsetZ * Math.sin(eastHouse.rotation);
    const focusZ = eastHouse.z + doorOffsetZ * Math.cos(eastHouse.rotation);
    for (let step = 0; step < 20; step++) {
      pool.update(focusX, focusZ, 0.05, step === 0, true);
    }
    assert.ok(
      getChinHouseDoorOpen(eastHouse.id) > 0.5,
      `East-side Kyar Inn house ${eastHouse.id} attached front door opens cleanly when approached`,
    );
  } finally {
    pool.dispose();
  }

  // 3. Component & live pool wiring check
  const kiSrc = readFileSync('src/components/villages/kyarinn/index.tsx', 'utf8');
  assert.ok(kiSrc.includes('<ChinTraditionalHouseBatch'), 'Kyar Inn renders Chin Hornbill houses');
  assert.ok(kiSrc.includes('showCompoundFence'), 'Kyar Inn enables spacious Chin compound fences');
  assert.ok(kiSrc.includes('omitStaticDoorLeaves'), 'Kyar Inn delegates attached swinging doors to ChinVillageBots');
  assert.ok(kiSrc.includes('registerGroundRegion'), 'Kyar Inn registers & releases walkable village ground');
  assert.ok(kiSrc.includes('<ChristianChurch'), 'Kyar Inn preserves all 4 Christian churches');

  const chinBotsSrc = readFileSync('src/components/ChinVillageBots.tsx', 'utf8');
  assert.ok(
    chinBotsSrc.includes('kyarInnVillage') && chinBotsSrc.includes("'kyarinn'"),
    'ChinVillageBots serves Kyar Inn in the single shared Fixed Object Pool',
  );
});
