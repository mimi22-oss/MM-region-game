import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
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
  PointLight,
  Quaternion,
  Vector2,
  Vector3,
} from 'three';
import { MyanmarFireBalloon } from './MyanmarFireBalloon';
import { candleHolderGeometry,candlePoolGeometry,candleHolderLitMaterial,candlePoolLitMaterial,flameGeometry,candleGlowGeometry,candleFlameMaterial,candleGlowMaterial,CANDLE_LIGHT_COLOR,HOLDER_CANDLE_BASE,HOLDER_CANDLE_SCALE,CANDLE_WICK_TOP } from '../game/candleModel';
import {
  BALLOON_PROFILE,
  VILLAGE_LAUNCH_HUBS,
  MYOTHAR_CONVERGENCE_TARGET,
  type VillageLaunchHub,
} from '../game/fireBalloonModel';

export interface FireBalloonSkyProps {
  /** Balloons launched per village/origin. Default: 400 (400 * 9 = 3600 total!) */
  balloonsPerVillage?: number;
  /** Explicit total count override if desired. */
  count?: number;
  /** Whether the festival night sky is active. When false, nothing is rendered. Default: true */
  active?: boolean;
  /** Maximum altitude in meters before a balloon recycles back down. Default: 540 */
  ceiling?: number;
  /** Lowest launch altitude in meters above local village terrain. Default: 25 */
  minAltitude?: number;
  /** Maximum number of high-detail Near-LOD MyanmarFireBalloon models rendered. Default: 8 */
  maxNearLOD?: number;
  /** Maximum number of Mid-LOD instanced balloons rendered. Default: 120 */
  maxMidLOD?: number;
}

interface SkyBalloonState {
  id: number;
  hub: VillageLaunchHub;
  x: number;
  y: number;
  z: number;
  scale: number;
  riseSpeed: number; // m/s vertical ascent
  vx: number; // horizontal velocity vector towards Myothar
  vz: number;
  swayFreq: number; // aerodynamic oscillation frequency
  swayPhase: number;
  baseYaw: number;
  color: Color;
}

/**
 * FireBalloonSky (မီးပုံးပျံ ကောင်းကင်ယံ)
 *
 * Simulates 3,600 authentic Myanmar candle-powered fire balloons launched from 9 distinct
 * village origins (400 balloons each):
 * 1. ကံပုလဲ (Kanbale)
 * 2. သာစည် (Thar Si)
 * 3. ချင်းဆိုင် (Chin Sai)
 * 4. ဇင်းကလင်း (Zingalin)
 * 5. ထိုမာ (Htomar)
 * 6. သာယာကုန်း (Thar Yar Gone)
 * 7. ထောက်ကြန့် (Htauk Kyant)
 * 8. ကြာအင်း (Kyar Inn)
 * 9. ဝေပုလ္လတောင်တန်းကြီး (Weipula Mountain Range)
 *
 * All balloons naturally ascend and converge across the horizon towards Myothar (မြို့သာဘက်သို့),
 * creating a grand, celestial river of glowing lanterns spanning the entire night sky.
 *
 * Features:
 * - 400 balloons launched per village/origin (3,600 balloons total).
 * - Vectorized convergence trajectories towards Myothar with realistic fan-out dispersion.
 * - Smooth vertical ascent and aerodynamic sway.
 * - Continuous recycling back to native village launch pads at ground level.
 * - High-performance 3-Tier LOD architecture:
 *   * Near LOD (< 75m): Full detailed MyanmarFireBalloon models with candle flame.
 *   * Mid LOD (75m - 280m): Instanced lathe envelopes + wooden baskets (2 draw calls).
 *   * Far LOD (> 280m - 4500m): Instanced glowing lanterns in a single draw call.
 * - Single soft dynamic point light for the closest hero balloon (zero point light explosion).
 * - Non-blocking raycasts: Preserves town, player, vehicle, and camera controls.
 */
