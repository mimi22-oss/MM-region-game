import { useEffect, useRef, type RefObject } from 'react';
import { Group, Vector3 } from 'three';
import { useRegionFrame } from './RegionActivity';
import { angle } from '../data/ward';
import { uShweHouseCoords } from '../data/ushwehouse';
import {
  U_SHWE_COUPLE_CHAIRS,
  U_SHWE_SIDE_TABLE_LOCAL,
  computeDoorTargetOpen,
  createCoupleBotState,
  isCoupleBotOccupyingSeat,
  stepCoupleBot,
  stepDoorOpen,
  type CoupleBotState,
} from '../game/uShweCoupleBot';
import {
  isChairOccupiedByPlayer,
  localDirToBodyYaw,
  localToWorldXZ,
  registerChairSpot,
  releaseNpcChairOccupant,
  setChairOccupiedByNpc,
  unregisterChairSpot,
} from '../game/chairSitting';
import {
  ElderBotRig,
  VerandaChair,
  applyElderBotPose,
  type ElderBotRigHandles,
} from './ElderBotRig';
import { getElderBotResourceCache } from '../game/elderBotResources';
import type { ResidentState } from '../game/residentBots';

function createEmptyHandles(): ElderBotRigHandles {
  return {
    root: null,
    pelvis: null,
    torso: null,
    head: null,
    leftArm: null,
    rightArm: null,
    leftForearm: null,
    rightForearm: null,
    leftFoot: null,
    rightFoot: null,
    standLongyi: null,
    sitLongyi: null,
  };
}

/** Small teak side stand with traditional red Myanmar lacquerware betel box (ကွမ်းအစ်) & teacup. */
function CoupleSideStand() {
  const res = getElderBotResourceCache();
  const { x, y, z } = U_SHWE_SIDE_TABLE_LOCAL;
  return (
    <group name="u-shwe-couple-side-table" position={[x, y, z]} dispose={null}>
      <mesh
        geometry={res.geo.unitBox}
        material={res.chairTeakFrame}
        position={[0, 0.45, 0]}
        scale={[0.38, 0.035, 0.38]}
        castShadow
        receiveShadow
        dispose={null}
      />
      {[-0.14, 0.14].map((lx) =>
        [-0.14, 0.14].map((lz) => (
          <mesh
            key={`${lx}-${lz}`}
            geometry={res.geo.unitBox}
            material={res.chairTeakDark}
            position={[lx, 0.22, lz]}
            scale={[0.032, 0.44, 0.032]}
            dispose={null}
          />
        )),
      )}
      <mesh position={[-0.06, 0.515, -0.04]} castShadow>
        <cylinderGeometry args={[0.068, 0.064, 0.095, 14]} />
        <meshStandardMaterial color="#991b1b" roughness={0.35} />
      </mesh>
      <mesh position={[-0.06, 0.565, -0.04]}>
        <cylinderGeometry args={[0.071, 0.071, 0.016, 14]} />
        <meshStandardMaterial color="#d4a34a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.08, 0.49, 0.06]}>
        <cylinderGeometry args={[0.028, 0.022, 0.045, 10]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} />
      </mesh>
    </group>
  );
}

/**
 * U Shwe House Resident Couple Bots & Farmhouse-style Double Front Door Controller.
 * Registers both veranda armchairs with `chairSitting.ts` so the player can sit when empty
 * and is blocked whenever Uncle or Auntie is currently seated there.
 */
