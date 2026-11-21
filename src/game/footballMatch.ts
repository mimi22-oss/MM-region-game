import { area5, angle } from '../data/wards/myothar/area5.ts';
import { htaukKyantLandmarks } from '../data/villages/htaukkyant/index.ts';
import { kyarInnLandmarks } from '../data/villages/kyarinn/index.ts';

/**
 * ============================================================================
 * Live Football Match Simulation Engine across ALL Football Pitches
 * ============================================================================
 * - Team Red (အနီရောင်) attacks +Z; Team Green (အစိမ်းရောင်) attacks -Z.
 * - Full play actions:
 *   1. ကွေ့တယ် (Curving runs with banking lean + Magnus-curving passes/shots)
 *   2. လိမ်တယ် (Dribble feints / sidestep fakes beating closing defenders)
 *   3. ဂိုးသွင်းတယ် (Powerful aimed shots + net goals + goal celebrations)
 *   4. ဂိုးဖမ်းတယ် (Goalkeeper tracking, diving saves, chest catches)
 *   5. ဘောလုံးကောက်တယ် (Bending down to pick up dead/out-of-bounds balls)
 *   6. ဘောလုံးပစ်တယ် (Sideline overhead throw-ins + goalkeeper throws)
 */

export type FootballTeam = 'red' | 'green';
export type FootballRole = 'gk' | 'def' | 'mid' | 'fwd';

export type FootballPlayerAction =
  | 'idle'
  | 'run'
  | 'dribble'
  | 'dribble-feint'
  | 'kick'
  | 'gk-ready'
  | 'gk-dive'
  | 'gk-catch'
  | 'pickup-ball'
  | 'hold-ball'
  | 'throw-ball'
  | 'celebrate';

export type FootballMatchPhase =
  | 'kickoff'
  | 'open-play'
  | 'throw-in-pickup'
  | 'throw-in'
  | 'gk-pickup'
  | 'gk-hold'
  | 'gk-throw'
  | 'goal-celebration';

export interface FootballPitchSpec {
  readonly id: string;
  readonly regionId: string;
  readonly name: string;
  readonly centerX: number;
  readonly centerZ: number;
  /** World Y-rotation such that local +Z points along goal-to-goal length and local +X across width. */
  readonly rotation: number;
  readonly halfWidth: number;
  readonly halfLength: number;
  readonly goalHalfWidth: number;
  readonly goalHeight: number;
  readonly surfaceY: number;
  /** Players per side (including goalkeeper). */
  readonly playersPerTeam: number;
}

export interface FootballObstacle {
  readonly wx: number;
  readonly wz: number;
  readonly radius: number;
}

export interface FootballPlayerState {
  readonly id: string;
  readonly pitchId: string;
  readonly team: FootballTeam;
  readonly role: FootballRole;
  readonly slotIndex: number;
  readonly skinIndex: number;
  readonly hairIndex: number;
  readonly scale: number;
  readonly homeX: number;
  readonly homeZ: number;
  // Local pitch coordinates (X = width, Z = goal-to-goal length)
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** World-space position & facing */
  worldX: number;
  worldY: number;
  worldZ: number;
  yaw: number;
  /** Local facing in pitch frame */
  localYaw: number;
  /** Banking lean when curving (ကွေ့တယ်) or diving */
  leanRoll: number;
  /** Dribble feint sway direction (-1 | 0 | 1) */
  feintDir: number;
  feintTimer: number;
  /** Dive direction (-1 left | +1 right) for goalkeeper saves */
  diveDir: number;
  action: FootballPlayerAction;
  actionTimer: number;
  actionDuration: number;
  walkPhase: number;
  speed: number;
  /** Stun/cooldown after being beaten by a feint or losing possession */
  tackleCooldown: number;
}

export interface FootballBallState {
  readonly pitchId: string;
  // Local pitch coordinates
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Lateral Magnus curve acceleration (m/s^2) on curving shots/passes */
  curveX: number;
  curveZ: number;
  spinX: number;
  spinZ: number;
  rotX: number;
  rotZ: number;
  // World coordinates
  worldX: number;
  worldY: number;
  worldZ: number;
  /** Ground height under ball in world */
  groundY: number;
  ownerId: string | null;
  lastTouchTeam: FootballTeam;
  /** True when held in player/GK hands (pickup / catch / throw-in) */
  inHands: boolean;
  /** Normalized hand carry posture: 'ground-pickup' | 'chest' | 'overhead' */
  handPose: 'ground-pickup' | 'chest' | 'overhead';
  /** True while travelling fast toward a goal as a shot */
  isShot: boolean;
  shotTargetTeam: FootballTeam | null;
}

export interface FootballMatchStats {
  goalsRed: number;
  goalsGreen: number;
  shots: number;
  saves: number;
  feints: number;
  curves: number;
  pickups: number;
  throws: number;
}

export interface FootballMatchState {
  readonly spec: FootballPitchSpec;
  readonly players: FootballPlayerState[];
  readonly ball: FootballBallState;
  phase: FootballMatchPhase;
  phaseTimer: number;
  actingPlayerId: string | null;
  kickoffTeam: FootballTeam;
  scoringTeam: FootballTeam | null;
  /** Target local spot for throw-in / GK pickup */
  restartX: number;
  restartZ: number;
  /** Seeded PRNG state for deterministic yet lively matches */
  rng: number;
  /** Timer ensuring periodic sideline throw-in & dramatic shots keep matches lively */
  playClock: number;
  nextPlannedEventAt: number;
  readonly stats: FootballMatchStats;
}

export const BALL_RADIUS = 0.24;
const GRAVITY = 15.5;
const TURF_FRICTION = 1.65;
const TURF_RESTITUTION = 0.54;

/** Compute Kanbale School Football Pitch world center from KanbaleSchool parent transform (`way/403030614`). */
function computeKanbaleSchoolPitchCenter(): { x: number; z: number; rotation: number } {
  const parentX = 451.73;
  const parentZ = -569.03;
  const rot = 2.4226;
  const lx = 15;
  const lz = -26;
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x: parentX + lx * c + lz * s,
    z: parentZ - lx * s + lz * c,
    rotation: rot,
  };
}

function buildFootballPitchSpecs(): readonly FootballPitchSpec[] {
  const hk = htaukKyantLandmarks.find((m) => m.id === 'hk-football-playground')!;
  const ki = kyarInnLandmarks.find((m) => m.id === 'ki-school-field')!;
  const kanbale = computeKanbaleSchoolPitchCenter();

  return [
    {
      id: 'myothar-pitch',
      regionId: 'myothar',
      name: 'မြို့သာ ဘောလုံးကွင်း · နယ်မြေ (၅)',
      centerX: area5.pitch.x,
      centerZ: area5.pitch.z,
      rotation: area5.pitch.rotation,
      halfWidth: area5.pitch.width / 2, // 30m
      halfLength: area5.pitch.depth / 2, // 48m
      goalHalfWidth: 3.66,
      goalHeight: 2.44,
      surfaceY: 0.11,
      playersPerTeam: 7,
    },
    {
      id: 'htaukkyant-pitch',
      regionId: 'htaukkyant',
      name: 'ထောက်ကြန့် ဘောလုံးကွင်း',
      centerX: hk.x,
      centerZ: hk.z,
      rotation: hk.rotation,
      halfWidth: hk.width / 2 - 2, // 21m
      halfLength: hk.depth / 2 - 3, // 31m
      goalHalfWidth: 3.6,
      goalHeight: 2.4,
      surfaceY: 0.06,
      playersPerTeam: 6,
    },
    {
      id: 'kyarinn-pitch',
      regionId: 'kyarinn',
      name: 'ကြာအင်း အလက ဘောလုံးကွင်း',
      centerX: ki.x,
      centerZ: ki.z,
      // Kyar Inn's goalposts sit along local X; +PI/2 aligns local Z with goal-to-goal axis.
      rotation: (ki.rotation ?? angle) + Math.PI / 2,
      halfWidth: ki.depth / 2 - 1.2, // 31.8m
      halfLength: ki.width / 2 - 3, // 45m
      goalHalfWidth: 3.6,
      goalHeight: 2.4,
      surfaceY: 0.06,
      playersPerTeam: 7,
    },
    {
      id: 'kanbale-school-pitch',
      regionId: 'kanbale',
      name: 'ကံပုလဲကျောင်း ဘောလုံးကွင်း',
      centerX: kanbale.x,
      centerZ: kanbale.z,
      rotation: kanbale.rotation,
      halfWidth: 7.2,
      halfLength: 10.7,
      goalHalfWidth: 1.7,
      goalHeight: 2.2,
      surfaceY: 0.09,
      playersPerTeam: 4,
    },
  ];
}

