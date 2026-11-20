import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AnimationMixer } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  BOT_CHASE_SPEED,
  BOT_COMBO_STRIKES_PER_EXCHANGE,
  BOT_COUNTER_ATTACK_META,
  BOT_DOUBLE_COMBOS,
  BOT_FIGHT_LONG_PRESS_MS,
  BOT_FIGHT_MAX_HP,
  BOT_FIGHT_MOVE_META,
  BOT_FIGHT_STRIKE_REACH,
  BOT_MELEE_DESIRED_DIST,
  CHILD_DEFENDER_MAX,
  CHILD_DEFENDER_MIN,
  PLAYER_FIGHT_MAX_HP,
  PLAYER_KO_FALL_SEC,
  disengageBotFight,
  engageBotFight,
  formatBotTargetLabel,
  getBotCombatReaction,
  getBotFightingState,
  isBotFightMotionId,
  isBotInCombat,
  isChildBotTarget,
  isFarmhouseFamilyBot,
  isProtectedFromFighting,
  resetBotFighting,
  selectBoxMove,
  selectKickMove,
  stepBotFighting,
  triggerBotFightMove,
} from '../src/game/botFighting.ts';
import { farmhouse, ward } from '../src/data/ward.ts';
import { isInsideFarmhouseCompound } from '../src/game/homeAccess.ts';
import {
  completePlayerRespawn,
  getPlayerDeathState,
  killPlayerFromBotFight,
  requestPlayerRespawn,
} from '../src/game/playerDeath.ts';
import {
  BOT_GLB_TRAINING_MOTIONS,
  buildJointSetForTesting,
  extractPoseFromJoints,
  type SampledBotGlbPose,
} from '../src/game/botGlbMotionPlayer.ts';

test('Bot bump engages fighting immediately with default box_01 and front_kick_01 moves', () => {
  resetBotFighting();
  assert.equal(getBotFightingState().active, false);
  assert.equal(getBotFightingState().selectedBox, 'box_01');
  assert.equal(getBotFightingState().selectedKick, 'front_kick_01');

  const firstEngage = engageBotFight({
    id: 'street-villager-3',
    label: formatBotTargetLabel('street-villager-3', 'uncle'),
    x: 10,
    z: 20,
    playerX: 10,
    playerZ: 21.1,
  });
  assert.equal(firstEngage, true);

  const st = getBotFightingState();
  assert.equal(st.active, true);
  assert.equal(st.targetBotId, 'street-villager-3');
  assert.equal(st.targetLabel, 'ရွာသား ဦးလေး');
  assert.equal(st.selectedBox, 'box_01');
  assert.equal(st.selectedKick, 'front_kick_01');
  assert.equal(isBotInCombat('street-villager-3'), true);
});

test('Default box_01 and front_kick_01 strike deals damage and triggers 3D bot hit reaction', () => {
  resetBotFighting();
  engageBotFight({
    id: 'pooled-resident-0-0',
    label: 'ရွာသား ဦးလေး',
    x: 0,
    z: 0,
    playerX: 0,
    playerZ: 1.2,
  });

  // Tap default Box (box_01)
  const boxRes = triggerBotFightMove('box');
  assert.equal(boxRes.ok, true);
  assert.equal(boxRes.moveId, 'box_01');

  // Step past box_01 impactSec (0.30s)
  for (let i = 0; i < 8; i++) {
    stepBotFighting(0.05, 0, 1.2, () => ({ x: 0, z: 0 }));
  }

  const afterBox = getBotFightingState();
  assert.equal(afterBox.targetHp, BOT_FIGHT_MAX_HP - BOT_FIGHT_MOVE_META.box_01.damage);
  assert.equal(afterBox.hitCount, 1);
  assert.ok(afterBox.lastHitText?.includes('Box 01'));
  const reaction = getBotCombatReaction('pooled-resident-0-0');
  assert.ok(reaction && reaction.hitTime > 0, 'Bot should recoil in hit stagger after punch connects');

  // Step past cooldown and tap default Kick (front_kick_01)
  for (let i = 0; i < 6; i++) {
    stepBotFighting(0.05, 0, 1.2, () => ({ x: 0, z: 0 }));
  }
  const kickRes = triggerBotFightMove('kick');
  assert.equal(kickRes.ok, true);
  assert.equal(kickRes.moveId, 'front_kick_01');

  for (let i = 0; i < 8; i++) {
    stepBotFighting(0.05, 0, 1.2, () => ({ x: 0, z: 0 }));
  }
  assert.equal(
    getBotFightingState().targetHp,
    BOT_FIGHT_MAX_HP - BOT_FIGHT_MOVE_META.box_01.damage - BOT_FIGHT_MOVE_META.front_kick_01.damage,
  );
});