export function UShweCoupleBots({
  leftDoorRef,
  rightDoorRef,
}: {
  leftDoorRef: RefObject<Group | null>;
  rightDoorRef: RefObject<Group | null>;
}) {
  const uncleRef = useRef<CoupleBotState>(createCoupleBotState('uncle'));
  const auntieRef = useRef<CoupleBotState>(createCoupleBotState('auntie'));
  const uncleHandlesRef = useRef<ElderBotRigHandles>(createEmptyHandles());
  const auntieHandlesRef = useRef<ElderBotRigHandles>(createEmptyHandles());
  const doorOpenRef = useRef(0);
  const worldPosRef = useRef(new Vector3());
  const containerRef = useRef<Group>(null);

  // Register U Shwe veranda armchairs for player sitting when empty & track initial occupancy
  useEffect(() => {
    const rot = angle + Math.PI / 2;
    const h = uShweHouseCoords;
    for (const chair of [U_SHWE_COUPLE_CHAIRS.uncle, U_SHWE_COUPLE_CHAIRS.auntie]) {
      const worldPos = localToWorldXZ(h.x, h.z, rot, chair.x, chair.z);
      const exitPos = localToWorldXZ(h.x, h.z, rot, chair.standSpot.x, chair.standSpot.z);
      const bodyYaw = localDirToBodyYaw(rot, Math.sin(chair.yaw), Math.cos(chair.yaw));
      registerChairSpot({
        id: chair.id,
        x: worldPos.x,
        z: worldPos.z,
        seatTopY: chair.floorY + chair.seatHeight,
        seatHeight: chair.seatHeight,
        yaw: bodyYaw,
        exitX: exitPos.x,
        exitZ: exitPos.z,
        label: chair.role === 'uncle' ? 'U Shwe Veranda Chair' : 'Daw Lay Veranda Chair',
        type: 'chair',
      });
    }
    setChairOccupiedByNpc(
      U_SHWE_COUPLE_CHAIRS.uncle.id,
      'u-shwe-uncle',
      isCoupleBotOccupyingSeat(uncleRef.current.phase),
    );
    setChairOccupiedByNpc(
      U_SHWE_COUPLE_CHAIRS.auntie.id,
      'u-shwe-auntie',
      isCoupleBotOccupyingSeat(auntieRef.current.phase),
    );

    return () => {
      unregisterChairSpot(U_SHWE_COUPLE_CHAIRS.uncle.id);
      unregisterChairSpot(U_SHWE_COUPLE_CHAIRS.auntie.id);
      releaseNpcChairOccupant('u-shwe-uncle');
      releaseNpcChairOccupant('u-shwe-auntie');
    };
  }, []);

  useRegionFrame(({ camera }, delta) => {
    if (containerRef.current) {
      containerRef.current.getWorldPosition(worldPosRef.current);
      if (camera.position.distanceToSquared(worldPosRef.current) > 140 * 140) {
        return;
      }
    }

    const targetOpen = computeDoorTargetOpen(uncleRef.current, auntieRef.current);
    doorOpenRef.current = stepDoorOpen(doorOpenRef.current, targetOpen, delta);

    stepCoupleBot(
      uncleRef.current,
      delta,
      doorOpenRef.current,
      isChairOccupiedByPlayer(U_SHWE_COUPLE_CHAIRS.uncle.id),
    );
    stepCoupleBot(
      auntieRef.current,
      delta,
      doorOpenRef.current,
      isChairOccupiedByPlayer(U_SHWE_COUPLE_CHAIRS.auntie.id),
    );

    setChairOccupiedByNpc(
      U_SHWE_COUPLE_CHAIRS.uncle.id,
      'u-shwe-uncle',
      isCoupleBotOccupyingSeat(uncleRef.current.phase),
    );
    setChairOccupiedByNpc(
      U_SHWE_COUPLE_CHAIRS.auntie.id,
      'u-shwe-auntie',
      isCoupleBotOccupyingSeat(auntieRef.current.phase),
    );

    applyElderBotPose(uncleHandlesRef.current, uncleRef.current as unknown as ResidentState);
    applyElderBotPose(auntieHandlesRef.current, auntieRef.current as unknown as ResidentState);

    // Symmetrical Farmhouse/HomeGate-style double door swing inward (-Z) up to 90 degrees
    const swingAngle = doorOpenRef.current * (Math.PI / 2);
    if (leftDoorRef.current) {
      leftDoorRef.current.rotation.y = swingAngle;
    }
    if (rightDoorRef.current) {
      rightDoorRef.current.rotation.y = -swingAngle;
    }
  });

  return (
    <group ref={containerRef} name="u-shwe-couple-bots-system">
      <VerandaChair seat={U_SHWE_COUPLE_CHAIRS.uncle} />
      <VerandaChair seat={U_SHWE_COUPLE_CHAIRS.auntie} />
      <CoupleSideStand />
      <ElderBotRig
        role="uncle"
        outfitIndex={0}
        skinIndex={0}
        hairIndex={0}
        heightScale={1.0}
        name="u-shwe-uncle-bot"
        handlesRef={uncleHandlesRef}
      />
      <ElderBotRig
        role="auntie"
        outfitIndex={0}
        skinIndex={1}
        hairIndex={0}
        heightScale={0.93}
        name="u-shwe-auntie-bot"
        handlesRef={auntieHandlesRef}
      />
    </group>
  );
}
