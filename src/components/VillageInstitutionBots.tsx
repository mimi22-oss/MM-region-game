import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Quaternion, Vector3, type Group, type Mesh } from 'three';
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
import {
  applyBotAvoidanceStep,
  removeAvoidanceActor,
  upsertAvoidanceActor,
} from '../game/botAvoidance';
import { getInstitutionNpcCache } from '../game/institutionNpcAssets';
import { SCHOOL_BACKPACK_POSITION } from '../game/schoolBackpack';
import { npcCalfGeometry, npcFaceGeometry, npcFaceMaterial, npcHandGeometry } from '../game/npcAnatomy';
import { STUDENT_DESK, setSchoolClassInSession } from '../game/schoolClassrooms';
import {
  NOTEBOOK_DEPTH, NOTEBOOK_PAGE_Y, PEN_NIB,
  schoolNotebookGeometry, schoolPenGeometry, schoolSuppliesMaterial, schoolWritingHandGeometry,
} from '../game/schoolStudentSupplies';
import {
  SCHOOL_NPC_ELBOW_Y, SCHOOL_NPC_HIP_Y, SCHOOL_NPC_KNEE_Y, SCHOOL_NPC_SHOE_Y, SCHOOL_NPC_WRIST_Y,
  schoolCollarGeometry, schoolForearmGeometry, schoolSeatedSkirtGeometry, schoolShirtGeometry, schoolShortSleeveGeometry,
  schoolShortsGeometry, schoolThighGeometry, schoolUniforms, schoolUpperArmGeometry,
} from '../game/schoolNpcUniform';
import {
  InstitutionNpcFixedPoolController,
  institutionRoleToNpcRole,
  type InstitutionNpcMemberState,
} from '../game/institutionNpcPool';
import { CHALK_LINE_COUNT } from '../game/schoolSchedule';

const POOL_DESKTOP = 144;
const POOL_MOBILE = 68;
const BOARD_POOL_DESKTOP = 32;
const BOARD_POOL_MOBILE = 16;
const SIDES = [-1, 1] as const;
const BENCH_TOP_Y = 0.47;
const NOTEBOOK_Z = STUDENT_DESK.benchOffset - STUDENT_DESK.depth / 2 + NOTEBOOK_DEPTH / 2 + .027;

interface ChalkboardOverlayRefs {
  root: Group | null;
  lines: (Mesh | null)[];
}

function emptyBoardRefs(): ChalkboardOverlayRefs {
  return {
    root: null,
    lines: Array.from({ length: CHALK_LINE_COUNT }, () => null),
  };
}

