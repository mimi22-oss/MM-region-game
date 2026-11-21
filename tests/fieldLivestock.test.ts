import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  disposeFieldLivestockAssetCache,
  getFieldLivestockAssetCache,
} from '../src/game/fieldLivestockAssets.ts';
import {
  ALL_WORLD_PADDY_FIELDS,
  BUFFALOES_PER_FIELD,
  COWS_PER_FIELD,
  FieldLivestockFixedPoolController,
  HORSES_PER_FIELD,
  LIVESTOCK_PER_FIELD,
  buildFieldLivestockRoster,
} from '../src/game/fieldLivestockPool.ts';

test('FieldLivestockAssetCache is a strict Singleton GPU cache with zero duplication', () => {
  const c1 = getFieldLivestockAssetCache();
  const c2 = getFieldLivestockAssetCache();
  assert.strictEqual(c1, c2, 'Returns the exact same singleton instance');
  const { cow, buffalo, horse } = c1.models;
  assert.ok(cow.meshes.horns && buffalo.meshes.horns && horse.meshes.mane);
  assert.equal(horse.meshes.horns, null);
  assert.ok(horse.bodyY > buffalo.bodyY);
  assert.ok(cow.front.hoof.getAttribute('position').count > horse.front.hoof.getAttribute('position').count);
  for (const palette of Object.values(c1.coats)) assert.ok(palette.length >= 3);
  for (const geometry of [cow.meshes.horns, buffalo.meshes.horns]) geometry.computeBoundingBox();
  assert.ok(buffalo.meshes.horns.boundingBox!.max.x > cow.meshes.horns.boundingBox!.max.x * 2);

  disposeFieldLivestockAssetCache();
  const c3 = getFieldLivestockAssetCache();
  assert.notStrictEqual(c3, c1, 'Recreates cleanly after explicit disposal');
  disposeFieldLivestockAssetCache();
});

test('Every paddy field across the map receives exactly 2 Cows, 4 Buffaloes, and 1 Horse (7 livestock per field)', () => {
  assert.ok(ALL_WORLD_PADDY_FIELDS.length >= 450, `Expected >=450 paddy fields across map, got ${ALL_WORLD_PADDY_FIELDS.length}`);
  assert.equal(COWS_PER_FIELD, 2);
  assert.equal(BUFFALOES_PER_FIELD, 4);
  assert.equal(HORSES_PER_FIELD, 1);
  assert.equal(LIVESTOCK_PER_FIELD, 7);

  const roster = buildFieldLivestockRoster(ALL_WORLD_PADDY_FIELDS);
  assert.equal(roster.length, ALL_WORLD_PADDY_FIELDS.length * 7);

  const regionsWithFields = new Set(ALL_WORLD_PADDY_FIELDS.map(f => f.regionId));
  for (const r of ['myothar', 'tharsi', 'chinsai', 'zingalin', 'htomar', 'tharyargone', 'htaukkyant', 'kyarinn', 'sithar', 'natmyaung']) {
    assert.ok(regionsWithFields.has(r), `Paddy fields in region ${r} are covered`);
  }

  for (let fi = 0; fi < ALL_WORLD_PADDY_FIELDS.length; fi++) {
    const f = ALL_WORLD_PADDY_FIELDS[fi];
    const slice = roster.slice(fi * 7, fi * 7 + 7);
    const cows = slice.filter(a => a.species === 'cow').length;
    const buffaloes = slice.filter(a => a.species === 'buffalo').length;
    const horses = slice.filter(a => a.species === 'horse').length;
    assert.equal(cows, 2, `Field ${f.id} must have exactly 2 cows`);
    assert.equal(buffaloes, 4, `Field ${f.id} must have exactly 4 buffaloes`);
    assert.equal(horses, 1, `Field ${f.id} must have exactly 1 horse`);

    // Verify all 7 animals spawn strictly inside the field's interior
    for (const a of slice) {
      assert.ok(Math.abs(a.lx) <= f.width / 2, `${a.id} stays inside field width`);
      assert.ok(Math.abs(a.lz) <= f.depth / 2, `${a.id} stays inside field depth`);
    }
  }
});

test('FieldLivestockFixedPoolController animates grazing -> head-lift looking-around -> strolling within fixed slot budget', () => {
  const sampleFields = ALL_WORLD_PADDY_FIELDS.slice(0, 12);
  const pool = new FieldLivestockFixedPoolController(21, 200, sampleFields);
  const f0 = sampleFields[0];

  try {
    pool.update(f0.x, f0.z, 0.05, true);
    assert.equal(pool.slots.length, 21, 'Pool preserves strictly fixed capacity');

    const active = pool.slots.map(s => s.animal).filter(Boolean);
    assert.ok(active.length >= 7, `Nearest field fills pool with full 7-animal herd (got ${active.length})`);

    // Nearest field's full 2 cows + 4 buffaloes + 1 horse are present
    const f0Active = active.filter(a => a!.fieldId === f0.id);
    assert.equal(f0Active.filter(a => a!.species === 'cow').length, 2);
    assert.equal(f0Active.filter(a => a!.species === 'buffalo').length, 4);
    assert.equal(f0Active.filter(a => a!.species === 'horse').length, 1);

    // Step simulation over 16 seconds and confirm grazing, head-lifting looking-around, and strolling all occur!
    const seenBehaviors = new Set<string>();
    let sawHeadDownGrazing = false;
    let sawHeadUpLooking = false;
    let sawHeadScanningYaw = false;

    for (let step = 0; step < 320; step++) {
      pool.update(f0.x, f0.z, 0.05, false);
      for (const s of pool.slots) {
        const a = s.animal;
        if (!a) continue;
        seenBehaviors.add(a.behavior);
        if (a.behavior === 'grazing' && a.neckPitch > 0.6) sawHeadDownGrazing = true;
        if (a.behavior === 'looking-around' && a.neckPitch < 0.1) sawHeadUpLooking = true;
        if (a.behavior === 'looking-around' && Math.abs(a.headYaw) > 0.25) sawHeadScanningYaw = true;
      }
    }

    assert.ok(seenBehaviors.has('grazing'), 'Animals graze on grass');
    assert.ok(seenBehaviors.has('looking-around'), 'Animals lift heads to look around');
    assert.ok(seenBehaviors.has('strolling'), 'Animals stroll to fresh grass spots inside their field');
    assert.equal(sawHeadDownGrazing, true, 'Neck pitches down to grass level while grazing');
    assert.equal(sawHeadUpLooking, true, 'Neck lifts upright while looking around');
    assert.equal(sawHeadScanningYaw, true, 'Head pans left/right scanning surroundings');
  } finally {
    pool.dispose();
  }

  const streamedWorldSrc = readFileSync('src/components/StreamedWorld.tsx', 'utf8');
  assert.ok(streamedWorldSrc.includes('<FieldLivestockBots'), 'StreamedWorld mounts live FieldLivestockBots');
});