export const FOOTBALL_PITCH_SPECS: readonly FootballPitchSpec[] = buildFootballPitchSpecs();

/**
 * Find the football pitch containing (or immediately bordering) a world coordinate (x, z).
 * Uses each pitch's oriented bounding box so standalone full pitches and Kanbale's compact
 * school pitch both trigger accurately without bleeding into nearby school classrooms.
 */
export function findNearestFootballPitch(
  wx: number,
  wz: number,
  marginOverride?: number,
): FootballPitchSpec | null {
  let best: FootballPitchSpec | null = null;
  let bestDist = Infinity;
  for (const spec of FOOTBALL_PITCH_SPECS) {
    const margin = marginOverride ?? (spec.halfLength < 16 ? 7 : 22);
    const local = worldToLocal(spec, wx, wz);
    if (
      Math.abs(local.x) <= spec.halfWidth + margin &&
      Math.abs(local.z) <= spec.halfLength + margin
    ) {
      const d = Math.hypot(local.x, local.z);
      if (d < bestDist) {
        bestDist = d;
        best = spec;
      }
    }
  }
  return best;
}

export interface FootballScoreEntry {
  readonly pitchId: string;
  readonly goalsRed: number;
  readonly goalsGreen: number;
  readonly phase: FootballMatchPhase;
  readonly lastScorer: FootballTeam | null;
  readonly goalFlashSeq: number;
}

export type FootballScoreboardSnapshot = Readonly<Record<string, FootballScoreEntry>>;

const scoreboardListeners = new Set<() => void>();
let scoreboardSnapshot: FootballScoreboardSnapshot = Object.fromEntries(
  FOOTBALL_PITCH_SPECS.map((spec) => [
    spec.id,
    {
      pitchId: spec.id,
      goalsRed: 0,
      goalsGreen: 0,
      phase: 'kickoff' as FootballMatchPhase,
      lastScorer: null,
      goalFlashSeq: 0,
    },
  ]),
);

export function getFootballScoreboardSnapshot(): FootballScoreboardSnapshot {
  return scoreboardSnapshot;
}

export function subscribeFootballScoreboard(listener: () => void): () => void {
  scoreboardListeners.add(listener);
  return () => {
    scoreboardListeners.delete(listener);
  };
}

export function publishFootballScoreboard(match: FootballMatchState): void {
  const id = match.spec.id;
  const prev = scoreboardSnapshot[id];
  const nextRed = match.stats.goalsRed;
  const nextGreen = match.stats.goalsGreen;
  const nextPhase = match.phase;
  const nextScorer = match.scoringTeam ?? prev?.lastScorer ?? null;
  const scoredNow = prev ? nextRed !== prev.goalsRed || nextGreen !== prev.goalsGreen : false;

  if (
    prev &&
    prev.goalsRed === nextRed &&
    prev.goalsGreen === nextGreen &&
    prev.phase === nextPhase &&
    prev.lastScorer === nextScorer
  ) {
    return;
  }

  scoreboardSnapshot = {
    ...scoreboardSnapshot,
    [id]: {
      pitchId: id,
      goalsRed: nextRed,
      goalsGreen: nextGreen,
      phase: nextPhase,
      lastScorer: nextScorer,
      goalFlashSeq: (prev?.goalFlashSeq ?? 0) + (scoredNow ? 1 : 0),
    },
  };
  for (const listener of scoreboardListeners) listener();
}

export function localToWorld(
  spec: FootballPitchSpec,
  lx: number,
  lz: number,
): { x: number; z: number } {
  const c = Math.cos(spec.rotation);
  const s = Math.sin(spec.rotation);
  return {
    x: spec.centerX + lx * c + lz * s,
    z: spec.centerZ - lx * s + lz * c,
  };
}

export function worldToLocal(
  spec: FootballPitchSpec,
  wx: number,
  wz: number,
): { x: number; z: number } {
  const dx = wx - spec.centerX;
  const dz = wz - spec.centerZ;
  const c = Math.cos(spec.rotation);
  const s = Math.sin(spec.rotation);
  return {
    x: dx * c - dz * s,
    z: dx * s + dz * c,
  };
}

function nextRand(match: FootballMatchState): number {
  let x = match.rng | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  match.rng = x || 1234567;
  return ((x >>> 0) % 10000) / 10000;
}

function hashSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h | 1) >>> 0;
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function lerpAngle(current: number, target: number, t: number): number {
  return normalizeAngle(current + normalizeAngle(target - current) * Math.min(1, t));
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function formationFor(count: number): readonly { role: FootballRole; nx: number; nz: number }[] {
  if (count <= 4) {
    return [
      { role: 'gk', nx: 0, nz: -0.92 },
      { role: 'def', nx: 0, nz: -0.52 },
      { role: 'mid', nx: -0.34, nz: -0.14 },
      { role: 'fwd', nx: 0.24, nz: 0.16 },
    ];
  }
  if (count <= 6) {
    return [
      { role: 'gk', nx: 0, nz: -0.94 },
      { role: 'def', nx: -0.36, nz: -0.55 },
      { role: 'def', nx: 0.36, nz: -0.55 },
      { role: 'mid', nx: 0, nz: -0.18 },
      { role: 'fwd', nx: -0.34, nz: 0.18 },
      { role: 'fwd', nx: 0.34, nz: 0.18 },
    ];
  }
  return [
    { role: 'gk', nx: 0, nz: -0.95 },
    { role: 'def', nx: -0.38, nz: -0.58 },
    { role: 'def', nx: 0.38, nz: -0.58 },
    { role: 'mid', nx: -0.42, nz: -0.16 },
    { role: 'mid', nx: 0.42, nz: -0.16 },
    { role: 'fwd', nx: -0.24, nz: 0.24 },
    { role: 'fwd', nx: 0.26, nz: 0.24 },
  ];
}

function syncPlayerWorld(spec: FootballPitchSpec, p: FootballPlayerState): void {
  const w = localToWorld(spec, p.x, p.z);
  p.worldX = w.x;
  p.worldY = spec.surfaceY;
  p.worldZ = w.z;
  p.yaw = normalizeAngle(spec.rotation + p.localYaw);
}

function syncBallWorld(spec: FootballPitchSpec, b: FootballBallState): void {
  const w = localToWorld(spec, b.x, b.z);
  b.worldX = w.x;
  b.groundY = spec.surfaceY;
  b.worldY = spec.surfaceY + b.y;
  b.worldZ = w.z;
}

export function createFootballMatchState(spec: FootballPitchSpec): FootballMatchState {
  const formation = formationFor(spec.playersPerTeam);
  const players: FootballPlayerState[] = [];
  const teams: readonly FootballTeam[] = ['red', 'green'];
  const isSmallPitch = spec.halfLength < 16;

  let slot = 0;
  for (const team of teams) {
    // Red defends -Z and attacks +Z; Green defends +Z and attacks -Z
    const sign = team === 'red' ? 1 : -1;
    for (let i = 0; i < formation.length; i++) {
      const f = formation[i];
      const homeX = f.nx * spec.halfWidth * sign;
      const homeZ = f.nz * spec.halfLength * sign;
      const localYaw = team === 'red' ? 0 : Math.PI;
      const scale = isSmallPitch ? 0.88 + (i % 3) * 0.03 : 0.96 + (i % 4) * 0.035;
      const player: FootballPlayerState = {
        id: `${spec.id}:${team}:${i}`,
        pitchId: spec.id,
        team,
        role: f.role,
        slotIndex: slot++,
        skinIndex: (i + (team === 'red' ? 0 : 2)) % 4,
        hairIndex: (i + (team === 'red' ? 1 : 0)) % 3,
        scale,
        homeX,
        homeZ,
        x: homeX * 0.85,
        z: f.role === 'gk' ? sign * -(spec.halfLength - 1.35) : homeZ * 0.85,
        vx: 0,
        vz: 0,
        worldX: spec.centerX,
        worldY: spec.surfaceY,
        worldZ: spec.centerZ,
        yaw: spec.rotation + localYaw,
        localYaw,
        leanRoll: 0,
        feintDir: 0,
        feintTimer: 0,
        diveDir: 0,
        action: f.role === 'gk' ? 'gk-ready' : 'idle',
        actionTimer: 0,
        actionDuration: 0,
        walkPhase: i * 1.15,
        speed: 0,
        tackleCooldown: 0,
      };
      syncPlayerWorld(spec, player);
      players.push(player);
    }
  }

  const ball: FootballBallState = {
    pitchId: spec.id,
    x: 0,
    y: BALL_RADIUS,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    curveX: 0,
    curveZ: 0,
    spinX: 0,
    spinZ: 0,
    rotX: 0,
    rotZ: 0,
    worldX: spec.centerX,
    worldY: spec.surfaceY + BALL_RADIUS,
    worldZ: spec.centerZ,
    groundY: spec.surfaceY,
    ownerId: null,
    lastTouchTeam: 'red',
    inHands: false,
    handPose: 'chest',
    isShot: false,
    shotTargetTeam: null,
  };
  syncBallWorld(spec, ball);

  const match: FootballMatchState = {
    spec,
    players,
    ball,
    phase: 'kickoff',
    phaseTimer: 0.7,
    actingPlayerId: null,
    kickoffTeam: 'red',
    scoringTeam: null,
    restartX: 0,
    restartZ: 0,
    rng: hashSeed(spec.id),
    playClock: 0,
    nextPlannedEventAt: 7 + (hashSeed(spec.id) % 5),
    stats: {
      goalsRed: 0,
      goalsGreen: 0,
      shots: 0,
      saves: 0,
      feints: 0,
      curves: 0,
      pickups: 0,
      throws: 0,
    },
  };

  // Position kickoff striker near center
  const striker = players.find((p) => p.team === 'red' && p.role === 'fwd');
  if (striker) {
    striker.x = -0.6;
    striker.z = -0.8;
    syncPlayerWorld(spec, striker);
    match.actingPlayerId = striker.id;
  }

  return match;
}

function getPlayerById(match: FootballMatchState, id: string | null): FootballPlayerState | undefined {
  if (!id) return undefined;
  return match.players.find((p) => p.id === id);
}

function getGoalkeeper(match: FootballMatchState, team: FootballTeam): FootballPlayerState {
  return match.players.find((p) => p.team === team && p.role === 'gk')!;
}

function attackDir(team: FootballTeam): number {
  return team === 'red' ? 1 : -1;
}

function otherTeam(team: FootballTeam): FootballTeam {
  return team === 'red' ? 'green' : 'red';
}

function movePlayerToward(
  p: FootballPlayerState,
  tx: number,
  tz: number,
  maxSpeed: number,
  dt: number,
  spec: FootballPitchSpec,
  allowOutside = false,
): number {
  const dx = tx - p.x;
  const dz = tz - p.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.08) {
    p.vx *= 0.6;
    p.vz *= 0.6;
    p.speed = Math.hypot(p.vx, p.vz);
    p.leanRoll *= Math.max(0, 1 - dt * 8);
    return dist;
  }

  const desiredSpeed = Math.min(maxSpeed, dist * 3.8);
  const desiredVx = (dx / dist) * desiredSpeed;
  const desiredVz = (dz / dist) * desiredSpeed;

  const prevYaw = p.localYaw;
  const accel = Math.min(1, dt * 6.5);
  p.vx += (desiredVx - p.vx) * accel;
  p.vz += (desiredVz - p.vz) * accel;
  p.x += p.vx * dt;
  p.z += p.vz * dt;

  if (!allowOutside) {
    p.x = clamp(p.x, -spec.halfWidth + 0.5, spec.halfWidth - 0.5);
    p.z = clamp(p.z, -spec.halfLength + 0.5, spec.halfLength - 0.5);
  } else {
    p.x = clamp(p.x, -spec.halfWidth - 3.2, spec.halfWidth + 3.2);
    p.z = clamp(p.z, -spec.halfLength - 3.2, spec.halfLength + 3.2);
  }

  p.speed = Math.hypot(p.vx, p.vz);
  if (p.speed > 0.25) {
    const targetYaw = Math.atan2(p.vx, p.vz);
    p.localYaw = lerpAngle(p.localYaw, targetYaw, dt * 10);
    // Visible body lean when curving/turning sharply (ကွေ့တယ်)
    const yawRate = normalizeAngle(p.localYaw - prevYaw) / Math.max(0.016, dt);
    const targetLean = clamp(-yawRate * 0.085, -0.34, 0.34);
    p.leanRoll += (targetLean - p.leanRoll) * Math.min(1, dt * 10);
    p.walkPhase += p.speed * dt * 2.15;
  } else {
    p.leanRoll *= Math.max(0, 1 - dt * 8);
  }
  return dist;
}

function launchBall(
  match: FootballMatchState,
  kicker: FootballPlayerState,
  tx: number,
  tz: number,
  speed: number,
  loftVy: number,
  curveMag: number,
  isShot: boolean,
): void {
  const b = match.ball;
  const dx = tx - b.x;
  const dz = tz - b.z;
  const dist = Math.max(0.1, Math.hypot(dx, dz));
  const nx = dx / dist;
  const nz = dz / dist;

  b.ownerId = null;
  b.inHands = false;
  b.lastTouchTeam = kicker.team;
  b.vx = nx * speed;
  b.vz = nz * speed;
  b.vy = loftVy;
  // Perpendicular Magnus curve vector
  b.curveX = -nz * curveMag;
  b.curveZ = nx * curveMag;
  b.isShot = isShot;
  b.shotTargetTeam = isShot ? otherTeam(kicker.team) : null;

  kicker.localYaw = Math.atan2(nx, nz);
  kicker.action = 'kick';
  kicker.actionTimer = 0;
  kicker.actionDuration = 0.42;
  kicker.tackleCooldown = 0.55;

  if (Math.abs(curveMag) > 0.6) match.stats.curves += 1;
  if (isShot) match.stats.shots += 1;
}

function positionBallInHands(
  p: FootballPlayerState,
  b: FootballBallState,
  pose: 'ground-pickup' | 'chest' | 'overhead',
  pickupBlend = 0,
): void {
  b.inHands = true;
  b.handPose = pose;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.curveX = 0;
  b.curveZ = 0;
  b.isShot = false;
  b.shotTargetTeam = null;

  const sinY = Math.sin(p.localYaw);
  const cosY = Math.cos(p.localYaw);
  const s = p.scale;

  if (pose === 'ground-pickup') {
    const forward = 0.48 * s;
    b.x = p.x + sinY * forward;
    b.z = p.z + cosY * forward;
    b.y = BALL_RADIUS + pickupBlend * (0.86 * s);
  } else if (pose === 'overhead') {
    const forward = 0.14 * s;
    b.x = p.x + sinY * forward;
    b.z = p.z + cosY * forward;
    b.y = 1.92 * s;
  } else {
    const forward = 0.42 * s;
    b.x = p.x + sinY * forward;
    b.z = p.z + cosY * forward;
    b.y = 1.05 * s;
  }
}

