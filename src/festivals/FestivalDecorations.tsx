import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from 'three';
import { MyanmarFireBalloon } from '../components/MyanmarFireBalloon.tsx';
import {
  flameGeometry,
  candleGlowGeometry,
  candleFlameMaterial,
  candleGlowMaterial,
} from '../game/candleModel.ts';
import { type VillageLaunchHub } from '../game/fireBalloonModel.ts';
import { useQualityPreset } from '../game/qualityPreset.ts';
import {
  buildFestivalDecorationPlacements,
  selectFestivalZonesNearFocus,
  type GroundDisplayBalloonPlacement,
  type LanternPostPlacement,
} from './festivalSimulation.ts';

export {
  buildFestivalDecorationPlacements,
  type GroundDisplayBalloonPlacement,
  type LanternPostPlacement,
};

const ignoreRaycast = () => null;
const ZONE_REFRESH_DISTANCE_SQ = 120 * 120;

let sharedPostGeom: CylinderGeometry | null = null;
let sharedLanternGeom: SphereGeometry | null = null;
let sharedPostMat: MeshStandardMaterial | null = null;
let sharedLanternMat: MeshBasicMaterial | null = null;

function getSharedDecorationAssets() {
  if (!sharedPostGeom) {
    sharedPostGeom = new CylinderGeometry(0.045, 0.055, 3.2, 6);
    sharedPostGeom.translate(0, 1.6, 0);
    sharedPostGeom.userData.shared = true;
  }
  if (!sharedLanternGeom) {
    sharedLanternGeom = new SphereGeometry(0.24, 10, 8);
    sharedLanternGeom.scale(1, 1.28, 1);
    sharedLanternGeom.translate(0, 3.15, 0);
    sharedLanternGeom.userData.shared = true;
  }
  if (!sharedPostMat) {
    sharedPostMat = new MeshStandardMaterial({ color: '#8b5e34', roughness: 0.9 });
    sharedPostMat.userData.shared = true;
  }
  if (!sharedLanternMat) {
    sharedLanternMat = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    sharedLanternMat.userData.shared = true;
  }
  return {
    postGeom: sharedPostGeom,
    lanternGeom: sharedLanternGeom,
    postMat: sharedPostMat,
    lanternMat: sharedLanternMat,
  };
}

export interface FestivalDecorationsProps {
  zones: VillageLaunchHub[];
  night?: boolean;
  showBalloons?: boolean;
}

