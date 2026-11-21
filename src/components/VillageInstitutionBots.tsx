import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
import type { TimeMode } from '../game/environmentTime';
import { trafficColliders } from '../game/trafficColliders';
import {
  disengageBotFight,
  getBotCombatReaction,
  getBotFightingState,
  isBotInCombat,
} from '../game/botFighting';
import { applyChinBotCombatPose } from '../game/chinCombatPose';
import { getInstitutionNpcCache } from '../game/institutionNpcAssets';
import {
  InstitutionNpcFixedPoolController,
  institutionRoleToNpcRole,
  type InstitutionNpcMemberState,
} from '../game/institutionNpcPool';

/**
 * ============================================================================
 * LIVE Christian Clergy & Village School Students/Teachers Pool (`<VillageInstitutionBots>`)
 * ============================================================================
 *
 * Mounted directly inside `StreamedWorld.tsx` alongside `HouseResidentBots`,
 * `VillagePedestrianBots`, and `ChinVillageBots`:
 * - Uses strict **Singleton Memory Reference Cache** (`getInstitutionNpcCache()` +
 *   `getWeipulaVillagerCache()`) + **Fixed Object Pool** (`48` desktop / `26` mobile slots).
 * - Populates ALL 8 Christian churches (Catholic Priests & Sisters, Protestant Pastors &
 *   Lady Pastors) and ALL 8 village schools (Myanmar Teachers & Students in white/green uniforms).
 * - Strictly HIDES all school students & teachers during `evening` and `night`!
 * - Reuses existing `trafficColliders`, `botFighting.ts`, and `applyChinBotCombatPose`
 *   with ZERO duplicated fighting logic!
 */

const POOL_DESKTOP = 88;
const POOL_MOBILE = 44;

interface InstitutionSlotRefs {
  root: Group | null;
  body: Group | null;
  head: Group | null;
  headMesh: Mesh | null;
  neckMesh: Mesh | null;
  hairCapMesh: Mesh | null;
  hairBunMesh: Mesh | null;
  veilGroup: Group | null;
  collarMesh: Mesh | null;
  torsoMesh: Mesh | null;
  stoleMesh: Mesh | null;
  crossGroup: Group | null;
  longyiMesh: Mesh | null;
  backpackMesh: Mesh | null;
  bookMesh: Mesh | null;
  leftArm: Group | null;
  leftArmMesh: Mesh | null;
  rightArm: Group | null;
  rightArmMesh: Mesh | null;
  leftLeg: Group | null;
  leftLegMesh: Mesh | null;
  rightLeg: Group | null;
  rightLegMesh: Mesh | null;
  boundKey: string | null;
}

function emptyRefs(): InstitutionSlotRefs {
  return {
    root: null,
    body: null,
    head: null,
    headMesh: null,
    neckMesh: null,
    hairCapMesh: null,
    hairBunMesh: null,
    veilGroup: null,
    collarMesh: null,
    torsoMesh: null,
    stoleMesh: null,
    crossGroup: null,
    longyiMesh: null,
    backpackMesh: null,
    bookMesh: null,
    leftArm: null,
    leftArmMesh: null,
    rightArm: null,
    rightArmMesh: null,
    leftLeg: null,
    leftLegMesh: null,
    rightLeg: null,
    rightLegMesh: null,
    boundKey: null,
  };
}