function chooseBestPassTarget(
  match: FootballMatchState,
  carrier: FootballPlayerState,
): FootballPlayerState | null {
  const dir = attackDir(carrier.team);
  let best: FootballPlayerState | null = null;
  let bestScore = -Infinity;
  for (const mate of match.players) {
    if (mate.team !== carrier.team || mate.id === carrier.id || mate.role === 'gk') continue;
    const dist = Math.hypot(mate.x - carrier.x, mate.z - carrier.z);
    if (dist < 2.8 || dist > match.spec.halfLength * 0.95) continue;
    const forwardGain = (mate.z - carrier.z) * dir;
    // Check openness from nearest opponent
    let minOpp = 99;
    for (const opp of match.players) {
      if (opp.team === carrier.team) continue;
      const d = Math.hypot(opp.x - mate.x, opp.z - mate.z);
      if (d < minOpp) minOpp = d;
    }
    const score = forwardGain * 0.7 + Math.min(minOpp, 12) * 1.15 - Math.abs(dist - 12) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = mate;
    }
  }
  return best;
}

function startThrowIn(match: FootballMatchState, outX: number, outZ: number, lastTouch: FootballTeam): void {
  const spec = match.spec;
  const throwTeam = otherTeam(lastTouch);
  const sideSign = outX >= 0 ? 1 : -1;
  const lineX = sideSign * (spec.halfWidth + 0.45);
  const clampedZ = clamp(outZ, -spec.halfLength * 0.8, spec.halfLength * 0.8);

  // Pick closest outfield player from throwTeam
  let taker = match.players.find((p) => p.team === throwTeam && p.role !== 'gk')!;
  let bestD = Infinity;
  for (const p of match.players) {
    if (p.team !== throwTeam || p.role === 'gk') continue;
    const d = Math.hypot(p.x - lineX, p.z - clampedZ);
    if (d < bestD) {
      bestD = d;
      taker = p;
    }
  }

  match.phase = 'throw-in-pickup';
  match.phaseTimer = 0;
  match.actingPlayerId = taker.id;
  match.restartX = lineX;
  match.restartZ = clampedZ;

  const b = match.ball;
  b.ownerId = null;
  b.inHands = false;
  b.isShot = false;
  b.shotTargetTeam = null;
  b.x = sideSign * (spec.halfWidth + 1.05);
  b.z = clampedZ;
  b.y = BALL_RADIUS;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.curveX = 0;
  b.curveZ = 0;
}

function startGkPickup(match: FootballMatchState, gkTeam: FootballTeam, ballX: number, ballZ: number): void {
  const gk = getGoalkeeper(match, gkTeam);
  const spec = match.spec;
  const goalZ = gkTeam === 'red' ? -spec.halfLength : spec.halfLength;
  const inward = gkTeam === 'red' ? 1 : -1;

  match.phase = 'gk-pickup';
  match.phaseTimer = 0;
  match.actingPlayerId = gk.id;
  match.restartX = clamp(ballX, -spec.goalHalfWidth * 1.4, spec.goalHalfWidth * 1.4);
  match.restartZ = clamp(ballZ, Math.min(goalZ - 1.2, goalZ + inward * 3.5), Math.max(goalZ + 1.2, goalZ + inward * 3.5));

  const b = match.ball;
  b.ownerId = null;
  b.inHands = false;
  b.isShot = false;
  b.shotTargetTeam = null;
  b.x = match.restartX;
  b.z = match.restartZ;
  b.y = BALL_RADIUS;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.curveX = 0;
  b.curveZ = 0;
}

function startGoalCelebration(match: FootballMatchState, scoringTeam: FootballTeam): void {
  if (scoringTeam === 'red') match.stats.goalsRed += 1;
  else match.stats.goalsGreen += 1;

  match.phase = 'goal-celebration';
  match.phaseTimer = 2.1;
  match.scoringTeam = scoringTeam;
  match.kickoffTeam = otherTeam(scoringTeam);
  match.actingPlayerId = null;

  const b = match.ball;
  b.ownerId = null;
  b.inHands = false;
  b.isShot = false;
  b.shotTargetTeam = null;
  // Settle inside net
  b.vx *= 0.22;
  b.vz *= 0.22;
  b.vy = Math.min(b.vy, 1.2);
  b.curveX = 0;
  b.curveZ = 0;

  for (const p of match.players) {
    if (p.team === scoringTeam && p.role !== 'gk') {
      p.action = 'celebrate';
      p.actionTimer = 0;
      p.actionDuration = 2.1;
    }
  }
}

function startKickoff(match: FootballMatchState): void {
  const spec = match.spec;
  match.phase = 'kickoff';
  match.phaseTimer = 0.85;
  match.scoringTeam = null;

  const kicker =
    match.players.find((p) => p.team === match.kickoffTeam && p.role === 'fwd') ??
    match.players.find((p) => p.team === match.kickoffTeam && p.role !== 'gk')!;
  match.actingPlayerId = kicker.id;

  const b = match.ball;
  b.x = 0;
  b.y = BALL_RADIUS;
  b.z = 0;
  b.vx = 0;
  b.vy = 0;
  b.vz = 0;
  b.curveX = 0;
  b.curveZ = 0;
  b.ownerId = null;
  b.inHands = false;
  b.isShot = false;
  b.shotTargetTeam = null;

  for (const p of match.players) {
    const sign = p.team === 'red' ? 1 : -1;
    if (p.id === kicker.id) {
      p.x = -0.35 * sign;
      p.z = -0.6 * sign;
      p.localYaw = p.team === 'red' ? 0 : Math.PI;
    } else if (p.role === 'gk') {
      p.x = 0;
      p.z = -sign * (spec.halfLength - 1.35);
      p.localYaw = p.team === 'red' ? 0 : Math.PI;
    } else {
      // Keep non-kickoff players in their own half
      p.x = p.homeX * 0.85;
      p.z = sign > 0 ? Math.min(-2.2, p.homeZ * 0.85) : Math.max(2.2, p.homeZ * 0.85);
      p.localYaw = p.team === 'red' ? 0 : Math.PI;
    }
    p.vx = 0;
    p.vz = 0;
    p.speed = 0;
    p.leanRoll = 0;
    p.feintTimer = 0;
    p.action = p.role === 'gk' ? 'gk-ready' : 'idle';
  }
}

