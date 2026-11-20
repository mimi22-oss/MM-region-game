import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AUNTIE_OUTFIT_COUNT,
  BOY_OUTFIT_COUNT,
  GIRL_OUTFIT_COUNT,
  HAIR_TONE_COUNT,
  SKIN_TONE_COUNT,
  UNCLE_OUTFIT_COUNT,
  assignResidentPoolSlots,
  createHouseholdPool,
  deriveHouseholdProfile,
  getHousePorchLayout,
  getPorchLayoutCacheSize,
  type ResidentHouseRecord,
} from '../src/game/houseResidentPool.ts';
import {
  computeResidentDoorTarget,
  stepDoorOpen,
  stepResident,
  type ResidentPhase,
} from '../src/game/residentBots.ts';

test('deriveHouseholdProfile deterministically assigns adults (1 or 2) AND kids (1 girl, 1 boy, or 2 kids) with varied clothes and heights', () => {
  let soloAdult = 0;
  let coupleAdult = 0;
  let girlOnly = 0;
  let boyOnly = 0;
  let boyAndGirl = 0;
  const uncleOutfits = new Set<number>();
  const auntieOutfits = new Set<number>();
  const boyOutfits = new Set<number>();
  const girlOutfits = new Set<number>();
  const adultHeights = new Set<number>();
  const kidHeights = new Set<number>();

  for (let i = 1; i <= 150; i++) {
    const id = `tharsi-h${i}`;
    const p1 = deriveHouseholdProfile(id);
    const p2 = deriveHouseholdProfile(id);
    assert.deepEqual(p1, p2);
    assert.equal(p1.members.length, p1.residentCount);
    assert.equal(p1.kids.length, p1.kidCount);

    if (p1.residentCount === 1) soloAdult++;
    else coupleAdult++;

    if (p1.kidComposition === 'girl-only') {
      girlOnly++;
      assert.equal(p1.kidCount, 1);
      assert.equal(p1.kids[0].role, 'girl');
    } else if (p1.kidComposition === 'boy-only') {
      boyOnly++;
      assert.equal(p1.kidCount, 1);
      assert.equal(p1.kids[0].role, 'boy');
    } else {
      boyAndGirl++;
      assert.equal(p1.kidCount, 2);
      assert.deepEqual(
        p1.kids.map((k) => k.role),
        ['boy', 'girl'],
      );
    }

    for (const m of p1.members) {
      assert.ok(m.skinIndex >= 0 && m.skinIndex < SKIN_TONE_COUNT);
      assert.ok(m.hairIndex >= 0 && m.hairIndex < HAIR_TONE_COUNT);
      adultHeights.add(m.heightScale);
      if (m.role === 'uncle') {
        assert.ok(m.outfitIndex >= 0 && m.outfitIndex < UNCLE_OUTFIT_COUNT);
        assert.ok(m.heightScale >= 0.94 && m.heightScale <= 1.08);
        uncleOutfits.add(m.outfitIndex);
      } else {
        assert.ok(m.outfitIndex >= 0 && m.outfitIndex < AUNTIE_OUTFIT_COUNT);
        assert.ok(m.heightScale >= 0.86 && m.heightScale <= 1.0);
        auntieOutfits.add(m.outfitIndex);
      }
    }

    for (const k of p1.kids) {
      assert.ok(k.skinIndex >= 0 && k.skinIndex < SKIN_TONE_COUNT);
      kidHeights.add(k.heightScale);
      if (k.role === 'boy') {
        assert.ok(k.outfitIndex >= 0 && k.outfitIndex < BOY_OUTFIT_COUNT);
        assert.ok(k.heightScale >= 0.56 && k.heightScale <= 0.68);
        boyOutfits.add(k.outfitIndex);
      } else {
        assert.ok(k.outfitIndex >= 0 && k.outfitIndex < GIRL_OUTFIT_COUNT);
        assert.ok(k.heightScale >= 0.54 && k.heightScale <= 0.66);
        girlOutfits.add(k.outfitIndex);
      }
    }
  }

  assert.ok(soloAdult > 35 && coupleAdult > 50, `Expected mix of solo (${soloAdult}) and couple (${coupleAdult}) adults`);
  assert.ok(
    girlOnly > 25 && boyOnly > 25 && boyAndGirl > 25,
    `Expected balanced kid mix: girlOnly=${girlOnly}, boyOnly=${boyOnly}, boyAndGirl=${boyAndGirl}`,
  );
  assert.ok(uncleOutfits.size >= 6 && auntieOutfits.size >= 6, 'Adult outfits must vary across palette cache');
  assert.ok(boyOutfits.size >= 6 && girlOutfits.size >= 6, 'Kid outfits must vary across palette cache');
  assert.ok(adultHeights.size >= 20 && kidHeights.size >= 15, 'Adult & kid heights must vary naturally');
});