interface LimbRefs {
  sleeve: Mesh | null;
  upperArm: Mesh | null;
  elbow: Group | null;
  forearm: Mesh | null;
  wrist: Group | null;
  hand: Mesh | null;
  thigh: Mesh | null;
  shorts: Mesh | null;
  knee: Group | null;
  calf: Mesh | null;
}

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
  schoolCollar: Mesh | null;
  stoleMesh: Mesh | null;
  crossGroup: Group | null;
  longyiMesh: Mesh | null;
  backpackMesh: Mesh | null;
  bookMesh: Mesh | null;
  notebook: Mesh | null;
  pen: Mesh | null;
  chalkMesh: Mesh | null;
  dusterMesh: Mesh | null;
  leftArm: Group | null;
  rightArm: Group | null;
  leftLeg: Group | null;
  rightLeg: Group | null;
  limbs: LimbRefs[];
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
    schoolCollar: null,
    stoleMesh: null,
    crossGroup: null,
    longyiMesh: null,
    backpackMesh: null,
    bookMesh: null,
    notebook: null,
    pen: null,
    chalkMesh: null,
    dusterMesh: null,
    leftArm: null,
    rightArm: null,
    leftLeg: null,
    rightLeg: null,
    limbs: SIDES.map(() => ({
      sleeve: null, upperArm: null, elbow: null, forearm: null, wrist: null, hand: null,
      thigh: null, shorts: null, knee: null, calf: null,
    })),
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
  const uniform = m.role in schoolUniforms ? schoolUniforms[m.role as keyof typeof schoolUniforms] : null;
  const width = uniform?.width ?? 1;

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
  if (refs.head) refs.head.scale.setScalar(uniform?.headSize ?? 1);

  if (refs.hairCapMesh) {
    refs.hairCapMesh.material = isPriest || isPastorMan ? base.hairSilverMat : base.hairDarkMat;
    refs.hairCapMesh.geometry = uniform?.hair ?? base.hairCapGeo;
    refs.hairCapMesh.visible = !isSister;
  }
  if (refs.hairBunMesh) {
    refs.hairBunMesh.material = base.hairDarkMat;
    refs.hairBunMesh.visible = isPastorWoman;
  }
  if (refs.veilGroup) refs.veilGroup.visible = isSister;
  if (refs.collarMesh) refs.collarMesh.visible = isPriest || isPastorMan;

  if (refs.torsoMesh) {
    refs.torsoMesh.geometry = uniform ? schoolShirtGeometry : base.torsoGeo;
    refs.torsoMesh.material = topMat;
    refs.torsoMesh.scale.x = width;
  }
  if (refs.schoolCollar) {
    refs.schoolCollar.visible = Boolean(uniform);
    refs.schoolCollar.scale.x = width;
  }
  if (refs.longyiMesh) {
    refs.longyiMesh.geometry = uniform?.bottoms ?? base.longyiGeo;
    refs.longyiMesh.material = bottomMat;
    refs.longyiMesh.position.y = uniform ? SCHOOL_NPC_HIP_Y : .56;
    refs.longyiMesh.scale.x = width;
  }

  if (refs.leftArm) refs.leftArm.position.x = -.212 * width;
  if (refs.rightArm) refs.rightArm.position.x = .212 * width;
  for (const limb of refs.limbs) {
    if (limb.sleeve) {
      limb.sleeve.material = topMat;
      limb.sleeve.scale.y = uniform ? 1 : 1.25;
    }
    if (limb.upperArm) {
      limb.upperArm.material = skinMat;
      limb.upperArm.visible = Boolean(uniform);
    }
    if (limb.forearm) {
      limb.forearm.material = uniform ? skinMat : topMat;
      limb.forearm.scale.set(uniform ? 1 : 1.23, 1, uniform ? 1 : 1.23);
    }
    if (limb.hand) limb.hand.material = skinMat;
    if (limb.thigh) {
      limb.thigh.material = skinMat;
      limb.thigh.visible = m.role === 'student-boy';
    }
    if (limb.calf) limb.calf.material = skinMat;
    if (limb.shorts) limb.shorts.visible = m.role === 'student-boy';
  }

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
    refs.backpackMesh.scale.x = width / schoolUniforms['student-boy'].width;
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

function bendLimbs(refs: InstitutionSlotRefs, leftElbow: number, rightElbow: number, leftKnee = 0, rightKnee = 0) {
  const [left, right] = refs.limbs;
  if (left.elbow) left.elbow.rotation.set(leftElbow, 0, 0);
  if (right.elbow) right.elbow.rotation.set(rightElbow, 0, 0);
  if (left.knee) left.knee.rotation.x = leftKnee;
  if (right.knee) right.knee.rotation.x = rightKnee;
}

const down = new Vector3(0, -1, 0);
const writingWrist = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const nibFromWrist = new Vector3(...PEN_NIB).applyQuaternion(writingWrist);
const wristTarget = new Vector3();
const reachDirection = new Vector3();
const elbowOut = new Vector3();
const upperDirection = new Vector3();
const forearmDirection = new Vector3();
const inverseShoulder = new Quaternion();

