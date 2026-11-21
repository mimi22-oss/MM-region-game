import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { mobileQuality } from '../game/sceneBudget';
import { areFootballPlayersVisibleAtMinute } from '../game/environmentTime';
import { getFootballMatchAssetCache } from '../game/footballMatchAssets';
import {
  computeFootballBroadcastTarget,
  getFootballViewState,
  stepFootballBroadcastPose,
  type FootballCameraPose,
} from '../game/footballBroadcastCam';
import {
  FOOTBALL_BALL_POOL_SIZE,
  FOOTBALL_PLAYER_POOL_DESKTOP,
  FOOTBALL_PLAYER_POOL_MOBILE,
  FootballMatchPoolController,
  type FootballPlayerState,
} from '../game/footballMatch';
import {
  npcCalfGeometry,
  npcCroppedHairGeometry,
  npcFaceGeometry,
  npcFaceMaterial,
  npcHandGeometry,
  npcHeadGeometry,
  npcShoeGeometry,
} from '../game/npcAnatomy';
import {
  SCHOOL_NPC_ELBOW_Y,
  SCHOOL_NPC_HIP_Y,
  SCHOOL_NPC_KNEE_Y,
  SCHOOL_NPC_SHOE_Y,
  SCHOOL_NPC_WRIST_Y,
  schoolCollarGeometry,
  schoolForearmGeometry,
  schoolShirtGeometry,
  schoolShortSleeveGeometry,
  schoolShortsGeometry,
  schoolThighGeometry,
  schoolUpperArmGeometry,
} from '../game/schoolNpcUniform';

const SIDES = [-1, 1] as const;

interface FootballLimbRefs {
  sleeve: Mesh | null;
  upperArm: Mesh | null;
  elbow: Group | null;
  forearm: Mesh | null;
  wrist: Group | null;
  hand: Mesh | null;
  glove: Mesh | null;
  thigh: Mesh | null;
  shorts: Mesh | null;
  knee: Group | null;
  calf: Mesh | null;
}

interface FootballPlayerSlotRefs {
  root: Group | null;
  body: Group | null;
  head: Group | null;
  headMesh: Mesh | null;
  neckMesh: Mesh | null;
  hairMesh: Mesh | null;
  torsoMesh: Mesh | null;
  waistMesh: Mesh | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftLeg: Group | null;
  rightLeg: Group | null;
  limbs: FootballLimbRefs[];
  boundKey: string | null;
}

interface FootballBallSlotRefs {
  root: Group | null;
  mesh: Mesh | null;
  shadow: Mesh | null;
}

function emptyPlayerRefs(): FootballPlayerSlotRefs {
  return {
    root: null,
    body: null,
    head: null,
    headMesh: null,
    neckMesh: null,
    hairMesh: null,
    torsoMesh: null,
    waistMesh: null,
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
    limbs: SIDES.map(() => ({
      sleeve: null,
      upperArm: null,
      elbow: null,
      forearm: null,
      wrist: null,
      hand: null,
      glove: null,
      thigh: null,
      shorts: null,
      knee: null,
      calf: null,
    })),
    boundKey: null,
  };
}

