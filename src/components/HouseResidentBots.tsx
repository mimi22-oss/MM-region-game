/**
 * Memory-cached, fixed-pool Residential House Bot System (အိမ်တိုင်းအတွက် Memory-Optimized Bot Pool).
 *
 * Instead of creating thousands of duplicate meshes for ~2,300+ houses across Myothar & Kalay villages:
 * - Pre-allocates a small fixed pool (`MAX_SLOTS = mobile ? 6 : 12`) of reusable household slots.
 * - Reuses the EXACT SAME flyweight geometries, procedural textures, and cached outfit palettes
 *   as `UShweCoupleBots` (`getElderBotResourceCache` + `ElderBotRig` + `KidBotRig`).
 * - Each active house gets:
 *   - 1 or 2 adult residents (Uncle / Auntie) on porch armchairs
 *   - 1 girl, 1 boy, or 2 kids (boy + girl) on colorful low kid stools
 *   - All coordinated cleanly through one animated double front door — zero geometry/material duplication!
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  KALAY_SIGN_HOUSE_ID,
  farmhouse,
  kalayVillages,
  uShweHouse,
  ward,
} from '../data/ward';
import { myotharCenterBuildings } from '../data/wards/myothar/center/index.ts';
import { kalayArea1Buildings } from '../data/wards/kalayArea1/kalayArea1Buildings.ts';
import { houseVisualRotation } from './House';
import { spatialIndex } from '../game/spatialIndex';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
import { sourceIsEdited } from '../game/worldEdits';
import {
  getStreamedAllBuildingsForRegion,
  getStreamedChunkVersion,
  subscribeStreamedChunks,
} from '../game/streamedChunkRegistry';
import {
  computeResidentDoorTarget,
  computeResidentGateTarget,
  isResidentOccupyingSeat,
  stepDoorOpen,
  stepResident,
  type ResidentSeat,
  type ResidentState,
} from '../game/residentBots';
import type { TimeMode } from '../game/environmentTime';
import { isDaytimeLivingHours } from '../game/villageCrowd';
import { isBotInCombat } from '../game/botFighting';
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
  assignResidentPoolSlots,
  createHouseholdPool,
  type PooledHouseholdSlotState,
  type ResidentHouseRecord,
} from '../game/houseResidentPool';
import { getElderBotResourceCache } from '../game/elderBotResources';
import {
  ElderBotRig,
  VerandaChair,
  applyElderBotPose,
  type ElderBotRigHandles,
} from './ElderBotRig';
import {
  KidBotRig,
  KidStool,
  applyKidBotPose,
  createEmptyKidHandles,
  type KidBotRigHandles,
} from './KidBotRig';

const MAX_SLOTS_DESKTOP = 12;
const MAX_SLOTS_MOBILE = 6;
const ACTIVE_RADIUS_DESKTOP = 68;
const ACTIVE_RADIUS_MOBILE = 46;
const QUERY_INTERVAL_SEC = 0.35;

/** Excluded special buildings that have custom scenes/bots or aren't residential houses. */
const EXCLUDED_HOUSE_IDS = new Set([farmhouse.id, uShweHouse.id, KALAY_SIGN_HOUSE_ID]);

function isGenericResidentialHouse(
  regionId: string,
  h: { id: string; width: number; depth: number; type?: string },
): boolean {
  if (EXCLUDED_HOUSE_IDS.has(h.id)) return false;
  if (h.width < 5.5 || h.depth < 4.5) return false;
  if (h.type && h.type !== 'house') return false;
  if (regionId === 'htomar' && (h.id.startsWith('htomar-campus-') || h.id.startsWith('htomar-shop-'))) {
    return false;
  }
  if (regionId === 'tharyargone' && h.id.startsWith('tyg-landmark-')) return false;
  if (regionId === 'htaukkyant' && h.id.startsWith('hk-landmark-')) return false;
  if (regionId === 'kyarinn' && h.id.startsWith('ki-')) return false;
  if (h.id === 'way/403027623' || h.id === 'way/403030614') return false;
  return true;
}

const regionHouseCache = new Map<
  string,
  {
    sig: number;
    houses: ResidentHouseRecord[];
    lookup: (x: number, z: number) => readonly ResidentHouseRecord[];
  }
