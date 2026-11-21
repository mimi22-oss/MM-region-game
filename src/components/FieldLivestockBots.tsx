import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { mobileQuality } from '../game/sceneBudget';
import { useQualityPreset } from '../game/qualityPreset';
import { getFieldLivestockAssetCache, type LivestockLegModel } from '../game/fieldLivestockAssets';
import {
  applyBotAvoidanceStep,
  removeAvoidanceActor,
  upsertAvoidanceActor,
} from '../game/botAvoidance';
import {
  FieldLivestockFixedPoolController,
  type LivestockBotState,
} from '../game/fieldLivestockPool';

const POOL_DESKTOP = 63;
const POOL_MOBILE = 35;
const SIDES = [-1, 1] as const;
const LEGS = [
  { side: -1, hind: false, phase: .75 },
  { side: 1, hind: false, phase: .25 },
  { side: -1, hind: true, phase: 0 },
  { side: 1, hind: true, phase: .5 },
] as const;

interface LegRefs {
  hip: Group | null;
  joint: Group | null;
  foot: Group | null;
  upper: Mesh | null;
  lower: Mesh | null;
  hoof: Mesh | null;
}

interface LivestockSlotRefs {
  root: Group | null;
  body: Group | null;
  neck: Group | null;
  head: Group | null;
  tail: Group | null;
  torso: Mesh | null;
  neckMesh: Mesh | null;
  headMesh: Mesh | null;
  muzzle: Mesh | null;
  eyes: Mesh | null;
  noseDetails: Mesh | null;
  horns: Mesh | null;
  mane: Mesh | null;
  tailMesh: Mesh | null;
  tuft: Mesh | null;
  ears: (Mesh | null)[];
  legs: LegRefs[];
  boundId: string | null;
}

function emptySlotRefs(): LivestockSlotRefs {
  return {
    root: null, body: null, neck: null, head: null, tail: null,
    torso: null, neckMesh: null, headMesh: null, muzzle: null, eyes: null, noseDetails: null,
    horns: null, mane: null, tailMesh: null, tuft: null,
    ears: [null, null],
    legs: LEGS.map(() => ({ hip: null, joint: null, foot: null, upper: null, lower: null, hoof: null })),
    boundId: null,
  };
}

type MeshGeometry = Mesh['geometry'];
type MeshMaterial = Mesh['material'];

function bindMesh(mesh: Mesh | null, geometry: MeshGeometry | null, material: MeshMaterial) {
  if (!mesh) return;
  mesh.visible = geometry !== null;
  if (geometry) {
    mesh.geometry = geometry;
    mesh.material = material;
  }
}

function bindLivestockAppearance(refs: LivestockSlotRefs, a: LivestockBotState): void {
  if (refs.boundId === a.id) return;
  refs.boundId = a.id;

  const cache = getFieldLivestockAssetCache();
  const model = cache.models[a.species];
  const { meshes } = model;
  const palette = cache.coats[a.species];
  const coat = palette[a.coatIndex % palette.length];
  const hair = cache.horseHair[a.coatIndex % cache.horseHair.length];

  if (refs.root) refs.root.scale.setScalar(a.scale);
  refs.neck?.position.set(...model.neckAnchor);
  refs.head?.position.set(...model.headAnchor);
  refs.tail?.position.set(...model.tailAnchor);
  bindMesh(refs.torso, meshes.body, coat);
  bindMesh(refs.neckMesh, meshes.neck, coat);
  bindMesh(refs.headMesh, meshes.head, coat);
  bindMesh(refs.muzzle, meshes.muzzle, cache.muzzles[a.species]);
  bindMesh(refs.eyes, meshes.eyes, cache.eyes);
  bindMesh(refs.noseDetails, meshes.noseDetails, cache.nostrils);
  bindMesh(refs.horns, meshes.horns, a.species === 'horse' ? hair : cache.horns[a.species]);
  bindMesh(refs.mane, meshes.mane, hair);
  bindMesh(refs.tailMesh, meshes.tail, a.species === 'horse' ? hair : coat);
  bindMesh(refs.tuft, meshes.tuft, cache.hoof);
  for (let i = 0; i < SIDES.length; i++) {
    const ear = refs.ears[i];
    if (!ear) continue;
    const [x, y, z] = model.earAnchor;
    ear.position.set(SIDES[i] * x, y, z);
    bindMesh(ear, meshes.ear, coat);
  }
  for (let i = 0; i < LEGS.length; i++) {
    const { side, hind } = LEGS[i];
    const leg = refs.legs[i];
    const shape = hind ? model.hind : model.front;
    const [x, y, z] = shape.hip;
    leg.hip?.position.set(side * x, y, z);
    leg.joint?.position.set(0, -shape.upperLength, 0);
    leg.foot?.position.set(0, -shape.lowerLength, 0);
    bindMesh(leg.upper, shape.upper, coat);
    bindMesh(leg.lower, shape.lower, coat);
    bindMesh(leg.hoof, shape.hoof, cache.hoof);
  }
}