test('Long-press selection switches to box_02 and front_kick_02 and persists for subsequent taps', () => {
  resetBotFighting();
  engageBotFight({
    id: 'village-robot-2',
    label: formatBotTargetLabel('village-robot-2'),
    x: 5,
    z: 5,
    playerX: 5,
    playerZ: 6.2,
  });

  assert.equal(BOT_FIGHT_LONG_PRESS_MS, 420);

  // Select Box 02 via long-press override
  const b2 = triggerBotFightMove('box', 'box_02');
  assert.equal(b2.ok, true);
  assert.equal(b2.moveId, 'box_02');
  assert.equal(getBotFightingState().selectedBox, 'box_02');

  for (let i = 0; i < 12; i++) {
    stepBotFighting(0.05, 5, 6.2, () => ({ x: 5, z: 5 }));
  }
  assert.equal(getBotFightingState().targetHp, BOT_FIGHT_MAX_HP - BOT_FIGHT_MOVE_META.box_02.damage);

  // Subsequent plain Box tap keeps using box_02
  const b2Again = triggerBotFightMove('box');
  assert.equal(b2Again.ok, true);
  assert.equal(b2Again.moveId, 'box_02');

  // Select Kick 02 via long-press override
  const k2 = triggerBotFightMove('kick', 'front_kick_02');
  assert.equal(k2.ok, true);
  assert.equal(k2.moveId, 'front_kick_02');
  assert.equal(getBotFightingState().selectedKick, 'front_kick_02');

  for (let i = 0; i < 12; i++) {
    stepBotFighting(0.05, 5, 6.2, () => ({ x: 5, z: 5 }));
  }
  assert.ok(getBotFightingState().lastHitText?.includes('Kick 02'));

  // Explicit setters switch cleanly back to 01
  selectBoxMove('box_01');
  selectKickMove('front_kick_01');
  assert.equal(getBotFightingState().selectedBox, 'box_01');
  assert.equal(getBotFightingState().selectedKick, 'front_kick_01');
});

test('Bot closes into tight melee range, persistently chases a fleeing player until Cancel, and never auto-disengages', () => {
  resetBotFighting();
  engageBotFight({ id: 'street-villager-12', label: 'ရွာသား ဦးလေး', x: 0, z: 0, playerX: 0, playerZ: 2.4 });
  assert.equal(getBotFightingState().active, true);
  assert.ok(BOT_MELEE_DESIRED_DIST <= 0.85, 'Desired melee distance must be tight chest-to-chest');
  assert.ok(BOT_FIGHT_STRIKE_REACH <= 1.6, 'Strike reach should match close-quarters melee');
  assert.ok(BOT_CHASE_SPEED >= 5.0, 'Chase speed should be brisk enough to pursue fleeing players');

  // Step 0.6s with player at (0, 2.4): bot must step close right into melee range (~0.76m)
  for (let i = 0; i < 12; i++) {
    stepBotFighting(0.05, 0, 2.4);
  }
  const rClose = getBotCombatReaction('street-villager-12')!;
  const closeDist = Math.hypot(rClose.worldX - 0, rClose.worldZ - 2.4);
  assert.ok(closeDist <= 0.95, `Bot should close into tight melee range, got ${closeDist.toFixed(2)}m`);

  // Player runs far away to (0, 18): fight MUST remain active and bot must actively sprint after player!
  for (let i = 0; i < 20; i++) {
    stepBotFighting(0.05, 0, 18);
  }
  assert.equal(getBotFightingState().active, true, 'Fight must stay active when player runs away without Cancel');
  const rChase = getBotCombatReaction('street-villager-12')!;
  assert.equal(rChase.chasing, true, 'Bot should be actively chasing fleeing player');
  assert.ok(rChase.worldZ > 5.0, `Bot should have chased far toward z=18, got z=${rChase.worldZ.toFixed(2)}`);

  // Continue chasing until bot catches up and resumes attacking
  for (let i = 0; i < 80; i++) {
    stepBotFighting(0.05, 0, 18);
    if (getBotFightingState().botHitCount > 0) break;
  }
  assert.ok(getBotFightingState().botHitCount > 0, 'Chasing bot should catch fleeing player and land strikes');

  // Explicit Cancel disengages cleanly
  disengageBotFight();
  assert.equal(getBotFightingState().active, false);
  assert.equal(isBotInCombat('street-villager-12'), false);

  assert.equal(isBotFightMotionId('box_01'), true);
  assert.equal(isBotFightMotionId('box_02'), true);
  assert.equal(isBotFightMotionId('front_kick_01'), true);
  assert.equal(isBotFightMotionId('front_kick_02'), true);
  assert.equal(isBotFightMotionId('dance_01'), false);
});

