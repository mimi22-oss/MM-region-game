import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ward } from '../src/data/ward.ts';
import { canStand } from '../src/game/collision.ts';
import { buildRoadGraph } from '../src/game/robotRoutes.ts';
import {
  createStreetPedestrianProfiles,
  createStreetPedestrianStates,
  desiredPedestrianCount,
  isDaytimeLivingHours,
  pickNearbyRoadNode,
  placePedestrianOnGraph,
  stepStreetPedestrian,
} from '../src/game/villageCrowd.ts';
import {
  assignResidentPoolSlots,
  createHouseholdPool,
  type ResidentHouseRecord,
} from '../src/game/houseResidentPool.ts';
import {
  computeResidentDoorTarget,
  computeResidentGateTarget,
  stepDoorOpen,
  stepResident,
  type ResidentPhase,
} from '../src/game/residentBots.ts';

test('Daytime schedule scales street crowd to bustling full pool by morning/day and quiet at night', () => {
  assert.equal(isDaytimeLivingHours(420, 'auto'), true, 'Morning (07:00) is active');
  assert.equal(isDaytimeLivingHours(780, 'auto'), true, 'Midday (13:00) is active');
  assert.equal(isDaytimeLivingHours(1020, 'auto'), true, 'Evening (17:00) is active');
  assert.equal(isDaytimeLivingHours(1260, 'auto'), false, 'Night (21:00) is quiet');
  assert.equal(isDaytimeLivingHours(780, 'night'), false, 'Explicit night mode overrides minute');
  assert.equal(isDaytimeLivingHours(1260, 'day'), true, 'Explicit day mode overrides minute');

  const dayCount = desiredPedestrianCount(780, 'day', 28);
  const morningCount = desiredPedestrianCount(420, 'morning', 28);
  const eveningCount = desiredPedestrianCount(1020, 'evening', 28);
  const nightCount = desiredPedestrianCount(1260, 'night', 28);

  assert.equal(dayCount, 28);
  assert.equal(morningCount, 28);
  assert.ok(eveningCount > nightCount && eveningCount < dayCount);
  assert.equal(nightCount, 0, 'At night, zero human street pedestrians remain on the roads');
});

test('Street pedestrian pool builds diverse Myanmar villagers walking along real connected road segments', () => {
  const clear = (x: number, z: number) => canStand(x, z);
  const graph = buildRoadGraph(ward.roads, clear);
  assert.ok(graph.length > 20, 'Myothar road graph must have connected road nodes');

  const profiles = createStreetPedestrianProfiles(28);
  const states = createStreetPedestrianStates(28);
  const roles = new Set(profiles.map((p) => p.role));
  assert.ok(roles.has('uncle') && roles.has('auntie') && roles.has('boy') && roles.has('girl'));
  assert.ok(profiles.some((p) => p.bottomStyle === 'trousers'), 'Pool includes young men in trousers');

  // Place all 28 villagers near AH1 / Myothar Area 5 and simulate walking
  for (let i = 0; i < 28; i++) {
    const startNode = pickNearbyRoadNode(graph, ward.spawn.x, ward.spawn.z, 5, 160, i * 17 + 3);
    assert.ok(startNode >= 0, `Must find road node for slot ${i}`);
    assert.equal(
      placePedestrianOnGraph(states[i], 'myothar', graph, startNode, profiles[i].sideOffset),
      true,
    );
  }

  let sawNeighborPause = false;
  for (let step = 0; step < 600; step++) {
    for (let i = 0; i < 28; i++) {
      stepStreetPedestrian(states[i], profiles[i], graph, 0.05);
      if (states[i].pauseTimer > 0) sawNeighborPause = true;
    }
  }

  for (let i = 0; i < 28; i++) {
    assert.ok(states[i].walkDistance > 5, `Street pedestrian ${i} must actively walk along roads`);
  }
  assert.ok(sawNeighborPause, 'Lane walkers should occasionally pause to visit roadside houses');
});

