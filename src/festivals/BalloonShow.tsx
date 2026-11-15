import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  BoxGeometry,
  CatmullRomCurve3,
  Color,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';
import { MyanmarFireBalloon } from '../components/MyanmarFireBalloon.tsx';
import {
  candleHolderGeometry,
  candlePoolGeometry,
  candleHolderLitMaterial,
  candlePoolLitMaterial,
  flameGeometry,
  candleGlowGeometry,
  candleFlameMaterial,
  candleGlowMaterial,
  HOLDER_CANDLE_BASE,
  HOLDER_CANDLE_SCALE,
  CANDLE_WICK_TOP,
} from '../game/candleModel.ts';
import {
  BALLOON_PROFILE,
  type VillageLaunchHub,
} from '../game/fireBalloonModel.ts';
import { useQualityPreset } from '../game/qualityPreset.ts';
import { getHeroBalloonLightTarget } from '../game/pointLightPool.ts';
import {
  buildBalloonShowDescriptors,
  createSeededRandom,
  evaluateBalloonTransform,
  evaluateBalloonTransformInto,
  selectFestivalZonesNearFocus,
  type DeterministicBalloonDescriptor,
  type SampledBalloonPose,
} from './festivalSimulation.ts';

export {
  buildBalloonShowDescriptors,
  createSeededRandom,
  evaluateBalloonTransform,
  type DeterministicBalloonDescriptor,
  type SampledBalloonPose,
};

export interface BalloonShowProps {
  zones: VillageLaunchHub[];
  balloonsPerZone?: number;
  active?: boolean;
  seed?: number;
  ceiling?: number;
  minAltitude?: number;
  maxNearLOD?: number;
  maxMidLOD?: number;
}

const ignoreRaycast = () => null;
const ZONE_REFRESH_DISTANCE_SQ = 120 * 120;

