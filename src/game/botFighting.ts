/**
 * Bump-to-Fight Bot Combat Engine (Bot ကို တိုက်မိလျှင် Box / Kick Fighting စနစ် + Bot 2× Speed Counter-Combos).
 *
 * Pure TypeScript (no Three.js / React / DOM imports) so it is fast, allocation-light,
 * and thoroughly unit-testable.
 *
 * - Player default moves: `box_01` (Box 01) and `front_kick_01` (Kick 01).
 * - Long-press switcher selects `box_02` (Box 02) or `front_kick_02` (Kick 02) and fights immediately.
 * - Close-quarters melee positioning (`~0.76m`) so fists & kicks visually connect cleanly.
 * - Persistent chase: while the fight is active and not cancelled, bots actively sprint after
 *   a fleeing player and attack the moment they close into melee reach.
 * - Child protection squad: fighting a child bot (`boy`/`girl`) immediately summons 4–10 nearby
 *   bots to rush in, surround the player, and defend the child!
 * - Bot celebrates defeating the player with `victory.glb` (`/motions/movement/victory.glb`).
 */

export type BoxMoveId = 'box_01' | 'box_02';
export type KickMoveId = 'front_kick_01' | 'front_kick_02';
export type BotFightMoveId = BoxMoveId | KickMoveId;
export type BotFightKind = 'box' | 'kick';

/** All GLB motion IDs driven on the fighting bot via `BotGlbMotionPlayer`. */
export type BotGlbCombatMotionId =
  | 'box_01'
  | 'box_02'
  | 'box_03'
  | 'front_kick_01'
  | 'front_kick_02'
  | 'warm_up'
  | 'press_up'
  | 'victory'
  | 'fall'
  | 'hit_to_body_01'
  | 'hit_to_stomach'
  | 'defeat_02';

export type BotAttackGlbId =
  | 'box_01'
  | 'box_02'
  | 'box_03'
  | 'front_kick_01'
  | 'front_kick_02';

export interface BotFightMoveMeta {
  readonly id: BotFightMoveId;
  readonly kind: BotFightKind;
  readonly shortLabel: string;
  readonly badge: '01' | '02';
  readonly myanmarLabel: string;
  readonly damage: number;
  /** Seconds after triggering when the strike connects with the target bot. */
  readonly impactSec: number;
  /** Total active move window (seconds) before next strike is considered idle. */
  readonly durationSec: number;
  /** Minimum cooldown between consecutive strikes (seconds). */
  readonly cooldownSec: number;
  readonly hitStrength: number;
}

export interface BotCounterAttackMeta {
  readonly id: BotAttackGlbId;
  readonly kind: BotFightKind;
  readonly shortLabel: string;
  readonly damage: number;
  /** Fast 2×-speed strike window (~0.46s–0.56s => 2 bot hits in 1 player strike!). */
  readonly durationSec: number;
  readonly impactSec: number;
  /** GLB AnimationMixer timeScale (2.0×+ faster than player's 1.0×!). */
  readonly playbackSpeed: number;
  readonly playerReactionClip: 'hit_to_body_01' | 'hit_to_stomach';
}

export interface ChildDefenderCandidate {
  readonly id: string;
  readonly label?: string;
  readonly x: number;
  readonly z: number;
  readonly npcRole?: string;
  readonly isChild?: boolean;
  readonly dist?: number;
}

export const BOX_MOVES: readonly BoxMoveId[] = ['box_01', 'box_02'];
export const KICK_MOVES: readonly KickMoveId[] = ['front_kick_01', 'front_kick_02'];

export const BOT_FIGHT_MOVE_META: Readonly<Record<BotFightMoveId, BotFightMoveMeta>> = {
  box_01: {
    id: 'box_01',
    kind: 'box',
    shortLabel: 'Box 01',
    badge: '01',
    myanmarLabel: 'လက်သီး ၁',
    damage: 18,
    impactSec: 0.3,
    durationSec: 1.05,
    cooldownSec: 0.42,
    hitStrength: 1.0,
  },
  box_02: {
    id: 'box_02',
    kind: 'box',
    shortLabel: 'Box 02',
    badge: '02',
    myanmarLabel: 'လက်သီး ၂',
    damage: 26,
    impactSec: 0.36,
    durationSec: 1.25,
    cooldownSec: 0.48,
    hitStrength: 1.45,
  },
  front_kick_01: {
    id: 'front_kick_01',
    kind: 'kick',
    shortLabel: 'Kick 01',
    badge: '01',
    myanmarLabel: 'ကန်ချက် ၁',
    damage: 22,
    impactSec: 0.32,
    durationSec: 1.15,
    cooldownSec: 0.45,
    hitStrength: 1.15,
  },
  front_kick_02: {
    id: 'front_kick_02',
    kind: 'kick',
    shortLabel: 'Kick 02',
    badge: '02',
    myanmarLabel: 'ကန်ချက် ၂',
    damage: 30,
    impactSec: 0.3,
    durationSec: 1.1,
    cooldownSec: 0.48,
    hitStrength: 1.55,
  },
};

/**
 * Rapid 2×-speed bot attack catalog using all 5 box & kick GLB files:
 * box_01.glb, box_02.glb, box_03.glb, front_kick_01.glb, front_kick_02.glb.
 */
export const BOT_COUNTER_ATTACK_META: Readonly<Record<BotAttackGlbId, BotCounterAttackMeta>> = {
  box_01: {
    id: 'box_01',
    kind: 'box',
    shortLabel: 'Box 01',
    damage: 9,
    durationSec: 0.5,
    impactSec: 0.18,
    playbackSpeed: 2.15,
    playerReactionClip: 'hit_to_body_01',
  },
  box_02: {
    id: 'box_02',
    kind: 'box',
    shortLabel: 'Box 02',
    damage: 11,
    durationSec: 0.56,
    impactSec: 0.22,
    playbackSpeed: 2.25,
    playerReactionClip: 'hit_to_body_01',
  },
  box_03: {
    id: 'box_03',
    kind: 'box',
    shortLabel: 'Box 03',
    damage: 10,
    durationSec: 0.52,
    impactSec: 0.19,
    playbackSpeed: 2.2,
    playerReactionClip: 'hit_to_body_01',
  },
  front_kick_01: {
    id: 'front_kick_01',
    kind: 'kick',
    shortLabel: 'Kick 01',
    damage: 12,
    durationSec: 0.54,
    impactSec: 0.21,
    playbackSpeed: 2.25,
    playerReactionClip: 'hit_to_stomach',
  },
  front_kick_02: {
    id: 'front_kick_02',
    kind: 'kick',
    shortLabel: 'Kick 02',
    damage: 13,
    durationSec: 0.46,
    impactSec: 0.17,
    playbackSpeed: 2.05,
    playerReactionClip: 'hit_to_stomach',
  },
};

