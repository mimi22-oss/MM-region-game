import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  areBalloonsVisibleAtMinute,
  areFootballPlayersVisibleAtMinute,
} from '../src/game/environmentTime.ts';
import {
  FOOTBALL_BALL_POOL_SIZE,
  FOOTBALL_PITCH_SPECS,
  FOOTBALL_PLAYER_POOL_DESKTOP,
  FOOTBALL_PLAYER_POOL_MOBILE,
  FootballMatchPoolController,
  createFootballMatchState,
  findNearestFootballPitch,
  getFootballScoreboardSnapshot,
  localToWorld,
  publishFootballScoreboard,
  stepFootballMatch,
  subscribeFootballScoreboard,
  worldToLocal,
} from '../src/game/footballMatch.ts';
import {
  disposeFootballMatchAssetCache,
  getFootballMatchAssetCache,
} from '../src/game/footballMatchAssets.ts';
import {
  computeFootballBroadcastTarget,
  cycleFootballViewPreset,
  enterFootballView,
  exitFootballView,
  getFootballViewState,
  isFootballViewActive,
  stepFootballBroadcastPose,
} from '../src/game/footballBroadcastCam.ts';

test('FootballMatchAssetCache is a strict Singleton reusing shared human anatomy with Red & Green kits', () => {
  const a = getFootballMatchAssetCache();
  const b = getFootballMatchAssetCache();
  assert.strictEqual(a, b);
  assert.strictEqual(a.ballGeo, b.ballGeo);
  assert.strictEqual(a.redJerseyMat, b.redJerseyMat);
  assert.strictEqual(a.greenJerseyMat, b.greenJerseyMat);
  assert.notEqual(a.redJerseyMat.color.getHexString(), a.greenJerseyMat.color.getHexString());
  disposeFootballMatchAssetCache();
});

test('Every football pitch across the world has balanced Red vs Green teams with goalkeepers inside pitch bounds', () => {
  const ids = FOOTBALL_PITCH_SPECS.map((s) => s.id);
  assert.deepEqual(ids, [
    'myothar-pitch',
    'htaukkyant-pitch',
    'kyarinn-pitch',
    'kanbale-school-pitch',
  ]);

  for (const spec of FOOTBALL_PITCH_SPECS) {
    const match = createFootballMatchState(spec);
    const red = match.players.filter((p) => p.team === 'red');
    const green = match.players.filter((p) => p.team === 'green');
    assert.equal(red.length, spec.playersPerTeam, `${spec.id} red team count`);
    assert.equal(green.length, spec.playersPerTeam, `${spec.id} green team count`);
    assert.equal(red.filter((p) => p.role === 'gk').length, 1, `${spec.id} red GK`);
    assert.equal(green.filter((p) => p.role === 'gk').length, 1, `${spec.id} green GK`);

    // Roundtrip pitch transform check
    const w = localToWorld(spec, 5.5, -8.25);
    const l = worldToLocal(spec, w.x, w.z);
    assert.ok(Math.abs(l.x - 5.5) < 1e-6 && Math.abs(l.z + 8.25) < 1e-6);

    for (const p of match.players) {
      assert.ok(Math.abs(p.x) <= spec.halfWidth + 0.1, `${p.id} inside width`);
      assert.ok(Math.abs(p.z) <= spec.halfLength + 0.1, `${p.id} inside length`);
    }
  }
});

test('Live football matches execute curving, dribble feints, shots/goals, goalkeeper saves, ball pickups, and throw-ins', () => {
  let totalGoals = 0;
  let totalShots = 0;
  let totalSaves = 0;
  let totalFeints = 0;
  let totalCurves = 0;
  let totalPickups = 0;
  let totalThrows = 0;

  for (const spec of FOOTBALL_PITCH_SPECS) {
    const match = createFootballMatchState(spec);
    // Simulate 140 seconds of live football at 25Hz
    for (let step = 0; step < 3500; step++) {
      stepFootballMatch(match, 0.04);
    }

    assert.ok(Number.isFinite(match.ball.worldX) && Number.isFinite(match.ball.worldZ));
    for (const p of match.players) {
      assert.ok(Number.isFinite(p.worldX) && Number.isFinite(p.worldZ) && Number.isFinite(p.yaw));
    }

    totalGoals += match.stats.goalsRed + match.stats.goalsGreen;
    totalShots += match.stats.shots;
    totalSaves += match.stats.saves;
    totalFeints += match.stats.feints;
    totalCurves += match.stats.curves;
    totalPickups += match.stats.pickups;
    totalThrows += match.stats.throws;
  }

  assert.ok(totalCurves > 0, `expected curving runs/shots (got ${totalCurves})`);
  assert.ok(totalFeints > 0, `expected dribble feints (got ${totalFeints})`);
  assert.ok(totalShots > 0, `expected shots on goal (got ${totalShots})`);
  assert.ok(totalGoals > 0, `expected goals scored (got ${totalGoals})`);
  assert.ok(totalSaves > 0, `expected goalkeeper saves (got ${totalSaves})`);
  assert.ok(totalPickups > 0, `expected ball pickups (got ${totalPickups})`);
  assert.ok(totalThrows > 0, `expected ball throws / throw-ins (got ${totalThrows})`);
});