function poseLeg(refs: LegRefs, shape: LivestockLegModel, bodyY: number, stride: number, phase: number, swing: number, hind: boolean) {
  if (!refs.hip || !refs.joint || !refs.foot) return;
  const stanceEnd = .62;
  const swingProgress = Math.max(0, (phase - stanceEnd) / (1 - stanceEnd));
  const strideExtent = stride * stanceEnd / 2;
  const strideZ = (phase < stanceEnd
    ? strideExtent - phase * stride
    : -strideExtent + 2 * strideExtent * swingProgress * swingProgress * (3 - 2 * swingProgress)) * swing;
  const lift = Math.sin(Math.PI * swingProgress) * .15 * swing;
  const footY = bodyY + shape.hip[1] - shape.hoofHeight - lift;
  const { upperLength, lowerLength } = shape;
  const maxReach = upperLength + lowerLength - .001;
  // Shorten a long step horizontally before allowing a planted hoof to lift.
  const maxFootZ = Math.sqrt(Math.max(0, maxReach ** 2 - footY ** 2));
  const footZ = Math.max(-maxFootZ, Math.min(maxFootZ, strideZ));
  const reach = Math.min(Math.hypot(footZ, footY), maxReach);
  const bendSign = hind ? 1 : -1;
  const hipAngle = Math.atan2(-footZ, footY) + bendSign * Math.acos(
    (upperLength ** 2 + reach ** 2 - lowerLength ** 2) / (2 * upperLength * reach),
  );
  const jointAngle = -bendSign * Math.acos(
    (reach ** 2 - upperLength ** 2 - lowerLength ** 2) / (2 * upperLength * lowerLength),
  );
  refs.hip.rotation.x = hipAngle;
  refs.joint.rotation.x = jointAngle;
  refs.foot.rotation.x = -hipAngle - jointAngle + lift * .65;
}

function poseLivestock(refs: LivestockSlotRefs, a: LivestockBotState) {
  const model = getFieldLivestockAssetCache().models[a.species];
  const moving = Math.min(1, a.speed / .48);
  const cycle = a.walkDist / (model.strideLength * a.scale);
  const bodyY = model.bodyY + Math.cos(cycle * Math.PI * 4) * .009 * moving;
  if (refs.body) refs.body.position.y = bodyY;

  // The behavior controller supplies a smoothed head pitch. Extend it into the
  // full grazing pose with enough neck reach for the muzzle to meet the grass.
  const grazing = Math.min(1, Math.max(0, (a.neckPitch - .08) / (a.species === 'horse' ? 1.07 : .80)));
  const chew = Math.sin(a.elapsed * 5.8 + a.phaseOffset) * .022 * grazing;
  if (refs.neck) {
    refs.neck.rotation.x = a.neckPitch + model.neckRest * (1 - grazing) + model.grazePitchOffset * grazing + chew * .4;
    refs.neck.rotation.y = a.headYaw * .42;
  }
  if (refs.head) {
    refs.head.rotation.x = model.headRest + (model.headGraze - model.headRest) * grazing + chew;
    refs.head.rotation.y = a.headYaw * .58;
  }
  if (refs.tail) {
    refs.tail.rotation.z = Math.sin(a.elapsed * 2.55 + a.phaseOffset) * (a.species === 'horse' ? .19 : .26);
    refs.tail.rotation.x = .08 + Math.sin(a.elapsed * 1.65 + a.phaseOffset) * .085;
  }
  for (let i = 0; i < refs.ears.length; i++) {
    const ear = refs.ears[i];
    if (ear) {
      const flick = Math.max(0, Math.sin(a.elapsed * 2.75 + a.phaseOffset + i * 2)) ** 8;
      ear.rotation.z = SIDES[i] * flick * .17;
      ear.rotation.y = SIDES[i] * (a.headYaw * .25 + flick * .21);
    }
  }
  for (let i = 0; i < LEGS.length; i++) {
    const { hind, phase } = LEGS[i];
    poseLeg(refs.legs[i], hind ? model.hind : model.front, bodyY, model.strideLength, (cycle + phase) % 1, moving, hind);
  }
}