test('During daytime, home residents open compound gate before walking out to visit and open gate again to return home', () => {
  const house: ResidentHouseRecord = {
    id: 'daytime-outing-h1',
    x: 0,
    z: 0,
    width: 9,
    depth: 7,
    rotation: 0,
    porchY: 0.355,
    hasWideYard: true,
  };
  const pool = createHouseholdPool(1);
  assignResidentPoolSlots(pool, [house], 0, 0, 50);
  const slot = pool[0];
  assert.ok(slot.layout && slot.layout.gateZ !== undefined);

  const visited = new Set<ResidentPhase>();
  const gateZ = slot.layout.gateZ!;

  // Simulate 160s of daytime activity
  for (let step = 0; step < 3200; step++) {
    const all = [...slot.residents, ...slot.kids];
    slot.doorOpen = stepDoorOpen(slot.doorOpen, computeResidentDoorTarget(all, slot.layout), 0.05);
    slot.gateOpen = stepDoorOpen(slot.gateOpen, computeResidentGateTarget(all, slot.layout), 0.05);

    for (let m = 0; m < all.length; m++) {
      const partners = all.filter((_, idx) => idx !== m);
      stepResident(all[m], slot.layout, 0.05, {
        doorOpen: slot.doorOpen,
        gateOpen: slot.gateOpen,
        partners,
        daytimeOutings: true,
      });
    }

    for (const r of all) {
      visited.add(r.phase);
      // STRICT GATE INVARIANT: No resident may cross the compound gate plane unless gateOpen >= passThreshold!
      const crossingGate = Math.abs(r.x) < 1.3 && Math.abs(r.z - gateZ) < 0.25;
      if (crossingGate) {
        assert.ok(
          slot.gateOpen >= slot.layout.passThreshold - 0.01,
          `${r.role} crossed compound gate at z=${r.z.toFixed(2)} (gateZ=${gateZ}) while gateOpen=${slot.gateOpen.toFixed(2)}`,
        );
      }
    }
  }

  for (const phase of [
    'WALKING_TO_GATE',
    'OPENING_GATE_OUT',
    'OUT_VISITING',
    'OPENING_GATE_IN',
    'WALKING_FROM_GATE',
  ] as ResidentPhase[]) {
    assert.ok(visited.has(phase), `Daytime household must visit outing phase ${phase}`);
  }

  // Night falls: every resident outside or on the porch must return into INSIDE_HOUSE and stay indoors all night!
  for (let step = 0; step < 1600; step++) {
    const all = [...slot.residents, ...slot.kids];
    slot.doorOpen = stepDoorOpen(slot.doorOpen, computeResidentDoorTarget(all, slot.layout), 0.05);
    slot.gateOpen = stepDoorOpen(slot.gateOpen, computeResidentGateTarget(all, slot.layout), 0.05);
    for (let m = 0; m < all.length; m++) {
      const partners = all.filter((_, idx) => idx !== m);
      stepResident(all[m], slot.layout, 0.05, {
        doorOpen: slot.doorOpen,
        gateOpen: slot.gateOpen,
        partners,
        daytimeOutings: false,
        nighttime: true,
      });
    }
  }
  for (const r of [...slot.residents, ...slot.kids]) {
    assert.equal(r.phase, 'INSIDE_HOUSE', `At night, ${r.role} must be inside house (got ${r.phase})`);
    assert.equal(r.visible, false, `At night, ${r.role} must stay indoors (hidden outside)`);
  }
});

test('StreamedWorld wires daytime time/mode into HouseResidentBots and VillagePedestrianBots sharing flyweight rigs', () => {
  const worldTsx = readFileSync('src/components/StreamedWorld.tsx', 'utf-8');
  const pedTsx = readFileSync('src/components/VillagePedestrianBots.tsx', 'utf-8');
  const housePoolTsx = readFileSync('src/components/HouseResidentBots.tsx', 'utf-8');

  assert.ok(worldTsx.includes('<HouseResidentBots activeRegions={active} minute={minute} timeMode={timeMode} />'));
  assert.ok(worldTsx.includes('<VillagePedestrianBots activeRegions={active} minute={minute} timeMode={timeMode} />'));
  assert.ok(pedTsx.includes('ElderBotRig') && pedTsx.includes('KidBotRig'), 'Street bots must share flyweight rigs');
  assert.ok(pedTsx.includes('buildRoadGraph'), 'Street bots must follow real connected road graphs');
  assert.ok(housePoolTsx.includes('pooled-house-front-gate'), 'Pooled houses must render animated double compound gates');
});

test('House and SiThar front fences do not leave static blue gate sheets overlapping animated compound gates', () => {
  const houseTsx = readFileSync('src/components/House.tsx', 'utf-8');
  const sitharTsx = readFileSync('src/components/villages/sithar/SiTharBuilding.tsx', 'utf-8');
  const housePoolTsx = readFileSync('src/components/HouseResidentBots.tsx', 'utf-8');

  assert.ok(!houseTsx.includes('#2b6cb0'), 'House.tsx must not render static blue gate sheets inside the gate opening');
  assert.ok(!houseTsx.includes('!owned'), 'BlueSheetFrontFence must not render static !owned gate leaves');
  assert.ok(houseTsx.includes('postOuterEdge=halfGate+0.08'), 'BlueSheetSection wings must stop at the outer edge of gate posts');
  assert.ok(!sitharTsx.includes('#2b6cb0'), 'SiTharBuilding.tsx must not leave a static blue gate sheet blocking the opening');
  assert.ok(housePoolTsx.includes('position={[0, 0, front + 2.6]}'), 'Animated compound gate must align exactly with frontHalf');
});