>();

function getRegionHouses(regionId: string, chunkVersion: number) {
  const existing = regionHouseCache.get(regionId);
  const isStreamed = regionId === 'kanbale';
  const sig = isStreamed ? chunkVersion : 1;
  if (existing && existing.sig === sig) return existing;

  const houses: ResidentHouseRecord[] = [];

  if (regionId === 'myothar') {
    for (const h of ward.houses) {
      if (!isGenericResidentialHouse('myothar', h)) continue;
      houses.push({
        id: h.id,
        x: h.x,
        z: h.z,
        width: h.width,
        depth: h.depth,
        rotation: houseVisualRotation(h),
        porchY: 0.355,
        hasWideYard: true,
      });
    }
    for (const b of myotharCenterBuildings) {
      if (b.isLandmark) continue;
      const w = b.houseWidth || b.width || 0;
      const d = b.houseLength || b.depth || 0;
      if (!isGenericResidentialHouse('myothar', { id: b.id, width: w, depth: d })) {
        continue;
      }
      houses.push({
        id: b.id,
        x: b.x,
        z: b.z,
        width: w,
        depth: d,
        rotation: b.rotation,
        porchY: 0.355,
        hasWideYard: false,
      });
    }
    for (const b of kalayArea1Buildings) {
      const w = b.houseWidth || b.width || 0;
      const d = b.houseLength || b.depth || 0;
      if (!isGenericResidentialHouse('myothar', { id: b.id, width: w, depth: d })) {
        continue;
      }
      houses.push({
        id: b.id,
        x: b.x,
        z: b.z,
        width: w,
        depth: d,
        rotation: b.rotation,
        porchY: 0.355,
        hasWideYard: false,
      });
    }
  } else if (isStreamed) {
    for (const b of getStreamedAllBuildingsForRegion('kanbale')) {
      if (!b.privateHome) continue;
      if (b.width < 5.5 || b.depth < 4.5) continue;
      houses.push({
        id: b.id,
        x: b.x,
        z: b.z,
        width: b.width,
        depth: b.depth,
        rotation: b.rotation,
        porchY: 0.355,
        hasWideYard: false,
      });
    }
  } else {
    const village = kalayVillages.find((v) => v.id === regionId);
    if (village) {
      const usesDirectRotation = regionId === 'sithar' || regionId === 'natmyaung';
      for (const h of village.houses as Array<{
        id: string;
        x: number;
        z: number;
        width: number;
        depth: number;
        rotation: number;
        type?: string;
        houseWidth?: number;
        houseLength?: number;
      }>) {
        const w = h.houseWidth || h.width;
        const d = h.houseLength || h.depth;
        if (!isGenericResidentialHouse(regionId, { id: h.id, width: w, depth: d, type: h.type })) {
          continue;
        }
        houses.push({
          id: h.id,
          x: h.x,
          z: h.z,
          width: w,
          depth: d,
          rotation: usesDirectRotation ? h.rotation : houseVisualRotation(h as never),
          porchY: 0.355,
          hasWideYard: !usesDirectRotation,
        });
      }
    }
  }

  const lookup = spatialIndex(houses, (h) => ({ x: h.x, z: h.z, radius: 74 }), 64);
  const entry = { sig, houses, lookup };
  regionHouseCache.set(regionId, entry);
  return entry;
}

interface SlotDomRefs {
  leftDoor: RefObject<Group | null>;
  rightDoor: RefObject<Group | null>;
  leftGate: RefObject<Group | null>;
  rightGate: RefObject<Group | null>;
  bot0: RefObject<ElderBotRigHandles>;
  bot1: RefObject<ElderBotRigHandles>;
  kid0: RefObject<KidBotRigHandles>;
  kid1: RefObject<KidBotRigHandles>;
}

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

/**
 * Reusable pooled household slot.
 * Renders up to 2 flyweight adult chairs + 2 ElderBotRigs, up to 2 low kid stools + 2 KidBotRigs,
 * and an outward-swinging double front door aligned directly over the assigned house's front doorway.
 */
