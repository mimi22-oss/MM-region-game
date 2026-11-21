import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WEIPULA_VILLAGE_HOUSES,
  createWeipulaVillagerRoster,
  createWeipulaVillagerRuntime,
  disposeWeipulaVillagerCache,
  getWeipulaVillagerCache,
  stepWeipulaVillager,
} from '../src/game/weipulaVillagers.ts';

test('Every house in Weipula Terraced Village has 5 to 10 Nurse & Chin ethnic residents', () => {
  const roster = createWeipulaVillagerRoster();
  assert.equal(WEIPULA_VILLAGE_HOUSES.length, 8, 'Weipula Village has 8 houses across 4 terraces');

  for (const h of WEIPULA_VILLAGE_HOUSES) {
    const members = roster.filter(r => r.houseId === h.id);
    assert.ok(
      members.length >= 5 && members.length <= 10,
      `${h.title} (${h.id}) has ${members.length} residents (must be 5..10)`,
    );
  }

  // Tier 4 Rural Clinic must have dedicated Nurses
  const clinicMembers = roster.filter(r => r.houseId === 'weipula-house-t4-east');
  const clinicNurses = clinicMembers.filter(r => r.kind === 'nurse');
  assert.ok(clinicNurses.length >= 4, `Rural Clinic has ${clinicNurses.length} nurses on duty`);

  // Village must include all Chin ethnic demographic groups + Nurses
  assert.ok(roster.some(r => r.kind === 'nurse'), 'Includes Rural Clinic Nurses');
  assert.ok(roster.some(r => r.kind === 'chin-woman'), 'Includes Chin women');
  assert.ok(roster.some(r => r.kind === 'chin-man'), 'Includes Chin men');
  assert.ok(roster.some(r => r.kind === 'chin-elder'), 'Includes Chin elders');
  assert.ok(roster.some(r => r.kind === 'chin-kid'), 'Includes Chin children');
});

test('Weipula villagers use a strict Singleton resource cache and walk safely inside terrace bounds', () => {
  const c1 = getWeipulaVillagerCache();
  const c2 = getWeipulaVillagerCache();
  assert.strictEqual(c1, c2, 'Villager cache is a strict Singleton reference');
  assert.strictEqual(c1.chinWeaveMats.length, 4, 'Four Chin woven traditional textile palettes cached');

  const roster = createWeipulaVillagerRoster();
  for (const desc of roster) {
    const rt = createWeipulaVillagerRuntime(desc);
    // Simulate 12 seconds of walking/pausing
    for (let step = 0; step < 120; step++) {
      stepWeipulaVillager(rt, 0.1);
      assert.ok(
        rt.u >= desc.minU - 0.01 && rt.u <= desc.maxU + 0.01,
        `${desc.id} u=${rt.u.toFixed(2)} stays inside terrace [${desc.minU}, ${desc.maxU}]`,
      );
      assert.ok(
        rt.v >= desc.minV - 0.01 && rt.v <= desc.maxV + 0.01,
        `${desc.id} v=${rt.v.toFixed(2)} stays inside terrace [${desc.minV}, ${desc.maxV}]`,
      );
      assert.ok(Number.isFinite(rt.x) && Number.isFinite(rt.z), `${desc.id} world coords remain finite`);
    }
  }

  disposeWeipulaVillagerCache();
});