export function stepFootballMatch(
  match: FootballMatchState,
  rawDt: number,
  obstacle?: FootballObstacle | null,
): void {
  const dt = Math.min(Math.max(rawDt, 0), 0.08);
  if (dt <= 0) return;

  const spec = match.spec;
  const b = match.ball;
  const scaleFactor = clamp(spec.halfLength / 38, 0.45, 1.05);
  const runSpeed = 4.6 + 2.3 * scaleFactor;
  const sprintSpeed = 5.6 + 2.6 * scaleFactor;
  const dribbleSpeed = 3.8 + 1.9 * scaleFactor;

  match.playClock += dt;

  // Tick individual player cooldowns & action timers
  for (const p of match.players) {
    if (p.tackleCooldown > 0) p.tackleCooldown = Math.max(0, p.tackleCooldown - dt);
    if (p.feintTimer > 0) p.feintTimer = Math.max(0, p.feintTimer - dt);
    if (p.actionDuration > 0) {
      p.actionTimer += dt;
      if (p.actionTimer >= p.actionDuration) {
        p.actionDuration = 0;
        p.actionTimer = 0;
        if (p.action === 'kick' || p.action === 'gk-dive' || p.action === 'throw-ball') {
          p.action = p.role === 'gk' ? 'gk-ready' : 'run';
          p.diveDir = 0;
        }
      }
    }
  }

  // Convert optional world obstacle (e.g. grounded balloon on Myothar pitch) into pitch-local coordinates
  let localObs: { x: number; z: number; r: number } | null = null;
  if (obstacle) {
    const loc = worldToLocal(spec, obstacle.wx, obstacle.wz);
    if (Math.abs(loc.x) < spec.halfWidth + 4 && Math.abs(loc.z) < spec.halfLength + 4) {
      localObs = { x: loc.x, z: loc.z, r: obstacle.radius };
    }
  }

  // =========================================================================
  // PHASE 1: KICKOFF
  // =========================================================================
  if (match.phase === 'kickoff') {
    match.phaseTimer -= dt;
    const kicker = getPlayerById(match, match.actingPlayerId);
    if (kicker && match.phaseTimer <= 0) {
      const target =
        chooseBestPassTarget(match, kicker) ??
        match.players.find((p) => p.team === kicker.team && p.id !== kicker.id && p.role !== 'gk')!;
      const passSpeed = 8.5 + 4.5 * scaleFactor;
      const curve = (nextRand(match) > 0.5 ? 1 : -1) * (1.2 + nextRand(match) * 1.4);
      launchBall(match, kicker, target.x, target.z, passSpeed, 0.9, curve, false);
      match.phase = 'open-play';
      match.actingPlayerId = null;
    }
  }

  // =========================================================================
  // PHASE 2: GOAL CELEBRATION -> GK PICKUP or KICKOFF
  // =========================================================================
  else if (match.phase === 'goal-celebration') {
    match.phaseTimer -= dt;
    // Let ball finish rolling inside net
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y = Math.max(BALL_RADIUS, b.y + b.vy * dt);
    if (b.y > BALL_RADIUS) b.vy -= GRAVITY * dt;
    else {
      b.vy = 0;
      b.vx *= Math.max(0, 1 - dt * 4);
      b.vz *= Math.max(0, 1 - dt * 4);
    }

    for (const p of match.players) {
      if (p.team === match.scoringTeam && p.role !== 'gk') {
        p.action = 'celebrate';
        p.walkPhase += dt * 7.5;
        movePlayerToward(p, p.homeX * 0.4, 0, runSpeed * 0.45, dt, spec);
      } else if (p.role === 'gk') {
        p.action = 'gk-ready';
        p.speed = 0;
      } else {
        p.action = 'run';
        movePlayerToward(p, p.homeX * 0.7, p.homeZ * 0.7, runSpeed * 0.5, dt, spec);
      }
    }

    if (match.phaseTimer <= 0) {
      startKickoff(match);
    }
  }

  // =========================================================================
  // PHASE 3: SIDELINE THROW-IN PICKUP (ဘောလုံးကောက်တယ်) -> THROW-IN (ဘောလုံးပစ်တယ်)
  // =========================================================================
  else if (match.phase === 'throw-in-pickup') {
    const taker = getPlayerById(match, match.actingPlayerId);
    if (!taker) {
      match.phase = 'open-play';
    } else {
      const distToBall = Math.hypot(b.x - taker.x, b.z - taker.z);
      if (match.phaseTimer <= 0 && distToBall > 0.75) {
        taker.action = 'run';
        movePlayerToward(taker, b.x, b.z, sprintSpeed * 0.92, dt, spec, true);
      } else {
        // Bend down to pick up the ball (0.75s)
        if (match.phaseTimer === 0) {
          match.stats.pickups += 1;
        }
        match.phaseTimer += dt;
        taker.vx = 0;
        taker.vz = 0;
        taker.speed = 0;
        taker.localYaw = Math.atan2(b.x - taker.x, b.z - taker.z);
        taker.action = 'pickup-ball';
        taker.actionTimer = match.phaseTimer;
        taker.actionDuration = 0.78;
        const lift = clamp((match.phaseTimer - 0.25) / 0.5, 0, 1);
        positionBallInHands(taker, b, 'ground-pickup', lift);

        if (match.phaseTimer >= 0.78) {
          match.phase = 'throw-in';
          match.phaseTimer = 0;
          taker.action = 'hold-ball';
        }
      }

      // Teammates & opponents shift into open throw-in receiving spots
      for (const p of match.players) {
        if (p.id === taker.id) continue;
        if (p.role === 'gk') {
          p.action = 'gk-ready';
          p.speed = 0;
          continue;
        }
        const tx = clamp(p.homeX * 0.65 + match.restartX * 0.35, -spec.halfWidth + 2, spec.halfWidth - 2);
        const tz = clamp(p.homeZ * 0.55 + match.restartZ * 0.45, -spec.halfLength + 4, spec.halfLength - 4);
        const d = movePlayerToward(p, tx, tz, runSpeed * 0.62, dt, spec);
        p.action = d > 0.6 ? 'run' : 'idle';
      }
    }
  } else if (match.phase === 'throw-in') {
    const taker = getPlayerById(match, match.actingPlayerId);
    if (!taker) {
      match.phase = 'open-play';
    } else {
      const distToLine = Math.hypot(match.restartX - taker.x, match.restartZ - taker.z);
      if (match.phaseTimer === 0 && distToLine > 0.45) {
        taker.action = 'hold-ball';
        movePlayerToward(taker, match.restartX, match.restartZ, runSpeed * 0.65, dt, spec, true);
        positionBallInHands(taker, b, 'chest');
      } else {
        match.phaseTimer += dt;
        taker.vx = 0;
        taker.vz = 0;
        taker.speed = 0;
        // Face inward toward pitch & teammate
        const receiver =
          chooseBestPassTarget(match, taker) ??
          match.players.find((p) => p.team === taker.team && p.id !== taker.id && p.role !== 'gk')!;
        const targetX = clamp(receiver.x, -spec.halfWidth * 0.7, spec.halfWidth * 0.7);
        const targetZ = clamp(receiver.z, -spec.halfLength * 0.8, spec.halfLength * 0.8);
        taker.localYaw = Math.atan2(targetX - taker.x, targetZ - taker.z);
        taker.action = 'throw-ball';
        taker.actionTimer = match.phaseTimer;
        taker.actionDuration = 0.82;
        positionBallInHands(taker, b, 'overhead');

        if (match.phaseTimer >= 0.58) {
          // Release overhead throw-in in a high arc!
          const dx = targetX - b.x;
          const dz = targetZ - b.z;
          const dist = Math.max(2, Math.hypot(dx, dz));
          const throwSpeed = clamp(dist * 0.85, 6.5, 13.5);
          b.inHands = false;
          b.ownerId = null;
          b.lastTouchTeam = taker.team;
          b.vx = (dx / dist) * throwSpeed;
          b.vz = (dz / dist) * throwSpeed;
          b.vy = 4.6 + Math.min(2.2, dist * 0.12);
          b.curveX = 0;
          b.curveZ = 0;
          b.isShot = false;
          match.stats.throws += 1;
          taker.tackleCooldown = 0.7;
          match.phase = 'open-play';
          match.actingPlayerId = null;
        }
      }

      for (const p of match.players) {
        if (p.id === taker.id) continue;
        if (p.role === 'gk') {
          p.action = 'gk-ready';
          continue;
        }
        p.localYaw = Math.atan2(taker.x - p.x, taker.z - p.z);
        p.speed = 0;
        p.action = 'idle';
      }
    }
  }

  // =========================================================================
  // PHASE 4: GOALKEEPER PICKUP (ဘောလုံးကောက်တယ်) -> HOLD -> GK THROW (ဘောလုံးပစ်တယ်)
  // =========================================================================
  else if (match.phase === 'gk-pickup') {
    const gk = getPlayerById(match, match.actingPlayerId);
    if (!gk) {
      match.phase = 'open-play';
    } else {
      const distToBall = Math.hypot(b.x - gk.x, b.z - gk.z);
      if (match.phaseTimer <= 0 && distToBall > 0.75) {
        gk.action = 'run';
        movePlayerToward(gk, b.x, b.z, sprintSpeed * 0.85, dt, spec, true);
      } else {
        if (match.phaseTimer === 0) {
          match.stats.pickups += 1;
        }
        match.phaseTimer += dt;
        gk.vx = 0;
        gk.vz = 0;
        gk.speed = 0;
        gk.localYaw = Math.atan2(b.x - gk.x, b.z - gk.z);
        gk.action = 'pickup-ball';
        gk.actionTimer = match.phaseTimer;
        gk.actionDuration = 0.75;
        const lift = clamp((match.phaseTimer - 0.22) / 0.48, 0, 1);
        positionBallInHands(gk, b, 'ground-pickup', lift);
        if (match.phaseTimer >= 0.75) {
          match.phase = 'gk-hold';
          match.phaseTimer = 0;
        }
      }
    }
    // Outfield players reset toward their formation
    for (const p of match.players) {
      if (p.id === match.actingPlayerId) continue;
      if (p.role === 'gk') {
        p.action = 'gk-ready';
        continue;
      }
      const d = movePlayerToward(p, p.homeX, p.homeZ, runSpeed * 0.58, dt, spec);
      p.action = d > 0.5 ? 'run' : 'idle';
    }
  } else if (match.phase === 'gk-hold') {
    const gk = getPlayerById(match, match.actingPlayerId);
    if (!gk) {
      match.phase = 'open-play';
    } else {
      match.phaseTimer += dt;
      const dir = attackDir(gk.team);
      const boxZ = -dir * (spec.halfLength - Math.min(5.5, spec.halfLength * 0.24));
      movePlayerToward(gk, 0, boxZ, runSpeed * 0.55, dt, spec);
      gk.localYaw = dir > 0 ? 0 : Math.PI;
      gk.action = 'hold-ball';
      positionBallInHands(gk, b, 'chest');

      if (match.phaseTimer >= 0.95) {
        match.phase = 'gk-throw';
        match.phaseTimer = 0;
      }
    }
    for (const p of match.players) {
      if (p.id === match.actingPlayerId) continue;
      if (p.role === 'gk') {
        p.action = 'gk-ready';
        continue;
      }
      const d = movePlayerToward(p, p.homeX, p.homeZ, runSpeed * 0.62, dt, spec);
      p.action = d > 0.5 ? 'run' : 'idle';
    }
  } else if (match.phase === 'gk-throw') {
    const gk = getPlayerById(match, match.actingPlayerId);
    if (!gk) {
      match.phase = 'open-play';
    } else {
      match.phaseTimer += dt;
      gk.vx = 0;
      gk.vz = 0;
      gk.speed = 0;
      const mate =
        match.players.find((p) => p.team === gk.team && p.role === 'mid') ??
        match.players.find((p) => p.team === gk.team && p.id !== gk.id)!;
      gk.localYaw = Math.atan2(mate.x - gk.x, mate.z - gk.z);
      gk.action = 'throw-ball';
      gk.actionTimer = match.phaseTimer;
      gk.actionDuration = 0.72;
      positionBallInHands(gk, b, 'overhead');

      if (match.phaseTimer >= 0.52) {
        const dx = mate.x - b.x;
        const dz = mate.z - b.z;
        const dist = Math.max(3, Math.hypot(dx, dz));
        const throwSpeed = clamp(dist * 0.72, 8.5, 16.5);
        b.inHands = false;
        b.ownerId = null;
        b.lastTouchTeam = gk.team;
        b.vx = (dx / dist) * throwSpeed;
        b.vz = (dz / dist) * throwSpeed;
        b.vy = 5.4 + Math.min(2.8, dist * 0.1);
        b.curveX = 0;
        b.curveZ = 0;
        b.isShot = false;
        match.stats.throws += 1;
        gk.tackleCooldown = 0.9;
        match.phase = 'open-play';
        match.actingPlayerId = null;
      }
    }
  }

  // =========================================================================
  // PHASE 5: OPEN PLAY (ကွေ့တယ်၊ လိမ်တယ်၊ ဂိုးသွင်းတယ်၊ ဂိုးဖမ်းတယ်)
  // =========================================================================
  else if (match.phase === 'open-play') {
    const carrier = getPlayerById(match, b.ownerId);

    // 1. Update ball physics (if free) or dribble attachment (if owned)
    if (!carrier) {
      b.inHands = false;
      // Apply Magnus lateral curve while airborne or rolling fast
      const hSpeed = Math.hypot(b.vx, b.vz);
      if (hSpeed > 1.2) {
        b.vx += b.curveX * dt;
        b.vz += b.curveZ * dt;
        b.curveX *= Math.max(0, 1 - dt * 1.15);
        b.curveZ *= Math.max(0, 1 - dt * 1.15);
      } else {
        b.curveX = 0;
        b.curveZ = 0;
      }

      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.y += b.vy * dt;

      if (b.y > BALL_RADIUS) {
        b.vy -= GRAVITY * dt;
      } else {
        b.y = BALL_RADIUS;
        if (b.vy < -1.1) {
          b.vy = -b.vy * TURF_RESTITUTION;
        } else {
          b.vy = 0;
        }
        const damp = Math.max(0, 1 - TURF_FRICTION * dt);
        b.vx *= damp;
        b.vz *= damp;
      }

      // Spin visual rotation proportional to velocity
      b.rotX += (b.vz / BALL_RADIUS) * dt;
      b.rotZ -= (b.vx / BALL_RADIUS) * dt;

      // Deflect cleanly around grounded balloon obstacle if present
      if (localObs) {
        const odx = b.x - localObs.x;
        const odz = b.z - localObs.z;
        const od = Math.hypot(odx, odz);
        if (od < localObs.r + BALL_RADIUS && od > 0.001) {
          const nx = odx / od;
          const nz = odz / od;
          b.x = localObs.x + nx * (localObs.r + BALL_RADIUS + 0.08);
          b.z = localObs.z + nz * (localObs.r + BALL_RADIUS + 0.08);
          const dot = b.vx * nx + b.vz * nz;
          if (dot < 0) {
            b.vx -= 1.6 * dot * nx;
            b.vz -= 1.6 * dot * nz;
          }
        }
      }

      // Check Goalkeeper Save / Catch (ဂိုးဖမ်းတယ်)
      if (b.isShot && b.shotTargetTeam) {
        const gk = getGoalkeeper(match, b.shotTargetTeam);
        const goalZ = b.shotTargetTeam === 'red' ? -spec.halfLength : spec.halfLength;
        const distToGoal = Math.abs(goalZ - b.z);
        const saveRadius = Math.min(1.48, Math.max(0.72, spec.goalHalfWidth * 0.41));
        if (distToGoal < 3.4) {
          const distToGk = Math.hypot(b.x - gk.x, b.z - gk.z);
          if (distToGk < saveRadius && b.y < spec.goalHeight + 0.25) {
            // Dramatic goalkeeper dive & catch!
            gk.diveDir = b.x >= gk.x ? 1 : -1;
            gk.action = 'gk-dive';
            gk.actionTimer = 0;
            gk.actionDuration = 0.65;
            match.stats.saves += 1;
            match.phase = 'gk-hold';
            match.phaseTimer = 0;
            match.actingPlayerId = gk.id;
            b.ownerId = gk.id;
            b.isShot = false;
            b.shotTargetTeam = null;
            positionBallInHands(gk, b, 'chest');
          }
        }
      }

      // Check Goal Scored OR Goal-Line Out OR Sideline Out (Throw-In)
      if (match.phase === 'open-play') {
        if (Math.abs(b.z) >= spec.halfLength) {
          if (Math.abs(b.x) < spec.goalHalfWidth - 0.15 && b.y <= spec.goalHeight) {
            const scorer: FootballTeam = b.z > 0 ? 'red' : 'green';
            startGoalCelebration(match, scorer);
          } else {
            // Went wide over goal line -> Goalkeeper picks up & restarts!
            const gkTeam: FootballTeam = b.z > 0 ? 'green' : 'red';
            startGkPickup(match, gkTeam, b.x, b.z);
          }
        } else if (Math.abs(b.x) > spec.halfWidth + 0.25) {
          // Went over touchline -> Sideline pickup + overhead throw-in!
          startThrowIn(match, b.x, b.z, b.lastTouchTeam);
        }
      }

      // Check Player Ball Pickup / Control during open play
      if (match.phase === 'open-play' && b.y < 1.35) {
        let claimer: FootballPlayerState | null = null;
        let bestDist = 1.18;
        for (const p of match.players) {
          if (p.tackleCooldown > 0) continue;
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          if (d < bestDist) {
            bestDist = d;
            claimer = p;
          }
        }
        if (claimer) {
          if (claimer.role === 'gk') {
            // Goalkeeper catches loose ball in box -> hold & throw out!
            match.stats.saves += 1;
            match.phase = 'gk-hold';
            match.phaseTimer = 0;
            match.actingPlayerId = claimer.id;
            b.ownerId = claimer.id;
            positionBallInHands(claimer, b, 'chest');
          } else {
            b.ownerId = claimer.id;
            b.lastTouchTeam = claimer.team;
            b.isShot = false;
            b.shotTargetTeam = null;
            b.curveX = 0;
            b.curveZ = 0;
            b.y = BALL_RADIUS;
            b.vy = 0;
          }
        }
      }
    }

    // 2. AI for every player during open play
    if (match.phase === 'open-play') {
      const activeCarrier = getPlayerById(match, b.ownerId);

      // Find nearest chaser from each team when ball is loose or opponent has ball
      const nearestChaser: Record<FootballTeam, FootballPlayerState | null> = { red: null, green: null };
      for (const team of ['red', 'green'] as const) {
        let bestD = Infinity;
        for (const p of match.players) {
          if (p.team !== team || p.role === 'gk' || p.id === activeCarrier?.id) continue;
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          if (d < bestD) {
            bestD = d;
            nearestChaser[team] = p;
          }
        }
      }

      for (const p of match.players) {
        // --- GOALKEEPER AI ---
        if (p.role === 'gk') {
          const goalZ = p.team === 'red' ? -spec.halfLength + 1.35 : spec.halfLength - 1.35;
          const targetX = clamp(b.x * 0.34, -(spec.goalHalfWidth - 0.65), spec.goalHalfWidth - 0.65);
          const gkSpeed = b.isShot && b.shotTargetTeam === p.team ? runSpeed * 0.82 : runSpeed * 0.68;

          // Anticipate diving stretch when a shot approaches
          if (b.isShot && b.shotTargetTeam === p.team && Math.abs(goalZ - b.z) < 9.5) {
            const timeToGoal = Math.abs((goalZ - b.z) / (Math.abs(b.vz) + 0.5));
            const predictedX = clamp(b.x + b.vx * timeToGoal * 0.78, -spec.goalHalfWidth, spec.goalHalfWidth);
            movePlayerToward(p, predictedX, goalZ, gkSpeed, dt, spec);
            if (Math.abs(goalZ - b.z) < 5.5 && Math.abs(predictedX - p.x) > 0.6 && p.action !== 'gk-dive') {
              p.diveDir = predictedX > p.x ? 1 : -1;
              p.action = 'gk-dive';
              p.actionTimer = 0;
              p.actionDuration = 0.55;
            }
          } else {
            movePlayerToward(p, targetX, goalZ, gkSpeed, dt, spec);
            if (p.action !== 'gk-dive') p.action = 'gk-ready';
          }
          p.localYaw = Math.atan2(b.x - p.x, b.z - p.z);
          continue;
        }

        // --- BALL CARRIER AI (ကွေ့တယ် + လိမ်တယ် + ဂိုးသွင်းတယ် + Pass) ---
        if (activeCarrier && p.id === activeCarrier.id) {
          const dir = attackDir(p.team);
          const oppGoalZ = dir * spec.halfLength;
          const distToGoal = Math.abs(oppGoalZ - p.z);

          // Find closest opponent defender
          let closestOpp: FootballPlayerState | null = null;
          let closestOppDist = Infinity;
          for (const opp of match.players) {
            if (opp.team === p.team || opp.role === 'gk') continue;
            const d = Math.hypot(opp.x - p.x, opp.z - p.z);
            if (d < closestOppDist) {
              closestOppDist = d;
              closestOpp = opp;
            }
          }

          // Periodic sideline deflection so throw-in pickup & throw-in happen naturally during matches
          const nearSideline = Math.abs(p.x) > spec.halfWidth * 0.74;
          if (match.playClock >= match.nextPlannedEventAt && nearSideline && closestOppDist < 4.5) {
            match.nextPlannedEventAt = match.playClock + 14 + nextRand(match) * 8;
            const outSide = p.x >= 0 ? 1 : -1;
            launchBall(
              match,
              p,
              outSide * (spec.halfWidth + 2.5),
              p.z + dir * 2.5,
              7.5,
              1.1,
              0,
              false,
            );
            continue;
          }

          // 1) SHOOT AT GOAL (ဂိုးသွင်းတယ်) when within range!
          const shootRange = Math.max(9.5, spec.halfLength * 0.44);
          if (distToGoal < shootRange && Math.abs(p.x) < spec.halfWidth * 0.76) {
            const oppGk = getGoalkeeper(match, otherTeam(p.team));
            // Shoot for the open corner away from the keeper 65% of the time for realistic goals & diving saves
            const openCorner = oppGk.x >= 0 ? -1 : 1;
            const cornerSign = nextRand(match) < 0.65 ? openCorner : -openCorner;
            const onTarget = nextRand(match) < 0.82;
            const aimX = onTarget
              ? cornerSign * (spec.goalHalfWidth * (0.56 + nextRand(match) * 0.34))
              : cornerSign * (spec.goalHalfWidth + 1.3 + nextRand(match) * 1.1);
            const shotSpeed = 16.5 + 8.5 * scaleFactor;
            const loftVy = 1.6 + nextRand(match) * 1.6;
            const curveMag = -cornerSign * (1.2 + nextRand(match) * 1.6);
            launchBall(match, p, aimX, oppGoalZ + dir * 1.5, shotSpeed, loftVy, curveMag, true);
            continue;
          }

          // 2) DRIBBLE FEINT (လိမ်တယ်) when defender closes in!
          if (closestOpp && closestOppDist < 4.6 && p.feintTimer <= 0) {
            // Choose cut direction away from defender & toward pitch center
            const cutSign =
              Math.abs(p.x) > spec.halfWidth * 0.65
                ? p.x > 0
                  ? -1
                  : 1
                : closestOpp.x >= p.x
                  ? -1
                  : 1;
            p.feintDir = cutSign;
            p.feintTimer = 0.72;
            p.action = 'dribble-feint';
            match.stats.feints += 1;

            // 32% chance defender wins a clean tackle instead of getting beaten
            if (closestOppDist < 1.55 && closestOpp.tackleCooldown <= 0 && nextRand(match) < 0.34) {
              b.ownerId = closestOpp.id;
              b.lastTouchTeam = closestOpp.team;
              p.tackleCooldown = 1.05;
              p.feintTimer = 0;
              closestOpp.tackleCooldown = 0.5;
              continue;
            } else {
              // Feint beats defender momentarily!
              closestOpp.tackleCooldown = 0.85;
            }
          }

          // 3) CURVED PASS to open forward teammate occasionally
          if (closestOppDist < 3.4 && p.feintTimer <= 0.15 && nextRand(match) < 0.045) {
            const mate = chooseBestPassTarget(match, p);
            if (mate) {
              const dist = Math.hypot(mate.x - p.x, mate.z - p.z);
              const passSpeed = clamp(dist * 0.92, 8.5, 16.5);
              const curve = (nextRand(match) > 0.5 ? 1 : -1) * (1.4 + nextRand(match) * 1.8);
              launchBall(match, p, mate.x, mate.z + dir * 2.2, passSpeed, 0.85, curve, false);
              continue;
            }
          }

          // 4) CURVING DRIBBLE RUN (ကွေ့တယ် + လိမ်တယ်) toward opponent goal
          const weaveOffset =
            p.feintTimer > 0
              ? p.feintDir * 4.2
              : Math.sin(match.playClock * 1.45 + p.slotIndex) * Math.min(5.5, spec.halfWidth * 0.34);
          let targetX = clamp(p.x + weaveOffset * 0.55, -spec.halfWidth * 0.84, spec.halfWidth * 0.84);
          const targetZ = clamp(p.z + dir * 7.5, -spec.halfLength + 2.2, spec.halfLength - 2.2);

          // Steer cleanly around grounded balloon obstacle
          if (localObs) {
            const odx = p.x - localObs.x;
            const odz = p.z - localObs.z;
            if (Math.hypot(odx, odz) < localObs.r + 3.2) {
              targetX = localObs.x + (odx >= 0 ? localObs.r + 4.5 : -(localObs.r + 4.5));
            }
          }

          movePlayerToward(p, targetX, targetZ, dribbleSpeed, dt, spec);
          p.action = p.feintTimer > 0 ? 'dribble-feint' : 'dribble';

          // Keep ball dynamically rolling right at carrier's feet
          const footOffset = 0.62 * p.scale + Math.sin(p.walkPhase * 2) * 0.12;
          const lateralFeint = p.feintTimer > 0 ? p.feintDir * Math.sin(p.feintTimer * 12) * 0.28 : 0;
          const sinY = Math.sin(p.localYaw);
          const cosY = Math.cos(p.localYaw);
          b.x = p.x + sinY * footOffset + cosY * lateralFeint;
          b.z = p.z + cosY * footOffset - sinY * lateralFeint;
          b.y = BALL_RADIUS;
          b.vx = p.vx;
          b.vz = p.vz;
          b.rotX += (p.speed / BALL_RADIUS) * dt;
          if (Math.abs(p.leanRoll) > 0.14 && nextRand(match) < 0.08) {
            match.stats.curves += 1;
          }
          continue;
        }

        // --- CHASER / PRESSER AI ---
        if (nearestChaser[p.team]?.id === p.id) {
          movePlayerToward(p, b.x, b.z, sprintSpeed * 0.94, dt, spec);
          if (p.action !== 'kick') p.action = 'run';

          // Attempt interception / tackle on opponent ball carrier
          if (activeCarrier && activeCarrier.team !== p.team && p.tackleCooldown <= 0) {
            const d = Math.hypot(p.x - activeCarrier.x, p.z - activeCarrier.z);
            if (d < 1.25 && nextRand(match) < 0.14) {
              // Occasionally deflect ball out over nearest touchline when battling near sideline!
              if (Math.abs(b.x) > spec.halfWidth * 0.68 && nextRand(match) < 0.45) {
                const sideSign = b.x >= 0 ? 1 : -1;
                launchBall(match, p, sideSign * (spec.halfWidth + 2.5), b.z, 7.2, 0.9, 0, false);
              } else {
                b.ownerId = p.id;
                b.lastTouchTeam = p.team;
                activeCarrier.tackleCooldown = 0.95;
                p.tackleCooldown = 0.45;
              }
            }
          }
          continue;
        }

        // --- SUPPORTING TEAMMATE / DEFENDER FORMATION MOVEMENT ---
        const ballShiftZ = clamp(b.z * 0.48, -spec.halfLength * 0.42, spec.halfLength * 0.42);
        const ballShiftX = clamp(b.x * 0.35, -spec.halfWidth * 0.35, spec.halfWidth * 0.35);
        const targetX = clamp(p.homeX * 0.72 + ballShiftX, -spec.halfWidth + 2.2, spec.halfWidth - 2.2);
        const targetZ = clamp(p.homeZ * 0.68 + ballShiftZ, -spec.halfLength + 4.5, spec.halfLength - 4.5);
        const dist = movePlayerToward(p, targetX, targetZ, runSpeed * 0.82, dt, spec);
        if (p.action !== 'kick') {
          p.action = dist > 0.75 ? 'run' : 'idle';
          if (p.action === 'idle') {
            p.localYaw = lerpAngle(p.localYaw, Math.atan2(b.x - p.x, b.z - p.z), dt * 6);
          }
        }
      }
    }
  }

  // Soft player-to-player separation + obstacle clearance so players never stack
  const minSep = 0.92;
  for (let i = 0; i < match.players.length; i++) {
    const a = match.players[i];
    for (let j = i + 1; j < match.players.length; j++) {
      const c = match.players[j];
      const dx = a.x - c.x;
      const dz = a.z - c.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.001 && d < minSep) {
        const push = (minSep - d) * 0.5;
        const nx = dx / d;
        const nz = dz / d;
        a.x += nx * push;
        a.z += nz * push;
        c.x -= nx * push;
        c.z -= nz * push;
      }
    }
    if (localObs) {
      const dx = a.x - localObs.x;
      const dz = a.z - localObs.z;
      const d = Math.hypot(dx, dz);
      const keepOut = localObs.r + 0.65;
      if (d > 0.001 && d < keepOut) {
        a.x = localObs.x + (dx / d) * keepOut;
        a.z = localObs.z + (dz / d) * keepOut;
      }
    }
    syncPlayerWorld(spec, a);
  }

  syncBallWorld(spec, b);
}