function PooledHouseholdSlotView({
  slot,
  refs,
}: {
  slot: PooledHouseholdSlotState;
  refs: SlotDomRefs;
}) {
  const res = getElderBotResourceCache();
  const house = slot.house;
  const profile = slot.profile;
  const layout = slot.layout;

  const isActive = Boolean(house && profile && layout);
  const front = house ? house.depth / 2 : 4.5;
  const porchY = house ? house.porchY : 0.355;

  const fallbackSeat: ResidentSeat = {
    id: 'inactive-seat',
    x: 0,
    z: 0,
    floorY: 0,
    seatHeight: 0.42,
    yaw: 0,
    standSpot: { x: 0, z: 0 },
  };

  const m0 = profile?.members[0] ?? null;
  const m1 = profile?.members[1] ?? null;
  const k0 = profile?.kids[0] ?? null;
  const k1 = profile?.kids[1] ?? null;

  const seat0 = layout ? layout.seats[0] : fallbackSeat;
  const seat1 = layout ? layout.seats[1] : fallbackSeat;
  const seat2 = layout ? layout.seats[2] : fallbackSeat;
  const seat3 = layout ? layout.seats[3] : fallbackSeat;

  const showSeat0 = isActive && Boolean(profile?.members.some((m) => m.seatIndex === 0));
  const showSeat1 = isActive && Boolean(profile?.members.some((m) => m.seatIndex === 1));
  const showSeat2 = isActive && Boolean(profile?.kids.some((k) => k.seatIndex === 2));
  const showSeat3 = isActive && Boolean(profile?.kids.some((k) => k.seatIndex === 3));

  // Register visible porch armchairs with chairSitting so player can sit only when resident is away
  const houseId = house?.id ?? null;
  useEffect(() => {
    if (!house || !layout || !profile) return;
    const registeredIds: string[] = [];
    for (const member of profile.members) {
      const seat = layout.seats[member.seatIndex];
      const chairId = `pooled-chair-${house.id}-${member.seatIndex}`;
      const worldPos = localToWorldXZ(house.x, house.z, house.rotation, seat.x, seat.z);
      const exitPos = localToWorldXZ(
        house.x,
        house.z,
        house.rotation,
        seat.standSpot.x,
        seat.standSpot.z,
      );
      registerChairSpot({
        id: chairId,
        x: worldPos.x,
        z: worldPos.z,
        seatTopY: seat.floorY + seat.seatHeight,
        seatHeight: seat.seatHeight,
        yaw: localDirToBodyYaw(house.rotation, Math.sin(seat.yaw), Math.cos(seat.yaw)),
        exitX: exitPos.x,
        exitZ: exitPos.z,
        label: 'Porch Armchair',
        type: 'chair',
      });
      registeredIds.push(chairId);
    }
    return () => {
      for (const id of registeredIds) unregisterChairSpot(id);
      releaseNpcChairOccupant(`pooled-slot-${slot.slotIndex}-0`);
      releaseNpcChairOccupant(`pooled-slot-${slot.slotIndex}-1`);
    };
  }, [houseId, slot.slotIndex, house, layout, profile]);

  return (
    <group
      name={`pooled-household-slot-${slot.slotIndex}`}
      position={house ? [house.x, 0, house.z] : [0, -50, 0]}
      rotation={house ? [0, house.rotation, 0] : [0, 0, 0]}
      visible={isActive}
      userData={{ dynamic: true }}
      dispose={null}
    >
      {/* Dynamic Double Front Door Overlay */}
      <group
        position={[0, porchY, front + 0.175]}
        visible={isActive}
        userData={{ dynamic: true }}
        name="pooled-house-double-door"
      >
        <mesh
          geometry={res.geo.unitBox}
          material={res.doorBackdrop}
          position={[0, 1.12, -0.005]}
          scale={[1.3, 2.22, 0.015]}
          dispose={null}
        />
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side < 0 ? refs.leftDoor : refs.rightDoor}
            position={[side * 0.65, 0, 0.018]}
          >
            <mesh
              geometry={res.geo.unitBox}
              material={res.doorWood}
              position={[-side * 0.32, 1.12, 0]}
              scale={[0.63, 2.22, 0.06]}
              castShadow
              dispose={null}
            />
            {[0.036, -0.036].map((pz) => (
              <mesh
                key={pz}
                geometry={res.geo.unitBox}
                material={res.doorPanel}
                position={[-side * 0.32, 1.12, pz]}
                scale={[0.42, 1.65, 0.012]}
                dispose={null}
              />
            ))}
            {[0.056, -0.056].map((kz) => (
              <mesh
                key={kz}
                geometry={res.geo.unitSphere}
                material={res.doorKnob}
                position={[-side * 0.52, 1.05, kz]}
                scale={0.042}
                dispose={null}
              />
            ))}
          </group>
        ))}
      </group>

      {/* Dynamic Blue Double Compound Gate (ခြံတံခါး — swings smoothly open when residents go out / return) */}
      <group
        position={[0, 0, front + 2.6]}
        visible={isActive && layout?.gateZ !== undefined}
        userData={{ dynamic: true }}
        name="pooled-house-front-gate"
      >
        {([-1, 1] as const).map((side) => (
          <group
            key={`gate-${side}`}
            ref={side < 0 ? refs.leftGate : refs.rightGate}
            position={[side * 1.22, 0, 0]}
          >
            <mesh
              geometry={res.geo.unitBox}
              material={res.gateBlue}
              position={[-side * 0.6, 0.88, 0]}
              scale={[1.19, 1.72, 0.05]}
              castShadow
              receiveShadow
              dispose={null}
            />
            <mesh
              geometry={res.geo.unitBox}
              material={res.gateTrim}
              position={[-side * 0.6, 1.75, 0]}
              scale={[1.2, 0.05, 0.08]}
              dispose={null}
            />
            <mesh
              geometry={res.geo.unitSphere}
              material={res.doorKnob}
              position={[-side * 1.08, 0.96, 0.055]}
              scale={0.045}
              dispose={null}
            />
          </group>
        ))}
      </group>

      {/* Reusable Porch Armchairs (1 or 2 adult seats) */}
      <VerandaChair seat={seat0} visible={showSeat0} dynamic />
      <VerandaChair seat={seat1} visible={showSeat1} dynamic />

      {/* Reusable Low Kid Stools (1 or 2 kid seats) */}
      <KidStool seat={seat2} colorIndex={(slot.slotIndex + (k0?.outfitIndex ?? 0)) % 4} visible={showSeat2} />
      <KidStool seat={seat3} colorIndex={(slot.slotIndex + (k1?.outfitIndex ?? 1) + 1) % 4} visible={showSeat3} />

      {/* Reusable Flyweight Adult Elder Rigs */}
      <ElderBotRig
        role={m0?.role === 'auntie' ? 'auntie' : 'uncle'}
        outfitIndex={m0?.outfitIndex ?? 0}
        skinIndex={m0?.skinIndex ?? 0}
        hairIndex={m0?.hairIndex ?? 0}
        heightScale={m0?.heightScale ?? 1.0}
        active={isActive && Boolean(m0)}
        name={`pooled-resident-${slot.slotIndex}-0`}
        handlesRef={refs.bot0}
      />
      <ElderBotRig
        role={m1?.role === 'uncle' ? 'uncle' : 'auntie'}
        outfitIndex={m1?.outfitIndex ?? 0}
        skinIndex={m1?.skinIndex ?? 1}
        hairIndex={m1?.hairIndex ?? 0}
        heightScale={m1?.heightScale ?? 0.93}
        active={isActive && Boolean(m1)}
        name={`pooled-resident-${slot.slotIndex}-1`}
        handlesRef={refs.bot1}
      />

      {/* Reusable Flyweight Kid Rigs (1 girl, 1 boy, or 2 kids: boy + girl) */}
      <KidBotRig
        role={k0?.role === 'girl' ? 'girl' : 'boy'}
        outfitIndex={k0?.outfitIndex ?? 0}
        skinIndex={k0?.skinIndex ?? 0}
        heightScale={k0?.heightScale ?? 0.6}
        active={isActive && Boolean(k0)}
        name={`pooled-kid-${slot.slotIndex}-0`}
        handlesRef={refs.kid0}
      />
      <KidBotRig
        role={k1?.role === 'boy' ? 'boy' : 'girl'}
        outfitIndex={k1?.outfitIndex ?? 1}
        skinIndex={k1?.skinIndex ?? 1}
        heightScale={k1?.heightScale ?? 0.58}
        active={isActive && Boolean(k1)}
        name={`pooled-kid-${slot.slotIndex}-1`}
        handlesRef={refs.kid1}
      />
    </group>
  );
}

