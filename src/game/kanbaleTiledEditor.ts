import kanbaleDatasetJson from '../data/kanbaleDataset.json' with { type: 'json' };
import { fetchMapJson, validateManifest, type MapTilePayload } from './mapTileStore.ts';
import type { MapProjection } from './mapProjection.ts';
import {
  decodeStreamedTileFeatures,
  type StreamedBuildingRecord,
  type StreamedRoadPolyline,
  type StreamedTreeRecord,
} from './streamedChunkRegistry.ts';
import type { LayoutFeature } from './worldLayout.ts';
import type { RoadPlot } from '../data/types.ts';

export type KanbaleStreamedData = {
  buildings: StreamedBuildingRecord[];
  roads: StreamedRoadPolyline[];
  roadPlots: RoadPlot[];
  trees: StreamedTreeRecord[];
};

let cachedData: KanbaleStreamedData | null = null;
let cachedFeatures: LayoutFeature[] | null = null;
let pendingPromise: Promise<KanbaleStreamedData> | null = null;

function markSourceKanbale(feature: LayoutFeature): LayoutFeature {
  const { points, rotation, dimensions, width, assetId, color, roofColor, name } = feature;
  const sourceSnapshot = JSON.parse(
    JSON.stringify({ points, rotation, dimensions, width, assetId, color, roofColor, name }),
  );
  return {
    ...feature,
    metadata: {
      ...feature.metadata,
      authored: true,
      sourceId: feature.id,
      sourceRegion: 'kanbale',
      sourceAssetId: assetId,
      sourceX: points[0]?.x ?? 0,
      sourceZ: points[0]?.z ?? 0,
      sourceRotation: rotation ?? 0,
      sourceWidth: dimensions?.width ?? width,
      sourceDepth: dimensions?.depth,
      sourceSnapshot,
    },
  };
}

export function convertKanbaleDataToLayoutFeatures(data: KanbaleStreamedData): LayoutFeature[] {
  const unique = new Map<string, LayoutFeature>();

  for (const b of data.buildings) {
    const assetId = b.id.includes('403030614')
      ? 'building:village-school'
      : b.id.includes('403027623')
        ? 'building:rice-mill'
        : 'building:sithar-house';
    const feature: LayoutFeature = {
      id: b.id,
      kind: 'house',
      name: b.name || 'အဆောက်အဦ',
      assetId,
      points: [{ x: b.x, z: b.z }],
      rotation: b.rotation ?? 0,
      dimensions: {
        width: b.houseWidth || b.width,
        depth: b.houseLength || b.depth,
        ...(b.height ? { height: b.height } : {}),
      },
      color: b.wallColor,
      roofColor: b.roofColor,
      metadata: {
        geometry: 'rectangle',
        category: 'building',
        sourceType: undefined,
      },
    };
    unique.set(feature.id, markSourceKanbale(feature));
  }

  for (const r of data.roads) {
    const feature: LayoutFeature = {
      id: r.id,
      kind: 'road',
      name: r.name || 'လမ်း',
      points: r.worldPoints.map(([x, z]) => ({ x, z })),
      width: r.width,
      metadata: {
        geometry: 'polyline',
        category: 'road',
      },
    };
    unique.set(feature.id, markSourceKanbale(feature));
  }

  for (const t of data.trees) {
    const variant = t.variant === 'large' ? 'large' : 'canopy';
    const size = 13;
    const feature: LayoutFeature = {
      id: t.id,
      kind: 'tree',
      name: 'သစ်ပင်',
      assetId: `nature:${variant === 'large' ? 'shade' : variant}-tree`,
      points: [{ x: t.x, z: t.z }],
      rotation: 0,
      dimensions: { width: size, depth: size, height: 17.6 },
      metadata: {
        geometry: 'rectangle',
        category: 'tree',
        variant,
        radius: t.radius,
      },
    };
    unique.set(feature.id, markSourceKanbale(feature));
  }

  return [...unique.values()];
}

export function hydrateKanbaleFromPayloads(
  payloads: readonly MapTilePayload[],
  projection = kanbaleDatasetJson.projection as MapProjection,
): KanbaleStreamedData {
  const buildingsById = new Map<string, StreamedBuildingRecord>();
  const roadsById = new Map<string, StreamedRoadPolyline>();
  const roadPlotsById = new Map<string, RoadPlot>();
  const treesById = new Map<string, StreamedTreeRecord>();

  for (const payload of payloads) {
    const decoded = decodeStreamedTileFeatures(payload, projection);
    for (const b of decoded.buildings) buildingsById.set(b.id, b);
    for (const r of decoded.roads) roadsById.set(r.id, r);
    for (const rp of decoded.roadPlots) roadPlotsById.set(rp.id, rp);
    for (const t of decoded.trees) treesById.set(t.id, t);
  }

  const data: KanbaleStreamedData = {
    buildings: [...buildingsById.values()],
    roads: [...roadsById.values()],
    roadPlots: [...roadPlotsById.values()],
    trees: [...treesById.values()],
  };
  cachedData = data;
  cachedFeatures = convertKanbaleDataToLayoutFeatures(data);
  return data;
}

export function getCachedKanbaleStreamedData(): KanbaleStreamedData | null {
  return cachedData;
}

export function getCachedKanbaleAuthoredFeatures(): LayoutFeature[] {
  return cachedFeatures ?? [];
}

export function clearKanbaleTiledCacheForTests() {
  cachedData = null;
  cachedFeatures = null;
  pendingPromise = null;
}

/**
 * Loads all versioned Kanbale JSON chunks via fetch (reusing cached payloads if already hydrated).
 * Used cleanly on demand by WardVillageEditor, KanbalePlan, and MapSelectionMap.
 */
export async function loadKanbaleStreamedData(
  readJson?: (url: string, maxBytes: number, expectedSha256?: string) => Promise<unknown>,
): Promise<KanbaleStreamedData> {
  if (cachedData) return cachedData;
  if (!pendingPromise) {
    pendingPromise = (async () => {
      const controller = new AbortController();
      const base = typeof location === 'undefined' ? 'http://localhost/' : location.href;
      const manifestUrl = new URL(kanbaleDatasetJson.manifest, base);
      const load =
        readJson ??
        ((url: string, maxBytes: number, expectedSha256?: string) =>
          fetchMapJson(url, controller.signal, maxBytes, expectedSha256));

      const manifest = validateManifest(
        await load(
          readJson ? kanbaleDatasetJson.manifest : manifestUrl.href,
          4 * 1024 * 1024,
        ),
      );
      const payloads: MapTilePayload[] = [];
      for (const tile of manifest.tiles) {
        const tilePath = readJson ? tile.url : new URL(tile.url, manifestUrl).href;
        const payload = (await load(tilePath, tile.bytes, tile.sha256)) as MapTilePayload;
        payloads.push(payload);
      }
      return hydrateKanbaleFromPayloads(payloads, kanbaleDatasetJson.projection as MapProjection);
    })().finally(() => {
      pendingPromise = null;
    });
  }
  return pendingPromise;
}

export async function loadKanbaleAuthoredFeatures(
  readJson?: (url: string, maxBytes: number, expectedSha256?: string) => Promise<unknown>,
): Promise<LayoutFeature[]> {
  if (cachedFeatures) return cachedFeatures;
  await loadKanbaleStreamedData(readJson);
  return cachedFeatures ?? [];
}
