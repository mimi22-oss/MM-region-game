import { memo, useEffect, useState, useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { REGIONS, loadRegionLayout, syncAllWorldEdits } from '../game/editorRegions';
import { normalizeAuthoredRegionId } from '../game/regionObjectsMigration';
import { type LayoutFeature } from '../game/worldLayout';
import { getAssetDefinition } from '../game/assetRegistry';
import { Asset3DInstance } from './Asset3DRenderer';
import { setDynamicWorldObstacles, type DynamicWorldObstacle } from '../game/collision';
import { isAuthoredFeatureModified } from '../game/worldEdits';
import { useThadingyutFestival } from '../game/thadingyutFestival';

/**
 * Loads all dynamic/custom placed features and modified authored features across all regions.
 * Untouched authored features are excluded so the static scene can render them efficiently.
 */
function getActiveDynamicFeatures(): LayoutFeature[] {
  const features: LayoutFeature[] = [];
  try {
    for (const r of REGIONS) {
      const raw = r.id === 'custom'
        ? localStorage.getItem('myanmar-town-world-layout-v1')
        : (localStorage.getItem(`mm-editor-region-v1:${r.id}`) || localStorage.getItem(`mm-editor-region-v1:${normalizeAuthoredRegionId(r.id)}`));
      if (!raw) continue;
      const layout = loadRegionLayout(r.id);
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
function computeObstacles(features: LayoutFeature[], festivalActive: boolean): DynamicWorldObstacle[] {
  const obstacles: DynamicWorldObstacle[] = [];
  for (const f of features) {
    if (!f.points || f.points.length === 0) continue;
    const isFestival = f.assetId === 'cultural:candle-in-holder' || f.assetId === 'cultural:fire-balloon' || f.assetId === 'vehicle:fire-balloon';
    if (!festivalActive && isFestival) continue;
    const pt = f.points[0];
    const def = getAssetDefinition(f.assetId);

    if (def && def.collision.type !== 'none') {
      if (def.collision.type === 'cylinder') {
        obstacles.push({
          id: f.id,
          x: pt.x,
          z: pt.z,
          radius: def.collision.radius ?? 0.8,
        });
      } else {
        const w = f.dimensions?.width ?? def.defaultDimensions.width;
        const d = f.dimensions?.depth ?? def.defaultDimensions.depth;
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
 * Renders a dynamic road or canal ribbon in 3D following modified path vertices.
 */
function DynamicPathRibbon({ feature }: { feature: LayoutFeature }) {
  const geometry = useMemo(() => {
    const pts = feature.points;
    if (!pts || pts.length < 2) return null;
    const isCanal = feature.metadata?.category === 'canal' || feature.metadata?.category === 'drain';
    const width = feature.width || (isCanal ? 4 : 5);
    const halfW = width / 2;
    const vertices: number[] = [];
    const indices: number[] = [];
    const y = isCanal ? 0.08 : 0.14;

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
    }

    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [feature.points, feature.width, feature.metadata?.category]);

  if (!geometry) return null;

  const isCanal = feature.metadata?.category === 'canal' || feature.metadata?.category === 'drain';
  const color = isCanal ? '#4d9395' : '#657371';

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={isCanal ? 0.3 : 0.85}
        metalness={isCanal ? 0.3 : 0.1}
        transparent={isCanal}
        opacity={isCanal ? 0.85 : 1}
      />
    </mesh>
  );
}

/**
 * DynamicWorldObjects:
 * Renders all custom-placed and modified world objects across regions in the real 3D scene.
 * Synchronizes immediately on 2D editor saves via the 'world-layout-updated' window event.
 * Registers dynamic solid obstacle colliders into collision.ts.
 */
export const DynamicWorldObjects = memo(function DynamicWorldObjects() {
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

  // Synchronize dynamic collision bounds into collision.ts
  useEffect(() => {
    const obstacles = computeObstacles(features, festivalActive);
    setDynamicWorldObstacles(obstacles);
    return () => {
      setDynamicWorldObstacles([]);
    };
  }, [features, festivalActive]);

  return (
    <group name="dynamic-world-placed-objects">
      {features.map((feature) => {
        const isFestival = feature.assetId === 'cultural:candle-in-holder' || feature.assetId === 'cultural:fire-balloon' || feature.assetId === 'vehicle:fire-balloon';
        if (!festivalActive && isFestival) return null;
        if (feature.points && feature.points.length >= 2) {
          return <DynamicPathRibbon key={feature.id} feature={feature} />;
        }
        return <Asset3DInstance key={feature.id} feature={feature} />;
      })}
    </group>
  );
});