/**
 * ============================================================================
 * Fixed Object Pool Controller for All Football Pitches
 * ============================================================================
 * Bounds active rendered players to a fixed slot pool (`28` desktop / `14` mobile)
 * and balls to `4` slots, binding only pitches in active regions near the camera.
 */
export const FOOTBALL_PLAYER_POOL_DESKTOP = 28;
export const FOOTBALL_PLAYER_POOL_MOBILE = 14;
export const FOOTBALL_BALL_POOL_SIZE = FOOTBALL_PITCH_SPECS.length;

export class FootballMatchPoolController {
  readonly matches: readonly FootballMatchState[];
  readonly playerSlots: (FootballPlayerState | null)[];
  readonly ballSlots: (FootballBallState | null)[];
  readonly maxRange: number;

  constructor(playerPoolSize: number, maxRange: number) {
    this.matches = FOOTBALL_PITCH_SPECS.map((spec) => createFootballMatchState(spec));
    this.playerSlots = Array.from({ length: playerPoolSize }, () => null);
    this.ballSlots = Array.from({ length: FOOTBALL_BALL_POOL_SIZE }, () => null);
    this.maxRange = maxRange;
  }

  update(
    camX: number,
    camZ: number,
    dt: number,
    activeRegions: readonly string[],
    myotharObstacle?: FootballObstacle | null,
  ): void {
    const activeSet = new Set(activeRegions);

    // Select nearby active pitches sorted by distance to camera
    const visibleMatches = this.matches
      .map((m) => ({
        match: m,
        dist: Math.hypot(m.spec.centerX - camX, m.spec.centerZ - camZ),
      }))
      .filter((entry) => activeSet.has(entry.match.spec.regionId) && entry.dist <= this.maxRange)
      .sort((a, b) => a.dist - b.dist);

    // Clear pool slots cleanly before rebinding
    this.playerSlots.fill(null);
    this.ballSlots.fill(null);

    let playerCursor = 0;
    let ballCursor = 0;

    for (const { match } of visibleMatches) {
      // Only simulate pitches that actually fit into the fixed pool
      if (ballCursor >= this.ballSlots.length) break;
      const obs = match.spec.id === 'myothar-pitch' ? myotharObstacle : null;
      stepFootballMatch(match, dt, obs);
      publishFootballScoreboard(match);

      this.ballSlots[ballCursor++] = match.ball;
      for (const player of match.players) {
        if (playerCursor >= this.playerSlots.length) break;
        this.playerSlots[playerCursor++] = player;
      }
    }
  }
}
