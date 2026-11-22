import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSET_REGISTRY, getAssetDefinition, searchAssets } from '../src/game/assetRegistry.ts';
import {
  CARDINAL_DIRECTIONS,
  EDITOR_QUICK_JUMPS,
  compassDegToRotationRad,
  createDrawnPathFeature,
  createFeatureFromAsset,
  deleteFeatureFromLayout,
  duplicateFeatureInLayout,
  moveFeatureInLayout,
  patchFeatureInLayout,
  rotateFeatureByDegrees,
  rotateFeatureCardinal,
  rotationRadToCompassDeg,
} from '../src/game/scene3dEditorOps.ts';
import { isAuthoredFeatureModified } from '../src/game/worldEdits.ts';
import { emptyLayout, validLayout } from '../src/game/worldLayout.ts';

test('3D Asset Registry exposes all user-requested monastery, pagoda, prop, bridge, mountain, lake, and tomb components', () => {
  const requiredAssetIds = [
    'building:monastery-hall',
    'building:monastery-kyaung',
    'building:monastery-refectory',
    'building:forest-monastery',
    'building:mountain-zayat',
    'cultural:golden-stupa',
    'cultural:burmese-tomb',
    'infrastructure:bridge',
    'nature:mountain-peak',
    'nature:mountain-lake',
    'furniture:buddha-shrine',
    'furniture:round-dining-table',
    'furniture:woven-mat',
    'furniture:meditation-mat',
    'furniture:alms-bowl',
    'furniture:offering-bowl',
    'furniture:tiffin-carrier',
    'furniture:rice-sack',
    'furniture:ceramic-jar',
    'furniture:rice-cauldron',
    'furniture:scripture-shelf',
    'furniture:alms-shelf',
  ];

  for (const id of requiredAssetIds) {
    const def = getAssetDefinition(id);
    assert.ok(def, `Asset ${id} must exist in ASSET_REGISTRY`);
    assert.ok(def.nameMm.length > 0, `Asset ${id} has Myanmar label`);
  }

  assert.ok(searchAssets('ဘုန်းကြီးကျောင်း').length >= 3, 'Burmese search finds monastery components');
  assert.ok(searchAssets('တံတား').length >= 1, 'Burmese search finds bridge component');
  assert.ok(searchAssets('တောင်').length >= 1, 'Burmese search finds mountain component');
  assert.ok(EDITOR_QUICK_JUMPS.some((j) => j.id === 'myothar-monastery'), 'Quick Jump includes Myothar Monastery');
});

test('Full 3D CRUD lifecycle: Create (Drag & Drop), Move (X/Y/Z), Rotate (N/E/S/W & fine), Resize, Duplicate, Delete', () => {
  let layout = emptyLayout();

  // 1. CREATE: Drop a Monastery Dining Table on the 2nd floor of the refectory (Y = 4.05m)
  const tableDef = ASSET_REGISTRY['furniture:round-dining-table'];
  const table = createFeatureFromAsset(tableDef, 187.1, -55.2, 4.05, 0);
  layout = { ...layout, features: [...layout.features, table] };
  assert.equal(validLayout(layout), true);
  assert.equal(layout.features.length, 1);
  assert.equal(layout.features[0].elevationY, 4.05);

  // 2. ROTATE N / E / S / W
  for (const dir of CARDINAL_DIRECTIONS) {
    layout = rotateFeatureCardinal(layout, table.id, dir.key);
    const updated = layout.features.find((f) => f.id === table.id)!;
    assert.equal(rotationRadToCompassDeg(updated.rotation ?? 0), dir.deg, `Cardinal ${dir.key} maps to ${dir.deg}°`);
  }

  // Fine rotation +15° / -15°
  layout = rotateFeatureCardinal(layout, table.id, 'north');
  layout = rotateFeatureByDegrees(layout, table.id, 15);
  assert.equal(rotationRadToCompassDeg(layout.features[0].rotation ?? 0), 15);
  assert.ok(Math.abs((layout.features[0].rotation ?? 0) - compassDegToRotationRad(15)) < 1e-6);

  // 3. MOVE (drag in 3D across X/Y/Z)
  layout = moveFeatureInLayout(layout, table.id, 192.5, -51.0, 0.48);
  assert.equal(layout.features[0].points[0].x, 192.5);
  assert.equal(layout.features[0].points[0].z, -51.0);
  assert.equal(layout.features[0].elevationY, 0.48);

  // 4. UPDATE color / scale / dimensions
  layout = patchFeatureInLayout(layout, table.id, { scale: 1.4, color: '#a855f7' });
  assert.equal(layout.features[0].scale, 1.4);
  assert.equal(layout.features[0].color, '#a855f7');

  // 5. DUPLICATE
  const dup = duplicateFeatureInLayout(layout, table.id, 3, 2);
  layout = dup.layout;
  assert.ok(dup.duplicatedId);
  assert.equal(layout.features.length, 2);
  const copy = layout.features.find((f) => f.id === dup.duplicatedId)!;
  assert.equal(copy.points[0].x, 195.5);
  assert.equal(copy.points[0].z, -49.0);

  // 6. DELETE custom item
  layout = deleteFeatureFromLayout(layout, table.id);
  assert.equal(layout.features.length, 1);
  assert.equal(layout.features[0].id, dup.duplicatedId);
});

test('Drag & Draw creates valid 3D Bridge, Road & Canal paths and deleting authored features records deletedSourceIds', () => {
  const bridge = createDrawnPathFeature(
    'bridge',
    [
      { x: 100, z: 200 },
      { x: 140, z: 200 },
    ],
    9.5,
    6.2,
  );
  assert.equal(bridge.kind, 'road');
  assert.equal(bridge.assetId, 'infrastructure:bridge');
  assert.equal(bridge.metadata?.category, 'bridge');
  assert.equal(bridge.width, 9.5);
  assert.equal(bridge.elevationY, 6.2);

  // Existing authored feature tracks elevationY edits AND deletion via deletedSourceIds
  const authoredHouse = {
    id: 'house-authored-1',
    kind: 'house' as const,
    name: 'Existing House',
    points: [{ x: 10, z: 20 }],
    rotation: 0,
    elevationY: 0,
    metadata: {
      authored: true,
      sourceId: 'src-house-1',
      sourceSnapshot: {
        name: 'Existing House',
        points: [{ x: 10, z: 20 }],
        rotation: 0,
        elevationY: 0,
      },
    },
  };
  assert.equal(isAuthoredFeatureModified(authoredHouse), false);
  const lifted = { ...authoredHouse, elevationY: 2.5 };
  assert.equal(isAuthoredFeatureModified(lifted), true, 'Changing elevationY marks authored feature as modified');

  let layout = { ...emptyLayout(), features: [authoredHouse, bridge] };
  layout = deleteFeatureFromLayout(layout, authoredHouse.id);
  assert.ok(layout.deletedSourceIds?.includes('src-house-1'), 'Deleting authored item hides original static mesh in live 3D site');
  assert.equal(layout.features.length, 1);
});