function bindPlayerMaterials(refs: FootballPlayerSlotRefs, p: FootballPlayerState): void {
  const key = `${p.id}`;
  if (refs.boundKey === key) return;
  refs.boundKey = key;

  const fc = getFootballMatchAssetCache();
  const base = fc.base;
  const skinMat = base.skinMats[p.skinIndex % base.skinMats.length];
  const hairMat = base.hairDarkMat;

  const isRed = p.team === 'red';
  const isGk = p.role === 'gk';

  const jerseyMat = isRed
    ? isGk
      ? fc.redGkJerseyMat
      : fc.redJerseyMat
    : isGk
      ? fc.greenGkJerseyMat
      : fc.greenJerseyMat;
  const shortsMat = isRed ? fc.redShortsMat : fc.greenShortsMat;
  const sockMat = isRed ? fc.redSockMat : fc.greenSockMat;
  const gloveMat = isRed ? fc.redGkGloveMat : fc.greenGkGloveMat;

  if (refs.headMesh) refs.headMesh.material = skinMat;
  if (refs.neckMesh) refs.neckMesh.material = skinMat;
  if (refs.hairMesh) refs.hairMesh.material = hairMat;
  if (refs.torsoMesh) refs.torsoMesh.material = jerseyMat;
  if (refs.waistMesh) refs.waistMesh.material = shortsMat;

  for (const limb of refs.limbs) {
    if (limb.sleeve) limb.sleeve.material = jerseyMat;
    if (limb.upperArm) limb.upperArm.material = skinMat;
    if (limb.forearm) limb.forearm.material = skinMat;
    if (limb.hand) {
      limb.hand.material = skinMat;
      limb.hand.visible = !isGk;
    }
    if (limb.glove) {
      limb.glove.material = gloveMat;
      limb.glove.visible = isGk;
    }
    if (limb.thigh) limb.thigh.material = skinMat;
    if (limb.shorts) limb.shorts.material = shortsMat;
    if (limb.calf) limb.calf.material = sockMat;
  }
}

