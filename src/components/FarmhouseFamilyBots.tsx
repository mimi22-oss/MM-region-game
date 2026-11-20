/**
 * Farmhouse 4-Member Family Bots (အမေ၊ အဖေ၊ အစ်ကိုကြီး၊ ညီမလေး).
 *
 * Reuses the EXACT SAME singleton flyweight geometry/material cache (`getElderBotResourceCache`),
 * `ElderBotRig`, and `KidBotRig` by memory reference — zero duplicate geometries, textures, or materials!
 * Drives all 4 members in a single `useRegionFrame` loop with distance culling (>75m pauses & hides),
 * and synchronizes seat occupancy with `chairSitting.ts` so the player cannot sit on occupied chairs.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Group, Vector3 } from 'three';
import { useRegionFrame } from './RegionActivity';
import {
  FARMHOUSE_FAMILY_MEMBERS,
  createFarmhouseFamilyStates,
  isFamilyMemberOccupyingSeat,
  stepFarmhouseFamilyMember,
  type FamilyMemberState,
} from '../game/farmhouseFamilyBot';
import {
  isChairOccupiedByPlayer,
  releaseNpcChairOccupant,
  setChairOccupiedByNpc,
} from '../game/chairSitting';
import {
  ElderBotRig,
  applyElderBotPose,
  type ElderBotRigHandles,
} from './ElderBotRig';
import {
  KidBotRig,
  applyKidBotPose,
  createEmptyKidHandles,
} from './KidBotRig';

const ACTIVE_DISTANCE_SQ = 75 * 75;

function emptyElderHandles(): ElderBotRigHandles {
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

export function FarmhouseFamilyBots() {
  const containerRef = useRef<Group>(null);
  const worldPosRef = useRef(new Vector3());
  const statesRef = useRef<FamilyMemberState[]>(createFarmhouseFamilyStates());
  const [nearby, setNearby] = useState(true);
  const nearbyRef = useRef(true);
  const checkTimerRef = useRef(0);

  const adultHandles = useMemo(
    () => [
      { current: emptyElderHandles() },
      { current: emptyElderHandles() },
      { current: emptyElderHandles() },
    ],
    [],
  );
  const sisterHandles = useMemo(() => ({ current: createEmptyKidHandles() }), []);

  // Sync initial seated occupancy on mount and release all seats cleanly on unmount
  useEffect(() => {
    const states = statesRef.current;
    for (let i = 0; i < FARMHOUSE_FAMILY_MEMBERS.length; i++) {
      const cfg = FARMHOUSE_FAMILY_MEMBERS[i];
      setChairOccupiedByNpc(
        cfg.chairId,
        `farmhouse-${cfg.id}`,
        isFamilyMemberOccupyingSeat(states[i].activityPhase),
      );
    }
    return () => {
      for (const cfg of FARMHOUSE_FAMILY_MEMBERS) {
        releaseNpcChairOccupant(`farmhouse-${cfg.id}`);
      }
    };
  }, []);

  useRegionFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);

    checkTimerRef.current += dt;
    if (checkTimerRef.current >= 0.4 && containerRef.current) {
      checkTimerRef.current = 0;
      containerRef.current.getWorldPosition(worldPosRef.current);
      const isNear = camera.position.distanceToSquared(worldPosRef.current) <= ACTIVE_DISTANCE_SQ;
      if (isNear !== nearbyRef.current) {
        nearbyRef.current = isNear;
        setNearby(isNear);
      }
    }

    if (!nearbyRef.current) {
      applyElderBotPose(adultHandles[0].current, null);
      applyElderBotPose(adultHandles[1].current, null);
      applyElderBotPose(adultHandles[2].current, null);
      applyKidBotPose(sisterHandles.current, null);
      return;
    }

    const states = statesRef.current;
    for (let i = 0; i < FARMHOUSE_FAMILY_MEMBERS.length; i++) {
      const cfg = FARMHOUSE_FAMILY_MEMBERS[i];
      const st = states[i];
      const seatBlockedByPlayer = isChairOccupiedByPlayer(cfg.chairId);
      stepFarmhouseFamilyMember(st, cfg, dt, seatBlockedByPlayer);
      setChairOccupiedByNpc(
        cfg.chairId,
        `farmhouse-${cfg.id}`,
        isFamilyMemberOccupyingSeat(st.activityPhase),
      );
      if (i < 3) {
        applyElderBotPose(adultHandles[i].current, st);
      } else {
        applyKidBotPose(sisterHandles.current, st);
      }
    }
  });

  const [mom, dad, brother, sister] = FARMHOUSE_FAMILY_MEMBERS;

  return (
    <group ref={containerRef} name="farmhouse-family-bots" userData={{ dynamic: true }} dispose={null}>
      <ElderBotRig
        role="auntie"
        youthful={mom.youthful}
        outfitIndex={mom.outfitIndex}
        skinIndex={mom.skinIndex}
        hairIndex={mom.hairIndex}
        heightScale={mom.heightScale}
        active={nearby}
        name="farmhouse-family-mom"
        handlesRef={adultHandles[0]}
      />
      <ElderBotRig
        role="uncle"
        youthful={dad.youthful}
        outfitIndex={dad.outfitIndex}
        skinIndex={dad.skinIndex}
        hairIndex={dad.hairIndex}
        heightScale={dad.heightScale}
        active={nearby}
        name="farmhouse-family-dad"
        handlesRef={adultHandles[1]}
      />
      <ElderBotRig
        role="uncle"
        youthful={brother.youthful}
        bottomStyle={brother.bottomStyle}
        outfitIndex={brother.outfitIndex}
        skinIndex={brother.skinIndex}
        hairIndex={brother.hairIndex}
        heightScale={brother.heightScale}
        active={nearby}
        name="farmhouse-family-older-brother"
        handlesRef={adultHandles[2]}
      />
      <KidBotRig
        role="girl"
        outfitIndex={sister.outfitIndex}
        skinIndex={sister.skinIndex}
        heightScale={sister.heightScale}
        active={nearby}
        name="farmhouse-family-younger-sister"
        handlesRef={sisterHandles}
      />
    </group>
  );
}
