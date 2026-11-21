import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { Group } from 'three';
import { MapDataset, type MapDatasetConfig, type MapTileViewProps } from './MapDataset';
import { ChinTraditionalHouseBatch, type ChinHouseBatchItem } from './ChinTraditionalHouse';
import { projectMapPoint } from '../game/mapProjection';
import { registerGroundRegion, releaseGroundRegion } from '../game/groundSurface';
import {
  registerStreamedChunk,
  unregisterStreamedChunk,
  type StreamedBuildingRecord,
} from '../game/streamedChunkRegistry';
import { getChinHouseAssetCache } from '../game/chinHouseAssets';
import { buildWeipulaChinStairCorridors } from '../game/weipulaChinVillageLayout';
import type { TerrainPeak } from '../game/mountainTerrain';
import type { MapLabel } from '../game/mapLabels';
import datasetConfig from '../data/weipulaChinVillageDataset.json';

function WeipulaChinVillageTile({ tile, data, projection }: MapTileViewProps) {
  const { scene } = useThree();
  const walkableGroupRef = useRef<Group>(null);

  const { houses, buildings } = useMemo(() => {
    const houseList: ChinHouseBatchItem[] = [];
    const buildingList: StreamedBuildingRecord[] = [];

    for (const f of data.features) {
      const p = (f.properties ?? {}) as Record<string, unknown>;
      const anchorGeo = Array.isArray(p.anchorGeo) ? (p.anchorGeo as [number, number]) : null;
      if (!anchorGeo || anchorGeo.length < 2) continue;

      const world = projectMapPoint(projection, anchorGeo[0], anchorGeo[1]);
      const id = String(f.id);
      const width = Number(p.width ?? 8.2);
      const depth = Number(p.depth ?? 7.2);
      const height = Number(p.height ?? 3.8);
      const rotation = Number(p.rotation ?? 0);
      const baseY = Number(p.baseY ?? 0);
      const wallColor = String(p.wallColor ?? '#6a482d');
      const roofColor = String(p.roofColor ?? '#7d3c2e');
      const hornbillScale = Number(p.hornbillScale ?? 1.08);
      const terraceWidth = Number(p.terraceWidth ?? 22.3);
      const terraceDepth = Number(p.terraceDepth ?? depth + 5.4);
      const isChiefHouse = Boolean(p.isChiefHouse);
      const isClinic = Boolean(p.isClinic);

      houseList.push({
        id,
        x: world.x,
        z: world.z,
        baseY,
        width,
        depth,
        height,
        rotation,
        wallColor,
        roofColor,
        hornbillScale,
        terraceWidth,
        terraceDepth,
        isChiefHouse,
        isClinic,
      });

      buildingList.push({
        id,
        name: String(p.name ?? id),
        x: world.x,
        z: world.z,
        width,
        depth: Math.max(2.4, depth - 2.4),
        height,
        area: width * depth,
        wallColor,
        roofColor,
        rotation,
        houseLength: depth,
        houseWidth: width,
        wallHeight: height,
        roofHeight: 1.6,
        polygonPoints: [],
        relativePoints: [],
        customComponent: isChiefHouse ? 'chin-chief-house' : isClinic ? 'chin-clinic' : null,
        privateHome: Boolean(p.privateHome ?? true),
      });
    }

    return { houses: houseList, buildings: buildingList };
  }, [data.features, projection]);

  useEffect(() => {
    const tileKey = `weipula-chin-village:${tile.id}`;
    const groundKey = `weipula-chin-village-ground:${tile.id}`;
    const labels: MapLabel[] =
      tile.id === '000000'
        ? [
            {
              id: datasetConfig.label.id,
              name: datasetConfig.label.text,
              x: datasetConfig.label.x,
              z: datasetConfig.label.z,
              kind: 'place',
              priority: 76,
            },
          ]
        : [];

    registerStreamedChunk(tileKey, {
      regionId: 'weipula-chin-village',
      buildings,
      labels,
    });

    if (walkableGroupRef.current) {
      registerGroundRegion(scene, groundKey, walkableGroupRef.current);
    }

    return () => {
      // Release ground index before React tears down meshes, and unregister tile collision/labels
      releaseGroundRegion(scene, groundKey);
      unregisterStreamedChunk(tileKey);
    };
  }, [buildings, scene, tile.id]);

  return (
    <ChinTraditionalHouseBatch
      houses={houses}
      name={`tile-weipula-chin-village-${tile.id}`}
      walkableGroupRef={walkableGroupRef}
    />
  );
}

const mapConfig: MapDatasetConfig = {
  manifest: datasetConfig.manifest,
  projection: datasetConfig.projection as MapDatasetConfig['projection'],
};

/**
 * Streamed 100-house terraced Chin hillside village (`မဟာဝေပုလ္လ ချင်းလှေကားထစ်ရွာ`)
 * mounted on Maha Weipula's northeastern mountainside around (-1220.837, 5398.042).
 *
 * Uses bounded JSON tiles (`MapDataset`), Singleton GPU asset caching (`getChinHouseAssetCache`),
 * and full collision / walkable-terrace / label registration & release per tile lifetime.
 */
export function WeipulaChinVillageTiles({ peaks }: { peaks: readonly TerrainPeak[] }) {
  const { scene } = useThree();
  const c = getChinHouseAssetCache();
  const stairsRef = useRef<Group>(null);
  const stairCorridors = useMemo(() => buildWeipulaChinStairCorridors(peaks), [peaks]);

  useEffect(() => {
    if (stairsRef.current) {
      registerGroundRegion(scene, 'weipula-chin-village-stairs', stairsRef.current);
    }
    return () => {
      releaseGroundRegion(scene, 'weipula-chin-village-stairs');
    };
  }, [scene]);

  return (
    <group name="weipula-midslope-chin-terraced-village">
      <MapDataset config={mapConfig} view={WeipulaChinVillageTile} radiusMeters={1450} />

      {/* Walkable hillside stone stair corridors linking Tiers 1 -> 10 */}
      <group ref={stairsRef} name="weipula-chin-village-stair-corridors">
        {stairCorridors.map(seg => (
          <group
            key={seg.id}
            position={[seg.x, seg.y, seg.z]}
            rotation={[0, seg.rotation, 0]}
          >
            <mesh
              position={[0, -7.0, 0]}
              rotation={[-seg.pitch, 0, 0]}
              scale={[seg.width + 0.6, 13.6, seg.hyp + 0.6]}
              geometry={c.unitBoxGeo}
              material={c.retainingWallMat}
            />
            <mesh
              userData={{ walkable: true }}
              rotation={[-seg.pitch, 0, 0]}
              scale={[seg.width, 0.34, seg.hyp + 1.0]}
              geometry={c.unitBoxGeo}
              material={c.terraceDeckMat}
              receiveShadow
            />
          </group>
        ))}
      </group>
    </group>
  );
}