test('getHousePorchLayout shares cached layout objects with 2 adult seats + 2 kid seats by reference', () => {
  const layoutA = getHousePorchLayout(7.5, 6.5, 0.355, true);
  const layoutB = getHousePorchLayout(7.5, 6.5, 0.355, true);
  const layoutCompact = getHousePorchLayout(7.5, 6.5, 0.355, false);

  assert.strictEqual(layoutA, layoutB, 'Identical footprints must share exact same layout reference');
  assert.notStrictEqual(layoutA, layoutCompact);
  assert.equal(layoutA.seats.length, 4, 'Layout provides 2 adult porch chairs + 2 kid stools');
  assert.ok(getPorchLayoutCacheSize() <= 12, 'Layout cache must stay compact');

  const front = 6.5 / 2;
  assert.ok(layoutA.doorOutside.z > front + 0.83 + 0.2, 'Wait spot must clear outward door swing');
  assert.ok(Math.abs(layoutA.seats[0].x) > 1.05 && Math.abs(layoutA.seats[1].x) > 1.05);
  // Wide yard kid stools sit at ground y=0 beside steps and inside front fence (front + 2.6)
  assert.equal(layoutA.seats[2].floorY, 0);
  assert.equal(layoutA.seats[3].floorY, 0);
  assert.ok(layoutA.seats[2].z < front + 2.35 && layoutA.seats[2].z > front + 1.65);
  assert.equal(layoutA.floorY(front + 1.2), 0.355);
  assert.equal(layoutA.floorY(front + 2.25), 0);
});

test('fixed household object pool bounds memory, stays sticky nearby, and reuses slots in-place when traveling', () => {
  const allHouses: ResidentHouseRecord[] = Array.from({ length: 500 }, (_, i) => ({
    id: `village-h-${i}`,
    x: i * 12,
    z: (i % 2 === 0 ? -1 : 1) * 14,
    width: 7.5,
    depth: 6.5,
    rotation: 0,
    porchY: 0.355,
    hasWideYard: true,
  }));

  const pool = createHouseholdPool(8);
  assert.equal(pool.length, 8);

  const changed1 = assignResidentPoolSlots(pool, allHouses, 120, 0, 60, 74);
  assert.equal(changed1, true);
  const active1 = pool.filter((s) => s.house !== null);
  assert.equal(active1.length, 8, 'Pool must fill up to bounded capacity (8), never exceed it');
  for (const s of active1) {
    assert.ok(s.residents.length >= 1 && s.residents.length <= 2);
    assert.ok(s.kids.length >= 1 && s.kids.length <= 2);
  }
  const uniqueIds1 = new Set(active1.map((s) => s.house!.id));
  assert.equal(uniqueIds1.size, 8, 'Every active slot must hold a distinct house');

  const snapshotBefore = pool.map((s) => s.house?.id);
  assignResidentPoolSlots(pool, allHouses, 124, 0, 60, 74);
  assert.deepEqual(
    pool.map((s) => s.house?.id),
    snapshotBefore,
    'Nearby houses stay pinned in their existing slots',
  );

  const changedFar = assignResidentPoolSlots(pool, allHouses, 2400, 0, 60, 74);
  assert.equal(changedFar, true);
  assert.equal(pool.length, 8, 'Pool array size never grows');
  const farIds = pool.filter((s) => s.house !== null).map((s) => s.house!.id);
  assert.equal(farIds.length, 8);
  for (const id of farIds) {
    assert.ok(!uniqueIds1.has(id), 'Old distant houses must be evicted and replaced in-place');
  }
});

