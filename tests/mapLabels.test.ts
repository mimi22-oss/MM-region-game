import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMapLabels, uniqueMapLabels } from '../src/game/mapLabels.ts';
import { worldMapLabels } from '../src/data/mapLabels.ts';
import { myotharCenterPOIs } from '../src/data/wards/myothar/center/myotharCenterPOIs.ts';

test('aerial labels preserve every custom POI at its rendered world coordinate', () => {
 for (const poi of myotharCenterPOIs) {
  const label = worldMapLabels.find(label => label.id === `poi:${poi.id}`);
  assert.ok(label, poi.name);
  assert.equal(label.x, poi.x); assert.equal(label.z, poi.z); assert.equal(label.name, poi.name);
 }
 assert.ok(worldMapLabels.some(label => label.id === 'area:kanbale'));
 assert.ok(worldMapLabels.some(label => label.id === 'poi:natmyaung-primary-school'));
 assert.equal(new Set(worldMapLabels.map(label => label.id)).size, worldMapLabels.length);
});

test('overlap layout prioritizes area names and rejects clipped/invalid labels', () => {
 const box = { x: 200, y: 180, width: 120, height: 40, priority: 1 };
 const result = layoutMapLabels([
  { ...box, id: 'shop' }, { ...box, id: 'area', priority: 100 },
  { ...box, id: 'other', x: 420 }, { ...box, id: 'offscreen', x: 590 },
  { ...box, id: 'invalid', x: NaN }, { ...box, id: 'top', y: 15 },
 ], 600, 400);
 assert.deepEqual(result.map(label => label.id), ['area', 'other']);
 assert.equal(layoutMapLabels(result, 600, 400, 1).length, 1);
 // Moving apart when zooming in reveals the previously overlapping name.
 assert.equal(layoutMapLabels([{ ...box, id: 'shop', x: 350 }, { ...box, id: 'area' }], 600, 400).length, 2);
});

test('deduplication prefers a custom label but preserves distant namesakes', () => {
 const base = { name: 'ကျောင်း', x: 0, z: 0, kind: 'place' as const, priority: 50 };
 const labels = uniqueMapLabels([{ ...base, id: 'destination' }, { ...base, id: 'custom', priority: 80 }, { ...base, id: 'far', z: 200 }]);
 assert.deepEqual(labels.map(label => label.id), ['custom', 'far']);
});
