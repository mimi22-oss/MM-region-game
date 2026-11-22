import { memo, useEffect, useState, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import {
  getEditableRegionIds,
  loadStoredRegionLayout,
  normalizeAuthoredRegionId,
  syncAllWorldEdits,
} from '../game/worldEditsSync';
import { type LayoutFeature } from '../game/worldLayout';
import { getAssetDefinition } from '../game/assetRegistry';
import { Asset3DInstance } from './Asset3DRenderer';
import { setDynamicWorldObstacles, type DynamicWorldObstacle } from '../game/collision';
import { isAuthoredFeatureModified } from '../game/worldEdits';
import { useThadingyutFestival } from '../game/thadingyutFestival';
import { areBalloonsVisibleAtMinute } from '../game/environmentTime';
import { getBuiltInEdit } from '../game/builtInAssetEdits';
import { angle, ward } from '../data/ward';
import { mountainHeight } from '../game/mountainTerrain';

const allMountainPeaks = [...ward.mountains, ...ward.weipula.peaks];
const cosA = Math.cos(angle);
const sinA = Math.sin(angle);

function resolveFeatureElevation(feature: LayoutFeature): number {
  if (typeof feature.elevationY === 'number' && Number.isFinite(feature.elevationY)) {
    return feature.elevationY;
  }
  const pt = feature.points?.[0];
  if (!pt) return 0;
  const u = pt.x * cosA - pt.z * sinA;
  const v = pt.x * sinA + pt.z * cosA;
  if (v > 4100 || u < -410) {
    return mountainHeight(u, v, allMountainPeaks);
  }
  return 0;
}

/**
 * Loads all dynamic/custom placed features and modified authored features across all regions.
 * Untouched authored features are excluded so the static scene can render them efficiently.
 */
function getActiveDynamicFeatures(): LayoutFeature[] {
  const features: LayoutFeature[] = [];
  try {
    for (const id of getEditableRegionIds()) {
      const raw = id === 'custom'
        ? localStorage.getItem('myanmar-town-world-layout-v1')
        : (localStorage.getItem(`mm-editor-region-v1:${id}`) || localStorage.getItem(`mm-editor-region-v1:${normalizeAuthoredRegionId(id)}`));
      if (!raw) continue;
      const layout = loadStoredRegionLayout(id);
      if (layout && Array.isArray(layout.features)) {
        for (const f of layout.features) {
          if (!f.metadata?.authored) {
            // Newly placed custom feature
            features.push(f);
          } else if (isAuthoredFeatureModified(f)) {
            // Modified authored feature (moved, rotated, edited, recolored)
            features.push(f);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error reading dynamic world features:', err);
  }
  return features;
}

/**
 * Computes collision obstacles from dynamic layout features.
 */
function computeObstacles(
  features: LayoutFeature[],
  festivalActive: boolean,
  balloonsVisible: boolean,
): DynamicWorldObstacle[] {
  const obstacles: DynamicWorldObstacle[] = [];
  for (const f of features) {
    if (!f.points || f.points.length === 0) continue;
    const isBalloon = f.assetId === 'cultural:fire-balloon' || f.assetId === 'vehicle:fire-balloon';
    const isFestival = f.assetId === 'cultural:candle-in-holder' || isBalloon;
    if (!festivalActive && isFestival) continue;
    if (!balloonsVisible && isBalloon) continue;
    const pt = f.points[0];
    const def = getAssetDefinition(f.assetId);
    const edit = def?.customModel ? undefined : getBuiltInEdit(f.assetId);
    const sx = (Array.isArray(f.scale) ? f.scale[0] : (f.scale ?? 1)) * (edit?.scale[0] ?? 1);
    const sz = (Array.isArray(f.scale) ? f.scale[2] : (f.scale ?? 1)) * (edit?.scale[2] ?? 1);

    if (def && def.collision.type !== 'none') {
      if (def.collision.type === 'cylinder') {
        obstacles.push({
          id: f.id,
          x: pt.x,
          z: pt.z,
          radius: (def.collision.radius ?? 0.8) * Math.max(sx, sz),
        });
      } else {
        const w = (f.dimensions?.width ?? def.defaultDimensions.width) * sx;
        const d = (f.dimensions?.depth ?? def.defaultDimensions.depth) * sz;
        obstacles.push({
          id: f.id,
          x: pt.x,
          z: pt.z,
          width: w,
          depth: d,
          rotation: f.rotation ?? 0,
        });
      }
    } else if (!def && f.kind !== 'road' && f.kind !== 'ward' && f.kind !== 'block' && f.points.length === 1) {
      // Default collision box for custom placed generic objects
      const size = f.size ?? 8;
      obstacles.push({
        id: f.id,
        x: pt.x,
        z: pt.z,
        width: size,
        depth: size,
        rotation: f.rotation ?? 0,
      });
    }
  }
  return obstacles;
}

/**
 * Renders a dynamic road, canal, or elevated walkable 3D bridge ribbon following drawn path vertices.
 */
function DynamicPathRibbon({ feature }: { feature: LayoutFeature }) {
  const isCanal = feature.metadata?.category === 'canal' || feature.metadata?.category === 'drain';
  const isBridge = feature.metadata?.category === 'bridge' || feature.assetId === 'infrastructure:bridge';
  const baseElevation = typeof feature.elevationY === 'number' && Number.isFinite(feature.elevationY)
    ? feature.elevationY
    : (isBridge ? 2.8 : 0);

  const ribbon = useMemo(() => {
    const pts = feature.points;
    if (!pts || pts.length < 2) return null;
    const width = feature.width || (isCanal ? 4 : isBridge ? 8 : 5);
    const halfW = width / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const railVerts: number[] = [];
    const railIndices: number[] = [];
    const piers: Array<{ x: number; y: number; z: number; h: number; yaw: number; w: number }> = [];
    const y = isCanal ? baseElevation + 0.08 : isBridge ? baseElevation + 0.2 : baseElevation + 0.14;

    for (let i = 0; i < pts.length; i++) {
      let dirX = 0, dirZ = 0;
      if (i === 0) {
        dirX = pts[1].x - pts[0].x;
        dirZ = pts[1].z - pts[0].z;
      } else if (i === pts.length - 1) {
        dirX = pts[i].x - pts[i - 1].x;
        dirZ = pts[i].z - pts[i - 1].z;
      } else {
        dirX = pts[i + 1].x - pts[i - 1].x;
        dirZ = pts[i + 1].z - pts[i - 1].z;
      }
      const len = Math.hypot(dirX, dirZ) || 1;
      const normX = -dirZ / len;
      const normZ = dirX / len;

      vertices.push(pts[i].x + normX * halfW, y, pts[i].z + normZ * halfW);
      vertices.push(pts[i].x - normX * halfW, y, pts[i].z - normZ * halfW);

      if (i < pts.length - 1) {
        const base = i * 2;
        indices.push(base, base + 1, base + 2);
        indices.push(base + 1, base + 3, base + 2);
      }

      if (isBridge && i < pts.length - 1) {
        const ax = pts[i].x, az = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z;
        const segDx = bx - ax, segDz = bz - az;
        const segLen = Math.hypot(segDx, segDz) || 1;
        const nx = -segDz / segLen, nz = segDx / segLen;
        for (const side of [-1, 1]) {
          const ri = railVerts.length / 3;
          railVerts.push(
            ax + nx * side * halfW, y + 0.05, az + nz * side * halfW,
            bx + nx * side * halfW, y + 0.05, bz + nz * side * halfW,
            ax + nx * side * halfW, y + 0.95, az + nz * side * halfW,
            bx + nx * side * halfW, y + 0.95, bz + nz * side * halfW,
          );
          railIndices.push(ri, ri + 1, ri + 2, ri + 1, ri + 3, ri + 2);
        }
        const pierCount = Math.max(1, Math.floor(segLen / 14));
        const yaw = Math.atan2(segDx, segDz);
        for (let p = 0; p <= pierCount; p++) {
          const t = p / pierCount;
          const px = ax + segDx * t, pz = az + segDz * t;
          const h = Math.max(1.2, y + 0.5);
          piers.push({ x: px, y: y - h / 2, z: pz, h, yaw, w: Math.min(4.6, width * 0.55) });
        }
      }
    }

    const deckGeom = new BufferGeometry();
    deckGeom.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    deckGeom.setIndex(indices);
    deckGeom.computeVertexNormals();

    let railGeom: BufferGeometry | null = null;
    if (isBridge && railVerts.length > 0) {
      railGeom = new BufferGeometry();
      railGeom.setAttribute('position', new Float32BufferAttribute(railVerts, 3));
      railGeom.setIndex(railIndices);
      railGeom.computeVertexNormals();
    }

    return { deckGeom, railGeom, piers };
  }, [feature.points, feature.width, isCanal, isBridge, baseElevation]);

  useEffect(() => () => {
    ribbon?.deckGeom.dispose();
    ribbon?.railGeom?.dispose();
  }, [ribbon]);

  if (!ribbon) return null;

  const color = feature.color || (isCanal ? '#4d9395' : isBridge ? '#52585c' : '#657371');

  return (
    <group name={`dynamic-path-${feature.id}`}>
      <mesh geometry={ribbon.deckGeom} userData={!isCanal ? { walkable: true } : undefined} receiveShadow>
        <meshStandardMaterial
          color={color}
          roughness={isCanal ? 0.3 : 0.85}
          metalness={isCanal ? 0.3 : 0.1}
          transparent={isCanal}
          opacity={isCanal ? 0.85 : 1}
        />
      </mesh>
      {ribbon.railGeom && (
        <mesh geometry={ribbon.railGeom}>
          <meshStandardMaterial color={feature.roofColor || '#cbd5e1'} roughness={0.7} side={2} />
        </mesh>
      )}
      {ribbon.piers.map((p, idx) => (
        <mesh key={idx} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]} castShadow receiveShadow>
          <boxGeometry args={[p.w, p.h, 1.4]} />
          <meshStandardMaterial color="#7d786d" roughness={0.92} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * DynamicWorldObjects:
 * Renders all custom-placed and modified world objects across regions in the real 3D scene.
 * Synchronizes immediately on 2D editor saves via the 'world-layout-updated' window event.
 * Registers dynamic solid obstacle colliders into collision.ts.
 */
export const DynamicWorldObjects = memo(function DynamicWorldObjects({ minute = 780 }: { minute?: number }) {
  const [features, setFeatures] = useState<LayoutFeature[]>(() => {
    syncAllWorldEdits();
    return getActiveDynamicFeatures();
  });

  useEffect(() => {
    const handleUpdate = () => {
      syncAllWorldEdits();
      const next = getActiveDynamicFeatures();
      setFeatures(next);
    };

    window.addEventListener('world-layout-updated', handleUpdate);
    return () => {
      window.removeEventListener('world-layout-updated', handleUpdate);
    };
  }, []);

  const festivalActive = useThadingyutFestival();
  const balloonsVisible = areBalloonsVisibleAtMinute(minute);

  // Synchronize dynamic collision bounds into collision.ts
  useEffect(() => {
    const obstacles = computeObstacles(features, festivalActive, balloonsVisible);
    setDynamicWorldObstacles(obstacles);
    return () => {
      setDynamicWorldObstacles([]);
    };
  }, [features, festivalActive, balloonsVisible]);

  return (
    <group name="dynamic-world-placed-objects">
      {features.map((feature) => {
        const isBalloon = feature.assetId === 'cultural:fire-balloon' || feature.assetId === 'vehicle:fire-balloon';
        const isFestival = feature.assetId === 'cultural:candle-in-holder' || isBalloon;
        if (!festivalActive && isFestival) return null;
        if (!balloonsVisible && isBalloon) return null;
        if (feature.points && feature.points.length >= 2) {
          return <DynamicPathRibbon key={feature.id} feature={feature} />;
        }
        const pt = feature.points[0];
        const y = resolveFeatureElevation(feature);
        return (
          <Asset3DInstance
            key={feature.id}
            feature={feature}
            position={pt ? [pt.x, y, pt.z] : undefined}
          />
        );
      })}
    </group>
  );
});