function LivestockSlotView({ slotIndex, refs }: { slotIndex: number; refs: LivestockSlotRefs }) {
  const cache = getFieldLivestockAssetCache();
  const initial = cache.models.cow;
  const parts = initial.meshes;
  const coat = cache.coats.cow[0];

  return (
    <group
      name={`field-livestock-${slotIndex}`}
      visible={false}
      userData={{ dynamic: true }}
      ref={el => { refs.root = el; }}
    >
      <group ref={el => { refs.body = el; }} dispose={null}>
        <mesh ref={el => { refs.torso = el; }} geometry={parts.body} material={coat} castShadow />
        <group ref={el => { refs.neck = el; }}>
          <mesh ref={el => { refs.neckMesh = el; }} geometry={parts.neck} material={coat} castShadow />
          <mesh ref={el => { refs.mane = el; }} geometry={parts.neck} material={cache.horseHair[0]} visible={false} />
          <group ref={el => { refs.head = el; }}>
            <mesh ref={el => { refs.headMesh = el; }} geometry={parts.head} material={coat} castShadow />
            <mesh ref={el => { refs.muzzle = el; }} geometry={parts.muzzle} material={cache.muzzles.cow} />
            <mesh ref={el => { refs.eyes = el; }} geometry={parts.eyes} material={cache.eyes} />
            <mesh ref={el => { refs.noseDetails = el; }} geometry={parts.noseDetails} material={cache.nostrils} />
            <mesh ref={el => { refs.horns = el; }} geometry={parts.horns ?? parts.head} material={cache.horns.cow} />
            {SIDES.map((side, i) => (
              <mesh
                key={side}
                ref={el => { refs.ears[i] = el; }}
                geometry={parts.ear}
                material={coat}
                scale={[side, 1, 1]}
              />
            ))}
          </group>
        </group>
        <group ref={el => { refs.tail = el; }}>
          <mesh ref={el => { refs.tailMesh = el; }} geometry={parts.tail} material={coat} />
          <mesh ref={el => { refs.tuft = el; }} geometry={parts.tuft ?? parts.tail} material={cache.hoof} />
        </group>
        {LEGS.map(({ side, hind }, i) => {
          const leg = refs.legs[i];
          const shape = hind ? initial.hind : initial.front;
          return (
            <group key={i} ref={el => { leg.hip = el; }} name={`${hind ? 'hind' : 'front'}-${side < 0 ? 'left' : 'right'}`}>
              <mesh ref={el => { leg.upper = el; }} geometry={shape.upper} material={coat} castShadow />
              <group ref={el => { leg.joint = el; }}>
                <mesh ref={el => { leg.lower = el; }} geometry={shape.lower} material={coat} castShadow />
                <group ref={el => { leg.foot = el; }}>
                  <mesh ref={el => { leg.hoof = el; }} geometry={shape.hoof} material={cache.hoof} />
                </group>
              </group>
            </group>
          );
        })}
      </group>
    </group>
  );
}

export function FieldLivestockBots() {
  const preset = useQualityPreset();
  const isLowQuality = mobileQuality || preset.id === 'mobile' || preset.id === 'low';
  const capacity = isLowQuality ? POOL_MOBILE : POOL_DESKTOP;

  const controller = useMemo(
    () => new FieldLivestockFixedPoolController(capacity, isLowQuality ? 135 : 210),
    [capacity, isLowQuality],
  );
  const slotRefsList = useMemo(
    () => Array.from({ length: capacity }, () => emptySlotRefs()),
    [capacity],
  );

  useEffect(() => {
    return () => {
      controller.dispose();
      for (let i = 0; i < POOL_DESKTOP; i++) removeAvoidanceActor(`field-livestock-${i}`);
    };
  }, [controller]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };

    controller.update(focus.x, focus.z, dt, false);

    for (let i = 0; i < controller.slots.length; i++) {
      const a = controller.slots[i].animal;
      const refs = slotRefsList[i];
      const actorId = `field-livestock-${i}`;
      if (!refs || !refs.root) continue;

      if (!a) {
        refs.root.visible = false;
        removeAvoidanceActor(actorId);
        continue;
      }

      bindLivestockAppearance(refs, a);
      const radius = a.species === 'buffalo' ? 1.15 : a.species === 'horse' ? 1.0 : 0.95;
      const prevLX = refs.root.visible ? refs.root.position.x : a.worldX;
      const prevLZ = refs.root.visible ? refs.root.position.z : a.worldZ;
      const avoided = applyBotAvoidanceStep(
        actorId,
        'livestock',
        prevLX,
        prevLZ,
        a.worldX,
        a.worldZ,
        a.yaw,
        radius,
        dt,
      );
      if (avoided.steered || avoided.yieldedToCar) {
        const moved = Math.hypot(avoided.x - prevLX, avoided.z - prevLZ);
        a.worldX = avoided.x;
        a.worldZ = avoided.z;
        a.yaw = avoided.yaw;
        // Keep field-local coordinates synchronized with the collision-free world position
        const f = controller.fields[a.fieldIndex];
        if (f) {
          const cf = Math.cos(f.rotation);
          const sf = Math.sin(f.rotation);
          const dxf = a.worldX - f.x;
          const dzf = a.worldZ - f.z;
          a.lx = dxf * cf - dzf * sf;
          a.lz = dxf * sf + dzf * cf;
        }
        if (avoided.yieldedToCar) {
          a.behavior = 'strolling';
          a.speed = moved / Math.max(0.001, dt);
          a.walkDist += moved;
        }
      }
      upsertAvoidanceActor(actorId, 'livestock', a.worldX, a.worldZ, a.yaw, radius, {
        speed: a.speed,
      });
      refs.root.visible = true;

      refs.root.position.set(a.worldX, a.worldY, a.worldZ);
      refs.root.rotation.y = a.yaw;
      poseLivestock(refs, a);
    }
  });

  return (
    <group name="paddy-field-livestock-bots" userData={{ dynamic: true }}>
      {slotRefsList.map((refs, idx) => (
        <LivestockSlotView key={`livestock-slot-${idx}`} slotIndex={idx} refs={refs} />
      ))}
    </group>
  );
}
