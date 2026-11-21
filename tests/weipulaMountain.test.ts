import test from 'node:test';
import assert from 'node:assert/strict';
import { ward, toWorld } from '../src/data/ward.ts';
import { mountainHeight } from '../src/game/mountainTerrain.ts';
import { canStand } from '../src/game/collision.ts';
import { detectLocation, MAP_DESTINATIONS } from '../src/game/locationDetect.ts';
import { natmyaungWeipulaSeparationFields } from '../src/data/villages/natmyaung/separationFields.ts';
import {
  MAHA_WEIPULA_BASE_GATE_UV,
  MAHA_WEIPULA_PLAZA_UV,
  MAHA_WEIPULA_SUMMIT_UV,
  buildWeipulaRoadSegments,
  buildWeipulaSlopeFlora,
  buildWeipulaStairway,
} from '../src/game/weipulaClimb.ts';

const foregroundPeaks = [...ward.mountains, ...ward.weipula.peaks];

test('Maha Weipula Mountain is 10x taller (~1,320m) with broad natural climbable proportions', () => {
  const summit = ward.weipula.peaks[2];
  assert.equal(summit.u, MAHA_WEIPULA_SUMMIT_UV.u);
  assert.equal(summit.v, MAHA_WEIPULA_SUMMIT_UV.v);

  assert.ok(summit.radius >= 1400, 'Mountain massif radius is broad (>= 1,400m)');
  const summitH = mountainHeight(summit.u, summit.v, foregroundPeaks);
  assert.ok(summitH >= 1280 && summitH <= 1380, `Summit height ${summitH}m is ~10x taller (~1,320m)`);
  assert.ok(summitH / summit.radius < 1.0, 'Height-to-radius ratio forms a natural mountain slope, not a cliff');

  const baseH = mountainHeight(summit.u, 4595, foregroundPeaks);
  assert.equal(baseH, 0, 'Valley floor north of base archway starts cleanly at y = 0m');

  let prevH = baseH;
  for (let v = 4620; v <= 6120; v += 45) {
    const h = mountainHeight(summit.u, v, foregroundPeaks);
    assert.ok(h >= prevH - 6, `Height rises smoothly toward summit at v=${v} (${h.toFixed(1)} vs ${prevH.toFixed(1)})`);
    prevH = h;
  }

  for (let v = 4600; v < 6120; v += 10) {
    const dh = mountainHeight(summit.u, v + 0.15, foregroundPeaks) - mountainHeight(summit.u, v, foregroundPeaks);
    assert.ok(dh < 0.45, `Direct slope step dh=${dh.toFixed(3)}m at v=${v} is smoothly climbable (< 0.5m)`);
  }
});

