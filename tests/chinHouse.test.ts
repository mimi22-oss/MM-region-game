import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  disposeChinHouseAssetCache,
  getChinHouseAssetCache,
} from '../src/game/chinHouseAssets.ts';

test('ChinTraditionalHouse provides a strict Singleton asset cache for Hornbill roof emblems & Chin symbols', () => {
  const c1 = getChinHouseAssetCache();
  const c2 = getChinHouseAssetCache();
  assert.strictEqual(c1, c2, 'Chin house cache returns the exact same singleton reference');
  assert.ok(c1.hornbillBeakUpperGeo && c1.hornbillCasqueGeo && c1.hornbillWingGeo && c1.hornbillTailBandGeo);
  assert.ok(c1.mithunHornGeo && c1.chinFriezeMat);

  disposeChinHouseAssetCache();
  const c3 = getChinHouseAssetCache();
  assert.notStrictEqual(c3, c1, 'Re-creates cleanly after explicit disposal');
  disposeChinHouseAssetCache();
});

test('Mountains.tsx uses the extracted ChinTraditionalHouse & ChinHornbillRoofEmblem components', () => {
  const src = readFileSync('src/components/Mountains.tsx', 'utf8');
  assert.ok(src.includes("from './ChinTraditionalHouse'"), 'Imports extracted ChinTraditionalHouse component');
  assert.ok(src.includes('<ChinTraditionalHouse'), 'Renders ChinTraditionalHouse in WeipulaVillage');
  assert.ok(src.includes('<ChinHornbillRoofEmblem'), 'Renders Hornbill emblems on gate/tea shop roofs');
  assert.equal(src.includes('function MountainVillageHouse'), false, 'Legacy inline MountainVillageHouse removed');
});