test('pooled adults and kids share the double door safely, waiting until open before entering/exiting', () => {
  const house: ResidentHouseRecord = {
    id: 'test-family-house',
    x: 0,
    z: 0,
    width: 9,
    depth: 7,
    rotation: 0,
    porchY: 0.355,
    hasWideYard: true,
  };
  const pool = createHouseholdPool(1);
  // Find a deterministic house with 2 adults AND 2 kids (boy + girl)
  let familyId = 'h1';
  for (let i = 1; i <= 200; i++) {
    const p = deriveHouseholdProfile(`h${i}`);
    if (p.residentCount === 2 && p.kidCount === 2) {
      familyId = `h${i}`;
      break;
    }
  }
  assignResidentPoolSlots(pool, [{ ...house, id: familyId }], 0, 0, 50);
  const slot = pool[0];
  assert.ok(slot.layout && slot.residents.length === 2 && slot.kids.length === 2);

  const adultVisited = new Set<ResidentPhase>();
  const kidVisited = new Set<ResidentPhase>();
  const doorThresholdZ = house.depth / 2 + 0.95;

  for (let step = 0; step < 3000; step++) {
    const all = [...slot.residents, ...slot.kids];
    const target = computeResidentDoorTarget(all, slot.layout);
    slot.doorOpen = stepDoorOpen(slot.doorOpen, target, 0.05);

    for (let m = 0; m < all.length; m++) {
      const partners = all.filter((_, idx) => idx !== m);
      stepResident(all[m], slot.layout, 0.05, slot.doorOpen, partners);
    }

    for (const a of slot.residents) adultVisited.add(a.phase);
    for (const k of slot.kids) kidVisited.add(k.phase);

    for (const r of all) {
      const inDoorwayLane = Math.abs(r.x) < 0.72 && r.z < doorThresholdZ;
      if (inDoorwayLane && r.phase !== 'INSIDE_HOUSE' && r.phase !== 'OPENING_DOOR_EXIT') {
        assert.ok(
          slot.doorOpen >= slot.layout.passThreshold - 0.01,
          `${r.role} crossed doorway at (${r.x.toFixed(2)}, ${r.z.toFixed(2)}) with doorOpen=${slot.doorOpen.toFixed(2)}`,
        );
      }
    }
  }

  for (const phase of [
    'SITTING',
    'STANDING_UP',
    'WALKING_TO_HOUSE',
    'OPENING_DOOR_ENTER',
    'ENTERING_HOUSE',
    'INSIDE_HOUSE',
    'OPENING_DOOR_EXIT',
    'WALKING_TO_CHAIR',
    'SITTING_DOWN',
  ] as ResidentPhase[]) {
    assert.ok(adultVisited.has(phase), `Adults must visit phase ${phase}`);
    assert.ok(kidVisited.has(phase), `Kids must visit phase ${phase}`);
  }
});

test('UShweCoupleBots and HouseResidentBots share singleton flyweight cache, ElderBotRig, and KidBotRig', () => {
  const ushweTsx = readFileSync('src/components/UShweCoupleBots.tsx', 'utf-8');
  const poolTsx = readFileSync('src/components/HouseResidentBots.tsx', 'utf-8');
  const kidTsx = readFileSync('src/components/KidBotRig.tsx', 'utf-8');
  const worldTsx = readFileSync('src/components/StreamedWorld.tsx', 'utf-8');

  assert.ok(ushweTsx.includes('ElderBotRig'), 'UShweCoupleBots must reuse shared ElderBotRig');
  assert.ok(poolTsx.includes('ElderBotRig') && poolTsx.includes('KidBotRig'), 'HouseResidentBots must reuse shared ElderBotRig & KidBotRig');
  assert.ok(
    ushweTsx.includes('getElderBotResourceCache') &&
      poolTsx.includes('getElderBotResourceCache') &&
      kidTsx.includes('getElderBotResourceCache'),
    'All bot rigs must share singleton flyweight geometry/material cache',
  );
  assert.ok(kidTsx.includes('coveredStride'), 'Kid girl dress must use coveredStride so legs never poke out');
  assert.ok(worldTsx.includes('<HouseResidentBots activeRegions={active} />'), 'StreamedWorld must mount HouseResidentBots');
});