test('Fighting a child bot (girl/boy) summons 4–10 nearby defenders who rush in and attack the player', () => {
  resetBotFighting();
  assert.equal(isChildBotTarget('street-kid-2', 'girl'), true);
  assert.equal(isChildBotTarget('pooled-kid-0-0', 'boy'), true);
  assert.equal(isChildBotTarget('farmhouse-family-younger-sister'), true);
  assert.equal(isChildBotTarget('street-villager-1', 'uncle'), false);

  const nearbyCandidates = Array.from({ length: 8 }, (_, idx) => ({
    id: `street-villager-${100 + idx}`,
    x: 4 + idx * 1.4,
    z: 2 + (idx % 3) * 1.2,
    npcRole: idx % 2 === 0 ? 'uncle' : 'auntie',
    isChild: false,
  }));

  engageBotFight({
    id: 'street-kid-5',
    label: formatBotTargetLabel('street-kid-5', 'girl'),
    x: 0,
    z: 0,
    npcRole: 'girl',
    playerX: 0,
    playerZ: 0.85,
    nearbyDefenders: nearbyCandidates,
  });

  const st = getBotFightingState();
  assert.equal(st.targetIsChild, true);
  assert.ok(
    st.defenderCount >= CHILD_DEFENDER_MIN && st.defenderCount <= CHILD_DEFENDER_MAX,
    `Expected ${CHILD_DEFENDER_MIN}–${CHILD_DEFENDER_MAX} defenders, got ${st.defenderCount}`,
  );
  for (const defId of st.defenderBotIds) {
    assert.equal(isBotInCombat(defId), true, `Defender ${defId} must be in combat`);
    assert.equal(getBotCombatReaction(defId)?.isDefender, true);
  }

  // Advance so defenders rush into close melee ring and attack the player
  const initialDists = st.defenderBotIds.map((id) => {
    const r = getBotCombatReaction(id)!;
    return Math.hypot(r.worldX - 0, r.worldZ - 0.85);
  });
  for (let i = 0; i < 45; i++) {
    stepBotFighting(0.05, 0, 0.85);
    if (getBotFightingState().playerKnockedOut) break;
  }
  const afterDists = st.defenderBotIds.map((id) => {
    const r = getBotCombatReaction(id)!;
    return Math.hypot(r.worldX - 0, r.worldZ - 0.85);
  });
  assert.ok(afterDists[0] < initialDists[0], 'Defenders must rush closer toward the player');
  assert.ok(getBotFightingState().playerHp < PLAYER_FIGHT_MAX_HP, 'Defenders + child must damage player');

  // Cancel calls off all defenders cleanly
  disengageBotFight();
  assert.equal(getBotFightingState().defenderCount, 0);
  for (const defId of st.defenderBotIds) {
    assert.equal(isBotInCombat(defId), false, `Cancel must release defender ${defId}`);
  }
});