/**
 * Global pooled resident bot controller mounted once in StreamedWorld alongside RobotBots.
 * Bounds active residential households (adults + kids) to a small fixed memory pool.
 */
export function HouseResidentBots({
  activeRegions = [],
  minute = 780,
  timeMode = 'auto',
}: {
  activeRegions?: string[];
  minute?: number;
  timeMode?: TimeMode;
}) {
  const preset = useQualityPreset();
  const chunkVersion = useSyncExternalStore(subscribeStreamedChunks, getStreamedChunkVersion);
  const daytimeOutings = isDaytimeLivingHours(minute, timeMode);

  const slotCount =
    mobileQuality || preset.id === 'mobile' || preset.id === 'low'
      ? MAX_SLOTS_MOBILE
      : MAX_SLOTS_DESKTOP;
  const activeRadius =
    mobileQuality || preset.id === 'mobile' || preset.id === 'low'
      ? ACTIVE_RADIUS_MOBILE
      : ACTIVE_RADIUS_DESKTOP;

  const poolRef = useRef<PooledHouseholdSlotState[]>(createHouseholdPool(MAX_SLOTS_DESKTOP));
  const [, setRevision] = useState(0);
  const queryTimerRef = useRef(QUERY_INTERVAL_SEC);

  const slotRefs = useMemo<SlotDomRefs[]>(
    () =>
      Array.from({ length: MAX_SLOTS_DESKTOP }, () => ({
        leftDoor: { current: null },
        rightDoor: { current: null },
        leftGate: { current: null },
        rightGate: { current: null },
        bot0: { current: emptyElderHandles() },
        bot1: { current: emptyElderHandles() },
        kid0: { current: createEmptyKidHandles() },
        kid1: { current: createEmptyKidHandles() },
      })),
    [],
  );

  const activeLookups = useMemo(
    () => activeRegions.map((id) => getRegionHouses(id, chunkVersion).lookup),
    [activeRegions, chunkVersion],
  );

  // Reusable scratch buffer so per-frame household stepping creates zero temporary arrays
  const allMembersScratch = useRef<ResidentState[]>([]);
  const partnersScratch = useRef<ResidentState[]>([]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const pool = poolRef.current;

    // 1. Periodically query nearby houses via spatial index & update sticky pool slots
    queryTimerRef.current += dt;
    if (queryTimerRef.current >= QUERY_INTERVAL_SEC) {
      queryTimerRef.current = 0;
      const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
        x: camera.position.x,
        z: camera.position.z,
      };

      const candidates: ResidentHouseRecord[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < activeLookups.length; i++) {
        const list = activeLookups[i](focus.x, focus.z);
        for (let j = 0; j < list.length; j++) {
          const h = list[j];
          if (seen.has(h.id) || sourceIsEdited(h.id)) continue;
          seen.add(h.id);
          candidates.push(h);
        }
      }

      const activeSlice = pool.slice(0, slotCount);
      let changed = false;
      for (let i = slotCount; i < pool.length; i++) {
        if (pool[i].house) {
          pool[i].house = null;
          pool[i].profile = null;
          pool[i].layout = null;
          pool[i].residents = [];
          pool[i].kids = [];
          pool[i].doorOpen = 0;
          pool[i].gateOpen = 0;
          changed = true;
        }
      }

      if (
        assignResidentPoolSlots(
          activeSlice,
          candidates,
          focus.x,
          focus.z,
          activeRadius,
          activeRadius + 14,
        ) ||
        changed
      ) {
        // When houses load during nighttime, start residents directly inside their houses (not on porch/street)
        if (!daytimeOutings) {
          for (let i = 0; i < slotCount; i++) {
            const slot = pool[i];
            if (!slot.layout) continue;
            for (const member of [...slot.residents, ...slot.kids]) {
              if (member.phase === 'SITTING') {
                member.phase = 'INSIDE_HOUSE';
                member.x = slot.layout.doorInside.x;
                member.z = slot.layout.doorInside.z;
                member.y = slot.layout.floorY(member.z);
                member.sitBlend = 0;
                member.visible = false;
                member.speed = 0;
                member.phaseTimer = 4;
              }
            }
          }
        }
        setRevision((r) => r + 1);
      }
    }

    // 2. Step simulation & update meshes for all active slots (adults + kids coordinated on shared door)
    const allMembers = allMembersScratch.current;
    const partners = partnersScratch.current;

    for (let i = 0; i < slotCount; i++) {
      const slot = pool[i];
      const refs = slotRefs[i];
      if (!slot.house || !slot.layout) {
        applyElderBotPose(refs.bot0.current, null);
        applyElderBotPose(refs.bot1.current, null);
        applyKidBotPose(refs.kid0.current, null);
        applyKidBotPose(refs.kid1.current, null);
        if (refs.leftDoor.current) refs.leftDoor.current.rotation.y = 0;
        if (refs.rightDoor.current) refs.rightDoor.current.rotation.y = 0;
        if (refs.leftGate.current) refs.leftGate.current.rotation.y = 0;
        if (refs.rightGate.current) refs.rightGate.current.rotation.y = 0;
        continue;
      }

      allMembers.length = 0;
      for (let a = 0; a < slot.residents.length; a++) allMembers.push(slot.residents[a]);
      for (let k = 0; k < slot.kids.length; k++) allMembers.push(slot.kids[k]);

      const targetOpen = computeResidentDoorTarget(allMembers, slot.layout);
      slot.doorOpen = stepDoorOpen(slot.doorOpen, targetOpen, dt);

      const targetGate = computeResidentGateTarget(allMembers, slot.layout);
      slot.gateOpen = stepDoorOpen(slot.gateOpen, targetGate, dt);

      for (let m = 0; m < allMembers.length; m++) {
        partners.length = 0;
        for (let p = 0; p < allMembers.length; p++) {
          if (p !== m) partners.push(allMembers[p]);
        }
        const memberState = allMembers[m];
        const isAdult = m < slot.residents.length;
        const botName = isAdult
          ? `pooled-resident-${slot.slotIndex}-${m}`
          : `pooled-kid-${slot.slotIndex}-${m - slot.residents.length}`;
        const chairId = isAdult ? `pooled-chair-${slot.house.id}-${memberState.seatIndex}` : null;
        const blockedByPlayer = chairId ? isChairOccupiedByPlayer(chairId) : false;
        if (isBotInCombat(botName)) {
          memberState.sitBlend = 0;
          memberState.speed = 0;
          memberState.elapsed += dt;
        } else {
          stepResident(memberState, slot.layout, dt, {
            doorOpen: slot.doorOpen,
            gateOpen: slot.gateOpen,
            partners,
            seatBlockedByPlayer: blockedByPlayer,
            daytimeOutings,
            nighttime: !daytimeOutings,
          });
        }
        if (chairId) {
          setChairOccupiedByNpc(
            chairId,
            `pooled-slot-${slot.slotIndex}-${m}`,
            isResidentOccupyingSeat(memberState.phase),
          );
        }
      }

      applyElderBotPose(refs.bot0.current, slot.residents[0] ?? null);
      applyElderBotPose(refs.bot1.current, slot.residents[1] ?? null);
      applyKidBotPose(refs.kid0.current, slot.kids[0] ?? null);
      applyKidBotPose(refs.kid1.current, slot.kids[1] ?? null);

      const swing = slot.doorOpen * 1.42;
      if (refs.leftDoor.current) refs.leftDoor.current.rotation.y = -swing;
      if (refs.rightDoor.current) refs.rightDoor.current.rotation.y = swing;

      const gateSwing = slot.gateOpen * 1.48;
      if (refs.leftGate.current) refs.leftGate.current.rotation.y = -gateSwing;
      if (refs.rightGate.current) refs.rightGate.current.rotation.y = gateSwing;
    }
  });

  return (
    <group name="pooled-house-resident-bots">
      {poolRef.current.slice(0, slotCount).map((slot) => (
        <PooledHouseholdSlotView key={slot.slotIndex} slot={slot} refs={slotRefs[slot.slotIndex]} />
      ))}
    </group>
  );
}