function animatePlayerSlot(refs: FootballPlayerSlotRefs, p: FootballPlayerState, elapsed: number): void {
  if (!refs.root || !refs.body) return;

  refs.root.position.set(p.worldX, p.worldY, p.worldZ);
  refs.root.rotation.y = p.yaw;
  refs.root.scale.setScalar(p.scale);

  // Reset body defaults
  let bodyY = 0;
  let bodyRotX = 0;
  let bodyRotY = 0;
  let bodyRotZ = p.leanRoll;

  let lArmX = 0;
  let rArmX = 0;
  let lArmZ = 0.08;
  let rArmZ = -0.08;
  let lElbowX = -0.25;
  let rElbowX = -0.25;

  let lLegX = 0;
  let rLegX = 0;
  let lLegZ = 0;
  let rLegZ = 0;
  let lKneeX = 0.08;
  let rKneeX = 0.08;

  const stride = Math.sin(p.walkPhase);
  const strideCos = Math.cos(p.walkPhase);
  const speedNorm = Math.min(1, p.speed / 6.2);

  switch (p.action) {
    case 'run': {
      const swing = stride * (0.35 + speedNorm * 0.55);
      lLegX = swing;
      rLegX = -swing;
      lKneeX = Math.max(0.08, -strideCos * 0.72 * speedNorm + 0.14);
      rKneeX = Math.max(0.08, strideCos * 0.72 * speedNorm + 0.14);
      lArmX = -swing * 0.85;
      rArmX = swing * 0.85;
      lElbowX = -0.65 - speedNorm * 0.4;
      rElbowX = -0.65 - speedNorm * 0.4;
      bodyRotX = 0.1 + speedNorm * 0.14;
      bodyY = Math.abs(stride) * 0.06 * speedNorm;
      break;
    }

    case 'dribble': {
      const quick = Math.sin(p.walkPhase * 1.25);
      lLegX = quick * 0.52;
      rLegX = -quick * 0.52;
      lKneeX = Math.max(0.12, -Math.cos(p.walkPhase * 1.25) * 0.55 + 0.18);
      rKneeX = Math.max(0.12, Math.cos(p.walkPhase * 1.25) * 0.55 + 0.18);
      lArmX = -quick * 0.55;
      rArmX = quick * 0.55;
      lArmZ = 0.24;
      rArmZ = -0.24;
      lElbowX = -0.8;
      rElbowX = -0.8;
      bodyRotX = 0.18;
      bodyY = Math.abs(quick) * 0.04;
      break;
    }

    case 'dribble-feint': {
      // လိမ်တယ် — dramatic low body fake sway + rapid step-over footwork!
      const feintWave = Math.sin(elapsed * 16 + p.slotIndex);
      bodyRotZ = p.feintDir * 0.34 + feintWave * 0.14;
      bodyRotY = p.feintDir * 0.35;
      bodyRotX = 0.24;
      bodyY = -0.05 + Math.abs(feintWave) * 0.05;
      lLegX = feintWave * 0.68;
      rLegX = -feintWave * 0.68;
      lLegZ = p.feintDir * 0.16;
      rLegZ = -p.feintDir * 0.16;
      lKneeX = 0.48;
      rKneeX = 0.48;
      lArmZ = 0.52;
      rArmZ = -0.52;
      lArmX = -0.35;
      rArmX = -0.35;
      lElbowX = -0.85;
      rElbowX = -0.85;
      break;
    }

    case 'kick': {
      // ဂိုးသွင်းတယ် / ကန်တယ် — full leg wind-up -> explosive snap follow-through!
      const t = p.actionDuration > 0 ? Math.min(1, p.actionTimer / p.actionDuration) : 1;
      if (t < 0.38) {
        const w = t / 0.38;
        rLegX = w * 0.92; // pull kicking leg back
        rKneeX = w * 1.15;
        lLegX = -0.22 * w;
        lKneeX = 0.24;
        lArmX = -0.85 * w;
        rArmX = 0.55 * w;
        bodyRotX = -0.06 * w;
        bodyRotY = -0.25 * w;
      } else {
        const f = Math.min(1, (t - 0.38) / 0.62);
        const snap = Math.sin(f * Math.PI * 0.85);
        rLegX = 0.92 - snap * 2.05; // powerful forward kick!
        rKneeX = Math.max(0.05, 1.15 * (1 - snap));
        lLegX = 0.18 * snap;
        lKneeX = 0.16;
        lArmX = -0.6 + snap * 1.0;
        rArmX = 0.55 - snap * 1.15;
        lArmZ = 0.38;
        rArmZ = -0.32;
        bodyRotX = 0.18 * snap;
        bodyRotY = 0.34 * snap;
      }
      break;
    }

    case 'gk-ready': {
      const bob = Math.sin(elapsed * 4.5 + p.slotIndex) * 0.025;
      bodyY = -0.07 + bob;
      bodyRotX = 0.22;
      lLegZ = -0.14;
      rLegZ = 0.14;
      lKneeX = 0.38;
      rKneeX = 0.38;
      lArmX = -0.85;
      rArmX = -0.85;
      lArmZ = 0.38;
      rArmZ = -0.38;
      lElbowX = -0.75;
      rElbowX = -0.75;
      break;
    }

    case 'gk-dive': {
      // ဂိုးဖမ်းတယ် — dramatic airborne sideways goalkeeper stretch!
      const t = p.actionDuration > 0 ? Math.min(1, p.actionTimer / p.actionDuration) : 0.5;
      const arc = Math.sin(t * Math.PI);
      const dir = p.diveDir || 1;
      bodyY = 0.18 + arc * 0.52;
      bodyRotZ = -dir * (1.28 * arc);
      bodyRotX = 0.15;
      lArmX = -2.45 * arc;
      rArmX = -2.45 * arc;
      lArmZ = 0.2;
      rArmZ = -0.2;
      lElbowX = -0.15;
      rElbowX = -0.15;
      lLegX = 0.25 * arc;
      rLegX = -0.15 * arc;
      lKneeX = 0.35;
      rKneeX = 0.2;
      break;
    }

    case 'pickup-ball': {
      // ဘောလုံးကောက်တယ် — bend forward at waist & knees, reach both arms down and lift ball!
      const t = p.actionDuration > 0 ? Math.min(1, p.actionTimer / p.actionDuration) : 0.5;
      const bend = t < 0.45 ? t / 0.45 : Math.max(0, 1 - (t - 0.45) / 0.55);
      bodyY = -0.22 * bend;
      bodyRotX = 0.98 * bend;
      lKneeX = 0.72 * bend;
      rKneeX = 0.72 * bend;
      lLegX = -0.36 * bend;
      rLegX = -0.36 * bend;
      lArmX = -1.25 * bend - 0.55 * (1 - bend);
      rArmX = -1.25 * bend - 0.55 * (1 - bend);
      lArmZ = -0.16;
      rArmZ = 0.16;
      lElbowX = -0.22 - 0.55 * (1 - bend);
      rElbowX = -0.22 - 0.55 * (1 - bend);
      break;
    }

    case 'gk-catch':
    case 'hold-ball': {
      const jog = stride * speedNorm * 0.38;
      lLegX = jog;
      rLegX = -jog;
      lKneeX = 0.16 + Math.abs(jog) * 0.4;
      rKneeX = 0.16 + Math.abs(jog) * 0.4;
      lArmX = -1.05;
      rArmX = -1.05;
      lArmZ = -0.22;
      rArmZ = 0.22;
      lElbowX = -0.88;
      rElbowX = -0.88;
      bodyRotX = 0.06;
      break;
    }

    case 'throw-ball': {
      // ဘောလုံးပစ်တယ် — two-handed overhead throw-in wind-up & snap release!
      const t = p.actionDuration > 0 ? Math.min(1, p.actionTimer / p.actionDuration) : 0.5;
      if (t < 0.65) {
        const pull = t / 0.65;
        bodyRotX = -0.26 * pull; // arch back
        lArmX = -2.2 - 0.65 * pull; // both arms high overhead behind head
        rArmX = -2.2 - 0.65 * pull;
        lArmZ = -0.18;
        rArmZ = 0.18;
        lElbowX = -0.55;
        rElbowX = -0.55;
        lLegX = -0.25;
        rLegX = 0.25;
      } else {
        const whip = (t - 0.65) / 0.35;
        bodyRotX = -0.26 + whip * 0.52; // whip forward!
        lArmX = -2.85 + whip * 1.95;
        rArmX = -2.85 + whip * 1.95;
        lArmZ = -0.1;
        rArmZ = 0.1;
        lElbowX = -0.2;
        rElbowX = -0.2;
        lLegX = -0.28;
        rLegX = 0.32;
      }
      break;
    }

    case 'celebrate': {
      // ဂိုးသွင်းပြီး အောင်ပွဲခံခြင်း!
      const hop = Math.abs(Math.sin(elapsed * 8.5 + p.slotIndex));
      bodyY = hop * 0.34;
      lArmX = -2.75;
      rArmX = -2.75;
      lArmZ = 0.45;
      rArmZ = -0.45;
      lElbowX = -0.2;
      rElbowX = -0.2;
      lLegX = Math.sin(elapsed * 8.5 + p.slotIndex) * 0.28;
      rLegX = -lLegX;
      lKneeX = 0.28 * hop;
      rKneeX = 0.28 * hop;
      break;
    }

    default: {
      // Ready idle stance on pitch
      bodyY = Math.sin(elapsed * 3.2 + p.slotIndex) * 0.015;
      lArmX = -0.15;
      rArmX = -0.15;
      lElbowX = -0.42;
      rElbowX = -0.42;
      break;
    }
  }

  refs.body.position.y = bodyY;
  refs.body.rotation.set(bodyRotX, bodyRotY, bodyRotZ);

  if (refs.leftArm) {
    refs.leftArm.rotation.set(lArmX, 0, lArmZ);
  }
  if (refs.rightArm) {
    refs.rightArm.rotation.set(rArmX, 0, rArmZ);
  }
  if (refs.limbs[0].elbow) refs.limbs[0].elbow.rotation.x = lElbowX;
  if (refs.limbs[1].elbow) refs.limbs[1].elbow.rotation.x = rElbowX;

  if (refs.leftLeg) {
    refs.leftLeg.rotation.set(lLegX, 0, lLegZ);
  }
  if (refs.rightLeg) {
    refs.rightLeg.rotation.set(rLegX, 0, rLegZ);
  }
  if (refs.limbs[0].knee) refs.limbs[0].knee.rotation.x = lKneeX;
  if (refs.limbs[1].knee) refs.limbs[1].knee.rotation.x = rKneeX;

  if (refs.head) {
    refs.head.rotation.y = p.action === 'dribble-feint' ? -p.feintDir * 0.22 : 0;
    refs.head.rotation.x = p.action === 'pickup-ball' ? 0.25 : 0;
  }
}

