import { spatialIndex } from './spatialIndex.ts';
import { projectMapPoint, type MapProjection } from './mapProjection.ts';
import type { MapTilePayload } from './mapTileStore.ts';
import type { MapLabel } from './mapLabels.ts';
import type { RoadPlot } from '../data/types.ts';

export type StreamedBuildingRecord = {
  id: string;
  osmId?: number;
  osmType?: string;
  name: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  area: number;
  wallColor: string;
  roofColor: string;
  rotation: number;
  houseLength: number;
  houseWidth: number;
  wallHeight: number;
  roofHeight: number;
  polygonPoints: [number, number][];
  relativePoints: [number, number][];
  customComponent?: string | null;
  privateHome?: boolean;
};

export type StreamedRoadPolyline = {
  id: string;
  highway: string;
  name: string;
  worldPoints: [number, number][];
  width: number;
};

export type StreamedTreeRecord = {
  id: string;
  x: number;
  z: number;
  radius: number;
  variant: 'canopy' | 'large';
};

export type DecodedStreamedTile = {
  buildings: StreamedBuildingRecord[];
  roads: StreamedRoadPolyline[];
  roadPlots: RoadPlot[];
  trees: StreamedTreeRecord[];
  labels: MapLabel[];
};

export type StreamedChunkRegistration = {
  regionId: string;
  buildings?: StreamedBuildingRecord[];
  trees?: StreamedTreeRecord[];
  roadPlots?: RoadPlot[];
  roads?: StreamedRoadPolyline[];
  labels?: MapLabel[];
};

type SpatialColliderBuilding = {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation: number;
  privateHome: boolean;
};

type SpatialColliderTree = {
  id: string;
  x: number;
  z: number;
  radius: number;
};

type LoadingRegionZone = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const PLAYER_RADIUS_DEFAULT = 0.4;

const chunks = new Map<string, Required<StreamedChunkRegistration>>();
const pendingTileZones = new Map<string, LoadingRegionZone[]>();
const listeners = new Set<() => void>();

let buildingLookup: ((x: number, z: number) => readonly SpatialColliderBuilding[]) | null = null;
let treeLookup: ((x: number, z: number) => readonly SpatialColliderTree[]) | null = null;
let privateHomeIdsCache = new Set<string>();
let buildingCollidersTotal = 0;
let treeCollidersTotal = 0;
let roadPlotsTotal = 0;
let cachedLabels: MapLabel[] = [];
let registryVersion = 0;

function rebuildIndexes() {
  const allBuildings: SpatialColliderBuilding[] = [];
  const allTrees: SpatialColliderTree[] = [];
  const nextPrivateHomes = new Set<string>();
  const nextLabels: MapLabel[] = [];
  let plotsCount = 0;

  for (const chunk of chunks.values()) {
    for (const b of chunk.buildings) {
      allBuildings.push({
        id: b.id,
        x: b.x,
        z: b.z,
        width: b.width,
        depth: b.depth,
        rotation: b.rotation,
        privateHome: Boolean(b.privateHome),
      });
      if (b.privateHome) nextPrivateHomes.add(b.id);
    }
    for (const t of chunk.trees) {
      allTrees.push({ id: t.id, x: t.x, z: t.z, radius: t.radius });
    }
    for (const label of chunk.labels) {
      nextLabels.push(label);
    }
    plotsCount += chunk.roadPlots.length;
  }

  privateHomeIdsCache = nextPrivateHomes;
  buildingCollidersTotal = allBuildings.length;
  treeCollidersTotal = allTrees.length;
  roadPlotsTotal = plotsCount;
  cachedLabels = nextLabels;

  buildingLookup = allBuildings.length
    ? spatialIndex(allBuildings, (h) => ({
        x: h.x,
        z: h.z,
        radius: Math.hypot(h.width / 2 + 1.6, h.depth / 2 + 2.6) + PLAYER_RADIUS_DEFAULT,
      }))
    : null;
  treeLookup = allTrees.length
    ? spatialIndex(allTrees, (t) => ({
        x: t.x,
        z: t.z,
        radius: t.radius + PLAYER_RADIUS_DEFAULT,
      }))
    : null;

  registryVersion++;
  listeners.forEach((fn) => fn());
}