test('FootballMatchPoolController enforces fixed desktop/mobile object pool caps and region gating', () => {
  const mobilePool = new FootballMatchPoolController(FOOTBALL_PLAYER_POOL_MOBILE, 180);
  const desktopPool = new FootballMatchPoolController(FOOTBALL_PLAYER_POOL_DESKTOP, 250);
  assert.equal(mobilePool.playerSlots.length, FOOTBALL_PLAYER_POOL_MOBILE);
  assert.equal(desktopPool.playerSlots.length, FOOTBALL_PLAYER_POOL_DESKTOP);
  assert.equal(desktopPool.ballSlots.length, FOOTBALL_BALL_POOL_SIZE);

  // Near Myothar pitch with myothar active -> binds 14 players and 1 ball
  const myotharSpec = FOOTBALL_PITCH_SPECS[0];
  mobilePool.update(myotharSpec.centerX, myotharSpec.centerZ, 0.04, ['myothar']);
  assert.equal(mobilePool.playerSlots.filter(Boolean).length, 14);
  assert.equal(mobilePool.ballSlots.filter(Boolean).length, 1);

  // Far away or region inactive -> 0 active slots
  mobilePool.update(myotharSpec.centerX, myotharSpec.centerZ, 0.04, ['kanbale']);
  assert.equal(mobilePool.playerSlots.filter(Boolean).length, 0);
  assert.equal(mobilePool.ballSlots.filter(Boolean).length, 0);
});

test('Day/Night visibility schedule hides balloons during daytime and hides football players in evening & night', () => {
  // Morning (07:00) & Day (13:00, 16:29) -> Football ON, Balloons OFF
  for (const daytimeMin of [420, 780, 989]) {
    assert.equal(areBalloonsVisibleAtMinute(daytimeMin), false, `balloons hidden at minute ${daytimeMin}`);
    assert.equal(areFootballPlayersVisibleAtMinute(daytimeMin), true, `football visible at minute ${daytimeMin}`);
  }
  // Evening (16:30 – 18:59 -> minutes 990..1139) -> Football OFF, Balloons OFF
  for (const eveningMin of [990, 1020, 1139]) {
    assert.equal(areBalloonsVisibleAtMinute(eveningMin), false, `balloons hidden in evening at minute ${eveningMin}`);
    assert.equal(areFootballPlayersVisibleAtMinute(eveningMin), false, `football hidden in evening at minute ${eveningMin}`);
  }
  // Night (19:00 – 04:59 -> minutes 1140..1439, 0..299) -> Balloons ON, Football OFF
  for (const nightMin of [1140, 1260, 0, 180]) {
    assert.equal(areBalloonsVisibleAtMinute(nightMin), true, `balloons visible at minute ${nightMin}`);
    assert.equal(areFootballPlayersVisibleAtMinute(nightMin), false, `football hidden at minute ${nightMin}`);
  }

  const root = process.cwd();
  const playerSrc = fs.readFileSync(path.join(root, 'src/components/Player.tsx'), 'utf8');
  const fbBotsSrc = fs.readFileSync(path.join(root, 'src/components/FootballMatchBots.tsx'), 'utf8');
  const tazSrc = fs.readFileSync(path.join(root, 'src/festivals/TazaungdaingScene.tsx'), 'utf8');
  const decSrc = fs.readFileSync(path.join(root, 'src/festivals/FestivalDecorations.tsx'), 'utf8');
  const dynSrc = fs.readFileSync(path.join(root, 'src/components/DynamicWorldObjects.tsx'), 'utf8');

  assert.ok(playerSrc.includes('areBalloonsVisibleAtMinute(minute)'), 'Player gates PassengerBalloon visibility & boarding by night');
  assert.ok(fbBotsSrc.includes('areFootballPlayersVisibleAtMinute(minute)'), 'FootballMatchBots hides players & balls at night');
  assert.ok(tazSrc.includes('areBalloonsVisibleAtMinute(minute)'), 'TazaungdaingScene gates BalloonShow by night');
  assert.ok(decSrc.includes('{showBalloons && ('), 'FestivalDecorations hides ground display balloons during daytime');
  assert.ok(dynSrc.includes('areBalloonsVisibleAtMinute(minute)'), 'DynamicWorldObjects hides custom fire balloons during daytime');
});

