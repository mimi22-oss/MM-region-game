import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { angle, farmhouse } from '../src/data/ward.ts';
import { HUMAN_PRESETS, effectiveHumanHeightScale } from '../src/data/appearance.ts';
import { canStand } from '../src/game/collision.ts';
import {
  FARMHOUSE_FAMILY_MEMBERS,
  createFarmhouseFamilyStates,
  stepFarmhouseFamilyMember,
  type FamilyActivityPhase,
} from '../src/game/farmhouseFamilyBot.ts';

function farmhouseLocalToWorld(lx: number, lz: number) {
  const rot = angle + Math.PI / 2;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x: farmhouse.x + lx * c + lz * s,
    z: farmhouse.z - lx * s + lz * c,
  };
}

test('Farmhouse 4 family members start seated at the exact user-specified dining chair coordinates', () => {
  const states = createFarmhouseFamilyStates();
  assert.equal(states.length, 4);

  const expectedWorld: Record<string, { x: number; z: number; yaw: number }> = {
    mom: { x: 138.911, z: 241.937, yaw: 0 },
    dad: { x: 139.406, z: 242.432, yaw: 0 },
    'older-brother': { x: 139.901, z: 242.927, yaw: 0 },
    'younger-sister': { x: 141.103, z: 241.724, yaw: Math.PI },
  };

  for (const st of states) {
    assert.equal(st.activityPhase, 'SITTING');
    assert.equal(st.sitBlend, 1);
    const w = farmhouseLocalToWorld(st.x, st.z);
    const exp = expectedWorld[st.memberId];
    assert.ok(exp, `Unexpected member ${st.memberId}`);
    assert.ok(
      Math.hypot(w.x - exp.x, w.z - exp.z) < 0.02,
      `${st.memberId} seated world pos (${w.x.toFixed(3)}, ${w.z.toFixed(3)}) must match requested (${exp.x}, ${exp.z})`,
    );
    assert.ok(Math.abs(st.yaw - exp.yaw) < 0.001, `${st.memberId} must face dining table`);
  }
});

test('Farmhouse family members walk collision-free indoor routes and complete full dining-to-room cycles', () => {
  const states = createFarmhouseFamilyStates();
  const visitedByMember = states.map(() => new Set<FamilyActivityPhase>());

  // Check every walking waypoint & intermediate sample against real Farmhouse collision (`canStand`)
  for (const cfg of FARMHOUSE_FAMILY_MEMBERS) {
    for (let i = 0; i < cfg.pathToSpot.length - 1; i++) {
      const a = cfg.pathToSpot[i];
      const b = cfg.pathToSpot[i + 1];
      for (let s = 0; s <= 10; s++) {
        const t = s / 10;
        const lx = a.x + (b.x - a.x) * t;
        const lz = a.z + (b.z - a.z) * t;
        const w = farmhouseLocalToWorld(lx, lz);
        assert.equal(
          canStand(w.x, w.z),
          true,
          `${cfg.id} path segment ${i} at local (${lx.toFixed(2)}, ${lz.toFixed(2)}) must be collision-free`,
        );
      }
    }
  }

  // Simulate 90 seconds and verify all 4 family members visit every activity phase
  for (let step = 0; step < 1800; step++) {
    for (let i = 0; i < states.length; i++) {
      stepFarmhouseFamilyMember(states[i], FARMHOUSE_FAMILY_MEMBERS[i], 0.05);
      visitedByMember[i].add(states[i].activityPhase);
    }
  }

  const required: FamilyActivityPhase[] = [
    'SITTING',
    'STANDING_UP',
    'WALKING_TO_SPOT',
    'AT_SPOT',
    'WALKING_TO_SEAT',
    'SITTING_DOWN',
  ];
  for (let i = 0; i < states.length; i++) {
    for (const phase of required) {
      assert.ok(
        visitedByMember[i].has(phase),
        `${FARMHOUSE_FAMILY_MEMBERS[i].id} must visit phase ${phase}`,
      );
    }
  }
});

test('FarmhouseFamilyBots reuses shared singleton flyweight rigs, Older Brother wears long trousers, and player is shorter than Dad & Older Brother', () => {
  const familyTsx = readFileSync('src/components/FarmhouseFamilyBots.tsx', 'utf-8');
  const farmhouseTsx = readFileSync('src/components/Farmhouse.tsx', 'utf-8');
  const elderRigTsx = readFileSync('src/components/ElderBotRig.tsx', 'utf-8');

  assert.ok(farmhouseTsx.includes('<FarmhouseFamilyBots />'), 'Farmhouse must mount FarmhouseFamilyBots');
  assert.ok(familyTsx.includes('ElderBotRig') && familyTsx.includes('KidBotRig'), 'Must reuse flyweight ElderBotRig & KidBotRig');
  assert.ok(familyTsx.includes('bottomStyle={brother.bottomStyle}'), 'Must pass long trousers bottomStyle to Older Brother');
  assert.ok(elderRigTsx.includes('elder-trousers-left'), 'ElderBotRig must render articulated long trousers');
  assert.ok(familyTsx.includes('userData={{ dynamic: true }}'), 'Must opt out of StaticBatch');
  assert.ok(familyTsx.includes('useRegionFrame'), 'Must pause off-region via useRegionFrame');
  assert.ok(!familyTsx.includes('new MeshStandardMaterial'), 'Zero new materials — shares singleton cache');

  const dad = FARMHOUSE_FAMILY_MEMBERS.find((m) => m.id === 'dad')!;
  const brother = FARMHOUSE_FAMILY_MEMBERS.find((m) => m.id === 'older-brother')!;
  assert.equal(brother.bottomStyle, 'trousers', 'Older Brother must wear long trousers');

  // Compare actual rendered heights (ElderBotRig base = 1.735m, GlbHuman base = 1.80m)
  const dadHeightM = 1.735 * dad.heightScale;
  const brotherHeightM = 1.735 * brother.heightScale;
  const boyPlayerHeightM = 1.8 * effectiveHumanHeightScale('boy', HUMAN_PRESETS.boy.height);
  const girlPlayerHeightM = 1.8 * effectiveHumanHeightScale('girl', HUMAN_PRESETS.girl.height);

  assert.ok(
    boyPlayerHeightM < brotherHeightM && brotherHeightM < dadHeightM,
    `Expected boy (${boyPlayerHeightM.toFixed(2)}m) < older brother (${brotherHeightM.toFixed(2)}m) < dad (${dadHeightM.toFixed(2)}m)`,
  );
  assert.ok(
    girlPlayerHeightM < brotherHeightM && girlPlayerHeightM < dadHeightM,
    `Expected girl (${girlPlayerHeightM.toFixed(2)}m) shorter than older brother & dad`,
  );
});
