import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Quaternion,
  Vector3,
  type Mesh,
} from 'three';
import {
  getFieldLivestockAssetCache,
  type LivestockLegModel,
} from '../game/fieldLivestockAssets';
import { horseRide } from '../game/horseRide';
import {
  horseStirrupDrop, horseStrideLength, sampleHorseGait, sampleHorseHoof,
  SADDLE_Y, SADDLE_Z, STIRRUP_X, STIRRUP_STRAP_LENGTH, STIRRUP_Z,
  type HorseRiderPose,
} from '../game/horseAnimation';
import { getHorseTackAssetCache } from '../game/horseTackAssets';

export { getHorseTackAssetCache, type HorseTackAssetCache } from '../game/horseTackAssets';

const SIDES = [-1, 1] as const;
const LEGS = [
  { side: 1, hind: false },
  { side: -1, hind: false },
  { side: 1, hind: true },
  { side: -1, hind: true },
] as const;

interface HorseLegRefs {
  hip: Group | null;
  joint: Group | null;
  foot: Group | null;
}

const _upAxis = new Vector3(0, 1, 0);
const _bitLocal = new Vector3();
const _handLocal = new Vector3();
const _midLocal = new Vector3();
const _delta = new Vector3();
const _quat = new Quaternion();

function poseHorseLeg(
  refs: HorseLegRefs,
  shape: LivestockLegModel,
  bodyY: number,
  pitch: number,
  groundPitch: number,
  hoof: ReturnType<typeof sampleHorseHoof>,
  hind: boolean,
  airborne: boolean,
  vy: number,
) {
  if (!refs.hip || !refs.joint || !refs.foot) return;

  if (airborne) {
    // Athletic jump pose: front legs folded sharply under chest, hind legs swept back!
    const climb = Math.max(-1, Math.min(1, vy / 6.5));
    if (!hind) {
      refs.hip.rotation.x = -0.95 - climb * 0.32;
      refs.joint.rotation.x = 1.65 + climb * 0.25;
      refs.foot.rotation.x = -0.45;
    } else {
      refs.hip.rotation.x = 0.72 - climb * 0.28;
      refs.joint.rotation.x = -0.95 + climb * 0.22;
      refs.foot.rotation.x = 0.35;
    }
    return;
  }

  const cos = Math.cos(pitch);
  const sin = Math.sin(pitch);
  const targetZ = shape.hip[2] * cos - shape.hip[1] * sin + hoof.ahead;
  const targetY = shape.hoofHeight + hoof.lift + targetZ * Math.tan(groundPitch) - bodyY;
  const footY = Math.max(.16, shape.hip[1] - (targetY * cos - targetZ * sin));
  const strideZ = targetY * sin + targetZ * cos - shape.hip[2];
  const { upperLength, lowerLength } = shape;
  const maxReach = upperLength + lowerLength - 0.001;
  const footZ = strideZ;
  const reach = Math.min(Math.hypot(footZ, footY), maxReach);
  const bendSign = hind ? 1 : -1;
  const hipAngle =
    Math.atan2(-footZ, footY) +
    bendSign *
      Math.acos(
        Math.max(
          -1,
          Math.min(1, (upperLength ** 2 + reach ** 2 - lowerLength ** 2) / (2 * upperLength * reach)),
        ),
      );
  const jointAngle =
    -bendSign *
    Math.acos(
      Math.max(
        -1,
        Math.min(1, (reach ** 2 - upperLength ** 2 - lowerLength ** 2) / (2 * upperLength * lowerLength)),
      ),
    );
  refs.hip.rotation.x = hipAngle;
  refs.joint.rotation.x = jointAngle;
  refs.foot.rotation.x = pitch - groundPitch - hipAngle - jointAngle + hoof.curl * (hind ? -1 : 1);
}

function orientReinSegment(mesh: Mesh | null, a: Vector3, b: Vector3): void {
  if (!mesh) return;
  _delta.subVectors(b, a);
  const len = _delta.length();
  if (len < 1e-4) {
    mesh.visible = false;
    return;
  }
  mesh.visible = true;
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  _delta.multiplyScalar(1 / len);
  _quat.setFromUnitVectors(_upAxis, _delta);
  mesh.quaternion.copy(_quat);
  mesh.scale.set(1, len, 1);
}

/**
 * Fully articulated Saddled Horse with:
 * - Leather saddle (`ကုန်းနှီး`), pommel, cantle & crimson saddle blanket
 * - Left & right hanging stirrups (`ခြေနင်းအိတ်`)
 * - Headstall / bridle (`နဖားကြိုး / ပါးသိုင်းကြိုး`) & metal bit rings
 * - Two dynamic leather reins (`မြင်းကြိုး ၂ ချောင်း`) connected live to the rider's left & right hands
 */