function reachStudentDesk(shoulder: Group | null, limb: LimbRefs, side: number, target: Vector3) {
  if (!shoulder || !limb.elbow || !limb.wrist) return;
  const upperLength = -SCHOOL_NPC_ELBOW_Y;
  const forearmLength = -SCHOOL_NPC_WRIST_Y;
  reachDirection.subVectors(target, shoulder.position);
  const distance = Math.min(reachDirection.length(), upperLength + forearmLength - .0005);
  reachDirection.normalize();
  const along = (upperLength ** 2 - forearmLength ** 2 + distance ** 2) / (2 * distance);
  const bend = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));

  // Keep the elbows outside the book while the wrists follow the desktop.
  elbowOut.set(side, -.24, 0);
  elbowOut.addScaledVector(reachDirection, -elbowOut.dot(reachDirection)).normalize();
  upperDirection.copy(reachDirection).multiplyScalar(along).addScaledVector(elbowOut, bend);
  forearmDirection.copy(reachDirection).multiplyScalar(distance).sub(upperDirection).normalize();
  shoulder.quaternion.setFromUnitVectors(down, upperDirection.normalize());
  inverseShoulder.copy(shoulder.quaternion).invert();
  limb.elbow.quaternion.setFromUnitVectors(down, forearmDirection.applyQuaternion(inverseShoulder));
  limb.wrist.quaternion.copy(shoulder.quaternion).multiply(limb.elbow.quaternion).invert().multiply(writingWrist);
}

function updateStudentSupplies(refs: InstitutionSlotRefs, seated: boolean) {
  if (!refs.notebook || refs.notebook.visible === seated) return;
  refs.notebook.visible = seated;
  if (refs.pen) refs.pen.visible = seated;
  const [left, right] = refs.limbs;
  if (right.hand) right.hand.geometry = seated ? schoolWritingHandGeometry : npcHandGeometry;
  if (!seated) {
    left.wrist?.quaternion.identity();
    right.wrist?.quaternion.identity();
  }
}