function bindInstitutionVisuals(refs: InstitutionSlotRefs, m: InstitutionNpcMemberState): void {
  if (refs.boundKey === m.id) return;
  refs.boundKey = m.id;

  const ic = getInstitutionNpcCache();
  const base = ic.base;
  const skinMat = base.skinMats[m.skinIndex % base.skinMats.length];

  const isPriest = m.role === 'catholic-priest';
  const isSister = m.role === 'catholic-sister';
  const isPastorMan = m.role === 'pastor-man';
  const isPastorWoman = m.role === 'pastor-woman';
  const isTeacher = m.role === 'teacher-man' || m.role === 'teacher-woman';
  const isStudent = m.role === 'student-boy' || m.role === 'student-girl';
  const isFemale =
    isSister || isPastorWoman || m.role === 'teacher-woman' || m.role === 'student-girl';

  const topMat = isPriest
    ? ic.cassockBlackMat
    : isSister
      ? ic.sisterHabitMat
      : isPastorMan
        ? ic.cassockBlackMat
        : isPastorWoman
          ? ic.cassockWhiteMat
          : ic.schoolWhiteMat;

  const bottomMat = isPriest
    ? ic.cassockBlackMat
    : isSister
      ? ic.sisterHabitMat
      : isPastorMan
        ? ic.cassockBlackMat
        : isPastorWoman
          ? ic.sisterHabitMat
          : ic.schoolGreenMat;

  if (refs.headMesh) refs.headMesh.material = skinMat;
  if (refs.neckMesh) refs.neckMesh.material = skinMat;
  if (refs.leftLegMesh) refs.leftLegMesh.material = skinMat;
  if (refs.rightLegMesh) refs.rightLegMesh.material = skinMat;

  if (refs.hairCapMesh) {
    refs.hairCapMesh.material = isPriest || isPastorMan ? base.hairSilverMat : base.hairDarkMat;
    refs.hairCapMesh.visible = !isSister;
  }
  if (refs.hairBunMesh) {
    refs.hairBunMesh.material = base.hairDarkMat;
    refs.hairBunMesh.visible = isFemale && !isSister && !isStudent;
  }
  if (refs.veilGroup) refs.veilGroup.visible = isSister;
  if (refs.collarMesh) refs.collarMesh.visible = isPriest || isPastorMan;

  if (refs.torsoMesh) refs.torsoMesh.material = topMat;
  if (refs.leftArmMesh) refs.leftArmMesh.material = topMat;
  if (refs.rightArmMesh) refs.rightArmMesh.material = topMat;
  if (refs.longyiMesh) refs.longyiMesh.material = bottomMat;

  // Clergy ceremonial stole (crimson for Catholic priest, gold for Protestant pastor/lady pastor)
  if (refs.stoleMesh) {
    refs.stoleMesh.visible = isPriest || isPastorMan || isPastorWoman;
    refs.stoleMesh.material = isPriest ? ic.stoleCrimsonMat : ic.stoleGoldMat;
  }
  // Golden pectoral cross for all Christian clergy
  if (refs.crossGroup) {
    refs.crossGroup.visible = isPriest || isSister || isPastorMan || isPastorWoman;
  }
  // Student backpack (for school students) & held Bible / textbook (for clergy & teachers)
  if (refs.backpackMesh) {
    refs.backpackMesh.visible = isStudent;
    refs.backpackMesh.material = ic.studentBackpackMats[m.backpackIndex % ic.studentBackpackMats.length];
  }
  if (refs.bookMesh) {
    refs.bookMesh.visible = !isStudent;
    refs.bookMesh.material = isTeacher ? ic.teacherBagMat : ic.bibleCoverMat;
  }

  if (refs.root) {
    refs.root.scale.set(m.scale, m.scale, m.scale);
    refs.root.userData.npcRole = institutionRoleToNpcRole(m.role);
    refs.root.userData.institutionRole = m.role;
  }
}