/** Paired 2-hit rapid combos (bot executes BOTH hits in the time of 1 player strike!). */
export const BOT_DOUBLE_COMBOS: readonly (readonly [BotAttackGlbId, BotAttackGlbId])[] = [
  ['box_01', 'front_kick_02'],
  ['box_03', 'box_02'],
  ['front_kick_01', 'box_01'],
  ['box_02', 'front_kick_01'],
  ['box_03', 'front_kick_02'],
];

export const BOT_FIGHT_LONG_PRESS_MS = 420;
/** Tight chest-to-chest melee standoff distance so fists & kicks physically connect! */
export const BOT_MELEE_DESIRED_DIST = 0.76;
/** Tight surround radius for child-defense bots encircling the player. */
export const BOT_DEFENDER_DESIRED_DIST = 0.9;
/** Realistic close-quarters strike reach (bot actively closes in to BOT_MELEE_DESIRED_DIST). */
export const BOT_FIGHT_STRIKE_REACH = 1.48;
/** Kept for reference/back-compat; fighting now persists & chases until Cancel or KO. */
export const BOT_FIGHT_MAX_ENGAGE_DIST = 6.8;
/** Brisk sprint chase speed (m/s) when pursuing a fleeing player. */
export const BOT_CHASE_SPEED = 5.45;
/** Quick combat footwork speed (m/s) when closing the last ~1.5m into melee range. */
export const BOT_CLOSE_STEP_SPEED = 3.6;
/** Min/max nearby defender bots summoned when fighting a child bot (boy/girl). */
export const CHILD_DEFENDER_MIN = 4;
export const CHILD_DEFENDER_MAX = 10;
export const CHILD_DEFENDER_NEAR_RADIUS = 38;
export const BOT_FIGHT_MAX_HP = 100;
export const PLAYER_FIGHT_MAX_HP = 100;
/** Bot delivers 2 strikes per 1 player strike. */
export const BOT_COMBO_STRIKES_PER_EXCHANGE = 2;
/** Duration of player's fall.glb collapse before the Game Over dialog appears. */
export const PLAYER_KO_FALL_SEC = 1.65;
const BOT_KO_DURATION_SEC = 3.8;

export interface BotCombatReaction {
  engaged: boolean;
  /** True for nearby helper bots rushing in to defend a child bot. */
  isDefender: boolean;
  /** World Y yaw facing the player (local +Z faces player for Elder/Kid rigs). */
  facePlayerYaw: number;
  /** Live world XZ driven during close-in combat & persistent chasing. */
  hasWorldPos: boolean;
  worldX: number;
  worldZ: number;
  /** True while actively sprinting/stepping toward the player. */
  chasing: boolean;
  chaseSpeed: number;
  chaseYaw: number;
  walkDistance: number;
  /** Remaining hit stagger duration (seconds). */
  hitTime: number;
  hitDuration: number;
  hitStrength: number;
  hitKind: BotFightKind;
  /** Remaining knockdown / KO duration (seconds). */
  knockoutTime: number;
  /** Current GLB motion being played on this bot. */
  activeGlbMotion: BotGlbCombatMotionId;
  activeGlbSpeed: number;
  activeGlbLoop: boolean;
  activeGlbSeq: number;
  /** Active counter-attack state (2× speed 2-hit combos!). */
  attackMove: BotAttackGlbId | null;
  attackElapsed: number;
  attackDuration: number;
  attackImpactDelivered: boolean;
  /** Queued rapid follow-up attacks (e.g. 2nd hit of a 2-hit combo). */
  queuedMoves: BotAttackGlbId[];
  /** Delay before launching next aggressive combo when engaged. */
  aiAttackTimer: number;
  /** Victory celebration timer (`victory.glb`) after knocking down player. */
  celebrateTime: number;
  comboCounter: number;
  hp: number;
  elapsed: number;
}

export interface BotFightingSnapshot {
  readonly active: boolean;
  readonly targetBotId: string | null;
  readonly targetLabel: string;
  readonly targetIsChild: boolean;
  readonly targetX: number;
  readonly targetZ: number;
  readonly targetHp: number;
  readonly targetMaxHp: number;
  readonly targetKnockedOut: boolean;
  readonly defenderBotIds: readonly string[];
  readonly defenderCount: number;
  readonly botChasing: boolean;
  readonly playerHp: number;
  readonly playerMaxHp: number;
  readonly playerKnockedOut: boolean;
  /** True after player's fall.glb finishes so the Game Over dialog opens cleanly. */
  readonly playerGameOverReady: boolean;
  readonly selectedBox: BoxMoveId;
  readonly selectedKick: KickMoveId;
  readonly activeMove: BotFightMoveId | null;
  readonly moveProgress: number;
  readonly botActiveGlbMotion: BotGlbCombatMotionId | null;
  readonly botActiveGlbSpeed: number;
  readonly botActiveGlbLoop: boolean;
  readonly botActiveGlbSeq: number;
  readonly botActiveMoveLabel: string | null;
  readonly hitCount: number;
  readonly botHitCount: number;
  readonly lastHitText: string | null;
  readonly lastBotHitText: string | null;
  readonly lastPlayerReactionClip: 'hit_to_body_01' | 'hit_to_stomach' | 'fall' | null;
  readonly comboFlashSeq: number;
  readonly playerHitSeq: number;
  readonly attackSeq: number;
}

export function isBotFightMotionId(id: string | null | undefined): id is BotFightMoveId {
  return (
    id === 'box_01' ||
    id === 'box_02' ||
    id === 'front_kick_01' ||
    id === 'front_kick_02'
  );
}

export function isPlayerHitReactionMotionId(id: string | null | undefined): boolean {
  return id === 'hit_to_body_01' || id === 'hit_to_stomach' || id === 'fall';
}