test('Farmhouse family bots and any bot inside the Farmhouse compound never fight or trespass', () => {
  resetBotFighting();
  assert.equal(isFarmhouseFamilyBot('farmhouse-family-mom'), true);
  assert.equal(isFarmhouseFamilyBot('farmhouse-family-dad'), true);
  assert.equal(isFarmhouseFamilyBot('farmhouse-family-older-brother'), true);
  assert.equal(isFarmhouseFamilyBot('farmhouse-family-younger-sister'), true);
  assert.equal(isFarmhouseFamilyBot('street-villager-1'), false);

  // 1. Bumping a Farmhouse family member anywhere must NOT start fighting
  assert.equal(
    engageBotFight({
      id: 'farmhouse-family-dad',
      label: 'အဖေ (Farmhouse)',
      x: farmhouse.x,
      z: farmhouse.z,
      npcRole: 'uncle',
      playerX: farmhouse.x + 1,
      playerZ: farmhouse.z,
    }),
    false,
  );
  assert.equal(getBotFightingState().active, false, 'Family bump must not engage fighting');

  // 2. Bumping even an outside visiting bot inside the Farmhouse front lot / yard must NOT engage fighting
  const frontLotX = ward.frontLot.x;
  const frontLotZ = ward.frontLot.z;
  assert.equal(isInsideFarmhouseCompound(frontLotX, frontLotZ), true);
  assert.equal(isProtectedFromFighting('street-villager-5', frontLotX, frontLotZ), true);
  assert.equal(
    engageBotFight({
      id: 'street-villager-5',
      label: 'ရွာသား ဦးလေး',
      x: frontLotX,
      z: frontLotZ,
      playerX: frontLotX + 0.8,
      playerZ: frontLotZ,
    }),
    false,
  );
  assert.equal(getBotFightingState().active, false, 'Visiting bot inside Farmhouse compound must not fight');

  // 3. Fighting a bot outside on the road, then retreating into Farmhouse: bot cannot trespass or attack!
  const outsideX = ward.frontLot.x + 40;
  const outsideZ = ward.frontLot.z + 40;
  assert.equal(isInsideFarmhouseCompound(outsideX, outsideZ), false);
  assert.equal(
    engageBotFight({
      id: 'street-villager-99',
      label: 'ရွာသား ဦးလေး',
      x: outsideX,
      z: outsideZ,
      playerX: outsideX,
      playerZ: outsideZ + 0.9,
    }),
    true,
  );

  // Player enters Farmhouse compound -> bot must stop attacking & never cross into compound
  const hpBefore = getBotFightingState().playerHp;
  for (let i = 0; i < 60; i++) {
    stepBotFighting(0.05, farmhouse.x, farmhouse.z);
  }
  const r = getBotCombatReaction('street-villager-99')!;
  assert.equal(
    isInsideFarmhouseCompound(r.worldX, r.worldZ),
    false,
    'Chasing bot must never trespass inside the Farmhouse compound',
  );
  assert.equal(
    getBotFightingState().playerHp,
    hpBefore,
    'Bot must not deal damage while player is safely inside the Farmhouse compound',
  );
  disengageBotFight();
});

test('UI & Player wire bump-to-fight icons, long-press 01/02 picker, and motion playback', () => {
  const mainTsx = readFileSync('src/main.tsx', 'utf-8');
  const controlsTsx = readFileSync('src/components/BotFightControls.tsx', 'utf-8');
  const playerTsx = readFileSync('src/components/Player.tsx', 'utf-8');
  const registryTs = readFileSync('src/animation/core/MotionRegistry.ts', 'utf-8');

  assert.ok(mainTsx.includes('<BotFightControls'), 'main.tsx must mount BotFightControls');
  assert.ok(controlsTsx.includes('BOT_FIGHT_LONG_PRESS_MS'), 'BotFightControls must support long press');
  assert.ok(controlsTsx.includes('BOX_MOVES') && controlsTsx.includes('KICK_MOVES'));
  assert.ok(controlsTsx.includes('playSpecialAction'), 'BotFightControls must trigger GLB special actions');
  assert.ok(playerTsx.includes('engageBotFight') && playerTsx.includes('stepBotFighting'));
  assert.ok(registryTs.includes("id: 'box_01'") && registryTs.includes("id: 'box_02'"));
  assert.ok(registryTs.includes("id: 'front_kick_01'") && registryTs.includes("id: 'front_kick_02'"));
});