function InstitutionSlotView({
  slotIndex,
  refs,
}: {
  slotIndex: number;
  refs: InstitutionSlotRefs;
}) {
  const ic = getInstitutionNpcCache();
  const base = ic.base;
  const localRootRef = useRef<Group>(null);

  useEffect(() => {
    const obj = localRootRef.current;
    if (!obj) return;
    trafficColliders.set(obj, { width: 0.44, depth: 0.44, kind: 'robot' });
    return () => {
      trafficColliders.delete(obj);
    };
  }, []);

  return (
    <group
      name={`institution-npc-${slotIndex}`}
      visible={false}
      userData={{ dynamic: true, npcRole: 'uncle' }}
      ref={el => {
        (localRootRef as { current: Group | null }).current = el;
        refs.root = el;
      }}
    >
      <group
        ref={el => {
          refs.body = el;
        }}
      >
        {/* Head + Hair + Catholic Sister Veil */}
        <group
          position={[0, 1.56, 0]}
          ref={el => {
            refs.head = el;
          }}
        >
          <mesh ref={el => { refs.headMesh = el; }} geometry={base.headGeo} material={base.skinMats[0]} />
          <mesh ref={el => { refs.hairCapMesh = el; }} position={[0, 0.03, -0.01]} geometry={base.hairCapGeo} material={base.hairDarkMat} />
          <mesh ref={el => { refs.hairBunMesh = el; }} position={[0, 0.04, -0.16]} geometry={base.hairBunGeo} material={base.hairDarkMat} visible={false} />
          {/* Catholic Sister Veil & White Wimple Trim */}
          <group
            ref={el => {
              refs.veilGroup = el;
            }}
            visible={false}
          >
            <mesh position={[0, -0.02, -0.05]} geometry={ic.veilGeo} material={ic.sisterHabitMat} />
            <mesh position={[0, 0.08, 0.01]} geometry={ic.wimpleGeo} material={ic.sisterVeilTrimMat} />
          </group>
        </group>

        {/* Neck & White Roman Clerical Collar */}
        <mesh ref={el => { refs.neckMesh = el; }} position={[0, 1.38, 0]} geometry={base.neckGeo} material={base.skinMats[0]} />
        <mesh
          ref={el => {
            refs.collarMesh = el;
          }}
          position={[0, 1.36, 0]}
          geometry={ic.collarGeo}
          material={ic.clericalCollarMat}
          visible={false}
        />

        {/* Torso + Clergy Stole + Pectoral Cross + Student Backpack */}
        <mesh ref={el => { refs.torsoMesh = el; }} position={[0, 1.11, 0]} geometry={base.torsoGeo} material={ic.schoolWhiteMat} />
        <mesh
          ref={el => {
            refs.stoleMesh = el;
          }}
          position={[0, 1.12, 0]}
          rotation={[0, 0, 0.36]}
          geometry={base.sashGeo}
          material={ic.stoleGoldMat}
          visible={false}
        />
        <group
          position={[0, 1.16, 0.178]}
          ref={el => {
            refs.crossGroup = el;
          }}
          visible={false}
        >
          <mesh geometry={ic.crossVGeo} material={ic.crossGoldMat} />
          <mesh position={[0, 0.03, 0]} geometry={ic.crossHGeo} material={ic.crossGoldMat} />
        </group>
        <mesh
          ref={el => {
            refs.backpackMesh = el;
          }}
          position={[0, 1.1, -0.19]}
          geometry={ic.backpackGeo}
          material={ic.studentBackpackMats[0]}
          visible={false}
        />

        {/* Lower Robe / Myanmar School Green Longyi */}
        <mesh ref={el => { refs.longyiMesh = el; }} position={[0, 0.56, 0]} geometry={base.longyiGeo} material={ic.schoolGreenMat} />

        {/* Left Arm */}
        <group position={[-0.23, 1.3, 0]} ref={el => { refs.leftArm = el; }}>
          <mesh ref={el => { refs.leftArmMesh = el; }} position={[0, -0.22, 0]} geometry={base.armGeo} material={ic.schoolWhiteMat} />
        </group>

        {/* Right Arm (+ Held Holy Bible for Clergy OR Textbook for Teachers) */}
        <group position={[0.23, 1.3, 0]} ref={el => { refs.rightArm = el; }}>
          <mesh ref={el => { refs.rightArmMesh = el; }} position={[0, -0.22, 0]} geometry={base.armGeo} material={ic.schoolWhiteMat} />
          <mesh
            ref={el => {
              refs.bookMesh = el;
            }}
            position={[0.04, -0.42, 0.07]}
            geometry={ic.bibleGeo}
            material={ic.bibleCoverMat}
            visible={false}
          />
        </group>

        {/* Left & Right Legs */}
        <group position={[-0.085, 0.54, 0]} ref={el => { refs.leftLeg = el; }}>
          <mesh ref={el => { refs.leftLegMesh = el; }} position={[0, -0.26, 0]} geometry={base.legGeo} material={base.skinMats[0]} />
          <mesh position={[0, -0.5, 0.04]} geometry={base.shoeGeo} material={base.shoeDarkMat} />
        </group>
        <group position={[0.085, 0.54, 0]} ref={el => { refs.rightLeg = el; }}>
          <mesh ref={el => { refs.rightLegMesh = el; }} position={[0, -0.26, 0]} geometry={base.legGeo} material={base.skinMats[0]} />
          <mesh position={[0, -0.5, 0.04]} geometry={base.shoeGeo} material={base.shoeDarkMat} />
        </group>
      </group>
    </group>
  );
}

