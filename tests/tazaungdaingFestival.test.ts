import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_FESTIVAL_ZONES,
  MYOTHAR_FESTIVAL_HUB,
  TAZAUNGDAING_END_DATE,
  TAZAUNGDAING_START_DATE,
  createDefaultFestivalConfig,
  formatLocalCalendarDate,
  getFestivalConfiguration,
  isDateWithinFestivalWindow,
  isFestivalActive,
  resetFestivalConfiguration,
  resolveActiveFestivalZones,
  sanitizeFestivalConfig,
  setFestivalEnabled,
  updateFestivalConfiguration,
} from '../src/festivals/FestivalConfiguration.ts';
import {
  getFestivalPlugin,
  listFestivalPlugins,
  registerFestivalPlugin,
  resolveActiveFestivalPlugin,
  unregisterFestivalPlugin,
  type FestivalPlugin,
} from '../src/festivals/FestivalRegistry.ts';
import {
  buildBalloonShowDescriptors,
  buildFestivalDecorationPlacements,
  evaluateBalloonTransform,
} from '../src/festivals/festivalSimulation.ts';
import {
  BALLOON_LAUNCH,
  balloonLanding,
  createBalloonRide,
  stepBalloon,
} from '../src/game/balloonRide.ts';
import { isThadingyutFestivalActive } from '../src/game/thadingyutFestival.ts';

test('Tazaungdaing official festival calendar window covers 2026-11-15 through 2026-11-24 inclusive', () => {
  assert.equal(TAZAUNGDAING_START_DATE, '2026-11-15');
  assert.equal(TAZAUNGDAING_END_DATE, '2026-11-24');

  const beforeStart = new Date(2026, 10, 14, 23, 59, 0);
  const startDay = new Date(2026, 10, 15, 0, 1, 0);
  const midFestival = new Date(2026, 10, 20, 19, 30, 0);
  const endDay = new Date(2026, 10, 24, 23, 59, 0);
  const afterEnd = new Date(2026, 10, 25, 0, 1, 0);

  assert.equal(formatLocalCalendarDate(startDay), '2026-11-15');
  assert.equal(formatLocalCalendarDate(endDay), '2026-11-24');

  assert.equal(isDateWithinFestivalWindow(beforeStart), false);
  assert.equal(isDateWithinFestivalWindow(startDay), true);
  assert.equal(isDateWithinFestivalWindow(midFestival), true);
  assert.equal(isDateWithinFestivalWindow(endDay), true);
  assert.equal(isDateWithinFestivalWindow(afterEnd), false);
});

test('FestivalConfiguration supports enable/disable, scheduleMode, and configurable event zones', () => {
  const duringFestival = new Date(2026, 10, 18, 20, 0, 0);
  const outsideFestival = new Date(2026, 10, 10, 20, 0, 0);

  const autoConfig = createDefaultFestivalConfig(duringFestival);
  assert.equal(autoConfig.scheduleMode, 'auto');
  assert.equal(isFestivalActive(autoConfig, duringFestival), true);
  assert.equal(isFestivalActive(autoConfig, outsideFestival), false);

  setFestivalEnabled(false);
  const disabledConfig = getFestivalConfiguration();
  assert.equal(disabledConfig.enabled, false);
  assert.equal(disabledConfig.scheduleMode, 'manual');
  assert.equal(isFestivalActive(disabledConfig, duringFestival), false);
  assert.equal(isThadingyutFestivalActive(), false);

  setFestivalEnabled(true);
  const enabledConfig = getFestivalConfiguration();
  assert.equal(enabledConfig.enabled, true);
  assert.equal(isFestivalActive(enabledConfig, outsideFestival), true);
  assert.equal(isThadingyutFestivalActive(), true);

  // Configurable zones: all, myothar, single village, custom
  const allZones = resolveActiveFestivalZones({ ...enabledConfig, activeZoneId: 'all' });
  assert.equal(allZones.length, ALL_FESTIVAL_ZONES.length);
  assert.ok(allZones.length >= 10);

  const myotharOnly = resolveActiveFestivalZones({ ...enabledConfig, activeZoneId: 'myothar' });
  assert.equal(myotharOnly.length, 1);
  assert.equal(myotharOnly[0].id, 'myothar');
  assert.equal(myotharOnly[0].x, MYOTHAR_FESTIVAL_HUB.x);
  assert.equal(myotharOnly[0].z, MYOTHAR_FESTIVAL_HUB.z);

  const firstVillage = ALL_FESTIVAL_ZONES[1];
  const singleVillage = resolveActiveFestivalZones({
    ...enabledConfig,
    activeZoneId: firstVillage.id,
  });
  assert.equal(singleVillage.length, 1);
  assert.equal(singleVillage[0].id, firstVillage.id);

  const customZones = resolveActiveFestivalZones(
    sanitizeFestivalConfig({
      ...enabledConfig,
      activeZoneId: 'custom',
      customZone: { x: 420, z: -680, spreadRadius: 150 },
    }),
  );
  assert.equal(customZones.length, 1);
  assert.equal(customZones[0].id, 'custom');
  assert.equal(customZones[0].x, 420);
  assert.equal(customZones[0].z, -680);
  assert.equal(customZones[0].spreadRadius, 150);

  resetFestivalConfiguration(duringFestival);
});