test('Bot fights back at 2x speed: completes 2 GLB box/kick counter-strikes in the time of 1 player strike', () => {
  resetBotFighting();
  engageBotFight({
    id: 'street-villager-7',
    label: 'ရွာသား ဦးလေး',
    x: 0,
    z: 0,
    playerX: 0,
    playerZ: 1.15,
  });

  // Bot starts engaged in agile warm_up GLB stance
  assert.equal(getBotFightingState().botActiveGlbMotion, 'warm_up');
  assert.equal(BOT_COMBO_STRIKES_PER_EXCHANGE, 2);

  // Verify every bot attack clip plays >= 2.0x speed and takes <= 0.56s (~half of player's ~1.1s move)
  for (const meta of Object.values(BOT_COUNTER_ATTACK_META)) {
    assert.ok(meta.playbackSpeed >= 2.0, `${meta.id} playbackSpeed should be >= 2.0x`);
    assert.ok(meta.durationSec <= 0.56, `${meta.id} durationSec should be <= 0.56s`);
  }

  // Player throws 1 Box 01 (~1.05s)
  const res = triggerBotFightMove('box');
  assert.equal(res.ok, true);

  // Advance 1.35s (roughly 1 player strike + instant counter window): bot should land 2 full hits!
  const seenBotAttacks = new Set<string>();
  for (let i = 0; i < 27; i++) {
    stepBotFighting(0.05, 0, 1.15, () => ({ x: 0, z: 0 }));
    const r = getBotCombatReaction('street-villager-7');
    if (r?.attackMove) seenBotAttacks.add(r.attackMove);
  }

  const after = getBotFightingState();
  assert.equal(after.hitCount, 1, 'Player should have landed 1 strike');
  assert.ok(after.botHitCount >= 2, `Bot should have landed at least 2 strikes per 1 player strike, got ${after.botHitCount}`);
  assert.ok(after.playerHp < PLAYER_FIGHT_MAX_HP, 'Bot counter-strikes must reduce player HP');
  assert.ok(seenBotAttacks.size >= 2, `Bot should chain 2 distinct GLB combo attacks, got ${Array.from(seenBotAttacks).join(',')}`);
  assert.ok(after.lastBotHitText?.includes('Bot'), 'HUD should display bot hit feedback');
});

test('Player HP 100 -> 0 KO plays fall.glb, triggers Game Over dialog, and restarts cleanly from the beginning', () => {
  const usedAttacks = new Set(BOT_DOUBLE_COMBOS.flat());
  assert.deepEqual(
    Array.from(usedAttacks).sort(),
    ['box_01', 'box_02', 'box_03', 'front_kick_01', 'front_kick_02'],
    'Bot double combos must cover all 5 boxing & kicking GLBs',
  );

  resetBotFighting();
  engageBotFight({
    id: 'street-villager-9',
    label: 'ရွာသား ဦးလေး',
    x: 0,
    z: 0,
    playerX: 0,
    playerZ: 1.0,
  });

  // Let bot continuously fight until player reaches 0 HP
  for (let i = 0; i < 360; i++) {
    stepBotFighting(0.05, 0, 1.0, () => ({ x: 0, z: 0 }));
    if (getBotFightingState().playerKnockedOut) break;
  }

  const koState = getBotFightingState();
  assert.equal(koState.playerKnockedOut, true, 'Aggressive bot combos should eventually KO an idle player');
  assert.equal(koState.playerHp, 0);
  assert.equal(koState.playerGameOverReady, false, 'Should allow fall.glb animation to play before Game Over dialog');
  assert.equal(koState.botActiveGlbMotion, 'victory', 'Bot should celebrate with victory.glb');
  assert.equal(koState.lastPlayerReactionClip, 'fall', 'Player KO must play fall.glb');

  // Step through PLAYER_KO_FALL_SEC so fall.glb completes and Game Over dialog opens
  const fallSteps = Math.ceil(PLAYER_KO_FALL_SEC / 0.05) + 2;
  for (let i = 0; i < fallSteps; i++) {
    stepBotFighting(0.05, 0, 1.0, () => ({ x: 0, z: 0 }));
  }
  const readyState = getBotFightingState();
  assert.equal(readyState.playerGameOverReady, true, 'Game Over dialog must become ready after fall.glb');

  // Verify playerDeath Game Over -> Restart transition
  const killed = killPlayerFromBotFight('street-villager-9', readyState.playerHitSeq);
  assert.equal(killed, true);
  assert.equal(getPlayerDeathState().phase, 'dead');
  assert.equal(getPlayerDeathState().ghostId, 'bot-fight:street-villager-9');

  requestPlayerRespawn();
  assert.equal(getPlayerDeathState().phase, 'respawning');
  completePlayerRespawn();
  resetBotFighting();
  assert.equal(getPlayerDeathState().phase, 'alive');
  assert.equal(getBotFightingState().playerHp, PLAYER_FIGHT_MAX_HP);

  // Verify defeating a bot (bot HP -> 0) also plays fall.glb on the losing bot
  resetBotFighting();
  engageBotFight({
    id: 'street-villager-ko',
    label: 'ရွာသား ဦးလေး',
    x: 0,
    z: 0,
    playerX: 0,
    playerZ: 0.85,
  });
  for (let strike = 0; strike < 6; strike++) {
    triggerBotFightMove('kick', 'front_kick_02');
    for (let i = 0; i < 12; i++) {
      stepBotFighting(0.05, 0, 0.85);
    }
    if (getBotFightingState().targetKnockedOut) break;
  }
  assert.equal(getBotFightingState().targetKnockedOut, true, 'Repeated kicks should KO bot');
  assert.equal(
    getBotFightingState().botActiveGlbMotion,
    'fall',
    'Defeated bot must play fall.glb when losing',
  );

  // Verify GhostGameOver renders bot-fight KO message and main.tsx hides GhostRadar in daytime
  const gameOverTsx = readFileSync('src/components/GhostGameOver.tsx', 'utf-8');
  const mainTsx = readFileSync('src/main.tsx', 'utf-8');
  assert.ok(gameOverTsx.includes("startsWith('bot-fight:')"), 'GhostGameOver must support bot-fight KO dialog');
  assert.ok(mainTsx.includes('{night && <GhostRadar />}'), 'main.tsx must hide GhostRadar during daytime');
});