export function FireBalloonSky({
  balloonsPerVillage = 400,
  count,
  active = true,
  ceiling = 540,
  minAltitude = 25,
  maxNearLOD = 8,
  maxMidLOD = 120,
}: FireBalloonSkyProps) {
  if (!active) return null;

  const totalBalloons = count ?? balloonsPerVillage * VILLAGE_LAUNCH_HUBS.length;

  return (
    <FireBalloonSkyScene
      totalCount={totalBalloons}
      ceiling={ceiling}
      minAltitude={minAltitude}
      maxNearLOD={maxNearLOD}
      maxMidLOD={maxMidLOD}
    />
  );
}

function FireBalloonSkyScene({
  totalCount,
  ceiling,
  minAltitude,
  maxNearLOD,
  maxMidLOD,
}: {
  totalCount: number;
  ceiling: number;
  minAltitude: number;
  maxNearLOD: number;
  maxMidLOD: number;
}) {
  // References for Near-LOD full MyanmarFireBalloon models
  const nearRefs = useRef<(Group | null)[]>([]);

  // InstancedMesh references for Mid-LOD and Far-LOD
  const midEnvelopeRef = useRef<InstancedMesh>(null);
  const midPlatformRef = useRef<InstancedMesh>(null);
  const farMeshRef = useRef<InstancedMesh>(null);
  const midCupRef=useRef<InstancedMesh>(null),midPoolRef=useRef<InstancedMesh>(null);
  const flameRef=useRef<InstancedMesh>(null),glowRef=useRef<InstancedMesh>(null);
  const fireTransform=useMemo(()=>new Matrix4(),[]),tilt=useMemo(()=>new Euler(),[]);
  const candleTransforms=useMemo(()=>{
    const tip=.27+.7*(HOLDER_CANDLE_BASE+CANDLE_WICK_TOP*HOLDER_CANDLE_SCALE),size=.7*2.2;
    return {cup:new Matrix4().makeScale(.7,.7,.7).setPosition(0,.27,0),
      flame:new Matrix4().makeScale(size,size,size).setPosition(0,tip,0),
      glow:new Matrix4().makeScale(size,size,size).setPosition(0,tip+.065*size,0)};
  },[]);

  // Single soft warm point light that dynamically follows the closest balloon within 32m
  const heroLightRef = useRef<PointLight>(null);

  // Reusable Three.js transform objects (zero GC allocations per frame)
  const dummy = useMemo(() => new Matrix4(), []);
  const tempPos = useMemo(() => new Vector3(), []);
  const tempQuat = useMemo(() => new Quaternion(), []);
  const tempScale = useMemo(() => new Vector3(), []);

  // 1. Generate 3D Geometries matching authentic Myanmar Fire Balloon Profile
  const { midEnvelopeGeom, midPlatformGeom, farEnvelopeGeom } = useMemo(() => {
    const curve = new CatmullRomCurve3(
      BALLOON_PROFILE.map(([r, y]) => new Vector3(r, y, 0)),
    );

    // Mid LOD Lathe (16 radial segments, 25 vertical curve samples)
    const midPoints = Array.from({ length: 25 }, (_, i) => {
      const p = curve.getPoint(i / 24);
      return new Vector2(Math.max(0, p.x), p.y);
    });
    const midEnvelopeGeom = new LatheGeometry(midPoints, 16);

    // Mid LOD Platform (matching dimensions of WoodenPlatform in MyanmarFireBalloon)
    const midPlatformGeom = new BoxGeometry(1.14, 0.1, 0.9).translate(0,.18,0);

    // Far LOD Lathe (8 radial segments, 13 vertical curve samples - ultra lightweight)
    const farPoints = Array.from({ length: 13 }, (_, i) => {
      const p = curve.getPoint(i / 12);
      return new Vector2(Math.max(0, p.x), p.y);
    });
    const farEnvelopeGeom = new LatheGeometry(farPoints, 8);

    return { midEnvelopeGeom, midPlatformGeom, farEnvelopeGeom };
  }, []);

  // 2. High-performance Materials with warm glowing luminescence
  const { midEnvelopeMat, midPlatformMat, farEnvelopeMat } = useMemo(() => {
    const midEnvelopeMat = new MeshStandardMaterial({
      color: '#f59a38',
      emissive: '#ff7e1b',
      emissiveIntensity: 0.45,
      roughness: 0.88,
      metalness: 0.05,
      transparent: true,
      opacity: 0.93,
      side: DoubleSide,
      depthWrite: true,
    });

    const midPlatformMat = new MeshStandardMaterial({
      color: '#8c582f',
      roughness: 0.9,
    });

    const farEnvelopeMat = new MeshBasicMaterial({
      color: '#ffa347',
      transparent: true,
      opacity: 0.88,
      depthWrite: true,
    });

    return { midEnvelopeMat, midPlatformMat, farEnvelopeMat };
  }, []);

  // 3. Initialize balloons distributed evenly across all 9 village hubs
  const balloons = useMemo<SkyBalloonState[]>(() => {
    const list: SkyBalloonState[] = [];
    const numHubs = VILLAGE_LAUNCH_HUBS.length;
    const perHub = Math.floor(totalCount / numHubs);

    let globalId = 0;
    for (let h = 0; h < numHubs; h++) {
      const hub = VILLAGE_LAUNCH_HUBS[h];
      const countForThisHub = h === numHubs - 1 ? totalCount - list.length : perHub;

      for (let i = 0; i < countForThisHub; i++) {
        // Target in Myothar with fan-out spread
        const targetX =
          MYOTHAR_CONVERGENCE_TARGET.x +
          (Math.random() - 0.5) * MYOTHAR_CONVERGENCE_TARGET.fanSpread * 2;
        const targetZ =
          MYOTHAR_CONVERGENCE_TARGET.z +
          (Math.random() - 0.5) * MYOTHAR_CONVERGENCE_TARGET.fanSpread * 2;

        // Origin in the home village/mountain
        const originAngle = Math.random() * Math.PI * 2;
        const originDist = Math.random() * hub.spreadRadius;
        const originX = hub.x + Math.cos(originAngle) * originDist;
        const originZ = hub.z + Math.sin(originAngle) * originDist;

        // Calculate normalized vector towards Myothar
        const dx = targetX - originX;
        const dz = targetZ - originZ;
        const pathDist = Math.max(10, Math.hypot(dx, dz));
        const ux = dx / pathDist;
        const uz = dz / pathDist;

        // Perpendicular normal for lateral dispersion
        const nx = -uz;
        const nz = ux;

        // Flight speed (1.8m/s to 4.2m/s)
        const speed = 1.8 + Math.random() * 2.4;
        const lateralDrift = (Math.random() - 0.5) * 0.45 * speed;

        const vx = ux * speed + nx * lateralDrift;
        const vz = uz * speed + nz * lateralDrift;

        // Random scale (standard 0.85 - 1.6, with giant festival leader balloons 2.5)
        const isGiant = i % 25 === 0;
        const scale = isGiant ? 1.8 + Math.random() * 0.7 : 0.85 + Math.random() * 0.75;

        // Pre-distribute progress along flight path (0.0 to 1.0) so the entire sky is immediately filled!
        const progress = Math.random();
        const initialX = originX + dx * progress + nx * (Math.random() - 0.5) * 180;
        const initialZ = originZ + dz * progress + nz * (Math.random() - 0.5) * 180;

        const verticalSpan = ceiling - (hub.groundY + minAltitude);
        const initialY = hub.groundY + minAltitude + progress * verticalSpan;

        const palette = hub.palette;
        const colorHex = palette[i % palette.length];

        list.push({
          id: globalId++,
          hub,
          x: initialX,
          y: initialY,
          z: initialZ,
          scale,
          riseSpeed: 1.1 + Math.random() * 1.8,
          vx,
          vz,
          swayFreq: 0.35 + Math.random() * 0.45,
          swayPhase: Math.random() * Math.PI * 2,
          baseYaw: Math.atan2(vx, vz) + (Math.random() - 0.5) * 0.2,
          color: new Color(colorHex),
        });
      }
    }

    return list;
  }, [totalCount, ceiling, minAltitude]);

  // Set instance colors on far mesh once
  useMemo(() => {
    if (!farMeshRef.current) return;
    balloons.forEach((b, i) => {
      farMeshRef.current?.setColorAt(i, b.color);
    });
    if (farMeshRef.current.instanceColor) {
      farMeshRef.current.instanceColor.needsUpdate = true;
    }
  }, [balloons]);

  // 4. Main Simulation & 3-Tier LOD Loop (60 FPS in useFrame)
  useFrame(({ clock, camera }, delta) => {
    const dt = Math.min(delta, 0.1);
    const t = clock.elapsedTime;

    // Retrieve active camera focus (follows player or free camera in Myanmar Town)
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? {
      x: camera.position.x,
      z: camera.position.z,
    };

    const nearCandidates: { b: SkyBalloonState; distSq: number }[] = [];
    const midCandidates: SkyBalloonState[] = [];
    const farCandidates: SkyBalloonState[] = [];

    const nearDistSq = 75 * 75;
    const midDistSq = 280 * 280;

    // --- A. Physics Simulation & Village Recycling ---
    for (let i = 0; i < totalCount; i++) {
      const b = balloons[i];

      // Natural rising
      b.y += b.riseSpeed * dt;

      // Trajectory towards Myothar + aerodynamic lateral sway
      const sway = Math.sin(t * b.swayFreq + b.swayPhase) * 0.55;
      b.x += (b.vx + sway * 0.3) * dt;
      b.z += (b.vz + sway * 0.3) * dt;

      // Check if balloon reached ceiling OR passed Myothar convergence zone
      const distToMyothar = Math.hypot(
        b.x - MYOTHAR_CONVERGENCE_TARGET.x,
        b.z - MYOTHAR_CONVERGENCE_TARGET.z,
      );

      // Recycling condition:
      // When balloon exceeds sky ceiling OR passes beyond Myothar north-west perimeter:
      // Recycle back down to its native village launch pad!
      if (b.y > ceiling || (b.y > 180 && distToMyothar < 160)) {
        const hub = b.hub;
        b.y = hub.groundY + minAltitude + Math.random() * 35;

        const originAngle = Math.random() * Math.PI * 2;
        const originDist = Math.random() * hub.spreadRadius;
        b.x = hub.x + Math.cos(originAngle) * originDist;
        b.z = hub.z + Math.sin(originAngle) * originDist;

        // Recalculate target in Myothar
        const targetX =
          MYOTHAR_CONVERGENCE_TARGET.x +
          (Math.random() - 0.5) * MYOTHAR_CONVERGENCE_TARGET.fanSpread * 2;
        const targetZ =
          MYOTHAR_CONVERGENCE_TARGET.z +
          (Math.random() - 0.5) * MYOTHAR_CONVERGENCE_TARGET.fanSpread * 2;

        const dx = targetX - b.x;
        const dz = targetZ - b.z;
        const pathDist = Math.max(10, Math.hypot(dx, dz));
        const ux = dx / pathDist;
        const uz = dz / pathDist;
        const nx = -uz;
        const nz = ux;

        const speed = 1.8 + Math.random() * 2.4;
        const lateralDrift = (Math.random() - 0.5) * 0.45 * speed;

        b.vx = ux * speed + nx * lateralDrift;
        b.vz = uz * speed + nz * lateralDrift;
        b.swayPhase = Math.random() * Math.PI * 2;
        b.riseSpeed = 1.1 + Math.random() * 1.8;
      }

      // --- B. LOD Categorization ---
      const dx = b.x - focus.x;
      const dz = b.z - focus.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < nearDistSq && b.y < 140) {
        nearCandidates.push({ b, distSq });
      } else if (distSq < midDistSq) {
        midCandidates.push(b);
      } else {
        farCandidates.push(b);
      }
    }

    // --- C. Update Near LOD (Full MyanmarFireBalloon Models) ---
    nearCandidates.sort((a, b) => a.distSq - b.distSq);
    const activeNearCount = Math.min(nearCandidates.length, maxNearLOD);

    for (let i = activeNearCount; i < nearCandidates.length; i++) {
      midCandidates.push(nearCandidates[i].b);
    }

    for (let i = 0; i < maxNearLOD; i++) {
      const group = nearRefs.current[i];
      if (!group) continue;

      if (i < activeNearCount) {
        const b = nearCandidates[i].b;
        group.visible = true;
        group.position.set(b.x, b.y, b.z);
        group.scale.setScalar(b.scale);

        // Aerodynamic tilt as balloon travels
        group.rotation.set(
          0.025 * Math.cos(t * 0.6 + b.swayPhase),
          b.baseYaw,
          0.03 * Math.sin(t * 0.7 + b.swayPhase),
        );
      } else {
        group.visible = false;
      }
    }

    // Dynamic Single Hero Light: illuminates surroundings near the closest balloon
    if (heroLightRef.current) {
      if (activeNearCount > 0 && nearCandidates[0].distSq < 32 * 32) {
        const hero = nearCandidates[0].b;
        heroLightRef.current.position.set(hero.x, hero.y + .6*hero.scale, hero.z);
        const flicker = 1.0 + 0.08 * Math.sin(t * 7.5);
        heroLightRef.current.intensity = 3.8 * flicker;
      } else {
        heroLightRef.current.intensity = 0;
      }
    }

    // --- D. Update Mid LOD (Instanced Envelopes & Platforms) ---
    const activeMidCount = Math.min(midCandidates.length, maxMidLOD);
    for (let i = activeMidCount; i < midCandidates.length; i++) {
      farCandidates.push(midCandidates[i]);
    }

    const midEnvMesh = midEnvelopeRef.current;
    const midPlatMesh = midPlatformRef.current;
    if (midEnvMesh && midPlatMesh) {
      for (let i = 0; i < activeMidCount; i++) {
        const b = midCandidates[i];

        tempPos.set(b.x, b.y, b.z);
        tempQuat.setFromEuler(tilt.set(
          0.02 * Math.cos(t * 0.5 + b.swayPhase), b.baseYaw,
          0.025 * Math.sin(t * 0.6 + b.swayPhase), 'XYZ'));
        tempScale.setScalar(b.scale);
        dummy.compose(tempPos, tempQuat, tempScale);

        midEnvMesh.setMatrixAt(i, dummy);
        midPlatMesh.setMatrixAt(i, dummy);
        fireTransform.multiplyMatrices(dummy,candleTransforms.cup);
        midCupRef.current?.setMatrixAt(i,fireTransform);midPoolRef.current?.setMatrixAt(i,fireTransform);
        fireTransform.multiplyMatrices(dummy,candleTransforms.flame);flameRef.current?.setMatrixAt(i,fireTransform);
        fireTransform.multiplyMatrices(dummy,candleTransforms.glow);glowRef.current?.setMatrixAt(i,fireTransform);
      }

      midEnvMesh.count = activeMidCount;
      midPlatMesh.count = activeMidCount;
      midEnvMesh.instanceMatrix.needsUpdate = true;
      midPlatMesh.instanceMatrix.needsUpdate = true;
      for(const mesh of [midCupRef.current,midPoolRef.current])if(mesh){mesh.count=activeMidCount;mesh.instanceMatrix.needsUpdate=true;}
    }

    // --- E. Update Far LOD (Single-Draw-Call Atmospheric Horizon Swarm) ---
    const farMesh = farMeshRef.current;
    if (farMesh) {
      const activeFarCount = Math.min(farCandidates.length, totalCount);

      for (let i = 0; i < activeFarCount; i++) {
        const b = farCandidates[i];

        tempPos.set(b.x, b.y, b.z);

        // Distance compensation: keep distant mountain-ridge lanterns clearly visible
        const camDist = Math.hypot(b.x - camera.position.x, b.z - camera.position.z);
        const distanceScaleBoost = Math.min(3.2, 1.0 + camDist * 0.00065);
        const finalScale = b.scale * distanceScaleBoost;

        tempScale.setScalar(finalScale);
        tempQuat.identity();
        dummy.compose(tempPos, tempQuat, tempScale);

        farMesh.setMatrixAt(i, dummy);
        fireTransform.multiplyMatrices(dummy,candleTransforms.flame);flameRef.current?.setMatrixAt(activeMidCount+i,fireTransform);
        fireTransform.multiplyMatrices(dummy,candleTransforms.glow);glowRef.current?.setMatrixAt(activeMidCount+i,fireTransform);
      }

      farMesh.count = activeFarCount;
      farMesh.instanceMatrix.needsUpdate = true;
      for(const mesh of [flameRef.current,glowRef.current])if(mesh){mesh.count=activeMidCount+activeFarCount;mesh.instanceMatrix.needsUpdate=true;}
    }
  });

  return (
    <group name="fire-balloon-sky" raycast={() => null}>
      {/* 1. Single Shared Soft Warm Light for Nearest Hero Balloon (< 32m) */}
      <pointLight
        ref={heroLightRef}
        color={CANDLE_LIGHT_COLOR}
        intensity={0}
        distance={24}
        decay={1.8}
      />

      {/* 2. Near LOD: Reusable pool of authentic MyanmarFireBalloon components */}
      <group name="near-lod-balloons">
        {Array.from({ length: maxNearLOD }).map((_, i) => (
          <group
            key={`near-balloon-${i}`}
            ref={(el) => {
              nearRefs.current[i] = el;
            }}
            visible={false}
          >
            <MyanmarFireBalloon
              hasLight={false}
              showCandle={true}
              floating={false}
            />
          </group>
        ))}
      </group>

      {/* 3. Mid LOD: Instanced Envelope and Platform (2 Draw Calls total) */}
      <group name="mid-lod-balloons">
        <instancedMesh
          ref={midEnvelopeRef}
          args={[midEnvelopeGeom, midEnvelopeMat, maxMidLOD]}
          count={0}
          frustumCulled={false}
        />
        <instancedMesh
          ref={midPlatformRef}
          args={[midPlatformGeom, midPlatformMat, maxMidLOD]}
          count={0}
          frustumCulled={false}
        />
      </group>

      {/* Shared radiant cups and flame batches: no per-balloon point lights. */}
      <instancedMesh name="balloon-cups" ref={midCupRef} args={[candleHolderGeometry,candleHolderLitMaterial,maxMidLOD]} count={0} frustumCulled={false} dispose={null} raycast={()=>null}/>
      <instancedMesh name="balloon-pools" ref={midPoolRef} args={[candlePoolGeometry,candlePoolLitMaterial,maxMidLOD]} count={0} frustumCulled={false} dispose={null} raycast={()=>null}/>
      <instancedMesh name="balloon-flames" ref={flameRef} args={[flameGeometry,candleFlameMaterial,totalCount]} count={0} frustumCulled={false} dispose={null} raycast={()=>null}/>
      <instancedMesh name="balloon-glows" ref={glowRef} args={[candleGlowGeometry,candleGlowMaterial,totalCount]} count={0} frustumCulled={false} dispose={null} raycast={()=>null}/>

      {/* 4. Far LOD: Instanced Atmospheric Horizon Swarm (1 Single Draw Call for 3,400+ lanterns) */}
      <group name="far-lod-balloons">
        <instancedMesh
          ref={farMeshRef}
          args={[farEnvelopeGeom, farEnvelopeMat, totalCount]}
          count={0}
          frustumCulled={false}
        />
      </group>
    </group>
  );
}

export default FireBalloonSky;