function poseStudentAtDesk(refs: InstitutionSlotRefs, member: InstitutionNpcMemberState, copying: boolean) {
  const unitsPerMetre = 1 / member.scale;
  if (refs.notebook) {
    refs.notebook.position.set(0, STUDENT_DESK.topY * unitsPerMetre, NOTEBOOK_Z * unitsPerMetre);
    refs.notebook.scale.setScalar(unitsPerMetre);
  }
  const t = member.elapsed + member.phaseOffset;
  const strokeX = copying ? Math.sin(t * 5.2) * .023 : 0;
  const strokeZ = copying ? Math.sin(t * 2.1) * .021 + Math.sin(t * 14) * .006 : 0;
  const pageY = (STUDENT_DESK.topY + NOTEBOOK_PAGE_Y) * unitsPerMetre - (refs.body?.position.y ?? 0);
  const [left, right] = refs.limbs;
  wristTarget.set(-.074 * unitsPerMetre, pageY + .014 * unitsPerMetre, (NOTEBOOK_Z - .065) * unitsPerMetre);
  reachStudentDesk(refs.leftArm, left, -1, wristTarget);
  wristTarget.set(
    (.054 + strokeX) * unitsPerMetre,
    pageY + (copying ? .0006 : .022) * unitsPerMetre,
    (NOTEBOOK_Z + strokeZ) * unitsPerMetre,
  ).sub(nibFromWrist);
  reachStudentDesk(refs.rightArm, right, 1, wristTarget);
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
      <mesh
        name="student-desk-notebook"
        ref={el => { refs.notebook = el; }}
        visible={false}
        geometry={schoolNotebookGeometry}
        material={schoolSuppliesMaterial}
      />
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
          <mesh geometry={npcFaceGeometry} material={npcFaceMaterial} />
          <mesh ref={el => { refs.hairCapMesh = el; }} geometry={base.hairCapGeo} material={base.hairDarkMat} />
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
        <mesh ref={el => { refs.schoolCollar = el; }} position={[0, 1.11, .014]} geometry={schoolCollarGeometry} material={ic.schoolWhiteMat} visible={false} />
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
          position={SCHOOL_BACKPACK_POSITION}
          geometry={ic.backpackGeo}
          material={ic.studentBackpackMats[0]}
          visible={false}
        />

        {/* Lower Robe / Myanmar School Green Longyi */}
        <mesh ref={el => { refs.longyiMesh = el; }} position={[0, 0.56, 0]} geometry={base.longyiGeo} material={ic.schoolGreenMat} />

        {SIDES.map((side, index) => {
          const limb = refs.limbs[index];
          return (
            <group key={side}>
              <group
                position={[side * .212, 1.3, 0]}
                ref={el => {
                  if (side < 0) refs.leftArm = el;
                  else refs.rightArm = el;
                }}
              >
                <mesh ref={el => { limb.sleeve = el; }} geometry={schoolShortSleeveGeometry} material={ic.schoolWhiteMat} />
                <mesh ref={el => { limb.upperArm = el; }} geometry={schoolUpperArmGeometry} material={base.skinMats[0]} />
                <group ref={el => { limb.elbow = el; }} position={[0, SCHOOL_NPC_ELBOW_Y, 0]}>
                  <mesh ref={el => { limb.forearm = el; }} geometry={schoolForearmGeometry} material={base.skinMats[0]} />
                  <group ref={el => { limb.wrist = el; }} position={[0, SCHOOL_NPC_WRIST_Y, 0]}>
                    <mesh
                      ref={el => { limb.hand = el; }}
                      geometry={npcHandGeometry}
                      material={base.skinMats[0]}
                      scale={[-side, 1, 1]}
                    />
                    {side > 0 && (
                      <>
                        <mesh
                          name="student-writing-pen"
                          ref={el => { refs.pen = el; }}
                          visible={false}
                          geometry={schoolPenGeometry}
                          material={schoolSuppliesMaterial}
                        />
                        <mesh
                          ref={el => { refs.bookMesh = el; }}
                          position={[.016, -.077, .035]}
                          rotation={[-.14, 0, .12]}
                          geometry={ic.bibleGeo}
                          material={ic.bibleCoverMat}
                          visible={false}
                        />
                        <mesh
                          ref={el => { refs.chalkMesh = el; }}
                          position={[-.028, -.048, .028]}
                          rotation={[Math.PI / 2, 0, 0]}
                          scale={[.6, .64, .6]}
                          geometry={ic.chalkStickGeo}
                          material={ic.chalkWhiteMat}
                          visible={false}
                        />
                        <mesh
                          ref={el => { refs.dusterMesh = el; }}
                          position={[0, -.042, .034]}
                          scale={[.82, .85, .76]}
                          geometry={ic.dusterGeo}
                          material={ic.dusterWoodMat}
                          visible={false}
                        />
                      </>
                    )}
                  </group>
                </group>
              </group>

              <group
                position={[side * .084, SCHOOL_NPC_HIP_Y, 0]}
                ref={el => {
                  if (side < 0) refs.leftLeg = el;
                  else refs.rightLeg = el;
                }}
              >
                <mesh ref={el => { limb.thigh = el; }} geometry={schoolThighGeometry} material={base.skinMats[0]} />
                <mesh ref={el => { limb.shorts = el; }} geometry={schoolShortsGeometry} material={ic.schoolGreenMat} visible={false} />
                <group ref={el => { limb.knee = el; }} position={[0, SCHOOL_NPC_KNEE_Y, 0]}>
                  <mesh ref={el => { limb.calf = el; }} scale={[1.05, 1.4, 1.05]} geometry={npcCalfGeometry} material={base.skinMats[0]} />
                  <mesh position={[0, SCHOOL_NPC_SHOE_Y, 0]} rotation-y={side * .07} geometry={base.shoeGeo} material={base.shoeDarkMat} />
                </group>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

/**
 * Reusable Fixed-Pool Live Animated Chalkboard Overlay Slot.
 * Mounts flush on each nearby classroom's green blackboard using ONLY Singleton
 * `getInstitutionNpcCache().chalkLineUnitGeo` + `chalkWhiteMat` (ZERO per-frame allocations!).
 */
function LiveChalkboardOverlaySlotView({
  slotIndex,
  refs,
}: {
  slotIndex: number;
  refs: ChalkboardOverlayRefs;
}) {
  const ic = getInstitutionNpcCache();
  return (
    <group
      name={`live-chalkboard-slot-${slotIndex}`}
      visible={false}
      userData={{ dynamic: true }}
      ref={el => {
        refs.root = el;
      }}
    >
      {Array.from({ length: CHALK_LINE_COUNT }, (_, li) => (
        <mesh
          key={`chalk-line-${li}`}
          visible={false}
          geometry={ic.chalkLineUnitGeo}
          material={ic.chalkWhiteMat}
          ref={el => {
            refs.lines[li] = el;
          }}
        />
      ))}
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
  const boardCapacity = isLowQuality ? BOARD_POOL_MOBILE : BOARD_POOL_DESKTOP;

  const controller = useMemo(
    () =>
      new InstitutionNpcFixedPoolController(
        capacity,
        isLowQuality ? 125 : 185,
        undefined,
        boardCapacity,
      ),
    [capacity, isLowQuality, boardCapacity],
  );
  const slotRefsList = useMemo(
    () => Array.from({ length: capacity }, () => emptyRefs()),
    [capacity],
  );
  const boardSlotRefsList = useMemo(
    () => Array.from({ length: boardCapacity }, () => emptyBoardRefs()),
    [boardCapacity],
  );

  useEffect(() => {
    return () => {
      setSchoolClassInSession(false);
      controller.dispose();
      for (let i = 0; i < POOL_DESKTOP; i++) removeAvoidanceActor(`institution-npc-${i}`);
    };
  }, [controller]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };

    const { schoolOpen, churchOpen, schoolPeriod } = controller.update(
      focus.x,
      focus.z,
      dt,
      activeRegions,
      minute,
      timeMode,
      false,
      slotIdx => isBotInCombat(`institution-npc-${slotIdx}`),
    );
    setSchoolClassInSession(schoolPeriod === 'class');

    // If evening/night closes non-dorm school NPCs or night closes churches while engaged with a hidden NPC, disengage cleanly
    const bf = getBotFightingState();
    if (bf.active && bf.targetBotId && bf.targetBotId.startsWith('institution-npc-')) {
      const idx = Number(bf.targetBotId.slice('institution-npc-'.length));
      const m = Number.isInteger(idx) ? controller.slots[idx]?.member : null;
      if (
        !m ||
        (m.institutionKind === 'school' && !schoolOpen) ||
        (m.institutionKind === 'church' && !churchOpen)
      ) {
        disengageBotFight();
      }
    }

    // 1. Sync Live Animated Chalkboard Overlays (writing line-by-line -> full -> erasing clean!)
    for (let bi = 0; bi < controller.boardSlots.length; bi++) {
      const bs = controller.boardSlots[bi];
      const bRefs = boardSlotRefsList[bi];
      if (!bRefs || !bRefs.root) continue;

      if (!bs.anchor || !bs.lesson || bs.lesson.boardFullness <= 0.005) {
        bRefs.root.visible = false;
        continue;
      }

      const ba = bs.anchor;
      const lesson = bs.lesson;
      bRefs.root.visible = true;
      bRefs.root.position.set(ba.boardWorldX, ba.boardWorldY, ba.boardWorldZ);
      bRefs.root.rotation.set(0, ba.rotation, 0);

      const usableW = ba.boardWidth * 0.86;
      const usableH = ba.boardHeight * 0.78;
      for (let li = 0; li < CHALK_LINE_COUNT; li++) {
        const lineMesh = bRefs.lines[li];
        if (!lineMesh) continue;
        const fill = lesson.lineFill[li] ?? 0;
        const erasedLeft = lesson.lineErasedLeft[li] ?? 0;
        if (fill <= 0.01) {
          lineMesh.visible = false;
          continue;
        }
        const segW = usableW * fill;
        const leftEdge = -usableW / 2 + usableW * erasedLeft;
        const yOff = usableH / 2 - (li / (CHALK_LINE_COUNT - 1)) * usableH;
        lineMesh.visible = true;
        lineMesh.position.set(leftEdge + segW / 2, yOff, 0);
        lineMesh.scale.set(segW, 1, 1);
      }
    }

    // 2. Sync Clergy, Teachers (writing/waiting/erasing at blackboard), and Students (copying/playing/lunch)
    for (let i = 0; i < controller.slots.length; i++) {
      const m = controller.slots[i].member;
      const refs = slotRefsList[i];
      if (!refs || !refs.root) continue;

      const botId = `institution-npc-${i}`;
      if (!m) {
        refs.root.visible = false;
        updateStudentSupplies(refs, false);
        removeAvoidanceActor(botId);
        continue;
      }

      const wasRebound = refs.boundKey !== m.id;
      bindInstitutionVisuals(refs, m);
      if (
        wasRebound ||
        !refs.root.visible ||
        Math.hypot(m.worldX - refs.root.position.x, m.worldZ - refs.root.position.z) > 2.5
      ) {
        refs.root.position.set(m.worldX, m.worldY, m.worldZ);
      }

      if (applyChinBotCombatPose(refs, botId, m.worldY)) {
        updateStudentSupplies(refs, false);
        if (refs.body) refs.body.position.y = 0;
        bendLimbs(refs, -.12, -.12);
        if (refs.longyiMesh && m.role === 'student-girl') refs.longyiMesh.geometry = schoolUniforms['student-girl'].bottoms;
        if (refs.chalkMesh) refs.chalkMesh.visible = false;
        if (refs.dusterMesh) refs.dusterMesh.visible = false;
        const combat = getBotCombatReaction(botId);
        if (combat && combat.hasWorldPos) {
          m.worldX = combat.worldX;
          m.worldZ = combat.worldZ;
        }
        upsertAvoidanceActor(botId, 'human', m.worldX, m.worldZ, m.yaw, 0.44);
        continue;
      }

      refs.root.visible = true;
      const act = m.classActivity;
      const isTeacherWriting = act === 'teaching-write';
      const isTeacherErasing = act === 'teaching-erase';
      const isTeacherSeatedRest = act === 'teaching-sit-rest' && m.seated;
      const isTeacherWaiting = act === 'teaching-wait' || act === 'teaching-explain';
      const isStudentSeated = m.seated && act === 'student-copy';
      updateStudentSupplies(refs, isStudentSeated);
      const isStudentRole = m.role === 'student-boy' || m.role === 'student-girl';
      const npcRadius = isStudentRole ? 0.38 : 0.46;

      if (isStudentSeated || isTeacherSeatedRest || isTeacherWriting || isTeacherErasing || isTeacherWaiting) {
        upsertAvoidanceActor(botId, 'human', m.worldX, m.worldZ, m.yaw, npcRadius, {
          stationary: true,
        });
      } else {
        const prevIX = refs.root.position.x || m.worldX;
        const prevIZ = refs.root.position.z || m.worldZ;
        const iAvoid = applyBotAvoidanceStep(
          botId,
          'human',
          prevIX,
          prevIZ,
          m.worldX,
          m.worldZ,
          m.yaw,
          npcRadius,
          dt,
        );
        m.worldX = iAvoid.x;
        m.worldZ = iAvoid.z;
        m.yaw = iAvoid.yaw;
        upsertAvoidanceActor(botId, 'human', m.worldX, m.worldZ, m.yaw, npcRadius, {
          speed: m.speed,
        });
      }
      if (refs.longyiMesh && m.role === 'student-girl') {
        refs.longyiMesh.geometry = isStudentSeated ? schoolSeatedSkirtGeometry : schoolUniforms['student-girl'].bottoms;
      }

      // Toggle teacher right-hand props: white chalk while writing, wooden duster while erasing, book otherwise
      if (refs.chalkMesh) refs.chalkMesh.visible = isTeacherWriting;
      if (refs.dusterMesh) refs.dusterMesh.visible = isTeacherErasing;
      if (refs.bookMesh) {
        const isStudent = m.role === 'student-boy' || m.role === 'student-girl';
        refs.bookMesh.visible = !isStudent && !isTeacherWriting && !isTeacherErasing;
      }

      if (isStudentSeated) {
        // Seated neatly on wooden classroom bench behind desk, looking up at blackboard & writing notes!
        refs.root.position.set(m.worldX, m.worldY, m.worldZ);
        refs.root.rotation.y = m.yaw;
        if (refs.body) refs.body.position.y = BENCH_TOP_Y / m.scale + .058 - SCHOOL_NPC_HIP_Y;
        if (refs.leftLeg) refs.leftLeg.rotation.set(-1.43, 0, 0);
        if (refs.rightLeg) refs.rightLeg.rotation.set(-1.43, 0, 0);

        const copyingNow = m.lessonPhase === 'writing' || m.lessonPhase === 'waiting-copy';
        bendLimbs(refs, 0, 0, 1.43, 1.43);
        poseStudentAtDesk(refs, m, copyingNow);
        const glanceCycle = Math.sin(m.elapsed * 0.9 + m.phaseOffset);
        if (refs.head) {
          // Alternate looking up at blackboard (-0.06) and looking down at exercise book (+0.32) while copying
          refs.head.rotation.x = copyingNow ? (glanceCycle > 0.45 ? -0.06 : 0.3) : -0.04;
          refs.head.rotation.y = Math.sin(m.elapsed * 0.5 + m.phaseOffset) * 0.08;
        }
        continue;
      }

      if (isTeacherSeatedRest) {
        // Teacher sits resting on the wooden chair behind their stacked-book desk, turning head smoothly watching all students!
        refs.root.position.set(m.worldX, m.worldY, m.worldZ);
        refs.root.rotation.y = m.yaw;
        if (refs.body) refs.body.position.y = BENCH_TOP_Y / m.scale + 0.058 - SCHOOL_NPC_HIP_Y;
        if (refs.leftLeg) refs.leftLeg.rotation.set(-1.43, 0, 0);
        if (refs.rightLeg) refs.rightLeg.rotation.set(-1.43, 0, 0);
        bendLimbs(refs, -0.58, -0.54, 1.43, 1.43);
        if (refs.leftArm) {
          refs.leftArm.rotation.set(-0.56, 0, 0.14);
        }
        if (refs.rightArm) {
          refs.rightArm.rotation.set(-0.52, 0, -0.14);
        }
        if (refs.head) {
          // Turn head smoothly side-to-side observing students across left, center, and right rows
          refs.head.rotation.y = Math.sin(m.elapsed * 0.95 + m.phaseOffset) * 0.62;
          refs.head.rotation.x = 0.06 + Math.sin(m.elapsed * 0.45 + m.phaseOffset) * 0.04;
        }
        continue;
      }

      if (refs.body) refs.body.position.y = 0;
      if (refs.leftLeg) refs.leftLeg.rotation.z = 0;
      if (refs.rightLeg) refs.rightLeg.rotation.z = 0;

      if (isTeacherWriting) {
        bendLimbs(refs, -.18, -.14 - m.lessonCursorY * .08);
        // Teacher facing green blackboard, right arm raised high writing white chalk strokes!
        refs.root.position.set(m.worldX, m.worldY, m.worldZ);
        refs.root.rotation.y = m.yaw;
        if (refs.head) {
          refs.head.rotation.x = -0.18 - m.lessonCursorY * 0.35;
          refs.head.rotation.y = Math.sin(m.elapsed * 2.2) * 0.12;
        }
        if (refs.leftArm) {
          refs.leftArm.rotation.x = -0.55;
          refs.leftArm.rotation.z = 0.12;
        }
        if (refs.rightArm) {
          refs.rightArm.rotation.x =
            -2.05 - m.lessonCursorY * 0.55 + Math.sin(m.elapsed * 12.5) * 0.1;
          refs.rightArm.rotation.z = -0.16 + Math.cos(m.elapsed * 9.5) * 0.12;
        }
        if (refs.leftLeg) refs.leftLeg.rotation.x = Math.sin(m.elapsed * 2.4) * 0.08;
        if (refs.rightLeg) refs.rightLeg.rotation.x = -Math.sin(m.elapsed * 2.4) * 0.08;
        continue;
      }

      if (isTeacherErasing) {
        bendLimbs(refs, -.14, -.18);
        // Teacher facing full blackboard, sweeping right hand with wooden duster (`ဘုတ်ဖျက်`) to erase chalk!
        refs.root.position.set(m.worldX, m.worldY, m.worldZ);
        refs.root.rotation.y = m.yaw;
        if (refs.head) {
          refs.head.rotation.x = -0.12 - m.lessonCursorY * 0.3;
          refs.head.rotation.y = Math.sin(m.elapsed * 4.0) * 0.16;
        }
        if (refs.leftArm) {
          refs.leftArm.rotation.x = -0.35;
          refs.leftArm.rotation.z = 0.14;
        }
        if (refs.rightArm) {
          refs.rightArm.rotation.x =
            -1.95 - m.lessonCursorY * 0.5 + Math.sin(m.elapsed * 11.0) * 0.24;
          refs.rightArm.rotation.z = -0.25 + Math.cos(m.elapsed * 11.0) * 0.36;
        }
        if (refs.leftLeg) refs.leftLeg.rotation.x = Math.sin(m.elapsed * 3.0) * 0.1;
        if (refs.rightLeg) refs.rightLeg.rotation.x = -Math.sin(m.elapsed * 3.0) * 0.1;
        continue;
      }

      if (isTeacherWaiting) {
        // Teacher standing/explaining OR walking smoothly between blackboard and desk chair!
        const walkF = Math.min(1, m.speed / 0.55);
        const tStride = m.walkDist * 4.6;
        const tBounce = Math.abs(Math.sin(tStride)) * 0.025 * walkF;
        refs.root.position.set(m.worldX, m.worldY + tBounce, m.worldZ);
        refs.root.rotation.y = m.yaw;
        if (refs.head) {
          refs.head.rotation.y = Math.sin(m.elapsed * 0.75 + m.phaseOffset) * 0.36 * (1 - walkF * 0.5);
          refs.head.rotation.x = 0.06;
        }
        const explainGesture = act === 'teaching-explain' ? Math.sin(m.elapsed * 4.2) * 0.28 : 0.05;
        const armWalk = Math.sin(tStride) * 0.38 * walkF;
        const legWalk = Math.sin(tStride) * 0.22 * walkF;
        bendLimbs(
          refs,
          walkF > 0.1 ? -0.14 - Math.max(0, armWalk) * 0.35 : -0.46 - explainGesture * 0.4,
          walkF > 0.1 ? -0.14 - Math.max(0, -armWalk) * 0.35 : -0.62 + explainGesture * 0.3,
          Math.max(0, legWalk) * 0.7,
          Math.max(0, -legWalk) * 0.7,
        );
        if (refs.leftArm) {
          refs.leftArm.rotation.x = walkF > 0.1 ? -armWalk : -0.42 - explainGesture;
          refs.leftArm.rotation.z = 0.12;
        }
        if (refs.rightArm) {
          refs.rightArm.rotation.x = walkF > 0.1 ? armWalk * 0.45 : -0.32 + explainGesture * 0.6;
          refs.rightArm.rotation.z = -0.1;
        }
        if (refs.leftLeg) refs.leftLeg.rotation.x = legWalk;
        if (refs.rightLeg) refs.rightLeg.rotation.x = -legWalk;
        continue;
      }

      // Standard walking / playtime running / lunch strolling / church clergy pose
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
        const carryFactor = m.role === 'student-boy' || m.role === 'student-girl' ? 1.0 : 0.3;
        refs.rightArm.rotation.x = armSwing * carryFactor;
        refs.rightArm.rotation.z = -0.08;
      }
      const strideAngle = m.role === 'student-boy' ? .36 : m.role === 'student-girl' ? .23 : .15;
      const legSwing = Math.sin(stride) * strideAngle * walkFactor;
      bendLimbs(refs, -.12 - Math.max(0, armSwing) * .42, -.13 - Math.max(0, -armSwing) * .42,
        Math.max(0, legSwing) * .78, Math.max(0, -legSwing) * .78);
      if (refs.leftLeg) refs.leftLeg.rotation.x = legSwing;
      if (refs.rightLeg) refs.rightLeg.rotation.x = -legSwing;
    }
  });

  return (
    <group name="village-institution-bots" userData={{ dynamic: true }}>
      {boardSlotRefsList.map((refs, idx) => (
        <LiveChalkboardOverlaySlotView key={`board-slot-${idx}`} slotIndex={idx} refs={refs} />
      ))}
      {slotRefsList.map((refs, idx) => (
        <InstitutionSlotView key={`inst-slot-${idx}`} slotIndex={idx} refs={refs} />
      ))}
    </group>
  );
}