test('FestivalRegistry manages plugins and avoids resolving scene when festival is disabled', () => {
  const duringFestival = new Date(2026, 10, 16, 21, 0, 0);
  const plugins = listFestivalPlugins();
  assert.ok(plugins.some((p) => p.id === 'tazaungdaing'));

  const tazaungdaing = getFestivalPlugin('tazaungdaing');
  assert.ok(tazaungdaing);
  assert.equal(tazaungdaing.startDate, '2026-11-15');
  assert.equal(tazaungdaing.endDate, '2026-11-24');

  // When disabled, resolveActiveFestivalPlugin returns null so lazy scene is never loaded
  const disabledConfig = sanitizeFestivalConfig({
    enabled: false,
    scheduleMode: 'manual',
    activeFestivalId: 'tazaungdaing',
  });
  assert.equal(resolveActiveFestivalPlugin(disabledConfig, duringFestival), null);

  // When enabled, resolves Tazaungdaing plugin
  const enabledConfig = sanitizeFestivalConfig({
    enabled: true,
    scheduleMode: 'manual',
    activeFestivalId: 'tazaungdaing',
  });
  const activePlugin = resolveActiveFestivalPlugin(enabledConfig, duringFestival);
  assert.ok(activePlugin);
  assert.equal(activePlugin.id, 'tazaungdaing');

  // Custom plugin registration and cleanup
  let mockLoadCalled = false;
  const mockPlugin: FestivalPlugin = {
    id: 'mock-festival',
    name: 'Mock Festival',
    nameMm: 'စမ်းသပ်ပွဲတော်',
    description: 'Unit test festival plugin',
    startDate: '2026-12-01',
    endDate: '2026-12-05',
    loadScene: async () => {
      mockLoadCalled = true;
      return { default: () => null };
    },
  };
  registerFestivalPlugin(mockPlugin);
  assert.equal(getFestivalPlugin('mock-festival')?.name, 'Mock Festival');
  assert.equal(mockLoadCalled, false);
  assert.equal(unregisterFestivalPlugin('mock-festival'), true);
  assert.equal(getFestivalPlugin('mock-festival'), undefined);
});

test('BalloonShow generates deterministic trajectories and clears rideable PassengerBalloon pad', () => {
  const zones = [MYOTHAR_FESTIVAL_HUB, ALL_FESTIVAL_ZONES[1]];
  const runA = buildBalloonShowDescriptors(zones, 40, 20261115);
  const runB = buildBalloonShowDescriptors(zones, 40, 20261115);

  assert.equal(runA.length, 80);
  assert.deepEqual(runA, runB);

  for (const d of runA) {
    if (d.zoneId === 'myothar') {
      const distFromRidePad = Math.hypot(d.originX - BALLOON_LAUNCH.x, d.originZ - BALLOON_LAUNCH.z);
      assert.ok(
        distFromRidePad >= 17.99,
        `Decorative balloon in Myothar must clear rideable launch pad (got ${distFromRidePad.toFixed(2)}m)`,
      );
    }

    const poseT1 = evaluateBalloonTransform(d, 42.5);
    const poseT1Again = evaluateBalloonTransform(d, 42.5);
    assert.deepEqual(poseT1, poseT1Again);
    assert.ok(poseT1.y >= d.originY && poseT1.y <= d.ceilingY + 0.01);
    assert.ok(poseT1.scale >= 0.15);
  }
});

test('FestivalDecorations keeps perimeter clearance around rideable balloon pad and respects mobile limits', () => {
  const desktop = buildFestivalDecorationPlacements([MYOTHAR_FESTIVAL_HUB], false);
  const mobile = buildFestivalDecorationPlacements([MYOTHAR_FESTIVAL_HUB], true);

  assert.equal(desktop.posts.length, 16);
  assert.equal(desktop.displayBalloons.length, 2);
  assert.equal(mobile.posts.length, 8);
  assert.equal(mobile.displayBalloons.length, 1);

  for (const post of desktop.posts) {
    const dist = Math.hypot(post.x - BALLOON_LAUNCH.x, post.z - BALLOON_LAUNCH.z);
    assert.ok(dist >= 23.9, `Lantern post must clear rideable launch pad (got ${dist.toFixed(2)}m)`);
  }
  for (const displayBalloon of desktop.displayBalloons) {
    const dist = Math.hypot(displayBalloon.x - BALLOON_LAUNCH.x, displayBalloon.z - BALLOON_LAUNCH.z);
    assert.ok(dist >= 28.9, `Display balloon must clear rideable launch pad (got ${dist.toFixed(2)}m)`);
  }
});

test('Rideable hot-air balloon physics and landing remain functional when festival is disabled', () => {
  setFestivalEnabled(false);
  assert.equal(isThadingyutFestivalActive(), false);

  const ride = createBalloonRide();
  assert.equal(ride.x, BALLOON_LAUNCH.x);
  assert.equal(ride.z, BALLOON_LAUNCH.z);
  assert.equal(ride.riding, false);

  ride.riding = true;
  stepBalloon(
    ride,
    0.5,
    { forward: 1, right: 0, lift: 1, yaw: 0 },
    () => 0,
    () => 0,
    4000,
  );
  assert.ok(ride.y > 0, 'Rideable balloon ascends even when festival overlay is disabled');
  assert.equal(ride.grounded, false);

  const canLand = balloonLanding(ride.x, ride.z, () => 0, () => true);
  assert.equal(canLand, true);

  updateFestivalConfiguration({ scheduleMode: 'auto', enabled: true });
});