export function HorseModel({
  riderPose,
  coatIndex = 0,
  scale = 1.06,
  riderScale = 1,
}: {
  riderPose?: RefObject<HorseRiderPose>;
  coatIndex?: number;
  scale?: number;
  riderScale?: number;
}) {
  const livestockCache = useMemo(() => getFieldLivestockAssetCache(), []);
  const tack = useMemo(() => getHorseTackAssetCache(), []);
  const model = livestockCache.models.horse;
  const stirrupDrop = horseStirrupDrop(scale, riderScale);
  const coat = livestockCache.coats.horse[coatIndex % livestockCache.coats.horse.length];
  const hair = livestockCache.horseHair[coatIndex % livestockCache.horseHair.length];

  const rootRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const neckRef = useRef<Group>(null);
  const headRef = useRef<Group>(null);
  const tailRef = useRef<Group>(null);
  const earRefs = useRef<(Mesh | null)[]>([null, null]);
  const legRefs = useRef<HorseLegRefs[]>(LEGS.map(() => ({ hip: null, joint: null, foot: null })));
  const bitRingRefs = useRef<(Mesh | null)[]>([null, null]);
  const reinSegRefs = useRef<(Mesh | null)[]>([null, null, null, null]); // 2 segments per rein (L0,L1,R0,R1)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const r = horseRide;
    const rider = riderPose?.current;
    const isActivelyRidden = rider?.active && r.phase === 'riding';
    const speed = isActivelyRidden ? r.speed : 0;
    const airborne = Boolean(isActivelyRidden && r.airborne);
    const cycle = isActivelyRidden ? r.stridePhase : 0;
    const pitch = isActivelyRidden ? r.pitch : 0;
    const gait = sampleHorseGait(cycle, speed, pitch, airborne);
    const { moving, gallop: gallopBlend } = gait;
    const stride = horseStrideLength(speed, scale) / scale;
    const bodyY = model.bodyY + gait.bounce;

    if (bodyRef.current) {
      bodyRef.current.position.y = bodyY;
      bodyRef.current.rotation.x = -gait.pitch;
    }

    if (neckRef.current) {
      const idleBreath = Math.sin(t * 2.1) * 0.025 * (1 - moving);
      const jumpNeck = airborne ? -0.22 - Math.max(-0.2, Math.min(0.25, r.vy * 0.04)) : 0;
      neckRef.current.rotation.x = model.neckRest + gait.nod + idleBreath + jumpNeck;
      // Turn horse's neck naturally into left/right turns
      neckRef.current.rotation.y = isActivelyRidden ? -r.steerYaw * 0.55 : Math.sin(t * 0.7) * 0.08;
    }

    if (headRef.current) {
      const headBob = -gait.nod * .48;
      headRef.current.rotation.x = model.headRest + headBob + (airborne ? 0.14 : 0);
      headRef.current.rotation.y = isActivelyRidden ? -r.steerYaw * 0.35 : Math.sin(t * 0.7) * 0.05;
    }

    if (tailRef.current) {
      tailRef.current.rotation.z = Math.sin(t * (2.6 + gallopBlend * 4.5)) * (0.18 + gallopBlend * 0.12);
      tailRef.current.rotation.x = 0.12 + gallopBlend * 0.45 + (airborne ? 0.35 : 0);
    }

    for (let i = 0; i < SIDES.length; i++) {
      const ear = earRefs.current[i];
      if (!ear) continue;
      const flick = Math.max(0, Math.sin(t * 2.4 + i * 2.1)) ** 8;
      ear.rotation.z = SIDES[i] * flick * 0.16;
      ear.rotation.x = gallopBlend * 0.18;
    }

    for (let i = 0; i < LEGS.length; i++) {
      const { hind } = LEGS[i];
      poseHorseLeg(
        legRefs.current[i],
        hind ? model.hind : model.front,
        bodyY,
        gait.pitch,
        pitch,
        sampleHorseHoof(i, cycle, stride, gait),
        hind,
        airborne,
        r.vy,
      );
    }

    // Dynamically update BOTH leather reins (`မြင်းကြိုး ၂ ချောင်း`) from bridle bit rings -> rider's hands!
    const body = bodyRef.current, root = rootRef.current;
    if (body && root) {
      for (let i = 0; i < SIDES.length; i++) {
        const side = SIDES[i];
        const bitMesh = bitRingRefs.current[i];
        if (!bitMesh) continue;
        bitMesh.getWorldPosition(_bitLocal);
        body.worldToLocal(_bitLocal);

        _handLocal.set(side * 0.11, 0.46, 0.25);
        const grip = rider?.active ? rider.reinGrip : 0;
        if (rider && grip > 0) {
          const hand = rider.hands[1 - i];
          _midLocal.set(-hand.x / scale, hand.y / scale, -hand.z / scale);
          root.localToWorld(_midLocal);
          _handLocal.lerp(body.worldToLocal(_midLocal), grip);
        }

        // Subtle natural rein slack sag midpoint so the 2 reins curve like real leather straps
        _midLocal.addVectors(_bitLocal, _handLocal).multiplyScalar(0.5);
        _midLocal.y -= 0.13 - grip * .055;
        _midLocal.x += side * 0.045;

        orientReinSegment(reinSegRefs.current[i * 2], _bitLocal, _midLocal);
        orientReinSegment(reinSegRefs.current[i * 2 + 1], _midLocal, _handLocal);
      }
    }
  });

  return (
    <group ref={rootRef} scale={scale} name="rideable-horse-model">
      <group ref={bodyRef} position={[0, model.bodyY, 0]} dispose={null}>
        {/* Horse Torso */}
        <mesh geometry={model.meshes.body} material={coat} castShadow />

        {/* Saddle Blanket (`ကုန်းနှီးအောက်ခံ`), Leather Saddle (`ကုန်းနှီး`), Pommel, Cantle & Girth */}
        <group name="horse-saddle" position={[0, SADDLE_Y, SADDLE_Z]}>
          <mesh geometry={tack.blanketGeo} material={tack.blanketMat} position={[0, -0.02, 0]} />
          <mesh geometry={tack.saddleSeatGeo} material={tack.leatherDarkMat} position={[0, 0.04, 0]} castShadow />
          {/* Front Pommel */}
          <mesh geometry={tack.pommelGeo} material={tack.leatherWarmMat} position={[0, 0.12, 0.22]} rotation={[0.25, 0, 0]} />
          {/* Rear Cantle */}
          <mesh geometry={tack.cantleGeo} material={tack.leatherWarmMat} position={[0, 0.14, -0.24]} rotation={[-0.28, 0, 0]} />
          {/* Cinch / Girth Strap wrapping around barrel */}
          <mesh geometry={tack.girthGeo} material={tack.leatherDarkMat} position={[0, -0.34, 0.06]} scale={[0.92, 1.05, 1]} />

          {/* Left & Right Stirrups (`ခြေနင်းအိတ်` — leather straps + metal stirrup irons) */}
          {SIDES.map((side) => (
            <group key={`stirrup-${side}`} name={`horse-stirrup-${side > 0 ? 'left' : 'right'}`} position={[side * STIRRUP_X, 0, STIRRUP_Z]}>
              <mesh geometry={tack.stirrupStrapGeo} material={tack.leatherWarmMat} position={[0, -stirrupDrop * .5, 0]} scale={[1, stirrupDrop / STIRRUP_STRAP_LENGTH, 1]} />
              <group position={[0, -stirrupDrop, 0]}>
                <mesh geometry={tack.stirrupArchGeo} material={tack.ironMat} position={[0, 0.01, 0]} />
                <mesh geometry={tack.stirrupTreadGeo} material={tack.ironMat} position={[0, -0.005, 0]} />
              </group>
            </group>
          ))}
        </group>

        {/* Two Live Leather Reins (`မြင်းကြိုး ၂ ချောင်း` — Left & Right, 2 segments each) */}
        {[0, 1, 2, 3].map((idx) => (
          <mesh
            key={`rein-seg-${idx}`}
            ref={(el) => {
              reinSegRefs.current[idx] = el;
            }}
            name={`horse-rein-${idx < 2 ? 'left' : 'right'}-${idx % 2}`}
            geometry={tack.reinSegGeo}
            material={tack.leatherDarkMat}
          />
        ))}

        {/* Neck + Mane + Head + Bridle/Headstall (`နဖားကြိုး / ပါးသိုင်းကြိုး`) */}
        <group ref={neckRef} position={model.neckAnchor}>
          <mesh geometry={model.meshes.neck} material={coat} castShadow />
          {model.meshes.mane && <mesh geometry={model.meshes.mane} material={hair} />}
          <group ref={headRef} position={model.headAnchor}>
            <mesh geometry={model.meshes.head} material={coat} castShadow />
            <mesh geometry={model.meshes.muzzle} material={livestockCache.muzzles.horse} />
            <mesh geometry={model.meshes.eyes} material={livestockCache.eyes} />
            <mesh geometry={model.meshes.noseDetails} material={livestockCache.nostrils} />
            {SIDES.map((side, i) => (
              <mesh
                key={`ear-${side}`}
                ref={(el) => {
                  earRefs.current[i] = el;
                }}
                geometry={model.meshes.ear}
                material={coat}
                position={[side * model.earAnchor[0], model.earAnchor[1], model.earAnchor[2]]}
                scale={[side, 1, 1]}
              />
            ))}

            {/* Headstall & Noseband Bridle (`နဖားကြိုး / ပါးသိုင်းကြိုး`) */}
            <group name="horse-bridle">
              {/* Crownpiece behind ears */}
              <mesh
                geometry={tack.bridleBandGeo}
                material={tack.leatherDarkMat}
                position={[0, 0.02, -0.06]}
                scale={[1.18, 1.32, 1]}
              />
              {/* Noseband (`နဖားကြိုး`) around muzzle */}
              <mesh
                geometry={tack.bridleBandGeo}
                material={tack.leatherWarmMat}
                position={[0, -0.095, 0.32]}
                rotation={[0.25, 0, 0]}
                scale={[0.92, 0.88, 1]}
              />
              {/* Left & Right Cheekpieces + Brass Bit Rings where the 2 reins attach */}
              {SIDES.map((side, i) => (
                <group key={`bridle-side-${side}`}>
                  <mesh
                    geometry={tack.cheekStrapGeo}
                    material={tack.leatherDarkMat}
                    position={[side * 0.108, -0.04, 0.13]}
                    rotation={[Math.PI / 2 + 0.28, 0, 0]}
                  />
                  <mesh
                    ref={(el) => {
                      bitRingRefs.current[i] = el;
                    }}
                    name={`horse-bit-ring-${side < 0 ? 'left' : 'right'}`}
                    geometry={tack.bitRingGeo}
                    material={tack.brassMat}
                    position={[side * 0.105, -0.115, 0.34]}
                    rotation={[0, Math.PI / 2, 0]}
                  />
                </group>
              ))}
            </group>
          </group>
        </group>

        {/* Tail */}
        <group ref={tailRef} position={model.tailAnchor}>
          <mesh geometry={model.meshes.tail} material={hair} />
        </group>

        {/* Articulated 4 Legs */}
        {LEGS.map(({ side, hind }, i) => {
          const shape = hind ? model.hind : model.front;
          return (
            <group
              key={`leg-${i}`}
              ref={(el) => {
                legRefs.current[i].hip = el;
              }}
              position={[side * shape.hip[0], shape.hip[1], shape.hip[2]]}
            >
              <mesh geometry={shape.upper} material={coat} castShadow />
              <group
                ref={(el) => {
                  legRefs.current[i].joint = el;
                }}
                position={[0, -shape.upperLength, 0]}
              >
                <mesh geometry={shape.lower} material={coat} castShadow />
                <group
                  ref={(el) => {
                    legRefs.current[i].foot = el;
                  }}
                  position={[0, -shape.lowerLength, 0]}
                >
                  <mesh geometry={shape.hoof} material={livestockCache.hoof} />
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
 * Parked saddled riding horse rendered in the world whenever the player is NOT currently
 * mounting or riding it (so the player can walk up, see the Horse icon, and mount!).
 */
export function ParkedRidingHorse({ riderScale }: { riderScale: number }) {
  const rootRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const tack = useMemo(() => getHorseTackAssetCache(), []);

  useFrame(({ clock }) => {
    const r = horseRide;
    const parked = r.phase === 'idle';
    if (rootRef.current) {
      rootRef.current.visible = parked;
      if (parked) {
        rootRef.current.position.set(r.x, r.groundY, r.z);
        // Align horse +Z forward with avatar -Z yaw convention
        rootRef.current.rotation.y = r.yaw + Math.PI;
      }
    }
    if (ringRef.current) {
      const showRing = parked && r.nearHorse !== null && !r.nearHorse.isFieldHorse;
      ringRef.current.visible = showRing;
      if (showRing) {
        ringRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 3.5) * 0.06);
      }
    }
  });

  return (
    <group ref={rootRef} name="parked-riding-horse" userData={{ dynamic: true }}>
      <HorseModel coatIndex={horseRide.coatIndex} scale={horseRide.scale} riderScale={riderScale} />
      <mesh
        ref={ringRef}
        position={[0, 0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={tack.markerRingGeo}
        material={tack.markerRingMat}
        visible={false}
      />
    </group>
  );
}