test('Football scoreboard HUD detects every football pitch, publishes live Red vs Green goals, and replaces ghost-hud', () => {
  for (const spec of FOOTBALL_PITCH_SPECS) {
    const detected = findNearestFootballPitch(spec.centerX, spec.centerZ);
    assert.equal(detected?.id, spec.id, `center of ${spec.id} detects pitch`);
  }
  assert.equal(findNearestFootballPitch(-9999, -9999), null, 'far away returns null');

  const spec = FOOTBALL_PITCH_SPECS[0];
  const match = createFootballMatchState(spec);
  let notifications = 0;
  const unsub = subscribeFootballScoreboard(() => {
    notifications += 1;
  });

  // Run until at least one goal is scored and published
  for (let i = 0; i < 4000; i++) {
    stepFootballMatch(match, 0.04);
    publishFootballScoreboard(match);
    const snap = getFootballScoreboardSnapshot()[spec.id];
    if (snap.goalsRed + snap.goalsGreen > 0) break;
  }
  unsub();

  const finalSnap = getFootballScoreboardSnapshot()[spec.id];
  assert.ok(finalSnap.goalsRed + finalSnap.goalsGreen > 0, 'scoreboard records scored goals');
  assert.ok(notifications > 0, 'scoreboard notifies HUD subscribers on match updates');

  const mainSrc = fs.readFileSync(path.join(process.cwd(), 'src/main.tsx'), 'utf8');
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/style.css'), 'utf8');
  assert.ok(mainSrc.includes('!nearSchoolHall && !nearFootballPitch && <ThreeGhostsMissionHud'), 'hides ghost HUD near football pitches');
  assert.ok(mainSrc.includes('football-score-hud'), 'renders football-score-hud in main.tsx');
  assert.ok(mainSrc.includes('location-toast-below-football'), 'offsets location-toast below football-score-hud');
  assert.ok(mainSrc.includes('setTimeout(() => setArrivalToast(null), 2200)'), 'auto-hides arrivalToast after 2.2s even after teleport or walking');
  assert.ok(cssSrc.includes('.location-toast.location-toast-below-football'), 'defines non-overlapping desktop/mobile toast offset');
});

test('Football View TV-broadcast auto camera frames action, shots/saves, all 3 presets, and toggles cleanly', () => {
  exitFootballView();
  assert.equal(isFootballViewActive(), false);

  enterFootballView('myothar-pitch', 'tv');
  assert.equal(isFootballViewActive(), true);
  assert.equal(getFootballViewState().pitchId, 'myothar-pitch');
  assert.equal(getFootballViewState().preset, 'tv');

  const p2 = cycleFootballViewPreset();
  assert.equal(p2, 'close');
  const p3 = cycleFootballViewPreset();
  assert.equal(p3, 'goal-behind');
  const p4 = cycleFootballViewPreset();
  assert.equal(p4, 'tv');

  // Verify framing on both large (Myothar) and compact (Kanbale) pitches across all 3 presets
  for (const spec of [FOOTBALL_PITCH_SPECS[0], FOOTBALL_PITCH_SPECS[3]]) {
    const match = createFootballMatchState(spec);
    for (let i = 0; i < 60; i++) stepFootballMatch(match, 0.04);

    const tvPose = computeFootballBroadcastTarget(match, 'tv');
    const closePose = computeFootballBroadcastTarget(match, 'close');
    const goalPose = computeFootballBroadcastTarget(match, 'goal-behind');

    for (const pose of [tvPose, closePose, goalPose]) {
      assert.ok(Number.isFinite(pose.camX) && Number.isFinite(pose.camY) && Number.isFinite(pose.camZ));
      assert.ok(Number.isFinite(pose.lookX) && Number.isFinite(pose.lookY) && Number.isFinite(pose.lookZ));
      assert.ok(pose.camY > spec.surfaceY + 2, 'broadcast camera stays elevated above pitch');
    }

    // Damping smoothly interpolates without jumping
    const damped = stepFootballBroadcastPose(tvPose, closePose, 0.05, true);
    assert.ok(Math.hypot(damped.camX - tvPose.camX, damped.camZ - tvPose.camZ) > 0);

    // Shot toward goal tightens framing toward goal mouth
    match.ball.isShot = true;
    match.ball.shotTargetTeam = 'green';
    match.ball.z = spec.halfLength * 0.6;
    const shotPose = computeFootballBroadcastTarget(match, 'tv');
    assert.ok(Number.isFinite(shotPose.lookZ));
  }

  exitFootballView();
  assert.equal(isFootballViewActive(), false);

  const root = process.cwd();
  const mainSrc = fs.readFileSync(path.join(root, 'src/main.tsx'), 'utf8');
  const playerSrc = fs.readFileSync(path.join(root, 'src/components/Player.tsx'), 'utf8');
  assert.ok(mainSrc.includes('football-view-prompt'), 'renders near-character Football View button');
  assert.ok(mainSrc.includes('football-view-bar'), 'renders TV broadcast controls bar');
  assert.ok(playerSrc.includes('isFootballViewActive()'), 'Player yields camera ownership during Football View');
});