export function VillageInstitutionBots({
  activeRegions = [],
  minute = 780,
  timeMode = 'auto',
}: {
  activeRegions?: string[];
  minute?: number;
  timeMode?: TimeMode;
}) {
  const preset = useQualityPreset();
  const isLowQuality = mobileQuality || preset.id === 'mobile' || preset.id === 'low';
  const capacity = isLowQuality ? POOL_MOBILE : POOL_DESKTOP;

  const controller = useMemo(
    () => new InstitutionNpcFixedPoolController(capacity, isLowQuality ? 125 : 185),
    [capacity, isLowQuality],
  );
  const slotRefsList = useMemo(
    () => Array.from({ length: capacity }, () => emptyRefs()),
    [capacity],
  );

  useEffect(() => {
    return () => {
      controller.dispose();
    };
  }, [controller]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };

    const { schoolOpen, churchOpen } = controller.update(
      focus.x,
      focus.z,
      dt,
      activeRegions,
      minute,
      timeMode,
      false,
      slotIdx => isBotInCombat(`institution-npc-${slotIdx}`),
    );

    // If evening/night closes schools or night closes churches while engaged with a hidden institution NPC, disengage cleanly
    const bf = getBotFightingState();
    if (bf.active && bf.targetBotId && bf.targetBotId.startsWith('institution-npc-')) {
      const idx = Number(bf.targetBotId.slice('institution-npc-'.length));
      const m = Number.isInteger(idx) ? controller.slots[idx]?.member : null;
      if (!m || (m.institutionKind === 'school' && !schoolOpen) || (m.institutionKind === 'church' && !churchOpen)) {
        disengageBotFight();
      }
    }

    for (let i = 0; i < controller.slots.length; i++) {
      const m = controller.slots[i].member;
      const refs = slotRefsList[i];
      if (!refs || !refs.root) continue;

      if (!m) {
        refs.root.visible = false;
        continue;
      }

      bindInstitutionVisuals(refs, m);
      const botId = `institution-npc-${i}`;

      if (applyChinBotCombatPose(refs, botId, m.worldY)) {
        const combat = getBotCombatReaction(botId);
        if (combat && combat.hasWorldPos) {
          m.worldX = combat.worldX;
          m.worldZ = combat.worldZ;
        }
        continue;
      }

      refs.root.visible = true;
      const walkFactor = Math.min(1, m.speed / 0.65);
      const stride = m.walkDist * 4.6;
      const bounce = Math.abs(Math.sin(stride)) * 0.03 * walkFactor;

      refs.root.position.set(m.worldX, m.worldY + bounce, m.worldZ);
      refs.root.rotation.y = m.yaw;

      if (refs.head) {
        refs.head.rotation.y =
          Math.sin(m.elapsed * 0.85 + m.phaseOffset) * 0.24 * (1 - walkFactor * 0.6);
        refs.head.rotation.x = Math.sin(m.elapsed * 1.4 + m.phaseOffset) * 0.04;
      }
      const armSwing = Math.sin(stride) * 0.45 * walkFactor;
      if (refs.leftArm) {
        refs.leftArm.rotation.x = -armSwing;
        refs.leftArm.rotation.z = 0.08;
      }
      if (refs.rightArm) {
        // Clergy & teachers hold their Bible/book steadier than students swinging both arms
        const carryFactor = m.role === 'student-boy' || m.role === 'student-girl' ? 1.0 : 0.3;
        refs.rightArm.rotation.x = armSwing * carryFactor;
        refs.rightArm.rotation.z = -0.08;
      }
      const legSwing = Math.sin(stride) * 0.36 * walkFactor;
      if (refs.leftLeg) refs.leftLeg.rotation.x = legSwing;
      if (refs.rightLeg) refs.rightLeg.rotation.x = -legSwing;
    }
  });

  return (
    <group name="village-institution-bots" userData={{ dynamic: true }}>
      {slotRefsList.map((refs, idx) => (
        <InstitutionSlotView key={`inst-slot-${idx}`} slotIndex={idx} refs={refs} />
      ))}
    </group>
  );
}