test('Maha Weipula switchback highway and pilgrim stairway stay strictly ABOVE terrain (never buried) and climb smoothly to 1,320m', () => {
  const summitH = mountainHeight(MAHA_WEIPULA_SUMMIT_UV.u, MAHA_WEIPULA_SUMMIT_UV.v, foregroundPeaks);
  const roadSegs = buildWeipulaRoadSegments(foregroundPeaks);
  assert.ok(roadSegs.length >= 160, 'Contour-hugging switchback highway has dense pitched segments');

  // Starts on flat valley floor south of the 10 paddy fields and arrives at 1,320m summit plaza
  assert.ok(roadSegs[0].y1 < 0.5, `Road starts at base elevation (y=${roadSegs[0].y1.toFixed(2)}m)`);
  const lastSeg = roadSegs[roadSegs.length - 1];
  assert.ok(Math.abs(lastSeg.y2 - summitH) < 5.0, `Road reaches summit plaza (y=${lastSeg.y2.toFixed(1)} vs ${summitH.toFixed(1)})`);

  // EVERY SINGLE segment from AH1 -> (-635, 4665) ridge pass -> Base Gate -> 1,320m Summit must be:
  // (a) strictly ABOVE terrain (NEVER tunneling underneath any mountain!), (b) smooth <= 30% grade, (c) continuous
  let foundRidgePass = false;
  for (let i = 0; i < roadSegs.length; i++) {
    const seg = roadSegs[i];
    const midU = (seg.u1 + seg.u2) / 2;
    const midV = (seg.v1 + seg.v2) / 2;
    const terrainAtMid = mountainHeight(midU, midV, foregroundPeaks);
    assert.ok(
      seg.y >= terrainAtMid + 0.05,
      `Road segment ${i} at (${midU.toFixed(0)}, ${midV.toFixed(0)}) (y=${seg.y.toFixed(2)}) stays strictly above terrain (${terrainAtMid.toFixed(2)})`,
    );
    if (Math.hypot(midU - (-635), midV - 4665) < 40) {
      foundRidgePass = true;
      assert.ok(seg.y > 140, `Winding road crosses OVER the top of the (-635, 4665) ridge (y=${seg.y.toFixed(1)}m)`);
    }
    assert.ok(seg.grade <= 0.30, `Road segment ${i} grade ${seg.grade.toFixed(3)} is smooth & climbable (<= 30%)`);
    assert.ok(seg.grade * 0.15 < 0.06, `Road segment ${i} per-step rise is well below 0.5m`);
    if (i > 0) {
      assert.ok(Math.abs(seg.y1 - roadSegs[i - 1].y2) < 0.01, `Road segment ${i} joins continuously with previous segment`);
    }
  }
  assert.equal(foundRidgePass, true, 'Road winds directly over the (-635, 4665) mountain ridge pass');

  // Direct northern pilgrim stairway from base gate to 1,320m pagoda entrance — strictly above terrain
  const stairway = buildWeipulaStairway(foregroundPeaks);
  assert.ok(stairway.flights.length >= 50, 'Pilgrim stairway spans the full north ridge');
  assert.ok(stairway.flights[0].y1 < 2.0, 'Stairway starts at the mountain base');
  const topFlight = stairway.flights[stairway.flights.length - 1];
  assert.ok(Math.abs(topFlight.y2 - summitH) < 6.0, 'Stairway reaches the 1,320m summit pagoda terrace');
  assert.equal(stairway.pavilions.length, 4, 'Four mid-mountain pilgrim rest pavilions exist');
  for (const f of stairway.flights) {
    const midV = (f.v1 + f.v2) / 2;
    const terrainH = mountainHeight(MAHA_WEIPULA_SUMMIT_UV.u, midV, foregroundPeaks);
    assert.ok(f.y >= terrainH + 0.1, `Stairway flight ${f.key} stays cleanly visible above terrain`);
    assert.ok(f.grade * 0.15 < 0.45, `Stairway flight ${f.key} step rise is smoothly walkable`);
  }
});

test('Mountain is blanketed with lush green forest & meadow bushes, 10 separation fields sit flat, and teleports work', () => {
  assert.equal(natmyaungWeipulaSeparationFields.length, 10, 'Exactly 10 paddy fields separate Nat Myaung and Maha Weipula');
  for (const f of natmyaungWeipulaSeparationFields) {
    assert.equal(mountainHeight(f.u, f.v, foregroundPeaks), 0, `${f.id} sits on flat valley floor clear of mountain foothills`);
    assert.equal(canStand(f.x, f.z), true, `${f.id} center is walkable`);
  }

  const { trees, grassTufts } = buildWeipulaSlopeFlora(foregroundPeaks, false);
  assert.ok(trees.length >= 600, `Mountain is densely forested with lush green trees (got ${trees.length})`);
  assert.ok(grassTufts.length >= 300, `Mountain has abundant green meadow shrubs/grass clusters (got ${grassTufts.length})`);

  const baseTp = MAP_DESTINATIONS.find(t => t.id === 'weipula-base');
  const summitTp = MAP_DESTINATIONS.find(t => t.id === 'weipula');
  assert.ok(baseTp, 'weipula-base teleport exists for climbing from the foot of the mountain');
  assert.ok(summitTp, 'weipula summit teleport exists');
  assert.equal(canStand(baseTp!.x, baseTp!.z), true, 'Base trailhead teleport is walkable');
  assert.equal(canStand(summitTp!.x, summitTp!.z), true, 'Summit plaza teleport is walkable');

  const baseGateWorld = toWorld(MAHA_WEIPULA_BASE_GATE_UV.u, MAHA_WEIPULA_BASE_GATE_UV.v);
  assert.equal(canStand(baseGateWorld.x, baseGateWorld.z), true, 'Base welcome archway is walkable');
  assert.equal(detectLocation(baseGateWorld.x, baseGateWorld.z).id, 'weipula-base');

  const plazaWorld = toWorld(MAHA_WEIPULA_PLAZA_UV.u, MAHA_WEIPULA_PLAZA_UV.v);
  assert.equal(canStand(plazaWorld.x, plazaWorld.z), true, 'Summit plaza is walkable');
  assert.equal(detectLocation(plazaWorld.x, plazaWorld.z).id, 'weipula');
});