export function BalloonShow({
  zones,
  balloonsPerZone = 120,
  active = true,
  seed = 20261115,
  ceiling = 520,
  minAltitude = 18,
  maxNearLOD,
  maxMidLOD,
}: BalloonShowProps) {
  const preset = useQualityPreset();
  const { camera, scene } = useThree();

  const resolvedNearLOD = maxNearLOD ?? preset.maxNearBalloons;
  const resolvedMidLOD = maxMidLOD ?? preset.maxMidBalloons;

  const focusCheckPos = useRef({ x: NaN, z: NaN });
  const [zoneSignature, setZoneSignature] = useState<string>('');
  const activeZonesRef = useRef<VillageLaunchHub[]>([]);

  // Select nearby zones immediately when props/preset change or focus initializes
  const resolveNearbyZones = (fx: number, fz: number) => {
    const selected = selectFestivalZonesNearFocus(
      zones,
      fx,
      fz,
      preset.maxActiveFestivalZones,
      preset.festivalZoneRadius,
    );
    const sig = selected.map((z) => z.id).join('|');
    return { selected, sig };
  };

  useEffect(() => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    focusCheckPos.current.x = focus.x;
    focusCheckPos.current.z = focus.z;
    const { selected, sig } = resolveNearbyZones(focus.x, focus.z);
    activeZonesRef.current = selected;
    setZoneSignature(sig);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, preset.maxActiveFestivalZones, preset.festivalZoneRadius]);

  const activeZones = useMemo(() => {
    if (activeZonesRef.current.length > 0 || zoneSignature === '') {
      const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
      return selectFestivalZonesNearFocus(
        zones,
        focus.x,
        focus.z,
        preset.maxActiveFestivalZones,
        preset.festivalZoneRadius,
      );
    }
    return activeZonesRef.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, zoneSignature, preset.maxActiveFestivalZones, preset.festivalZoneRadius]);

  const effectivePerZone = useMemo(() => {
    const zoneCount = Math.max(1, activeZones.length);
    const totalBudgetPerZone = Math.floor(preset.maxTotalBalloons / zoneCount);
    const cap = Math.min(preset.maxBalloonsPerZone, totalBudgetPerZone);
    return Math.max(4, Math.min(cap, balloonsPerZone));
  }, [activeZones.length, balloonsPerZone, preset.maxBalloonsPerZone, preset.maxTotalBalloons]);

  const descriptors = useMemo(
    () =>
      active && activeZones.length > 0
        ? buildBalloonShowDescriptors(activeZones, effectivePerZone, seed, ceiling, minAltitude)
        : [],
    [active, activeZones, effectivePerZone, seed, ceiling, minAltitude],
  );

  const totalCount = descriptors.length;
  const nearRefs = useRef<(Group | null)[]>([]);
  const midEnvelopeRef = useRef<InstancedMesh>(null);
  const midPlatformRef = useRef<InstancedMesh>(null);
  const farMeshRef = useRef<InstancedMesh>(null);
  const midCupRef = useRef<InstancedMesh>(null);
  const midPoolRef = useRef<InstancedMesh>(null);
  const flameRef = useRef<InstancedMesh>(null);
  const glowRef = useRef<InstancedMesh>(null);

  const dummy = useMemo(() => new Matrix4(), []);
  const fireTransform = useMemo(() => new Matrix4(), []);
  const tempPos = useMemo(() => new Vector3(), []);
  const tempQuat = useMemo(() => new Quaternion(), []);
  const tempScale = useMemo(() => new Vector3(), []);
  const tilt = useMemo(() => new Euler(), []);

  const candleTransforms = useMemo(() => {
    const tip = 0.27 + 0.7 * (HOLDER_CANDLE_BASE + CANDLE_WICK_TOP * HOLDER_CANDLE_SCALE);
    const size = 0.7 * 2.2;
    return {
      cup: new Matrix4().makeScale(0.7, 0.7, 0.7).setPosition(0, 0.27, 0),
      flame: new Matrix4().makeScale(size, size, size).setPosition(0, tip, 0),
      glow: new Matrix4().makeScale(size, size, size).setPosition(0, tip + 0.065 * size, 0),
    };
  }, []);

  const { midEnvelopeGeom, midPlatformGeom, farEnvelopeGeom, midEnvelopeMat, midPlatformMat, farEnvelopeMat } =
    useMemo(() => {
      const curve = new CatmullRomCurve3(
        BALLOON_PROFILE.map(([r, y]) => new Vector3(r, y, 0)),
      );
      const midPoints = Array.from({ length: 21 }, (_, i) => {
        const p = curve.getPoint(i / 20);
        return new Vector2(Math.max(0, p.x), p.y);
      });
      const farPoints = Array.from({ length: 11 }, (_, i) => {
        const p = curve.getPoint(i / 10);
        return new Vector2(Math.max(0, p.x), p.y);
      });

      return {
        midEnvelopeGeom: new LatheGeometry(midPoints, 14),
        midPlatformGeom: new BoxGeometry(1.14, 0.1, 0.9).translate(0, 0.18, 0),
        farEnvelopeGeom: new LatheGeometry(farPoints, 8),
        midEnvelopeMat: new MeshStandardMaterial({
          color: '#f59a38',
          emissive: '#ff7e1b',
          emissiveIntensity: 0.48,
          roughness: 0.88,
          metalness: 0.05,
          transparent: true,
          opacity: 0.93,
          side: DoubleSide,
          depthWrite: true,
        }),
        midPlatformMat: new MeshStandardMaterial({
          color: '#8c582f',
          roughness: 0.9,
        }),
        farEnvelopeMat: new MeshBasicMaterial({
          color: '#ffa347',
          transparent: true,
          opacity: 0.88,
          depthWrite: true,
        }),
      };
    }, []);

  // Clean up festival-specific geometries and materials when unmounted/disabled
  useEffect(() => {
    return () => {
      midEnvelopeGeom.dispose();
      midPlatformGeom.dispose();
      farEnvelopeGeom.dispose();
      midEnvelopeMat.dispose();
      midPlatformMat.dispose();
      farEnvelopeMat.dispose();
    };
  }, [
    midEnvelopeGeom,
    midPlatformGeom,
    farEnvelopeGeom,
    midEnvelopeMat,
    midPlatformMat,
    farEnvelopeMat,
  ]);

  useEffect(() => {
    const farMesh = farMeshRef.current;
    if (!farMesh || descriptors.length === 0) return;
    const c = new Color();
    for (let i = 0; i < descriptors.length; i++) {
      farMesh.setColorAt(i, c.set(descriptors[i].colorHex));
    }
    if (farMesh.instanceColor) {
      farMesh.instanceColor.needsUpdate = true;
    }
  }, [descriptors]);

  // Preallocated scratch buffers (zero per-frame allocations; grown synchronously before useFrame)
  const posePool = useMemo<SampledBalloonPose[]>(() => [], []);
  const nearIndices = useMemo<number[]>(() => [], []);
  const nearDistSqList = useMemo<number[]>(() => [], []);
  const midIndices = useMemo<number[]>(() => [], []);
  const farIndices = useMemo<number[]>(() => [], []);
  const nearFlag = useRef<Uint8Array>(new Uint8Array(0));
  const farAccumulator = useRef(999);
  const zoneCheckAccumulator = useRef(0);

  while (posePool.length < totalCount) {
    posePool.push({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, progress: 0 });
  }
  if (nearFlag.current.length < totalCount) {
    nearFlag.current = new Uint8Array(totalCount);
  }

  useEffect(() => {
    farAccumulator.current = 999;
  }, [descriptors, resolvedNearLOD, resolvedMidLOD]);

  useEffect(() => {
    return () => {
      getHeroBalloonLightTarget(scene).active = false;
    };
  }, [scene]);

  useFrame(({ clock, camera: frameCamera }, dt) => {
    const focus =
      (frameCamera.userData.viewFocus as { x: number; z: number } | undefined) ?? frameCamera.position;

    // Periodically check if camera focus moved enough to switch active festival zones
    zoneCheckAccumulator.current += dt;
    if (zoneCheckAccumulator.current >= 0.4) {
      zoneCheckAccumulator.current = 0;
      const mdx = focus.x - focusCheckPos.current.x;
      const mdz = focus.z - focusCheckPos.current.z;
      if (Number.isNaN(mdx) || mdx * mdx + mdz * mdz > ZONE_REFRESH_DISTANCE_SQ) {
        focusCheckPos.current.x = focus.x;
        focusCheckPos.current.z = focus.z;
        const { selected, sig } = resolveNearbyZones(focus.x, focus.z);
        if (sig !== zoneSignature) {
          activeZonesRef.current = selected;
          setZoneSignature(sig);
        }
      }
    }

    if (!active || totalCount === 0) {
      getHeroBalloonLightTarget(scene).active = false;
      const meshes = [
        farMeshRef.current,
        midEnvelopeRef.current,
        midPlatformRef.current,
        midCupRef.current,
        midPoolRef.current,
        flameRef.current,
        glowRef.current,
      ];
      for (let i = 0; i < meshes.length; i++) {
        const mesh = meshes[i];
        if (mesh && mesh.count > 0) {
          mesh.count = 0;
          mesh.instanceMatrix.needsUpdate = true;
        }
      }
      for (let i = 0; i < resolvedNearLOD; i++) {
        const g = nearRefs.current[i];
        if (g && g.visible) g.visible = false;
      }
      return;
    }

    while (posePool.length < totalCount) {
      posePool.push({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1, progress: 0 });
    }
    if (nearFlag.current.length < totalCount) {
      nearFlag.current = new Uint8Array(totalCount);
    }

    const t = clock.elapsedTime;
    const farStep = 1 / Math.max(1, preset.distantBalloonSimHz);
    farAccumulator.current += dt;
    const simulateFarThisFrame = farAccumulator.current >= farStep;
    if (simulateFarThisFrame) {
      farAccumulator.current = 0;
    }

    const nearDistSq = 72 * 72;
    const midDistSq = 260 * 260;
    const fx = focus.x;
    const fz = focus.z;
    const isNearCache = nearFlag.current;

    if (simulateFarThisFrame) {
      nearIndices.length = 0;
      nearDistSqList.length = 0;
      midIndices.length = 0;
      farIndices.length = 0;

      for (let i = 0; i < totalCount; i++) {
        const pose = evaluateBalloonTransformInto(descriptors[i], t, posePool[i]);
        const dx = pose.x - fx;
        const dz = pose.z - fz;
        const distSq = dx * dx + dz * dz;

        if (distSq < nearDistSq && pose.y < 135) {
          isNearCache[i] = 1;
          nearIndices.push(i);
          nearDistSqList.push(distSq);
        } else if (distSq < midDistSq) {
          isNearCache[i] = 1;
          midIndices.push(i);
        } else {
          isNearCache[i] = 0;
          farIndices.push(i);
        }
      }

      // Insertion-select only top `resolvedNearLOD` closest near balloons without sorting objects
      if (nearIndices.length > 1) {
        const limit = Math.min(resolvedNearLOD, nearIndices.length);
        for (let i = 0; i < limit; i++) {
          let bestPos = i;
          let bestD = nearDistSqList[i];
          for (let j = i + 1; j < nearIndices.length; j++) {
            if (nearDistSqList[j] < bestD) {
              bestD = nearDistSqList[j];
              bestPos = j;
            }
          }
          if (bestPos !== i) {
            const tmpI = nearIndices[i];
            const tmpD = nearDistSqList[i];
            nearIndices[i] = nearIndices[bestPos];
            nearDistSqList[i] = nearDistSqList[bestPos];
            nearIndices[bestPos] = tmpI;
            nearDistSqList[bestPos] = tmpD;
          }
        }
      }

      const overflowNear = Math.min(nearIndices.length, resolvedNearLOD);
      for (let i = overflowNear; i < nearIndices.length; i++) {
        midIndices.push(nearIndices[i]);
      }
      // These lists must partition the population. Keeping overflow here too
      // makes the count check above force a distant simulation on EVERY frame.
      nearIndices.length = overflowNear;
      nearDistSqList.length = overflowNear;
      if (midIndices.length > resolvedMidLOD) {
        for (let i = resolvedMidLOD; i < midIndices.length; i++) {
          const idx = midIndices[i];
          isNearCache[idx] = 0;
          farIndices.push(idx);
        }
        midIndices.length = resolvedMidLOD;
      }
    } else {
      // Smooth 60Hz update ONLY for near/mid-field balloons; distant balloons remain frozen until next far tick
      for (let i = 0; i < totalCount; i++) {
        if (isNearCache[i] === 1) {
          evaluateBalloonTransformInto(descriptors[i], t, posePool[i]);
        }
      }
    }

    const activeNearCount = Math.min(nearIndices.length, resolvedNearLOD);
    for (let i = 0; i < resolvedNearLOD; i++) {
      const group = nearRefs.current[i];
      if (!group) continue;
      if (i < activeNearCount) {
        const p = posePool[nearIndices[i]];
        group.visible = true;
        group.position.set(p.x, p.y, p.z);
        group.scale.setScalar(p.scale);
        group.rotation.set(p.rx, p.ry, p.rz);
      } else if (group.visible) {
        group.visible = false;
      }
    }

    const heroTarget = getHeroBalloonLightTarget(scene);
    if (preset.heroBalloonLight && activeNearCount > 0 && nearDistSqList[0] < 30 * 30) {
      const hero = posePool[nearIndices[0]];
      heroTarget.active = true;
      heroTarget.x = hero.x;
      heroTarget.y = hero.y + 0.6 * hero.scale;
      heroTarget.z = hero.z;
      heroTarget.intensity = 3.6 * (1 + 0.08 * Math.sin(t * 7.5));
    } else {
      heroTarget.active = false;
    }

    const activeMidCount = Math.min(midIndices.length, resolvedMidLOD);
    const midEnvMesh = midEnvelopeRef.current;
    const midPlatMesh = midPlatformRef.current;
    if (midEnvMesh && midPlatMesh && (activeMidCount > 0 || midEnvMesh.count > 0 || simulateFarThisFrame)) {
      for (let i = 0; i < activeMidCount; i++) {
        const p = posePool[midIndices[i]];
        tempPos.set(p.x, p.y, p.z);
        tempQuat.setFromEuler(tilt.set(p.rx, p.ry, p.rz, 'XYZ'));
        tempScale.setScalar(p.scale);
        dummy.compose(tempPos, tempQuat, tempScale);

        midEnvMesh.setMatrixAt(i, dummy);
        midPlatMesh.setMatrixAt(i, dummy);
        fireTransform.multiplyMatrices(dummy, candleTransforms.cup);
        midCupRef.current?.setMatrixAt(i, fireTransform);
        midPoolRef.current?.setMatrixAt(i, fireTransform);
        fireTransform.multiplyMatrices(dummy, candleTransforms.flame);
        flameRef.current?.setMatrixAt(i, fireTransform);
        fireTransform.multiplyMatrices(dummy, candleTransforms.glow);
        glowRef.current?.setMatrixAt(i, fireTransform);
      }
      midEnvMesh.count = activeMidCount;
      midPlatMesh.count = activeMidCount;
      midEnvMesh.instanceMatrix.needsUpdate = true;
      midPlatMesh.instanceMatrix.needsUpdate = true;
      if (midCupRef.current) {
        midCupRef.current.count = activeMidCount;
        midCupRef.current.instanceMatrix.needsUpdate = true;
      }
      if (midPoolRef.current) {
        midPoolRef.current.count = activeMidCount;
        midPoolRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    const farMesh = farMeshRef.current;
    const activeFarCount = farMesh ? Math.min(farIndices.length, totalCount) : 0;
    if (farMesh && simulateFarThisFrame) {
      const camX = frameCamera.position.x;
      const camZ = frameCamera.position.z;
      for (let i = 0; i < activeFarCount; i++) {
        const p = posePool[farIndices[i]];
        tempPos.set(p.x, p.y, p.z);
        const cdx = p.x - camX;
        const cdz = p.z - camZ;
        const camDist = Math.sqrt(cdx * cdx + cdz * cdz);
        const distanceScaleBoost = Math.min(3.0, 1.0 + camDist * 0.0006);
        tempScale.setScalar(p.scale * distanceScaleBoost);
        tempQuat.identity();
        dummy.compose(tempPos, tempQuat, tempScale);

        farMesh.setMatrixAt(i, dummy);
        fireTransform.multiplyMatrices(dummy, candleTransforms.flame);
        flameRef.current?.setMatrixAt(activeMidCount + i, fireTransform);
        fireTransform.multiplyMatrices(dummy, candleTransforms.glow);
        glowRef.current?.setMatrixAt(activeMidCount + i, fireTransform);
      }
      farMesh.count = activeFarCount;
      farMesh.instanceMatrix.needsUpdate = true;
    }

    if (flameRef.current && (simulateFarThisFrame || activeMidCount > 0)) {
      flameRef.current.count = activeMidCount + activeFarCount;
      flameRef.current.instanceMatrix.needsUpdate = true;
    }
    if (glowRef.current && (simulateFarThisFrame || activeMidCount > 0)) {
      glowRef.current.count = activeMidCount + activeFarCount;
      glowRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!active || totalCount === 0) return null;

  return (
    <group name="tazaungdaing-balloon-show" visible={active} raycast={ignoreRaycast}>
      <group name="near-lod-balloons">
        {Array.from({ length: resolvedNearLOD }).map((_, i) => (
          <group
            key={`near-balloon-${i}`}
            ref={(el) => {
              nearRefs.current[i] = el;
            }}
            visible={false}
          >
            <MyanmarFireBalloon hasLight={false} showCandle={true} floating={false} />
          </group>
        ))}
      </group>

      <group name="mid-lod-balloons">
        <instancedMesh
          key={`mid-env-${resolvedMidLOD}`}
          ref={midEnvelopeRef}
          args={[midEnvelopeGeom, midEnvelopeMat, resolvedMidLOD]}
          count={0}
          frustumCulled={false}
          raycast={ignoreRaycast}
        />
        <instancedMesh
          key={`mid-plat-${resolvedMidLOD}`}
          ref={midPlatformRef}
          args={[midPlatformGeom, midPlatformMat, resolvedMidLOD]}
          count={0}
          frustumCulled={false}
          raycast={ignoreRaycast}
        />
      </group>

      <instancedMesh
        key={`mid-cup-${resolvedMidLOD}`}
        name="balloon-cups"
        ref={midCupRef}
        args={[candleHolderGeometry, candleHolderLitMaterial, resolvedMidLOD]}
        count={0}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        key={`mid-pool-${resolvedMidLOD}`}
        name="balloon-pools"
        ref={midPoolRef}
        args={[candlePoolGeometry, candlePoolLitMaterial, resolvedMidLOD]}
        count={0}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        key={`flames-${totalCount}`}
        name="balloon-flames"
        ref={flameRef}
        args={[flameGeometry, candleFlameMaterial, totalCount]}
        count={0}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        key={`glows-${totalCount}`}
        name="balloon-glows"
        ref={glowRef}
        args={[candleGlowGeometry, candleGlowMaterial, totalCount]}
        count={0}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />

      <group name="far-lod-balloons">
        <instancedMesh
          key={`far-${totalCount}`}
          ref={farMeshRef}
          args={[farEnvelopeGeom, farEnvelopeMat, totalCount]}
          count={0}
          frustumCulled={false}
          raycast={ignoreRaycast}
        />
      </group>
    </group>
  );
}

export default BalloonShow;