export function FootballMatchBots({
  activeRegions,
  minute = 780,
}: {
  activeRegions: readonly string[];
  minute?: number;
}) {
  const poolSize = mobileQuality ? FOOTBALL_PLAYER_POOL_MOBILE : FOOTBALL_PLAYER_POOL_DESKTOP;
  const maxRange = mobileQuality ? 175 : 245;
  const visibleAtTime = areFootballPlayersVisibleAtMinute(minute);

  const fc = useMemo(() => getFootballMatchAssetCache(), []);
  const controller = useMemo(
    () => new FootballMatchPoolController(poolSize, maxRange),
    [poolSize, maxRange],
  );

  const playerRefs = useRef<FootballPlayerSlotRefs[]>(
    Array.from({ length: poolSize }, () => emptyPlayerRefs()),
  );
  const ballRefs = useRef<FootballBallSlotRefs[]>(
    Array.from({ length: FOOTBALL_BALL_POOL_SIZE }, () => ({
      root: null,
      mesh: null,
      shadow: null,
    })),
  );
  const broadcastPoseRef = useRef<FootballCameraPose | null>(null);
  const broadcastKeyRef = useRef<string | null>(null);
  const broadcastFocusScratch = useRef({ x: 0, z: 0 });

  // Keep refs array length synchronized if poolSize ever changes
  useEffect(() => {
    if (playerRefs.current.length !== poolSize) {
      playerRefs.current = Array.from({ length: poolSize }, () => emptyPlayerRefs());
    }
  }, [poolSize]);

  useFrame(({ camera, clock }, dt) => {
    // Hide all football players & balls strictly at night/evening
    if (!visibleAtTime) {
      broadcastPoseRef.current = null;
      broadcastKeyRef.current = null;
      for (let i = 0; i < playerRefs.current.length; i++) {
        const slot = playerRefs.current[i];
        if (slot?.root) slot.root.visible = false;
      }
      for (let i = 0; i < ballRefs.current.length; i++) {
        const slot = ballRefs.current[i];
        if (slot?.root) slot.root.visible = false;
      }
      return;
    }

    const fbView = getFootballViewState();
    const viewedMatch =
      fbView.active && fbView.pitchId
        ? controller.matches.find((m) => m.spec.id === fbView.pitchId) ?? null
        : null;

    const focus = viewedMatch
      ? { x: viewedMatch.spec.centerX, z: viewedMatch.spec.centerZ }
      : (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
          x: camera.position.x,
          z: camera.position.z,
        };

    // Balloons are hidden during daytime, so the entire Myothar pitch center stays open for football.
    controller.update(focus.x, focus.z, dt, activeRegions, null);

    // Apply live TV-Broadcast auto camera ("Football View") right after simulation update for zero lag!
    if (viewedMatch) {
      const key = `${viewedMatch.spec.id}:${fbView.preset}`;
      const switched = broadcastKeyRef.current !== key;
      broadcastKeyRef.current = key;
      const targetPose = computeFootballBroadcastTarget(viewedMatch, fbView.preset);
      const fastAction =
        viewedMatch.ball.isShot ||
        viewedMatch.phase === 'goal-celebration' ||
        viewedMatch.phase === 'gk-hold' ||
        viewedMatch.phase === 'throw-in';
      const nextPose = stepFootballBroadcastPose(
        switched ? null : broadcastPoseRef.current,
        targetPose,
        dt,
        fastAction,
      );
      broadcastPoseRef.current = nextPose;
      camera.position.set(nextPose.camX, nextPose.camY, nextPose.camZ);
      camera.lookAt(nextPose.lookX, nextPose.lookY, nextPose.lookZ);
      broadcastFocusScratch.current.x = nextPose.lookX;
      broadcastFocusScratch.current.z = nextPose.lookZ;
      camera.userData.viewFocus = broadcastFocusScratch.current;
    } else if (broadcastPoseRef.current !== null) {
      broadcastPoseRef.current = null;
      broadcastKeyRef.current = null;
    }

    const elapsed = clock.elapsedTime;

    // Update fixed pool of football players
    for (let i = 0; i < controller.playerSlots.length; i++) {
      const slot = playerRefs.current[i];
      if (!slot || !slot.root) continue;
      const player = controller.playerSlots[i];
      if (!player) {
        slot.root.visible = false;
        continue;
      }
      slot.root.visible = true;
      bindPlayerMaterials(slot, player);
      animatePlayerSlot(slot, player, elapsed);
    }

    // Update fixed pool of footballs + ground contact shadows
    for (let i = 0; i < controller.ballSlots.length; i++) {
      const slot = ballRefs.current[i];
      if (!slot || !slot.root) continue;
      const ball = controller.ballSlots[i];
      if (!ball) {
        slot.root.visible = false;
        continue;
      }
      slot.root.visible = true;
      if (slot.mesh) {
        slot.mesh.position.set(ball.worldX, ball.worldY, ball.worldZ);
        slot.mesh.rotation.set(ball.rotX, 0, ball.rotZ);
      }
      if (slot.shadow) {
        slot.shadow.position.set(ball.worldX, ball.groundY + 0.03, ball.worldZ);
        const airHeight = Math.max(0, ball.worldY - ball.groundY - 0.24);
        const shadowScale = Math.max(0.42, 1 - airHeight * 0.14);
        slot.shadow.scale.setScalar(shadowScale);
      }
    }
  });

  return (
    <group name="football-match-bots-pool">
      {/* Fixed Pool of Football Players (Red vs Green, reusing Singleton anatomy) */}
      {Array.from({ length: poolSize }, (_, i) => (
        <group
          key={`fb-player-${i}`}
          ref={(el) => {
            if (playerRefs.current[i]) playerRefs.current[i].root = el;
          }}
          visible={false}
          userData={{ dynamic: true, footballPlayer: true }}
        >
          <group
            ref={(el) => {
              if (playerRefs.current[i]) playerRefs.current[i].body = el;
            }}
          >
            {/* Head + Face + Hair */}
            <group
              ref={(el) => {
                if (playerRefs.current[i]) playerRefs.current[i].head = el;
              }}
              position={[0, 1.48, 0]}
            >
              <mesh
                ref={(el) => {
                  if (playerRefs.current[i]) playerRefs.current[i].headMesh = el;
                }}
                geometry={npcHeadGeometry}
                material={fc.base.skinMats[0]}
              />
              <mesh geometry={npcFaceGeometry} material={npcFaceMaterial} />
              <mesh
                ref={(el) => {
                  if (playerRefs.current[i]) playerRefs.current[i].hairMesh = el;
                }}
                geometry={npcCroppedHairGeometry}
                material={fc.base.hairDarkMat}
              />
            </group>

            {/* Neck */}
            <mesh
              ref={(el) => {
                if (playerRefs.current[i]) playerRefs.current[i].neckMesh = el;
              }}
              position={[0, 1.32, 0]}
              geometry={fc.base.neckGeo}
              material={fc.base.skinMats[0]}
            />

            {/* Football Jersey Torso + White Collar Trim */}
            <mesh
              ref={(el) => {
                if (playerRefs.current[i]) playerRefs.current[i].torsoMesh = el;
              }}
              position={[0, 1.07, 0]}
              geometry={schoolShirtGeometry}
              material={fc.redJerseyMat}
              castShadow={!mobileQuality}
            />
            <mesh
              position={[0, 1.07, 0]}
              geometry={schoolCollarGeometry}
              material={fc.collarTrimMat}
            />

            {/* Shorts Waist */}
            <mesh
              ref={(el) => {
                if (playerRefs.current[i]) playerRefs.current[i].waistMesh = el;
              }}
              position={[0, 0.81, 0]}
              geometry={schoolShortsGeometry}
              scale={[1.85, 0.55, 1.4]}
              material={fc.redShortsMat}
            />

            {/* Articulated Left & Right Arms (with Goalkeeper Gloves toggle) */}
            {SIDES.map((side, idx) => (
              <group
                key={`arm-${side}`}
                ref={(el) => {
                  if (!playerRefs.current[i]) return;
                  if (side < 0) playerRefs.current[i].leftArm = el;
                  else playerRefs.current[i].rightArm = el;
                }}
                position={[side * 0.215, 1.24, 0]}
              >
                <mesh
                  ref={(el) => {
                    if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].sleeve = el;
                  }}
                  geometry={schoolShortSleeveGeometry}
                  material={fc.redJerseyMat}
                />
                <mesh
                  ref={(el) => {
                    if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].upperArm = el;
                  }}
                  geometry={schoolUpperArmGeometry}
                  material={fc.base.skinMats[0]}
                />
                <group
                  ref={(el) => {
                    if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].elbow = el;
                  }}
                  position={[0, SCHOOL_NPC_ELBOW_Y, 0]}
                >
                  <mesh
                    ref={(el) => {
                      if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].forearm = el;
                    }}
                    geometry={schoolForearmGeometry}
                    material={fc.base.skinMats[0]}
                  />
                  <group
                    ref={(el) => {
                      if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].wrist = el;
                    }}
                    position={[0, SCHOOL_NPC_WRIST_Y, 0]}
                  >
                    <mesh
                      ref={(el) => {
                        if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].hand = el;
                      }}
                      geometry={npcHandGeometry}
                      scale={[side < 0 ? -1 : 1, 1, 1]}
                      material={fc.base.skinMats[0]}
                    />
                    <mesh
                      ref={(el) => {
                        if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].glove = el;
                      }}
                      geometry={fc.gloveGeo}
                      position={[0, -0.04, 0.01]}
                      material={fc.redGkGloveMat}
                      visible={false}
                    />
                  </group>
                </group>
              </group>
            ))}

            {/* Articulated Left & Right Legs (Shorts + Skin Knee + Team Socks + Football Cleats) */}
            {SIDES.map((side, idx) => (
              <group
                key={`leg-${side}`}
                ref={(el) => {
                  if (!playerRefs.current[i]) return;
                  if (side < 0) playerRefs.current[i].leftLeg = el;
                  else playerRefs.current[i].rightLeg = el;
                }}
                position={[side * 0.095, SCHOOL_NPC_HIP_Y, 0]}
              >
                <mesh
                  ref={(el) => {
                    if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].shorts = el;
                  }}
                  geometry={schoolShortsGeometry}
                  material={fc.redShortsMat}
                />
                <mesh
                  ref={(el) => {
                    if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].thigh = el;
                  }}
                  geometry={schoolThighGeometry}
                  material={fc.base.skinMats[0]}
                />
                <group
                  ref={(el) => {
                    if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].knee = el;
                  }}
                  position={[0, SCHOOL_NPC_KNEE_Y, 0]}
                >
                  <mesh
                    ref={(el) => {
                      if (playerRefs.current[i]) playerRefs.current[i].limbs[idx].calf = el;
                    }}
                    position={[0, -0.09, 0]}
                    geometry={npcCalfGeometry}
                    material={fc.redSockMat}
                  />
                  <mesh
                    position={[0, SCHOOL_NPC_SHOE_Y, 0]}
                    geometry={npcShoeGeometry}
                    material={fc.cleatMat}
                  />
                </group>
              </group>
            ))}
          </group>
        </group>
      ))}

      {/* Fixed Pool of 3D Footballs & Ground Shadows */}
      {Array.from({ length: FOOTBALL_BALL_POOL_SIZE }, (_, i) => (
        <group
          key={`fb-ball-${i}`}
          ref={(el) => {
            if (ballRefs.current[i]) ballRefs.current[i].root = el;
          }}
          visible={false}
          userData={{ dynamic: true, footballBall: true }}
        >
          <mesh
            ref={(el) => {
              if (ballRefs.current[i]) ballRefs.current[i].mesh = el;
            }}
            geometry={fc.ballGeo}
            material={fc.ballMat}
            castShadow={!mobileQuality}
          />
          <mesh
            ref={(el) => {
              if (ballRefs.current[i]) ballRefs.current[i].shadow = el;
            }}
            geometry={fc.ballShadowGeo}
            material={fc.ballShadowMat}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        </group>
      ))}
    </group>
  );
}