export function registerStreamedChunk(tileKey: string, registration: StreamedChunkRegistration) {
  chunks.set(tileKey, {
    regionId: registration.regionId,
    buildings: registration.buildings ?? [],
    trees: registration.trees ?? [],
    roadPlots: registration.roadPlots ?? [],
    roads: registration.roads ?? [],
    labels: registration.labels ?? [],
  });
  rebuildIndexes();
}

export function unregisterStreamedChunk(tileKey: string) {
  if (!chunks.delete(tileKey)) return;
  rebuildIndexes();
}

export function setStreamedPendingTileBounds(datasetKey: string, zones: LoadingRegionZone[]) {
  if (!zones.length) {
    if (pendingTileZones.delete(datasetKey)) {
      registryVersion++;
      listeners.forEach((fn) => fn());
    }
    return;
  }
  pendingTileZones.set(datasetKey, zones);
  registryVersion++;
  listeners.forEach((fn) => fn());
}

export function isPositionWaitingForStreamedTile(x: number, z: number): boolean {
  for (const zones of pendingTileZones.values()) {
    for (const zone of zones) {
      if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
        return true;
      }
    }
  }
  return false;
}

export function queryStreamedBuildings(x: number, z: number): readonly SpatialColliderBuilding[] {
  return buildingLookup ? buildingLookup(x, z) : [];
}

export function queryStreamedTrees(x: number, z: number): readonly SpatialColliderTree[] {
  return treeLookup ? treeLookup(x, z) : [];
}

export function isStreamedPrivateHome(id: string): boolean {
  return privateHomeIdsCache.has(id);
}

export function getStreamedRoadPlotsForRegion(regionId: string): RoadPlot[] {
  const seen = new Map<string, RoadPlot>();
  for (const chunk of chunks.values()) {
    if (chunk.regionId !== regionId) continue;
    for (const road of chunk.roadPlots) {
      if (!seen.has(road.id)) seen.set(road.id, road);
    }
  }
  return [...seen.values()];
}

export function getStreamedAllBuildingsForRegion(regionId: string): SpatialColliderBuilding[] {
  const out: SpatialColliderBuilding[] = [];
  for (const chunk of chunks.values()) {
    if (chunk.regionId !== regionId) continue;
    for (const b of chunk.buildings) {
      out.push({
        id: b.id,
        x: b.x,
        z: b.z,
        width: b.width,
        depth: b.depth,
        rotation: b.rotation,
        privateHome: Boolean(b.privateHome),
      });
    }
  }
  return out;
}

export function getStreamedLabels(): MapLabel[] {
  return cachedLabels;
}

export function getStreamedChunkVersion(): number {
  return registryVersion;
}

export function getStreamedChunkStats() {
  return {
    residentChunks: chunks.size,
    buildingColliders: buildingCollidersTotal,
    treeColliders: treeCollidersTotal,
    roadPlots: roadPlotsTotal,
    labels: cachedLabels.length,
    loadingCorridors: pendingTileZones.size,
    version: registryVersion,
  };
}