test('BotGlbMotionPlayer extracts real animated bone poses from all 7 training GLB files', async () => {
  const loader = new GLTFLoader();
  const makeOut = (): SampledBotGlbPose => ({
    valid: false,
    motionId: null,
    pelvisY: 0.84,
    pelvisZ: 0,
    pelvisRoll: 0,
    torsoPitch: 0,
    torsoYaw: 0,
    torsoRoll: 0,
    headPitch: 0,
    headYaw: 0,
    leftArmX: 0,
    leftArmY: 0,
    leftArmZ: 0,
    rightArmX: 0,
    rightArmY: 0,
    rightArmZ: 0,
    leftForearmX: 0,
    rightForearmX: 0,
    leftThighX: 0,
    leftThighZ: 0,
    rightThighX: 0,
    rightThighZ: 0,
    leftShinX: 0,
    rightShinX: 0,
    leftFootY: 0,
    leftFootZ: 0,
    rightFootY: 0,
    rightFootZ: 0,
    proneFactor: 0,
  });

  const fileMap: Record<string, string> = {
    box_01: 'public/motions/training/box_01.glb',
    box_02: 'public/motions/training/box_02.glb',
    box_03: 'public/motions/training/box_03.glb',
    front_kick_01: 'public/motions/training/front_kick_01.glb',
    front_kick_02: 'public/motions/training/front_kick_02.glb',
    warm_up: 'public/motions/training/warm_up.glb',
    press_up: 'public/motions/training/press_up.glb',
    victory: 'public/motions/movement/victory.glb',
    fall: 'public/motions/movement/fall.glb',
  };

  for (const id of [...BOT_GLB_TRAINING_MOTIONS, 'victory' as const, 'fall' as const]) {
    const buf = readFileSync(fileMap[id]);
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const gltf = await new Promise<{ scene: any; animations: any[] }>((resolve, reject) =>
      loader.parse(ab, '', resolve, reject),
    );
    const joints = buildJointSetForTesting(gltf.scene);
    const mixer = new AnimationMixer(gltf.scene);
    const clip = gltf.animations[0];
    assert.ok(clip, `${id} GLB must contain an animation clip`);
    const action = mixer.clipAction(clip);
    action.play();
    mixer.setTime(clip.duration * 0.35);
    gltf.scene.updateMatrixWorld(true);

    const out = makeOut();
    extractPoseFromJoints(joints, id, out);
    assert.equal(out.valid, true, `${id} should extract a valid GLB pose`);
    assert.ok(Number.isFinite(out.pelvisY) && Number.isFinite(out.rightArmX), `${id} pose must be finite`);
    if (id === 'press_up') {
      assert.ok(out.proneFactor > 0.5, `press_up.glb should yield prone pose (got ${out.proneFactor})`);
    }
    if (id === 'victory') {
      assert.ok(out.proneFactor < 0.25, `victory.glb should yield upright victory pose (got ${out.proneFactor})`);
    }
    if (id === 'front_kick_01' || id === 'front_kick_02') {
      mixer.setTime(clip.duration * 0.5);
      gltf.scene.updateMatrixWorld(true);
      extractPoseFromJoints(joints, id, out);
      assert.ok(
        Math.max(out.leftFootY, out.rightFootY) > 0.25,
        `${id} should lift kicking foot from GLB clip`,
      );
    }
  }
});