export function FestivalDecorations({ zones, night = true, showBalloons = night }: FestivalDecorationsProps) {
  const preset = useQualityPreset();
  const { camera } = useThree();
  const rootRef = useRef<Group>(null);
  const postMeshRef = useRef<InstancedMesh>(null);
  const lanternMeshRef = useRef<InstancedMesh>(null);
  const flameMeshRef = useRef<InstancedMesh>(null);
  const glowMeshRef = useRef<InstancedMesh>(null);
  const displayGroupRefs = useRef<(Group | null)[]>([]);

  const focusCheckPos = useRef({ x: NaN, z: NaN });
  const [zoneSignature, setZoneSignature] = useState('');
  const activeZonesRef = useRef<VillageLaunchHub[]>([]);
  const elapsedRef = useRef(1);

  useEffect(() => {
    const focus = (camera.userData.viewFocus as { x: number; z: number } | undefined) ?? camera.position;
    focusCheckPos.current.x = focus.x;
    focusCheckPos.current.z = focus.z;
    const selected = selectFestivalZonesNearFocus(
      zones,
      focus.x,
      focus.z,
      preset.maxActiveFestivalZones,
      preset.festivalZoneRadius,
    );
    activeZonesRef.current = selected;
    setZoneSignature(selected.map((z) => z.id).join('|'));
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

  const isLowTier = preset.id === 'mobile' || preset.id === 'low';
  const { posts, displayBalloons } = useMemo(
    () => buildFestivalDecorationPlacements(activeZones, isLowTier),
    [activeZones, isLowTier],
  );

  const visibleDisplayBalloons = useMemo(
    () => displayBalloons.slice(0, preset.maxGroundDisplayBalloons),
    [displayBalloons, preset.maxGroundDisplayBalloons],
  );

  const { postGeom, lanternGeom, postMat, lanternMat } = useMemo(() => getSharedDecorationAssets(), []);

  useLayoutEffect(() => {
    const postMesh = postMeshRef.current;
    const lanternMesh = lanternMeshRef.current;
    const flameMesh = flameMeshRef.current;
    const glowMesh = glowMeshRef.current;
    if (!postMesh || !lanternMesh || !flameMesh || !glowMesh) return;

    const matrix = new Matrix4();
    const flameMatrix = new Matrix4();
    const glowMatrix = new Matrix4();
    const color = new Color();

    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      matrix.makeTranslation(p.x, p.y, p.z);
      postMesh.setMatrixAt(i, matrix);
      lanternMesh.setMatrixAt(i, matrix);
      lanternMesh.setColorAt(i, color.set(p.colorHex));

      flameMatrix.makeScale(1.3, 1.3, 1.3).setPosition(p.x, p.y + 3.48, p.z);
      glowMatrix.makeScale(1.6, 1.6, 1.6).setPosition(p.x, p.y + 3.55, p.z);
      flameMesh.setMatrixAt(i, flameMatrix);
      glowMesh.setMatrixAt(i, glowMatrix);
    }

    postMesh.count = posts.length;
    lanternMesh.count = posts.length;
    flameMesh.count = posts.length;
    glowMesh.count = posts.length;

    postMesh.instanceMatrix.needsUpdate = true;
    lanternMesh.instanceMatrix.needsUpdate = true;
    if (lanternMesh.instanceColor) lanternMesh.instanceColor.needsUpdate = true;
    flameMesh.instanceMatrix.needsUpdate = true;
    glowMesh.instanceMatrix.needsUpdate = true;
  }, [posts]);

  useFrame(({ camera: frameCamera }, dt) => {
    elapsedRef.current += dt;
    if (elapsedRef.current < preset.decorationVisibilityInterval) return;
    elapsedRef.current = 0;

    const focus = (frameCamera.userData.viewFocus as { x: number; z: number } | undefined) ?? frameCamera.position;
    const fx = focus.x;
    const fz = focus.z;

    const mdx = fx - focusCheckPos.current.x;
    const mdz = fz - focusCheckPos.current.z;
    if (Number.isNaN(mdx) || mdx * mdx + mdz * mdz > ZONE_REFRESH_DISTANCE_SQ) {
      focusCheckPos.current.x = fx;
      focusCheckPos.current.z = fz;
      const selected = selectFestivalZonesNearFocus(
        zones,
        fx,
        fz,
        preset.maxActiveFestivalZones,
        preset.festivalZoneRadius,
      );
      const nextSig = selected.map((z) => z.id).join('|');
      if (nextSig !== zoneSignature) {
        activeZonesRef.current = selected;
        setZoneSignature(nextSig);
      }
    }

    if (rootRef.current) {
      const maxDist = isLowTier ? 360 : 650;
      let nearAnyZone = false;
      for (let i = 0; i < activeZones.length; i++) {
        const z = activeZones[i];
        const dx = z.x - fx;
        const dz = z.z - fz;
        const limit = maxDist + z.spreadRadius;
        if (dx * dx + dz * dz < limit * limit) {
          nearAnyZone = true;
          break;
        }
      }
      if (rootRef.current.visible !== nearAnyZone) {
        rootRef.current.visible = nearAnyZone;
      }
    }

    const balloonCutoffSq = isLowTier ? 120 * 120 : 190 * 190;
    for (let i = 0; i < visibleDisplayBalloons.length; i++) {
      const g = displayGroupRefs.current[i];
      if (!g) continue;
      const b = visibleDisplayBalloons[i];
      const dx = b.x - fx;
      const dz = b.z - fz;
      const shouldShow = dx * dx + dz * dz <= balloonCutoffSq;
      if (g.visible !== shouldShow) {
        g.visible = shouldShow;
      }
    }
  });

  if (posts.length === 0) return null;

  return (
    <group ref={rootRef} name="tazaungdaing-festival-decorations" raycast={ignoreRaycast}>
      <instancedMesh
        key={`posts-${posts.length}`}
        name="festival-lantern-posts"
        ref={postMeshRef}
        args={[postGeom, postMat, posts.length]}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        key={`lanterns-${posts.length}`}
        name="festival-hanging-lanterns"
        ref={lanternMeshRef}
        args={[lanternGeom, lanternMat, posts.length]}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        key={`post-flames-${posts.length}`}
        name="festival-post-flames"
        ref={flameMeshRef}
        args={[flameGeometry, candleFlameMaterial, posts.length]}
        visible={night}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      <instancedMesh
        key={`post-glows-${posts.length}`}
        name="festival-post-glows"
        ref={glowMeshRef}
        args={[candleGlowGeometry, candleGlowMaterial, posts.length]}
        visible={night}
        frustumCulled={false}
        dispose={null}
        raycast={ignoreRaycast}
      />
      {showBalloons && (
        <group name="festival-ground-display-balloons">
          {visibleDisplayBalloons.map((b, i) => (
            <group
              key={`${b.zoneId}-display-${i}`}
              ref={(el) => {
                displayGroupRefs.current[i] = el;
              }}
            >
              <MyanmarFireBalloon
                position={[b.x, b.y, b.z]}
                scale={b.scale}
                floating={showBalloons}
                showCandle={showBalloons}
                hasLight={false}
              />
            </group>
          ))}
        </group>
      )}
    </group>
  );
}

export default FestivalDecorations;