export function subscribeStreamedChunks(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function clearStreamedChunksForTests() {
  chunks.clear();
  pendingTileZones.clear();
  rebuildIndexes();
}

/**
 * Decodes a spatial GeoJSON tile payload into world-space village buildings, roads, patrol plots,
 * trees, and landmark labels using its calibrated per-dataset projection.
 */
export function decodeStreamedTileFeatures(
  payload: MapTilePayload,
  projection: MapProjection,
): DecodedStreamedTile {
  const buildings: StreamedBuildingRecord[] = [];
  const roads: StreamedRoadPolyline[] = [];
  const roadPlots: RoadPlot[] = [];
  const trees: StreamedTreeRecord[] = [];
  const labels: MapLabel[] = [];

  for (const feature of payload.features) {
    const props = (feature.properties ?? {}) as Record<string, unknown>;
    const kind = String(props.kind ?? '');
    const geom = feature.geometry as { type?: string; coordinates?: unknown } | null;
    if (!geom) continue;
    const id = String(feature.id);

    if (kind === 'building' && geom.type === 'Polygon') {
      const rings = geom.coordinates as [number, number][][];
      const outer = rings[0] ?? [];
      const polygonPoints: [number, number][] = outer.map(([lon, lat]) => {
        const p = projectMapPoint(projection, lon, lat);
        return [Number(p.x.toFixed(3)), Number(p.z.toFixed(3))];
      });
      const anchorGeo = Array.isArray(props.anchorGeo) ? (props.anchorGeo as [number, number]) : null;
      let cx = 0;
      let cz = 0;
      if (anchorGeo && anchorGeo.length >= 2) {
        const p = projectMapPoint(projection, anchorGeo[0], anchorGeo[1]);
        cx = p.x;
        cz = p.z;
      } else if (polygonPoints.length > 0) {
        const uniquePts = polygonPoints.length > 1 ? polygonPoints.slice(0, -1) : polygonPoints;
        for (const [px, pz] of uniquePts) {
          cx += px;
          cz += pz;
        }
        cx /= uniquePts.length;
        cz /= uniquePts.length;
      }

      const relativePoints: [number, number][] = polygonPoints.map(([px, pz]) => [
        Number((px - cx).toFixed(3)),
        Number((pz - cz).toFixed(3)),
      ]);
      const customComponent = typeof props.customComponent === 'string' && props.customComponent ? props.customComponent : null;
      const wallWidth = Number(props.width ?? props.houseWidth ?? 6.5);
      const wallDepth = Number(props.depth ?? props.houseLength ?? 7.5);
      const record: StreamedBuildingRecord = {
        id,
        osmId: typeof props.osmId === 'number' ? props.osmId : undefined,
        osmType: typeof props.osmType === 'string' ? props.osmType : 'way',
        name: String(props.name ?? id),
        x: cx,
        z: cz,
        width: wallWidth,
        depth: wallDepth,
        height: Number(props.height ?? 3.8),
        area: Number(props.area ?? 48),
        wallColor: String(props.wallColor ?? '#d6c5a0'),
        roofColor: String(props.roofColor ?? '#7d4f3b'),
        rotation: Number(props.rotation ?? 0),
        houseLength: Number(props.houseLength ?? wallDepth),
        houseWidth: Number(props.houseWidth ?? wallWidth),
        wallHeight: Number(props.wallHeight ?? 3.2),
        roofHeight: Number(props.roofHeight ?? 1.6),
        polygonPoints,
        relativePoints,
        customComponent,
        privateHome: Boolean(props.privateHome ?? !customComponent),
      };
      buildings.push(record);

      if (customComponent) {
        labels.push({
          id: `streamed-poi:${id}`,
          name: record.name,
          x: cx,
          z: cz,
          kind: 'place',
          priority: 72,
        });
      }
    } else if (kind === 'road' && geom.type === 'LineString') {
      const coords = geom.coordinates as [number, number][];
      const worldPoints: [number, number][] = coords.map(([lon, lat]) => {
        const p = projectMapPoint(projection, lon, lat);
        return [Number(p.x.toFixed(2)), Number(p.z.toFixed(2))];
      });
      roads.push({
        id,
        highway: String(props.highway ?? 'residential'),
        name: String(props.name ?? 'လမ်း'),
        worldPoints,
        width: Number(props.width ?? 5.5),
      });
    } else if (kind === 'road-plot' && geom.type === 'Point') {
      const [lon, lat] = geom.coordinates as [number, number];
      const p = projectMapPoint(projection, lon, lat);
      roadPlots.push({
        id,
        name: String(props.name ?? 'လမ်း'),
        x: p.x,
        z: p.z,
        width: Number(props.width ?? 20),
        depth: Number(props.depth ?? 5.5),
        rotation: Number(props.rotation ?? 0),
        main: Boolean(props.main),
      });
    } else if (kind === 'tree' && geom.type === 'Point') {
      const [lon, lat] = geom.coordinates as [number, number];
      const p = projectMapPoint(projection, lon, lat);
      trees.push({
        id,
        x: p.x,
        z: p.z,
        radius: Number(props.radius ?? 0.6),
        variant: props.variant === 'large' ? 'large' : 'canopy',
      });
    }
  }

  return { buildings, roads, roadPlots, trees, labels };
}