/** True when a bot represents a child (girl or boy). */
export function isChildBotTarget(botName: string, npcRole?: string): boolean {
  if (npcRole === 'boy' || npcRole === 'girl') return true;
  const lower = botName.toLowerCase();
  return lower.includes('kid') || lower.includes('younger-sister');
}

/** Human-friendly Burmese label derived from a bot group's name / userData role. */
export function formatBotTargetLabel(botName: string, npcRole?: string): string {
  const lower = botName.toLowerCase();
  if (lower.startsWith('village-robot-')) return 'စက်ရုပ် Bot';
  if (lower.startsWith('farmhouse-family-')) {
    if (lower.includes('mom')) return 'အမေ (Farmhouse)';
    if (lower.includes('dad')) return 'အဖေ (Farmhouse)';
    if (lower.includes('brother')) return 'အစ်ကိုကြီး';
    if (lower.includes('sister')) return 'ညီမလေး';
    return 'မိသားစု Bot';
  }
  if (lower.startsWith('u-shwe-')) {
    return npcRole === 'auntie' ? 'ဒေါ်လေး (ဦးရွှေအိမ်)' : 'ဦးရွှေ';
  }
  if (npcRole === 'boy') return 'ကလေး ယောကျ်ားလေး';
  if (npcRole === 'girl') return 'ကလေး မိန်းကလေး';
  if (npcRole === 'auntie') return 'ရွာသူ ဒေါ်လေး';
  if (npcRole === 'uncle') return 'ရွာသား ဦးလေး';
  if (lower.includes('kid')) return 'ကလေး Bot';
  if (lower.includes('villager') || lower.includes('resident')) return 'ရွာသား Bot';
  return 'Bot';
}

interface InternalFightState {
  active: boolean;
  targetBotId: string | null;
  targetLabel: string;
  targetIsChild: boolean;
  targetX: number;
  targetZ: number;
  defenderBotIds: string[];
  playerHp: number;
  playerKnockedOut: boolean;
  playerFallTimer: number;
  playerGameOverReady: boolean;
  selectedBox: BoxMoveId;
  selectedKick: KickMoveId;
  activeMove: BotFightMoveId | null;
  moveElapsed: number;
  moveDuration: number;
  moveImpactDelivered: boolean;
  strikeCooldown: number;
  hitCount: number;
  botHitCount: number;
  lastHitText: string | null;
  lastBotHitText: string | null;
  lastPlayerReactionClip: 'hit_to_body_01' | 'hit_to_stomach' | 'fall' | null;
  comboFlashSeq: number;
  playerHitSeq: number;
  attackSeq: number;
}

const state: InternalFightState = {
  active: false,
  targetBotId: null,
  targetLabel: 'Bot',
  targetIsChild: false,
  targetX: 0,
  targetZ: 0,
  defenderBotIds: [],
  playerHp: PLAYER_FIGHT_MAX_HP,
  playerKnockedOut: false,
  playerFallTimer: 0,
  playerGameOverReady: false,
  selectedBox: 'box_01',
  selectedKick: 'front_kick_01',
  activeMove: null,
  moveElapsed: 0,
  moveDuration: 0,
  moveImpactDelivered: false,
  strikeCooldown: 0,
  hitCount: 0,
  botHitCount: 0,
  lastHitText: null,
  lastBotHitText: null,
  lastPlayerReactionClip: null,
  comboFlashSeq: 0,
  playerHitSeq: 0,
  attackSeq: 0,
};

const reactions = new Map<string, BotCombatReaction>();
const listeners = new Set<() => void>();

function setBotMotion(
  r: BotCombatReaction,
  motionId: BotGlbCombatMotionId,
  speed: number,
  loop: boolean,
  forceRestart = false,
): void {
  if (!forceRestart && r.activeGlbMotion === motionId && r.activeGlbLoop === loop) {
    r.activeGlbSpeed = speed;
    return;
  }
  r.activeGlbMotion = motionId;
  r.activeGlbSpeed = speed;
  r.activeGlbLoop = loop;
  r.activeGlbSeq += 1;
}

function getBotMoveDisplayLabel(r: BotCombatReaction | undefined): string | null {
  if (!r || !r.engaged) return null;
  if (r.knockoutTime > 0) return 'KO!';
  if (r.celebrateTime > 0) return '🏆 Victory!';
  if (r.chasing && !r.attackMove) return '🏃 လိုက်တိုက်နေ';
  if (r.attackMove) return `⚡ ${BOT_COUNTER_ATTACK_META[r.attackMove].shortLabel} (2×)`;
  if (r.hitTime > 0) return '💥 Hit!';
  if (r.activeGlbMotion === 'warm_up') return '🔥 Warm Up';
  return null;
}

function buildSnapshot(): BotFightingSnapshot {
  const reaction = state.targetBotId ? reactions.get(state.targetBotId) : undefined;
  const hp = reaction ? reaction.hp : BOT_FIGHT_MAX_HP;
  const ko = Boolean(reaction && reaction.knockoutTime > 0);
  const progress =
    state.activeMove && state.moveDuration > 0
      ? Math.max(0, Math.min(1, state.moveElapsed / state.moveDuration))
      : 0;
  let anyChasing = Boolean(reaction?.chasing);
  if (!anyChasing) {
    for (const defId of state.defenderBotIds) {
      if (reactions.get(defId)?.chasing) {
        anyChasing = true;
        break;
      }
    }
  }

  return {
    active: state.active,
    targetBotId: state.targetBotId,
    targetLabel: state.targetLabel,
    targetIsChild: state.targetIsChild,
    targetX: state.targetX,
    targetZ: state.targetZ,
    targetHp: hp,
    targetMaxHp: BOT_FIGHT_MAX_HP,
    targetKnockedOut: ko,
    defenderBotIds: state.defenderBotIds.slice(),
    defenderCount: state.defenderBotIds.length,
    botChasing: anyChasing,
    playerHp: state.playerHp,
    playerMaxHp: PLAYER_FIGHT_MAX_HP,
    playerKnockedOut: state.playerKnockedOut,
    playerGameOverReady: state.playerGameOverReady,
    selectedBox: state.selectedBox,
    selectedKick: state.selectedKick,
    activeMove: state.activeMove,
    moveProgress: progress,
    botActiveGlbMotion: reaction && state.active ? reaction.activeGlbMotion : null,
    botActiveGlbSpeed: reaction ? reaction.activeGlbSpeed : 1,
    botActiveGlbLoop: reaction ? reaction.activeGlbLoop : false,
    botActiveGlbSeq: reaction ? reaction.activeGlbSeq : 0,
    botActiveMoveLabel: getBotMoveDisplayLabel(reaction),
    hitCount: state.hitCount,
    botHitCount: state.botHitCount,
    lastHitText: state.lastHitText,
    lastBotHitText: state.lastBotHitText,
    lastPlayerReactionClip: state.lastPlayerReactionClip,
    comboFlashSeq: state.comboFlashSeq,
    playerHitSeq: state.playerHitSeq,
    attackSeq: state.attackSeq,
  };
}

let cachedSnapshot: BotFightingSnapshot = buildSnapshot();

function emit(): void {
  cachedSnapshot = buildSnapshot();
  for (const listener of listeners) listener();
}

export function getBotFightingState(): BotFightingSnapshot {
  return cachedSnapshot;
}

export function subscribeBotFighting(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns live combat reaction for a bot rig (zero allocation). */
export function getBotCombatReaction(botId: string | null | undefined): BotCombatReaction | undefined {
  if (!botId) return undefined;
  return reactions.get(botId);
}

/** True when a bot (primary target OR child defender) should pause normal walking to fight/chase the player. */
export function isBotInCombat(botId: string | null | undefined): boolean {
  if (!botId) return false;
  const r = reactions.get(botId);
  if (!r) return false;
  return (
    r.engaged ||
    r.hitTime > 0 ||
    r.knockoutTime > 0 ||
    r.attackMove !== null ||
    r.celebrateTime > 0
  );
}

function getOrCreateReaction(botId: string): BotCombatReaction {
  let r = reactions.get(botId);
  if (!r) {
    r = {
      engaged: false,
      isDefender: false,
      facePlayerYaw: 0,
      hasWorldPos: false,
      worldX: 0,
      worldZ: 0,
      chasing: false,
      chaseSpeed: 0,
      chaseYaw: 0,
      walkDistance: 0,
      hitTime: 0,
      hitDuration: 0.22,
      hitStrength: 1,
      hitKind: 'box',
      knockoutTime: 0,
      activeGlbMotion: 'warm_up',
      activeGlbSpeed: 1.75,
      activeGlbLoop: true,
      activeGlbSeq: 1,
      attackMove: null,
      attackElapsed: 0,
      attackDuration: 0,
      attackImpactDelivered: false,
      queuedMoves: [],
      aiAttackTimer: 0.45,
      celebrateTime: 0,
      comboCounter: 0,
      hp: BOT_FIGHT_MAX_HP,
      elapsed: 0,
    };
    reactions.set(botId, r);
  }
  return r;
}

function queueDoubleCombo(r: BotCombatReaction): void {
  const pair = BOT_DOUBLE_COMBOS[r.comboCounter % BOT_DOUBLE_COMBOS.length];
  r.comboCounter += 1;
  r.queuedMoves.length = 0;
  r.queuedMoves.push(pair[0], pair[1]);
}

function startNextQueuedBotAttack(r: BotCombatReaction): boolean {
  const next = r.queuedMoves.shift();
  if (!next) return false;
  const meta = BOT_COUNTER_ATTACK_META[next];
  r.attackMove = next;
  r.attackElapsed = 0;
  r.attackDuration = meta.durationSec;
  r.attackImpactDelivered = false;
  setBotMotion(r, next, meta.playbackSpeed, false, true);
  return true;
}

function clearDefenderBots(): void {
  for (const id of state.defenderBotIds) {
    const r = reactions.get(id);
    if (r) {
      r.engaged = false;
      r.isDefender = false;
      r.chasing = false;
      r.chaseSpeed = 0;
      r.attackMove = null;
      r.queuedMoves.length = 0;
      r.celebrateTime = 0;
    }
  }
  state.defenderBotIds.length = 0;
}

/**
 * Recruits 4–10 nearby bots to rush in and defend a child bot (`boy`/`girl`) being fought by the player.
 * Returns the number of newly recruited defenders.
 */
export function recruitChildDefenders(
  candidates: readonly ChildDefenderCandidate[],
  playerX: number,
  playerZ: number,
): number {
  if (!state.active || !state.targetIsChild || !state.targetBotId) return 0;

  const existing = new Set<string>([state.targetBotId, ...state.defenderBotIds]);
  const eligible = candidates
    .filter((c) => c.id && !existing.has(c.id))
    .map((c) => ({
      ...c,
      dist: c.dist ?? Math.hypot(c.x - playerX, c.z - playerZ),
    }))
    .sort((a, b) => {
      const aChild = Boolean(a.isChild);
      const bChild = Boolean(b.isChild);
      if (aChild !== bChild) return aChild ? 1 : -1;
      return a.dist - b.dist;
    });

  if (eligible.length === 0) return 0;

  const closeCount = eligible.filter((c) => c.dist <= CHILD_DEFENDER_NEAR_RADIUS).length;
  const desiredTotal = Math.min(
    CHILD_DEFENDER_MAX,
    Math.max(CHILD_DEFENDER_MIN, Math.min(CHILD_DEFENDER_MAX, closeCount + state.defenderBotIds.length)),
  );
  const needed = Math.max(0, desiredTotal - state.defenderBotIds.length);
  if (needed === 0) return 0;

  const chosen = eligible.slice(0, needed);
  let added = 0;
  for (let i = 0; i < chosen.length; i++) {
    const c = chosen[i];
    const r = getOrCreateReaction(c.id);
    r.engaged = true;
    r.isDefender = true;
    r.hasWorldPos = true;
    r.worldX = c.x;
    r.worldZ = c.z;
    r.hp = BOT_FIGHT_MAX_HP;
    r.knockoutTime = 0;
    r.celebrateTime = 0;
    r.comboCounter = (i + 1) % BOT_DOUBLE_COMBOS.length;
    // Stagger defender attacks slightly so the mob fights in natural waves
    r.aiAttackTimer = 0.25 + (i % 4) * 0.28;
    r.facePlayerYaw = Math.atan2(playerX - c.x, playerZ - c.z);
    r.chaseYaw = r.facePlayerYaw;
    r.chasing = Math.hypot(playerX - c.x, playerZ - c.z) > BOT_DEFENDER_DESIRED_DIST + 0.2;
    setBotMotion(r, 'warm_up', 1.8, true, true);
    state.defenderBotIds.push(c.id);
    added += 1;
  }

  if (added > 0) {
    state.lastBotHitText = `🛡️ ကလေးငယ်ကို ကူညီရန် Bot ${state.defenderBotIds.length} ဦး ဝိုင်းတိုက်လာပြီ!`;
    emit();
  }
  return added;
}

/**
 * Engages bump-to-fight mode with the bumped bot.
 * Bot immediately enters agile `warm_up` stance, steps into close melee range (`~0.76m`),
 * and if the target is a child (`boy`/`girl`), summons 4–10 nearby defender bots!
 */
export function engageBotFight(target: {
  id: string;
  label: string;
  x: number;
  z: number;
  npcRole?: string;
  isChild?: boolean;
  playerX?: number;
  playerZ?: number;
  nearbyDefenders?: readonly ChildDefenderCandidate[];
}): boolean {
  if (!target.id) return false;

  const isSameTarget = state.active && state.targetBotId === target.id;
  if (state.targetBotId && state.targetBotId !== target.id) {
    const prev = reactions.get(state.targetBotId);
    if (prev) {
      prev.engaged = false;
      prev.isDefender = false;
      prev.chasing = false;
      prev.chaseSpeed = 0;
      prev.queuedMoves.length = 0;
      prev.attackMove = null;
    }
    clearDefenderBots();
  }

  const targetIsChild = target.isChild ?? isChildBotTarget(target.id, target.npcRole);

  state.active = true;
  state.targetBotId = target.id;
  state.targetLabel = target.label;
  state.targetIsChild = targetIsChild;
  state.targetX = target.x;
  state.targetZ = target.z;

  if (!isSameTarget) {
    state.hitCount = 0;
    state.botHitCount = 0;
    state.playerHp = PLAYER_FIGHT_MAX_HP;
    state.playerKnockedOut = false;
    state.playerFallTimer = 0;
    state.playerGameOverReady = false;
    state.lastHitText = null;
    state.lastBotHitText = null;
    state.lastPlayerReactionClip = null;
  }

  const r = getOrCreateReaction(target.id);
  r.engaged = true;
  r.isDefender = false;
  r.hasWorldPos = true;
  r.worldX = target.x;
  r.worldZ = target.z;
  if (!isSameTarget) {
    r.aiAttackTimer = 0.45;
    r.celebrateTime = 0;
    setBotMotion(r, 'warm_up', 1.8, true, true);
  }
  if (target.playerX !== undefined && target.playerZ !== undefined) {
    r.facePlayerYaw = Math.atan2(target.playerX - target.x, target.playerZ - target.z);
    r.chaseYaw = r.facePlayerYaw;
  }

  if (targetIsChild && target.nearbyDefenders && target.nearbyDefenders.length > 0) {
    recruitChildDefenders(
      target.nearbyDefenders,
      target.playerX ?? target.x,
      target.playerZ ?? target.z,
    );
  } else {
    emit();
  }
  return !isSameTarget;
}

export function selectBoxMove(move: BoxMoveId): void {
  if (state.selectedBox === move) return;
  state.selectedBox = move;
  emit();
}

export function selectKickMove(move: KickMoveId): void {
  if (state.selectedKick === move) return;
  state.selectedKick = move;
  emit();
}

/**
 * Triggers a boxing or kicking attack against the engaged bot.
 * If `overrideMove` is provided (e.g. chosen via long-press menu), updates the selected
 * variant (`box_01`/`box_02` or `front_kick_01`/`front_kick_02`) and executes it immediately.
 * In response to every 1 player strike, the bot queues a rapid 2-hit GLB counter combo!
 */
export function triggerBotFightMove(
  kind: BotFightKind,
  overrideMove?: BotFightMoveId,
): { ok: boolean; moveId: BotFightMoveId } {
  let moveId: BotFightMoveId;
  if (kind === 'box') {
    if (overrideMove === 'box_01' || overrideMove === 'box_02') {
      state.selectedBox = overrideMove;
    }
    moveId = state.selectedBox;
  } else {
    if (overrideMove === 'front_kick_01' || overrideMove === 'front_kick_02') {
      state.selectedKick = overrideMove;
    }
    moveId = state.selectedKick;
  }

  if (!state.active || !state.targetBotId) {
    emit();
    return { ok: false, moveId };
  }

  if (state.playerKnockedOut) {
    return { ok: false, moveId };
  }

  if (state.strikeCooldown > 0 && !overrideMove) {
    return { ok: false, moveId };
  }

  const meta = BOT_FIGHT_MOVE_META[moveId];
  state.activeMove = moveId;
  state.moveElapsed = 0;
  state.moveDuration = meta.durationSec;
  state.moveImpactDelivered = false;
  state.strikeCooldown = meta.cooldownSec;
  state.attackSeq += 1;

  // Wake bot for a fresh round if it was recovering from KO, and queue its rapid 2-hit counter!
  const r = getOrCreateReaction(state.targetBotId);
  if (r.knockoutTime > 0 && r.knockoutTime < BOT_KO_DURATION_SEC - 0.5) {
    r.knockoutTime = 0;
    r.hp = BOT_FIGHT_MAX_HP;
  }
  r.engaged = true;
  r.celebrateTime = 0;
  if (r.knockoutTime === 0 && r.attackMove === null && r.queuedMoves.length === 0) {
    queueDoubleCombo(r);
    // Start bot's fast 2-hit counter swiftly so bot completes 2 strikes during player's 1 strike!
    r.aiAttackTimer = 0.06;
  }

  emit();
  return { ok: true, moveId };
}

/** Explicit Cancel / disengage: stops fighting and calls off all chasing & defender bots. */
export function disengageBotFight(): void {
  if (!state.active && !state.targetBotId && state.defenderBotIds.length === 0) return;
  if (state.targetBotId) {
    const r = reactions.get(state.targetBotId);
    if (r) {
      r.engaged = false;
      r.isDefender = false;
      r.chasing = false;
      r.chaseSpeed = 0;
      r.attackMove = null;
      r.queuedMoves.length = 0;
      r.celebrateTime = 0;
    }
  }
  clearDefenderBots();
  state.active = false;
  state.targetBotId = null;
  state.targetIsChild = false;
  state.activeMove = null;
  state.moveElapsed = 0;
  state.moveDuration = 0;
  state.moveImpactDelivered = false;
  state.strikeCooldown = 0;
  state.playerKnockedOut = false;
  state.playerFallTimer = 0;
  state.playerGameOverReady = false;
  state.lastHitText = null;
  state.lastBotHitText = null;
  state.lastPlayerReactionClip = null;
  emit();
}

export function resetBotFighting(): void {
  reactions.clear();
  state.active = false;
  state.targetBotId = null;
  state.targetLabel = 'Bot';
  state.targetIsChild = false;
  state.targetX = 0;
  state.targetZ = 0;
  state.defenderBotIds.length = 0;
  state.playerHp = PLAYER_FIGHT_MAX_HP;
  state.playerKnockedOut = false;
  state.playerFallTimer = 0;
  state.playerGameOverReady = false;
  state.selectedBox = 'box_01';
  state.selectedKick = 'front_kick_01';
  state.activeMove = null;
  state.moveElapsed = 0;
  state.moveDuration = 0;
  state.moveImpactDelivered = false;
  state.strikeCooldown = 0;
  state.hitCount = 0;
  state.botHitCount = 0;
  state.lastHitText = null;
  state.lastBotHitText = null;
  state.lastPlayerReactionClip = null;
  state.comboFlashSeq = 0;
  state.playerHitSeq = 0;
  state.attackSeq = 0;
  emit();
}

/** Moves a fighting bot smoothly toward its close-quarters melee slot around the player. */
function stepBotChasePosition(
  r: BotCombatReaction,
  slotX: number,
  slotZ: number,
  playerX: number,
  playerZ: number,
  dt: number,
  speedBoost: number,
  canBotMoveTo?: (x: number, z: number) => boolean,
): number {
  const distToPlayer = Math.hypot(r.worldX - playerX, r.worldZ - playerZ);
  r.facePlayerYaw = Math.atan2(playerX - r.worldX, playerZ - r.worldZ);

  if (r.knockoutTime > 0 || r.celebrateTime > 0 || r.hitTime > 0) {
    r.chasing = false;
    r.chaseSpeed = 0;
    return distToPlayer;
  }

  const dx = slotX - r.worldX;
  const dz = slotZ - r.worldZ;
  const distToSlot = Math.hypot(dx, dz);

  // If already in close punch range & mid-swing, stay planted for clean strike impact
  if (r.attackMove && distToPlayer <= BOT_FIGHT_STRIKE_REACH) {
    r.chasing = false;
    r.chaseSpeed = 0;
    return distToPlayer;
  }

  if (distToSlot > 0.1) {
    const baseSpeed = distToPlayer > 1.75 ? BOT_CHASE_SPEED : BOT_CLOSE_STEP_SPEED;
    const speed = baseSpeed * speedBoost;
    const step = Math.min(distToSlot, speed * dt);
    const nx = r.worldX + (dx / distToSlot) * step;
    const nz = r.worldZ + (dz / distToSlot) * step;

    let movedX = r.worldX;
    let movedZ = r.worldZ;
    if (!canBotMoveTo || canBotMoveTo(nx, nz)) {
      movedX = nx;
      movedZ = nz;
    } else if (canBotMoveTo(nx, r.worldZ)) {
      movedX = nx;
    } else if (canBotMoveTo(r.worldX, nz)) {
      movedZ = nz;
    } else {
      // Allow stepping out of house porches/doorways toward open player space so bots don't get stuck indoors
      movedX = r.worldX + (dx / distToSlot) * step * 0.82;
      movedZ = r.worldZ + (dz / distToSlot) * step * 0.82;
    }

    const moved = Math.hypot(movedX - r.worldX, movedZ - r.worldZ);
    r.worldX = movedX;
    r.worldZ = movedZ;
    r.walkDistance += moved;
    r.chaseYaw = Math.atan2(dx, dz);
    r.chaseSpeed = dt > 0 ? moved / dt : speed;
    r.chasing = distToPlayer > BOT_FIGHT_STRIKE_REACH || distToSlot > 0.22;
  } else {
    r.chasing = false;
    r.chaseSpeed = 0;
  }

  return Math.hypot(r.worldX - playerX, r.worldZ - playerZ);
}

function triggerPlayerKnockout(atkLabel: string): void {
  state.playerKnockedOut = true;
  state.playerFallTimer = PLAYER_KO_FALL_SEC;
  state.playerGameOverReady = false;
  state.activeMove = null;
  state.lastPlayerReactionClip = 'fall';
  state.lastBotHitText = `💥 Bot ${atkLabel} · KO!`;

  // Primary bot + all living defenders celebrate winning with victory.glb!
  const allIds = state.targetBotId
    ? [state.targetBotId, ...state.defenderBotIds]
    : state.defenderBotIds;
  for (const id of allIds) {
    const bot = reactions.get(id);
    if (!bot || bot.knockoutTime > 0) continue;
    bot.attackMove = null;
    bot.queuedMoves.length = 0;
    bot.chasing = false;
    bot.chaseSpeed = 0;
    bot.celebrateTime = PLAYER_KO_FALL_SEC + 4;
    setBotMotion(bot, 'victory', 1.25, true, true);
  }
}

/**
 * Advances active player & bot fight timers, close-quarters chase movement (primary + child defenders),
 * hit impact delivery (both directions!), rapid 2-hit GLB bot counter-combos, and victory celebration.
 * Fight persists & bots relentlessly chase a fleeing player until finished or cancelled via `disengageBotFight()`.
 */
export function stepBotFighting(
  rawDt: number,
  playerX: number,
  playerZ: number,
  lookupBotPos?: (botId: string) => { x: number; z: number } | null,
  canBotMoveTo?: (x: number, z: number) => boolean,
): void {
  const dt = Math.max(0, Math.min(rawDt, 0.1));
  if (dt <= 0) return;

  let dirty = false;

  // Step all tracked bot reaction timers & prune fully idle bots
  for (const [id, r] of reactions) {
    r.elapsed += dt;
    if (r.hitTime > 0) {
      r.hitTime = Math.max(0, r.hitTime - dt);
    }
    if (r.knockoutTime > 0) {
      r.knockoutTime = Math.max(0, r.knockoutTime - dt);
      if (r.knockoutTime === 0) {
        r.hp = BOT_FIGHT_MAX_HP;
        if (r.engaged) {
          setBotMotion(r, 'warm_up', 1.85, true, true);
          r.aiAttackTimer = 0.55;
        }
        if (id === state.targetBotId) dirty = true;
      }
    }
    if (r.celebrateTime > 0) {
      r.celebrateTime = Math.max(0, r.celebrateTime - dt);
      if (r.celebrateTime === 0 && r.engaged) {
        setBotMotion(r, 'warm_up', 1.85, true, true);
        r.aiAttackTimer = 0.7;
        if (id === state.targetBotId) dirty = true;
      }
    }

    if (
      !r.engaged &&
      r.hitTime === 0 &&
      r.knockoutTime === 0 &&
      r.attackMove === null &&
      r.celebrateTime === 0
    ) {
      reactions.delete(id);
    }
  }

  if (!state.active || !state.targetBotId) {
    if (dirty) emit();
    return;
  }

  if (state.strikeCooldown > 0) {
    state.strikeCooldown = Math.max(0, state.strikeCooldown - dt);
  }

  if (state.playerKnockedOut) {
    if (!state.playerGameOverReady) {
      state.playerFallTimer = Math.max(0, state.playerFallTimer - dt);
      if (state.playerFallTimer === 0) {
        state.playerGameOverReady = true;
        dirty = true;
      }
    }
    if (dirty) emit();
    return;
  }

  const r = getOrCreateReaction(state.targetBotId);
  if (!r.hasWorldPos && lookupBotPos) {
    const livePos = lookupBotPos(state.targetBotId);
    if (livePos) {
      r.worldX = livePos.x;
      r.worldZ = livePos.z;
      r.hasWorldPos = true;
    }
  }

  // 1. Primary Bot Close-In & Persistent Chase Movement
  const prevChasing = r.chasing;
  const toBotX = r.worldX - playerX;
  const toBotZ = r.worldZ - playerZ;
  const curDist = Math.hypot(toBotX, toBotZ);
  const dirX = curDist > 0.001 ? toBotX / curDist : 0;
  const dirZ = curDist > 0.001 ? toBotZ / curDist : 1;
  const desiredDist = state.targetIsChild ? 0.72 : BOT_MELEE_DESIRED_DIST;
  const primarySlotX = playerX + dirX * desiredDist;
  const primarySlotZ = playerZ + dirZ * desiredDist;

  const dist = stepBotChasePosition(
    r,
    primarySlotX,
    primarySlotZ,
    playerX,
    playerZ,
    dt,
    1.0,
    canBotMoveTo,
  );
  state.targetX = r.worldX;
  state.targetZ = r.worldZ;
  if (r.chasing !== prevChasing) dirty = true;

  // 2. Child-Defense Squad Chase & Surround Movement (4–10 defenders encircle the player!)
  const baseAngle = Math.atan2(dirZ, dirX);
  const activeDefenders = state.defenderBotIds;
  const defenderDists: number[] = [];
  for (let i = 0; i < activeDefenders.length; i++) {
    const defId = activeDefenders[i];
    const dr = getOrCreateReaction(defId);
    if (!dr.hasWorldPos && lookupBotPos) {
      const lp = lookupBotPos(defId);
      if (lp) {
        dr.worldX = lp.x;
        dr.worldZ = lp.z;
        dr.hasWorldPos = true;
      }
    }
    const ringAngle = baseAngle + ((i + 1) * Math.PI * 2) / (activeDefenders.length + 1);
    const ringRadius = BOT_DEFENDER_DESIRED_DIST + (i >= 6 ? 0.42 : 0);
    const slotX = playerX + Math.cos(ringAngle) * ringRadius;
    const slotZ = playerZ + Math.sin(ringAngle) * ringRadius;
    const speedVar = 0.96 + (i % 4) * 0.06;
    const dDist = stepBotChasePosition(
      dr,
      slotX,
      slotZ,
      playerX,
      playerZ,
      dt,
      speedVar,
      canBotMoveTo,
    );
    defenderDists.push(dDist);
  }

  // Soft pairwise separation so multiple bots never stack onto the exact same point
  if (activeDefenders.length > 0) {
    const allBots: BotCombatReaction[] = [r];
    for (const defId of activeDefenders) {
      const dr = reactions.get(defId);
      if (dr && dr.knockoutTime === 0) allBots.push(dr);
    }
    const minSep = 0.6;
    for (let i = 0; i < allBots.length; i++) {
      for (let j = i + 1; j < allBots.length; j++) {
        const a = allBots[i];
        const b = allBots[j];
        const sx = b.worldX - a.worldX;
        const sz = b.worldZ - a.worldZ;
        const sd = Math.hypot(sx, sz);
        if (sd > 0.001 && sd < minSep) {
          const push = (minSep - sd) * 0.45;
          const nx = sx / sd;
          const nz = sz / sd;
          if (i > 0) {
            a.worldX -= nx * push;
            a.worldZ -= nz * push;
          }
          b.worldX += nx * push;
          b.worldZ += nz * push;
        }
      }
    }
    state.targetX = r.worldX;
    state.targetZ = r.worldZ;
  }

  // 3. Advance Player's active strike & deliver hit to closest in-reach engaged bot
  if (state.activeMove) {
    state.moveElapsed += dt;
    const meta = BOT_FIGHT_MOVE_META[state.activeMove];

    if (!state.moveImpactDelivered && state.moveElapsed >= meta.impactSec) {
      state.moveImpactDelivered = true;

      // Pick primary target if in reach & standing, otherwise hit closest living defender in reach
      let hitTarget: BotCombatReaction | null = null;
      let hitIsPrimary = false;
      if (dist <= BOT_FIGHT_STRIKE_REACH && r.knockoutTime === 0) {
        hitTarget = r;
        hitIsPrimary = true;
      } else {
        let bestD = BOT_FIGHT_STRIKE_REACH;
        for (let i = 0; i < activeDefenders.length; i++) {
          const dr = reactions.get(activeDefenders[i]);
          if (!dr || dr.knockoutTime > 0) continue;
          const dd = Math.hypot(dr.worldX - playerX, dr.worldZ - playerZ);
          if (dd <= bestD) {
            bestD = dd;
            hitTarget = dr;
          }
        }
        if (!hitTarget && dist <= BOT_FIGHT_STRIKE_REACH) {
          hitTarget = r;
          hitIsPrimary = true;
        }
      }

      if (hitTarget) {
        hitTarget.hp = Math.max(0, hitTarget.hp - meta.damage);
        hitTarget.hitDuration = meta.kind === 'kick' ? 0.22 : 0.18;
        hitTarget.hitTime = hitTarget.hitDuration;
        hitTarget.hitStrength = meta.hitStrength;
        hitTarget.hitKind = meta.kind;
        hitTarget.celebrateTime = 0;
        hitTarget.chasing = false;
        state.hitCount += 1;
        state.comboFlashSeq += 1;

        if (hitTarget.hp === 0) {
          hitTarget.knockoutTime = BOT_KO_DURATION_SEC;
          hitTarget.attackMove = null;
          hitTarget.queuedMoves.length = 0;
          setBotMotion(hitTarget, 'fall', 1.25, false, true);
          state.lastHitText = hitIsPrimary
            ? `💥 ${meta.shortLabel} · KO!`
            : `💥 ${meta.shortLabel} · ကူတိုက် Bot KO!`;
        } else {
          if (hitTarget.attackMove === null) {
            setBotMotion(
              hitTarget,
              meta.kind === 'kick' ? 'hit_to_stomach' : 'hit_to_body_01',
              2.2,
              false,
              true,
            );
          }
          if (hitTarget.queuedMoves.length === 0 && hitTarget.attackMove === null) {
            queueDoubleCombo(hitTarget);
            hitTarget.aiAttackTimer = 0.05;
          }
          const emoji = meta.kind === 'box' ? '🥊' : '🦵';
          state.lastHitText = `${emoji} ${meta.shortLabel} · -${meta.damage}`;
        }
        dirty = true;
      }
    }

    if (state.moveElapsed >= state.moveDuration) {
      state.activeMove = null;
      state.moveElapsed = 0;
      state.moveDuration = 0;
      dirty = true;
    }
  }

  // 4. Advance Primary Bot's 2×-Speed Counter-Attack AI (real GLB box_01/02/03 & front_kick_01/02 combos!)
  if (r.knockoutTime === 0 && r.celebrateTime === 0 && !state.playerKnockedOut) {
    if (r.attackMove) {
      const atk = BOT_COUNTER_ATTACK_META[r.attackMove];
      r.attackElapsed += dt;

      if (!r.attackImpactDelivered && r.attackElapsed >= atk.impactSec) {
        r.attackImpactDelivered = true;
        if (dist <= BOT_FIGHT_STRIKE_REACH) {
          state.playerHp = Math.max(0, state.playerHp - atk.damage);
          state.botHitCount += 1;
          state.playerHitSeq += 1;

          if (state.playerHp === 0) {
            triggerPlayerKnockout(atk.shortLabel);
          } else {
            state.lastPlayerReactionClip = atk.playerReactionClip;
            const emoji = atk.kind === 'box' ? '🥊' : '🦵';
            state.lastBotHitText = `⚡ Bot ${emoji} ${atk.shortLabel} · -${atk.damage}`;
          }
          dirty = true;
        }
      }

      if (r.attackMove && r.attackElapsed >= r.attackDuration) {
        r.attackMove = null;
        r.attackElapsed = 0;
        r.attackDuration = 0;
        if (r.queuedMoves.length > 0 && !state.playerKnockedOut && dist <= BOT_FIGHT_STRIKE_REACH + 0.25) {
          startNextQueuedBotAttack(r);
          dirty = true;
        } else {
          setBotMotion(r, 'warm_up', 1.85, true, false);
          r.aiAttackTimer = 0.9;
          dirty = true;
        }
      }
    } else if (r.hitTime === 0) {
      r.aiAttackTimer -= dt;
      if (r.aiAttackTimer <= 0 && dist <= BOT_FIGHT_STRIKE_REACH) {
        if (r.queuedMoves.length === 0) {
          queueDoubleCombo(r);
        }
        if (startNextQueuedBotAttack(r)) {
          dirty = true;
        }
      } else if (r.activeGlbMotion !== 'warm_up') {
        setBotMotion(r, 'warm_up', 1.85, true, false);
        dirty = true;
      }
    }
  }

  // 5. Advance Child-Defense Squad Attacks (4–10 defenders attack in staggered waves once in melee reach!)
  if (!state.playerKnockedOut && activeDefenders.length > 0) {
    for (let i = 0; i < activeDefenders.length; i++) {
      if (state.playerKnockedOut) break;
      const dr = reactions.get(activeDefenders[i]);
      if (!dr || dr.knockoutTime > 0 || dr.celebrateTime > 0) continue;
      const dDist = defenderDists[i] ?? Math.hypot(dr.worldX - playerX, dr.worldZ - playerZ);

      if (dr.attackMove) {
        const atk = BOT_COUNTER_ATTACK_META[dr.attackMove];
        dr.attackElapsed += dt;
        if (!dr.attackImpactDelivered && dr.attackElapsed >= atk.impactSec) {
          dr.attackImpactDelivered = true;
          if (dDist <= BOT_FIGHT_STRIKE_REACH + 0.12) {
            const defDmg = Math.max(4, Math.round(atk.damage * 0.55));
            state.playerHp = Math.max(0, state.playerHp - defDmg);
            state.botHitCount += 1;
            state.playerHitSeq += 1;
            if (state.playerHp === 0) {
              triggerPlayerKnockout(`ကူတိုက် ${atk.shortLabel}`);
            } else {
              state.lastPlayerReactionClip = atk.playerReactionClip;
              const emoji = atk.kind === 'box' ? '🥊' : '🦵';
              state.lastBotHitText = `🛡️ ကူတိုက် Bot ${emoji} ${atk.shortLabel} · -${defDmg}`;
            }
            dirty = true;
          }
        }
        if (dr.attackMove && dr.attackElapsed >= dr.attackDuration) {
          dr.attackMove = null;
          dr.attackElapsed = 0;
          dr.attackDuration = 0;
          dr.aiAttackTimer = 0.85 + (i % 4) * 0.35;
        }
      } else if (dr.hitTime === 0) {
        dr.aiAttackTimer -= dt;
        if (dr.aiAttackTimer <= 0 && dDist <= BOT_FIGHT_STRIKE_REACH + 0.08) {
          if (dr.queuedMoves.length === 0) {
            queueDoubleCombo(dr);
          }
          startNextQueuedBotAttack(dr);
        }
      }
    }
  }

  if (dirty) emit();
}
